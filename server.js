const express = require("express");
const http = require("http");
const Database = require("better-sqlite3");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new Database("chat.db");

app.use(express.static("public"));

const rooms = [];

db.prepare(`
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT,
    userId TEXT,
    name TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

io.on("connection", (socket) => {

    socket.emit("room list", rooms);

    socket.on("join room", (data) => {
        socket.join(data.room);

        const rows = db.prepare(
            "SELECT * FROM messages WHERE room = ? ORDER BY id ASC"
        ).all(data.room);

        socket.emit("message history", rows);

        if (!rooms.includes(data.room)) {
            rooms.push(data.room);
        }

        io.emit("room list", rooms);
    });

    socket.on("chat message", (data) => {

        db.prepare(
            "INSERT INTO messages (room, userId, name, message) VALUES (?, ?, ?, ?)"
        ).run(
            data.room,
            data.userId,
            data.name,
            data.message
        );

        io.to(data.room).emit("chat message", data);
    });
});

server.listen(3000, () => {
    console.log("server start");
});