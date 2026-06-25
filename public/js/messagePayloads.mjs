const IMAGE_MESSAGE_TYPE = "paruky:image:v1";
const REPLY_MESSAGE_TYPE = "paruky:reply:v1";
const PREVIEW_LENGTH = 90;

function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function trimPreview(value) {
    const text = compactText(value);

    if (text.length <= PREVIEW_LENGTH) return text;

    return `${text.slice(0, PREVIEW_LENGTH)}...`;
}

function normalizeReplyTarget(target) {
    return {
        id: String(target?.id || ""),
        userId: String(target?.userId || ""),
        name: compactText(target?.name) || "ユーザー",
        preview: trimPreview(target?.preview) || "メッセージ",
        previewType: target?.previewType === "image" ? "image" : "text"
    };
}

export function createImageMessagePayload(image) {
    return JSON.stringify({
        type: IMAGE_MESSAGE_TYPE,
        dataUrl: image.dataUrl,
        name: image.name || "photo.jpg",
        width: image.width || 0,
        height: image.height || 0
    });
}

export function summarizePayload(payload) {
    if (payload.type === "image") {
        return "写真";
    }

    if (payload.type === "reply") {
        return trimPreview(payload.text) || "返信";
    }

    return trimPreview(payload.text) || "メッセージ";
}

export function createReplyTarget(message) {
    const payload = parseMessagePayload(message?.message);

    return normalizeReplyTarget({
        id: message?.id,
        userId: message?.userId,
        name: message?.name,
        preview: summarizePayload(payload),
        previewType: payload.type === "image" ? "image" : "text"
    });
}

export function createReplyMessagePayload({ text, replyTo }) {
    return JSON.stringify({
        type: REPLY_MESSAGE_TYPE,
        text: String(text || "").trim(),
        replyTo: normalizeReplyTarget(replyTo)
    });
}

export function parseMessagePayload(message) {
    const raw = String(message || "");

    try {
        const parsed = JSON.parse(raw);

        if (
            parsed?.type === IMAGE_MESSAGE_TYPE &&
            typeof parsed.dataUrl === "string" &&
            parsed.dataUrl.startsWith("data:image/")
        ) {
            return {
                type: "image",
                dataUrl: parsed.dataUrl,
                name: parsed.name || "写真",
                width: Number(parsed.width) || 0,
                height: Number(parsed.height) || 0
            };
        }

        if (
            parsed?.type === REPLY_MESSAGE_TYPE &&
            typeof parsed.text === "string" &&
            parsed.text.trim() &&
            parsed.replyTo?.id
        ) {
            return {
                type: "reply",
                text: parsed.text,
                replyTo: normalizeReplyTarget(parsed.replyTo)
            };
        }
    } catch (error) {
        // Plain text messages are expected to land here.
    }

    return {
        type: "text",
        text: raw
    };
}
