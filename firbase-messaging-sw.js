// ======================================================
// FIREBASE MESSAGING SERVICE WORKER - PRODUCTION READY
// ======================================================

importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// ==========================
// FIREBASE CONFIG
// ==========================

firebase.initializeApp({
  apiKey: "AIzaSyBn7VIddclO7KtrXb5sibCr9SjVLjOy-qI",
  authDomain: "theo1d.firebaseapp.com",
  projectId: "theo1d",
  storageBucket: "theo1d.firebasestorage.app",
  messagingSenderId: "269629842962",
  appId: "1:269629842962:web:a80a12b04448fe1e595acb"
});

const messaging = firebase.messaging();

// ======================================================
// CONFIGURATION GLOBALE
// ======================================================

const DUPLICATE_WINDOW = 5 * 60 * 1000; // 5 minutes
const recentNotifications = new Map();

// ======================================================
// ANTI-DOUBLON
// ======================================================

function isDuplicate(key) {
  const lastTime = recentNotifications.get(key);

  if (lastTime && (Date.now() - lastTime) < DUPLICATE_WINDOW) {
    return true;
  }

  recentNotifications.set(key, Date.now());
  return false;
}

// Nettoyage mémoire toutes les minutes
setInterval(() => {
  const limit = Date.now() - DUPLICATE_WINDOW;
  for (const [key, time] of recentNotifications.entries()) {
    if (time < limit) {
      recentNotifications.delete(key);
    }
  }
}, 60000);

// ======================================================
// BACKGROUND MESSAGE HANDLER
// ⚠️ UTILISER UNIQUEMENT DATA-ONLY PAYLOAD
// ======================================================

messaging.onBackgroundMessage(async (payload) => {

  console.log("📨 FCM Background reçu:", payload);

  const data = payload.data || {};

  const type = data.type || "general";
  const id = data.id || Date.now().toString();
  const notifKey = `${type}_${id}`;

  if (isDuplicate(notifKey)) {
    console.log("⏭️ Notification ignorée (doublon)");
    return;
  }

  const title = data.title || "CS La Colombe";
  const body = data.body || "Nouvelle notification";

  let options = {
    body: body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [200, 100, 200],
    tag: type,              // permet le regroupement Android
    renotify: true,
    requireInteraction: type === "incident", // incident reste affiché
    timestamp: Date.now(),
    data: data,
    actions: [
      { action: "open", title: "Ouvrir" },
      { action: "mark_read", title: "Marquer comme lu" }
    ]
  };

  // ==========================
  // PERSONNALISATION PAR TYPE
  // ==========================

  switch (type) {

    case "incident":
      options.vibrate = [300, 100, 300, 100, 300];
      break;

    case "grade":
    case "cote":
      options.icon = "/icons/badge-grade.png";
      break;

    case "homework":
      options.icon = "/icons/badge-homework.png";
      break;

    case "payment":
      options.icon = "/icons/badge-money.png";
      break;

    case "communique":
      options.icon = "/icons/badge-news.png";
      break;

    case "timetable":
      options.icon = "/icons/badge-clock.png";
      break;
  }

  await self.registration.showNotification(title, options);
});

// ======================================================
// CLICK SUR NOTIFICATION
// ======================================================

self.addEventListener("notificationclick", (event) => {

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  if (action === "mark_read") {
    // Possibilité d’envoyer un message à l’app
    return;
  }

  let url = "/index.html";

  if (data.page) {
    url += `#${data.page}`;
    if (data.childId) {
      url += `?child=${data.childId}`;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {

        for (const client of clientList) {
          if (client.url.includes("index.html") && "focus" in client) {
            client.focus();
            client.postMessage({
              type: "FCM_NAVIGATE",
              page: data.page,
              payload: data
            });
            return;
          }
        }

        return clients.openWindow(url);
      })
  );
});
