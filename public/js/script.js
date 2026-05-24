const socket = io({
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});
const supabaseClient = window.supabase.createClient(
    "https://duowjfmjbvfknrvjygll.supabase.co",
    "sb_publishable_L8q11jrtIKkNDfGJ4TqlmQ_3NghJgmg"
);

const roomList = document.getElementById("room-list");
const form = document.getElementById("form");
const input = document.getElementById("input");
input.addEventListener("input", () => {

    input.style.height = "auto";

    input.style.height =
        input.scrollHeight + "px";

});
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

    if (!user) {
        login();
        return;
    }

    document.getElementById("user-bar").innerHTML = `
        <img
            src="${user.user_metadata.avatar_url}"
            class="user-avatar"
        >

        <span>
            ${user.user_metadata.user_name}
        </span>
    `;
    const savedRoom =
    localStorage.getItem("lastRoom");

    if (savedRoom) {

        currentRoom = savedRoom;

        roomInput.value = savedRoom;

        document.getElementById(
            "current-room-name"
        ).textContent = `# ${savedRoom}`;

        socket.emit("join room", {
            room: savedRoom,
            name: user.user_metadata.user_name
        });
    }

    document.getElementById(
        "loading-screen"
    ).style.display = "none";
}

window.addEventListener("load", async () => {
    await checkUser();
});

joinBtn.addEventListener("click", () => {
    const roomName = roomInput.value.trim();

    if (!roomName || !user) return;

    currentRoom = roomName;
    localStorage.setItem(
        "lastRoom",
        currentRoom
    );

    document.getElementById("current-room-name").textContent =
        `# ${currentRoom}`;

    socket.emit("join room", {
        room: currentRoom,
        name: user.user_metadata.user_name
    });
});

input.addEventListener("keydown", (e) => {

    // 日本語変換中は無視
    if (e.isComposing) return;

    // Enterのみ → 送信
    if (e.key === "Enter" && !e.shiftKey) {

        e.preventDefault();

        form.requestSubmit();

    }

    // Shift + Enter → 改行
});

form.addEventListener("submit", (e) => {
    e.preventDefault();

    const message = input.value.trim();

    if (!message || !currentRoom || !user) return;

    socket.emit("chat message", {
        room: currentRoom,
        userId: user.id,
        name: user.user_metadata.user_name,
        message: message,
        avatar_url: user.user_metadata.avatar_url
    });

    input.value = "";

    input.style.height = "auto";
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

    // ヘッダー
    const header = document.createElement("div");
    header.className = "message-header";

    // アイコン
    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.src = data.avatar_url;

    // コンテンツ全体
    const content = document.createElement("div");
    content.className = "message-content";

    // 上部分
    const top = document.createElement("div");
    top.className = "message-top";

    const name = document.createElement("strong");
    name.textContent = data.name;

    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.textContent = time;

    top.appendChild(name);
    top.appendChild(timeSpan);

    // メッセージ本文
    const text = document.createElement("div");
    text.className = "message-text";

    // ここが超重要
    text.textContent = data.message;

    // 組み立て
    content.appendChild(top);
    content.appendChild(text);

    header.appendChild(avatar);
    header.appendChild(content);

    item.appendChild(header);

    messages.appendChild(item);

    messages.scrollTop =
        messages.scrollHeight;
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
            localStorage.setItem(
                "lastRoom",
                currentRoom
            );
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

socket.on("connect", () => {
    console.log("接続");
});

socket.on("disconnect", () => {
    console.log("切断");
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