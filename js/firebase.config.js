// js/firebase.config.js
const firebaseConfig = {
  apiKey: "AIzaSyCFHmxdPKT-AAv4DmE7r3Z4FkIPpyXO4Nk",
  authDomain: "jebecard2.firebaseapp.com",
  projectId: "jebecard2",
  storageBucket: "jebecard2.appspot.com",
  messagingSenderId: "232190639449",
  appId: "1:232190639449:web:1527c60f2301e0cfb02048",
  measurementId: "G-GXTS890KQ2"
};

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  firebase.analytics();
  console.log('Firebase initialized successfully:', firebase);
} catch (error) {
  console.error('Firebase initialization failed:', error);
}