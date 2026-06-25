const TABLE_NAME = "push_subscriptions";

function createPushSubscriptionsRepository(supabase) {
    const memorySubscriptions = new Map();
    let hasWarnedAboutSupabase = false;

    function warnSupabaseFallback(error) {
        if (hasWarnedAboutSupabase) return;

        hasWarnedAboutSupabase = true;
        console.warn(
            `[push-subscriptions] Supabase table unavailable, using in-memory fallback: ${error.message}`
        );
    }

    function normalizeSubscriptionRecord(record) {
        const subscription = record?.subscription || {};
        const endpoint = subscription.endpoint || record?.endpoint;

        if (!endpoint) return null;

        return {
            endpoint,
            userId: record.user_id || record.userId || "",
            accountName: record.account_name || record.accountName || "",
            subscription
        };
    }

    function saveInMemory(record) {
        const normalized = normalizeSubscriptionRecord(record);

        if (!normalized) return;

        memorySubscriptions.set(normalized.endpoint, normalized);
    }

    async function saveSubscription({ userId, accountName, subscription }) {
        const record = {
            endpoint: subscription?.endpoint || "",
            user_id: String(userId || ""),
            account_name: String(accountName || ""),
            subscription
        };

        if (!record.endpoint || !record.user_id || !subscription?.keys) return;

        saveInMemory(record);

        const { error } = await supabase
            .from(TABLE_NAME)
            .upsert([record], { onConflict: "endpoint" });

        if (error) {
            warnSupabaseFallback(error);
        }
    }

    async function listSubscriptions() {
        const byEndpoint = new Map(memorySubscriptions);
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select("endpoint,user_id,account_name,subscription");

        if (error) {
            warnSupabaseFallback(error);
            return [...byEndpoint.values()];
        }

        (data || []).forEach((record) => {
            const normalized = normalizeSubscriptionRecord(record);

            if (normalized) {
                byEndpoint.set(normalized.endpoint, normalized);
            }
        });

        return [...byEndpoint.values()];
    }

    async function deleteSubscription(endpoint) {
        if (!endpoint) return;

        memorySubscriptions.delete(endpoint);

        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq("endpoint", endpoint);

        if (error) {
            warnSupabaseFallback(error);
        }
    }

    return {
        saveSubscription,
        listSubscriptions,
        deleteSubscription
    };
}

module.exports = {
    createPushSubscriptionsRepository
};
