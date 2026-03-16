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
    if (!VAPID_KEY || VAPID_KEY.includes('YOUR_VAPID_KEY_HERE')) {
        console.warn("VAPID key is incomplete or missing in .env. Push notifications will not work until NEXT_PUBLIC_FIREBASE_VAPID_KEY is set correctly.");
        return;
    }
    const messaging = getMessaging(getApp());
    console.log('Attempting to get FCM token with VAPID key starting with:', VAPID_KEY.substring(0, 10) + '...');
    const fcmToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    
    if (fcmToken) {
      console.log('FCM Token retrieved successfully:', fcmToken);
      const userDocRef = doc(firestore, 'users', uid);
      
      const userDoc = await getDoc(userDocRef);
      const existingTokens = userDoc.exists() ? userDoc.data()?.fcmTokens || [] : [];

      if (!existingTokens.includes(fcmToken)) {
        console.log('Saving new FCM token to Firestore for user:', uid);
        await setDoc(userDocRef, {
          fcmTokens: arrayUnion(fcmToken)
        }, { merge: true });
        console.log('FCM token registration complete.');
      } else {
        console.log('FCM token already registered in Firestore.');
      }
    } else {
      console.error('No FCM token received. This usually means the browser blocked notifications OR the VAPID key is invalid/unauthorized.');
    }
  } catch (error) {
    console.error('Firebase Messaging Error:', error);
    if (error instanceof FirebaseError) {
        if (error.code === 'messaging/token-subscribe-failed') {
            console.error(
                'Token subscription failed. Please ensure the FCM API is enabled in Google Cloud Console:\n' +
                `https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=${firebaseConfig.projectId}`
            );
        } else if (error.code === 'messaging/permissions-blocked') {
            console.error('Notification permissions were blocked by the user or the browser.');
        }
    }
  }
}
