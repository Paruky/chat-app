const KEYS = {
    lastRoom: "lastRoom",
    unreadCounts: "unreadCounts"
};

function readJson(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        console.warn(`localStorage read failed: ${key}`, error);
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`localStorage write failed: ${key}`, error);
    }
}

export function loadLastRoom() {
    return localStorage.getItem(KEYS.lastRoom) || "";
}

export function saveLastRoom(room) {
    localStorage.setItem(KEYS.lastRoom, room);
}

export function loadUnreadCounts() {
    return readJson(KEYS.unreadCounts, {});
}

export function saveUnreadCounts(unreadCounts) {
    writeJson(KEYS.unreadCounts, unreadCounts);
}
