function cleanText(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
}

function readEntryBody(body = {}) {
    return {
        version: cleanText(body.version, 80),
        notes: cleanText(body.notes, 5000)
    };
}

function isValidEntry(entry) {
    return Boolean(entry.version && entry.notes);
}

function registerVersionHistoryRoutes(app, versionHistoryRepository, middleware = {}) {
    const requireUser = middleware.requireUser || ((request, response, next) => next());
    const requireVersionHistoryEditor = middleware.requireVersionHistoryEditor ||
        ((request, response, next) => next());

    app.get("/api/version-history", requireUser, async (request, response) => {
        try {
            response.json({
                entries: await versionHistoryRepository.listEntries()
            });
        } catch (error) {
            console.error("[version-history:list]", error);
            response.status(500).json({
                ok: false
            });
        }
    });

    app.post(
        "/api/version-history",
        requireUser,
        requireVersionHistoryEditor,
        async (request, response) => {
            const entry = readEntryBody(request.body);

            if (!isValidEntry(entry)) {
                response.status(400).json({
                    ok: false,
                    message: "invalid version history entry"
                });
                return;
            }

            try {
                response.status(201).json({
                    entry: await versionHistoryRepository.createEntry(entry)
                });
            } catch (error) {
                console.error("[version-history:create]", error);
                response.status(500).json({
                    ok: false
                });
            }
        }
    );

    app.put(
        "/api/version-history/:id",
        requireUser,
        requireVersionHistoryEditor,
        async (request, response) => {
            const id = cleanText(request.params.id, 120);
            const entry = readEntryBody(request.body);

            if (!id || !isValidEntry(entry)) {
                response.status(400).json({
                    ok: false,
                    message: "invalid version history entry"
                });
                return;
            }

            try {
                response.json({
                    entry: await versionHistoryRepository.updateEntry(id, entry)
                });
            } catch (error) {
                console.error("[version-history:update]", error);
                response.status(500).json({
                    ok: false
                });
            }
        }
    );

    app.delete(
        "/api/version-history/:id",
        requireUser,
        requireVersionHistoryEditor,
        async (request, response) => {
            const id = cleanText(request.params.id, 120);

            if (!id) {
                response.status(400).json({
                    ok: false
                });
                return;
            }

            try {
                await versionHistoryRepository.deleteEntry(id);
                response.json({
                    ok: true
                });
            } catch (error) {
                console.error("[version-history:delete]", error);
                response.status(500).json({
                    ok: false
                });
            }
        }
    );
}

module.exports = {
    registerVersionHistoryRoutes
};
