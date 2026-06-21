import { elements } from "./dom.mjs";

const DM_PREFIX = "dm:";

function safeDecode(value) {
    try {
        return decodeURIComponent(value || "");
    } catch (error) {
        return "";
    }
}

function createUnreadBadge(count) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = count;
    return badge;
}

export function normalizeAccountName(value) {
    return String(value || "")
        .trim()
        .replace(/^@+/, "")
        .replace(/\s+/g, "")
        .slice(0, 39);
}

function getAccountKey(accountName) {
    return normalizeAccountName(accountName).toLowerCase();
}

function accountKeysMatch(left, right) {
    const leftKey = getAccountKey(left);
    const rightKey = getAccountKey(right);

    return leftKey === rightKey || leftKey.startsWith(rightKey) || rightKey.startsWith(leftKey);
}

function createShortKey(value) {
    let hash = 2166136261;

    for (const character of value) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(36);
}

export function isDmRoom(room) {
    return String(room || "").startsWith(DM_PREFIX);
}

export function createDmRoom(currentAccount, targetAccount) {
    const keys = [
        getAccountKey(currentAccount),
        getAccountKey(targetAccount)
    ].filter(Boolean).sort((a, b) => getAccountKey(a).localeCompare(getAccountKey(b), "en"));

    if (keys.length !== 2 || keys[0] === keys[1]) return "";

    const fingerprint = createShortKey(keys.join("|"));

    return `${DM_PREFIX}${fingerprint}:${keys[0].slice(0, 12)}:${keys[1].slice(0, 12)}`;
}

export function parseDmRoom(room) {
    if (!isDmRoom(room)) return [];

    const parts = String(room)
        .slice(DM_PREFIX.length)
        .split(":")
        .map(safeDecode)
        .map(normalizeAccountName)
        .filter(Boolean);

    return parts.length >= 3 ? parts.slice(1, 3) : parts;
}

export function getDmPeer(room, currentAccount) {
    const currentKey = getAccountKey(currentAccount);
    const users = parseDmRoom(room);
    const currentUser = users.find((user) => accountKeysMatch(user, currentKey));

    if (!currentKey || users.length !== 2 || !currentUser) return "";

    return users.find((user) => !accountKeysMatch(user, currentKey)) || "";
}

export function formatDmTitle(accountName) {
    const account = normalizeAccountName(accountName);
    return account ? `DM @${account}` : "DM";
}

export function renderDmList(options) {
    const {
        rooms,
        currentAccount,
        currentRoom,
        unreadCounts,
        showUnreadBadges,
        hiddenDmRooms,
        dmDisplayNames,
        onSelectDm,
        onDeleteDm
    } = options;

    elements.dmList.replaceChildren();

    const dmMap = new Map();

    (rooms || []).forEach((room) => {
        if ((hiddenDmRooms || []).includes(room)) return;

        const peer = dmDisplayNames?.[room] || getDmPeer(room, currentAccount);
        const key = getAccountKey(peer);

        if (peer && !dmMap.has(key)) {
            dmMap.set(key, { peer, room });
        }
    });

    const dms = [...dmMap.values()].sort((a, b) => getAccountKey(a.peer).localeCompare(getAccountKey(b.peer), "en"));

    if (dms.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "まだDMはありません";
        elements.dmList.appendChild(empty);
        return;
    }

    dms.forEach(({ peer, room }) => {
        const item = document.createElement("div");
        item.className = "room-item dm-item";
        item.dataset.room = room;

        if (room === currentRoom) {
            item.classList.add("active");
        }

        const name = document.createElement("span");
        name.className = "room-name";
        name.textContent = `@${peer}`;
        item.appendChild(name);

        const actions = document.createElement("span");
        actions.className = "dm-actions";

        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.className = "dm-open-btn";
        openButton.textContent = "開く";
        openButton.addEventListener("click", () => onSelectDm({ peer, room }));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "dm-delete-btn";
        deleteButton.textContent = "削除";
        deleteButton.addEventListener("click", () => onDeleteDm({ peer, room }));

        actions.append(openButton, deleteButton);
        item.appendChild(actions);

        const unreadCount = unreadCounts[room] || 0;

        if (showUnreadBadges && unreadCount > 0) {
            item.appendChild(createUnreadBadge(unreadCount));
        }

        item.addEventListener("click", (event) => {
            if (event.target.closest("button")) return;
            onSelectDm({ peer, room });
        });
        elements.dmList.appendChild(item);
    });
}
