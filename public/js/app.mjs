import { SOCKET_OPTIONS, SUPABASE_CONFIG, LIMITS } from "./config.mjs";
import {
    prepareFileAttachment,
    prepareImageAttachment
} from "./attachments.mjs";
import {
    fetchAccountProfile,
    saveAccountProfile
} from "./accountProfile.mjs";
import {
    getAccountKey,
    normalizeAccountName,
    validateAccountName
} from "./accountNames.mjs";
import { setupCannedMessagesPanel } from "./cannedMessages.mjs";
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
    showMessageHistoryLoading,
    showNewMessageButton,
    updateMessage,
    updateMessageReactions,
    updateMessageReadReceipts
} from "./messages.mjs";
import { setupMessageActions } from "./messageActions.mjs";
import { setupMessageReactionPicker } from "./messageReactionPicker.mjs";
import {
    isScreenMessageEffect,
    playScreenEffect,
    setupEffectSendMenu
} from "./messageEffects.mjs";
import {
    createEffectMessagePayload,
    createReplyMessagePayload,
    createReplyTarget,
    parseMessagePayload
} from "./messagePayloads.mjs";
import {
    collectReplyThread,
    setupReplyThreadPanel
} from "./replyThreads.mjs";
import {
    closeRoomNotifications,
    getNotificationEndpoint,
    getNotificationStatus,
    isNotificationSupported,
    setupForegroundNotificationVibration,
    subscribeToNotifications,
    unsubscribeFromNotifications
} from "./notifications.mjs";
import { renderNewMessageList } from "./newMessages.mjs";
import {
    createDmRoom,
    formatDmTitle,
    getDmPeer,
    isDmRoom,
    renderDmList
} from "./dms.mjs";
import { renderRoomList } from "./rooms.mjs";
import {
    loadLastRoom,
    loadDmDisplayNames,
    loadHiddenDmRooms,
    loadNewMessagePreviews,
    loadUnreadCounts,
    loadCannedMessages,
    loadSettings,
    saveDmDisplayNames,
    saveHiddenDmRooms,
    saveNewMessagePreviews,
    saveCannedMessages,
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
import { setupVersionHistoryPage } from "./versionHistory.mjs";
import { APP_VERSION } from "./version.mjs";

const socket = window.io({
    ...SOCKET_OPTIONS,
    autoConnect: false
});
const supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.publishableKey
);

const state = {
    user: null,
    accountProfile: null,
    accessToken: "",
    hasStarted: false,
    isSavingAccountProfile: false,
    currentRoom: "",
    rooms: [],
    roomRecords: [],
    roomDetails: {},
    managedRoom: "",
    managedRoomMembers: [],
    newMessagePreviews: [],
    hiddenDmRooms: loadHiddenDmRooms(),
    dmDisplayNames: loadDmDisplayNames(),
    unreadCounts: loadUnreadCounts(),
    settings: normalizeSettings(loadSettings()),
    currentMessages: [],
    replyTarget: null,
    visibleUnreadCount: 0,
    sentReadReceipts: {},
    shouldAutoScroll: true,
    isSendingImage: false,
    isSendingFile: false,
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
setupForegroundNotificationVibration();

async function refreshAccessToken() {
    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    state.accessToken = session?.access_token || "";
    socket.auth = {
        accessToken: state.accessToken
    };

    return state.accessToken;
}

async function getAccessToken() {
    if (state.accessToken) return state.accessToken;

    return refreshAccessToken();
}

async function connectAuthenticatedSocket() {
    const accessToken = await getAccessToken();

    if (!accessToken || socket.connected) return;

    socket.auth = { accessToken };
    socket.connect();
}

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

function navigateToVersionHistory() {
    window.location.hash = "#/versions";
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

    if (parts[0] === "versions") {
        return {
            view: "versions",
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

    showRoomMenu(
        route.view === "settings" || route.view === "versions"
            ? route.view
            : route.view === "dms"
                ? "dms"
                : "rooms"
    );
}

function cleanText(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
}

function getUserProfile(user = state.user) {
    if (!user) return null;

    const accountName = state.accountProfile?.accountName || "";

    return {
        name: accountName ||
            user.user_metadata?.user_name ||
            user.user_metadata?.preferred_username ||
            user.email ||
            "ユーザー",
        accountName,
        accountKey: state.accountProfile?.accountKey || getAccountKey(accountName),
        avatarUrl: user.user_metadata?.avatar_url || ""
    };
}

function getCurrentAccount() {
    return normalizeAccountName(state.accountProfile?.accountName || "");
}

function getCurrentAccountAliases() {
    return [
        getCurrentAccount(),
        state.accountProfile?.fallbackAccountName
    ].filter(Boolean);
}

function setAccountProfile(profile) {
    state.accountProfile = profile;

    const userProfile = getUserProfile();

    if (userProfile) {
        setUserBar(userProfile);
    }

    renderAccountNameStatus();
}

function renderAccountNameStatus() {
    const accountName = getCurrentAccount();

    elements.accountNameStatus.textContent = accountName
        ? `@${accountName}`
        : "未設定";
}

function setAccountSetupOpen(isOpen, options = {}) {
    const {
        required = false,
        title = required ? "パルチャ名を設定" : "パルチャ名を変更"
    } = options;

    elements.accountSetupModal.hidden = !isOpen;
    elements.accountSetupModal.dataset.required = String(required);
    elements.accountSetupCancelButton.hidden = required;
    elements.accountSetupTitle.textContent = title;
    elements.accountSetupSubmitButton.disabled = false;
    elements.accountSetupError.textContent = "";

    if (!isOpen) return;

    elements.accountSetupInput.value = getCurrentAccount() ||
        state.accountProfile?.fallbackAccountName ||
        "";
    validateAccountSetupInput();
    elements.accountSetupInput.focus();
    elements.accountSetupInput.select();
}

function validateAccountSetupInput() {
    const validation = validateAccountName(elements.accountSetupInput.value);
    const count = Array.from(elements.accountSetupInput.value.trim().replace(/^@+/, "")).length;

    elements.accountSetupHint.textContent = `${count}/20 文字`;

    if (!validation.ok) {
        elements.accountSetupError.textContent = validation.message;
        return null;
    }

    elements.accountSetupError.textContent = "";
    return validation.accountName;
}

async function restartSocketWithFreshProfile() {
    if (!state.user) return;

    await refreshAccessToken();

    if (socket.connected) {
        socket.disconnect();
    }

    await connectAuthenticatedSocket();
}

async function saveAccountSetup() {
    if (state.isSavingAccountProfile) return;

    const accountName = validateAccountSetupInput();

    if (!accountName) return;

    state.isSavingAccountProfile = true;
    elements.accountSetupSubmitButton.disabled = true;

    try {
        const profile = await saveAccountProfile(accountName, await getAccessToken());

        setAccountProfile({
            ...profile,
            needsAccountName: false
        });
        setAccountSetupOpen(false);
        await restartSocketWithFreshProfile();

        if (!state.hasStarted) {
            await startAuthenticatedApp();
        } else {
            renderRooms();
            renderDms();
            refreshNotificationStatus();
        }
    } catch (error) {
        elements.accountSetupError.textContent = error.message || "保存できませんでした";
    } finally {
        state.isSavingAccountProfile = false;
        elements.accountSetupSubmitButton.disabled = false;
    }
}

async function copyCurrentAccountName() {
    const accountName = getCurrentAccount();

    if (!accountName) {
        setAccountSetupOpen(true, { required: true });
        return;
    }

    try {
        await navigator.clipboard.writeText(accountName);
        elements.userBar.classList.add("copied");
        window.setTimeout(() => {
            elements.userBar.classList.remove("copied");
        }, 1100);
    } catch (error) {
        window.prompt("アカウント名をコピーしてください", accountName);
    }
}

function normalizeRoomRecord(room) {
    if (typeof room === "string") {
        return {
            name: cleanText(room, LIMITS.roomName),
            isDm: isDmRoom(room),
            isOwner: false,
            memberCount: 0,
            members: []
        };
    }

    const name = cleanText(room?.name, LIMITS.roomName);

    return {
        name,
        ownerUserId: String(room?.ownerUserId || ""),
        ownerAccountName: cleanText(room?.ownerAccountName || "", 160),
        ownerAccountKey: getAccountKey(room?.ownerAccountKey || ""),
        isDm: room?.isDm === true || isDmRoom(name),
        isOwner: room?.isOwner === true,
        memberCount: Number(room?.memberCount || 0),
        members: Array.isArray(room?.members) ? room.members : []
    };
}

function setRoomRecords(rooms) {
    state.roomRecords = (rooms || [])
        .map(normalizeRoomRecord)
        .filter((room) => room.name);
    state.rooms = state.roomRecords.map((room) => room.name);
    state.roomDetails = Object.fromEntries(
        state.roomRecords.map((room) => [room.name, room])
    );
}

function getRoomRecord(room) {
    return state.roomDetails[room] || normalizeRoomRecord(room);
}

function renderRooms() {
    renderRoomList({
        rooms: state.roomRecords.filter((room) => !room.isDm),
        currentRoom: state.currentRoom,
        unreadCounts: state.unreadCounts,
        showUnreadBadges: state.settings.unreadBadges,
        onManageRoom: openRoomManagement,
        onSelectRoom: joinRoom
    });
}

function renderDms() {
    renderDmList({
        rooms: state.rooms,
        currentAccount: getCurrentAccountAliases(),
        currentRoom: state.currentRoom,
        unreadCounts: state.unreadCounts,
        showUnreadBadges: state.settings.unreadBadges,
        hiddenDmRooms: state.hiddenDmRooms,
        dmDisplayNames: state.dmDisplayNames,
        onSelectDm: joinDm,
        onDeleteDm: deleteDm
    });
}

function formatRoomMemberName(member) {
    const accountName = normalizeAccountName(member?.accountName || member?.account_name || "");
    const userId = String(member?.userId || member?.user_id || "");

    if (accountName) return `@${accountName}`;
    if (userId) return `ユーザー ${userId.slice(0, 8)}`;

    return "メンバー";
}

function renderRoomManagement() {
    const room = state.managedRoom;
    const roomRecord = getRoomRecord(room);
    const isOpen = Boolean(room && roomRecord?.isOwner);

    elements.roomManagementPanel.hidden = !isOpen;

    if (!isOpen) return;

    elements.roomManagementTitle.textContent = room;
    elements.roomRenameInput.value = room;
    elements.roomMemberList.replaceChildren();

    const members = state.managedRoomMembers.length > 0
        ? state.managedRoomMembers
        : roomRecord.members || [];

    if (members.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "まだメンバー情報がありません";
        elements.roomMemberList.appendChild(empty);
        return;
    }

    members.forEach((member) => {
        const item = document.createElement("div");
        item.className = "room-member-item";

        const name = document.createElement("div");
        name.className = "room-member-name";
        name.textContent = formatRoomMemberName(member);

        const role = document.createElement("span");
        role.className = "room-member-role";
        role.textContent = member.role === "owner" ? "部屋主" : "メンバー";
        name.appendChild(role);
        item.appendChild(name);

        if (member.role !== "owner") {
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "room-member-remove-btn";
            removeButton.textContent = "削除";
            removeButton.addEventListener("click", () => {
                socket.emit("remove room member", {
                    room,
                    memberKey: member.memberKey || member.member_key
                });
            });
            item.appendChild(removeButton);
        }

        elements.roomMemberList.appendChild(item);
    });
}

function openRoomManagement(room) {
    const roomName = cleanText(room, LIMITS.roomName);
    const roomRecord = getRoomRecord(roomName);

    if (!roomName || !roomRecord.isOwner) return;

    state.managedRoom = roomName;
    state.managedRoomMembers = roomRecord.members || [];
    renderRoomManagement();
    socket.emit("request room members", {
        room: roomName
    });
}

function closeRoomManagement() {
    state.managedRoom = "";
    state.managedRoomMembers = [];
    renderRoomManagement();
}

function refreshManagedRoomAfterListUpdate() {
    if (!state.managedRoom) return;

    const roomRecord = getRoomRecord(state.managedRoom);

    if (!roomRecord?.isOwner) {
        closeRoomManagement();
        return;
    }

    renderRoomManagement();
}

function normalizeNewMessagePreview(entry) {
    const room = cleanText(entry?.room, LIMITS.roomName);
    const id = String(entry?.id || `${room}:${Date.now()}`);

    if (!room) return null;

    return {
        id,
        room,
        userId: String(entry?.userId || ""),
        name: cleanText(entry?.name, 160) || "ユーザー",
        accountName: normalizeAccountName(entry?.accountName || ""),
        preview: cleanText(entry?.preview, 160) || "メッセージ",
        createdAt: entry?.createdAt || new Date().toISOString()
    };
}

function getNewMessageStorageKey() {
    return getCurrentAccount() || state.user?.id || "default";
}

function saveNewMessages() {
    saveNewMessagePreviews(getNewMessageStorageKey(), state.newMessagePreviews);
}

function getNewMessagePeer(entry) {
    return entry.accountName ||
        state.dmDisplayNames[entry.room] ||
        getDmPeer(entry.room, getCurrentAccountAliases()) ||
        normalizeAccountName(entry.name);
}

function formatNewMessageSource(entry) {
    if (isDmRoom(entry.room)) {
        const peer = getNewMessagePeer(entry);

        return peer ? `DM @${peer}` : "DM";
    }

    return `# ${entry.room}`;
}

function renderNewMessages() {
    renderNewMessageList({
        entries: state.newMessagePreviews,
        formatSource: formatNewMessageSource,
        onOpen: openNewMessage
    });
}

function clearNewMessages() {
    state.newMessagePreviews = [];
    saveNewMessages();
    renderNewMessages();
}

function removeNewMessagesForRoom(room) {
    if (!room || state.newMessagePreviews.length === 0) return;

    const nextPreviews = state.newMessagePreviews.filter((entry) => entry.room !== room);

    if (nextPreviews.length === state.newMessagePreviews.length) return;

    state.newMessagePreviews = nextPreviews;
    saveNewMessages();
    renderNewMessages();
}

function addNewMessagePreview(entry) {
    const normalized = normalizeNewMessagePreview(entry);

    if (!normalized || normalized.room === state.currentRoom) return;
    if (normalized.userId && normalized.userId === state.user?.id) return;

    if (isDmRoom(normalized.room)) {
        const peer = getNewMessagePeer(normalized);

        if (!peer) return;

        showDmRoom(normalized.room);
        rememberDmDisplayName(normalized.room, peer);
    }

    state.newMessagePreviews = [
        normalized,
        ...state.newMessagePreviews.filter((message) =>
            message.room !== normalized.room || message.id !== normalized.id
        )
    ].slice(0, 8);
    saveNewMessages();
    renderNewMessages();
}

function openNewMessage(entry) {
    if (!entry?.room) return;

    if (isDmRoom(entry.room)) {
        const peer = getNewMessagePeer(entry);

        if (!peer) return;

        joinDm({ peer, room: entry.room });
        return;
    }

    joinRoom(entry.room);
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

function normalizeReceipt(receipt) {
    const userId = String(receipt?.userId || receipt?.user_id || "").trim();
    const lastReadMessageId = Number.parseInt(
        String(receipt?.lastReadMessageId || receipt?.last_read_message_id || 0),
        10
    );

    if (!userId || !Number.isFinite(lastReadMessageId) || lastReadMessageId <= 0) {
        return null;
    }

    return {
        userId,
        lastReadMessageId
    };
}

function getMessageId(message) {
    const id = Number.parseInt(String(message?.id || ""), 10);

    return Number.isFinite(id) && id > 0 ? id : 0;
}

function getLatestMessageId(messages = state.currentMessages) {
    return (messages || []).reduce((latestId, message) =>
        Math.max(latestId, getMessageId(message)), 0);
}

function countReadsForMessage(message, receipts) {
    const messageId = getMessageId(message);

    if (!messageId) return 0;

    return receipts.filter((receipt) =>
        receipt.userId !== message.userId &&
        receipt.lastReadMessageId >= messageId
    ).length;
}

function applyReadReceipts(receipts) {
    const normalizedReceipts = (receipts || [])
        .map(normalizeReceipt)
        .filter(Boolean);

    state.currentMessages = state.currentMessages.map((message) => ({
        ...message,
        readCount: countReadsForMessage(message, normalizedReceipts)
    }));

    updateMessageReadReceipts(state.currentMessages, {
        currentUserId: state.user?.id,
        isDm: isDmRoom(state.currentRoom)
    });
}

function emitReadReceiptForLatestMessage() {
    if (!state.currentRoom || !state.user || document.visibilityState !== "visible") return;

    const lastReadMessageId = getLatestMessageId();

    if (!lastReadMessageId) return;

    const previousReadMessageId = state.sentReadReceipts[state.currentRoom] || 0;

    if (previousReadMessageId >= lastReadMessageId) return;

    state.sentReadReceipts[state.currentRoom] = lastReadMessageId;
    socket.emit("read messages", {
        room: state.currentRoom,
        userId: state.user.id,
        lastReadMessageId
    });
}

function markRoomAsRead(room) {
    if (!room) return;

    closeRoomNotifications(room).catch((error) => {
        console.warn("close room notifications failed", error);
    });

    state.unreadCounts[room] = 0;
    saveUnreadCounts(state.unreadCounts);
    removeNewMessagesForRoom(room);
    renderRooms();
    renderDms();
}

function incrementUnread(room) {
    if (!room || room === state.currentRoom) return;
    if (isDmRoom(room)) {
        if (!getDmPeer(room, getCurrentAccountAliases()) && !state.dmDisplayNames[room]) return;
        showDmRoom(room);
    }

    state.unreadCounts[room] = (state.unreadCounts[room] || 0) + 1;
    saveUnreadCounts(state.unreadCounts);
    renderRooms();
    renderDms();
}

async function syncNotificationPresence() {
    if (!state.user) return;

    const endpoint = await getNotificationEndpoint().catch(() => "");

    socket.emit("notification presence", {
        userId: state.user.id,
        endpoint,
        room: state.currentRoom,
        visible: document.visibilityState === "visible"
    });
}

function vibrateForForegroundMessage(room) {
    if (!room || room === state.currentRoom) return;
    if (!state.settings.pushNotifications) return;
    if (document.visibilityState !== "visible") return;

    navigator.vibrate?.([80, 45, 80]);
}

function resetVisibleUnread() {
    state.visibleUnreadCount = 0;
    hideNewMessageButton();
}

function incrementVisibleUnread() {
    state.visibleUnreadCount += 1;
    showNewMessageButton(state.visibleUnreadCount);
}

function prepareConversationLoading() {
    hideTypingIndicator();
    clearReplyTarget();
    replyThreadPanel.close();
    reactionPicker.close();
    state.currentMessages = [];
    showMessageHistoryLoading();
}

function setAttachmentMenuOpen(isOpen) {
    elements.attachmentMenu.hidden = !isOpen;
    elements.attachmentButton.setAttribute("aria-expanded", String(isOpen));
}

function getComposerText() {
    return cleanText(elements.input.value, LIMITS.message);
}

function createTextMessage(text) {
    return state.replyTarget
        ? createReplyMessagePayload({
            text,
            replyTo: state.replyTarget
        })
        : text;
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

function openReactionPicker(message) {
    reactionPicker.open(message);
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

function sendTextMessage(text) {
    const cleanMessage = cleanText(text, LIMITS.message);

    if (!cleanMessage) return false;

    const sent = sendCurrentRoomMessage(createTextMessage(cleanMessage));

    if (sent) {
        typing.resetInput();
        setAttachmentMenuOpen(false);
        cannedMessagesPanel.close();
        effectSendMenu.close();
        clearReplyTarget();
    }

    return sent;
}

function sendTextWithEffect(effect) {
    const text = getComposerText();

    if (!text) return;

    const sent = sendCurrentRoomMessage(createEffectMessagePayload({
        text,
        effect
    }));

    if (sent) {
        typing.resetInput();
        setAttachmentMenuOpen(false);
        effectSendMenu.close();
        clearReplyTarget();
    }
}

async function sendPhoto(file) {
    if (state.isSendingImage) return;

    state.isSendingImage = true;
    elements.attachmentButton.disabled = true;
    elements.photoUploadButton.disabled = true;
    elements.fileUploadButton.disabled = true;

    try {
        const payload = await prepareImageAttachment(file, LIMITS.imageMessage);
        sendCurrentRoomMessage(payload);
        setAttachmentMenuOpen(false);
        effectSendMenu.close();
    } catch (error) {
        window.alert(error.message || "写真を送信できませんでした");
    } finally {
        state.isSendingImage = false;
        elements.attachmentButton.disabled = false;
        elements.photoUploadButton.disabled = false;
        elements.fileUploadButton.disabled = false;
        elements.photoInput.value = "";
    }
}

async function sendFile(file) {
    if (state.isSendingFile) return;

    state.isSendingFile = true;
    elements.attachmentButton.disabled = true;
    elements.photoUploadButton.disabled = true;
    elements.fileUploadButton.disabled = true;

    try {
        const payload = await prepareFileAttachment(file, LIMITS.fileMessage);
        sendCurrentRoomMessage(payload);
        setAttachmentMenuOpen(false);
        effectSendMenu.close();
    } catch (error) {
        window.alert(error.message || "ファイルを送信できませんでした");
    } finally {
        state.isSendingFile = false;
        elements.attachmentButton.disabled = false;
        elements.photoUploadButton.disabled = false;
        elements.fileUploadButton.disabled = false;
        elements.fileInput.value = "";
    }
}

function emitJoinRoom(room) {
    const profile = getUserProfile();

    if (!profile) return;

    socket.emit("join room", {
        room,
        userId: state.user.id,
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

function emitDeleteMessage(message) {
    const profile = getUserProfile();

    if (
        !message?.id ||
        !state.currentRoom ||
        !state.user ||
        !profile ||
        message.userId !== state.user.id
    ) {
        return;
    }

    const confirmed = window.confirm("このメッセージを削除しますか？");

    if (!confirmed) return;

    socket.emit("delete message", {
        id: message.id,
        room: state.currentRoom,
        userId: state.user.id,
        name: profile.name
    });
}

function emitMessageReaction(message, emoji) {
    if (!message?.id || !state.currentRoom || !state.user || !emoji) return;

    socket.emit("message reaction", {
        room: state.currentRoom,
        messageId: message.id,
        userId: state.user.id,
        emoji
    });
}

function showRoomMenu(panel = "rooms") {
    const previousRoom = state.currentRoom;

    typing.stopTyping();
    setAttachmentMenuOpen(false);
    cannedMessagesPanel.close();
    effectSendMenu.close();
    reactionPicker.close();
    clearReplyTarget();
    state.currentMessages = [];
    state.currentRoom = "";
    elements.roomInput.value = "";
    elements.dmInput.value = "";
    setCurrentRoomName("");
    resetVisibleUnread();
    renderRooms();
    renderDms();
    if (panel !== "rooms") {
        closeRoomManagement();
    }
    showMenuPanel(panel);
    showRoomsView();

    if (panel === "settings") {
        refreshNotificationStatus();
    }

    if (panel === "versions") {
        versionHistoryPage.open();
    }

    if (previousRoom) {
        socket.emit("leave room", {
            room: previousRoom
        });
    }

    syncNotificationPresence();
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
    syncNotificationPresence();
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
            await unsubscribeFromNotifications(await getAccessToken());
            syncNotificationSetting(false);
        } else {
            await subscribeToNotifications(
                state.user?.id,
                getCurrentAccount(),
                await getAccessToken()
            );
            syncNotificationSetting(true);
        }

        await refreshNotificationStatus();
        syncNotificationPresence();
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
    setAttachmentMenuOpen(false);
    cannedMessagesPanel.close();
    effectSendMenu.close();

    state.currentRoom = room;
    elements.roomInput.value = room;
    elements.dmInput.value = "";
    setCurrentRoomName(room);
    prepareConversationLoading();
    markRoomAsRead(room);
    resetVisibleUnread();
    saveLastRoom(room);
    renderRooms();
    renderDms();
    showChatView();
    emitJoinRoom(room);
    syncNotificationPresence();
}

function joinDm(value, options = {}) {
    const { updateRoute = true } = options;
    const currentAccount = getCurrentAccount();
    const targetValidation = validateAccountName(value?.peer || value);
    const existingRoom = cleanText(value?.room, LIMITS.roomName);
    const targetAccount = targetValidation.accountName || "";
    const room = createDmRoom(currentAccount, targetAccount);
    const nextRoom = existingRoom || room;

    if (!state.user) return;

    if (!currentAccount) {
        setAccountSetupOpen(true, { required: true });
        return;
    }

    if (!targetValidation.ok) {
        window.alert(targetValidation.message);
        return;
    }

    if (!nextRoom) return;

    if (updateRoute) {
        navigateToDm(targetAccount);
        return;
    }

    typing.stopTyping();
    setAttachmentMenuOpen(false);
    cannedMessagesPanel.close();
    effectSendMenu.close();

    showDmRoom(nextRoom);
    rememberDmDisplayName(nextRoom, targetAccount);

    state.currentRoom = nextRoom;
    elements.roomInput.value = "";
    elements.dmInput.value = targetAccount;
    setCurrentConversationName(formatDmTitle(targetAccount));
    prepareConversationLoading();
    markRoomAsRead(nextRoom);
    resetVisibleUnread();
    saveLastRoom(nextRoom);
    renderRooms();
    renderDms();
    showChatView();
    emitJoinRoom(nextRoom);
    syncNotificationPresence();
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

async function startAuthenticatedApp() {
    if (state.hasStarted) return;

    state.hasStarted = true;
    state.newMessagePreviews = (loadNewMessagePreviews(getNewMessageStorageKey()) || [])
        .map(normalizeNewMessagePreview)
        .filter(Boolean)
        .slice(0, 8);
    renderNewMessages();
    refreshNotificationStatus();
    await connectAuthenticatedSocket();

    const savedRoom = cleanText(loadLastRoom(), LIMITS.roomName);

    if (!window.location.hash && savedRoom) {
        navigateToRooms();
    }

    syncRoute();
    syncNotificationPresence();
}

async function checkUser() {
    await refreshAccessToken();

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

    try {
        setAccountProfile(await fetchAccountProfile(await getAccessToken()));
    } catch (profileError) {
        console.warn("profile error", profileError);
        setAccountProfile({
            accountName: "",
            accountKey: "",
            displayName: getUserProfile()?.name || "ユーザー",
            avatarUrl: getUserProfile()?.avatarUrl || "",
            fallbackAccountName: "",
            needsAccountName: true
        });
    }

    setLoading(false);

    if (state.accountProfile?.needsAccountName) {
        setAccountSetupOpen(true, { required: true });
        return;
    }

    await startAuthenticatedApp();
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
    onDelete: emitDeleteMessage,
    onEdit: emitEditMessage,
    onReact: openReactionPicker,
    onReply: startReply
});

const reactionPicker = setupMessageReactionPicker({
    getCurrentUserId: () => state.user?.id || "",
    onSelect: emitMessageReaction
});

const effectSendMenu = setupEffectSendMenu({
    elements,
    canOpen: () => Boolean(state.currentRoom && state.user),
    getText: getComposerText,
    onSelectEffect: sendTextWithEffect,
    onOpenChange: (isOpen) => {
        if (isOpen) {
            setAttachmentMenuOpen(false);
            cannedMessagesPanel.close();
        }
    }
});

const cannedMessagesPanel = setupCannedMessagesPanel({
    elements,
    getAccountKey: getCurrentAccount,
    loadMessages: loadCannedMessages,
    saveMessages: saveCannedMessages,
    onSend: sendTextMessage,
    onOpenChange: (isOpen) => {
        if (isOpen) {
            setAttachmentMenuOpen(false);
            effectSendMenu.close();
        }
    }
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

const versionHistoryPage = setupVersionHistoryPage({
    elements,
    getAccessToken
});

elements.accountSetupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveAccountSetup();
});

elements.accountSetupCancelButton.addEventListener("click", () => {
    if (elements.accountSetupModal.dataset.required === "true") return;

    setAccountSetupOpen(false);
});

elements.accountSetupInput.addEventListener("input", validateAccountSetupInput);

elements.accountNameChangeButton.addEventListener("click", () => {
    setAccountSetupOpen(true, {
        required: false,
        title: "パルチャ名を変更"
    });
});

elements.userBar.addEventListener("click", copyCurrentAccountName);

elements.userBar.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    copyCurrentAccountName();
});

elements.messages.addEventListener("scroll", () => {
    state.shouldAutoScroll = isNearBottom();

    if (state.shouldAutoScroll) {
        resetVisibleUnread();
        emitReadReceiptForLatestMessage();
    }
});

elements.newMessageButton.addEventListener("click", () => {
    scrollMessagesToBottom();
    resetVisibleUnread();
    emitReadReceiptForLatestMessage();
});

elements.roomForm.addEventListener("submit", (event) => {
    event.preventDefault();
    joinRoom(elements.roomInput.value);
});

elements.roomManagementCloseButton.addEventListener("click", closeRoomManagement);

elements.roomRenameForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const room = state.managedRoom;
    const nextName = cleanText(elements.roomRenameInput.value, LIMITS.roomName);

    if (!room || !nextName || room === nextName) return;

    socket.emit("rename room", {
        room,
        nextName
    });
});

elements.roomMemberForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const room = state.managedRoom;
    const validation = validateAccountName(elements.roomMemberInput.value);
    const accountName = validation.accountName || "";

    if (!room) return;

    if (!validation.ok) {
        window.alert(validation.message);
        return;
    }

    socket.emit("add room member", {
        room,
        accountName
    });
    elements.roomMemberInput.value = "";
});

elements.roomDeleteButton.addEventListener("click", () => {
    const room = state.managedRoom;

    if (!room) return;

    const confirmed = window.confirm(`部屋「${room}」を削除しますか？メッセージも削除されます。`);

    if (!confirmed) return;

    socket.emit("delete room", {
        room
    });
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

elements.versionHistoryButton.addEventListener("click", () => {
    navigateToVersionHistory();
});

elements.versionHistoryBackButton.addEventListener("click", () => {
    navigateToSettings();
});

elements.notificationsButton.addEventListener("click", () => {
    togglePushNotifications();
});

elements.newMessageClearButton.addEventListener("click", clearNewMessages);

elements.attachmentButton.addEventListener("click", (event) => {
    event.stopPropagation();

    if (!state.currentRoom) return;

    cannedMessagesPanel.close();
    effectSendMenu.close();
    setAttachmentMenuOpen(elements.attachmentMenu.hidden);
});

elements.attachmentMenu.addEventListener("click", (event) => {
    event.stopPropagation();
});

elements.photoUploadButton.addEventListener("click", () => {
    elements.photoInput.click();
});

elements.fileUploadButton.addEventListener("click", () => {
    elements.fileInput.click();
});

elements.photoInput.addEventListener("change", () => {
    sendPhoto(elements.photoInput.files?.[0]);
});

elements.fileInput.addEventListener("change", () => {
    sendFile(elements.fileInput.files?.[0]);
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

    const text = getComposerText();

    sendTextMessage(text);
});

socket.on("connect", () => {
    if (state.currentRoom && state.user) {
        emitJoinRoom(state.currentRoom);
    }

    syncNotificationPresence();
});

socket.on("disconnect", () => {
    hideTypingIndicator();
});

socket.on("connect_error", async (error) => {
    if (!/auth/i.test(error?.message || "")) return;

    await refreshAccessToken();

    if (state.accessToken && state.user && !socket.connected) {
        socket.connect();
    }
});

socket.on("message history", (data) => {
    state.currentMessages = data || [];
    resetVisibleUnread();
    renderMessageHistory(data, {
        currentUserId: state.user?.id,
        isDm: isDmRoom(state.currentRoom),
        onOpenMessageActions: messageActions.open,
        onOpenReactionPicker: openReactionPicker,
        onOpenReplyThread: openReplyThread,
        onJumpToReplySource: jumpToReplySource,
        onSwipeReply: startReply
    });
    emitReadReceiptForLatestMessage();
});

socket.on("room list", (rooms) => {
    setRoomRecords(rooms);
    renderRooms();
    renderDms();
    refreshManagedRoomAfterListUpdate();

    if (state.currentRoom && !state.rooms.includes(state.currentRoom)) {
        showRoomMenu(isDmRoom(state.currentRoom) ? "dms" : "rooms");
    }
});

socket.on("room members", (data) => {
    if (data?.room !== state.managedRoom) return;

    state.managedRoomMembers = Array.isArray(data.members) ? data.members : [];
    renderRoomManagement();
});

socket.on("room renamed", (data) => {
    const room = cleanText(data?.room, LIMITS.roomName);
    const nextRoom = cleanText(data?.nextRoom, LIMITS.roomName);

    if (!room || !nextRoom) return;

    if (state.currentRoom === room) {
        state.currentRoom = nextRoom;
        elements.roomInput.value = nextRoom;
        setCurrentRoomName(nextRoom);
        saveLastRoom(nextRoom);
        window.history.replaceState(null, "", `#/rooms/${encodeRoomRoute(nextRoom)}`);
    }

    if (state.managedRoom === room) {
        state.managedRoom = nextRoom;
        renderRoomManagement();
        socket.emit("request room members", {
            room: nextRoom
        });
    }
});

function returnToRoomsAfterRoomClosed(room) {
    if (state.currentRoom === room) {
        showRoomMenu("rooms");
    }

    if (state.managedRoom === room) {
        closeRoomManagement();
    }
}

socket.on("room deleted", (data) => {
    returnToRoomsAfterRoomClosed(cleanText(data?.room, LIMITS.roomName));
});

socket.on("room access removed", (data) => {
    returnToRoomsAfterRoomClosed(cleanText(data?.room, LIMITS.roomName));
});

socket.on("room access denied", (data) => {
    returnToRoomsAfterRoomClosed(cleanText(data?.room, LIMITS.roomName));
});

socket.on("chat message", (data) => {
    if (data?.room && data.room !== state.currentRoom) return;

    const payload = parseMessagePayload(data?.message);

    state.currentMessages.push(data);
    appendMessage(data, {
        currentUserId: state.user?.id,
        isDm: isDmRoom(state.currentRoom),
        shouldAutoScroll: state.shouldAutoScroll,
        onOpenMessageActions: messageActions.open,
        onOpenReactionPicker: openReactionPicker,
        onOpenReplyThread: openReplyThread,
        onJumpToReplySource: jumpToReplySource,
        onSwipeReply: startReply,
        onUnread: incrementVisibleUnread
    });

    if (payload.type === "effect" && isScreenMessageEffect(payload.effect)) {
        playScreenEffect(payload.effect, payload.text);
    }

    if (state.shouldAutoScroll) {
        emitReadReceiptForLatestMessage();
    }
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
    updateMessage(data, {
        currentUserId: state.user?.id,
        isDm: isDmRoom(state.currentRoom),
        onOpenReactionPicker: openReactionPicker
    });
});

socket.on("message deleted", (data) => {
    state.currentMessages = state.currentMessages.map((message) =>
        String(message.id) === String(data?.id)
            ? {
                ...message,
                ...data
            }
            : message
    );
    updateMessage(data, {
        currentUserId: state.user?.id,
        isDm: isDmRoom(state.currentRoom),
        onOpenReactionPicker: openReactionPicker
    });
});

socket.on("message reactions", (data) => {
    if (data?.room !== state.currentRoom || !data?.messageId) return;

    state.currentMessages = state.currentMessages.map((message) =>
        String(message.id) === String(data.messageId)
            ? {
                ...message,
                reactions: data.reactions || []
            }
            : message
    );
    updateMessageReactions(state.currentMessages, {
        currentUserId: state.user?.id,
        onOpenReactionPicker: openReactionPicker
    });
});

socket.on("read receipts", (data) => {
    if (data?.room !== state.currentRoom) return;

    applyReadReceipts(data.receipts);
});

socket.on("new message notification", (data) => {
    vibrateForForegroundMessage(data?.room);
    addNewMessagePreview(data);
    incrementUnread(data?.room);
});

socket.on("typing", showTypingIndicator);
socket.on("stop typing", hideTypingIndicator);

socket.on("server error", (data) => {
    console.warn(data?.message || "server error");
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
    state.accessToken = session?.access_token || "";
    socket.auth = {
        accessToken: state.accessToken
    };
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

document.addEventListener("visibilitychange", () => {
    syncNotificationPresence();

    if (document.visibilityState === "visible" && isNearBottom()) {
        emitReadReceiptForLatestMessage();
    }
});
