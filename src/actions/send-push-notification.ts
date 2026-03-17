
'use server';

import * as admin from 'firebase-admin';
import { Message } from 'firebase-admin/messaging';

// Helper to clean and parse JSON that might be badly escaped
function parseServiceAccount(key: string): any {
  if (!key) return null;
  
  let s = key.trim();
  
  // 1. Remove outer quotes if the entire string was quoted as a literal
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }

  // 2. Normalize some obvious issues
  if (s.includes('\\"')) {
    s = s.replace(/\\"/g, '"');
  }
  s = s.replace(/\\\\n/g, '\\n');

  // 3. Try standard parse
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (e) {
    // 4. NUCLEAR OPTION: Regex extraction
    // If JSON.parse fails, we extract what we need directly.
    console.log("AdminNotif: JSON.parse failed, attempting nuclear regex extraction");
    
    // Helper to extract a value based on a key
    const extract = (raw: string, field: string) => {
      // Look for "field": "value" or \"field\": \"value\"
      const regex = new RegExp(`[\\\\"]*${field}[\\\\"]*\\s*:\\s*[\\\\"]*([^\\\\"]+)[\\\\"]*`);
      const match = raw.match(regex);
      return match ? match[1] : null;
    };

    // Special regex for private_key since it's long and has newlines
    const extractPrivateKey = (raw: string) => {
        const match = raw.match(/[\\"]*private_key[\\"]*\s*:\s*[\\"]*([^"\\]+(?:\\n[^"\\]+)*)[\\"]*/);
        if (match) {
            // Unescape the literal \n strings back into real newlines for the cert
            return match[1].replace(/\\n/g, '\n');
        }
        return null;
    };

    const project_id = extract(s, 'project_id');
    const client_email = extract(s, 'client_email');
    const private_key = extractPrivateKey(s);

    if (project_id && private_key && client_email) {
      return {
        type: "service_account",
        project_id,
        private_key,
        client_email,
      };
    }
    
    throw new Error(`Nuclear extraction failed. JSON Error: ${(e as Error).message}`);
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
