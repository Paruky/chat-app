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
        .from("rooms")
        .select("name");

    const uniqueRooms = (roomsData || []).map(r => r.name);

    socket.emit(
        "room list",
        uniqueRooms
    );

    
    socket.on("join room", async (data) => {
        const { error: roomError } = await supabase
            .from("rooms")
            .upsert(
                [
                    {
                        name: data.room
                    }
                ],
                {
                    onConflict: "name"
                }
            );

        if (roomError) {
            console.log("ROOM ERROR:", roomError);
        }
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
            .from("rooms")
            .select("name");

        const updatedRooms = (updatedRoomsData || []).map(r => r.name);

        io.emit(
            "room list",
            updatedRooms
        );
    });
    socket.on("typing", (data) => {

        socket.to(data.room).emit(
            "typing",
            data.name
        );

    });

    socket.on("stop typing", (data) => {

        socket.to(data.room).emit(
            "stop typing"
        );

    });
    socket.on("chat message", async (data) => {
        if (!data.room || !data.message) return;

        const { data: insertedMessage, error: messageError } = await supabase
            .from("messages")
            .insert([
                {
                    room: data.room,
                    userId: data.userId,
                    name: data.name,
                    message: data.message,
                    avatar_url: data.avatar_url
                }
            ])
            .select()
            .single();

        if (messageError) {
            console.log("MESSAGE ERROR:", messageError);
        }

        io.to(data.room).emit(
            "chat message",
            insertedMessage
        );
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`server start : ${PORT}`);
});