// ============================================
// SERVICE WORKER PRINCIPAL - VERSION 2.1.0
// Gestion des notifications, cache, synchronisation
// ============================================

const CACHE_NAME = 'cs-parent-v2.1';
const API_CACHE = 'cs-api-v2.1';
const DYNAMIC_CACHE = 'cs-dynamic-v2.1';
const OFFLINE_CACHE = 'cs-offline-v2.1';

const STATIC_ASSETS = [
  '/',
  'index.html',
  'offline.html',
  'manifest.json',
  'icon-72x72.png',
  'icon-96x96.png',
  'icon-128x128.png',
  'icon-144x144.png',
  'icon-152x152.png',
  'icon-192x192.png',
  'icon-384x384.png',
  'icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// ============================================
// INSTALLATION
// ============================================
self.addEventListener('install', event => {
  console.log('✅ Service Worker: Installation v2.1.0');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Mise en cache des assets statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================
// ACTIVATION
// ============================================
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activation');
  
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME && key !== API_CACHE && key !== DYNAMIC_CACHE && key !== OFFLINE_CACHE)
            .map(key => {
              console.log('🗑️ Suppression ancien cache:', key);
              return caches.delete(key);
            })
        );
      }),
      self.clients.claim()
    ])
  );
});

// ============================================
// STRATÉGIE DE CACHE
// ============================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Page hors ligne
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('offline.html');
        })
    );
    return;
  }
  
  // Assets statiques
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }
  
  // API Firebase
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          return caches.open(API_CACHE).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return new Response(JSON.stringify({ offline: true, error: 'Mode hors ligne' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }
  
  // Stratégie par défaut
  event.respondWith(
    fetch(event.request)
      .then(response => {
        return caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => caches.match(event.request))
  );
});

// ============================================
// NOTIFICATIONS PUSH
// ============================================
const processedNotifications = new Map();

self.addEventListener('push', event => {
  console.log('📨 Push reçu:', event);
  
  let data = {};
  
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'CS la Colombe',
      body: event.data ? event.data.text() : 'Nouvelle notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { type: 'general' }
    };
  }
  
  // Vérifier les doublons
  const notifKey = `${data.data?.type || 'general'}_${data.data?.id || Date.now()}`;
  const lastSent = processedNotifications.get(notifKey);
  const fiveMinutes = 5 * 60 * 1000;
  
  if (lastSent && (Date.now() - lastSent) < fiveMinutes) {
    console.log('⏭️ Notification ignorée (doublon)');
    return;
  }
  
  processedNotifications.set(notifKey, Date.now());
  
  // Nettoyer les vieilles entrées
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [key, timestamp] of processedNotifications.entries()) {
    if (timestamp < oneHourAgo) {
      processedNotifications.delete(key);
    }
  }
  
  const options = {
    title: data.title || 'CS la Colombe',
    body: data.body || 'Nouvelle notification',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-72x72.png',
    image: data.image,
    vibrate: [200, 100, 200],
    data: { ...data.data, key: notifKey },
    actions: data.actions || [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ],
    tag: notifKey,
    renotify: false,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now()
  };
  
  // Personnaliser selon le type
  switch(data.data?.type) {
    case 'incident':
      options.title = `⚠️ ${options.title}`;
      options.actions = [
        { action: 'view', title: 'Voir l\'incident' },
        { action: 'close', title: 'Fermer' }
      ];
      break;
    case 'presence':
      options.title = `📅 ${options.title}`;
      break;
    case 'grade':
    case 'cote':
      options.title = `📊 ${options.title}`;
      options.actions = [
        { action: 'view', title: 'Voir les notes' },
        { action: 'close', title: 'Fermer' }
      ];
      break;
    case 'homework':
      options.title = `📚 ${options.title}`;
      options.actions = [
        { action: 'view', title: 'Voir le devoir' },
        { action: 'close', title: 'Fermer' }
      ];
      break;
    case 'payment':
      options.title = `💰 ${options.title}`;
      break;
    case 'communique':
      options.title = `📄 ${options.title}`;
      break;
    case 'timetable':
      options.title = `⏰ ${options.title}`;
      break;
  }
  
  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// ============================================
// CLIC SUR NOTIFICATION
// ============================================
self.addEventListener('notificationclick', event => {
  console.log('👆 Notification cliquée:', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();
  
  if (action === 'close') return;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes('index.html') && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'NAVIGATE',
              page: data.page || 'dashboard',
              data: data
            });
            return;
          }
        }
        return clients.openWindow(data.url || '/index.html');
      })
  );
});

// ============================================
// MESSAGES
// ============================================
self.addEventListener('message', event => {
  console.log('📨 Message reçu du client:', event.data);
  
  switch (event.data.type) {
    case 'SAVE_PARENT_DATA':
      saveParentData(event.data.data);
      break;
    case 'UPDATE_BADGE':
      updateBadgeCount(event.data.data.count);
      break;
    case 'SYNC_NOW':
      syncOfflineData();
      break;
    case 'ACTIVATE_NOW':
      self.skipWaiting();
      break;
    case 'PING':
      event.ports[0].postMessage({ type: 'PONG', timestamp: Date.now() });
      break;
  }
});

// ============================================
// SYNCHRONISATION
// ============================================
self.addEventListener('sync', event => {
  console.log('🔄 Synchronisation:', event.tag);
  
  if (event.tag === 'sync-notifications' || event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  console.log('🔄 Synchronisation des données hors ligne...');
  
  try {
    const db = await openDB();
    const offlineNotifications = await getOfflineNotifications(db);
    
    for (const notif of offlineNotifications) {
      await sendNotificationToServer(notif);
      await markNotificationAsSent(db, notif.id);
    }
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE' });
    });
    
    console.log('✅ Synchronisation terminée');
    
  } catch (error) {
    console.error('❌ Erreur synchronisation:', error);
    self.registration.sync.register('sync-offline-data');
  }
}

// ============================================
// BADGE
// ============================================
async function updateBadgeCount(change) {
  try {
    let count = await getBadgeCount();
    count = Math.max(0, count + change);
    await saveBadgeCount(count);
    
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    }
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'BADGE_UPDATED', count });
    });
    
  } catch (error) {
    console.error('❌ Erreur badge:', error);
  }
}

async function getBadgeCount() {
  try {
    const cache = await caches.open('badge-cache');
    const response = await cache.match('/badge-count');
    if (response) {
      const data = await response.json();
      return data.count || 0;
    }
  } catch (error) {
    console.error('❌ Erreur récupération badge:', error);
  }
  return 0;
}

async function saveBadgeCount(count) {
  try {
    const cache = await caches.open('badge-cache');
    const response = new Response(JSON.stringify({ count, timestamp: Date.now() }));
    await cache.put('/badge-count', response);
  } catch (error) {
    console.error('❌ Erreur sauvegarde badge:', error);
  }
}

// ============================================
// INDEXEDDB
// ============================================
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CSParentOfflineDB', 3);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('notifications')) {
        const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
        notifStore.createIndex('timestamp', 'timestamp');
        notifStore.createIndex('sent', 'sent');
      }
      
      if (!db.objectStoreNames.contains('actions')) {
        const actionStore = db.createObjectStore('actions', { keyPath: 'id' });
        actionStore.createIndex('timestamp', 'timestamp');
        actionStore.createIndex('status', 'status');
      }
      
      if (!db.objectStoreNames.contains('parent')) {
        db.createObjectStore('parent', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveParentData(data) {
  const db = await openDB();
  const tx = db.transaction('parent', 'readwrite');
  const store = tx.objectStore('parent');
  await store.put({ id: 'current', ...data, savedAt: Date.now() });
  console.log('💾 Données parent sauvegardées');
}

async function getOfflineNotifications(db) {
  const tx = db.transaction('notifications', 'readonly');
  const store = tx.objectStore('notifications');
  const index = store.index('sent');
  return await index.getAll(IDBKeyRange.only(false));
}

async function markNotificationAsSent(db, id) {
  const tx = db.transaction('notifications', 'readwrite');
  const store = tx.objectStore('notifications');
  const notif = await store.get(id);
  if (notif) {
    notif.sent = true;
    notif.sentAt = Date.now();
    await store.put(notif);
  }
}

async function sendNotificationToServer(notification) {
  // Implémenter l'envoi au serveur si nécessaire
  return Promise.resolve();
}

// ============================================
// NETTOYAGE PÉRIODIQUE
// ============================================
setInterval(async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('notifications', 'readwrite');
    const store = tx.objectStore('notifications');
    const index = store.index('timestamp');
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const oldNotifications = await index.getAll(IDBKeyRange.upperBound(thirtyDaysAgo));
    
    for (const notif of oldNotifications) {
      await store.delete(notif.id);
    }
    
    console.log('🧹 Nettoyage des vieilles données terminé');
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
  }
}, 24 * 60 * 60 * 1000);

// ============================================
// SYNC DES DONNÉES HORS LIGNE - AMÉLIORÉ
// ============================================

const SYNC_QUEUE_NAME = 'sync-queue';
const MAX_RETRY = 3;

class SyncQueue {
    constructor() {
        this.queue = [];
        this.loadQueue();
    }
    
    async loadQueue() {
        const cache = await caches.open('sync-queue-cache');
        const response = await cache.match('/sync-queue');
        if (response) {
            this.queue = await response.json();
        }
    }
    
    async saveQueue() {
        const cache = await caches.open('sync-queue-cache');
        const response = new Response(JSON.stringify(this.queue));
        await cache.put('/sync-queue', response);
    }
    
    add(item) {
        item.id = Date.now().toString() + '_' + Math.random().toString(36);
        item.retryCount = 0;
        item.timestamp = Date.now();
        this.queue.push(item);
        this.saveQueue();
        this.processQueue();
    }
    
    async processQueue() {
        if (this.processing) return;
        this.processing = true;
        
        try {
            const clients = await self.clients.matchAll();
            const isOnline = clients.some(client => client.navigator.onLine);
            
            if (!isOnline) {
                console.log('Hors ligne, synchronisation différée');
                this.processing = false;
                return;
            }
            
            const toProcess = [...this.queue];
            for (const item of toProcess) {
                try {
                    await this.processItem(item);
                    this.queue = this.queue.filter(i => i.id !== item.id);
                    await this.saveQueue();
                    console.log(`✅ Item ${item.id} synchronisé`);
                } catch (error) {
                    item.retryCount++;
                    if (item.retryCount >= MAX_RETRY) {
                        this.queue = this.queue.filter(i => i.id !== item.id);
                        await this.saveQueue();
                        console.log(`❌ Item ${item.id} abandonné après ${MAX_RETRY} tentatives`);
                    } else {
                        console.log(`⚠️ Échec item ${item.id}, retry ${item.retryCount}/${MAX_RETRY}`);
                    }
                }
            }
        } finally {
            this.processing = false;
        }
    }
    
    async processItem(item) {
        // Implémenter le traitement selon le type
        switch (item.type) {
            case 'grade_submission':
                await this.syncGradeSubmission(item);
                break;
            case 'payment_request':
                await this.syncPaymentRequest(item);
                break;
            case 'message':
                await this.syncMessage(item);
                break;
            default:
                console.warn('Type inconnu:', item.type);
        }
    }
    
    async syncGradeSubmission(item) {
        const response = await fetch('https://firestore.googleapis.com/v1/projects/theo1d/databases/(default)/documents/homework_submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
        });
        if (!response.ok) throw new Error('Sync failed');
    }
    
    async syncPaymentRequest(item) {
        const response = await fetch('https://firestore.googleapis.com/v1/projects/theo1d/databases/(default)/documents/payment_requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
        });
        if (!response.ok) throw new Error('Sync failed');
    }
    
    async syncMessage(item) {
        const response = await fetch('https://firestore.googleapis.com/v1/projects/theo1d/databases/(default)/documents/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
        });
        if (!response.ok) throw new Error('Sync failed');
    }
}

const syncQueue = new SyncQueue();

// Écouter les messages du client pour ajouter à la queue
self.addEventListener('message', event => {
    if (event.data.type === 'QUEUE_SYNC') {
        syncQueue.add(event.data.item);
        event.ports[0].postMessage({ status: 'queued', id: event.data.item.id });
    }
});

// Synchronisation périodique
setInterval(() => {
    syncQueue.processQueue();
}, 30000); // Toutes les 30 secondes

// Synchronisation au retour en ligne
self.addEventListener('online', () => {
    console.log('📶 Connexion rétablie - Synchronisation');
    syncQueue.processQueue();
});
