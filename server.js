const express = require("express");
const http = require("http");
const Database = require("better-sqlite3");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new Database("chat.db");

app.use(express.static("public"));

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

db.prepare(`
CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

io.on("connection", (socket) => {

    const rooms = db.prepare(`
        SELECT name
        FROM rooms
        ORDER BY id DESC
    `).all();

    socket.emit(
        "room list",
        rooms.map(r => r.name)
    );

    socket.on("join room", (data) => {
        if (socket.currentRoom) {
            socket.leave(socket.currentRoom);
        }

        socket.join(data.room);
        socket.currentRoom = data.room;

        db.prepare(`
            INSERT OR IGNORE INTO rooms (name)
            VALUES (?)
        `).run(data.room);

        const rows = db.prepare(
            "SELECT * FROM messages WHERE room = ? ORDER BY id ASC"
        ).all(data.room);

        socket.emit("message history", rows);

        const updatedRooms = db.prepare(`
            SELECT name
            FROM rooms
            ORDER BY id DESC
        `).all();

        io.emit(
            "room list",
            updatedRooms.map(r => r.name)
        );

        db.prepare(`
            INSERT OR IGNORE INTO rooms (name)
            VALUES (?)
        `).run(data.room);
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

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`server start : ${PORT}`);
});