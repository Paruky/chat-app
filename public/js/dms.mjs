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
        .toLowerCase()
        .slice(0, 39);
}

export function isDmRoom(room) {
    return String(room || "").startsWith(DM_PREFIX);
}

export function createDmRoom(currentAccount, targetAccount) {
    const users = [
        normalizeAccountName(currentAccount),
        normalizeAccountName(targetAccount)
    ].filter(Boolean).sort((a, b) => a.localeCompare(b, "en"));

    if (users.length !== 2 || users[0] === users[1]) return "";

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
    const users = parseDmRoom(room);

    if (!current || users.length !== 2 || !users.includes(current)) return "";

    return users.find((user) => user !== current) || "";
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
        onSelectDm
    } = options;

    elements.dmList.replaceChildren();

    const peers = [...new Set(
        (rooms || [])
            .map((room) => getDmPeer(room, currentAccount))
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "en"));

    if (peers.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "まだDMはありません";
        elements.dmList.appendChild(empty);
        return;
    }

    peers.forEach((peer) => {
        const room = createDmRoom(currentAccount, peer);
        const item = document.createElement("button");
        item.type = "button";
        item.className = "room-item dm-item";
        item.dataset.room = room;

        if (room === currentRoom) {
            item.classList.add("active");
        }

        const name = document.createElement("span");
        name.className = "room-name";
        name.textContent = `@${peer}`;
        item.appendChild(name);

        const unreadCount = unreadCounts[room] || 0;

        if (showUnreadBadges && unreadCount > 0) {
            item.appendChild(createUnreadBadge(unreadCount));
        }

        item.addEventListener("click", () => onSelectDm(peer));
        elements.dmList.appendChild(item);
    });
}
