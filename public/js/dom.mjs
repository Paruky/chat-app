function byId(id) {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`Missing element: #${id}`);
    }

    return element;
}

export const elements = {
    loadingScreen: byId("loading-screen"),
    roomsView: byId("rooms-view"),
    chatView: byId("chat-view"),
    roomsPanel: byId("rooms-panel"),
    settingsPanel: byId("settings-panel"),
    roomsNavButton: byId("rooms-nav-btn"),
    settingsNavButton: byId("settings-nav-btn"),
    roomList: byId("room-list"),
    roomForm: byId("room-form"),
    form: byId("form"),
    input: byId("input"),
    messages: byId("messages"),
    newMessageButton: byId("new-message-btn"),
    roomInput: byId("room"),
    joinButton: byId("join-btn"),
    backToRoomsButton: byId("back-to-rooms-btn"),
    typingIndicator: byId("typing-indicator"),
    currentRoomName: byId("current-room-name"),
    userBar: byId("user-bar"),
    unreadBadgesToggle: byId("setting-unread-badges"),
    compactModeToggle: byId("setting-compact-mode"),
    themeOptions: byId("theme-options"),
    appVersion: byId("app-version")
};

export function setLoading(isLoading) {
    elements.loadingScreen.hidden = !isLoading;
}

export function setCurrentRoomName(room) {
    elements.currentRoomName.textContent = room ? `# ${room}` : "未接続";
}

export function showRoomsView() {
    elements.roomsView.hidden = false;
    elements.chatView.hidden = true;
}

export function showChatView() {
    elements.roomsView.hidden = true;
    elements.chatView.hidden = false;
}

export function showMenuPanel(panel) {
    const isSettings = panel === "settings";

    elements.roomsPanel.hidden = isSettings;
    elements.settingsPanel.hidden = !isSettings;
    elements.roomsNavButton.classList.toggle("active", !isSettings);
    elements.settingsNavButton.classList.toggle("active", isSettings);
}

export function setUserBar(profile) {
    elements.userBar.replaceChildren();

    const avatar = document.createElement("img");
    avatar.className = "user-avatar";
    avatar.alt = "";
    avatar.referrerPolicy = "no-referrer";

    if (profile.avatarUrl) {
        avatar.src = profile.avatarUrl;
    }

    const name = document.createElement("span");
    name.textContent = profile.name;

    elements.userBar.append(avatar, name);
}

export function setAppVersion(version) {
    elements.appVersion.textContent = version;
}
