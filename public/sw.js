const CACHE_NAME = 'j-voca-v5';

const PRECACHE_URLS = [
  '/j-voca/',
  '/j-voca/index.html',
  '/j-voca/data/words.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('googleapis.com')) return;
  if (event.request.url.includes('raw.githubusercontent.com')) return;
  if (event.request.url.includes('api.github.com')) return;
  if (event.request.url.includes('version.json')) return;

  const url = new URL(event.request.url);
  const isAsset = /\.[a-f0-9]{8,}\.(js|css)$/.test(url.pathname);
  // 사전 생성된 VOICEVOX Nemo wav 파일 — 해시 파일명이라 불변, cache-first가 안전
  const isAudio = url.pathname.includes('/audio/') && url.pathname.endsWith('.wav');

  if (isAsset || isAudio) {
    // Vite hashed assets: immutable, cache-first is safe
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  // HTML and other resources: network-first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
