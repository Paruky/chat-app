const {
    getAccountKey,
    normalizeAccountName
} = require("./accountNames");

function readBearerToken(value) {
    const token = String(value || "").trim();

    if (!token) return "";

    return token.replace(/^Bearer\s+/i, "").trim();
}

function readRequestAccessToken(request) {
    return readBearerToken(
        request.headers.authorization ||
        request.body?.accessToken ||
        request.query?.accessToken
    );
}

function readSocketAccessToken(socket) {
    return readBearerToken(
        socket.handshake.auth?.accessToken ||
        socket.handshake.headers?.authorization
    );
}

function getTrustedIdentityValue(user, keys) {
    const identities = Array.isArray(user?.identities) ? user.identities : [];

    for (const identity of identities) {
        const identityData = identity?.identity_data || {};

        for (const key of keys) {
            if (identityData[key]) return identityData[key];
        }
    }

    return "";
}

function getDisplayMetadataValue(user, keys) {
    const metadata = user?.user_metadata || {};
    const trustedValue = getTrustedIdentityValue(user, keys);

    if (trustedValue) return trustedValue;

    for (const key of keys) {
        if (metadata[key]) return metadata[key];
    }

    return "";
}

function normalizeAuthUser(user) {
    if (!user?.id) return null;

    const accountName = normalizeAccountName(
        getTrustedIdentityValue(user, [
            "preferred_username",
            "user_name",
            "login",
            "nickname"
        ]) ||
        user.email?.split("@")[0]
    );
    const displayName = String(
        getDisplayMetadataValue(user, [
            "name",
            "full_name",
            "preferred_username",
            "user_name",
            "login"
        ]) ||
        accountName ||
        user.email ||
        "ユーザー"
    ).trim();

    return {
        id: String(user.id),
        email: user.email || "",
        accountName,
        accountKey: getAccountKey(accountName),
        accountKeys: [getAccountKey(accountName)].filter(Boolean),
        name: displayName.slice(0, 160) || "ユーザー",
        avatarUrl: String(
            getDisplayMetadataValue(user, ["avatar_url", "picture"]) || ""
        ).trim()
    };
}

function applySavedProfile(authUser, profile) {
    if (!authUser) return null;
    if (!profile) {
        return {
            ...authUser,
            needsAccountName: true
        };
    }

    const accountKeys = [
        profile.accountKey,
        authUser.accountKey,
        ...(authUser.accountKeys || [])
    ].filter(Boolean);

    return {
        ...authUser,
        accountName: profile.accountName,
        accountKey: profile.accountKey,
        accountKeys: [...new Set(accountKeys)],
        name: profile.accountName || authUser.name,
        needsAccountName: false
    };
}

function createAuthService(supabase, profilesRepository = null) {
    async function getUserFromAccessToken(accessToken) {
        const token = readBearerToken(accessToken);

        if (!token) return null;

        const { data, error } = await supabase.auth.getUser(token);

        if (error) {
            console.warn("[auth] token rejected:", error.message);
            return null;
        }

        const authUser = normalizeAuthUser(data?.user);

        if (!authUser || !profilesRepository) return authUser;

        try {
            const profile = await profilesRepository.getProfile(authUser.id);

            return applySavedProfile(authUser, profile);
        } catch (error) {
            console.warn("[auth] profile lookup failed:", error.message);
            return applySavedProfile(authUser, null);
        }
    }

    return {
        getUserFromAccessToken
    };
}

function createRequireUser(authService) {
    return async function requireUser(request, response, next) {
        const user = await authService.getUserFromAccessToken(
            readRequestAccessToken(request)
        );

        if (!user) {
            response.status(401).json({
                ok: false,
                message: "authentication required"
            });
            return;
        }

        request.authUser = user;
        next();
    };
}

function isVersionHistoryEditor(config, user) {
    if (!user) return false;

    const userIds = new Set(config.versionHistoryEditorUserIds || []);
    const accountKeys = new Set(
        (config.versionHistoryEditorAccounts || []).map(getAccountKey)
    );

    return userIds.has(user.id) ||
        Boolean(user.accountKey && accountKeys.has(user.accountKey));
}

function createRequireVersionHistoryEditor(config) {
    return function requireVersionHistoryEditor(request, response, next) {
        if (isVersionHistoryEditor(config, request.authUser)) {
            next();
            return;
        }

        response.status(403).json({
            ok: false,
            message: "version history editor permission required"
        });
    };
}

function registerSocketAuth(io, authService) {
    io.use(async (socket, next) => {
        const user = await authService.getUserFromAccessToken(
            readSocketAccessToken(socket)
        );

        if (!user) {
            next(new Error("authentication required"));
            return;
        }

        socket.authUser = user;
        next();
    });
}

module.exports = {
    createAuthService,
    createRequireUser,
    createRequireVersionHistoryEditor,
    getAccountKey,
    normalizeAccountName,
    registerSocketAuth
};
