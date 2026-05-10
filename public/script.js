const socket = io();
let userId = localStorage.getItem("userId");
if (!userId) {

    userId = crypto.randomUUID();

    localStorage.setItem("userId", userId);

}
const roomList = document.getElementById("room-list");
const form = document.getElementById("form");
const input = document.getElementById("input");
const nameInput = document.getElementById("name");
const savedName = localStorage.getItem("chatName");

if (savedName) {
    nameInput.value = savedName;
}
const messages = document.getElementById("messages");
const roomInput = document.getElementById("room");
const joinBtn = document.getElementById("join-btn");

let currentRoom = "";

joinBtn.addEventListener("click", () => {

    if (!roomInput.value || !nameInput.value) return;

    currentRoom = roomInput.value;

    localStorage.setItem("chatName", nameInput.value);

    socket.emit("join room", {
        room: currentRoom,
        name: nameInput.value
    });

});

form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (input.value && nameInput.value && currentRoom) {

        const data = {
            room: currentRoom,
            userId: userId,
            name: nameInput.value,
            message: input.value
        };

        socket.emit("chat message", data);

        input.value = "";
    }
});

function addMessage(data) {

    const item = document.createElement("div");

    item.classList.add("message");

    if (data.userId === userId) {
        item.classList.add("my-message");
    }

    item.innerHTML = `
        <strong>${data.name}</strong><br>
        ${data.message}
    `;

    messages.appendChild(item);

    messages.scrollTop = messages.scrollHeight;

}

socket.on("chat message", (data) => {

    addMessage(data);

});

socket.on("system message", (msg) => {

    const item = document.createElement("div");

    item.classList.add("system-message");

    item.textContent = msg;

    messages.appendChild(item);

    messages.scrollTo({
        top: messages.scrollHeight,
        behavior: "smooth"
    });
});

socket.on("room list", (rooms) => {

    roomList.innerHTML = "";

    rooms.forEach((room) => {

        const item = document.createElement("div");

        item.classList.add("room-item");

        item.textContent = room;

        item.addEventListener("click", () => {

            currentRoom = room;

            roomInput.value = room;

            socket.emit("join room", {
                room: room,
                name: nameInput.value
            });

        });

        roomList.appendChild(item);

    });

});

socket.on("message history", (messagesData) => {

    messages.innerHTML = "";

    messagesData.forEach((data) => {

        addMessage(data);

    });

});

async function enableNotifications() {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
        console.log("通知OK");
    } else {
        console.log("通知拒否 or 保留");
    }
}

let deferredPrompt = null;

const installBtn = document.getElementById("installBtn");
const iosHint = document.getElementById("iosHint");

// Android / Chrome系：インストール可能検知
window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    installBtn.style.display = "block";
});

// ボタン押したらインストール
installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
        console.log("インストール完了");
    } else {
        console.log("キャンセル");
    }

    deferredPrompt = null;
    installBtn.style.display = "none";
});

// iPhone検知（PWAボタン非対応）
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    iosHint.style.display = "block";
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

async function subscribePush() {
    const registration = await navigator.serviceWorker.ready;

    const publicKey = "BIWIEcJAK1coBk0fwuRoza3y9AlbfzrP--wMtpGUkO4QeqEX2DAasUc9m7GZ4aAKgq-d7mOQwzUXrHytpjvuPEs";

    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await fetch("/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription),
        headers: {
            "Content-Type": "application/json"
        }
    });

    console.log("Push登録完了");
}

const subscriptions = [];

app.use(express.json());

app.post("/subscribe", (req, res) => {
    subscriptions.push(req.body);
    res.status(200).json({ success: true });
});

function sendAll(message) {
    const payload = JSON.stringify({
        title: "Paruky Chat",
        body: message
    });

    subscriptions.forEach(sub => {
        webPush.sendNotification(sub, payload)
            .catch(err => console.error(err));
    });
}