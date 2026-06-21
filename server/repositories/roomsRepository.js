function createRoomsRepository(supabase) {
    async function listRooms() {
        const { data, error } = await supabase
            .from("rooms")
            .select("name")
            .order("name", { ascending: true });

        if (error) throw error;

        return [...new Set((data || []).map((room) => room.name).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, "ja"));
    }

    async function saveRoom(name) {
        const { error } = await supabase
            .from("rooms")
            .upsert([{ name }], { onConflict: "name" });

        if (error) throw error;
    }

    async function deleteRoom(name) {
        const { error } = await supabase
            .from("rooms")
            .delete()
            .eq("name", name);

        if (error) throw error;
    }

    return {
        listRooms,
        saveRoom,
        deleteRoom
    };
}

module.exports = {
    createRoomsRepository
};
