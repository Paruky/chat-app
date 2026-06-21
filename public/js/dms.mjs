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

export function isDmRoom(room) {
    return String(room || "").startsWith(DM_PREFIX);
}

export function createDmRoom(currentAccount, targetAccount) {
    const users = [
        normalizeAccountName(currentAccount),
        normalizeAccountName(targetAccount)
    ].filter(Boolean).sort((a, b) => getAccountKey(a).localeCompare(getAccountKey(b), "en"));

    if (users.length !== 2 || getAccountKey(users[0]) === getAccountKey(users[1])) return "";

    return `${DM_PREFIX}${users.map((user) => encodeURIComponent(user)).join(":")}`;
}

export function parseDmRoom(room) {
    if (!isDmRoom(room)) return [];

    return String(room)
        .slice(DM_PREFIX.length)
        .split(":")
        .map(safeDecode)
        .map(normalizeAccountName)
        .filter(Boolean);
}

export function getDmPeer(room, currentAccount) {
    const current = normalizeAccountName(currentAccount);
    const currentKey = getAccountKey(current);
    const users = parseDmRoom(room);
    const currentUser = users.find((user) => getAccountKey(user) === currentKey);

    if (!current || users.length !== 2 || !currentUser) return "";

    return users.find((user) => getAccountKey(user) !== currentKey) || "";
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
        onSelectDm,
        onDeleteDm
    } = options;

    elements.dmList.replaceChildren();

    const dmMap = new Map();

    (rooms || []).forEach((room) => {
        const peer = getDmPeer(room, currentAccount);
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
        openButton.addEventListener("click", () => onSelectDm(peer));

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
            onSelectDm(peer);
        });
        elements.dmList.appendChild(item);
    });
}
