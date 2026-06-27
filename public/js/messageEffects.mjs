const EFFECT_HOLD_DELAY = 520;
const EFFECT_HOLD_MOVE_LIMIT = 12;
const SCREEN_EFFECT_DURATION = 2400;

export const BUBBLE_MESSAGE_EFFECTS = [
    {
        id: "slam",
        label: "スラム",
        description: "ドンと強く出る"
    },
    {
        id: "loud",
        label: "ラウド",
        description: "大きく叫ぶ"
    },
    {
        id: "gentle",
        label: "ジェントル",
        description: "ふわっと届く"
    },
    {
        id: "invisible-ink",
        label: "見えないインク",
        description: "触るまで隠す"
    }
];

export const SCREEN_MESSAGE_EFFECTS = [
    {
        id: "echo",
        label: "エコー",
        description: "言葉を画面に反響"
    },
    {
        id: "confetti",
        label: "紙吹雪",
        description: "カラフルに弾ける"
    },
    {
        id: "fireworks",
        label: "花火",
        description: "光を打ち上げる"
    },
    {
        id: "spotlight",
        label: "スポットライト",
        description: "主役っぽく照らす"
    }
];

export const MESSAGE_EFFECTS = [
    ...BUBBLE_MESSAGE_EFFECTS.map((effect) => ({
        ...effect,
        kind: "bubble"
    })),
    ...SCREEN_MESSAGE_EFFECTS.map((effect) => ({
        ...effect,
        kind: "screen"
    }))
];

const MESSAGE_EFFECT_IDS = new Set(MESSAGE_EFFECTS.map((effect) => effect.id));
const SCREEN_MESSAGE_EFFECT_IDS = new Set(SCREEN_MESSAGE_EFFECTS.map((effect) => effect.id));

export const MESSAGE_EFFECT_CLASS_NAMES = MESSAGE_EFFECTS
    .map((effect) => `message-effect-${effect.id}`);

export function normalizeMessageEffect(effect) {
    const value = String(effect || "").trim();

    return MESSAGE_EFFECT_IDS.has(value) ? value : "";
}

export function isScreenMessageEffect(effect) {
    return SCREEN_MESSAGE_EFFECT_IDS.has(normalizeMessageEffect(effect));
}

function clearTimer(timer) {
    if (timer) {
        window.clearTimeout(timer);
    }
}

export function setupEffectSendMenu({
    elements,
    canOpen,
    getText,
    onSelectEffect,
    onOpenChange
}) {
    let holdTimer = null;
    let startX = 0;
    let startY = 0;
    let suppressNextClick = false;
    let isOpen = false;

    function setOpen(nextOpen) {
        isOpen = Boolean(nextOpen);
        elements.effectMenu.hidden = !isOpen;
        elements.sendButton.setAttribute("aria-expanded", String(isOpen));
        onOpenChange?.(isOpen);
    }

    function canOpenMenu() {
        return Boolean(canOpen?.() && getText?.());
    }

    function stopHoldTimer() {
        clearTimer(holdTimer);
        holdTimer = null;
    }

    function openFromHold() {
        if (!canOpenMenu()) return;

        suppressNextClick = true;
        setOpen(true);
    }

    function scheduleHold(clientX, clientY) {
        startX = clientX;
        startY = clientY;
        stopHoldTimer();
        holdTimer = window.setTimeout(openFromHold, EFFECT_HOLD_DELAY);
    }

    function onPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        if (!canOpenMenu()) return;

        scheduleHold(event.clientX, event.clientY);
    }

    function onPointerMove(event) {
        const moved =
            Math.abs(event.clientX - startX) > EFFECT_HOLD_MOVE_LIMIT ||
            Math.abs(event.clientY - startY) > EFFECT_HOLD_MOVE_LIMIT;

        if (moved) {
            stopHoldTimer();
        }
    }

    elements.sendButton.addEventListener("pointerdown", onPointerDown);
    elements.sendButton.addEventListener("pointermove", onPointerMove);
    elements.sendButton.addEventListener("pointerup", stopHoldTimer);
    elements.sendButton.addEventListener("pointercancel", stopHoldTimer);
    elements.sendButton.addEventListener("pointerleave", stopHoldTimer);

    elements.sendButton.addEventListener("touchstart", (event) => {
        if (!canOpenMenu()) return;

        const touch = event.touches?.[0];

        if (!touch) return;

        scheduleHold(touch.clientX, touch.clientY);
    }, {
        passive: true
    });

    elements.sendButton.addEventListener("touchmove", (event) => {
        const touch = event.touches?.[0];

        if (!touch) return;

        const moved =
            Math.abs(touch.clientX - startX) > EFFECT_HOLD_MOVE_LIMIT ||
            Math.abs(touch.clientY - startY) > EFFECT_HOLD_MOVE_LIMIT;

        if (moved) {
            stopHoldTimer();
        }
    }, {
        passive: true
    });

    elements.sendButton.addEventListener("touchend", stopHoldTimer);
    elements.sendButton.addEventListener("touchcancel", stopHoldTimer);

    elements.sendButton.addEventListener("contextmenu", (event) => {
        if (!canOpenMenu()) return;

        event.preventDefault();
        suppressNextClick = true;
        setOpen(true);
    });

    elements.sendButton.addEventListener("click", (event) => {
        if (!suppressNextClick && !isOpen) return;

        event.preventDefault();
        event.stopPropagation();
        suppressNextClick = false;
    });

    elements.effectMenu.addEventListener("click", (event) => {
        event.stopPropagation();

        const button = event.target instanceof Element
            ? event.target.closest("[data-message-effect]")
            : null;

        if (!button) return;

        const effect = normalizeMessageEffect(button.dataset.messageEffect);

        if (!effect) return;

        onSelectEffect?.(effect);
        setOpen(false);
    });

    elements.effectCancelButton.addEventListener("click", () => {
        setOpen(false);
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
            stopHoldTimer();
            suppressNextClick = false;
            setOpen(false);
        },
        get isOpen() {
            return isOpen;
        }
    };
}

function createEchoLayer(layer, text) {
    const words = String(text || "Paruky Chat").slice(0, 18);

    for (let index = 0; index < 18; index += 1) {
        const echo = document.createElement("span");

        echo.textContent = words;
        echo.style.setProperty("--x", `${8 + Math.random() * 84}%`);
        echo.style.setProperty("--y", `${10 + Math.random() * 72}%`);
        echo.style.setProperty("--delay", `${Math.random() * 0.55}s`);
        echo.style.setProperty("--size", `${18 + Math.random() * 32}px`);
        echo.style.setProperty("--rotate", `${-18 + Math.random() * 36}deg`);
        layer.appendChild(echo);
    }
}

function createConfettiLayer(layer) {
    for (let index = 0; index < 84; index += 1) {
        const piece = document.createElement("span");

        piece.style.setProperty("--x", `${Math.random() * 100}%`);
        piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
        piece.style.setProperty("--delay", `${Math.random() * 0.65}s`);
        piece.style.setProperty("--spin", `${180 + Math.random() * 720}deg`);
        piece.style.setProperty("--hue", `${Math.floor(Math.random() * 360)}`);
        layer.appendChild(piece);
    }
}

function createFireworksLayer(layer) {
    for (let burstIndex = 0; burstIndex < 5; burstIndex += 1) {
        const burst = document.createElement("div");

        burst.className = "screen-firework-burst";
        burst.style.setProperty("--x", `${18 + Math.random() * 64}%`);
        burst.style.setProperty("--y", `${14 + Math.random() * 46}%`);
        burst.style.setProperty("--delay", `${burstIndex * 0.22}s`);

        for (let sparkIndex = 0; sparkIndex < 18; sparkIndex += 1) {
            const spark = document.createElement("span");
            const angle = (Math.PI * 2 * sparkIndex) / 18;
            const distance = 72 + Math.random() * 74;

            spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
            spark.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
            spark.style.setProperty("--hue", `${Math.floor(Math.random() * 360)}`);
            burst.appendChild(spark);
        }

        layer.appendChild(burst);
    }
}

function createSpotlightLayer(layer) {
    const beam = document.createElement("div");
    const title = document.createElement("span");

    beam.className = "screen-spotlight-beam";
    title.className = "screen-spotlight-title";
    title.textContent = "Spotlight";

    layer.append(beam, title);
}

export function playScreenEffect(effect, text) {
    const normalizedEffect = normalizeMessageEffect(effect);

    if (!isScreenMessageEffect(normalizedEffect)) return;

    const layer = document.createElement("div");

    layer.className = `screen-effect-layer screen-effect-${normalizedEffect}`;
    layer.setAttribute("aria-hidden", "true");

    if (normalizedEffect === "echo") {
        createEchoLayer(layer, text);
    } else if (normalizedEffect === "confetti") {
        createConfettiLayer(layer);
    } else if (normalizedEffect === "fireworks") {
        createFireworksLayer(layer);
    } else if (normalizedEffect === "spotlight") {
        createSpotlightLayer(layer);
    }

    document.body.appendChild(layer);

    window.setTimeout(() => {
        layer.remove();
    }, SCREEN_EFFECT_DURATION);
}
