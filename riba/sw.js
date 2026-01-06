// Service Worker for Ribar LOT PWA - Offline-First Caching
const CACHE_NAME = 'ribar-lot-v3.0.0-categories';
const DATA_CACHE_NAME = 'ribar-lot-data-v3.0';

// Files to cache for offline operation
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/js/app.js',
    '/js/db.js',
    '/js/gps.js',
    '/js/lot-generator.js',
    '/js/export.js',
    '/manifest.json',
    // Add icon files when available
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Install event');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Caching static files');
                return cache.addAll(FILES_TO_CACHE);
            })
            .catch((error) => {
                console.error('❌ Service Worker: Cache failed', error);
            })
    );
    
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activate event');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
                        console.log('🗑️ Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Claim all clients immediately
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Handle different types of requests
    if (request.method === 'GET') {
        // Static resources - cache first strategy
        if (FILES_TO_CACHE.some(file => url.pathname.endsWith(file) || url.pathname === file)) {
            event.respondWith(
                caches.match(request)
                    .then((response) => {
                        if (response) {
                            console.log('📋 Service Worker: Serving from cache', url.pathname);
                            return response;
                        }
                        
                        // Fetch from network and cache
                        return fetch(request)
                            .then((response) => {
                                if (response.status === 200) {
                                    const responseClone = response.clone();
                                    caches.open(CACHE_NAME)
                                        .then((cache) => {
                                            cache.put(request, responseClone);
                                        });
                                }
                                return response;
                            });
                    })
                    .catch((error) => {
                        console.error('❌ Service Worker: Fetch failed', error);
                        // Return offline fallback if available
                        return caches.match('/index.html');
                    })
            );
        }
        
        // GPS/Location APIs - network first for fresh data
        else if (url.pathname.includes('geolocation') || url.hostname.includes('maps')) {
            event.respondWith(
                fetch(request)
                    .then((response) => {
                        // Cache successful location responses briefly
                        if (response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(DATA_CACHE_NAME)
                                .then((cache) => {
                                    cache.put(request, responseClone);
                                });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Fallback to cached location data if available
                        return caches.match(request);
                    })
            );
        }
        
        // External resources (fonts, CDNs) - cache first with network fallback
        else if (!url.origin.includes(self.location.origin)) {
            event.respondWith(
                caches.match(request)
                    .then((response) => {
                        return response || fetch(request)
                            .then((response) => {
                                if (response.status === 200) {
                                    const responseClone = response.clone();
                                    caches.open(CACHE_NAME)
                                        .then((cache) => {
                                            cache.put(request, responseClone);
                                        });
                                }
                                return response;
                            });
                    })
                    .catch(() => {
                        console.warn('⚠️ Service Worker: External resource unavailable', url.href);
                        // Return empty response for missing external resources
                        return new Response('', { status: 404 });
                    })
            );
        }
    }
});

// Background sync for data upload when connection is restored
self.addEventListener('sync', (event) => {
    console.log('🔄 Service Worker: Background sync triggered', event.tag);
    
    if (event.tag === 'lot-data-sync') {
        event.waitUntil(
            syncLOTData()
        );
    }
});

// Push notifications for regulatory updates
self.addEventListener('push', (event) => {
    console.log('📨 Service Worker: Push received', event);
    
    let notificationData = {
        title: 'Ribar LOT',
        body: 'Nova obavijest dostupna',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: 'ribar-lot-notification',
        data: { url: '/' }
    };
    
    if (event.data) {
        try {
            const payload = event.data.json();
            notificationData = { ...notificationData, ...payload };
        } catch (e) {
            console.warn('⚠️ Service Worker: Invalid push payload');
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(notificationData.title, notificationData)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Service Worker: Notification clicked', event);
    
    event.notification.close();
    
    const targetUrl = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then((clientList) => {
                // Check if app is already open
                for (const client of clientList) {
                    if (client.url.includes(targetUrl) && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Open new window if app is not open
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
    );
});

// Handle message from main thread
self.addEventListener('message', (event) => {
    console.log('💬 Service Worker: Message received', event.data);
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'SKIP_WAITING':
                self.skipWaiting();
                break;
                
            case 'GET_VERSION':
                event.ports[0].postMessage({ version: CACHE_NAME });
                break;
                
            case 'CACHE_LOT_DATA':
                // Cache LOT data for offline access
                event.waitUntil(
                    caches.open(DATA_CACHE_NAME)
                        .then((cache) => {
                            const response = new Response(JSON.stringify(event.data.lotData), {
                                headers: { 'Content-Type': 'application/json' }
                            });
                            return cache.put(`/lot/${event.data.lotId}`, response);
                        })
                );
                break;
                
            default:
                console.warn('⚠️ Service Worker: Unknown message type', event.data.type);
        }
    }
});

// Sync LOT data when connection is restored
async function syncLOTData() {
    try {
        console.log('🔄 Service Worker: Starting LOT data sync');
        
        // Open IndexedDB to get pending LOT records
        const db = await openDatabase();
        const transaction = db.transaction(['lots'], 'readonly');
        const store = transaction.objectStore('lots');
        const pendingLOTs = await getAllPendingLOTs(store);
        
        console.log(`📤 Service Worker: Found ${pendingLOTs.length} pending LOT records`);
        
        // Process each pending LOT
        for (const lot of pendingLOTs) {
            try {
                // Simulate API upload (replace with actual endpoint)
                const response = await fetch('/api/lots', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(lot)
                });
                
                if (response.ok) {
                    // Mark as synced in local database
                    await markLOTAsSynced(lot.lot_id);
                    console.log(`✅ Service Worker: LOT ${lot.lot_id} synced successfully`);
                } else {
                    console.warn(`⚠️ Service Worker: Failed to sync LOT ${lot.lot_id}`, response.status);
                }
            } catch (error) {
                console.error(`❌ Service Worker: Error syncing LOT ${lot.lot_id}`, error);
            }
        }
        
        return Promise.resolve();
    } catch (error) {
        console.error('❌ Service Worker: Sync process failed', error);
        return Promise.reject(error);
    }
}

// Helper function to open IndexedDB
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('FishermanLOT', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Helper function to get pending LOTs
function getAllPendingLOTs(store) {
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const lots = request.result.filter(lot => 
                lot.metadata?.export_status === 'pending'
            );
            resolve(lots);
        };
        request.onerror = () => reject(request.error);
    });
}

// Helper function to mark LOT as synced
async function markLOTAsSynced(lotId) {
    try {
        const db = await openDatabase();
        const transaction = db.transaction(['lots'], 'readwrite');
        const store = transaction.objectStore('lots');
        
        const lot = await new Promise((resolve, reject) => {
            const request = store.get(lotId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        if (lot) {
            lot.metadata.export_status = 'synced';
            lot.metadata.sync_timestamp = new Date().toISOString();
            
            await new Promise((resolve, reject) => {
                const request = store.put(lot);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    } catch (error) {
        console.error('❌ Service Worker: Failed to mark LOT as synced', error);
    }
}

// Periodic cleanup of old cached data
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'cleanup-old-data') {
        event.waitUntil(
            cleanupOldData()
        );
    }
});

async function cleanupOldData() {
    try {
        const db = await openDatabase();
        const transaction = db.transaction(['lots'], 'readwrite');
        const store = transaction.objectStore('lots');
        
        // Delete LOT records older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const request = store.index('date').openCursor(IDBKeyRange.upperBound(thirtyDaysAgo.toISOString().split('T')[0]));
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                // Only delete if already synced
                if (cursor.value.metadata?.export_status === 'synced') {
                    cursor.delete();
                    console.log(`🗑️ Service Worker: Cleaned up old LOT ${cursor.value.lot_id}`);
                }
                cursor.continue();
            }
        };
        
        // Cleanup old caches
        const dataCache = await caches.open(DATA_CACHE_NAME);
        const requests = await dataCache.keys();
        
        for (const request of requests) {
            const response = await dataCache.match(request);
            if (response) {
                const date = response.headers.get('date');
                if (date && new Date(date) < thirtyDaysAgo) {
                    await dataCache.delete(request);
                    console.log(`🗑️ Service Worker: Cleaned up old cache entry ${request.url}`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Service Worker: Cleanup failed', error);
    }
}
