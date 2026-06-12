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

    return {
        listMessages,
        createMessage
    };
}

module.exports = {
    createMessagesRepository
};
