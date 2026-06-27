function createMessagesRepository(supabase) {
    async function listMessages(room) {
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("room", room)
            .order("id", { ascending: true });

        if (error) throw error;

        return data || [];
    }

    async function createMessage(message) {
        const { data, error } = await supabase
            .from("messages")
            .insert([message])
            .select()
            .single();

        if (error) throw error;

        return data;
    }

    async function updateMessage({ id, room, userId, message }) {
        const { data, error } = await supabase
            .from("messages")
            .update({ message })
            .eq("id", id)
            .eq("room", room)
            .eq("userId", userId)
            .select()
            .single();

        if (error) throw error;

        return data;
    }

    async function deleteMessage({ id, room, userId, message }) {
        const { data, error } = await supabase
            .from("messages")
            .update({ message })
            .eq("id", id)
            .eq("room", room)
            .eq("userId", userId)
            .select()
            .single();

        if (error) throw error;

        return data;
    }

    return {
        listMessages,
        createMessage,
        updateMessage,
        deleteMessage
    };
}

module.exports = {
    createMessagesRepository
};
