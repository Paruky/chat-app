const socket = io();
const supabaseClient = window.supabase.createClient(
    "https://duowjfmjbvfknrvjygll.supabase.co",
    "sb_publishable_L8q11jrtIKkNDfGJ4TqlmQ_3NghJgmg"
);

const roomList = document.getElementById("room-list");
const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const roomInput = document.getElementById("room");
const joinBtn = document.getElementById("join-btn");

let currentRoom = "";

async function login() {
    await supabaseClient.auth.signInWithOAuth({
        provider: "github"
    });
}

let user = null;

async function checkUser() {
    const {
        data: { user: authUser }
    } = await supabaseClient.auth.getUser();
    
    user = authUser;

    console.log("USER:", user);

    document.getElementById("user-bar").innerHTML = `
        <img
            src="${user.user_metadata.avatar_url}"
            class="user-avatar"
        >

        <span>
            ${user.user_metadata.user_name}
        </span>
    `;

    if (!user) {
        login();
    }
}

window.addEventListener("load", async () => {
    await checkUser();
});

joinBtn.addEventListener("click", () => {
    if (!roomInput.value || !user) return;

    currentRoom = roomInput.value;

    document.getElementById("current-room-name").textContent =
        `# ${currentRoom}`;

    socket.emit("join room", {
        room: currentRoom,
        name: user.user_metadata.user_name
    });
});

form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!input.value || !currentRoom || !user) return;

    socket.emit("chat message", {
        room: currentRoom,
        userId: user.id,
        name: user.user_metadata.user_name,
        message: input.value,
        avatar_url: user.user_metadata.avatar_url
    });

    input.value = "";
});

function addMessage(data) {
    const item = document.createElement("div");
    item.classList.add("message");

    if (data.userId === user.id) {
        item.classList.add("my-message");
    }

    const time = new Date(data.created_at)
        .toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit"
        });

    item.innerHTML = `
    <div class="message-header">

        <img
            class="avatar"
            src="${data.avatar_url}"
        >

        <div class="message-content">

            <div class="message-top">
                <strong>${data.name}</strong>

                <span class="message-time">
                    ${time}
                </span>
            </div>

            <div class="message-text">
                ${data.message}
            </div>

        </div>

    </div>
`;

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
                name: user.user_metadata.user_name
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