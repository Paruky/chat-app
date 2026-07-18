const KEYS = {
    lastRoom: "lastRoom",
    unreadCounts: "unreadCounts",
    newMessagePreviews: "newMessagePreviews",
    settings: "settings",
    hiddenDmRooms: "hiddenDmRooms",
    dmDisplayNames: "dmDisplayNames",
    cannedMessages: "cannedMessages"
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

function accountScopedKey(baseKey, accountKey) {
    return `${baseKey}:${String(accountKey || "default")}`;
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

export function loadNewMessagePreviews(accountKey) {
    return readJson(accountScopedKey(KEYS.newMessagePreviews, accountKey), []);
}

export function saveNewMessagePreviews(accountKey, messages) {
    writeJson(accountScopedKey(KEYS.newMessagePreviews, accountKey), messages);
}

export function loadSettings() {
    return readJson(KEYS.settings, {});
}

export function saveSettings(settings) {
    writeJson(KEYS.settings, settings);
}

export function loadHiddenDmRooms() {
    return readJson(KEYS.hiddenDmRooms, []);
}

export function saveHiddenDmRooms(rooms) {
    writeJson(KEYS.hiddenDmRooms, rooms);
}

export function loadDmDisplayNames() {
    return readJson(KEYS.dmDisplayNames, {});
}

export function saveDmDisplayNames(names) {
    writeJson(KEYS.dmDisplayNames, names);
}

export function loadCannedMessages(accountKey) {
    return readJson(accountScopedKey(KEYS.cannedMessages, accountKey), []);
}

export function saveCannedMessages(accountKey, messages) {
    writeJson(accountScopedKey(KEYS.cannedMessages, accountKey), messages);
}
