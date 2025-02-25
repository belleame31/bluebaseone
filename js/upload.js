// upload.js

// Firestore reference
const db = firebase.firestore();

function confirmPhotocardDetails() {
  const frontImageUrl = document.getElementById('front-image-url').value;
  const backImageUrl = document.getElementById('back-image-url').value;
  const member = document.getElementById('member').selectedOptions[0].text;
  const album = document.getElementById('album').selectedOptions[0].text;
  const type = document.getElementById('type').selectedOptions[0].text;
  const details = document.getElementById('details').value;

  if (!frontImageUrl) {
    showStatusMessage('Please enter a front image URL.', 'error');
    return;
  }

  if (!member || !album || !type) {
    showStatusMessage('Please select all options.', 'error');
    return;
  }

  document.getElementById('modal-member').textContent = `Member: ${member}`;
  document.getElementById('modal-album').textContent = `Album: ${album}`;
  document.getElementById('modal-type').textContent = `Type: ${type}`;
  document.getElementById('modal-details').textContent = `Details: ${details || 'No additional details provided'}`;
  document.getElementById('modal-front-image').src = frontImageUrl;
  document.getElementById('modal-back-image').src = backImageUrl || '';

  document.getElementById('confirmation-modal').style.display = 'flex';

  // Add click event to flip the card
  const card = document.getElementById("flip-card");
  card.addEventListener("click", function () {
    card.classList.toggle("flipped");
  });
}

function closeModal() {
  document.getElementById('confirmation-modal').style.display = 'none';
}

async function submitPhotocard() {
  const frontImageUrl = document.getElementById('front-image-url').value;
  const backImageUrl = document.getElementById('back-image-url').value;
  const member = document.getElementById('member').selectedOptions[0].text;
  const album = document.getElementById('album').selectedOptions[0].text;
  const type = document.getElementById('type').selectedOptions[0].text;
  const details = document.getElementById('details').value;

  try {
    await db.collection("photocards").add({
      frontImageUrl,
      backImageUrl,
      member,
      album,
      type,
      details,
      timestamp: new Date()
    });
    showStatusMessage('Photocard successfully added!', 'success');
    closeModal();
  } catch (error) {
    showStatusMessage(`Error adding photocard: ${error.message}`, 'error');
  }
}

function showStatusMessage(message, status) {
  const statusMessage = document.getElementById('status-message');
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${status}`;
  statusMessage.style.display = 'block';
}
