const TABLE_NAME = "version_history";

function createMemoryEntry(entry) {
    const now = new Date().toISOString();

    return {
        id: `vh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        version: entry.version,
        notes: entry.notes,
        createdAt: now,
        updatedAt: now
    };
}

function normalizeEntry(record) {
    if (!record?.id) return null;

    return {
        id: String(record.id),
        version: String(record.version || ""),
        notes: String(record.notes || ""),
        createdAt: record.created_at || record.createdAt || "",
        updatedAt: record.updated_at || record.updatedAt || ""
    };
}

function sortEntries(entries) {
    return [...entries].sort((left, right) =>
        String(right.createdAt || "").localeCompare(String(left.createdAt || ""))
    );
}

function createVersionHistoryRepository(supabase) {
    const memoryEntries = new Map();
    let hasWarnedAboutSupabase = false;

    function warnSupabaseFallback(error) {
        if (hasWarnedAboutSupabase) return;

        hasWarnedAboutSupabase = true;
        console.warn(
            `[version-history] Supabase table unavailable or blocked by permissions, using in-memory fallback: ${error.message}`
        );
    }

    async function flushMemoryEntriesToSupabase() {
        if (memoryEntries.size === 0) return [];

        const entries = [...memoryEntries.values()];
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .insert(entries.map((entry) => ({
                version: entry.version,
                notes: entry.notes
            })))
            .select("id,version,notes,created_at,updated_at");

        if (error) {
            warnSupabaseFallback(error);
            return entries;
        }

        memoryEntries.clear();

        return (data || [])
            .map(normalizeEntry)
            .filter(Boolean);
    }

    async function listEntries() {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select("id,version,notes,created_at,updated_at")
            .order("created_at", { ascending: false });

        if (error) {
            warnSupabaseFallback(error);
            return sortEntries([...memoryEntries.values()]);
        }

        const persistedMemoryEntries = await flushMemoryEntriesToSupabase();
        const entries = (data || [])
            .map(normalizeEntry)
            .filter(Boolean);

        return sortEntries([...persistedMemoryEntries, ...entries]);
    }

    async function createEntry(entry) {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .insert([{
                version: entry.version,
                notes: entry.notes
            }])
            .select("id,version,notes,created_at,updated_at")
            .single();

        if (error) {
            const memoryEntry = createMemoryEntry(entry);

            memoryEntries.set(memoryEntry.id, memoryEntry);
            warnSupabaseFallback(error);
            return memoryEntry;
        }

        const normalized = normalizeEntry(data);

        return normalized || createMemoryEntry(entry);
    }

    async function updateEntry(id, entry) {
        const currentEntry = memoryEntries.get(String(id));
        const updatedEntry = {
            ...(currentEntry || createMemoryEntry(entry)),
            id: String(id),
            version: entry.version,
            notes: entry.notes,
            updatedAt: new Date().toISOString()
        };

        if (currentEntry) {
            memoryEntries.set(updatedEntry.id, updatedEntry);
            return updatedEntry;
        }

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .update({
                version: entry.version,
                notes: entry.notes,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select("id,version,notes,created_at,updated_at")
            .single();

        if (error) {
            warnSupabaseFallback(error);
            return updatedEntry;
        }

        const normalized = normalizeEntry(data);

        return normalized || updatedEntry;
    }

    async function deleteEntry(id) {
        memoryEntries.delete(String(id));

        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq("id", id);

        if (error) {
            warnSupabaseFallback(error);
        }
    }

    return {
        listEntries,
        createEntry,
        updateEntry,
        deleteEntry
    };
}

module.exports = {
    createVersionHistoryRepository
};
