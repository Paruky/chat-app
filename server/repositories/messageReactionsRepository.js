const TABLE_NAME = "message_reactions";

const EMOJI_MARKER_PATTERN = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}]/u;

function normalizeMessageId(value) {
    const id = Number.parseInt(String(value || ""), 10);

    return Number.isFinite(id) && id > 0 ? id : 0;
}

function splitGraphemes(value) {
    const text = String(value || "").trim();

    if (!text) return [];

    if ("Segmenter" in Intl) {
        const segmenter = new Intl.Segmenter(undefined, {
            granularity: "grapheme"
        });

        return [...segmenter.segment(text)].map((part) => part.segment);
    }

    return Array.from(text);
}

function normalizeEmoji(value) {
    const parts = splitGraphemes(value).filter((part) => !/^\s+$/u.test(part));

    if (parts.length !== 1) return "";
    if (!EMOJI_MARKER_PATTERN.test(parts[0])) return "";

    return parts[0].slice(0, 24);
}

function createReactionKey(reaction) {
    return [
        reaction.room,
        reaction.messageId,
        reaction.userId,
        reaction.emoji
    ].join("::");
}

function normalizeReaction(record) {
    const room = String(record?.room || "").trim();
    const messageId = normalizeMessageId(record?.message_id || record?.messageId);
    const userId = String(record?.user_id || record?.userId || "").trim().slice(0, 160);
    const emoji = normalizeEmoji(record?.emoji);

    if (!room || !messageId || !userId || !emoji) return null;

    return {
        room,
        messageId,
        userId,
        emoji,
        createdAt: record.created_at || record.createdAt || ""
    };
}

function createMessageReactionsRepository(supabase) {
    const memoryReactions = new Map();
    let hasWarnedAboutSupabase = false;

    function warnSupabaseFallback(error) {
        if (hasWarnedAboutSupabase) return;

        hasWarnedAboutSupabase = true;
        console.warn(
            `[message-reactions] Supabase table unavailable, using in-memory fallback: ${error.message}`
        );
    }

    function toggleInMemory(reaction) {
        const key = createReactionKey(reaction);

        if (memoryReactions.has(key)) {
            memoryReactions.delete(key);
            return false;
        }

        memoryReactions.set(key, {
            ...reaction,
            createdAt: new Date().toISOString()
        });
        return true;
    }

    async function toggleReaction(input) {
        const reaction = normalizeReaction({
            room: input.room,
            message_id: input.messageId,
            user_id: input.userId,
            emoji: input.emoji
        });

        if (!reaction) return null;

        const query = supabase
            .from(TABLE_NAME)
            .select("room,message_id,user_id,emoji")
            .eq("room", reaction.room)
            .eq("message_id", reaction.messageId)
            .eq("user_id", reaction.userId)
            .eq("emoji", reaction.emoji);

        const { data: currentRecord, error: currentError } = await query.maybeSingle();

        if (currentError) {
            warnSupabaseFallback(currentError);
            return {
                reaction,
                isActive: toggleInMemory(reaction)
            };
        }

        const existingReaction = normalizeReaction(currentRecord);

        if (existingReaction) {
            memoryReactions.delete(createReactionKey(reaction));

            const { error } = await supabase
                .from(TABLE_NAME)
                .delete()
                .eq("room", reaction.room)
                .eq("message_id", reaction.messageId)
                .eq("user_id", reaction.userId)
                .eq("emoji", reaction.emoji);

            if (error) {
                warnSupabaseFallback(error);
            }

            return {
                reaction,
                isActive: false
            };
        }

        const { error } = await supabase
            .from(TABLE_NAME)
            .insert([{
                room: reaction.room,
                message_id: reaction.messageId,
                user_id: reaction.userId,
                emoji: reaction.emoji
            }]);

        if (error) {
            warnSupabaseFallback(error);
            return {
                reaction,
                isActive: toggleInMemory(reaction)
            };
        }

        memoryReactions.delete(createReactionKey(reaction));

        return {
            reaction,
            isActive: true
        };
    }

    async function listReactions(room) {
        const cleanRoom = String(room || "").trim();
        const reactionsByKey = new Map();

        if (!cleanRoom) return [];

        [...memoryReactions.values()]
            .filter((reaction) => reaction.room === cleanRoom)
            .forEach((reaction) => {
                reactionsByKey.set(createReactionKey(reaction), reaction);
            });

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select("room,message_id,user_id,emoji,created_at")
            .eq("room", cleanRoom);

        if (error) {
            warnSupabaseFallback(error);
            return [...reactionsByKey.values()];
        }

        (data || [])
            .map(normalizeReaction)
            .filter(Boolean)
            .forEach((reaction) => {
                reactionsByKey.set(createReactionKey(reaction), reaction);
            });

        return [...reactionsByKey.values()];
    }

    return {
        toggleReaction,
        listReactions
    };
}

module.exports = {
    createMessageReactionsRepository
};
