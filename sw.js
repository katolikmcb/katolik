/* Katolik Mobile — service worker (offline + atualizações) */
var CACHE = 'katolik-share-icone-logo-8b4e02f7';

/* Teto de espera para navegação: em rede ruim, serve o cache em vez de
   deixar o usuário esperando o fetch desistir (~30s). */
var NAV_TIMEOUT_MS = 3000;

var PRECACHE = [
  './',
  './index.html',
  './diagnostico.html',
  './favicon.ico',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './back-icon.35ba0eaec5a4f5ed12ca16fabeae451d.png',
  './back-icon-mask.0a328cd9c1afd0afe8e3b1ec5165b1b4.png',
  './clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55.png',
  './clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@2x.png',
  './clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@3x.png',
  './clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@4x.png',
  './close-icon.808e1b1b9b53114ec2838071a7e6daa7.png',
  './close-icon.808e1b1b9b53114ec2838071a7e6daa7@2x.png',
  './close-icon.808e1b1b9b53114ec2838071a7e6daa7@3x.png',
  './close-icon.808e1b1b9b53114ec2838071a7e6daa7@4x.png',
  './search-icon.286d67d3f74808a60a78d3ebf1a5fb57.png',
  './logopng-dourado.png',
  './Ionicons.67e546cd.ttf',
  './AppEntry-65b4699a5be43d86cf12f9b9937da581.js'
];

function cachePut(req, res) {
  var copy = res.clone();
  return caches.open(CACHE).then(function (c) {
    return c.put(req, copy);
  });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('Katolik SW: tempo esgotado (' + ms + 'ms)'));
      }, ms);
    })
  ]);
}

self.addEventListener('install', function (event) {
  // skipWaiting só depois do precache completo: um install parcial não
  // deve assumir o controle das páginas.
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return Promise.all(
          PRECACHE.map(function (url) {
            return cache.add(url).catch(function (err) {
              console.warn('Katolik SW: não precachei ' + url, err);
            });
          })
        );
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // páginas: rede primeiro (para atualizar), senão cache — com teto de espera
    event.respondWith(
      withTimeout(fetch(req), NAV_TIMEOUT_MS)
        .then(function (res) {
          if (res.status === 200) event.waitUntil(cachePut(req, res));
          return res;
        })
        .catch(function () {
          return caches.open(CACHE).then(function (c) {
            return c.match(req).then(function (hit) {
              return hit || c.match('./index.html');
            });
          });
        })
    );
    return;
  }

  // assets (bundle, fontes, imagens): cache primeiro
  event.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res.status === 200) event.waitUntil(cachePut(req, res));
          return res;
        });
      });
    })
  );
});
