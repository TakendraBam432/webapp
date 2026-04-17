/**
 * Service Worker for Push Notifications
 * Handles background push notifications with Web Push API
 * Version 4 - Enhanced background notification support
 */

const CACHE_NAME = 'app-cache-v4';
const SW_VERSION = '4.0.0';

// Install event - activate immediately for push support
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v' + SW_VERSION + '...');
  // Force activation immediately - critical for push notifications
  event.waitUntil(self.skipWaiting());
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v' + SW_VERSION + '...');
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
      // Take control of all pages immediately
      self.clients.claim()
    ])
  );
});

// Push event - CRITICAL for background notifications
// This event fires even when the browser is completely closed (on supported platforms)
self.addEventListener('push', (event) => {
  console.log('[SW v' + SW_VERSION + '] Push event received at:', new Date().toISOString());
  
  // Default notification data
  let notificationData = {
    title: 'TOPiN',
    body: 'You have a new notification',
    icon: '/pwa-192x192.png',
    badge: '/favicon.ico',
    tag: 'topin-' + Date.now(),
    url: '/'
  };
  
  // Parse push payload - try JSON first, then text
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Push payload:', JSON.stringify(payload));
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || notificationData.tag,
        url: payload.url || notificationData.url
      };
    } catch (e) {
      console.error('[SW] Error parsing push data as JSON:', e);
      // Try as text
      try {
        notificationData.body = event.data.text();
      } catch (textError) {
        console.error('[SW] Error getting text data:', textError);
      }
    }
  } else {
    console.log('[SW] Push event has no data');
  }
  
  // Notification options for maximum visibility
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: { url: notificationData.url },
    // Vibration pattern: vibrate, pause, vibrate
    vibrate: [200, 100, 200, 100, 200],
    // Keep notification visible until user interacts
    requireInteraction: true,
    // Always notify even if same tag exists
    renotify: true,
    // Show on lock screen (Android)
    silent: false,
    // Timestamp
    timestamp: Date.now(),
    // Action buttons
    actions: [
      { action: 'view', title: 'View', icon: '/favicon.ico' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  
  console.log('[SW] Showing notification:', notificationData.title);
  
  // CRITICAL: waitUntil ensures the service worker stays alive
  // until the notification is shown
  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
      .then(() => {
        console.log('[SW] Notification displayed successfully');
      })
      .catch((err) => {
        console.error('[SW] Error showing notification:', err);
      })
  );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked, action:', event.action);
  
  // Always close the notification
  event.notification.close();
  
  // Handle dismiss action
  if (event.action === 'dismiss') {
    console.log('[SW] User dismissed notification');
    return;
  }
  
  // Get the URL to open
  const urlToOpen = event.notification.data?.url || '/';
  console.log('[SW] Opening URL:', urlToOpen);
  
  // Focus or open the app
  event.waitUntil(
    self.clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        // If we have a window that can be focused
        if ('focus' in client) {
          return client.focus().then((focusedClient) => {
            // Navigate to the notification URL if different
            if (focusedClient && 'navigate' in focusedClient) {
              return focusedClient.navigate(urlToOpen);
            }
          });
        }
      }
      // No existing window - open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close event (when user dismisses via swipe/X)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed by user');
});

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Allow main thread to request showing a notification
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
  
  // Ping/pong for testing SW is alive
  if (event.data && event.data.type === 'PING') {
    event.ports?.[0]?.postMessage({ type: 'PONG', timestamp: Date.now() });
  }
});

// Push subscription change (when browser regenerates subscription)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  // The app should re-subscribe when it next loads
});

// Fetch event - minimal handling to ensure SW stays active
self.addEventListener('fetch', (event) => {
  // Only handle GET requests from same origin
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  
  // Skip API/Supabase calls - let them go to network
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('supabase') ||
      event.request.url.includes('/functions/')) {
    return;
  }
  
  // For other requests, use network-first strategy
  // This keeps the SW active and responsive
});

// Periodic background sync - keeps SW alive on some browsers
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync event:', event.tag);
});

// Background fetch - for large downloads
self.addEventListener('backgroundfetchsuccess', (event) => {
  console.log('[SW] Background fetch success');
});

console.log('[SW v' + SW_VERSION + '] Service worker script loaded at:', new Date().toISOString());
