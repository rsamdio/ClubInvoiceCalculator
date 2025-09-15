// Firebase Configuration Loader
// - In production (Netlify): requires vars from window.ENV
// - In local development: uses values from firebase-config-local.js

import { firebaseConfig as localConfig } from './firebase-config-local.js';

  let firebaseConfig = localConfig;

  const isLocalhost = (typeof window !== 'undefined') && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1'
  );

  if (typeof window !== 'undefined' && window.ENV && window.ENV.FIREBASE_API_KEY) {
    firebaseConfig = {
      apiKey: window.ENV.FIREBASE_API_KEY,
      authDomain: window.ENV.FIREBASE_AUTH_DOMAIN,
      projectId: window.ENV.FIREBASE_PROJECT_ID,
      storageBucket: window.ENV.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: window.ENV.FIREBASE_MESSAGING_SENDER_ID,
      appId: window.ENV.FIREBASE_APP_ID,
      measurementId: window.ENV.FIREBASE_MEASUREMENT_ID
    };
  }

export { firebaseConfig };
