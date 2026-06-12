import { elements } from "./dom.mjs";

const STOP_TYPING_DELAY = 2500;
const REMOTE_TYPING_TTL = 3500;

let remoteTypingTimer = null;

export function setupTypingInput(options) {
    const {
        input,
        socket,
        getRoom,
        getUserProfile
    } = options;

    let isTyping = false;
    let stopTypingTimer = null;

    function autoResize() {
        input.style.height = "auto";
        input.style.height = `${input.scrollHeight}px`;
    }

    function stopTyping() {
        const room = getRoom();

        if (!room || !isTyping) return;

        isTyping = false;
        clearTimeout(stopTypingTimer);
        socket.emit("stop typing", { room });
    }

    function startTyping() {
        const room = getRoom();
        const profile = getUserProfile();

        if (!room || !profile) return;

        if (!isTyping) {
            isTyping = true;
            socket.emit("typing", {
                room,
                name: profile.name,
                avatar_url: profile.avatarUrl
            });
        }

        clearTimeout(stopTypingTimer);
        stopTypingTimer = setTimeout(stopTyping, STOP_TYPING_DELAY);
    }

    input.addEventListener("input", () => {
        autoResize();

        if (input.value.trim()) {
            startTyping();
            return;
        }

        stopTyping();
    });

    return {
        stopTyping,
        resetInput() {
            input.value = "";
            input.style.height = "auto";
            stopTyping();
        }
    };
}

export function showTypingIndicator(data) {
    elements.typingIndicator.replaceChildren();

    const content = document.createElement("div");
    content.className = "typing-content";

    const avatar = document.createElement("img");
    avatar.className = "typing-avatar";
    avatar.alt = "";
    avatar.referrerPolicy = "no-referrer";

    if (data.avatar_url) {
        avatar.src = data.avatar_url;
    }

    const texts = document.createElement("div");
    texts.className = "typing-texts";

    const name = document.createElement("div");
    name.className = "typing-name";
    name.textContent = data.name || "ユーザー";

    const dots = document.createElement("div");
    dots.className = "typing-dots";
    dots.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));

    texts.append(name, dots);
    content.append(avatar, texts);
    elements.typingIndicator.appendChild(content);
    elements.typingIndicator.classList.add("show");

    clearTimeout(remoteTypingTimer);
    remoteTypingTimer = setTimeout(hideTypingIndicator, REMOTE_TYPING_TTL);
}

export function hideTypingIndicator() {
    clearTimeout(remoteTypingTimer);
    elements.typingIndicator.classList.remove("show");
}
