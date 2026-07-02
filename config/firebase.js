require('dotenv').config();
const admin = require('firebase-admin');

const firebaseClientConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
};

let db;
let bucket;
let auth;

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          : undefined,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
  
  db = admin.firestore();
  bucket = admin.storage().bucket();
  auth = admin.auth();
  
  db.isMock = false;
  bucket.isMock = false;
  auth.isMock = false;
  
  console.log('✅ Firebase Admin SDK Initialized Successfully with Real Data.');
} catch (err) {
  console.error('❌ Firebase initialization failed:', err.message);
  process.exit(1); // Crash the server if Firebase fails to connect
}

const isMockFirebase = false;

module.exports = { db, bucket, auth, firebaseClientConfig, isMockFirebase };
