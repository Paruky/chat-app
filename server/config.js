const path = require("path");

function readList(value) {
    return String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function readConfig() {
    return {
        port: process.env.PORT || 3000,
        host: process.env.HOST || "",
        nodeEnv: process.env.NODE_ENV || "development",
        publicDir: path.join(__dirname, "..", "public"),
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_SECRET_KEY ||
            process.env.SUPABASE_KEY,
        usingLegacySupabaseKey: !process.env.SUPABASE_SERVICE_ROLE_KEY &&
            !process.env.SUPABASE_SECRET_KEY &&
            Boolean(process.env.SUPABASE_KEY),
        maxRoomNameLength: Number(process.env.MAX_ROOM_NAME_LENGTH || 160),
        maxMessageLength: Number(process.env.MAX_MESSAGE_LENGTH || 4000000),
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
        vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
        vapidSubject: process.env.VAPID_SUBJECT || "mailto:notifications@paruky-chat.local",
        versionHistoryEditorUserIds: readList(process.env.VERSION_HISTORY_EDITOR_USER_IDS),
        versionHistoryEditorAccounts: readList(
            process.env.VERSION_HISTORY_EDITOR_ACCOUNTS || "Paruky"
        )
    };
}

function validateConfig(config) {
    const missing = [];

    if (!config.supabaseUrl) missing.push("SUPABASE_URL");
    if (!config.supabaseServiceKey) {
        missing.push("SUPABASE_SERVICE_ROLE_KEY");
    }

    if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(", ")}`);
    }

    if (config.usingLegacySupabaseKey) {
        console.warn(
            "[config] SUPABASE_KEY is still supported, but SUPABASE_SERVICE_ROLE_KEY is safer and clearer for server-only database access."
        );
    }
}

module.exports = {
    readConfig,
    validateConfig
};
