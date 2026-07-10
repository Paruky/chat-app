const TABLE_NAME = "read_receipts";

function normalizeMessageId(value) {
    const id = Number.parseInt(String(value || ""), 10);

    return Number.isFinite(id) && id > 0 ? id : 0;
}

function createReceiptKey(room, userId) {
    return `${room}::${userId}`;
}

function normalizeReceipt(record) {
    const room = String(record?.room || "").trim();
    const userId = String(record?.user_id || record?.userId || "").trim();
    const lastReadMessageId = normalizeMessageId(
        record?.last_read_message_id || record?.lastReadMessageId
    );

    if (!room || !userId || !lastReadMessageId) return null;

    return {
        room,
        userId,
        lastReadMessageId,
        updatedAt: record.updated_at || record.updatedAt || ""
    };
}

function createReadReceiptsRepository(supabase) {
    const memoryReceipts = new Map();
    let hasWarnedAboutSupabase = false;

    function warnSupabaseFallback(error) {
        if (hasWarnedAboutSupabase) return;

        hasWarnedAboutSupabase = true;
        console.warn(
            `[read-receipts] Supabase table unavailable, using in-memory fallback: ${error.message}`
        );
    }

    function saveInMemory(receipt) {
        const normalized = normalizeReceipt(receipt);

        if (!normalized) return;

        const key = createReceiptKey(normalized.room, normalized.userId);
        const current = memoryReceipts.get(key);

        if (current && current.lastReadMessageId >= normalized.lastReadMessageId) return;

        memoryReceipts.set(key, {
            ...normalized,
            updatedAt: new Date().toISOString()
        });
    }

    async function saveReadReceipt({ room, userId, lastReadMessageId }) {
        const receipt = normalizeReceipt({
            room,
            user_id: userId,
            last_read_message_id: lastReadMessageId
        });

        if (!receipt) return;

        saveInMemory(receipt);

        const { data: currentRecord, error: currentError } = await supabase
            .from(TABLE_NAME)
            .select("last_read_message_id")
            .eq("room", receipt.room)
            .eq("user_id", receipt.userId)
            .maybeSingle();

        if (currentError) {
            warnSupabaseFallback(currentError);
            return;
        }

        const currentMessageId = normalizeMessageId(currentRecord?.last_read_message_id);

        if (currentMessageId >= receipt.lastReadMessageId) return;

        const { error } = await supabase
            .from(TABLE_NAME)
            .upsert([{
                room: receipt.room,
                user_id: receipt.userId,
                last_read_message_id: receipt.lastReadMessageId,
                updated_at: new Date().toISOString()
            }], { onConflict: "room,user_id" });

        if (error) {
            warnSupabaseFallback(error);
        }
    }

    async function listReadReceipts(room) {
        const cleanRoom = String(room || "").trim();
        const receiptsByUser = new Map();

        if (!cleanRoom) return [];

        [...memoryReceipts.values()]
            .filter((receipt) => receipt.room === cleanRoom)
            .forEach((receipt) => {
                receiptsByUser.set(receipt.userId, receipt);
            });

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select("room,user_id,last_read_message_id,updated_at")
            .eq("room", cleanRoom);

        if (error) {
            warnSupabaseFallback(error);
            return [...receiptsByUser.values()];
        }

        (data || [])
            .map(normalizeReceipt)
            .filter(Boolean)
            .forEach((receipt) => {
                const current = receiptsByUser.get(receipt.userId);

                if (!current || receipt.lastReadMessageId > current.lastReadMessageId) {
                    receiptsByUser.set(receipt.userId, receipt);
                }
            });

        return [...receiptsByUser.values()];
    }

    return {
        saveReadReceipt,
        listReadReceipts
    };
}

module.exports = {
    createReadReceiptsRepository
};
