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

function isSameOriginClient(client) {
    try {
        return new URL(client.url).origin === self.location.origin;
    } catch (error) {
        return false;
    }
}

function isVisibleClient(client) {
    return client.focused || client.visibilityState === "visible";
}

function normalizeRoute(value) {
    try {
        const url = new URL(value || "/", self.location.origin);
        const hash = decodeURIComponent(url.hash || "");

        if (hash.startsWith("#/dm/")) {
            return `dm:${hash.slice("#/dm/".length).toLowerCase()}`;
        }

        if (hash.startsWith("#/rooms/")) {
            return `room:${hash.slice("#/rooms/".length)}`;
        }

        return `${url.pathname}${hash}`;
    } catch (error) {
        return "/";
    }
}

function isClientAtTarget(client, data) {
    const targetRoute = normalizeRoute(data.url || "/");

    if (!targetRoute || targetRoute === "/") return false;

    return normalizeRoute(client.url) === targetRoute;
}

function requestClientVibration(clients) {
    clients.forEach((client) => {
        client.postMessage({
            type: "paruky:push-vibrate",
            pattern: [80, 45, 80]
        });
    });
}

async function closeNotificationsByTag(tag) {
    if (!tag || !self.registration.getNotifications) return;

    try {
        const notifications = await self.registration.getNotifications({ tag });
        notifications.forEach((notification) => notification.close());
    } catch (error) {
        console.warn("close notifications failed", error);
    }
}

async function shouldShowNotification(data) {
    const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
    });
    const visibleClients = clientList
        .filter(isSameOriginClient)
        .filter(isVisibleClient);

    if (visibleClients.length === 0) return true;
    if (visibleClients.some((client) => isClientAtTarget(client, data))) return false;

    requestClientVibration(visibleClients);
    return false;
}

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    const data = parsePushData(event);

    event.waitUntil((async () => {
        if (!(await shouldShowNotification(data))) return;

        const title = data.title || "Paruky Chat";
        const options = {
            body: data.body || "新しいメッセージがあります",
            icon: data.icon || "/icons/icon-192.png",
            badge: data.badge || "/icons/icon-192.png",
            tag: data.tag || "paruky-chat",
            renotify: true,
            data: {
                room: data.room || "",
                url: data.url || "/"
            }
        };

        await self.registration.showNotification(title, options);
    })());
});

self.addEventListener("message", (event) => {
    if (event.data?.type !== "paruky:close-notifications") return;

    const closeTask = closeNotificationsByTag(event.data.tag);
    event.waitUntil?.(closeTask);
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

    event.waitUntil((async () => {
        await closeNotificationsByTag(event.notification.tag);

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
