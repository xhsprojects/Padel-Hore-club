// This file should be in the public directory

importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js");

// You'll need to replace this with your project's configuration
// Note: This is public-facing configuration
const firebaseConfig = {
  apiKey: "AIzaSyByFhX0BfmWoywtJIkPvMEFOEebpf6Ip78",
  authDomain: "studio-9868070855-4e715.firebaseapp.com",
  projectId: "studio-9868070855-4e715",
  storageBucket: "studio-9868070855-4e715.appspot.com",
  messagingSenderId: "930516068429",
  appId: "1:930516068429:web:7e35affd7c40ba98809404",
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
