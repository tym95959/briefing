// fireduty.js - Firebase Configuration for Roster Management System
// This file contains the Firebase Realtime Database configuration.
// Make sure this file is placed in the same directory as your main HTML file.

const firebaseConfig = {
    apiKey: "AIzaSyDojmglqNlJmwgKYe0UcEcrElLV45SK9As",
    authDomain: "cardsystem-21773.firebaseapp.com",
    projectId: "cardsystem-21773",
    storageBucket: "cardsystem-21773.firebasestorage.app",
    messagingSenderId: "408973003834",
    appId: "1:408973003834:web:96db400ec750fb62dab903",
    measurementId: "G-6QX2WLEBTP"
};

// Expose config globally so the main HTML can access it
// The main HTML will use this variable to initialize Firebase
if (typeof window !== 'undefined') {
    window.firebaseConfig = firebaseConfig;
}

// Also export as module for compatibility (if needed in other contexts)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseConfig;
}
