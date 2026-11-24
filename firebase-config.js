/**
 * Pasalubong Corner — Firebase Cloud Firestore Configuration (Project: "pasalubong-54fb9")
 *
 * Configured for the "pasalubong-54fb9" Firebase Web App:
 * - Project ID: "pasalubong-54fb9"
 * - Auth Domain: "pasalubong-54fb9.firebaseapp.com"
 * - Storage Bucket: "pasalubong-54fb9.firebasestorage.app"
 * - App ID: "1:178151077762:web:b58e236e3693ff6b9f819b"
 * - Measurement ID: "G-4HMCNSWDV8"
 */
(function (root) {
  "use strict";

  const PASALUBONG_PROJECT_CONFIG = {
    apiKey: "AIzaSyDrFotjv7EMnvCNroUvwJrtoQ3L6ILd-Ls",
    authDomain: "pasalubong-54fb9.firebaseapp.com",
    projectId: "pasalubong-54fb9",
    storageBucket: "pasalubong-54fb9.firebasestorage.app",
    messagingSenderId: "178151077762",
    appId: "1:178151077762:web:b58e236e3693ff6b9f819b",
    measurementId: "G-4HMCNSWDV8"
  };

  root.PASALUBONG_DEFAULT_FIREBASE_CONFIG = PASALUBONG_PROJECT_CONFIG;
  root.FIREBASE_CONFIG = Object.assign({}, PASALUBONG_PROJECT_CONFIG);

  if (typeof window !== "undefined") {
    window.FIREBASE_CONFIG = root.FIREBASE_CONFIG;
  }
})(typeof window !== "undefined" ? window : globalThis);
