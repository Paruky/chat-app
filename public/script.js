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
const messages = document.getElementById("messages");
const roomInput = document.getElementById("room");
const joinBtn = document.getElementById("join-btn");

const installBtn = document.getElementById("installBtn");
const iosHint = document.getElementById("iosHint");

let currentRoom = "";
let deferredPrompt = null;

/* -------------------------
   チャット
-------------------------- */

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

    if (!input.value || !nameInput.value || !currentRoom) return;

    socket.emit("chat message", {
        room: currentRoom,
        userId,
        name: nameInput.value,
        message: input.value
    });

    input.value = "";
});

/* -------------------------
   メッセージ表示
-------------------------- */

function addMessage(data) {
    const item = document.createElement("div");
    item.classList.add("message");

    if (data.userId === userId) {
        item.classList.add("my-message");
    }

    item.innerHTML = `<strong>${data.name}</strong><br>${data.message}`;

    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
}

socket.on("chat message", addMessage);

socket.on("message history", (data) => {
    messages.innerHTML = "";
    data.forEach(addMessage);
});

/* -------------------------
   インストールPWA
-------------------------- */

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = "block";
});

installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    console.log(choice.outcome);

    deferredPrompt = null;
    installBtn.style.display = "none";
});

/* -------------------------
   iPhone補助
-------------------------- */

if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    iosHint.style.display = "block";
}

/* -------------------------
   通知許可
-------------------------- */

async function enableNotifications() {
    const permission = await Notification.requestPermission();

    console.log("permission:", permission);

    if (permission === "granted") {
        console.log("通知OK");
        subscribePush();
    }
}

/* -------------------------
   Push登録
-------------------------- */

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

async function subscribePush() {
    try {
        const registration = await navigator.serviceWorker.ready;

        console.log("SW ready OK");

        const publicKey = "BIWIEcJAK1coBk0fwuRoza3y9AlbfzrP--wMtpGUkO4QeqEX2DAasUc9m7GZ4aAKgq-d7mOQwzUXrHytpjvuPEs";

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        console.log("subscription OK:", subscription);

        const res = await fetch("/subscribe", {
            method: "POST",
            body: JSON.stringify(subscription),
            headers: {
                "Content-Type": "application/json"
            }
        });

        console.log("server response:", await res.json());
    } catch (err) {
        console.error("subscribe error:", err);
    }
}