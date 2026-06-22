const IMAGE_MESSAGE_TYPE = "paruky:image:v1";

export function createImageMessagePayload(image) {
    return JSON.stringify({
        type: IMAGE_MESSAGE_TYPE,
        dataUrl: image.dataUrl,
        name: image.name || "photo.jpg",
        width: image.width || 0,
        height: image.height || 0
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
    } catch (error) {
        // Plain text messages are expected to land here.
    }

    return {
        type: "text",
        text: raw
    };
}
