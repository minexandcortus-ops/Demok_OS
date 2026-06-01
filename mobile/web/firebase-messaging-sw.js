importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBC0qnVseVVN6oVGH3-rKXiOgurM35UrPo",
  authDomain: "demok-ba1a1.firebaseapp.com",
  projectId: "demok-ba1a1",
  storageBucket: "demok-ba1a1.firebasestorage.app",
  messagingSenderId: "1087284539439",
  appId: "1:1087284539439:web:c17a0fa44044152258d6da"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);
  
  // Set badge if supported
  if (navigator.setAppBadge) {
    navigator.setAppBadge(1).catch((error) => {
      console.error("Error setting app badge:", error);
    });
  }

  // We do NOT call self.registration.showNotification here because 
  // Firebase's default service worker handles it automatically when 
  // the 'notification' payload is present. Calling it here causes 
  // a double notification.
});
