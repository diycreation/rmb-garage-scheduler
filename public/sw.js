const CACHE = 'rmb-garage-v1';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(['/','/index.html','/styles.css','/app.js','/manifest.webmanifest','/icon.svg']))));
self.addEventListener('fetch', event => { if (event.request.method === 'GET') event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))); });
