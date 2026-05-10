self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // 今はとりあえず素通し（重要：壊さないため）
  event.respondWith(fetch(event.request));
});