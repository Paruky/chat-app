function normalizeEndpoint(value) {
    return String(value || "").trim();
}

function createNotificationPresence() {
    const clients = new Map();

    function update(socketId, data = {}) {
        const userId = String(data.userId || "").trim();
        const endpoint = normalizeEndpoint(data.endpoint);

        if (!userId && !endpoint) {
            clients.delete(socketId);
            return;
        }

        clients.set(socketId, {
            userId,
            endpoint,
            visible: data.visible === true,
            room: String(data.room || "")
        });
    }

    function remove(socketId) {
        clients.delete(socketId);
    }

    function hasVisibleClient(record = {}) {
        const endpoint = normalizeEndpoint(record.endpoint);

        if (!endpoint) return false;

        return [...clients.values()].some((client) =>
            client.visible && client.endpoint === endpoint
        );
    }

    return {
        update,
        remove,
        hasVisibleClient
    };
}

module.exports = {
    createNotificationPresence
};
