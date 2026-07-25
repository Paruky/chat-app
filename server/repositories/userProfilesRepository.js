const {
    getAccountKey,
    normalizeAccountName,
    validateAccountName
} = require("../accountNames");

const TABLE_NAME = "user_profiles";

function normalizeProfile(record) {
    if (!record?.user_id) return null;

    const accountName = normalizeAccountName(record.account_name);

    return {
        userId: String(record.user_id),
        accountName,
        accountKey: String(record.account_key || getAccountKey(accountName)),
        createdAt: record.created_at || "",
        updatedAt: record.updated_at || ""
    };
}

function isDuplicateAccountNameError(error) {
    return error?.code === "23505" ||
        /duplicate key value/i.test(error?.message || "");
}

function createDuplicateAccountNameError() {
    const error = new Error("このアカウント名はもう使われています");
    error.code = "account-name-taken";
    return error;
}

function createUserProfilesRepository(supabase) {
    async function getProfile(userId) {
        const safeUserId = String(userId || "").trim();

        if (!safeUserId) return null;

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select("user_id,account_name,account_key,created_at,updated_at")
            .eq("user_id", safeUserId)
            .maybeSingle();

        if (error) throw error;

        return normalizeProfile(data);
    }

    async function syncAccountNameReferences({ userId, accountName, accountKey }) {
        const safeUserId = String(userId || "").trim();
        const now = new Date().toISOString();

        if (!safeUserId) return;

        const updates = [
            supabase
                .from("rooms")
                .update({
                    owner_account_name: accountName,
                    owner_account_key: accountKey,
                    updated_at: now
                })
                .eq("owner_user_id", safeUserId),
            supabase
                .from("room_members")
                .update({
                    account_name: accountName,
                    account_key: accountKey,
                    updated_at: now
                })
                .eq("user_id", safeUserId),
            supabase
                .from("push_subscriptions")
                .update({
                    account_name: accountName,
                    updated_at: now
                })
                .eq("user_id", safeUserId)
        ];

        const results = await Promise.all(updates);
        const failed = results.find((result) => result.error);

        if (failed?.error) throw failed.error;
    }

    async function saveProfile({ userId, accountName }) {
        const safeUserId = String(userId || "").trim();
        const safeAccountName = validateAccountName(accountName);
        const accountKey = getAccountKey(safeAccountName);
        const now = new Date().toISOString();

        if (!safeUserId) {
            const error = new Error("ユーザー情報を確認できませんでした");
            error.code = "missing-user-id";
            throw error;
        }

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .upsert([{
                user_id: safeUserId,
                account_name: safeAccountName,
                account_key: accountKey,
                updated_at: now
            }], { onConflict: "user_id" })
            .select("user_id,account_name,account_key,created_at,updated_at")
            .single();

        if (error) {
            if (isDuplicateAccountNameError(error)) {
                throw createDuplicateAccountNameError();
            }

            throw error;
        }

        await syncAccountNameReferences({
            userId: safeUserId,
            accountName: safeAccountName,
            accountKey
        });

        return normalizeProfile(data);
    }

    return {
        getProfile,
        saveProfile
    };
}

module.exports = {
    createUserProfilesRepository
};
