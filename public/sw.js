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

self.addEventListener("push", function(event) {
    const data = event.data ? event.data.json() : {};

    const title = data.title || "Paruky Chat";
    const options = {
        body: data.body || "新しいメッセージ",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png"
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener("notificationclick", function(event) {
    event.notification.close();

    event.waitUntil(
        clients.openWindow("/")
    );
});