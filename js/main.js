import { app } from "./firebase-config.js"; // Import the Firebase app for use if needed

document.addEventListener('DOMContentLoaded', () => {
    // Navigation Menu Toggle
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('nav ul');

    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('open');
    });

    // Smooth Scroll for Anchor Links
    const links = document.querySelectorAll('a[href^="#"]');

    for (const link of links) {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            document.getElementById(targetId).scrollIntoView({
                behavior: 'smooth'
            });
        });
    }

    // Example Firebase usage: Check if Firebase is initialized
    console.log("Firebase App initialized:", app);
});
