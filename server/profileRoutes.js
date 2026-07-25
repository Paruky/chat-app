function createFallbackProfile(user) {
    return {
        accountName: user?.accountName || "",
        accountKey: user?.accountKey || "",
        displayName: user?.name || "ユーザー",
        avatarUrl: user?.avatarUrl || ""
    };
}

function createProfileResponse(user, profile) {
    const fallback = createFallbackProfile(user);
    const activeProfile = profile || null;

    return {
        ok: true,
        needsAccountName: !activeProfile,
        profile: {
            accountName: activeProfile?.accountName || fallback.accountName,
            accountKey: activeProfile?.accountKey || fallback.accountKey,
            displayName: fallback.displayName,
            avatarUrl: fallback.avatarUrl
        },
        fallback
    };
}

function registerProfileRoutes(app, profilesRepository, requireUser) {
    app.get("/api/profile", requireUser, async (request, response) => {
        try {
            const profile = await profilesRepository.getProfile(request.authUser.id);

            response.json(createProfileResponse(request.authUser, profile));
        } catch (error) {
            console.error("[profile:get]", error);
            response.status(500).json({
                ok: false,
                message: "プロフィールを読み込めませんでした"
            });
        }
    });

    app.put("/api/profile", requireUser, async (request, response) => {
        try {
            const profile = await profilesRepository.saveProfile({
                userId: request.authUser.id,
                accountName: request.body?.accountName
            });

            response.json(createProfileResponse({
                ...request.authUser,
                accountName: profile.accountName,
                accountKey: profile.accountKey
            }, profile));
        } catch (error) {
            console.error("[profile:put]", error);
            response.status(error.code === "account-name-taken" ? 409 : 400).json({
                ok: false,
                message: error.message || "アカウント名を保存できませんでした"
            });
        }
    });
}

module.exports = {
    registerProfileRoutes
};
