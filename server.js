const express = require("express");
const http = require("http");
const sqlite3 = require("sqlite3").verbose();
const { Server } = require("socket.io");
const rooms = [];
const db = new sqlite3.Database("./chat.db");
db.run(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT,
        userId TEXT,
        name TEXT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {

    console.log("ユーザー接続");
    socket.emit("room list", rooms);

    socket.on("join room", (data) => {

        socket.join(data.room);

        socket.room = data.room;
        socket.username = data.name;
        db.all(
            "SELECT * FROM messages WHERE room = ? ORDER BY id ASC",
            [data.room],
            (err, rows) => {

                socket.emit("message history", rows);

            }
        );

        if (!rooms.includes(data.room)) {
            rooms.push(data.room);
        }

        io.emit("room list", rooms);

    });

    socket.on("chat message", (data) => {

        db.run(
            "INSERT INTO messages (room, userId, name, message) VALUES (?, ?, ?, ?)",
            [data.room, data.userId, data.name, data.message]
        );

        io.to(data.room).emit("chat message", {
            userId: data.userId,
            name: data.name,
            message: data.message
        });

    });

    socket.on("disconnect", () => {

        console.log("ユーザー切断");

    });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`サーバー起動: ${PORT}`);
});