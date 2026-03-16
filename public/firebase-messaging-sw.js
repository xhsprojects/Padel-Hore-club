// This file should be in the public directory

importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js");

// You'll need to replace this with your project's configuration
// Note: This is public-facing configuration
const firebaseConfig = {
  apiKey: "AIzaSyCQBTvIhHZjeLKYk_OE9pE9oxDrsW5hcf8",
  authDomain: "padel-hore.firebaseapp.com",
  projectId: "padel-hore",
  storageBucket: "padel-hore.firebasestorage.app",
  messagingSenderId: "577273193364",
  appId: "1:577273193364:web:3728d1b9f68ef250b3e581",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Optional: Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/icon-192x192.png' // default icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
