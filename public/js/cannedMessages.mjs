import { DEFAULT_CANNED_MESSAGES } from "./cannedMessagePresets.mjs";

const MAX_CANNED_MESSAGE_LENGTH = 500;
const MAX_CUSTOM_CANNED_MESSAGES = 80;

function normalizeText(value) {
    return String(value || "").trim().slice(0, MAX_CANNED_MESSAGE_LENGTH);
}

function createCannedMessageId() {
    return `canned_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCustomMessages(messages) {
    return (Array.isArray(messages) ? messages : [])
        .map((message) => ({
            id: String(message?.id || createCannedMessageId()),
            text: normalizeText(message?.text)
        }))
        .filter((message) => message.text)
        .slice(0, MAX_CUSTOM_CANNED_MESSAGES);
}

function createEmptyState(text) {
    const empty = document.createElement("div");

    empty.className = "canned-empty";
    empty.textContent = text;

    return empty;
}

function createMessageButton(message, onSend) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "canned-message-item";
    button.textContent = message.text;
    button.addEventListener("click", () => onSend(message.text));

    return button;
}

function createCustomMessageRow(message, callbacks) {
    const row = document.createElement("div");
    const sendButton = createMessageButton(message, callbacks.onSend);
    const deleteButton = document.createElement("button");

    row.className = "canned-custom-row";
    deleteButton.type = "button";
    deleteButton.className = "canned-delete-btn";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => callbacks.onDelete(message.id));

    row.append(sendButton, deleteButton);

    return row;
}

export function setupCannedMessagesPanel({
    elements,
    getAccountKey,
    loadMessages,
    saveMessages,
    onSend,
    onOpenChange
}) {
    const state = {
        customMessages: []
    };

    function renderList() {
        elements.cannedPresetList.replaceChildren();
        elements.cannedCustomList.replaceChildren();

        DEFAULT_CANNED_MESSAGES.forEach((message) => {
            elements.cannedPresetList.appendChild(createMessageButton(message, sendMessage));
        });

        if (state.customMessages.length === 0) {
            elements.cannedCustomList.appendChild(createEmptyState("自分用定型文はまだありません"));
            return;
        }

        state.customMessages.forEach((message) => {
            elements.cannedCustomList.appendChild(createCustomMessageRow(message, {
                onSend: sendMessage,
                onDelete: deleteCustomMessage
            }));
        });
    }

    function getStorageKey() {
        return getAccountKey?.() || "guest";
    }

    function saveCustomMessages() {
        saveMessages(getStorageKey(), state.customMessages);
    }

    function loadCustomMessages() {
        state.customMessages = normalizeCustomMessages(loadMessages(getStorageKey()));
        renderList();
    }

    function setOpen(isOpen) {
        elements.cannedMenu.hidden = !isOpen;
        elements.cannedButton.setAttribute("aria-expanded", String(isOpen));
        onOpenChange?.(isOpen);

        if (isOpen) {
            loadCustomMessages();
            elements.cannedInput.value = "";
        }
    }

    function sendMessage(text) {
        const message = normalizeText(text);

        if (!message) return;

        onSend?.(message);
        setOpen(false);
    }

    function addCustomMessage(event) {
        event?.preventDefault();

        const text = normalizeText(elements.cannedInput.value);

        if (!text) return;

        state.customMessages = [
            {
                id: createCannedMessageId(),
                text
            },
            ...state.customMessages
        ].slice(0, MAX_CUSTOM_CANNED_MESSAGES);
        saveCustomMessages();
        elements.cannedInput.value = "";
        renderList();
        elements.cannedInput.focus();
    }

    function deleteCustomMessage(id) {
        state.customMessages = state.customMessages
            .filter((message) => message.id !== id);
        saveCustomMessages();
        renderList();
    }

    elements.cannedButton.addEventListener("click", (event) => {
        event.stopPropagation();
        setOpen(elements.cannedMenu.hidden);
    });

    elements.cannedMenu.addEventListener("click", (event) => {
        event.stopPropagation();
    });

    elements.cannedCloseButton.addEventListener("click", () => {
        setOpen(false);
    });

    elements.cannedAddButton.addEventListener("click", addCustomMessage);
    elements.cannedInput.addEventListener("keydown", (event) => {
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key !== "Enter") return;

        addCustomMessage(event);
    });

    window.addEventListener("click", () => {
        setOpen(false);
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            setOpen(false);
        }
    });

    return {
        close() {
            setOpen(false);
        },
        refresh() {
            loadCustomMessages();
        }
    };
}
