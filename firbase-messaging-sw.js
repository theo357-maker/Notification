Et voici le code de mon fichier firebase-messaging-sw.js : // ============================================
// FIREBASE MESSAGING SERVICE WORKER - V2.1
// ============================================

importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBn7VIddclO7KtrXb5sibCr9SjVLjOy-qI",
  authDomain: "theo1d.firebaseapp.com",
  projectId: "theo1d",
  storageBucket: "theo1d.firebasestorage.app",
  messagingSenderId: "269629842962",
  appId: "1:269629842962:web:a80a12b04448fe1e595acb",
  measurementId: "G-TNSG1XFMDZ"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ============================================
// GESTION DES DOUBLONS
// ============================================
const sentNotifications = new Map();

// Nettoyage toutes les heures
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [key, timestamp] of sentNotifications.entries()) {
    if (timestamp < oneHourAgo) {
      sentNotifications.delete(key);
    }
  }
}, 60 * 60 * 1000);

// ============================================
// NOTIFICATIONS EN ARRIÈRE-PLAN
// ============================================
messaging.onBackgroundMessage((payload) => {
  console.log('📨 [firebase-messaging-sw] Message:', payload);
  
  const data = payload.data || {};
  const notifKey = `${data.type || 'general'}_${data.id || Date.now()}`;
  
  // Vérifier les doublons (5 minutes)
  const lastSent = sentNotifications.get(notifKey);
  const fiveMinutes = 5 * 60 * 1000;
  
  if (lastSent && (Date.now() - lastSent) < fiveMinutes) {
    console.log('⏭️ Notification ignorée (déjà envoyée)');
    return;
  }
  
  sentNotifications.set(notifKey, Date.now());
  
  const notificationTitle = payload.notification?.title || 'CS la Colombe';
  let notificationOptions = {
    body: payload.notification?.body || 'Nouvelle notification',
    icon: payload.notification?.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    image: payload.notification?.image,
    vibrate: [200, 100, 200],
    data: { ...data, key: notifKey },
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ],
    tag: notifKey,
    renotify: false,
    requireInteraction: true,
    timestamp: Date.now()
  };
  
  // Personnalisation par type
  switch(data.type) {
    case 'incident':
      notificationOptions.title = `⚠️ ${notificationTitle}`;
      notificationOptions.actions = [
        { action: 'view', title: 'Voir l\'incident' },
        { action: 'close', title: 'Fermer' }
      ];
      break;
    case 'presence':
      notificationOptions.title = `📅 ${notificationTitle}`;
      break;
    case 'grade':
    case 'cote':
      notificationOptions.title = `📊 ${notificationTitle}`;
      notificationOptions.actions = [
        { action: 'view', title: 'Voir les notes' },
        { action: 'close', title: 'Fermer' }
      ];
      break;
    case 'homework':
      notificationOptions.title = `📚 ${notificationTitle}`;
      notificationOptions.actions = [
        { action: 'view', title: 'Voir le devoir' },
        { action: 'close', title: 'Fermer' }
      ];
      break;
    case 'payment':
      notificationOptions.title = `💰 ${notificationTitle}`;
      break;
    case 'communique':
      notificationOptions.title = `📄 ${notificationTitle}`;
      break;
    case 'timetable':
      notificationOptions.title = `⏰ ${notificationTitle}`;
      break;
  }
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ============================================
// CLIC SUR NOTIFICATION
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification cliquée:', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();
  
  if (action === 'close') return;
  
  let url = '/index.html';
  
  if (data.page) {
    url = `/index.html#${data.page}`;
    if (data.childId) {
      url += `?child=${data.childId}`;
    }
  } else if (data.url) {
    url = data.url;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('index.html') && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'FCM_NAVIGATE',
              page: data.page || 'dashboard',
              data: data
            });
            return;
          }
        }
        return clients.openWindow(url);
      })
  );
}); 
