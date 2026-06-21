import { elements } from "./dom.mjs";

function createUnreadBadge(count) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = count;
    return badge;
}

function normalizeRooms(rooms) {
    return [...new Set((rooms || []).map((room) => String(room || "").trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "ja"));
}

export function renderRoomList(options) {
    const {
        rooms,
        currentRoom,
        unreadCounts,
        showUnreadBadges,
        onSelectRoom
    } = options;

    elements.roomList.replaceChildren();

    normalizeRooms(rooms).forEach((room) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "room-item";
        item.dataset.room = room;

        if (room === currentRoom) {
            item.classList.add("active");
        }

        const roomName = document.createElement("span");
        roomName.className = "room-name";
        roomName.textContent = room;
        item.appendChild(roomName);

        const unreadCount = unreadCounts[room] || 0;

        if (showUnreadBadges && unreadCount > 0) {
            item.appendChild(createUnreadBadge(unreadCount));
        }

        item.addEventListener("click", () => onSelectRoom(room));
        elements.roomList.appendChild(item);
    });
}
