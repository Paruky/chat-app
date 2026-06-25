function parsePushData(event) {
    if (!event.data) {
        return {
            title: "Paruky Chat",
            body: "新しいメッセージがあります",
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            url: "/"
        };
    }

    try {
        return event.data.json();
    } catch (error) {
        return {
            title: "Paruky Chat",
            body: event.data.text(),
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            url: "/"
        };
    }
}

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    const data = parsePushData(event);
    const title = data.title || "Paruky Chat";
    const options = {
        body: data.body || "新しいメッセージがあります",
        icon: data.icon || "/icons/icon-192.png",
        badge: data.badge || "/icons/icon-192.png",
        tag: data.tag || "paruky-chat",
        renotify: true,
        data: {
            url: data.url || "/"
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

    event.waitUntil((async () => {
        const clientList = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        });

        for (const client of clientList) {
            if (client.url.startsWith(self.location.origin) && "focus" in client) {
                await client.focus();

                if ("navigate" in client) {
                    await client.navigate(targetUrl);
                }

                return;
            }
        }

        if (self.clients.openWindow) {
            await self.clients.openWindow(targetUrl);
        }
    })());
});
