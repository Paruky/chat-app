function isNotificationApiSupported() {
    return "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
}

function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = `${value}${padding}`
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const output = new Uint8Array(rawData.length);

    for (let index = 0; index < rawData.length; index += 1) {
        output[index] = rawData.charCodeAt(index);
    }

    return output;
}

async function readPushConfig() {
    const response = await fetch("/api/push/public-key");

    if (!response.ok) {
        throw new Error("通知設定を読み込めませんでした");
    }

    return response.json();
}

async function getCurrentSubscription() {
    if (!isNotificationApiSupported()) return null;

    const registration = await navigator.serviceWorker.ready;

    return registration.pushManager.getSubscription();
}

function getPermissionState() {
    if (!("Notification" in window)) {
        return "unsupported";
    }

    return Notification.permission;
}

export function isNotificationSupported() {
    return isNotificationApiSupported();
}

export function setupForegroundNotificationVibration() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type !== "paruky:push-vibrate") return;

        navigator.vibrate?.(event.data.pattern || [80, 45, 80]);
    });
}

export async function getNotificationEndpoint() {
    const subscription = await getCurrentSubscription();

    return subscription?.endpoint || "";
}

export async function getNotificationStatus() {
    if (!isNotificationApiSupported()) {
        return {
            supported: false,
            configured: false,
            subscribed: false,
            permission: "unsupported"
        };
    }

    const [config, subscription] = await Promise.all([
        readPushConfig(),
        getCurrentSubscription()
    ]);

    return {
        supported: true,
        configured: config.enabled === true && Boolean(config.publicKey),
        subscribed: Boolean(subscription),
        permission: getPermissionState()
    };
}

export async function subscribeToNotifications(userId, accountName = "") {
    if (!userId) {
        throw new Error("ログイン後に通知をオンにできます");
    }

    if (!isNotificationApiSupported()) {
        throw new Error("このブラウザでは通知を使えません");
    }

    const config = await readPushConfig();

    if (!config.enabled || !config.publicKey) {
        throw new Error("サーバー側の通知キーが未設定です");
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
        throw new Error("ブラウザで通知が許可されませんでした");
    }

    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey)
    });

    const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            userId,
            accountName,
            subscription
        })
    });

    if (!response.ok) {
        throw new Error("通知の登録に失敗しました");
    }

    return subscription;
}

export async function unsubscribeFromNotifications() {
    const subscription = await getCurrentSubscription();

    if (!subscription) return;

    await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            subscription
        })
    }).catch((error) => {
        console.warn("push unsubscribe request failed", error);
    });

    await subscription.unsubscribe();
}
