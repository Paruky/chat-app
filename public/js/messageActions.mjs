const LONG_PRESS_SOURCE = "longpress";

function createActionLayer() {
    const layer = document.createElement("div");
    layer.className = "message-action-layer";
    layer.hidden = true;

    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "message-action-scrim";
    scrim.setAttribute("aria-label", "閉じる");

    const menu = document.createElement("div");
    menu.className = "message-action-menu";

    const editor = document.createElement("form");
    editor.className = "message-edit-panel";

    layer.append(scrim, menu, editor);
    document.body.appendChild(layer);

    return {
        layer,
        scrim,
        menu,
        editor
    };
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function positionMenu(menu, anchor, actionCount) {
    const menuWidth = 180;
    const menuHeight = actionCount * 50;
    const padding = 12;
    const x = clamp(anchor.x, padding, window.innerWidth - menuWidth - padding);
    const y = clamp(anchor.y, padding, window.innerHeight - menuHeight - padding);

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
}

function renderMenu(menu, selectedMessage, callbacks) {
    const { onEditClick, onReplyClick } = callbacks;
    menu.replaceChildren();

    const list = document.createElement("div");
    list.className = "message-action-list";

    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.className = "message-action-item";
    replyButton.textContent = "返信";
    replyButton.addEventListener("click", () => onReplyClick(selectedMessage.message));

    list.appendChild(replyButton);

    if (selectedMessage.canEdit) {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "message-action-item";
        editButton.textContent = "編集";
        editButton.addEventListener("click", () => onEditClick(selectedMessage.message));

        list.appendChild(editButton);
    }

    menu.appendChild(list);

    return list.childElementCount;
}

function renderEditor(editor, message, callbacks) {
    const { onCancel, onSave } = callbacks;

    editor.replaceChildren();

    const title = document.createElement("div");
    title.className = "message-edit-title";
    title.textContent = "メッセージを編集";

    const textarea = document.createElement("textarea");
    textarea.className = "message-edit-input";
    textarea.value = message.message || "";
    textarea.rows = 4;

    const buttons = document.createElement("div");
    buttons.className = "message-edit-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "message-edit-cancel";
    cancelButton.textContent = "キャンセル";
    cancelButton.addEventListener("click", onCancel);

    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "message-edit-save";
    saveButton.textContent = "保存";

    buttons.append(cancelButton, saveButton);
    editor.append(title, textarea, buttons);

    editor.onsubmit = (event) => {
        event.preventDefault();
        onSave(message, textarea.value);
    };

    requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
}

export function setupMessageActions({ onEdit, onReply }) {
    const ui = createActionLayer();
    let selectedMessage = null;

    function close() {
        selectedMessage = null;
        ui.layer.hidden = true;
        ui.layer.classList.remove("editing", "mobile");
        ui.menu.replaceChildren();
        ui.editor.replaceChildren();
    }

    function openEditor(message) {
        ui.layer.classList.add("editing");
        renderEditor(ui.editor, message, {
            onCancel: close,
            onSave: (targetMessage, nextValue) => {
                onEdit(targetMessage, nextValue);
                close();
            }
        });
    }

    function startReply(message) {
        onReply(message);
        close();
    }

    function open({ message, anchor, source, canEdit = false }) {
        selectedMessage = {
            message,
            canEdit
        };
        ui.layer.hidden = false;
        ui.layer.classList.remove("editing", "mobile");

        if (source === LONG_PRESS_SOURCE) {
            ui.layer.classList.add("mobile");
        }

        const actionCount = renderMenu(ui.menu, selectedMessage, {
            onEditClick: openEditor,
            onReplyClick: startReply
        });

        if (source !== LONG_PRESS_SOURCE && anchor) {
            positionMenu(ui.menu, anchor, actionCount);
        } else {
            ui.menu.style.left = "";
            ui.menu.style.top = "";
        }
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
