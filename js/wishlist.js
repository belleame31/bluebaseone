const db = firebase.firestore();
let currentAlbumId = null;
let isRearranging = false;
let currentPage = 1;
const albumsPerPage = 10;

document.addEventListener('DOMContentLoaded', () => {
    loadAlbums();
    loadSuggestedPhotocards();
    
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', suggestPhotocards);
    
    const yourAlbumsHeader = document.querySelector('.your-albums-header h2');
    const savedText = localStorage.getItem('yourAlbumsText');
    if (savedText) {
        yourAlbumsHeader.textContent = savedText;
    }

    yourAlbumsHeader.addEventListener('input', () => {
        localStorage.setItem('yourAlbumsText', yourAlbumsHeader.textContent);
    });
});

async function createAlbum() {
    const albumName = document.getElementById('album-name').value.trim();
    const albumCover = document.getElementById('album-cover').value.trim();
    if (!albumName) {
        alert('Please enter an album name.');
        return;
    }

    try {
        const albumRef = await db.collection('userAlbums').where('name', '==', albumName).get();
        if (!albumRef.empty) {
            alert(`Album "${albumName}" already exists!`);
            return;
        }

        await db.collection('userAlbums').add({
            name: albumName,
            cover: albumCover || 'https://via.placeholder.com/300x200',
            cards: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(`Album "${albumName}" created!`);
        currentPage = 1;
        loadAlbums();
    } catch (error) {
        console.error('Error creating album:', error.message, error.code, error.stack);
        alert('Failed to create album.');
    }
    document.getElementById('album-name').value = '';
    document.getElementById('album-cover').value = '';
}

async function loadAlbums(query = '') {
    const container = document.getElementById('album-container');
    container.innerHTML = '';

    try {
        console.log('Attempting to fetch albums from Firestore...');
        let querySnapshot = await db.collection('userAlbums').get();
        console.log('Snapshot received:', querySnapshot);

        if (querySnapshot.empty) {
            console.log('No albums found in userAlbums collection.');
            container.innerHTML = '<p>You have no albums. Create one above!</p>';
            return;
        }

        const allAlbums = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            // Provide a fallback timestamp for albums without createdAt
            const createdAt = data.createdAt || new firebase.firestore.Timestamp(0, 0); // Default to Unix epoch if missing
            allAlbums.push({ id: doc.id, ...data, createdAt });
        });

        // Sort albums by createdAt (newest first), handling null cases
        allAlbums.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
            return timeB - timeA; // Descending order
        });

        // Filter albums based on query
        const filteredAlbums = allAlbums.filter(album => {
            const cards = Array.isArray(album.cards) ? album.cards : [];
            return !query || 
                album.name.toLowerCase().includes(query) || 
                cards.some(card => 
                    (card.name && card.name.toLowerCase().includes(query)) ||
                    (card.member && card.member.toLowerCase().includes(query)) ||
                    (card.album && card.album.toLowerCase().includes(query)) ||
                    (card.type && card.type.toLowerCase().includes(query)) ||
                    (card.details && card.details.toLowerCase().includes(query))
                );
        });

        if (filteredAlbums.length === 0 && query) {
            container.innerHTML = '<p>No albums match your search.</p>';
            return;
        }

        // Pagination
        const totalPages = Math.ceil(filteredAlbums.length / albumsPerPage);
        const startIndex = (currentPage - 1) * albumsPerPage;
        const endIndex = startIndex + albumsPerPage;
        const paginatedAlbums = filteredAlbums.slice(startIndex, endIndex);

        paginatedAlbums.forEach(album => {
            const albumDiv = document.createElement('div');
            albumDiv.className = 'album-section';
            albumDiv.innerHTML = `
                <img src="${album.cover}" alt="${album.name} cover" class="album-cover" onclick="showAlbumPopup('${album.id}', '${album.name}')">
                <div class="album-info">
                    <h3>${album.name}</h3>
                    <span class="edit-logo" onclick="showEditModal('${album.id}', '${album.name}', '${album.cover}')">✎</span>
                </div>
            `;
            container.appendChild(albumDiv);
        });

        // Add pagination controls
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination-controls';
        paginationDiv.innerHTML = `
            <p>Page ${currentPage} of ${totalPages}</p>
            ${currentPage < totalPages ? '<button onclick="loadNextPage()">Next</button>' : ''}
            ${currentPage > 1 ? '<button onclick="loadPreviousPage()">Previous</button>' : ''}
        `;
        container.appendChild(paginationDiv);

    } catch (error) {
        console.error('Detailed error loading albums:', error.message, error.code, error.stack);
        container.innerHTML = '<p>Error loading albums: ' + error.message + '</p>';
    }
}

function loadNextPage() {
    currentPage++;
    loadAlbums(document.getElementById('album-search-input').value.toLowerCase());
}

function loadPreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        loadAlbums(document.getElementById('album-search-input').value.toLowerCase());
    }
}

async function removeFromAlbum(albumId, index) {
    try {
        const albumRef = db.collection('userAlbums').doc(albumId);
        const albumDoc = await albumRef.get();
        const album = albumDoc.data();
        const cards = Array.isArray(album.cards) ? album.cards : [];
        cards.splice(index, 1);

        if (cards.length === 0) {
            await albumRef.delete();
        } else {
            await albumRef.update({ cards: cards });
        }
        loadAlbums(document.getElementById('album-search-input').value.toLowerCase());
    } catch (error) {
        console.error('Error removing card from album:', error.message, error.code, error.stack);
        alert('Failed to remove card.');
    }
}

async function searchPhotocards() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    try {
        const snapshot = await db.collection('photocards').get();
        if (snapshot.empty) {
            resultsContainer.innerHTML = '<p>No photocards available.</p>';
            return;
        }

        const photocards = [];
        snapshot.forEach(doc => {
            const card = doc.data();
            card.id = doc.id;
            photocards.push(card);
        });

        const filteredCards = photocards.filter(card => 
            (card.member && card.member.toLowerCase().includes(query)) ||
            (card.album && card.album.toLowerCase().includes(query)) ||
            (card.type && card.type.toLowerCase().includes(query)) ||
            (card.details && card.details.toLowerCase().includes(query))
        );

        if (filteredCards.length === 0) {
            resultsContainer.innerHTML = '<p>No photocards found.</p>';
            return;
        }

        const albumSnapshot = await db.collection('userAlbums').get();
        console.log('Albums for dropdown:', albumSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
        const albumOptions = albumSnapshot.docs.map(doc => 
            `<option value="${doc.id}">${doc.data().name}</option>`
        ).join('');

        filteredCards.forEach(card => {
            const name = `${card.member} - ${card.album}`;
            const result = document.createElement('div');
            result.className = 'search-result';
            result.innerHTML = `
                <img src="${card.frontImageUrl}" alt="${name}" class="search-image">
                <h3>${name}</h3>
                <p>Member: ${card.member}</p>
                <p>Album: ${card.album}</p>
                <p>Type: ${card.type}</p>
                <p>Details: ${card.details}</p>
                <select id="album-select-${card.id}">
                    ${albumOptions || '<option value="">No albums available</option>'}
                </select>
                <button onclick="addToAlbum('${name}', '${card.member}', '${card.album}', '${card.type}', '${card.frontImageUrl}', '${card.backImageUrl || 'https://via.placeholder.com/150'}', '${card.details}', document.getElementById('album-select-${card.id}').value)">Add to Album</button>
            `;
            resultsContainer.appendChild(result);
        });
    } catch (error) {
        console.error('Error fetching photocards:', error.message, error.code, error.stack);
        resultsContainer.innerHTML = '<p>Error loading photocards: ' + error.message + '</p>';
    }
}

async function addToAlbum(name, member, album, type, frontImage, backImage, details, albumId) {
    console.log('Adding to album:', { name, member, album, type, frontImage, backImage, details, albumId });
    if (!albumId) {
        alert('Please create an album first or select a valid album!');
        return;
    }

    try {
        const albumRef = db.collection('userAlbums').doc(albumId);
        console.log('Fetching album with ID:', albumId);
        const albumDoc = await albumRef.get();
        if (!albumDoc.exists) {
            console.log('Album does not exist:', albumId);
            alert('Selected album no longer exists!');
            return;
        }

        const albumData = albumDoc.data();
        console.log('Album data fetched:', albumData);
        const cards = Array.isArray(albumData.cards) ? [...albumData.cards] : [];
        const newItem = { name, member, album, type, frontImage, backImage, details };
        console.log('New item to add:', newItem);

        if (!cards.some(item => item.name === name)) {
            cards.push(newItem);
            console.log('Updating Firestore with cards:', cards);
            await albumRef.update({ cards: cards });
            console.log('Update successful');
            alert(`${name} added to "${albumData.name}"!`);
            loadAlbums(document.getElementById('album-search-input').value.toLowerCase());
        } else {
            alert(`${name} is already in "${albumData.name}"!`);
        }
    } catch (error) {
        console.error('Error adding to album:', error.message, error.code, error.stack);
        alert('Failed to add to album: ' + error.message);
    }
}

function searchAlbums() {
    currentPage = 1;
    const query = document.getElementById('album-search-input').value.toLowerCase();
    loadAlbums(query);
}

function showAlbumPopup(albumId, albumName) {
    currentAlbumId = albumId;
    const modal = document.getElementById('album-modal');
    const modalAlbumName = document.getElementById('modal-album-name');
    const modalCardContainer = document.getElementById('modal-card-container');
    const cardsOnlyToggle = document.getElementById('cards-only-toggle');
    const rearrangeButton = document.getElementById('rearrange-button');

    modalAlbumName.textContent = albumName;
    modalCardContainer.innerHTML = '';
    cardsOnlyToggle.checked = false;
    rearrangeButton.style.display = 'none';
    cardsOnlyToggle.onchange = () => toggleCardsOnly(this.checked, albumId);

    db.collection('userAlbums').doc(albumId).get().then(doc => {
        if (doc.exists) {
            const album = doc.data();
            const cards = Array.isArray(album.cards) ? album.cards : [];

            if (cards.length === 0) {
                modalCardContainer.innerHTML = '<p>No photocards in this album.</p>';
            } else {
                renderCards(cards, albumId, modalCardContainer);
                rearrangeButton.style.display = 'block';
            }
            modal.style.display = 'block';
        } else {
            alert('Album no longer exists!');
        }
    }).catch(error => {
        console.error('Error fetching album for popup:', error);
        alert('Failed to load album details.');
    });
}

function renderCards(cards, albumId, container) {
    container.innerHTML = '';
    cards.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'modal-card-item';
        if (isRearranging && document.getElementById('cards-only-toggle').checked) {
            card.className += ' rearrange-mode';
            card.innerHTML = `
                <div class="flip-card" onclick="flipCard(this)">
                    <div class="flip-card-inner">
                        <div class="flip-card-front">
                            <img src="${item.frontImage || 'https://via.placeholder.com/210x300'}" alt="${item.name || 'Card'} front" class="modal-card-image">
                        </div>
                        <div class="flip-card-back">
                            <img src="${item.backImage || 'https://via.placeholder.com/210x300'}" alt="${item.name || 'Card'} back" class="modal-card-image">
                        </div>
                    </div>
                </div>
                <div class="card-controls">
                    <button class="move-up" onclick="moveCard('${albumId}', ${index}, 'up')">↑</button>
                    <button class="move-down" onclick="moveCard('${albumId}', ${index}, 'down')">↓</button>
                </div>
            `;
        } else if (document.getElementById('cards-only-toggle').checked) {
            card.className += ' modal-card-only';
            card.innerHTML = `
                <div class="flip-card" onclick="flipCard(this)">
                    <div class="flip-card-inner">
                        <div class="flip-card-front">
                            <img src="${item.frontImage || 'https://via.placeholder.com/210x300'}" alt="${item.name || 'Card'} front" class="modal-card-image">
                        </div>
                        <div class="flip-card-back">
                            <img src="${item.backImage || 'https://via.placeholder.com/210x300'}" alt="${item.name || 'Card'} back" class="modal-card-image">
                        </div>
                    </div>
                </div>
            `;
        } else {
            card.innerHTML = `
                <div class="flip-card" onclick="flipCard(this)">
                    <div class="flip-card-inner">
                        <div class="flip-card-front">
                            <img src="${item.frontImage || 'https://via.placeholder.com/210x300'}" alt="${item.name || 'Card'} front" class="modal-card-image">
                        </div>
                        <div class="flip-card-back">
                            <img src="${item.backImage || 'https://via.placeholder.com/210x300'}" alt="${item.name || 'Card'} back" class="modal-card-image">
                        </div>
                    </div>
                </div>
                <div class="card-details">
                    <h4>${item.name || 'Unnamed Card'}</h4>
                    <p>Member: ${item.member || 'Unknown'}</p>
                    <p>Album: ${item.album || 'Unknown'}</p>
                    <p>Type: ${item.type || 'Unknown'}</p>
                    <p>Details: ${item.details || 'No details'}</p>
                    <button onclick="removeFromAlbum('${albumId}', ${index}); closeModal(); loadAlbums(document.getElementById('album-search-input').value.toLowerCase())">Remove</button>
                </div>
            `;
        }
        container.appendChild(card);
    });
    if (isRearranging) {
        addRearrangeEventListeners(cards, albumId, container);
    }
}

function toggleCardsOnly(isChecked, albumId) {
    const modalCardContainer = document.getElementById('modal-card-container');
    const cardsOnlyToggle = document.getElementById('cards-only-toggle');
    const rearrangeButton = document.getElementById('rearrange-button');
    
    if (isChecked) {
        rearrangeButton.style.display = 'block';
        db.collection('userAlbums').doc(albumId).get().then(doc => {
            if (doc.exists) {
                const album = doc.data();
                const cards = Array.isArray(album.cards) ? album.cards : [];
                renderCards(cards, albumId, modalCardContainer);
            }
        });
    } else {
        rearrangeButton.style.display = 'none';
        db.collection('userAlbums').doc(albumId).get().then(doc => {
            if (doc.exists) {
                const album = doc.data();
                const cards = Array.isArray(album.cards) ? album.cards : [];
                renderCards(cards, albumId, modalCardContainer);
            }
        });
    }
}

function closeModal() {
    const modal = document.getElementById('album-modal');
    modal.style.display = 'none';
    currentAlbumId = null;
    isRearranging = false;
    const rearrangeButton = document.getElementById('rearrange-button');
    rearrangeButton.style.display = 'none';
}

function flipCard(card) {
    const cardInner = card.querySelector('.flip-card-inner');
    cardInner.style.transform = cardInner.style.transform === 'rotateY(180deg)' ? 'rotateY(0deg)' : 'rotateY(180deg)';
}

async function showEditModal(albumId, albumName, albumCover) {
    document.getElementById('edit-album-name').value = albumName;
    document.getElementById('edit-album-cover').value = albumCover || '';
    document.getElementById('edit-album-modal').style.display = 'block';

    let deleteButton = document.getElementById('delete-album-btn');
    if (!deleteButton) {
        deleteButton = document.createElement('button');
        deleteButton.id = 'delete-album-btn';
        deleteButton.textContent = 'Delete Album';
        deleteButton.className = 'delete-button';
        deleteButton.onclick = () => deleteAlbum(albumId);
        document.querySelector('#edit-album-modal .modal-content').appendChild(deleteButton);
    }

    document.getElementById('edit-album-form').onsubmit = async (e) => {
        e.preventDefault();
        const newName = document.getElementById('edit-album-name').value.trim();
        const newCover = document.getElementById('edit-album-cover').value.trim();

        if (!newName) {
            alert('Please enter an album name.');
            return;
        }

        try {
            const albumRef = db.collection('userAlbums').doc(albumId);
            await albumRef.update({
                name: newName,
                cover: newCover || 'https://via.placeholder.com/300x200'
            });
            alert('Album updated successfully!');
            closeEditModal();
            loadAlbums(document.getElementById('album-search-input').value.toLowerCase());
        } catch (error) {
            console.error('Error updating album:', error.message, error.code, error.stack);
            alert('Failed to update album: ' + error.message);
        }
    };
}

function closeEditModal() {
    const modal = document.getElementById('edit-album-modal');
    modal.style.display = 'none';
    document.getElementById('edit-album-form').onsubmit = null;
}

async function deleteAlbum(albumId) {
    try {
        const confirmDelete = confirm('Are you sure you want to delete this album? This action cannot be undone.');
        
        if (!confirmDelete) {
            return;
        }

        const albumRef = db.collection('userAlbums').doc(albumId);
        const albumDoc = await albumRef.get();
        
        if (!albumDoc.exists) {
            alert('Album no longer exists!');
            return;
        }

        await albumRef.delete();
        
        alert('Album deleted successfully!');
        closeEditModal();
        currentPage = 1;
        loadAlbums(document.getElementById('album-search-input').value.toLowerCase());
        
        if (currentAlbumId === albumId) {
            closeModal();
        }
    } catch (error) {
        console.error('Error deleting album:', error.message, error.code, error.stack);
        alert('Failed to delete album: ' + error.message);
    }
}

async function loadSuggestedPhotocards() {
    try {
        const snapshot = await db.collection('photocards').limit(5).get();
        const suggestions = [];
        snapshot.forEach(doc => {
            const card = doc.data();
            card.id = doc.id;
            suggestions.push(card);
        });
        window.suggestedPhotocards = suggestions;
    } catch (error) {
        console.error('Error loading suggested photocards:', error);
    }
}

function suggestPhotocards() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const suggestionsContainer = document.getElementById('search-suggestions');
    suggestionsContainer.innerHTML = '';

    suggestionsContainer.innerHTML = `
        <button class="close-suggestions" onclick="closeSuggestions()">×</button>
    `;

    if (!query && window.suggestedPhotocards) {
        window.suggestedPhotocards.forEach(card => {
            const name = `${card.member} - ${card.album}`;
            const suggestion = document.createElement('div');
            suggestion.className = 'suggestion-item';
            suggestion.innerHTML = `
                <img src="${card.frontImageUrl}" alt="${name}" class="suggestion-image">
                <div class="suggestion-details">
                    <span class="suggestion-name">${name}</span>
                    <p>Member: ${card.member}</p>
                    <p>Album: ${card.album}</p>
                    <p>Type: ${card.type}</p>
                    <p>Details: ${card.details}</p>
                </div>
                <button onclick="showAlbumSelectModal('${name}', '${card.member}', '${card.album}', '${card.type}', '${card.frontImageUrl}', '${card.backImageUrl || 'https://via.placeholder.com/150'}', '${card.details}')">Add</button>
            `;
            suggestionsContainer.appendChild(suggestion);
        });
    } else if (query && window.suggestedPhotocards) {
        const filteredSuggestions = window.suggestedPhotocards.filter(card => 
            (card.member && card.member.toLowerCase().includes(query)) ||
            (card.album && card.album.toLowerCase().includes(query)) ||
            (card.type && card.type.toLowerCase().includes(query)) ||
            (card.details && card.details.toLowerCase().includes(query))
        );

        if (filteredSuggestions.length > 0) {
            filteredSuggestions.forEach(card => {
                const name = `${card.member} - ${card.album}`;
                const suggestion = document.createElement('div');
                suggestion.className = 'suggestion-item';
                suggestion.innerHTML = `
                    <img src="${card.frontImageUrl}" alt="${name}" class="suggestion-image">
                    <div class="suggestion-details">
                        <span class="suggestion-name">${name}</span>
                        <p>Member: ${card.member}</p>
                        <p>Album: ${card.album}</p>
                        <p>Type: ${card.type}</p>
                        <p>Details: ${card.details}</p>
                    </div>
                    <button onclick="showAlbumSelectModal('${name}', '${card.member}', '${card.album}', '${card.type}', '${card.frontImageUrl}', '${card.backImageUrl || 'https://via.placeholder.com/150'}', '${card.details}')">Add</button>
                `;
                suggestionsContainer.appendChild(suggestion);
            });
        } else {
            suggestionsContainer.innerHTML += '<p>No suggestions found.</p>';
        }
    }

    suggestionsContainer.style.display = query || window.suggestedPhotocards ? 'block' : 'none';
}

async function showAlbumSelectModal(name, member, album, type, frontImage, backImage, details) {
    const modal = document.createElement('div');
    modal.id = 'album-select-modal';
    modal.className = 'modal';
    
    try {
        const albumSnapshot = await db.collection('userAlbums').get();
        const albumOptions = albumSnapshot.docs.map(doc => 
            `<option value="${doc.id}">${doc.data().name}</option>`
        ).join('');

        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="closeAlbumSelectModal()">×</span>
                <h2>Select Album for ${name}</h2>
                <select id="album-select">
                    <option value="">-- Select an Album --</option>
                    ${albumOptions || '<option value="">No albums available</option>'}
                </select>
                <button onclick="confirmAddToAlbum('${name}', '${member}', '${album}', '${type}', '${frontImage}', '${backImage}', '${details}')">Confirm</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading albums for selection:', error);
        alert('Failed to load album list: ' + error.message);
    }
}

function closeAlbumSelectModal() {
    const modal = document.getElementById('album-select-modal');
    if (modal) {
        modal.remove();
    }
    closeSuggestions();
}

function confirmAddToAlbum(name, member, album, type, frontImage, backImage, details) {
    const albumId = document.getElementById('album-select').value;
    if (!albumId) {
        alert('Please select an album!');
        return;
    }
    addToAlbum(name, member, album, type, frontImage, backImage, details, albumId);
    closeAlbumSelectModal();
    document.getElementById('search-input').value = '';
}

function closeSuggestions() {
    const suggestionsContainer = document.getElementById('search-suggestions');
    suggestionsContainer.style.display = 'none';
}

function toggleRearrangeMode() {
    isRearranging = !isRearranging;
    const rearrangeButton = document.getElementById('rearrange-button');
    const modalCardContainer = document.getElementById('modal-card-container');
    const cardsOnlyToggle = document.getElementById('cards-only-toggle');

    if (isRearranging) {
        rearrangeButton.textContent = 'Save Order';
        db.collection('userAlbums').doc(currentAlbumId).get().then(doc => {
            if (doc.exists) {
                const album = doc.data();
                const cards = Array.isArray(album.cards) ? album.cards : [];
                renderCards(cards, currentAlbumId, modalCardContainer);
                addRearrangeEventListeners(cards, currentAlbumId, modalCardContainer);
            }
        });
    } else {
        rearrangeButton.textContent = 'Edit Order';
        saveRearrangedOrder(currentAlbumId).then(() => {
            db.collection('userAlbums').doc(currentAlbumId).get().then(doc => {
                if (doc.exists) {
                    const album = doc.data();
                    const cards = Array.isArray(album.cards) ? album.cards : [];
                    renderCards(cards, currentAlbumId, modalCardContainer);
                    if (cardsOnlyToggle.checked) {
                        toggleCardsOnly(true, currentAlbumId);
                    }
                }
            });
        });
    }
}

function addRearrangeEventListeners(cards, albumId, container) {
    const moveUpButtons = container.querySelectorAll('.move-up');
    const moveDownButtons = container.querySelectorAll('.move-down');

    moveUpButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const indexMatch = button.getAttribute('onclick').match(/moveCard\('([^']*)',(\d+),'([^']*)'/);
            if (indexMatch && indexMatch[2]) {
                const index = parseInt(indexMatch[2], 10);
                moveCard(albumId, index, 'up');
            }
        });
    });

    moveDownButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const indexMatch = button.getAttribute('onclick').match(/moveCard\('([^']*)',(\d+),'([^']*)'/);
            if (indexMatch && indexMatch[2]) {
                const index = parseInt(indexMatch[2], 10);
                moveCard(albumId, index, 'down');
            }
        });
    });
}

async function moveCard(albumId, currentIndex, direction) {
    if (!isRearranging) return;

    const albumRef = db.collection('userAlbums').doc(albumId);
    const albumDoc = await albumRef.get();
    if (!albumDoc.exists) {
        alert('Album no longer exists!');
        return;
    }

    const album = albumDoc.data();
    const cards = Array.isArray(album.cards) ? [...album.cards] : [];
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= cards.length) return;

    [cards[currentIndex], cards[newIndex]] = [cards[newIndex], cards[currentIndex]];

    await albumRef.update({ cards: cards });
    const modalCardContainer = document.getElementById('modal-card-container');
    renderCards(cards, albumId, modalCardContainer);
    addRearrangeEventListeners(cards, albumId, modalCardContainer);
}

async function saveRearrangedOrder(albumId) {
    try {
        const modalCardContainer = document.getElementById('modal-card-container');
        const cardItems = modalCardContainer.querySelectorAll('.rearrange-mode');
        const newCards = [];

        for (const item of cardItems) {
            const moveUpButton = item.querySelector('.move-up');
            if (moveUpButton) {
                const onclickStr = moveUpButton.getAttribute('onclick');
                const indexMatch = onclickStr.match(/moveCard\('[^']*','([^']*)'/);
                if (indexMatch && indexMatch[1]) {
                    const index = parseInt(indexMatch[1], 10);
                    const albumDoc = await db.collection('userAlbums').doc(albumId).get();
                    if (albumDoc.exists) {
                        const album = albumDoc.data();
                        const cards = Array.isArray(album.cards) ? album.cards : [];
                        if (index >= 0 && index < cards.length) {
                            newCards.push(cards[index]);
                        }
                    }
                }
            }
        }

        if (newCards.length === 0) {
            throw new Error('No cards found to save order.');
        }

        await db.collection('userAlbums').doc(albumId).update({ cards: newCards });
        console.log('Card order saved successfully in Firestore');
        alert('Card order saved successfully!');
        return Promise.resolve();
    } catch (error) {
        console.error('Error saving card order:', error.message, error.code, error.stack);
        alert('Failed to save card order: ' + error.message);
        throw error;
    }
}