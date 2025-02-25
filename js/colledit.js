// Function to get the card ID from URL parameters
function getCardIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('cardId');
}

let currentCardId = null;
let cardData = null;

// Function to load card data from Firestore
async function loadCardData(cardId) {
    currentCardId = cardId;
    const cardDocRef = firebase.firestore().collection('photocards').doc(cardId);
    
    try {
        const doc = await cardDocRef.get();
        if (doc.exists) {
            cardData = doc.data();
            document.querySelector('.flip-card-front').style.backgroundImage = `url('${cardData.frontImageUrl}')`;
            document.querySelector('.flip-card-back').style.backgroundImage = `url('${cardData.backImageUrl}')`;
        } else {
            console.log('No such document!');
        }
    } catch (error) {
        console.error('Error fetching card data:', error);
    }
}

function adjustImagePosition() {
    const horizontalSlider = document.getElementById('horizontal-position');
    const verticalSlider = document.getElementById('vertical-position');
    const flipCardFront = document.querySelector('.flip-card-front');
    const flipCardBack = document.querySelector('.flip-card-back');

    const horizontalValue = horizontalSlider.value;
    const verticalValue = verticalSlider.value;

    flipCardFront.style.backgroundPosition = `${horizontalValue}% ${verticalValue}%`;
    flipCardBack.style.backgroundPosition = `${horizontalValue}% ${verticalValue}%`;
}

function saveImagePosition() {
    const horizontalSlider = document.getElementById('horizontal-position');
    const verticalSlider = document.getElementById('vertical-position');

    const updatedPosition = {
        horizontal: horizontalSlider.value,
        vertical: verticalSlider.value
    };

    const cardDocRef = firebase.firestore().collection('photocards').doc(currentCardId);
    cardDocRef.update({
        frontImagePosition: updatedPosition
    }).then(() => {
        console.log('Image position updated successfully.');
    }).catch(error => {
        console.error('Error updating image position:', error);
    });
}

// Load the card data for editing
window.onload = () => {
    const cardId = getCardIdFromUrl();
    if (cardId) {
        loadCardData(cardId);
    } else {
        console.log('No card ID found in URL');
    }
};


// Load the card data for editing (replace 'your-card-id' with the actual card ID)
window.onload = () => {
    loadCardData('your-card-id');
};
