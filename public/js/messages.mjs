import { elements } from "./dom.mjs";
import { formatMessageTime } from "./formatters.mjs";
import { parseMessagePayload } from "./messagePayloads.mjs";

const BOTTOM_THRESHOLD = 120;
const LONG_PRESS_DELAY = 520;
const LONG_PRESS_MOVE_LIMIT = 12;

export function isNearBottom() {
    return (
        elements.messages.scrollHeight -
        elements.messages.scrollTop -
        elements.messages.clientHeight
    ) < BOTTOM_THRESHOLD;
}

export function scrollMessagesToBottom() {
    requestAnimationFrame(() => {
        elements.messages.scrollTop = elements.messages.scrollHeight;
    });
}

export function showNewMessageButton(count) {
    elements.newMessageButton.textContent = `↓ 新着メッセージ (${count})`;
    elements.newMessageButton.classList.add("show");
}

export function hideNewMessageButton() {
    elements.newMessageButton.textContent = "↓ 新着メッセージ";
    elements.newMessageButton.classList.remove("show");
}

function enableMessageActions(item, data, onOpenMessageActions) {
    let longPressTimer = null;
    let startX = 0;
    let startY = 0;

    function clearLongPress() {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }

    item.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        onOpenMessageActions({
            message: item.messageData,
            source: "contextmenu",
            anchor: {
                x: event.clientX,
                y: event.clientY
            }
        });
    });

    item.addEventListener("selectstart", (event) => {
        event.preventDefault();
    });

    item.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse") return;

        startX = event.clientX;
        startY = event.clientY;
        clearLongPress();

        longPressTimer = setTimeout(() => {
            onOpenMessageActions({
                message: item.messageData,
                source: "longpress",
                anchor: {
                    x: startX,
                    y: startY
                }
            });
        }, LONG_PRESS_DELAY);
    });

    item.addEventListener("pointermove", (event) => {
        const moved =
            Math.abs(event.clientX - startX) > LONG_PRESS_MOVE_LIMIT ||
            Math.abs(event.clientY - startY) > LONG_PRESS_MOVE_LIMIT;

        if (moved) {
            clearLongPress();
        }
    });

    item.addEventListener("pointerup", clearLongPress);
    item.addEventListener("pointercancel", clearLongPress);
    item.addEventListener("pointerleave", clearLongPress);
}

function createMessageBody(data) {
    const payload = parseMessagePayload(data.message);
    const body = document.createElement("div");
    body.className = "message-body";

    if (payload.type === "image") {
        const figure = document.createElement("figure");
        figure.className = "message-image-wrap";

        const image = document.createElement("img");
        image.className = "message-image";
        image.src = payload.dataUrl;
        image.alt = payload.name || "送信された写真";
        image.loading = "lazy";

        figure.appendChild(image);
        body.appendChild(figure);
        return body;
    }

    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = payload.text;
    body.appendChild(text);

    return body;
}

function createMessageElement(data, options) {
    const { currentUserId, onOpenMessageActions } = options;
    const item = document.createElement("div");
    item.className = "message";
    item.messageData = data;
    const payload = parseMessagePayload(data.message);

    if (data.id) {
        item.dataset.messageId = data.id;
    }

    if (data.userId && data.userId === currentUserId) {
        item.classList.add("my-message");

        if (onOpenMessageActions && payload.type === "text") {
            enableMessageActions(item, data, onOpenMessageActions);
        }
    }

    const header = document.createElement("div");
    header.className = "message-header";

    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.alt = "";
    avatar.referrerPolicy = "no-referrer";

    if (data.avatar_url) {
        avatar.src = data.avatar_url;
    }

    const content = document.createElement("div");
    content.className = "message-content";

    const top = document.createElement("div");
    top.className = "message-top";

    const name = document.createElement("strong");
    name.textContent = data.name || "ユーザー";

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = formatMessageTime(data.created_at);

    top.append(name, time);
    content.append(top, createMessageBody(data));
    header.append(avatar, content);
    item.appendChild(header);

    return item;
}

export function updateMessage(data) {
    if (!data?.id) return;

    const item = [...elements.messages.querySelectorAll(".message")]
        .find((message) => message.dataset.messageId === String(data.id));
    const body = item?.querySelector(".message-body");

    if (body) {
        item.messageData = {
            ...item.messageData,
            ...data
        };
        body.replaceWith(createMessageBody(item.messageData));
    }
}

export function appendMessage(data, options) {
    const {
        currentUserId,
        shouldAutoScroll,
        trackUnread = true,
        onUnread,
        onOpenMessageActions
    } = options;

    if (!data) return;

    elements.messages.appendChild(createMessageElement(data, {
        currentUserId,
        onOpenMessageActions
    }));

    if (!trackUnread) return;

    if (shouldAutoScroll) {
        scrollMessagesToBottom();
        return;
    }

    onUnread();
}

export function renderMessageHistory(messages, options) {
    const { currentUserId, onOpenMessageActions } = options;

    elements.messages.replaceChildren();

    (messages || []).forEach((message) => {
        appendMessage(message, {
            currentUserId,
            shouldAutoScroll: false,
            trackUnread: false,
            onOpenMessageActions,
            onUnread: () => {}
        });
    });

    scrollMessagesToBottom();
}
