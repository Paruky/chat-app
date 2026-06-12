import { SOCKET_OPTIONS, SUPABASE_CONFIG, LIMITS } from "./config.mjs";
import { elements, setCurrentRoomName, setLoading, setUserBar } from "./dom.mjs";
import {
    appendMessage,
    hideNewMessageButton,
    isNearBottom,
    renderMessageHistory,
    scrollMessagesToBottom,
    showNewMessageButton
} from "./messages.mjs";
import { renderRoomList } from "./rooms.mjs";
import {
    loadLastRoom,
    loadUnreadCounts,
    saveLastRoom,
    saveUnreadCounts
} from "./storage.mjs";
import {
    hideTypingIndicator,
    setupTypingInput,
    showTypingIndicator
} from "./typing.mjs";

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
    visibleUnreadCount: 0,
    shouldAutoScroll: true
};

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

function renderRooms() {
    renderRoomList({
        rooms: state.rooms,
        currentRoom: state.currentRoom,
        unreadCounts: state.unreadCounts,
        onSelectRoom: joinRoom
    });
}

function markRoomAsRead(room) {
    if (!room) return;

    state.unreadCounts[room] = 0;
    saveUnreadCounts(state.unreadCounts);
    renderRooms();
}

function incrementUnread(room) {
    if (!room || room === state.currentRoom) return;

    state.unreadCounts[room] = (state.unreadCounts[room] || 0) + 1;
    saveUnreadCounts(state.unreadCounts);
    renderRooms();
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

function joinRoom(value) {
    const room = cleanText(value, LIMITS.roomName);

    if (!room || !state.user) return;

    typing.stopTyping();

    state.currentRoom = room;
    elements.roomInput.value = room;
    setCurrentRoomName(room);
    markRoomAsRead(room);
    resetVisibleUnread();
    saveLastRoom(room);
    renderRooms();
    emitJoinRoom(room);
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

    if (savedRoom) {
        joinRoom(savedRoom);
    }
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

elements.joinButton.addEventListener("click", () => {
    joinRoom(elements.roomInput.value);
});

elements.roomInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        joinRoom(elements.roomInput.value);
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
    renderMessageHistory(data, state.user?.id);
});

socket.on("room list", (rooms) => {
    state.rooms = rooms || [];
    renderRooms();
});

socket.on("chat message", (data) => {
    if (data?.room && data.room !== state.currentRoom) return;

    appendMessage(data, {
        currentUserId: state.user?.id,
        shouldAutoScroll: state.shouldAutoScroll,
        onUnread: incrementVisibleUnread
    });
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
