// Firebase Configuration
// Replace these values with your own Firebase project configuration
// You can find these values in your Firebase Console: https://console.firebase.google.com/

// Your web app's Firebase configuration

  const firebaseConfig = {
    apiKey: "AIzaSyBZ5TNAO5BbAvG_zHVl4xicjseYFYIuO0g",
    authDomain: "clubinvoicecalculator.firebaseapp.com",
    projectId: "clubinvoicecalculator",
    storageBucket: "clubinvoicecalculator.firebasestorage.app",
    messagingSenderId: "1010215102213",
    appId: "1:1010215102213:web:ca10ec8a70f2bad338b96c",
    measurementId: "G-LDDE9F8646"
  };
  
// Instructions for setting up Firebase:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project or select an existing one
// 3. Click on "Add app" and select "Web"
// 4. Register your app with a nickname
// 5. Copy the configuration object and replace the values above
// 6. Enable Authentication:
//    - Go to Authentication > Sign-in method
//    - Enable Google sign-in
//    - Add your domain to authorized domains
// 7. Enable Firestore Database:
//    - Go to Firestore Database
//    - Create database in test mode (for development)
//    - Set up security rules to allow authenticated users to read/write their own data

// Security Rules for Firestore (add these in Firebase Console > Firestore Database > Rules):
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
*/

export { firebaseConfig };
