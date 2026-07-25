import { elements } from "./dom.mjs";
import {
    getAccountKey,
    normalizeAccountName
} from "./accountNames.mjs";

const DM_PREFIX = "dm:";
const LEGACY_DM_KEY_LENGTH = 12;

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

function accountKeyMatchesDmSegment(segment, accountName) {
    const segmentKey = getAccountKey(segment);
    const accountKey = getAccountKey(accountName);

    if (!segmentKey || !accountKey) return false;
    if (segmentKey === accountKey) return true;

    return segmentKey.length <= LEGACY_DM_KEY_LENGTH &&
        accountKey.startsWith(segmentKey);
}

function getCurrentAccountKeys(currentAccount) {
    const values = Array.isArray(currentAccount) ? currentAccount : [currentAccount];

    return [...new Set(values.map(getAccountKey).filter(Boolean))];
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

    return `${DM_PREFIX}${fingerprint}:${keys[0]}:${keys[1]}`;
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
    const currentKeys = getCurrentAccountKeys(currentAccount);
    const users = parseDmRoom(room);
    const currentUser = users.find((user) =>
        currentKeys.some((currentKey) => accountKeyMatchesDmSegment(user, currentKey))
    );

    if (currentKeys.length === 0 || users.length !== 2 || !currentUser) return "";

    return users.find((user) =>
        !currentKeys.some((currentKey) => accountKeyMatchesDmSegment(user, currentKey))
    ) || "";
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
