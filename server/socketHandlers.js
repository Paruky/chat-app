function createTextCleaner(maxLength) {
    return function cleanText(value) {
        return String(value || "").trim().slice(0, maxLength);
    };
}

function logSocketError(action, error) {
    console.error(`[socket:${action}]`, error);
}

function registerSocketHandlers(io, dependencies) {
    const {
        roomsRepository,
        messagesRepository,
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
            } catch (error) {
                logSocketError("chat-message", error);
                socket.emit("server error", {
                    message: "メッセージを送信できませんでした"
                });
            }
        });
    });
}

module.exports = {
    registerSocketHandlers
};
