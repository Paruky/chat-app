function canEditVersionHistory() {
    return window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 701px)").matches;
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        throw new Error("バージョン履歴を更新できませんでした");
    }

    return response.json();
}

async function listEntries() {
    const data = await requestJson("/api/version-history");

    return data.entries || [];
}

async function createEntry(entry) {
    return requestJson("/api/version-history", {
        method: "POST",
        body: JSON.stringify(entry)
    });
}

async function updateEntry(id, entry) {
    return requestJson(`/api/version-history/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(entry)
    });
}

async function deleteEntry(id) {
    return requestJson(`/api/version-history/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });
}

function createEmptyState(message) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = message;
    return empty;
}

function createEntryElement(entry, options) {
    const item = document.createElement("article");
    item.className = "version-history-item";

    const header = document.createElement("div");
    header.className = "version-history-item-header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.version;

    const date = document.createElement("span");
    date.className = "version-history-date";
    date.textContent = formatDate(entry.updatedAt || entry.createdAt);

    titleWrap.append(title, date);
    header.appendChild(titleWrap);

    if (options.canEdit) {
        const actions = document.createElement("div");
        actions.className = "version-history-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "編集";
        editButton.addEventListener("click", () => options.onEdit(entry));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "version-history-delete";
        deleteButton.textContent = "削除";
        deleteButton.addEventListener("click", () => options.onDelete(entry));

        actions.append(editButton, deleteButton);
        header.appendChild(actions);
    }

    const notes = document.createElement("div");
    notes.className = "version-history-notes";
    notes.textContent = entry.notes;

    item.append(header, notes);
    return item;
}

export function setupVersionHistoryPage(options) {
    const { elements } = options;
    const state = {
        entries: [],
        editingId: "",
        canEdit: false,
        hasLoaded: false,
        isSaving: false
    };

    function resetForm() {
        state.editingId = "";
        elements.versionHistoryVersionInput.value = "";
        elements.versionHistoryNotesInput.value = "";
        elements.versionHistorySubmitButton.textContent = "追加";
        elements.versionHistoryCancelButton.hidden = true;
    }

    function render() {
        elements.versionHistoryPanel.classList.toggle("can-edit", state.canEdit);
        elements.versionHistoryForm.hidden = !state.canEdit;
        elements.versionHistorySubmitButton.disabled = state.isSaving;
        elements.versionHistoryCancelButton.disabled = state.isSaving;
        elements.versionHistoryList.replaceChildren();

        if (!state.hasLoaded) {
            elements.versionHistoryList.appendChild(createEmptyState("読み込み中"));
            return;
        }

        if (state.entries.length === 0) {
            elements.versionHistoryList.appendChild(createEmptyState("バージョン履歴はまだありません"));
            return;
        }

        state.entries.forEach((entry) => {
            elements.versionHistoryList.appendChild(createEntryElement(entry, {
                canEdit: state.canEdit,
                onEdit: startEdit,
                onDelete: removeEntry
            }));
        });
    }

    async function refresh() {
        state.entries = await listEntries();
        state.hasLoaded = true;
        render();
    }

    function startEdit(entry) {
        if (!state.canEdit) return;

        state.editingId = entry.id;
        elements.versionHistoryVersionInput.value = entry.version;
        elements.versionHistoryNotesInput.value = entry.notes;
        elements.versionHistorySubmitButton.textContent = "保存";
        elements.versionHistoryCancelButton.hidden = false;
        elements.versionHistoryVersionInput.focus();
    }

    async function removeEntry(entry) {
        if (!state.canEdit) return;

        const confirmed = window.confirm(`${entry.version} を削除しますか？`);

        if (!confirmed) return;

        await deleteEntry(entry.id);
        await refresh();
    }

    elements.versionHistoryForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!state.canEdit) return;
        if (state.isSaving) return;

        const entry = {
            version: elements.versionHistoryVersionInput.value.trim(),
            notes: elements.versionHistoryNotesInput.value.trim()
        };

        if (!entry.version || !entry.notes) return;

        state.isSaving = true;
        render();

        try {
            if (state.editingId) {
                await updateEntry(state.editingId, entry);
            } else {
                await createEntry(entry);
            }

            resetForm();
            await refresh();
        } finally {
            state.isSaving = false;
            render();
        }
    });

    elements.versionHistoryCancelButton.addEventListener("click", resetForm);

    async function open() {
        state.canEdit = canEditVersionHistory();
        resetForm();
        render();

        try {
            await refresh();
        } catch (error) {
            state.hasLoaded = true;
            elements.versionHistoryList.replaceChildren(createEmptyState(error.message));
        }
    }

    return {
        open,
        refresh
    };
}
