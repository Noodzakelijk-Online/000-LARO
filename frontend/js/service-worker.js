// Service Worker for Legal AI Reach Out Platform
// This implements offline functionality and improved caching

const CACHE_NAME = 'legal-ai-cache-v1';
const OFFLINE_URL = '/offline.html';

// Resources to cache immediately on service worker install
const PRECACHE_RESOURCES = [
  '/',
  '/final_prototype.html',
  '/css/dark-theme.css',
  '/css/responsive.css',
  '/js/form-validation.js',
  '/js/performance-optimizations.js',
  '/js/security-enhancements.js',
  OFFLINE_URL,
  'https://i.ibb.co/Qj1Vz7W/home-dark-mode.jpg'
];

// Install event - precache critical resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service worker pre-caching resources');
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .then(() => {
        // Force waiting service worker to become active
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('Service worker deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Ensure the service worker takes control of all clients
      return self.clients.claim();
    })
  );
});

// Fetch event - implement cache-first strategy with network fallback
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.startsWith('https://i.ibb.co') &&
      !event.request.url.startsWith('https://danolbza.manus.space')) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For HTML pages, use network-first strategy
  if (event.request.headers.get('Accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the latest version of the page
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache, serve offline page
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // For other resources, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Resource found in cache
          return cachedResponse;
        }

        // Resource not in cache, fetch from network
        return fetch(event.request)
          .then(response => {
            // Cache the fetched resource if it's a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseClone);
              });

            return response;
          })
          .catch(error => {
            // For image requests, return a placeholder if offline
            if (event.request.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
              return caches.match('/images/placeholder.svg');
            }
            
            // For API requests, return empty JSON with offline flag
            if (event.request.url.includes('/api/')) {
              return new Response(JSON.stringify({
                offline: true,
                message: 'You are currently offline. Please try again when you have an internet connection.'
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            throw error;
          });
      })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', event => {
  if (event.tag === 'form-submission') {
    event.waitUntil(syncFormData());
  }
});

// Function to sync stored form data when online
async function syncFormData() {
  try {
    // Get all stored form submissions
    const formDataKeys = await localforage.keys();
    const formSubmissionKeys = formDataKeys.filter(key => key.startsWith('form_submission_'));
    
    // Process each stored submission
    for (const key of formSubmissionKeys) {
      const formData = await localforage.getItem(key);
      
      // Attempt to submit the form data
      const response = await fetch('/api/submit-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        // If successful, remove from storage
        await localforage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Error syncing form data:', error);
  }
}

// Push notification handling
self.addEventListener('push', event => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New notification from Legal AI Reach Out',
      icon: '/images/logo.png',
      badge: '/images/badge.png',
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Legal AI Reach Out',
        options
      )
    );
  } catch (error) {
    console.error('Error showing notification:', error);
  }
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(clientList => {
        const url = event.notification.data.url;
        
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
