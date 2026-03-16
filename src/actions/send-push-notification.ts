
'use server';

import * as admin from 'firebase-admin';
import { Message } from 'firebase-admin/messaging';

// Helper to initialize the admin app safely
function getAdminApp() {
  // Check if the app is already initialized to prevent errors in hot-reload environments
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      // A basic check to see if the parsed object looks like a service account.
      if (serviceAccount.project_id && serviceAccount.private_key) {
        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
    } catch (e) {
      // If parsing fails, log a warning and fall through to the default initialization.
      console.warn(
        "FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON. Falling back to Application Default Credentials."
      );
    }
  }

  // This will use Application Default Credentials.
  // It works automatically in Google Cloud environments (like App Hosting).
  // For local development or other platforms, you might need to set up ADC.
  return admin.initializeApp();
}

interface NotificationPayload {
    title: string;
    body: string;
    link?: string;
    icon?: string;
}

export async function sendPushNotification(tokens: string[], payload: NotificationPayload) {
  try {
    if (!tokens || tokens.length === 0) {
      console.log("No FCM tokens provided. Skipping push notification.");
      return { success: true, message: "No tokens to send to." };
    }
  
    const app = getAdminApp();
    const messaging = app.messaging();

    const message = {
      notification: {
          title: payload.title,
          body: payload.body,
      },
      webpush: {
        notification: {
          icon: payload.icon || "https://firebasestorage.googleapis.com/v0/b/padel-hore.firebasestorage.app/o/logo-app-hore-padel.png?alt=media&token=2f2017a9-3908-4b53-9dc0-a19d6b63e0e6",
        },
        fcmOptions: {
          link: payload.link || process.env.NEXT_PUBLIC_BASE_URL || '/',
        },
      },
    };
    
    // @ts-ignore - MulticastMessage type is slightly different but compatible
    const response = await messaging.sendEachForMulticast({ tokens, ...message });
    
    console.log(`Successfully sent ${response.successCount} push notifications.`);
    const errorDetails: string[] = [];
    if (response.failureCount > 0) {
      console.error(`Failed to send ${response.failureCount} push notifications.`);
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errMsg = `Token ${idx}: ${resp.error?.message || 'Unknown error'}`;
          console.error(`- ${errMsg}`);
          errorDetails.push(errMsg);
        }
      });
    }
    return { 
      success: true, 
      successCount: response.successCount, 
      failureCount: response.failureCount,
      errors: errorDetails
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: (error as Error).message };
  }
}
