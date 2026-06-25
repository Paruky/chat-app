const path = require("path");

function readConfig() {
    return {
        port: process.env.PORT || 3000,
        host: process.env.HOST || "",
        publicDir: path.join(__dirname, "..", "public"),
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_KEY,
        maxRoomNameLength: Number(process.env.MAX_ROOM_NAME_LENGTH || 160),
        maxMessageLength: Number(process.env.MAX_MESSAGE_LENGTH || 900000),
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
        vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
        vapidSubject: process.env.VAPID_SUBJECT || "mailto:notifications@paruky-chat.local"
    };
}

function validateConfig(config) {
    const missing = [];

    if (!config.supabaseUrl) missing.push("SUPABASE_URL");
    if (!config.supabaseKey) missing.push("SUPABASE_KEY");

    if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(", ")}`);
    }
}

module.exports = {
    readConfig,
    validateConfig
};
