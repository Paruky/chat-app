import { SOCKET_OPTIONS, SUPABASE_CONFIG, LIMITS } from "./config.mjs";
import { prepareImageAttachment } from "./attachments.mjs";
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
    scrollToMessage,
    showNewMessageButton,
    updateMessage
} from "./messages.mjs";
import { setupMessageActions } from "./messageActions.mjs";
import {
    createReplyMessagePayload,
    createReplyTarget,
    parseMessagePayload
} from "./messagePayloads.mjs";
import {
    collectReplyThread,
    setupReplyThreadPanel
} from "./replyThreads.mjs";
import {
    getNotificationStatus,
    isNotificationSupported,
    subscribeToNotifications,
    unsubscribeFromNotifications
} from "./notifications.mjs";
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
    loadDmDisplayNames,
    loadHiddenDmRooms,
    loadUnreadCounts,
    loadSettings,
    saveDmDisplayNames,
    saveHiddenDmRooms,
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
    hiddenDmRooms: loadHiddenDmRooms(),
    dmDisplayNames: loadDmDisplayNames(),
    unreadCounts: loadUnreadCounts(),
    settings: normalizeSettings(loadSettings()),
    currentMessages: [],
    replyTarget: null,
    visibleUnreadCount: 0,
    shouldAutoScroll: true,
    isSendingImage: false,
    notificationStatus: {
        supported: isNotificationSupported(),
        configured: false,
        subscribed: false,
        permission: "default",
        busy: false,
        message: "通知の状態を確認中"
    }
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
        hiddenDmRooms: state.hiddenDmRooms,
        dmDisplayNames: state.dmDisplayNames,
        onSelectDm: joinDm,
        onDeleteDm: deleteDm
    });
}

function rememberDmDisplayName(room, accountName) {
    const displayName = normalizeAccountName(accountName);

    if (!room || !displayName) return;

    state.dmDisplayNames[room] = displayName;
    saveDmDisplayNames(state.dmDisplayNames);
}

function hideDmRoom(room) {
    if (!room || state.hiddenDmRooms.includes(room)) return;

    state.hiddenDmRooms.push(room);
    saveHiddenDmRooms(state.hiddenDmRooms);
}

function showDmRoom(room) {
    if (!room || !state.hiddenDmRooms.includes(room)) return;

    state.hiddenDmRooms = state.hiddenDmRooms.filter((hiddenRoom) => hiddenRoom !== room);
    saveHiddenDmRooms(state.hiddenDmRooms);
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
    if (isDmRoom(room)) {
        if (!getDmPeer(room, getCurrentAccount()) && !state.dmDisplayNames[room]) return;
        showDmRoom(room);
    }

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

function setAttachmentMenuOpen(isOpen) {
    elements.attachmentMenu.hidden = !isOpen;
    elements.attachmentButton.setAttribute("aria-expanded", String(isOpen));
}

function renderReplyComposer() {
    if (!state.replyTarget) {
        elements.replyComposer.hidden = true;
        elements.replyComposerLabel.textContent = "返信先";
        elements.replyComposerPreview.textContent = "";
        return;
    }

    elements.replyComposer.hidden = false;
    elements.replyComposerLabel.textContent = `${state.replyTarget.name} に返信`;
    elements.replyComposerPreview.textContent = state.replyTarget.preview;
}

function clearReplyTarget() {
    state.replyTarget = null;
    renderReplyComposer();
}

function startReply(message) {
    if (!message?.id) return;

    state.replyTarget = createReplyTarget(message);
    setAttachmentMenuOpen(false);
    renderReplyComposer();
    elements.input.focus();
}

function jumpToReplySource(message) {
    const payload = parseMessagePayload(message?.message);

    if (payload.type !== "reply") return;

    const moved = scrollToMessage(payload.replyTo.id);

    if (!moved) {
        window.alert("返信元のメッセージが見つかりませんでした");
    }
}

function openReplyThread(message) {
    const thread = collectReplyThread(state.currentMessages, message);

    replyThreadPanel.open(thread.length > 0 ? thread : [message]);
}

function sendCurrentRoomMessage(message) {
    const profile = getUserProfile();

    if (!message || !state.currentRoom || !state.user || !profile) return false;

    socket.emit("chat message", {
        room: state.currentRoom,
        userId: state.user.id,
        name: profile.name,
        message,
        avatar_url: profile.avatarUrl
    });

    return true;
}

async function sendPhoto(file) {
    if (state.isSendingImage) return;

    state.isSendingImage = true;
    elements.attachmentButton.disabled = true;
    elements.photoUploadButton.disabled = true;

    try {
        const payload = await prepareImageAttachment(file, LIMITS.imageMessage);
        sendCurrentRoomMessage(payload);
        setAttachmentMenuOpen(false);
    } catch (error) {
        window.alert(error.message || "写真を送信できませんでした");
    } finally {
        state.isSendingImage = false;
        elements.attachmentButton.disabled = false;
        elements.photoUploadButton.disabled = false;
        elements.photoInput.value = "";
    }
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
    setAttachmentMenuOpen(false);
    clearReplyTarget();
    state.currentMessages = [];
    state.currentRoom = "";
    elements.roomInput.value = "";
    elements.dmInput.value = "";
    setCurrentRoomName("");
    resetVisibleUnread();
    renderRooms();
    renderDms();
    showMenuPanel(panel);
    showRoomsView();

    if (panel === "settings") {
        refreshNotificationStatus();
    }

    if (previousRoom) {
        socket.emit("leave room", {
            room: previousRoom
        });
    }
}

function syncNotificationSetting(subscribed) {
    if (state.settings.pushNotifications === subscribed) return;

    state.settings = normalizeSettings({
        ...state.settings,
        pushNotifications: subscribed
    });
    saveSettings(state.settings);
    settingsPanel.syncControls();
}

function getNotificationUi() {
    const status = state.notificationStatus;

    if (status.busy) {
        return {
            note: "通知設定を更新中",
            buttonText: status.subscribed ? "通知をオフにする" : "通知をオンにする",
            disabled: true
        };
    }

    if (!status.supported) {
        return {
            note: "この環境では通知が使えません",
            buttonText: "通知をオンにする",
            disabled: true
        };
    }

    if (!status.configured) {
        return {
            note: "サーバー側の通知キーが未設定です",
            buttonText: "通知をオンにする",
            disabled: true
        };
    }

    if (status.permission === "denied") {
        return {
            note: "ブラウザ設定で通知がブロックされています",
            buttonText: "通知をオンにする",
            disabled: true
        };
    }

    if (status.message) {
        return {
            note: status.message,
            buttonText: status.subscribed ? "通知をオフにする" : "通知をオンにする",
            disabled: false
        };
    }

    if (status.subscribed) {
        return {
            note: "通知オン。新着メッセージを端末に表示します",
            buttonText: "通知をオフにする",
            disabled: false
        };
    }

    return {
        note: "iPhoneはホーム画面に追加したアプリからオンにできます",
        buttonText: "通知をオンにする",
        disabled: false
    };
}

function renderNotificationSettings() {
    const ui = getNotificationUi();

    elements.notificationStatus.textContent = ui.note;
    elements.notificationsButton.textContent = ui.buttonText;
    elements.notificationsButton.disabled = ui.disabled || !state.user;
}

async function refreshNotificationStatus() {
    state.notificationStatus = {
        ...state.notificationStatus,
        busy: true,
        message: "通知の状態を確認中"
    };
    renderNotificationSettings();

    try {
        const status = await getNotificationStatus();

        state.notificationStatus = {
            ...status,
            busy: false,
            message: ""
        };
        syncNotificationSetting(status.subscribed);
    } catch (error) {
        state.notificationStatus = {
            supported: isNotificationSupported(),
            configured: false,
            subscribed: false,
            permission: "default",
            busy: false,
            message: error.message || "通知の状態を確認できませんでした"
        };
        syncNotificationSetting(false);
    }

    renderNotificationSettings();
}

async function togglePushNotifications() {
    state.notificationStatus = {
        ...state.notificationStatus,
        busy: true,
        message: state.notificationStatus.subscribed ? "通知をオフにしています" : "通知をオンにしています"
    };
    renderNotificationSettings();

    try {
        if (state.notificationStatus.subscribed) {
            await unsubscribeFromNotifications();
            syncNotificationSetting(false);
        } else {
            await subscribeToNotifications(state.user?.id, getCurrentAccount());
            syncNotificationSetting(true);
        }

        await refreshNotificationStatus();
    } catch (error) {
        state.notificationStatus = {
            ...state.notificationStatus,
            busy: false,
            message: error.message || "通知設定を変更できませんでした"
        };
        renderNotificationSettings();
    }
}

function updateSettings(nextSettings) {
    state.settings = normalizeSettings(nextSettings);
    saveSettings(state.settings);
    applySettings(state.settings);
    settingsPanel.syncControls();
    renderNotificationSettings();
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
    const targetAccount = normalizeAccountName(value?.peer || value);
    const existingRoom = cleanText(value?.room, LIMITS.roomName);
    const room = createDmRoom(currentAccount, targetAccount);
    const nextRoom = existingRoom || room;

    if (!nextRoom || !state.user) return;

    if (updateRoute) {
        navigateToDm(targetAccount);
        return;
    }

    typing.stopTyping();

    showDmRoom(nextRoom);
    rememberDmDisplayName(nextRoom, targetAccount);

    state.currentRoom = nextRoom;
    elements.roomInput.value = "";
    elements.dmInput.value = targetAccount;
    setCurrentConversationName(formatDmTitle(targetAccount));
    markRoomAsRead(nextRoom);
    resetVisibleUnread();
    saveLastRoom(nextRoom);
    renderRooms();
    renderDms();
    showChatView();
    emitJoinRoom(nextRoom);
}

function deleteDm(dm) {
    const targetAccount = normalizeAccountName(dm?.peer);
    const room = cleanText(dm?.room, LIMITS.roomName);

    if (!room || !state.user) return;

    const confirmed = window.confirm(`@${targetAccount} とのDMを一覧から削除しますか？`);

    if (!confirmed) return;

    hideDmRoom(room);
    state.unreadCounts[room] = 0;
    saveUnreadCounts(state.unreadCounts);
    renderDms();

    if (state.currentRoom === room) {
        showRoomMenu("dms");
    }

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
    refreshNotificationStatus();

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
    onEdit: emitEditMessage,
    onReply: startReply
});

const replyThreadPanel = setupReplyThreadPanel({
    onScrollToMessage: (messageId) => {
        const moved = scrollToMessage(messageId);

        if (!moved) {
            window.alert("メッセージが見つかりませんでした");
        }
    }
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

elements.notificationsButton.addEventListener("click", () => {
    togglePushNotifications();
});

elements.attachmentButton.addEventListener("click", (event) => {
    event.stopPropagation();

    if (!state.currentRoom) return;

    setAttachmentMenuOpen(elements.attachmentMenu.hidden);
});

elements.attachmentMenu.addEventListener("click", (event) => {
    event.stopPropagation();
});

elements.photoUploadButton.addEventListener("click", () => {
    elements.photoInput.click();
});

elements.photoInput.addEventListener("change", () => {
    sendPhoto(elements.photoInput.files?.[0]);
});

elements.replyCancelButton.addEventListener("click", () => {
    clearReplyTarget();
    elements.input.focus();
});

window.addEventListener("click", () => {
    setAttachmentMenuOpen(false);
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

    const text = cleanText(elements.input.value, LIMITS.message);

    if (!text) return;

    const message = state.replyTarget
        ? createReplyMessagePayload({
            text,
            replyTo: state.replyTarget
        })
        : text;
    const sent = sendCurrentRoomMessage(message);

    if (sent) {
        typing.resetInput();
        setAttachmentMenuOpen(false);
        clearReplyTarget();
    }
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
    state.currentMessages = data || [];
    resetVisibleUnread();
    renderMessageHistory(data, {
        currentUserId: state.user?.id,
        onOpenMessageActions: messageActions.open,
        onOpenReplyThread: openReplyThread,
        onJumpToReplySource: jumpToReplySource,
        onSwipeReply: startReply
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

    state.currentMessages.push(data);
    appendMessage(data, {
        currentUserId: state.user?.id,
        shouldAutoScroll: state.shouldAutoScroll,
        onOpenMessageActions: messageActions.open,
        onOpenReplyThread: openReplyThread,
        onJumpToReplySource: jumpToReplySource,
        onSwipeReply: startReply,
        onUnread: incrementVisibleUnread
    });
});

socket.on("message edited", (data) => {
    state.currentMessages = state.currentMessages.map((message) =>
        String(message.id) === String(data?.id)
            ? {
                ...message,
                ...data
            }
            : message
    );
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
