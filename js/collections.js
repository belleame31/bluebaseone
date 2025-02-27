// Ensure Firebase is initialized properly
if (typeof firebase === 'undefined') {
    console.error('Firebase is not initialized. Check firebase.config.js.');
    document.getElementById('page-title').textContent = 'Error: Firebase Not Loaded';
    document.getElementById('catalog-heading').textContent = 'Error: Firebase Not Loaded';
} else {
    console.log('Firebase initialized successfully.');
}

const db = firebase.firestore();
const auth = firebase.auth();
let photocards = [];
let displayedCards = [];
let lastVisible = null;
const cardsPerPage = 20;
let showFavoritesMode = false;

// Function to update the title and heading with the user's username
async function updateUserCatalogue() {
    const user = auth.currentUser;
    console.log('Current user:', user);
    if (user) {
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Firestore request timed out')), 5000)
            );
            const userDocPromise = db.collection('users').doc(user.uid).get();
            console.log('Fetching username for UID:', user.uid);
            const userDoc = await Promise.race([userDocPromise, timeoutPromise]);
            console.log('User doc data:', userDoc.data());

            const username = userDoc.exists && userDoc.data().username ? userDoc.data().username : 'User';
            document.getElementById('page-title').textContent = `${username} Catalogue`;
            document.getElementById('catalog-heading').textContent = `${username} Catalogue`;
            console.log('Title updated to:', `${username} Catalogue`);
        } catch (error) {
            console.error('Error fetching username from Firestore:', error);
            document.getElementById('page-title').textContent = 'User Catalogue';
            document.getElementById('catalog-heading').textContent = 'User Catalogue';
            alert('Unable to load username due to a network issue. Using default title.');
        }
    } else {
        console.log('No user signed in, redirecting to login...');
        document.getElementById('page-title').textContent = 'Photocard Catalogue';
        document.getElementById('catalog-heading').textContent = 'Photocard Catalogue';
        window.location.href = '../login.html';
    }
}

// Load Photocards from Firebase with Pagination
async function loadCards(startAfterDoc = null) {
    const photocardsCollection = db.collection('photocards');
    try {
        console.log('Fetching photocards batch...');
        const q = startAfterDoc
            ? photocardsCollection.orderBy('timestamp', 'desc').startAfter(startAfterDoc).limit(cardsPerPage)
            : photocardsCollection.orderBy('timestamp', 'desc').limit(cardsPerPage);
        const snapshot = await q.get();

        if (snapshot.empty && !startAfterDoc) {
            console.log('No cards found!');
            document.getElementById('card-container').innerHTML = '<p>No cards available at the moment.</p>';
            removeNextButton();
            return;
        }

        const newCards = [];
        snapshot.forEach(doc => {
            let card = doc.data();
            card.id = doc.id;
            newCards.push(card);
            if (!photocards.some(existing => existing.id === card.id)) {
                photocards.push(card);
            }
        });

        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        displayedCards = displayedCards.concat(newCards);
        displayCards(displayedCards);

        // Add or update "Next" button
        if (snapshot.size === cardsPerPage) {
            addNextButton();
        } else {
            removeNextButton();
        }
    } catch (error) {
        console.error('Error fetching photocards:', error);
        document.getElementById('card-container').innerHTML = '<p>Error loading cards.</p>';
    }
}

// Add "Next" button
function addNextButton() {
    let nextButton = document.getElementById('next-button');
    if (!nextButton) {
        nextButton = document.createElement('button');
        nextButton.id = 'next-button';
        nextButton.textContent = 'Next';
        nextButton.className = 'show-favorites-button'; // Reuse styling
        nextButton.addEventListener('click', () => loadCards(lastVisible));
        document.querySelector('.catalog').appendChild(nextButton);
    }
}

// Remove "Next" button
function removeNextButton() {
    const nextButton = document.getElementById('next-button');
    if (nextButton) {
        nextButton.remove();
    }
}

// Display Cards in the catalog
function displayCards(cards) {
    const cardContainer = document.getElementById('card-container');
    cardContainer.innerHTML = '';

    if (cards.length === 0) {
        cardContainer.innerHTML = '<p>No cards to display.</p>';
        return;
    }

    cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card');
        cardElement.innerHTML = `
            <div class="card-images">
                ${card.frontImageUrl ? `<img src="${card.frontImageUrl}" alt="${card.album}" loading="lazy">` : ''}
            </div>
            <div class="card-details">
                <h3>${card.member}</h3>
                <p><strong>Album:</strong> ${card.album}</p>
                <p><strong>Type:</strong> ${card.type}</p>
                <p><strong>Details:</strong> ${card.details}</p>
                <div class="card-actions">
                    <button class="favorite-button ${card.isFavorite ? 'liked' : ''}" 
                            onclick="toggleFavorite(event, '${card.id}')" 
                            aria-label="Favorite">
                    </button>
                    <button class="delete-button" 
                            onclick="deleteCard(event, '${card.id}')" 
                            aria-label="Delete">
                    </button>
                </div>
            </div>
        `;

        cardElement.addEventListener('click', (e) => {
            if (!e.target.closest('.favorite-button') && !e.target.closest('.delete-button')) {
                console.log('Opening fullscreen for card:', card.id);
                openFullscreenFlipCard(card);
            }
        });
        cardContainer.appendChild(cardElement);
    });
}

// Function to toggle favorite status
async function toggleFavorite(event, cardId) {
    event.stopPropagation();
    const card = photocards.find(c => c.id === cardId);
    if (card) {
        card.isFavorite = !card.isFavorite;
        const button = event.currentTarget;
        button.classList.toggle('liked');

        try {
            await db.collection('photocards').doc(cardId).update({ isFavorite: card.isFavorite });
            console.log(`Card with ID ${cardId} favorite status updated to ${card.isFavorite}.`);
            if (showFavoritesMode) {
                displayCards(displayedCards.filter(c => c.isFavorite));
            }
        } catch (error) {
            console.error("Error updating favorite status: ", error);
        }
    }
}

// Function to delete a card
async function deleteCard(event, cardId) {
    event.stopPropagation();
    const confirmation = window.confirm("Are you sure you want to delete this card?");
    if (confirmation) {
        try {
            await db.collection('photocards').doc(cardId).delete();
            console.log(`Card with ID ${cardId} deleted successfully.`);
            photocards = photocards.filter(card => card.id !== cardId);
            displayedCards = displayedCards.filter(card => card.id !== cardId);
            displayCards(displayedCards);
            if (displayedCards.length < cardsPerPage && lastVisible) {
                loadCards(lastVisible); // Fetch more if below limit
            }
        } catch (error) {
            console.error("Error deleting card: ", error);
        }
    }
}

// Function to open and handle the fullscreen 360° card modal
function openFullscreenFlipCard(card) {
    const fullscreenFlipCard = document.getElementById('fullscreen-flipcard');
    const card360 = fullscreenFlipCard.querySelector('.card-360');
    const container = fullscreenFlipCard.querySelector('.card-container');

    const frontFace = fullscreenFlipCard.querySelector('.card-360-face.front');
    const backFace = fullscreenFlipCard.querySelector('.card-360-face.back');
    frontFace.style.setProperty('--photo-url', `url('${card.frontImageUrl}')`);
    backFace.style.setProperty('--photo-url', `url('${card.backImageUrl}')`);

    card360.style.transform = 'rotateY(0deg)';
    card360.style.setProperty('--rotation-angle', '0deg');

    fullscreenFlipCard.classList.add('active');

    let isDragging = false;
    let startX;
    let rotateY = 0;

    const handleStart = (e) => {
        e.preventDefault();
        isDragging = true;
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        startX = clientX;
        card360.classList.add('dragging');
        console.log('Drag started');
    };

    const handleMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const dx = clientX - startX;
        rotateY += dx * 0.5;
        const normalizedAngle = ((rotateY % 360) + 360) % 360;
        card360.style.transform = `rotateY(${rotateY}deg)`;
        card360.style.setProperty('--rotation-angle', `${normalizedAngle}deg`);
        startX = clientX;
    };

    const handleEnd = (e) => {
        e.preventDefault();
        isDragging = false;
        card360.classList.remove('dragging');
        console.log('Drag ended');
    };

    container.removeEventListener('mousedown', handleStart);
    container.removeEventListener('mousemove', handleMove);
    container.removeEventListener('mouseup', handleEnd);
    container.removeEventListener('touchstart', handleStart);
    container.removeEventListener('touchmove', handleMove);
    container.removeEventListener('touchend', handleEnd);

    container.addEventListener('mousedown', handleStart);
    container.addEventListener('mousemove', handleMove);
    container.addEventListener('mouseup', handleEnd);
    container.addEventListener('touchstart', handleStart, { passive: false });
    container.addEventListener('touchmove', handleMove, { passive: false });
    container.addEventListener('touchend', handleEnd, { passive: false });
}

// Function to close the fullscreen 360° card modal
function closeFullscreenFlipCard() {
    const fullscreenFlipCard = document.getElementById('fullscreen-flipcard');
    const card360 = fullscreenFlipCard.querySelector('.card-360');
    card360.replaceWith(card360.cloneNode(true));
    fullscreenFlipCard.classList.remove('active');
    console.log('Modal closed via inline onclick');
}

// Sort Cards by Newest
function sortByNewest(cardsToSort = displayedCards) {
    if (cardsToSort.length === 0) return;
    const sortedCards = [...cardsToSort].sort((a, b) => {
        const dateA = a.timestamp && typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate() : new Date(0);
        const dateB = b.timestamp && typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate() : new Date(0);
        return dateB - dateA;
    });
    displayCards(sortedCards);
}

// Sort Cards by Oldest
function sortByOldest(cardsToSort = displayedCards) {
    if (cardsToSort.length === 0) return;
    const sortedCards = [...cardsToSort].sort((a, b) => {
        const dateA = a.timestamp && typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate() : new Date(0);
        const dateB = b.timestamp && typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate() : new Date(0);
        return dateA - dateB;
    });
    displayCards(sortedCards);
}

// Toggle Show Favorites
function toggleShowFavorites() {
    showFavoritesMode = !showFavoritesMode;
    const button = document.getElementById('show-favorites-button');
    button.classList.toggle('active');
    if (showFavoritesMode) {
        button.textContent = 'Show All Cards';
        const favoriteCards = displayedCards.filter(card => card.isFavorite);
        displayCards(favoriteCards);
    } else {
        button.textContent = 'Show Favorites';
        displayCards(displayedCards);
    }
}

// Handle Search Function
function handleSearch() {
    let searchInput = document.getElementById('search-input').value.trim();
    const searchTerms = searchInput.split(/\s+/).map(term => term.toLowerCase()).filter(term => term);

    if (searchTerms.length === 0) {
        displayCards(displayedCards);
        return;
    }

    const filteredCards = displayedCards.filter(card => {
        return searchTerms.every(term => {
            return (
                (card.album && card.album.toLowerCase().includes(term)) ||
                (card.member && card.member.toLowerCase().includes(term)) ||
                (card.type && card.type.toLowerCase().includes(term)) ||
                (card.details && card.details.toLowerCase().includes(term))
            );
        });
    });

    displayCards(filteredCards);
}

// Handle Sort Change
function handleSortChange() {
    const sortValue = document.getElementById('sort-dropdown').value;
    if (sortValue === 'newest') {
        sortByNewest();
    } else if (sortValue === 'oldest') {
        sortByOldest();
    }
}

// Event listeners for sorting, searching, and favorites
document.getElementById('sort-dropdown').addEventListener('change', handleSortChange);
document.getElementById('search-input').addEventListener('keyup', handleSearch);
document.getElementById('show-favorites-button').addEventListener('click', toggleShowFavorites);

// Initialize the page
window.onload = function() {
    console.log('Page loaded, waiting for Firebase auth state...');
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('User signed in:', user.uid);
            updateUserCatalogue();
            loadCards(); // Load first 20 cards
        } else {
            console.log('No user signed in.');
            updateUserCatalogue(); // This will redirect to login
        }
    });
};