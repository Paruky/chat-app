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
    dmsPanel: byId("dms-panel"),
    settingsPanel: byId("settings-panel"),
    roomsNavButton: byId("rooms-nav-btn"),
    dmsNavButton: byId("dms-nav-btn"),
    settingsNavButton: byId("settings-nav-btn"),
    roomList: byId("room-list"),
    dmList: byId("dm-list"),
    roomForm: byId("room-form"),
    dmForm: byId("dm-form"),
    form: byId("form"),
    replyComposer: byId("reply-composer"),
    replyComposerLabel: byId("reply-composer-label"),
    replyComposerPreview: byId("reply-composer-preview"),
    replyCancelButton: byId("reply-cancel-btn"),
    attachmentButton: byId("attachment-btn"),
    attachmentMenu: byId("attachment-menu"),
    photoUploadButton: byId("photo-upload-btn"),
    photoInput: byId("photo-input"),
    input: byId("input"),
    sendButton: byId("send-btn"),
    effectMenu: byId("effect-menu"),
    effectCancelButton: byId("effect-cancel-btn"),
    messages: byId("messages"),
    newMessageButton: byId("new-message-btn"),
    roomInput: byId("room"),
    joinButton: byId("join-btn"),
    dmInput: byId("dm-target"),
    dmStartButton: byId("dm-start-btn"),
    backToRoomsButton: byId("back-to-rooms-btn"),
    typingIndicator: byId("typing-indicator"),
    currentRoomName: byId("current-room-name"),
    userBar: byId("user-bar"),
    unreadBadgesToggle: byId("setting-unread-badges"),
    notificationsButton: byId("setting-notifications-btn"),
    notificationStatus: byId("notification-status"),
    compactModeToggle: byId("setting-compact-mode"),
    themeOptions: byId("theme-options"),
    versionHistoryButton: byId("version-history-btn"),
    versionHistoryBackButton: byId("version-history-back-btn"),
    versionHistoryPanel: byId("version-history-panel"),
    versionHistoryForm: byId("version-history-form"),
    versionHistoryVersionInput: byId("version-history-version"),
    versionHistoryNotesInput: byId("version-history-notes"),
    versionHistoryCancelButton: byId("version-history-cancel-btn"),
    versionHistorySubmitButton: byId("version-history-submit-btn"),
    versionHistoryList: byId("version-history-list"),
    appVersion: byId("app-version")
};

export function setLoading(isLoading) {
    elements.loadingScreen.hidden = !isLoading;
}

export function setCurrentRoomName(room) {
    elements.currentRoomName.textContent = room ? `# ${room}` : "未接続";
}

export function setCurrentConversationName(name) {
    elements.currentRoomName.textContent = name || "未接続";
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
    const isDms = panel === "dms";
    const isSettings = panel === "settings";
    const isVersionHistory = panel === "versions";

    elements.roomsPanel.hidden = isDms || isSettings || isVersionHistory;
    elements.dmsPanel.hidden = !isDms;
    elements.settingsPanel.hidden = !isSettings;
    elements.versionHistoryPanel.hidden = !isVersionHistory;
    elements.roomsNavButton.classList.toggle("active", !isDms && !isSettings && !isVersionHistory);
    elements.dmsNavButton.classList.toggle("active", isDms);
    elements.settingsNavButton.classList.toggle("active", isSettings || isVersionHistory);
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
