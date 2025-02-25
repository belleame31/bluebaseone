const db = firebase.firestore();
let currentAlbumId = null; // Track the current album ID
let isRearranging = false; // Track rearrange mode

document.addEventListener('DOMContentLoaded', () => {
    loadAlbums();
    loadSuggestedPhotocards(); // Preload suggested photocards for suggestions
    
    // Load and initialize the editable "Your Albums" header
    const yourAlbumsHeader = document.querySelector('.your-albums-header h2');
    const savedText = localStorage.getItem('yourAlbumsText');
    if (savedText) {
        yourAlbumsHeader.textContent = savedText;
    }

    // Save text to localStorage when edited
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
            cover: albumCover || 'https://via.placeholder.com/300x200', // Default rectangular cover
            cards: []
        });
        alert(`Album "${albumName}" created!`);
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
        const snapshot = await db.collection('userAlbums').get();
        console.log('Snapshot received:', snapshot);

        if (snapshot.empty) {
            console.log('No albums found in userAlbums collection.');
            container.innerHTML = '<p>You have no albums. Create one above!</p>';
            return;
        }

        let hasMatches = false;
        snapshot.forEach(doc => {
            const album = doc.data();
            console.log('Album data:', album);
            const cards = Array.isArray(album.cards) ? album.cards : [];

            const albumMatches = !query || 
                album.name.toLowerCase().includes(query) || 
                cards.some(card => 
                    (card.name && card.name.toLowerCase().includes(query)) ||
                    (card.member && card.member.toLowerCase().includes(query)) ||
                    (card.album && card.album.toLowerCase().includes(query)) ||
                    (card.type && card.type.toLowerCase().includes(query)) ||
                    (card.details && card.details.toLowerCase().includes(query))
                );

            if (albumMatches) {
                hasMatches = true;
                const albumDiv = document.createElement('div');
                albumDiv.className = 'album-section';
                albumDiv.innerHTML = `
                    <img src="${album.cover}" alt="${album.name} cover" class="album-cover" onclick="showAlbumPopup('${doc.id}', '${album.name}')">
                    <div class="album-info">
                        <h3>${album.name}</h3>
                        <span class="edit-logo" onclick="showEditModal('${doc.id}', '${album.name}', '${album.cover}')">✎</span>
                    </div>
                `;
                container.appendChild(albumDiv);
            }
        });

        if (!hasMatches && query) {
            container.innerHTML = '<p>No albums match your search.</p>';
        }
    } catch (error) {
        console.error('Detailed error loading albums:', error.message, error.code, error.stack);
        container.innerHTML = '<p>Error loading albums: ' + error.message + '</p>';
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
    const query = document.getElementById('album-search-input').value.toLowerCase();
    loadAlbums(query);
}

function showAlbumPopup(albumId, albumName) {
    currentAlbumId = albumId; // Set the current album ID
    const modal = document.getElementById('album-modal');
    const modalAlbumName = document.getElementById('modal-album-name');
    const modalCardContainer = document.getElementById('modal-card-container');
    const cardsOnlyToggle = document.getElementById('cards-only-toggle');
    const rearrangeButton = document.getElementById('rearrange-button');

    modalAlbumName.textContent = albumName;
    modalCardContainer.innerHTML = '';
    cardsOnlyToggle.checked = false; // Reset toggle on open
    rearrangeButton.style.display = 'none'; // Hide rearrange button initially
    cardsOnlyToggle.onchange = () => toggleCardsOnly(this.checked, albumId);

    db.collection('userAlbums').doc(albumId).get().then(doc => {
        if (doc.exists) {
            const album = doc.data();
            const cards = Array.isArray(album.cards) ? album.cards : [];

            if (cards.length === 0) {
                modalCardContainer.innerHTML = '<p>No photocards in this album.</p>';
            } else {
                renderCards(cards, albumId, modalCardContainer);
                rearrangeButton.style.display = 'block'; // Show rearrange button when cards exist
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
    // Re-add event listeners after rendering, especially for rearrange mode
    if (isRearranging) {
        addRearrangeEventListeners(cards, albumId, container);
    }
}

function toggleCardsOnly(isChecked, albumId) {
    const modalCardContainer = document.getElementById('modal-card-container');
    const cardsOnlyToggle = document.getElementById('cards-only-toggle');
    const rearrangeButton = document.getElementById('rearrange-button');
    
    if (isChecked) {
        rearrangeButton.style.display = 'block'; // Show rearrange button in cards-only mode
        db.collection('userAlbums').doc(albumId).get().then(doc => {
            if (doc.exists) {
                const album = doc.data();
                const cards = Array.isArray(album.cards) ? album.cards : [];
                renderCards(cards, albumId, modalCardContainer);
            }
        });
    } else {
        rearrangeButton.style.display = 'none'; // Hide rearrange button in normal mode
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
    currentAlbumId = null; // Reset current album ID
    isRearranging = false; // Reset rearrange mode
    const rearrangeButton = document.getElementById('rearrange-button');
    rearrangeButton.style.display = 'none'; // Hide rearrange button when closing
}

function flipCard(card) {
    const cardInner = card.querySelector('.flip-card-inner');
    cardInner.style.transform = cardInner.style.transform === 'rotateY(180deg)' ? 'rotateY(0deg)' : 'rotateY(180deg)';
}

async function showEditModal(albumId, albumName, albumCover) {
    document.getElementById('edit-album-name').value = albumName;
    document.getElementById('edit-album-cover').value = albumCover || '';
    document.getElementById('edit-album-modal').style.display = 'block';

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
                cover: newCover || 'https://via.placeholder.com/300x200' // Default rectangular cover
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
    document.getElementById('edit-album-form').onsubmit = null; // Reset form event
}

async function loadSuggestedPhotocards() {
    try {
        const snapshot = await db.collection('photocards').limit(5).get(); // Fetch up to 5 suggested photocards
        const suggestions = [];
        snapshot.forEach(doc => {
            const card = doc.data();
            card.id = doc.id;
            suggestions.push(card);
        });
        window.suggestedPhotocards = suggestions; // Store for suggestions
    } catch (error) {
        console.error('Error loading suggested photocards:', error);
    }
}

function suggestPhotocards() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const suggestionsContainer = document.getElementById('search-suggestions');
    suggestionsContainer.innerHTML = '';

    if (!query && window.suggestedPhotocards) {
        // Show suggested photocards if input is empty
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
                <button onclick="selectSuggestion('${name}', '${card.member}', '${card.album}', '${card.type}', '${card.frontImageUrl}', '${card.backImageUrl || 'https://via.placeholder.com/150'}', '${card.details}')">Add</button>
            `;
            suggestionsContainer.appendChild(suggestion);
        });
    } else if (query && window.suggestedPhotocards) {
        // Filter suggestions based on query
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
                    <button onclick="selectSuggestion('${name}', '${card.member}', '${card.album}', '${card.type}', '${card.frontImageUrl}', '${card.backImageUrl || 'https://via.placeholder.com/150'}', '${card.details}')">Add</button>
                `;
                suggestionsContainer.appendChild(suggestion);
            });
        } else {
            suggestionsContainer.innerHTML = '<p>No suggestions found.</p>';
        }
    }

    suggestionsContainer.style.display = query || window.suggestedPhotocards ? 'block' : 'none';
}

function selectSuggestion(name, member, album, type, frontImage, backImage, details) {
    const albumId = document.getElementById('album-select-' + window.suggestedPhotocards.find(card => `${card.member} - ${card.album}` === name)?.id)?.value || '';
    addToAlbum(name, member, album, type, frontImage, backImage, details, albumId);
    document.getElementById('search-input').value = '';
    document.getElementById('search-suggestions').style.display = 'none';
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
                        toggleCardsOnly(true, currentAlbumId); // Reapply cards-only mode
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
    addRearrangeEventListeners(cards, albumId, modalCardContainer); // Re-add event listeners after rendering
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
        return Promise.resolve(); // Ensure async function returns a promise for chaining
    } catch (error) {
        console.error('Error saving card order:', error.message, error.code, error.stack);
        alert('Failed to save card order: ' + error.message);
        throw error; // Re-throw to propagate the error if needed
    }
}