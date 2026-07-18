import { elements } from "./dom.mjs";
import { formatMessageTime } from "./formatters.mjs";

function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function createEmptyState() {
    const empty = document.createElement("div");
    empty.className = "new-message-empty";
    empty.textContent = "新着はありません";
    return empty;
}

function createNewMessageItem(entry, options) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "new-message-item";
    item.dataset.room = entry.room;

    const meta = document.createElement("div");
    meta.className = "new-message-meta";

    const sender = document.createElement("strong");
    sender.className = "new-message-sender";
    sender.textContent = compactText(entry.name) || "ユーザー";

    const time = document.createElement("span");
    time.className = "new-message-time";
    time.textContent = formatMessageTime(entry.createdAt);

    meta.append(sender, time);

    const preview = document.createElement("div");
    preview.className = "new-message-preview";
    preview.textContent = compactText(entry.preview) || "メッセージ";

    const source = document.createElement("div");
    source.className = "new-message-source";
    source.textContent = options.formatSource(entry);

    item.append(meta, preview, source);
    item.addEventListener("click", () => options.onOpen(entry));

    return item;
}

export function renderNewMessageList(options) {
    const {
        entries = [],
        formatSource,
        onOpen
    } = options;
    const hasEntries = entries.length > 0;

    elements.newMessagePanel.hidden = !hasEntries;
    elements.newMessageList.replaceChildren();

    if (!hasEntries) {
        elements.newMessageList.appendChild(createEmptyState());
        return;
    }

    entries.forEach((entry) => {
        elements.newMessageList.appendChild(createNewMessageItem(entry, {
            formatSource,
            onOpen
        }));
    });
}
