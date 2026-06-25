import { elements } from "./dom.mjs";
import { formatMessageTime } from "./formatters.mjs";
import { parseMessagePayload } from "./messagePayloads.mjs";

const BOTTOM_THRESHOLD = 120;
const LONG_PRESS_DELAY = 520;
const LONG_PRESS_MOVE_LIMIT = 12;
const REPLY_CLICK_DELAY = 260;
const SWIPE_REPLY_THRESHOLD = 58;
const SWIPE_REPLY_MAX = 76;
const SWIPE_VERTICAL_CANCEL = 20;

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

function findMessageElement(messageId) {
    if (!messageId) return null;

    return [...elements.messages.querySelectorAll(".message")]
        .find((message) => message.dataset.messageId === String(messageId));
}

export function scrollToMessage(messageId) {
    const item = findMessageElement(messageId);

    if (!item) return false;

    item.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    item.classList.add("message-focus");
    window.setTimeout(() => {
        item.classList.remove("message-focus");
    }, 1400);

    return true;
}

function enableMessageActions(item, data, onOpenMessageActions, actionState) {
    let longPressTimer = null;
    let startX = 0;
    let startY = 0;

    function clearLongPress() {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }

    function suppressReplyTap() {
        item.dataset.ignoreReplyTap = "true";
        window.setTimeout(() => {
            delete item.dataset.ignoreReplyTap;
        }, 450);
    }

    item.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        suppressReplyTap();
        onOpenMessageActions({
            message: item.messageData,
            canEdit: actionState.canEdit,
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
            suppressReplyTap();
            onOpenMessageActions({
                message: item.messageData,
                canEdit: actionState.canEdit,
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

function enableReplyNavigation(item, data, callbacks) {
    const { onOpenReplyThread, onJumpToReplySource } = callbacks;
    let clickTimer = null;

    item.addEventListener("click", (event) => {
        const target = event.target;

        if (
            item.dataset.ignoreReplyTap ||
            (target instanceof Element && target.closest("button"))
        ) {
            return;
        }

        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            onJumpToReplySource(data);
            return;
        }

        clickTimer = window.setTimeout(() => {
            clickTimer = null;
            onOpenReplyThread(data);
        }, REPLY_CLICK_DELAY);
    });
}

function enableSwipeReply(item, data, options) {
    const { onSwipeReply } = options;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let didSwipe = false;

    function resetSwipe() {
        tracking = false;
        didSwipe = false;
        item.style.transform = "";
        item.classList.remove("message-swipe-ready");
    }

    item.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse") return;

        startX = event.clientX;
        startY = event.clientY;
        tracking = true;
        didSwipe = false;
        item.classList.add("message-swiping");
    });

    item.addEventListener("pointermove", (event) => {
        if (!tracking) return;

        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        const directedDelta = deltaX;

        if (Math.abs(deltaY) > SWIPE_VERTICAL_CANCEL && Math.abs(deltaY) > Math.abs(deltaX)) {
            resetSwipe();
            item.classList.remove("message-swiping");
            return;
        }

        if (directedDelta <= 0) {
            item.style.transform = "";
            item.classList.remove("message-swipe-ready");
            return;
        }

        const offset = Math.min(directedDelta, SWIPE_REPLY_MAX);
        didSwipe = directedDelta >= SWIPE_REPLY_THRESHOLD;
        item.style.transform = `translateX(${offset}px)`;
        item.classList.toggle("message-swipe-ready", didSwipe);
    });

    item.addEventListener("pointerup", () => {
        if (didSwipe) {
            item.dataset.ignoreReplyTap = "true";
            window.setTimeout(() => {
                delete item.dataset.ignoreReplyTap;
            }, 450);
            onSwipeReply(data);
        }

        resetSwipe();
        item.classList.remove("message-swiping");
    });

    item.addEventListener("pointercancel", () => {
        resetSwipe();
        item.classList.remove("message-swiping");
    });

    item.addEventListener("pointerleave", () => {
        if (!tracking) return;

        resetSwipe();
        item.classList.remove("message-swiping");
    });
}

function createReplyReference(replyTo, data, callbacks) {
    const { onOpenReplyThread, onJumpToReplySource } = callbacks;
    const reference = document.createElement("button");
    let clickTimer = null;

    reference.type = "button";
    reference.className = "reply-reference";

    const label = document.createElement("span");
    label.className = "reply-reference-label";
    label.textContent = `${replyTo.name} に返信`;

    const preview = document.createElement("span");
    preview.className = "reply-reference-preview";
    preview.textContent = replyTo.previewType === "image" ? "写真" : replyTo.preview;

    reference.append(label, preview);
    reference.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            onJumpToReplySource(data);
            return;
        }

        clickTimer = window.setTimeout(() => {
            clickTimer = null;
            onOpenReplyThread(data);
        }, REPLY_CLICK_DELAY);
    });

    return reference;
}

function createMessageBody(payload) {
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
    const {
        currentUserId,
        onOpenMessageActions,
        onOpenReplyThread,
        onJumpToReplySource,
        onSwipeReply
    } = options;
    const item = document.createElement("div");
    item.className = "message";
    item.messageData = data;
    const payload = parseMessagePayload(data.message);
    const isOwnMessage = data.userId && data.userId === currentUserId;

    if (data.id) {
        item.dataset.messageId = data.id;
    }

    if (isOwnMessage) {
        item.classList.add("my-message");
    }

    if (payload.type === "reply") {
        item.classList.add("reply-message");
        enableReplyNavigation(item, data, {
            onOpenReplyThread,
            onJumpToReplySource
        });
    }

    if (onOpenMessageActions) {
        enableMessageActions(item, data, onOpenMessageActions, {
            canEdit: isOwnMessage && payload.type === "text"
        });
    }

    if (onSwipeReply) {
        enableSwipeReply(item, data, {
            onSwipeReply
        });
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
    content.append(top);

    if (payload.type === "reply") {
        content.append(createReplyReference(payload.replyTo, data, {
            onOpenReplyThread,
            onJumpToReplySource
        }));
    }

    content.append(createMessageBody(payload));
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
        body.replaceWith(createMessageBody(parseMessagePayload(item.messageData.message)));
    }
}

export function appendMessage(data, options) {
    const {
        currentUserId,
        shouldAutoScroll,
        trackUnread = true,
        onUnread,
        onOpenMessageActions,
        onOpenReplyThread,
        onJumpToReplySource,
        onSwipeReply
    } = options;

    if (!data) return;

    elements.messages.appendChild(createMessageElement(data, {
        currentUserId,
        onOpenMessageActions,
        onOpenReplyThread,
        onJumpToReplySource,
        onSwipeReply
    }));

    if (!trackUnread) return;

    if (shouldAutoScroll) {
        scrollMessagesToBottom();
        return;
    }

    onUnread();
}

export function renderMessageHistory(messages, options) {
    const {
        currentUserId,
        onOpenMessageActions,
        onOpenReplyThread,
        onJumpToReplySource,
        onSwipeReply
    } = options;

    elements.messages.replaceChildren();

    (messages || []).forEach((message) => {
        appendMessage(message, {
            currentUserId,
            shouldAutoScroll: false,
            trackUnread: false,
            onOpenMessageActions,
            onOpenReplyThread,
            onJumpToReplySource,
            onSwipeReply,
            onUnread: () => {}
        });
    });

    scrollMessagesToBottom();
}
