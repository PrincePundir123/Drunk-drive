/* SecondLook service worker: network first, cache as offline fallback. */
var CACHE = 'secondlook-v6';
var ASSETS = [
  './', './index.html', './contact.html', './study.html', './manifest.webmanifest',
  './css/tokens.css', './css/style.css',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
  './assets/fonts/atkinson-hyperlegible-400.woff2', './assets/fonts/atkinson-hyperlegible-700.woff2', './assets/fonts/bricolage-grotesque-var.woff2',
  './js/storage.js', './js/words.js', './js/metrics.js', './js/share.js', './js/rides.js', './js/secure.js', './js/relay.js',
  './js/qr.js', './js/nightout.js', './js/icons.js', './js/sonar.js', './js/tests.js', './js/app.js', './js/contact.js', './js/study.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (r) { return r || (req.mode === 'navigate' && /contact\.html/.test(req.url) ? caches.match('./contact.html') : caches.match('./index.html')); });
      })
  );
});
