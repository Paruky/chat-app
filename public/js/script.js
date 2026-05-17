const socket = io();
const supabase = window.supabase.createClient(
    "https://duowjfmjbvfknrvjygll.supabase.co",
    "sb_publishable_L8q11jrtIKkNDfGJ4TqlmQ_3NghJgmg"
);

const roomList = document.getElementById("room-list");
const form = document.getElementById("form");
const input = document.getElementById("input");
const nameInput = document.getElementById("name");
const messages = document.getElementById("messages");
const roomInput = document.getElementById("room");
const joinBtn = document.getElementById("join-btn");

let currentRoom = "";

async function login() {
    await supabase.auth.signInWithOAuth({
        provider: "github"
    });
}

let user = null;

async function checkUser() {
    const {
        data: { user: authUser }
    } = await supabase.auth.getUser();

    user = authUser;

    if (!user) {
        login();
    }
}

checkUser();

joinBtn.addEventListener("click", () => {
    if (!roomInput.value || !nameInput.value) return;

    currentRoom = roomInput.value;

    document.getElementById("current-room-name").textContent =
        `# ${currentRoom}`;

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
        userId: user.id,
        name: nameInput.value,
        message: input.value
    });

    input.value = "";
});

function addMessage(data) {
    const item = document.createElement("div");
    item.classList.add("message");

    if (data.userId === user.id) {
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

            document.querySelectorAll(".room-item").forEach(el => {
                el.classList.remove("active");
            });

            item.classList.add("active");

            currentRoom = room;
            roomInput.value = room;

            document.getElementById("current-room-name").textContent =
                `# ${room}`;

            socket.emit("join room", {
                room,
                name: nameInput.value
            });

        });

        roomList.appendChild(item);
    });
});

if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/sw.js")
                .then((reg) => {
                    console.log("SW registered:", reg.scope);
                })
                .catch((err) => {
                    console.log("SW registration failed:", err);
                });
        });
    }