/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// ─────────────────────────────────────────────────────────────
// Config is loaded from environment variables automatically:
//   npm run dev          → reads .env.development  (tradeflow-dev)
//   npm run deploy:prod  → reads .env.production   (tradeflow-prod)
//
// Fill in your values in .env.development and .env.production
// Never commit those files to Git — they're in .gitignore
// ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const storage   = getStorage(app);
export const functions = getFunctions(app, 'europe-west1');

// Current environment — use to show DEV banner in the UI
export const APP_ENV = import.meta.env.VITE_APP_ENV ?? 'development';
export const IS_DEV  = APP_ENV === 'development';

export default app;
