import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Enable offline persistence via IndexedDB — reads/writes survive network loss.
// Falls back to getFirestore() on HMR re-init (initializeFirestore throws if called twice).
let _firestore;
try {
  _firestore = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  _firestore = getFirestore(firebaseApp);
}

export const firestore = _firestore;
export const firebaseAuth = getAuth(firebaseApp);
export const storage = getStorage(firebaseApp);
export default firebaseApp;
