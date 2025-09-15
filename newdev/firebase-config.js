// Firebase Configuration Loader
// - In production (Netlify): requires vars from window.ENV
// - In local development (localhost): dynamically imports firebase-config-local.js

  let firebaseConfig = {};

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
  } else if (isLocalhost) {
    try {
      const mod = await import('./firebase-config-local.js');
      firebaseConfig = mod.firebaseConfig;
    } catch (err) {
      console.error('Failed to load local Firebase config. Provide firebase-config-local.js or window.ENV.', err);
    }
  } else {
    console.error('window.ENV is missing in production. Ensure env values are injected before modules load.');
  }

export { firebaseConfig };
