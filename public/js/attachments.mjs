import { createImageMessagePayload } from "./messagePayloads.mjs";

const MAX_IMAGE_EDGE = 1280;
const IMAGE_MIME_TYPE = "image/jpeg";
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52];

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.addEventListener("load", () => resolve(String(reader.result || "")));
        reader.addEventListener("error", () => reject(new Error("画像を読み込めませんでした")));
        reader.readAsDataURL(file);
    });
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", () => reject(new Error("この画像形式は送信できません")));
        image.src = dataUrl;
    });
}

function createCanvas(image) {
    const scale = Math.min(1, MAX_IMAGE_EDGE / image.width, MAX_IMAGE_EDGE / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    return {
        canvas,
        width,
        height
    };
}

export async function prepareImageAttachment(file, maxPayloadLength) {
    if (!file || !file.type.startsWith("image/")) {
        throw new Error("写真ファイルを選んでください");
    }

    const sourceDataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(sourceDataUrl);
    const { canvas, width, height } = createCanvas(image);

    for (const quality of QUALITY_STEPS) {
        const dataUrl = canvas.toDataURL(IMAGE_MIME_TYPE, quality);
        const payload = createImageMessagePayload({
            dataUrl,
            name: file.name,
            width,
            height
        });

        if (payload.length <= maxPayloadLength) {
            return payload;
        }
    }

    throw new Error("画像が大きすぎます。少し小さい写真を選んでください");
}
