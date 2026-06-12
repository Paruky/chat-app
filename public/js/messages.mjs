import { elements } from "./dom.mjs";
import { formatMessageTime } from "./formatters.mjs";

const BOTTOM_THRESHOLD = 120;

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

function createMessageElement(data, currentUserId) {
    const item = document.createElement("div");
    item.className = "message";

    if (data.userId && data.userId === currentUserId) {
        item.classList.add("my-message");
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

    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = data.message || "";

    top.append(name, time);
    content.append(top, text);
    header.append(avatar, content);
    item.appendChild(header);

    return item;
}

export function appendMessage(data, options) {
    const {
        currentUserId,
        shouldAutoScroll,
        trackUnread = true,
        onUnread
    } = options;

    if (!data) return;

    elements.messages.appendChild(createMessageElement(data, currentUserId));

    if (!trackUnread) return;

    if (shouldAutoScroll) {
        scrollMessagesToBottom();
        return;
    }

    onUnread();
}

export function renderMessageHistory(messages, currentUserId) {
    elements.messages.replaceChildren();

    (messages || []).forEach((message) => {
        appendMessage(message, {
            currentUserId,
            shouldAutoScroll: false,
            trackUnread: false,
            onUnread: () => {}
        });
    });

    scrollMessagesToBottom();
}
