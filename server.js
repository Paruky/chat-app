const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

app.use(express.static("public"));

io.on("connection", async (socket) => {

    const { data: roomsData } = await supabase
        .from("messages")
        .select("room");

    const uniqueRooms = [
        ...new Set(
            roomsData.map(r => r.room)
        )
    ];

    socket.emit(
        "room list",
        uniqueRooms
    );

    socket.on("join room", async (data) => {
        if (socket.currentRoom) {
            socket.leave(socket.currentRoom);
        }

        socket.join(data.room);
        socket.currentRoom = data.room;

        const { data: rows } = await supabase
        .from("messages")
        .select("*")
        .eq("room", data.room)
        .order("id", { ascending: true });

        socket.emit("message history", rows);

        const { data: updatedRoomsData } = await supabase
            .from("messages")
            .select("room");

        const updatedRooms = [
            ...new Set(
                updatedRoomsData.map(r => r.room)
            )
        ];

        io.emit(
            "room list",
            updatedRooms
        );
    });

    socket.on("chat message", async (data) => {

        await supabase
        .from("messages")
        .insert([
            {
                room: data.room,
                userId: data.userId,
                name: data.name,
                message: data.message
            }
        ]);

        io.to(data.room).emit("chat message", data);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`server start : ${PORT}`);
});