// Firebase configuration for Briefing Minutes App
const firebaseConfig = {
    apiKey: "AIzaSyALK_YlhFl6XOTDY54SOhk4DUDLPq1PBEE",
    authDomain: "briefing-ded2b.firebaseapp.com",
    projectId: "briefing-ded2b",
    storageBucket: "briefing-ded2b.firebasestorage.app",
    messagingSenderId: "583386183547",
    appId: "1:583386183547:web:945d92eaa3d13f513defde",
    measurementId: "G-B4TWNT1FQ1"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase initialized from fire.js");
    }
}
