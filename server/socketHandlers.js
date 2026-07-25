const {
    getAccountKey
} = require("./accountNames");

const LEGACY_DM_KEY_LENGTH = 12;

function createTextCleaner(maxLength) {
    return function cleanText(value) {
        return String(value || "").trim().slice(0, maxLength);
    };
}

function cleanMessageId(value) {
    const id = String(value || "").trim();

    return id && id.length <= 80 ? id : null;
}

function cleanUserId(value) {
    return String(value || "").trim().slice(0, 160);
}

function cleanLastReadMessageId(value) {
    const id = Number.parseInt(String(value || ""), 10);

    return Number.isFinite(id) && id > 0 ? id : 0;
}

function logSocketError(action, error) {
    console.error(`[socket:${action}]`, error);
}

function isDmRoom(room) {
    return String(room || "").startsWith("dm:");
}

function parseDmRoom(room) {
    if (!isDmRoom(room)) return [];

    const parts = String(room)
        .slice(3)
        .split(":")
        .map(getAccountKey)
        .filter(Boolean);

    return parts.length >= 3 ? parts.slice(1, 3) : parts;
}

function accountKeyMatchesDmSegment(segment, userKey) {
    const segmentKey = getAccountKey(segment);
    const accountKey = getAccountKey(userKey);

    if (!segmentKey || !accountKey) return false;
    if (segmentKey === accountKey) return true;

    return segmentKey.length <= LEGACY_DM_KEY_LENGTH &&
        accountKey.startsWith(segmentKey);
}

function getUserAccountKeys(user) {
    return [
        user?.accountKey,
        ...(Array.isArray(user?.accountKeys) ? user.accountKeys : []),
        user?.accountName
    ].map(getAccountKey).filter(Boolean);
}

function canAccessDmRoom(user, room) {
    if (!isDmRoom(room)) return false;
    const users = parseDmRoom(room);

    return users.length === 2 &&
        users.some((accountName) =>
            getUserAccountKeys(user).some((userKey) =>
                accountKeyMatchesDmSegment(accountName, userKey)
            )
        );
}

function getSocketProfile(socket) {
    const user = socket.authUser || {};

    return {
        userId: cleanUserId(user.id),
        accountKey: getAccountKey(user.accountKey || user.accountName),
        name: cleanRoomNameFallback(user.name),
        avatarUrl: String(user.avatarUrl || "").trim()
    };
}

function cleanRoomNameFallback(value) {
    return String(value || "").trim().slice(0, 160) || "ユーザー";
}

function createDeletedMessagePayload(deletedBy) {
    return JSON.stringify({
        type: "paruky:deleted:v1",
        deletedBy,
        deletedAt: new Date().toISOString()
    });
}

function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function truncate(value, maxLength) {
    const text = compactText(value);

    if (text.length <= maxLength) return text;

    return `${text.slice(0, maxLength)}...`;
}

function parseMessagePayload(message) {
    try {
        return JSON.parse(String(message || ""));
    } catch (error) {
        return {
            type: "text",
            text: String(message || "")
        };
    }
}

function createMessagePreview(message) {
    const payload = parseMessagePayload(message?.message);

    if (payload.type === "paruky:image:v1") {
        return "写真を送信しました";
    }

    if (payload.type === "paruky:file:v1") {
        return truncate(`ファイルを送信しました: ${payload.name || "file"}`, 120);
    }

    if (payload.type === "paruky:reply:v1") {
        return truncate(payload.text || "返信", 120);
    }

    if (payload.type === "paruky:effect:v1") {
        return truncate(payload.text || "エフェクト", 120);
    }

    return truncate(payload.text || message?.message || "メッセージ", 120);
}

function createNewMessageNotification(message, senderUser = {}) {
    return {
        id: message.id,
        room: message.room || "",
        userId: message.userId || "",
        name: compactText(message.name) || "ユーザー",
        accountName: senderUser.accountName || senderUser.accountKey || "",
        preview: createMessagePreview(message),
        createdAt: message.created_at || new Date().toISOString()
    };
}

function getMessageReadCount(message, receipts) {
    const messageId = cleanLastReadMessageId(message?.id);

    if (!messageId) return 0;

    return receipts.filter((receipt) =>
        receipt.userId !== message.userId &&
        receipt.lastReadMessageId >= messageId
    ).length;
}

function attachReadCounts(messages, receipts) {
    return (messages || []).map((message) => ({
        ...message,
        readCount: getMessageReadCount(message, receipts)
    }));
}

function createReactionSummary(reactions) {
    const grouped = new Map();

    (reactions || []).forEach((reaction) => {
        if (!reaction?.emoji || !reaction?.userId) return;

        const summary = grouped.get(reaction.emoji) || {
            emoji: reaction.emoji,
            count: 0,
            userIds: []
        };

        if (!summary.userIds.includes(reaction.userId)) {
            summary.userIds.push(reaction.userId);
            summary.count = summary.userIds.length;
        }

        grouped.set(reaction.emoji, summary);
    });

    return [...grouped.values()]
        .sort((left, right) =>
            right.count - left.count ||
            left.emoji.localeCompare(right.emoji)
        );
}

function getMessageReactions(message, reactions) {
    const messageId = cleanLastReadMessageId(message?.id);

    if (!messageId) return [];

    return createReactionSummary(
        reactions.filter((reaction) => reaction.messageId === messageId)
    );
}

function attachReactions(messages, reactions) {
    return (messages || []).map((message) => ({
        ...message,
        reactions: getMessageReactions(message, reactions)
    }));
}

function registerSocketHandlers(io, dependencies) {
    const {
        roomsRepository,
        messagesRepository,
        messageReactionsRepository,
        readReceiptsRepository,
        notificationPresence,
        pushNotifications,
        maxRoomNameLength,
        maxMessageLength
    } = dependencies;

    const cleanRoomName = createTextCleaner(maxRoomNameLength);
    const cleanMessage = createTextCleaner(maxMessageLength);

    async function canAccessChatRoom(user, room) {
        if (!room || !user) return false;
        if (isDmRoom(room)) return canAccessDmRoom(user, room);

        return roomsRepository.canUserAccessRoom(room, user);
    }

    async function emitRoomList(target) {
        if (target?.authUser) {
            const rooms = await roomsRepository.listRoomsForUser(target.authUser);
            target.emit("room list", rooms);
            return;
        }

        await Promise.all([...io.sockets.sockets.values()].map(async (targetSocket) => {
            if (!targetSocket.authUser) return;

            const rooms = await roomsRepository.listRoomsForUser(targetSocket.authUser);
            targetSocket.emit("room list", rooms);
        }));
    }

    async function listMessagesWithState(room) {
        const [rows, receipts, reactions] = await Promise.all([
            messagesRepository.listMessages(room),
            readReceiptsRepository.listReadReceipts(room),
            messageReactionsRepository.listReactions(room)
        ]);

        return attachReactions(attachReadCounts(rows, receipts), reactions);
    }

    async function emitReadReceipts(room) {
        const receipts = await readReceiptsRepository.listReadReceipts(room);

        io.to(room).emit("read receipts", {
            room,
            receipts
        });
    }

    async function emitMessageReactions(room, messageId) {
        const reactions = await messageReactionsRepository.listReactions(room);

        io.to(room).emit("message reactions", {
            room,
            messageId,
            reactions: createReactionSummary(
                reactions.filter((reaction) => reaction.messageId === messageId)
            )
        });
    }

    async function emitNewMessageNotification(message, senderSocketId) {
        const senderSocket = io.sockets.sockets.get(senderSocketId);
        const payload = createNewMessageNotification(message, senderSocket?.authUser);

        await Promise.all([...io.sockets.sockets.values()].map(async (targetSocket) => {
            if (targetSocket.id === senderSocketId) return;
            if (targetSocket.authUser?.id === message.userId) return;
            if (!await canAccessChatRoom(targetSocket.authUser, message.room)) return;

            targetSocket.emit("new message notification", payload);
        }));
    }

    function moveSocketsToRenamedRoom(room, nextRoom) {
        io.sockets.sockets.forEach((targetSocket) => {
            if (targetSocket.currentRoom !== room) return;

            targetSocket.leave(room);
            targetSocket.join(nextRoom);
            targetSocket.currentRoom = nextRoom;
            targetSocket.emit("room renamed", {
                room,
                nextRoom
            });
        });
    }

    function closeSocketsForRoom(room, eventName = "room deleted") {
        io.sockets.sockets.forEach((targetSocket) => {
            if (targetSocket.currentRoom !== room) return;

            targetSocket.leave(room);
            targetSocket.currentRoom = "";
            targetSocket.emit(eventName, {
                room
            });
        });
    }

    async function refreshRoomAccess(room) {
        await Promise.all([...io.sockets.sockets.values()].map(async (targetSocket) => {
            if (targetSocket.currentRoom !== room) return;
            if (await canAccessChatRoom(targetSocket.authUser, room)) return;

            targetSocket.leave(room);
            targetSocket.currentRoom = "";
            targetSocket.emit("room access removed", {
                room
            });
        }));
    }

    function emitServerError(socket, error, fallbackMessage) {
        socket.emit("server error", {
            message: error?.message || fallbackMessage
        });
    }

    io.on("connection", async (socket) => {
        try {
            await emitRoomList(socket);
        } catch (error) {
            logSocketError("room-list", error);
        }

        socket.on("join room", async (data = {}) => {
            const room = cleanRoomName(data.room);
            const userId = cleanUserId(socket.authUser?.id);

            if (!room || !userId) return;

            try {
                const joinedRoom = await roomsRepository.ensureRoomForJoin(room, socket.authUser);

                if (!joinedRoom) {
                    const message = isDmRoom(room)
                        ? "このDMには入れません"
                        : "この部屋には招待されていません";

                    socket.emit("room access denied", {
                        room,
                        message
                    });
                    socket.emit("server error", {
                        message
                    });
                    return;
                }

                if (socket.currentRoom) {
                    socket.leave(socket.currentRoom);
                }

                socket.join(room);
                socket.currentRoom = room;
                socket.currentUserId = userId;

                const rows = await listMessagesWithState(room);
                socket.emit("message history", rows);

                await emitRoomList();
            } catch (error) {
                logSocketError("join-room", error);
                emitServerError(socket, error, "部屋に参加できませんでした");
            }
        });

        socket.on("leave room", (data = {}) => {
            const room = cleanRoomName(data.room);

            if (!room) return;

            socket.leave(room);

            if (socket.currentRoom === room) {
                socket.currentRoom = "";
            }
        });

        socket.on("notification presence", (data = {}) => {
            notificationPresence?.update(socket.id, {
                userId: socket.authUser?.id || "",
                endpoint: data.endpoint,
                room: cleanRoomName(data.room),
                visible: data.visible === true
            });
        });

        socket.on("read messages", async (data = {}) => {
            const room = cleanRoomName(data.room);
            const userId = cleanUserId(socket.authUser?.id);
            const lastReadMessageId = cleanLastReadMessageId(data.lastReadMessageId);

            if (
                !room ||
                !userId ||
                !lastReadMessageId ||
                socket.currentRoom !== room
            ) {
                return;
            }

            try {
                await readReceiptsRepository.saveReadReceipt({
                    room,
                    userId,
                    lastReadMessageId
                });
                await emitReadReceipts(room);
            } catch (error) {
                logSocketError("read-messages", error);
            }
        });

        socket.on("message reaction", async (data = {}) => {
            const room = cleanRoomName(data.room);
            const messageId = cleanLastReadMessageId(data.messageId);
            const userId = cleanUserId(socket.authUser?.id);
            const emoji = String(data.emoji || "").trim();

            if (
                !room ||
                !messageId ||
                !userId ||
                !emoji ||
                socket.currentRoom !== room
            ) {
                return;
            }

            try {
                const result = await messageReactionsRepository.toggleReaction({
                    room,
                    messageId,
                    userId,
                    emoji
                });

                if (!result) return;

                await emitMessageReactions(room, messageId);
            } catch (error) {
                logSocketError("message-reaction", error);
            }
        });

        socket.on("delete dm room", async (data = {}) => {
            const room = cleanRoomName(data.room);

            if (!room || !isDmRoom(room) || !canAccessDmRoom(socket.authUser, room)) return;

            try {
                await roomsRepository.deleteDmRoom(room);
                await emitRoomList();
            } catch (error) {
                logSocketError("delete-dm-room", error);
                emitServerError(socket, error, "DMを削除できませんでした");
            }
        });

        socket.on("request room members", async (data = {}) => {
            const room = cleanRoomName(data.room);

            if (!room) return;

            try {
                const members = await roomsRepository.listRoomMembers(room, socket.authUser);

                if (!members) return;

                socket.emit("room members", {
                    room,
                    members
                });
            } catch (error) {
                logSocketError("request-room-members", error);
                emitServerError(socket, error, "メンバーを読み込めませんでした");
            }
        });

        socket.on("rename room", async (data = {}) => {
            const room = cleanRoomName(data.room);
            const nextName = cleanRoomName(data.nextName);

            if (!room || !nextName) return;

            try {
                const renamedRoom = await roomsRepository.renameRoom({
                    room,
                    nextName,
                    user: socket.authUser
                });

                if (!renamedRoom) return;

                moveSocketsToRenamedRoom(room, renamedRoom.name);
                await emitRoomList();
            } catch (error) {
                logSocketError("rename-room", error);
                emitServerError(socket, error, "部屋名を変更できませんでした");
            }
        });

        socket.on("delete room", async (data = {}) => {
            const room = cleanRoomName(data.room);

            if (!room) return;

            try {
                const deleted = await roomsRepository.deleteRoom({
                    room,
                    user: socket.authUser
                });

                if (!deleted) return;

                closeSocketsForRoom(room);
                await emitRoomList();
            } catch (error) {
                logSocketError("delete-room", error);
                emitServerError(socket, error, "部屋を削除できませんでした");
            }
        });

        socket.on("add room member", async (data = {}) => {
            const room = cleanRoomName(data.room);
            const accountName = cleanRoomNameFallback(data.accountName);

            if (!room || !accountName) return;

            try {
                const members = await roomsRepository.addRoomMember({
                    room,
                    accountName,
                    user: socket.authUser
                });

                socket.emit("room members", {
                    room,
                    members: members || []
                });
                await emitRoomList();
            } catch (error) {
                logSocketError("add-room-member", error);
                emitServerError(socket, error, "メンバーを追加できませんでした");
            }
        });

        socket.on("remove room member", async (data = {}) => {
            const room = cleanRoomName(data.room);
            const memberKey = String(data.memberKey || "").trim().slice(0, 220);

            if (!room || !memberKey) return;

            try {
                const members = await roomsRepository.removeRoomMember({
                    room,
                    memberKey,
                    user: socket.authUser
                });

                socket.emit("room members", {
                    room,
                    members: members || []
                });
                await refreshRoomAccess(room);
                await emitRoomList();
            } catch (error) {
                logSocketError("remove-room-member", error);
                emitServerError(socket, error, "メンバーを削除できませんでした");
            }
        });

        socket.on("typing", (data = {}) => {
            const room = cleanRoomName(data.room);
            const profile = getSocketProfile(socket);

            if (!room || socket.currentRoom !== room) return;

            socket.to(room).emit("typing", {
                room,
                name: profile.name,
                avatar_url: profile.avatarUrl
            });
        });

        socket.on("stop typing", (data = {}) => {
            const room = cleanRoomName(data.room);

            if (!room || socket.currentRoom !== room) return;

            socket.to(room).emit("stop typing");
        });

        socket.on("chat message", async (data = {}) => {
            const room = cleanRoomName(data.room);
            const message = cleanMessage(data.message);
            const profile = getSocketProfile(socket);

            if (!room || !message || socket.currentRoom !== room || !profile.userId) return;

            try {
                const insertedMessage = await messagesRepository.createMessage({
                    room,
                    userId: profile.userId,
                    name: profile.name,
                    message,
                    avatar_url: profile.avatarUrl
                });

                io.to(room).emit("chat message", {
                    ...insertedMessage,
                    readCount: 0,
                    reactions: []
                });

                await emitNewMessageNotification(insertedMessage, socket.id);

                pushNotifications
                    ?.notifyMessage(insertedMessage)
                    .catch((error) => logSocketError("push-notification", error));
            } catch (error) {
                logSocketError("chat-message", error);
                socket.emit("server error", {
                    message: "メッセージを送信できませんでした"
                });
            }
        });

        socket.on("edit message", async (data = {}) => {
            const id = cleanMessageId(data.id);
            const room = cleanRoomName(data.room);
            const userId = cleanUserId(socket.authUser?.id);
            const message = cleanMessage(data.message);

            if (!id || !room || !userId || !message || socket.currentRoom !== room) return;

            try {
                const updatedMessage = await messagesRepository.updateMessage({
                    id,
                    room,
                    userId,
                    message
                });

                io.to(room).emit("message edited", updatedMessage);
            } catch (error) {
                logSocketError("edit-message", error);
                socket.emit("server error", {
                    message: "メッセージを編集できませんでした"
                });
            }
        });

        socket.on("delete message", async (data = {}) => {
            const id = cleanMessageId(data.id);
            const room = cleanRoomName(data.room);
            const userId = cleanUserId(socket.authUser?.id);
            const deletedBy = getSocketProfile(socket).name;

            if (!id || !room || !userId || socket.currentRoom !== room) return;

            try {
                const deletedMessage = await messagesRepository.deleteMessage({
                    id,
                    room,
                    userId,
                    message: createDeletedMessagePayload(deletedBy)
                });

                io.to(room).emit("message deleted", deletedMessage);
            } catch (error) {
                logSocketError("delete-message", error);
                socket.emit("server error", {
                    message: "メッセージを削除できませんでした"
                });
            }
        });

        socket.on("disconnect", () => {
            notificationPresence?.remove(socket.id);
        });
    });
}

module.exports = {
    registerSocketHandlers
};
