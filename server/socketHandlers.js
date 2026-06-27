function createTextCleaner(maxLength) {
    return function cleanText(value) {
        return String(value || "").trim().slice(0, maxLength);
    };
}

function cleanMessageId(value) {
    const id = String(value || "").trim();

    return id && id.length <= 80 ? id : null;
}

function logSocketError(action, error) {
    console.error(`[socket:${action}]`, error);
}

function isDmRoom(room) {
    return String(room || "").startsWith("dm:");
}

function createDeletedMessagePayload(deletedBy) {
    return JSON.stringify({
        type: "paruky:deleted:v1",
        deletedBy,
        deletedAt: new Date().toISOString()
    });
}

function registerSocketHandlers(io, dependencies) {
    const {
        roomsRepository,
        messagesRepository,
        pushNotifications,
        maxRoomNameLength,
        maxMessageLength
    } = dependencies;

    const cleanRoomName = createTextCleaner(maxRoomNameLength);
    const cleanMessage = createTextCleaner(maxMessageLength);

    async function emitRoomList(target = io) {
        const rooms = await roomsRepository.listRooms();
        target.emit("room list", rooms);
    }

    io.on("connection", async (socket) => {
        try {
            await emitRoomList(socket);
        } catch (error) {
            logSocketError("room-list", error);
        }

        socket.on("join room", async (data = {}) => {
            const room = cleanRoomName(data.room);

            if (!room) return;

            try {
                await roomsRepository.saveRoom(room);

                if (socket.currentRoom) {
                    socket.leave(socket.currentRoom);
                }

                socket.join(room);
                socket.currentRoom = room;

                const rows = await messagesRepository.listMessages(room);
                socket.emit("message history", rows);

                await emitRoomList();
            } catch (error) {
                logSocketError("join-room", error);
                socket.emit("server error", {
                    message: "部屋に参加できませんでした"
                });
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

        socket.on("delete dm room", async (data = {}) => {
            const room = cleanRoomName(data.room);

            if (!room || !isDmRoom(room)) return;

            try {
                await roomsRepository.deleteRoom(room);
                await emitRoomList();
            } catch (error) {
                logSocketError("delete-dm-room", error);
                socket.emit("server error", {
                    message: "DMを削除できませんでした"
                });
            }
        });

        socket.on("typing", (data = {}) => {
            const room = cleanRoomName(data.room);

            if (!room) return;

            socket.to(room).emit("typing", {
                room,
                name: cleanRoomName(data.name) || "ユーザー",
                avatar_url: data.avatar_url || ""
            });
        });

        socket.on("stop typing", (data = {}) => {
            const room = cleanRoomName(data.room);

            if (!room) return;

            socket.to(room).emit("stop typing");
        });

        socket.on("chat message", async (data = {}) => {
            const room = cleanRoomName(data.room);
            const message = cleanMessage(data.message);

            if (!room || !message) return;

            try {
                const insertedMessage = await messagesRepository.createMessage({
                    room,
                    userId: data.userId || "",
                    name: cleanRoomName(data.name) || "ユーザー",
                    message,
                    avatar_url: data.avatar_url || ""
                });

                io.to(room).emit("chat message", insertedMessage);

                socket.broadcast.emit("new message notification", {
                    room,
                    userId: data.userId || ""
                });

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
            const userId = String(data.userId || "");
            const message = cleanMessage(data.message);

            if (!id || !room || !userId || !message) return;

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
            const userId = String(data.userId || "");
            const deletedBy = cleanRoomName(data.name) || "ユーザー";

            if (!id || !room || !userId) return;

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
    });
}

module.exports = {
    registerSocketHandlers
};
