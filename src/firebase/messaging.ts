'use client';

import { getApp, FirebaseError } from 'firebase/app';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// --- VAPID key from Firebase project settings ---
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/**
 * Checks if the browser supports Firebase Messaging.
 */
export async function isSupported() {
  if (typeof window === 'undefined') return false;
  
  // Basic browser support check for necessary APIs
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
    return false;
  }

  try {
    const { isSupported: firebaseIsSupported } = await import('firebase/messaging');
    return await firebaseIsSupported();
  } catch (e) {
    return false;
  }
}

/**
 * Requests permission for notifications and saves the token to Firestore.
 * @param uid The user's unique ID.
 * @param firestore A Firestore instance.
 */
export async function requestNotificationPermission(uid: string, firestore: Firestore) {
  if (typeof window === 'undefined') return { success: false, error: 'Not in browser' };

  const supported = await isSupported();
  if (!supported) {
     const msg = "FCM: Push notifications are not supported in this browser.";
     console.log(msg);
     return { success: false, error: msg };
  }

  try {
    const { getMessaging } = await import('firebase/messaging');
    
    // Explicitly register the service worker to help iOS/PWA environments find it
    if ('serviceWorker' in navigator) {
      console.log('FCM: Registering service worker...');
      await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      // Wait for it to be ready
      await navigator.serviceWorker.ready;
    }

    console.log('FCM: Requesting notification permission...');
    const permission = await Notification.requestPermission();
  
    if (permission === 'granted') {
      console.log('FCM: Notification permission granted.');
      const token = await saveMessagingDeviceToken(uid, firestore);
      if (token) {
          return { success: true, token };
      }
      return { success: false, error: 'Gagal mendapatkan token FCM' };
    } else {
      console.log('FCM: Unable to get permission to notify.');
      return { success: false, error: 'Izin notifikasi ditolak' };
    }
  } catch (err) {
    const msg = `FCM: Error during notification permission request: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    return { success: false, error: msg };
  }
}

/**
 * Retrieves the FCM token and saves it to the user's document in Firestore.
 * @param uid The user's unique ID.
 * @param firestore A Firestore instance.
 */
async function saveMessagingDeviceToken(uid: string, firestore: Firestore) {
  try {
    if (!VAPID_KEY || VAPID_KEY.includes('YOUR_VAPID_KEY_HERE')) {
        console.warn("FCM: VAPID key is incomplete or missing in .env.");
        return null;
    }

    console.log(`FCM: Using VAPID key: ${VAPID_KEY.substring(0, 5)}...`);
    const { getMessaging, getToken } = await import('firebase/messaging');
    const messaging = getMessaging(getApp());
    console.log('FCM: Attempting to get FCM token...');
    
    // Explicitly get the registration to pass to getToken
    const registration = await navigator.serviceWorker.ready;
    const fcmToken = await getToken(messaging, { 
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
    });
    
    if (fcmToken) {
      console.log('FCM: Token retrieved successfully.');
      console.log(`DEBUG_FCM_TOKEN: ${fcmToken}`);
      
      const userDocRef = doc(firestore, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      const existingTokens = userDoc.exists() ? userDoc.data()?.fcmTokens || [] : [];

      if (!existingTokens.includes(fcmToken)) {
        console.log('FCM: Saving new token to Firestore...');
        await setDoc(userDocRef, {
          fcmTokens: arrayUnion(fcmToken)
        }, { merge: true });
        console.log('FCM: Token registration complete.');
      } else {
        console.log('FCM: Token already registered.');
      }
      return fcmToken;
    } else {
      console.error('FCM: No token received.');
      return null;
    }
  } catch (error) {
    console.error('FCM Error:', error);
    if (error instanceof FirebaseError) {
        if (error.code === 'messaging/token-subscribe-failed') {
            console.error(
                'FCM: Token subscription failed. Enable FCM API:\n' +
                `https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=${firebaseConfig.projectId}`
            );
        }
    }
    throw error;
  }
}
