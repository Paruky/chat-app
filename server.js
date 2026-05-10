const express = require("express");
const http = require("http");
const Database = require("better-sqlite3");
const webPush = require("web-push");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new Database("chat.db");

app.use(express.static("public"));
app.use(express.json());

const rooms = [];
const subscriptions = [];

/* -------------------------
   VAPID
-------------------------- */

webPush.setVapidDetails(
    "mailto:haruki.mzawa0408@gmail.com",
    "BIWIEcJAK1coBk0fwuRoza3y9AlbfzrP--wMtpGUkO4QeqEX2DAasUc9m7GZ4aAKgq-d7mOQwzUXrHytpjvuPEs",
    "h-qOGtzeu6xy2PQ3yNHXQSzBvIkAqogUDsQSDej6cDY"
);

/* -------------------------
   DB
-------------------------- */

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

/* -------------------------
   Push登録
-------------------------- */

app.post("/subscribe", (req, res) => {
    console.log("subscribe受信");

    subscriptions.push(req.body);

    console.log("subscriptions数:", subscriptions.length);

    res.json({ ok: true });
});

/* -------------------------
   Push送信
-------------------------- */

function sendAll(message) {
    console.log("Push送信開始:", subscriptions.length);

    const payload = JSON.stringify({
        title: "Paruky Chat",
        body: message
    });

    subscriptions.forEach((sub, i) => {
        console.log("送信先", i);

        webPush.sendNotification(sub, payload)
            .then(() => console.log("送信成功"))
            .catch(err => console.error("送信失敗:", err));
    });
}

/* -------------------------
   Socket
-------------------------- */

io.on("connection", (socket) => {

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

        // ⭐通知トリガー
        sendAll(`${data.name}: ${data.message}`);
    });
});

server.listen(3000, () => {
    console.log("server start");
});