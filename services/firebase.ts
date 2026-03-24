
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: (process.env as any).FIREBASE_API_KEY || '',
  authDomain: (process.env as any).FIREBASE_AUTH_DOMAIN || '',
  projectId: (process.env as any).FIREBASE_PROJECT_ID || '',
  storageBucket: (process.env as any).FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: (process.env as any).FIREBASE_MESSAGING_SENDER_ID || '',
  appId: (process.env as any).FIREBASE_APP_ID || '',
};

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
