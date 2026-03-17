
'use server';

import * as admin from 'firebase-admin';
import { Message } from 'firebase-admin/messaging';

// Helper to initialize the admin app safely and return status
function getAdminAppWithStatus() {
  const status: string[] = [];
  
  if (admin.apps.length > 0) {
    status.push(`App already initialized (${admin.apps.length} apps)`);
    return { app: admin.apps[0] as admin.app.App, status: status.join('; ') };
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    status.push(`Key found (len: ${serviceAccountKey.length})`);
    try {
      let parsed = JSON.parse(serviceAccountKey);
      if (typeof parsed === 'string') {
        status.push("Double-encoded string detected, parsing again");
        parsed = JSON.parse(parsed);
      }

      if (parsed.project_id && parsed.private_key) {
        status.push(`Credentials valid for: ${parsed.project_id}`);
        const app = admin.initializeApp({
          credential: admin.credential.cert(parsed),
          projectId: parsed.project_id
        });
        return { app, status: status.join('; ') };
      } else {
        status.push("JSON missing project_id or private_key");
      }
    } catch (e) {
      status.push(`Parse error: ${(e as Error).message}`);
    }
  } else {
    status.push("FIREBASE_SERVICE_ACCOUNT_KEY not found in process.env");
  }

  status.push("Falling back to ADC");
  return { app: admin.initializeApp(), status: status.join('; ') };
}

interface NotificationPayload {
    title: string;
    body: string;
    link?: string;
    icon?: string;
}

export async function sendPushNotification(tokens: string[], payload: NotificationPayload) {
  let initStatus = "unknown";
  try {
    if (!tokens || tokens.length === 0) {
        return { success: true, message: "No tokens to send to." };
    }
  
    const { app, status } = getAdminAppWithStatus();
    initStatus = status;
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
    
    // @ts-ignore
    const response = await messaging.sendEachForMulticast({ tokens, ...message });
    
    const errorDetails: string[] = [];
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errMsg = `Token ${idx}: ${resp.error?.message || 'Unknown error'}`;
          errorDetails.push(errMsg);
        }
      });
    }
    return { 
      success: true, 
      successCount: response.successCount, 
      failureCount: response.failureCount,
      errors: errorDetails,
      initStatus 
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { 
        success: false, 
        error: (error as Error).message,
        initStatus 
    };
  }
}
