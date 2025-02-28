// Firestore reference
const db = firebase.firestore();

// Global flip handler with debounce
let isFlipping = false;
function flipCardHandler(event) {
    event.preventDefault();
    console.log('Flip handler triggered by:', event.type);
    if (isFlipping) {
        console.log('Flip skipped due to debounce');
        return;
    }

    isFlipping = true;
    const card = document.getElementById('flip-card');
    if (card) {
        const inner = card.querySelector('.flip-card-inner');
        if (inner) {
            card.classList.toggle('flipped');
            console.log('Card flipped, new state:', card.classList.contains('flipped'));
            // Fallback: Force transform if CSS fails
            if (card.classList.contains('flipped')) {
                inner.style.transform = 'rotateY(180deg)';
            } else {
                inner.style.transform = 'rotateY(0deg)';
            }
        } else {
            console.error('Inner card element (.flip-card-inner) not found');
        }
        setTimeout(() => { isFlipping = false; }, 800);
    } else {
        console.error('Card element (#flip-card) not found during flip attempt');
    }
}

function confirmPhotocardDetails() {
    const frontImageUrl = document.getElementById('front-image-url').value.trim();
    const backImageUrl = document.getElementById('back-image-url').value.trim();
    const member = document.getElementById('member').selectedOptions[0].text;
    const album = document.getElementById('album').selectedOptions[0].text;
    const type = document.getElementById('type').selectedOptions[0].text;
    const details = document.getElementById('details').value.trim();

    if (!frontImageUrl || !member || !album || !type) {
        document.getElementById('status-message').textContent = 'Please fill in all required fields (Front Image URL, Member, Album, Type).';
        return;
    }

    document.getElementById('modal-member').textContent = `Member: ${member}`;
    document.getElementById('modal-album').textContent = `Album: ${album}`;
    document.getElementById('modal-type').textContent = `Type: ${type}`;
    document.getElementById('modal-details').textContent = `Details: ${details || 'None'}`;

    const frontImage = document.getElementById('modal-front-image');
    const backImage = document.getElementById('modal-back-image');
    frontImage.onerror = () => { frontImage.src = 'https://via.placeholder.com/250x350?text=Front+Image+Failed'; };
    backImage.onerror = () => { backImage.src = 'https://via.placeholder.com/250x350?text=No+Back+Image'; };
    frontImage.src = frontImageUrl;
    backImage.src = backImageUrl || 'https://via.placeholder.com/250x350?text=No+Back+Image';

    const card = document.getElementById('flip-card');
    if (card) {
        card.classList.remove('flipped');
        const inner = card.querySelector('.flip-card-inner');
        if (inner) {
            inner.style.transform = 'rotateY(0deg)';
        }
        card.removeEventListener('click', flipCardHandler);
        card.removeEventListener('touchstart', flipCardHandler);
        card.removeEventListener('touchend', flipCardHandler);
        card.addEventListener('click', flipCardHandler);
        card.addEventListener('touchstart', flipCardHandler, { passive: true });
        card.addEventListener('touchend', flipCardHandler, { passive: true });
        console.log('Listeners added to #flip-card (click, touchstart, touchend)');
    } else {
        console.error('Card element (#flip-card) not found during modal setup');
    }

    document.getElementById('confirmation-modal').style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('confirmation-modal');
    if (modal) {
        modal.style.display = 'none';
        const card = document.getElementById('flip-card');
        if (card) {
            card.classList.remove('flipped');
            const inner = card.querySelector('.flip-card-inner');
            if (inner) {
                inner.style.transform = 'rotateY(0deg)';
            }
            card.removeEventListener('click', flipCardHandler);
            card.removeEventListener('touchstart', flipCardHandler);
            card.removeEventListener('touchend', flipCardHandler);
            console.log('Listeners removed from #flip-card');
        }
    }
    document.getElementById('status-message').textContent = '';
}

async function submitPhotocard() {
    const frontImageUrl = document.getElementById('front-image-url').value.trim();
    const backImageUrl = document.getElementById('back-image-url').value.trim();
    const member = document.getElementById('member').selectedOptions[0].text;
    const album = document.getElementById('album').selectedOptions[0].text;
    const type = document.getElementById('type').selectedOptions[0].text;
    const details = document.getElementById('details').value.trim();

    try {
        const docRef = await db.collection('photocards').add({
            frontImageUrl,
            backImageUrl: backImageUrl || null,
            member,
            album,
            type,
            details: details || '',
            isFavorite: false,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('activities').add({
            type: 'upload',
            description: `Uploaded photocard: ${member} - ${album}`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            cardId: docRef.id
        });

        document.getElementById('status-message').textContent = 'Photocard uploaded successfully!';
        closeModal();
        resetForm();
    } catch (error) {
        console.error('Error uploading photocard:', error);
        document.getElementById('status-message').textContent = 'Error uploading photocard. Please try again.';
    }
}

function resetForm() {
    document.getElementById('front-image-url').value = '';
    document.getElementById('back-image-url').value = '';
    document.getElementById('member').value = '';
    document.getElementById('album').value = '';
    document.getElementById('type').value = '';
    document.getElementById('details').value = '';
    document.getElementById('preview-section').innerHTML = '<p>No image uploaded yet.</p>';
}

document.getElementById('front-image-url').addEventListener('input', function() {
    const url = this.value.trim();
    const preview = document.getElementById('preview-section');
    if (url) {
        preview.innerHTML = `<img src="${url}" alt="Front Preview" style="max-width: 200px;">`;
    } else {
        preview.innerHTML = '<p>No image uploaded yet.</p>';
    }
});