function byId(id) {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`Missing element: #${id}`);
    }

    return element;
}

export const elements = {
    loadingScreen: byId("loading-screen"),
    roomList: byId("room-list"),
    form: byId("form"),
    input: byId("input"),
    messages: byId("messages"),
    newMessageButton: byId("new-message-btn"),
    roomInput: byId("room"),
    joinButton: byId("join-btn"),
    typingIndicator: byId("typing-indicator"),
    currentRoomName: byId("current-room-name"),
    userBar: byId("user-bar")
};

export function setLoading(isLoading) {
    elements.loadingScreen.hidden = !isLoading;
}

export function setCurrentRoomName(room) {
    elements.currentRoomName.textContent = room ? `# ${room}` : "未接続";
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
