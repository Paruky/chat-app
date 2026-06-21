import { SOCKET_OPTIONS, SUPABASE_CONFIG, LIMITS } from "./config.mjs";
import {
    elements,
    setAppVersion,
    showChatView,
    showMenuPanel,
    showRoomsView,
    setCurrentConversationName,
    setCurrentRoomName,
    setLoading,
    setUserBar
} from "./dom.mjs";
import {
    appendMessage,
    hideNewMessageButton,
    isNearBottom,
    renderMessageHistory,
    scrollMessagesToBottom,
    showNewMessageButton,
    updateMessage
} from "./messages.mjs";
import { setupMessageActions } from "./messageActions.mjs";
import {
    createDmRoom,
    formatDmTitle,
    getDmPeer,
    isDmRoom,
    normalizeAccountName,
    renderDmList
} from "./dms.mjs";
import { renderRoomList } from "./rooms.mjs";
import {
    loadLastRoom,
    loadUnreadCounts,
    loadSettings,
    saveLastRoom,
    saveSettings,
    saveUnreadCounts
} from "./storage.mjs";
import {
    applySettings,
    normalizeSettings,
    setupSettingsPanel
} from "./settings.mjs";
import {
    hideTypingIndicator,
    setupTypingInput,
    showTypingIndicator
} from "./typing.mjs";
import { APP_VERSION } from "./version.mjs";

const socket = window.io(SOCKET_OPTIONS);
const supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.publishableKey
);

const state = {
    user: null,
    currentRoom: "",
    rooms: [],
    unreadCounts: loadUnreadCounts(),
    settings: normalizeSettings(loadSettings()),
    visibleUnreadCount: 0,
    shouldAutoScroll: true
};

setAppVersion(APP_VERSION);
applySettings(state.settings);

function encodeRoomRoute(room) {
    return encodeURIComponent(room);
}

function decodeRoomRoute(value) {
    try {
        return decodeURIComponent(value || "");
    } catch (error) {
        return "";
    }
}

function navigateToRooms() {
    window.location.hash = "#/rooms";
}

function navigateToDms() {
    window.location.hash = "#/dms";
}

function navigateToSettings() {
    window.location.hash = "#/settings";
}

function navigateToRoom(room) {
    window.location.hash = `#/rooms/${encodeRoomRoute(room)}`;
}

function navigateToDm(accountName) {
    window.location.hash = `#/dm/${encodeRoomRoute(accountName)}`;
}

function readRoute() {
    const hash = window.location.hash || "#/rooms";
    const parts = hash.replace(/^#\/?/, "").split("/");

    if (parts[0] === "dms") {
        return {
            view: "dms",
            room: ""
        };
    }

    if (parts[0] === "settings") {
        return {
            view: "settings",
            room: ""
        };
    }

    if (parts[0] === "dm" && parts[1]) {
        return {
            view: "dm",
            accountName: normalizeAccountName(decodeRoomRoute(parts.slice(1).join("/")))
        };
    }

    if (parts[0] === "rooms" && parts[1]) {
        return {
            view: "room",
            room: cleanText(decodeRoomRoute(parts.slice(1).join("/")), LIMITS.roomName)
        };
    }

    return {
        view: "rooms",
        room: ""
    };
}

function syncRoute() {
    const route = readRoute();

    if (route.view === "room" && route.room) {
        joinRoom(route.room, { updateRoute: false });
        return;
    }

    if (route.view === "dm" && route.accountName) {
        joinDm(route.accountName, { updateRoute: false });
        return;
    }

    showRoomMenu(route.view === "settings" ? "settings" : route.view === "dms" ? "dms" : "rooms");
}

function cleanText(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
}

function getUserProfile(user = state.user) {
    if (!user) return null;

    return {
        name: user.user_metadata?.user_name ||
            user.user_metadata?.preferred_username ||
            user.email ||
            "ユーザー",
        avatarUrl: user.user_metadata?.avatar_url || ""
    };
}

function getCurrentAccount() {
    return normalizeAccountName(
        state.user?.user_metadata?.preferred_username ||
        state.user?.user_metadata?.user_name ||
        state.user?.email?.split("@")[0] ||
        ""
    );
}

function renderRooms() {
    renderRoomList({
        rooms: state.rooms.filter((room) => !isDmRoom(room)),
        currentRoom: state.currentRoom,
        unreadCounts: state.unreadCounts,
        showUnreadBadges: state.settings.unreadBadges,
        onSelectRoom: joinRoom
    });
}

function renderDms() {
    renderDmList({
        rooms: state.rooms,
        currentAccount: getCurrentAccount(),
        currentRoom: state.currentRoom,
        unreadCounts: state.unreadCounts,
        showUnreadBadges: state.settings.unreadBadges,
        onSelectDm: joinDm,
        onDeleteDm: deleteDm
    });
}

function markRoomAsRead(room) {
    if (!room) return;

    state.unreadCounts[room] = 0;
    saveUnreadCounts(state.unreadCounts);
    renderRooms();
    renderDms();
}

function incrementUnread(room) {
    if (!room || room === state.currentRoom) return;
    if (isDmRoom(room) && !getDmPeer(room, getCurrentAccount())) return;

    state.unreadCounts[room] = (state.unreadCounts[room] || 0) + 1;
    saveUnreadCounts(state.unreadCounts);
    renderRooms();
    renderDms();
}

function resetVisibleUnread() {
    state.visibleUnreadCount = 0;
    hideNewMessageButton();
}

function incrementVisibleUnread() {
    state.visibleUnreadCount += 1;
    showNewMessageButton(state.visibleUnreadCount);
}

function emitJoinRoom(room) {
    const profile = getUserProfile();

    if (!profile) return;

    socket.emit("join room", {
        room,
        name: profile.name
    });
}

function emitEditMessage(message, nextValue) {
    const nextMessage = cleanText(nextValue, LIMITS.message);

    if (
        !nextMessage ||
        !message?.id ||
        !state.currentRoom ||
        !state.user ||
        message.userId !== state.user.id
    ) {
        return;
    }

    socket.emit("edit message", {
        id: message.id,
        room: state.currentRoom,
        userId: state.user.id,
        message: nextMessage
    });
}

function showRoomMenu(panel = "rooms") {
    const previousRoom = state.currentRoom;

    typing.stopTyping();
    state.currentRoom = "";
    elements.roomInput.value = "";
    elements.dmInput.value = "";
    setCurrentRoomName("");
    resetVisibleUnread();
    renderRooms();
    renderDms();
    showMenuPanel(panel);
    showRoomsView();

    if (previousRoom) {
        socket.emit("leave room", {
            room: previousRoom
        });
    }
}

function updateSettings(nextSettings) {
    state.settings = normalizeSettings(nextSettings);
    saveSettings(state.settings);
    applySettings(state.settings);
    settingsPanel.syncControls();
    renderRooms();
    renderDms();
}

function joinRoom(value, options = {}) {
    const { updateRoute = true } = options;
    const room = cleanText(value, LIMITS.roomName);

    if (!room || isDmRoom(room) || !state.user) return;

    if (updateRoute) {
        navigateToRoom(room);
        return;
    }

    typing.stopTyping();

    state.currentRoom = room;
    elements.roomInput.value = room;
    elements.dmInput.value = "";
    setCurrentRoomName(room);
    markRoomAsRead(room);
    resetVisibleUnread();
    saveLastRoom(room);
    renderRooms();
    renderDms();
    showChatView();
    emitJoinRoom(room);
}

function joinDm(value, options = {}) {
    const { updateRoute = true } = options;
    const currentAccount = getCurrentAccount();
    const targetAccount = normalizeAccountName(value);
    const room = createDmRoom(currentAccount, targetAccount);

    if (!room || !state.user) return;

    if (updateRoute) {
        navigateToDm(targetAccount);
        return;
    }

    typing.stopTyping();

    state.currentRoom = room;
    elements.roomInput.value = "";
    elements.dmInput.value = targetAccount;
    setCurrentConversationName(formatDmTitle(targetAccount));
    markRoomAsRead(room);
    resetVisibleUnread();
    saveLastRoom(room);
    renderRooms();
    renderDms();
    showChatView();
    emitJoinRoom(room);
}

function deleteDm(dm) {
    const targetAccount = normalizeAccountName(dm?.peer);
    const room = cleanText(dm?.room, LIMITS.roomName);

    if (!room || !state.user) return;

    const confirmed = window.confirm(`@${targetAccount} とのDMを一覧から削除しますか？`);

    if (!confirmed) return;

    socket.emit("delete dm room", {
        room
    });
}

async function login() {
    await supabaseClient.auth.signInWithOAuth({
        provider: "github"
    });
}

async function checkUser() {
    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error) {
        console.warn("auth error", error);
    }

    state.user = user;

    if (!state.user) {
        await login();
        return;
    }

    const profile = getUserProfile();
    setUserBar(profile);
    setLoading(false);

    const savedRoom = cleanText(loadLastRoom(), LIMITS.roomName);

    if (!window.location.hash && savedRoom) {
        navigateToRooms();
    }

    syncRoute();
}

function isMobileInput() {
    return /iPhone|Android|iPad/i.test(navigator.userAgent) ||
        window.matchMedia("(pointer: coarse)").matches;
}

function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => {
            console.warn("service worker registration failed", error);
        });
}

const typing = setupTypingInput({
    input: elements.input,
    socket,
    getRoom: () => state.currentRoom,
    getUserProfile
});

const messageActions = setupMessageActions({
    onEdit: emitEditMessage
});

const settingsPanel = setupSettingsPanel({
    elements,
    settings: {
        get current() {
            return state.settings;
        }
    },
    onChange: updateSettings
});

elements.messages.addEventListener("scroll", () => {
    state.shouldAutoScroll = isNearBottom();

    if (state.shouldAutoScroll) {
        resetVisibleUnread();
    }
});

elements.newMessageButton.addEventListener("click", () => {
    scrollMessagesToBottom();
    resetVisibleUnread();
});

elements.roomForm.addEventListener("submit", (event) => {
    event.preventDefault();
    joinRoom(elements.roomInput.value);
});

elements.dmForm.addEventListener("submit", (event) => {
    event.preventDefault();
    joinDm(elements.dmInput.value);
});

elements.backToRoomsButton.addEventListener("click", () => {
    if (isDmRoom(state.currentRoom)) {
        navigateToDms();
        return;
    }

    navigateToRooms();
});

elements.roomsNavButton.addEventListener("click", () => {
    navigateToRooms();
});

elements.dmsNavButton.addEventListener("click", () => {
    navigateToDms();
});

elements.settingsNavButton.addEventListener("click", () => {
    navigateToSettings();
});

elements.roomInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        joinRoom(elements.roomInput.value);
    }
});

elements.dmInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        joinDm(elements.dmInput.value);
    }
});

elements.input.addEventListener("keydown", (event) => {
    if (event.isComposing || event.keyCode === 229) return;

    if (!isMobileInput() && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        elements.form.requestSubmit();
    }
});

elements.form.addEventListener("submit", (event) => {
    event.preventDefault();

    const message = cleanText(elements.input.value, LIMITS.message);
    const profile = getUserProfile();

    if (!message || !state.currentRoom || !state.user || !profile) return;

    socket.emit("chat message", {
        room: state.currentRoom,
        userId: state.user.id,
        name: profile.name,
        message,
        avatar_url: profile.avatarUrl
    });

    typing.resetInput();
});

socket.on("connect", () => {
    if (state.currentRoom && state.user) {
        emitJoinRoom(state.currentRoom);
    }
});

socket.on("disconnect", () => {
    hideTypingIndicator();
});

socket.on("message history", (data) => {
    resetVisibleUnread();
    renderMessageHistory(data, {
        currentUserId: state.user?.id,
        onOpenMessageActions: messageActions.open
    });
});

socket.on("room list", (rooms) => {
    state.rooms = rooms || [];
    renderRooms();
    renderDms();

    if (state.currentRoom && !state.rooms.includes(state.currentRoom)) {
        showRoomMenu(isDmRoom(state.currentRoom) ? "dms" : "rooms");
    }
});

socket.on("chat message", (data) => {
    if (data?.room && data.room !== state.currentRoom) return;

    appendMessage(data, {
        currentUserId: state.user?.id,
        shouldAutoScroll: state.shouldAutoScroll,
        onOpenMessageActions: messageActions.open,
        onUnread: incrementVisibleUnread
    });
});

socket.on("message edited", (data) => {
    updateMessage(data);
});

socket.on("new message notification", (data) => {
    incrementUnread(data?.room);
});

socket.on("typing", showTypingIndicator);
socket.on("stop typing", hideTypingIndicator);

socket.on("server error", (data) => {
    console.warn(data?.message || "server error");
});

window.addEventListener("load", async () => {
    registerServiceWorker();
    await checkUser();
});

window.addEventListener("hashchange", () => {
    if (state.user) {
        syncRoute();
    }
});
