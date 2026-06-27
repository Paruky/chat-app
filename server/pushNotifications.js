const webPush = require("web-push");

function isPushConfigured(config) {
    return Boolean(config.vapidPublicKey && config.vapidPrivateKey);
}

function safeText(value, fallback = "") {
    return String(value || fallback).replace(/\s+/g, " ").trim();
}

function truncate(value, maxLength) {
    const text = safeText(value);

    if (text.length <= maxLength) return text;

    return `${text.slice(0, maxLength)}...`;
}

function parseMessagePayload(message) {
    try {
        return JSON.parse(String(message || ""));
    } catch (error) {
        return {
            type: "text",
            text: String(message || "")
        };
    }
}

function getAccountKey(value) {
    return String(value || "")
        .trim()
        .replace(/^@+/, "")
        .replace(/\s+/g, "")
        .toLowerCase();
}

function accountKeysMatch(left, right) {
    const leftKey = getAccountKey(left);
    const rightKey = getAccountKey(right);

    return Boolean(leftKey && rightKey) &&
        (leftKey === rightKey || leftKey.startsWith(rightKey) || rightKey.startsWith(leftKey));
}

function isDmRoom(room) {
    return String(room || "").startsWith("dm:");
}

function parseDmRoom(room) {
    if (!isDmRoom(room)) return [];

    const parts = String(room)
        .slice(3)
        .split(":")
        .map(getAccountKey)
        .filter(Boolean);

    return parts.length >= 3 ? parts.slice(1, 3) : parts;
}

function getDmPeerForAccount(room, accountName) {
    const accountKey = getAccountKey(accountName);
    const users = parseDmRoom(room);

    if (!accountKey || users.length !== 2) return "";

    return users.find((user) => !accountKeysMatch(user, accountKey)) || "";
}

function getMessagePreview(message) {
    const payload = parseMessagePayload(message.message);

    if (payload.type === "paruky:image:v1") {
        return "写真を送信しました";
    }

    if (payload.type === "paruky:reply:v1" && payload.text) {
        return truncate(payload.text, 120);
    }

    return truncate(payload.text || message.message, 120);
}

function createNotificationTitle(message) {
    return safeText(message.name, "ユーザー");
}

function createConversationLabel(message, accountName) {
    if (!isDmRoom(message.room)) {
        return safeText(message.room, "Paruky Chat");
    }

    const peer = safeText(message.name || getDmPeerForAccount(message.room, accountName));

    return peer ? `DM @${peer.replace(/^@+/, "")}` : "DM";
}

function createNotificationUrl(room, accountName) {
    if (String(room || "").startsWith("dm:")) {
        const peer = getDmPeerForAccount(room, accountName);

        return peer ? `/#/dm/${encodeURIComponent(peer)}` : "/#/dms";
    }

    return `/#/rooms/${encodeURIComponent(room || "")}`;
}

function shouldDeleteSubscription(error) {
    return error?.statusCode === 404 || error?.statusCode === 410;
}

function canNotifySubscription(record, message) {
    if (record.userId === String(message.userId || "")) return false;
    if (!isDmRoom(message.room)) return true;

    const recipients = parseDmRoom(message.room);

    return recipients.some((accountName) => accountKeysMatch(accountName, record.accountName));
}

function createNotificationPayload(message, record) {
    return JSON.stringify({
        title: createNotificationTitle(message),
        body: [
            createConversationLabel(message, record.accountName),
            getMessagePreview(message)
        ].filter(Boolean).join("\n"),
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `room:${message.room}`,
        room: message.room || "",
        url: createNotificationUrl(message.room, record.accountName)
    });
}

function createPushNotificationService(config, subscriptionsRepository, options = {}) {
    const enabled = isPushConfigured(config);
    const isRecipientActive = options.isRecipientActive || (() => false);

    if (enabled) {
        webPush.setVapidDetails(
            config.vapidSubject,
            config.vapidPublicKey,
            config.vapidPrivateKey
        );
    }

    async function notifyMessage(message) {
        if (!enabled) return;

        const subscriptions = await subscriptionsRepository.listSubscriptions();
        await Promise.all(subscriptions
            .filter((record) => canNotifySubscription(record, message))
            .filter((record) => !isRecipientActive(record, message))
            .map(async (record) => {
                try {
                    await webPush.sendNotification(
                        record.subscription,
                        createNotificationPayload(message, record)
                    );
                } catch (error) {
                    console.warn("[push-notification]", error.message);

                    if (shouldDeleteSubscription(error)) {
                        await subscriptionsRepository.deleteSubscription(record.endpoint);
                    }
                }
            }));
    }

    async function saveSubscription({ userId, accountName, subscription }) {
        if (!enabled) {
            return {
                ok: false,
                reason: "push-not-configured"
            };
        }

        await subscriptionsRepository.saveSubscription({
            userId,
            accountName,
            subscription
        });

        return {
            ok: true
        };
    }

    async function deleteSubscription(subscription) {
        await subscriptionsRepository.deleteSubscription(subscription?.endpoint);
    }

    return {
        enabled,
        publicKey: enabled ? config.vapidPublicKey : "",
        saveSubscription,
        deleteSubscription,
        notifyMessage
    };
}

function registerPushRoutes(app, pushNotifications) {
    app.get("/api/push/public-key", (request, response) => {
        response.json({
            enabled: pushNotifications.enabled,
            publicKey: pushNotifications.publicKey
        });
    });

    app.post("/api/push/subscribe", async (request, response) => {
        const { userId, accountName, subscription } = request.body || {};

        if (!userId || !subscription?.endpoint) {
            response.status(400).json({
                ok: false,
                message: "invalid subscription"
            });
            return;
        }

        try {
            const result = await pushNotifications.saveSubscription({
                userId,
                accountName,
                subscription
            });
            response.status(result.ok ? 200 : 503).json(result);
        } catch (error) {
            console.error("[push-subscribe]", error);
            response.status(500).json({
                ok: false
            });
        }
    });

    app.post("/api/push/unsubscribe", async (request, response) => {
        try {
            await pushNotifications.deleteSubscription(request.body?.subscription);
            response.json({
                ok: true
            });
        } catch (error) {
            console.error("[push-unsubscribe]", error);
            response.status(500).json({
                ok: false
            });
        }
    });
}

module.exports = {
    createPushNotificationService,
    registerPushRoutes
};
