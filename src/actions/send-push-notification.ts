
'use server';

import * as admin from 'firebase-admin';
import { Message } from 'firebase-admin/messaging';

// Helper to clean and parse JSON that might be badly escaped
function parseServiceAccount(key: string): any {
  if (!key) return null;
  
  let s = key.trim();
  
  // 1. Try to extract basic fields directly using regex (most resilient)
  // This bypasses JSON.parse bugs when the string is escaped by Vercel/pasted badly.
  const project_id_match = s.match(/[\\"]*project_id[\\"]*\s*:\s*[\\"]*([^\\",\s}]+)[\\"]*/);
  const client_email_match = s.match(/[\\"]*client_email[\\"]*\s*:\s*[\\"]*([^\\",\s}]+)[\\"]*/);
  const private_key_match = s.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);

  if (project_id_match && client_email_match && private_key_match) {
    const project_id = project_id_match[1];
    const client_email = client_email_match[1];
    let private_key = private_key_match[0];
    
    // Crucial: Pem keys from Vercel env often have escaped newlines.
    // We need to normalize \n or \\n into actual newlines.
    private_key = private_key
      .replace(/\\n/g, '\n')
      .replace(/\\+/g, '\\') // Fix accidental double+ backslashes
      .replace(/\\n/g, '\n'); // Second pass for double escaped
    
    return {
      type: "service_account",
      project_id,
      private_key,
      client_email,
    };
  }

  // 2. Fallback to standard cleaning + parsing
  try {
    const cleaned = s.replace(/\\"/g, '"').replace(/\\\\n/g, '\\n');
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
       if (parsed.private_key) {
         parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
       }
       return parsed;
    }
  } catch (e) {
    throw new Error(`Failed to extract credentials: ${(e as Error).message}`);
  }
}

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
      const parsed = parseServiceAccount(serviceAccountKey);

      if (parsed && parsed.project_id && parsed.private_key) {
        status.push(`Credentials valid for project: ${parsed.project_id}`);
        const app = admin.initializeApp({
          credential: admin.credential.cert(parsed),
          projectId: parsed.project_id
        });
        return { app, status: status.join('; ') };
      } else {
        status.push("JSON parsed but missing project_id or private_key");
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
