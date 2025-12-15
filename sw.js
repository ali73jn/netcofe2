const CACHE_NAME = 'netcofe-v1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/dashboard.css',
  '/js/dashboard.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/default_icon.png',
  '/icons/folder.png',
  '/icons/default_bg.jpg',
  '/manifest.webmanifest'
];

// نصب Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache باز شد');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// فعال‌سازی Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('حذف کش قدیمی:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// مدیریت درخواست‌ها
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // برای APIها و JSONها: Network First
  if (requestUrl.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // کش کردن پاسخ
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // برای فایل‌های استاتیک: Cache First
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // فقط اگر پاسخ معتبر است، کش می‌کنیم
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));
            
            return response;
          });
      })
  );
});

// پیام‌های بین Service Worker و صفحه
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});