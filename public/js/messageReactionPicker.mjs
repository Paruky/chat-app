const REACTION_EMOJIS = [
    "👍",
    "❤️",
    "😂",
    "😮",
    "😢",
    "🙏",
    "🔥",
    "🎉"
];

function createLayer() {
    const layer = document.createElement("div");
    layer.className = "message-reaction-layer";
    layer.hidden = true;

    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "message-reaction-scrim";
    scrim.setAttribute("aria-label", "閉じる");

    const panel = document.createElement("div");
    panel.className = "message-reaction-panel";
    panel.setAttribute("role", "menu");

    layer.append(scrim, panel);
    document.body.appendChild(layer);

    return {
        layer,
        scrim,
        panel
    };
}

function hasUserReaction(message, emoji, userId) {
    return (message?.reactions || []).some((reaction) =>
        reaction.emoji === emoji &&
        (reaction.userIds || []).includes(userId)
    );
}

export function setupMessageReactionPicker({ getCurrentUserId, onSelect }) {
    const ui = createLayer();
    let selectedMessage = null;

    function close() {
        selectedMessage = null;
        ui.layer.hidden = true;
        ui.panel.replaceChildren();
    }

    function open(message) {
        if (!message?.id) return;

        selectedMessage = message;
        ui.panel.replaceChildren();

        const title = document.createElement("div");
        title.className = "message-reaction-title";
        title.textContent = "リアクション";

        const list = document.createElement("div");
        list.className = "message-reaction-options";

        const currentUserId = getCurrentUserId();

        REACTION_EMOJIS.forEach((emoji) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "message-reaction-option";
            button.textContent = emoji;
            button.setAttribute("role", "menuitem");
            button.setAttribute("aria-label", `${emoji} でリアクション`);
            button.classList.toggle("active", hasUserReaction(selectedMessage, emoji, currentUserId));
            button.addEventListener("click", () => {
                onSelect(selectedMessage, emoji);
                close();
            });

            list.appendChild(button);
        });

        ui.panel.append(title, list);
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
