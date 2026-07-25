import { elements } from "./dom.mjs";

function createUnreadBadge(count) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = count;
    return badge;
}

function normalizeRooms(rooms) {
    const roomMap = new Map();

    (rooms || []).forEach((room) => {
        const record = typeof room === "string"
            ? { name: room }
            : { ...room };
        const name = String(record.name || "").trim();

        if (!name) return;

        roomMap.set(name, {
            ...record,
            name
        });
    });

    return [...roomMap.values()]
        .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export function renderRoomList(options) {
    const {
        rooms,
        currentRoom,
        unreadCounts,
        showUnreadBadges,
        onManageRoom,
        onSelectRoom
    } = options;

    elements.roomList.replaceChildren();

    normalizeRooms(rooms).forEach((room) => {
        const row = document.createElement("div");
        row.className = "room-list-row";

        const item = document.createElement("button");
        item.type = "button";
        item.className = "room-item";
        item.dataset.room = room.name;

        if (room.name === currentRoom) {
            item.classList.add("active");
        }

        const roomName = document.createElement("span");
        roomName.className = "room-name";
        roomName.textContent = room.name;
        item.appendChild(roomName);

        const unreadCount = unreadCounts[room.name] || 0;

        if (showUnreadBadges && unreadCount > 0) {
            item.appendChild(createUnreadBadge(unreadCount));
        }

        item.addEventListener("click", () => onSelectRoom(room.name));
        row.appendChild(item);

        if (room.isOwner) {
            const manageButton = document.createElement("button");
            manageButton.type = "button";
            manageButton.className = "room-manage-btn";
            manageButton.dataset.room = room.name;
            manageButton.textContent = "管理";
            manageButton.addEventListener("click", () => onManageRoom(room.name));
            row.appendChild(manageButton);
        }

        elements.roomList.appendChild(row);
    });
}
