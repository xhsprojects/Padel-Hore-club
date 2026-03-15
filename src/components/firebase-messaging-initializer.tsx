'use client';

import { useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { requestNotificationPermission } from '@/firebase/messaging';

/**
 * An invisible component that initializes Firebase Cloud Messaging
 * for a logged-in user. It requests permission and saves the token.
 */
export function FirebaseMessagingInitializer() {
  const { user, isUserLoading, firestore } = useFirebase();

  useEffect(() => {
    // Only run this logic on the client, after initial loading, and if a user is logged in.
    if (typeof window !== 'undefined' && !isUserLoading && user && firestore) {
      requestNotificationPermission(user.uid, firestore);
    }
  }, [user, isUserLoading, firestore]);

  // This component does not render anything.
  return null;
}
