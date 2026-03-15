import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

let db: Firestore;

// This check prevents re-initializing the app in a serverless environment
// or during hot-reloads.
if (getApps().length === 0) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} else {
    const app = getApp();
    db = getFirestore(app);
}

/**
 * A server-side Firestore instance.
 */
export { db };
