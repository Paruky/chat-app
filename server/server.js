const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { readConfig, validateConfig } = require("./config");
const { createSupabaseClient } = require("./supabase");
const { createRoomsRepository } = require("./repositories/roomsRepository");
const { createMessagesRepository } = require("./repositories/messagesRepository");
const { createPushSubscriptionsRepository } = require("./repositories/pushSubscriptionsRepository");
const { createReadReceiptsRepository } = require("./repositories/readReceiptsRepository");
const { createVersionHistoryRepository } = require("./repositories/versionHistoryRepository");
const {
    createPushNotificationService,
    registerPushRoutes
} = require("./pushNotifications");
const { registerVersionHistoryRoutes } = require("./versionHistoryRoutes");
const { registerSocketHandlers } = require("./socketHandlers");
const { createNotificationPresence } = require("./notificationPresence");

function createServer() {
    const config = readConfig();

    validateConfig(config);

    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        maxHttpBufferSize: Math.max(config.maxMessageLength + 200000, 1000000)
    });
    const supabase = createSupabaseClient(config);
    const notificationPresence = createNotificationPresence();
    const pushNotifications = createPushNotificationService(
        config,
        createPushSubscriptionsRepository(supabase),
        {
            isRecipientActive: notificationPresence.hasVisibleClient
        }
    );

    app.use(express.json({ limit: "1mb" }));
    app.use(express.static(config.publicDir));
    registerPushRoutes(app, pushNotifications);
    registerVersionHistoryRoutes(app, createVersionHistoryRepository(supabase));

    registerSocketHandlers(io, {
        roomsRepository: createRoomsRepository(supabase),
        messagesRepository: createMessagesRepository(supabase),
        readReceiptsRepository: createReadReceiptsRepository(supabase),
        notificationPresence,
        pushNotifications,
        maxRoomNameLength: config.maxRoomNameLength,
        maxMessageLength: config.maxMessageLength
    });

    return {
        server,
        config
    };
}

function startServer() {
    try {
        const { server, config } = createServer();

        server.on("error", (error) => {
            console.error(`server failed to start: ${error.message}`);
            process.exit(1);
        });

        server.listen(config.port, config.host || undefined, () => {
            const address = config.host || "0.0.0.0";
            console.log(`server start : http://${address}:${config.port}`);
        });
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = {
    createServer,
    startServer
};
