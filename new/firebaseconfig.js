// firebaseconfig.js – Firestore only, no Firebase Auth
const firebaseConfig = {
  apiKey: "AIzaSyBkUzXHWLWrfJvQmgMpFZR0scqImlM5ero",
  authDomain: "lmanagement-f87b5.firebaseapp.com",
  projectId: "lmanagement-f87b5",
  storageBucket: "lmanagement-f87b5.firebasestorage.app",
  messagingSenderId: "362288454582",
  appId: "1:362288454582:web:cf6a7ba391af7f6d22ff17",
  measurementId: "G-901JZV95EB"
};

// Initialize Firebase only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Make db a GLOBAL variable (attached to window)
// DO NOT use var, let, or const here – it must be global.
db = firebase.firestore();

// Optional: enable offline persistence
db.enablePersistence().catch(err => console.warn('Firestore persistence:', err));

console.log('✅ Firestore ready');