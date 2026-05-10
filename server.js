const express = require("express");
const http = require("http");
const Database = require("better-sqlite3");
const webPush = require("web-push");
const { Server } = require("socket.io");
const rooms = [];
const db = new Database("chat.db");

webPush.setVapidDetails(
    "mailto:haruki.mzawa0408@gmail.com",
    "BIWIEcJAK1coBk0fwuRoza3y9AlbfzrP--wMtpGUkO4QeqEX2DAasUc9m7GZ4aAKgq-d7mOQwzUXrHytpjvuPEs",
    "h-qOGtzeu6xy2PQ3yNHXQSzBvIkAqogUDsQSDej6cDY"
);
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

        const stmt = db.prepare(
            "INSERT INTO messages (room, userId, name, message) VALUES (?, ?, ?, ?)"
        );

        stmt.run(
            data.room,
            data.userId,
            data.name,
            data.message
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

function sendPush(subscription, message) {
    const payload = JSON.stringify({
        title: "Paruky Chat",
        body: message
    });

    webPush.sendNotification(subscription, payload);
}

console.log(subscriptions);

console.log("送信開始");
subscriptions.forEach(s => console.log(s));

console.log("subscriptions:", subscriptions.length);