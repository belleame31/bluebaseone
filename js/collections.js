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

// Load Photocards from Firebase
async function loadCards() {
    const photocardsCollection = db.collection('photocards');
    try {
        console.log('Fetching photocards...');
        const snapshot = await photocardsCollection.get();
        photocards = [];

        if (snapshot.empty) {
            console.log('No cards found!');
            document.getElementById('card-container').innerHTML = '<p>No cards available at the moment.</p>';
            return;
        }

        snapshot.forEach(doc => {
            let card = doc.data();
            card.id = doc.id;
            photocards.push(card);
        });

        sortByNewest(); // Sort by newest after loading
    } catch (error) {
        console.error('Error fetching photocards:', error);
        document.getElementById('card-container').innerHTML = '<p>Error loading cards.</p>';
    }
}

// Display Cards in the catalog
function displayCards(cards) {
    const cardContainer = document.getElementById('card-container');
    cardContainer.innerHTML = '';

    cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card');
        cardElement.innerHTML = `
            <div class="card-images">
                ${card.frontImageUrl ? `<img src="${card.frontImageUrl}" alt="${card.album}">` : ''}
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

        // Only open fullscreen on click, no flipping here
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
            displayCards(photocards);
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
    
    // Set images and gloss
    const frontFace = fullscreenFlipCard.querySelector('.card-360-face.front');
    const backFace = fullscreenFlipCard.querySelector('.card-360-face.back');
    frontFace.style.setProperty('--photo-url', `url('${card.frontImageUrl}')`);
    backFace.style.setProperty('--photo-url', `url('${card.backImageUrl}')`);
    
    // Reset rotation
    card360.style.transform = 'rotateY(0deg)';
    card360.style.setProperty('--rotation-angle', '0deg'); // Initial gloss position
    
    // Show the modal
    fullscreenFlipCard.classList.add('active');
    
    // Rotation state
    let isDragging = false;
    let startX;
    let rotateY = 0;
    
    // Handle touch/mouse start
    const handleStart = (e) => {
        e.preventDefault();
        isDragging = true;
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        startX = clientX;
        card360.classList.add('dragging');
        console.log('Drag started');
    };
    
    // Handle touch/mouse move
    const handleMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        
        // Calculate rotation based on horizontal drag distance
        const dx = clientX - startX;
        rotateY += dx * 0.5; // Adjusted sensitivity for smoother rotation
        
        // Normalize rotateY to 0-360 for gloss calculation
        const normalizedAngle = ((rotateY % 360) + 360) % 360;
        
        // Apply rotation and update gloss position
        card360.style.transform = `rotateY(${rotateY}deg)`;
        card360.style.setProperty('--rotation-angle', `${normalizedAngle}deg`);
        
        // Update starting point for continuous dragging
        startX = clientX;
    };
    
    // Handle touch/mouse end
    const handleEnd = (e) => {
        e.preventDefault();
        isDragging = false;
        card360.classList.remove('dragging');
        console.log('Drag ended');
    };
    
    // Clean up existing listeners
    container.removeEventListener('mousedown', handleStart);
    container.removeEventListener('mousemove', handleMove);
    container.removeEventListener('mouseup', handleEnd);
    container.removeEventListener('touchstart', handleStart);
    container.removeEventListener('touchmove', handleMove);
    container.removeEventListener('touchend', handleEnd);
    
    // Add event listeners for mouse (desktop)
    container.addEventListener('mousedown', handleStart);
    container.addEventListener('mousemove', handleMove);
    container.addEventListener('mouseup', handleEnd);
    
    // Add event listeners for touch (mobile)
    container.addEventListener('touchstart', handleStart, { passive: false });
    container.addEventListener('touchmove', handleMove, { passive: false });
    container.addEventListener('touchend', handleEnd, { passive: false });
}

// Function to close the fullscreen 360° card modal
function closeFullscreenFlipCard() {
    const fullscreenFlipCard = document.getElementById('fullscreen-flipcard');
    const card360 = fullscreenFlipCard.querySelector('.card-360');
    
    // Clean up by replacing the node (removes all listeners)
    card360.replaceWith(card360.cloneNode(true));
    fullscreenFlipCard.classList.remove('active');
    console.log('Modal closed via inline onclick');
}

// Sort Cards by Newest
function sortByNewest() {
    if (photocards.length === 0) return;
    const sortedCards = [...photocards].sort((a, b) => {
        const dateA = a.timestamp && typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate() : new Date(0);
        const dateB = b.timestamp && typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate() : new Date(0);
        return dateB - dateA;
    });
    displayCards(sortedCards);
}

// Sort Cards by Oldest
function sortByOldest() {
    if (photocards.length === 0) return;
    const sortedCards = [...photocards].sort((a, b) => {
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
        const favoriteCards = photocards.filter(card => card.isFavorite);
        displayCards(favoriteCards);
    } else {
        button.textContent = 'Show Favorites';
        displayCards(photocards);
    }
}

// Handle Search Function
function handleSearch() {
    let searchInput = document.getElementById('search-input').value.trim();
    const searchTerms = searchInput.split(/\s+/).map(term => term.toLowerCase()).filter(term => term);

    if (searchTerms.length === 0) {
        displayCards(photocards);
        return;
    }

    const filteredCards = photocards.filter(card => {
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
            loadCards();
        } else {
            console.log('No user signed in.');
            updateUserCatalogue(); // This will redirect to login
        }
    });
};