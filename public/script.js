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

    if (!input.value || !nameInput.value || !currentRoom) return;

    socket.emit("chat message", {
        room: currentRoom,
        userId,
        name: nameInput.value,
        message: input.value
    });

    input.value = "";
});

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
                room,
                name: nameInput.value
            });
        });

        roomList.appendChild(item);
    });
});