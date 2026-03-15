'use client';

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getApp, FirebaseError } from 'firebase/app';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// --- VAPID key from Firebase project settings ---
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/**
 * Requests permission for notifications and saves the token to Firestore.
 * @param uid The user's unique ID.
 * @param firestore A Firestore instance.
 */
export async function requestNotificationPermission(uid: string, firestore: Firestore) {
  const supported = await isSupported();
  if (!supported) {
    console.log("Firebase Messaging is not supported in this browser.");
    return;
  }

  console.log('Requesting notification permission...');
  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    console.log('Notification permission granted.');
    await saveMessagingDeviceToken(uid, firestore);
  } else {
    console.log('Unable to get permission to notify.');
  }
}

/**
 * Retrieves the FCM token and saves it to the user's document in Firestore.
 * @param uid The user's unique ID.
 * @param firestore A Firestore instance.
 */
async function saveMessagingDeviceToken(uid: string, firestore: Firestore) {
  try {
    if (!VAPID_KEY) {
        console.warn("VAPID key is missing. Push notifications will not work. Please set NEXT_PUBLIC_FIREBASE_VAPID_KEY in your .env file.");
        return;
    }
    const messaging = getMessaging(getApp());
    const fcmToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    
    if (fcmToken) {
      console.log('FCM Token:', fcmToken);
      const userDocRef = doc(firestore, 'users', uid);
      
      const userDoc = await getDoc(userDocRef);
      // If the doc doesn't exist, existingTokens will be an empty array.
      const existingTokens = userDoc.exists() ? userDoc.data()?.fcmTokens || [] : [];

      if (!existingTokens.includes(fcmToken)) {
        // Use set with merge to create the doc if it doesn't exist, or update it if it does.
        // This is safer than updateDoc for users who might not have a profile doc yet (like a default admin).
        await setDoc(userDocRef, {
          fcmTokens: arrayUnion(fcmToken)
        }, { merge: true });
        console.log('FCM token saved to Firestore.');
      } else {
        console.log('FCM token already exists for this user.');
      }
    } else {
      // This happens if the app is not in the foreground when permission is requested.
      // We need to ask the user to grant permission again.
      console.log('No registration token available. Request permission to generate one.');
      await requestNotificationPermission(uid, firestore);
    }
  } catch (error) {
    console.error('Unable to get messaging token.', error);
    if (error instanceof FirebaseError && error.code === 'messaging/token-subscribe-failed') {
        console.error(
            '********************************************************************************\n' +
            'This error usually means the Firebase Cloud Messaging API is not enabled for your project.\n' +
            'Please visit the following URL to enable it:\n' +
            `https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=${firebaseConfig.projectId}\n` +
            '********************************************************************************'
        );
    }
  }
}
