import { formatMessageTime } from "./formatters.mjs";
import { parseMessagePayload, summarizePayload } from "./messagePayloads.mjs";

function getMessageId(message) {
    return String(message?.id || "");
}

function getReplyParentId(message) {
    const payload = parseMessagePayload(message?.message);

    return payload.type === "reply" ? payload.replyTo.id : "";
}

function createMessageMap(messages) {
    return new Map((messages || [])
        .filter((message) => getMessageId(message))
        .map((message) => [getMessageId(message), message]));
}

function findRootMessage(message, messageMap) {
    let current = message;
    const seen = new Set();

    while (current) {
        const currentId = getMessageId(current);
        const parentId = getReplyParentId(current);

        if (!parentId || seen.has(currentId)) return current;

        seen.add(currentId);
        current = messageMap.get(parentId) || current;

        if (getMessageId(current) === currentId) return current;
    }

    return message;
}

function belongsToThread(message, rootId, messageMap) {
    const messageId = getMessageId(message);

    if (!messageId || messageId === rootId) return messageId === rootId;

    const seen = new Set();
    let current = message;

    while (current) {
        const currentId = getMessageId(current);
        const parentId = getReplyParentId(current);

        if (!parentId || seen.has(currentId)) return false;
        if (parentId === rootId) return true;

        seen.add(currentId);
        current = messageMap.get(parentId);
    }

    return false;
}

function messageSortValue(message, index) {
    const id = Number(message?.id);

    if (Number.isFinite(id)) return id;

    return index;
}

function createLayer() {
    const layer = document.createElement("div");
    layer.className = "reply-thread-layer";
    layer.hidden = true;

    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "reply-thread-scrim";
    scrim.setAttribute("aria-label", "閉じる");

    const panel = document.createElement("section");
    panel.className = "reply-thread-panel";
    panel.setAttribute("aria-label", "返信スレッド");

    layer.append(scrim, panel);
    document.body.appendChild(layer);

    return {
        layer,
        scrim,
        panel
    };
}

function createThreadItem(message, onScrollToMessage) {
    const payload = parseMessagePayload(message.message);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reply-thread-message";

    const meta = document.createElement("span");
    meta.className = "reply-thread-meta";
    meta.textContent = `${message.name || "ユーザー"} ・ ${formatMessageTime(message.created_at)}`;

    const body = document.createElement("span");
    body.className = "reply-thread-text";
    body.textContent = summarizePayload(payload);

    if (payload.type === "reply") {
        const source = document.createElement("span");
        source.className = "reply-thread-source";
        source.textContent = `返信先: ${payload.replyTo.name}`;
        button.append(source);
    }

    button.append(meta, body);
    button.addEventListener("click", () => {
        onScrollToMessage(getMessageId(message));
    });

    return button;
}

export function collectReplyThread(messages, selectedMessage) {
    const messageMap = createMessageMap(messages);
    const rootMessage = findRootMessage(selectedMessage, messageMap);
    const rootId = getMessageId(rootMessage);

    if (!rootId) return selectedMessage ? [selectedMessage] : [];

    return (messages || [])
        .map((message, index) => ({ message, index }))
        .filter(({ message }) => belongsToThread(message, rootId, messageMap))
        .sort((left, right) =>
            messageSortValue(left.message, left.index) -
            messageSortValue(right.message, right.index)
        )
        .map(({ message }) => message);
}

export function setupReplyThreadPanel({ onScrollToMessage }) {
    const ui = createLayer();

    function close() {
        ui.layer.hidden = true;
        ui.panel.replaceChildren();
    }

    function open(messages) {
        ui.panel.replaceChildren();

        const header = document.createElement("div");
        header.className = "reply-thread-header";

        const title = document.createElement("strong");
        title.textContent = "返信スレッド";

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "reply-thread-close";
        closeButton.textContent = "閉じる";
        closeButton.addEventListener("click", close);

        const list = document.createElement("div");
        list.className = "reply-thread-list";

        (messages || []).forEach((message) => {
            list.appendChild(createThreadItem(message, (messageId) => {
                close();
                onScrollToMessage(messageId);
            }));
        });

        header.append(title, closeButton);
        ui.panel.append(header, list);
        ui.layer.hidden = false;
    }

    ui.scrim.addEventListener("click", close);
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !ui.layer.hidden) {
            close();
        }
    });

    return {
        open,
        close
    };
}
