const DM_PREFIX = "dm:";
const LEGACY_DM_KEY_LENGTH = 12;

const {
    getAccountKey,
    normalizeAccountName,
    validateAccountName
} = require("../accountNames");

function accountKeysEqual(left, right) {
    const leftKey = getAccountKey(left);
    const rightKey = getAccountKey(right);

    return Boolean(leftKey && rightKey) && leftKey === rightKey;
}

function accountKeyMatchesDmSegment(segment, userKey) {
    const segmentKey = getAccountKey(segment);
    const accountKey = getAccountKey(userKey);

    if (!segmentKey || !accountKey) return false;
    if (segmentKey === accountKey) return true;

    return segmentKey.length <= LEGACY_DM_KEY_LENGTH &&
        accountKey.startsWith(segmentKey);
}

function getUserAccountKeys(user) {
    return [
        user?.accountKey,
        ...(Array.isArray(user?.accountKeys) ? user.accountKeys : []),
        user?.accountName
    ].map(getAccountKey).filter(Boolean);
}

function userHasAccountKey(user, accountKey) {
    const targetKey = getAccountKey(accountKey);

    return Boolean(targetKey) &&
        getUserAccountKeys(user).some((userKey) => accountKeysEqual(userKey, targetKey));
}

function userMatchesDmSegment(user, segment) {
    return getUserAccountKeys(user).some((userKey) =>
        accountKeyMatchesDmSegment(segment, userKey)
    );
}

function isDmRoom(room) {
    return String(room || "").startsWith(DM_PREFIX);
}

function parseDmRoom(room) {
    if (!isDmRoom(room)) return [];

    const parts = String(room)
        .slice(DM_PREFIX.length)
        .split(":")
        .map(getAccountKey)
        .filter(Boolean);

    return parts.length >= 3 ? parts.slice(1, 3) : parts;
}

function canAccessDmRoom(user, room) {
    const users = parseDmRoom(room);

    return users.length === 2 &&
        users.some((accountName) => userMatchesDmSegment(user, accountName));
}

function createAccountMemberKey(accountName) {
    const accountKey = getAccountKey(accountName);

    return accountKey ? `account:${accountKey}` : "";
}

function createUserMemberKey(userId) {
    const cleanUserId = String(userId || "").trim();

    return cleanUserId ? `user:${cleanUserId}` : "";
}

function isRoomMemberRecord(user, member) {
    if (!member || !user) return false;

    return Boolean(
        (member.user_id && member.user_id === user.id) ||
        (member.account_key && userHasAccountKey(user, member.account_key))
    );
}

function isRoomOwnerRecord(user, room) {
    if (!user || !room) return false;

    const ownerMatches = Boolean(
        (room.owner_user_id && room.owner_user_id === user.id) ||
        (room.owner_account_key && userHasAccountKey(user, room.owner_account_key))
    );

    return ownerMatches || (room.room_members || []).some((member) =>
        member.role === "owner" && isRoomMemberRecord(user, member)
    );
}

function canAccessRoomRecord(user, room) {
    if (!user || !room) return false;
    if (isDmRoom(room.name)) {
        return canAccessDmRoom(user, room.name) ||
            (room.room_members || []).some((member) => isRoomMemberRecord(user, member));
    }

    return isRoomOwnerRecord(user, room) ||
        (room.room_members || []).some((member) => isRoomMemberRecord(user, member));
}

function normalizeMember(member) {
    return {
        memberKey: member.member_key,
        userId: member.user_id || "",
        accountName: member.account_name || "",
        accountKey: member.account_key || "",
        role: member.role || "member",
        createdAt: member.created_at || ""
    };
}

function createRoomSummary(room, user) {
    const members = (room.room_members || []).map(normalizeMember);
    const normalMembers = isDmRoom(room.name)
        ? []
        : members;

    return {
        name: room.name,
        ownerUserId: room.owner_user_id || "",
        ownerAccountName: room.owner_account_name || "",
        ownerAccountKey: room.owner_account_key || "",
        isDm: isDmRoom(room.name),
        isOwner: isRoomOwnerRecord(user, room),
        memberCount: normalMembers.length,
        members: normalMembers
    };
}

function createOwnerMember(user) {
    const accountName = normalizeAccountName(user?.accountName || user?.accountKey);
    const accountKey = getAccountKey(accountName);

    return {
        member_key: createAccountMemberKey(accountName) || createUserMemberKey(user?.id),
        user_id: user?.id || null,
        account_name: accountName || null,
        account_key: accountKey || null,
        role: "owner",
        created_by_user_id: user?.id || null,
        updated_at: new Date().toISOString()
    };
}

function createInvitedMember(accountName, user) {
    const normalizedAccountName = validateAccountName(accountName);
    const accountKey = getAccountKey(normalizedAccountName);

    return {
        member_key: createAccountMemberKey(normalizedAccountName),
        user_id: null,
        account_name: normalizedAccountName,
        account_key: accountKey,
        role: "member",
        created_by_user_id: user?.id || null,
        updated_at: new Date().toISOString()
    };
}

function assertNormalRoom(room) {
    if (!room || isDmRoom(room)) {
        const error = new Error("通常部屋だけ操作できます");
        error.code = "normal-room-required";
        throw error;
    }
}

function assertOwner(user, room) {
    if (!isRoomOwnerRecord(user, room)) {
        const error = new Error("部屋主だけ操作できます");
        error.code = "room-owner-required";
        throw error;
    }
}

function createRoomsRepository(supabase) {
    async function fetchRoom(name) {
        const { data, error } = await supabase
            .from("rooms")
            .select(`
                name,
                owner_user_id,
                owner_account_name,
                owner_account_key,
                room_members (
                    member_key,
                    user_id,
                    account_name,
                    account_key,
                    role,
                    created_at
                )
            `)
            .eq("name", name)
            .maybeSingle();

        if (error) throw error;

        return data || null;
    }

    async function listRoomsForUser(user) {
        const { data, error } = await supabase
            .from("rooms")
            .select(`
                name,
                owner_user_id,
                owner_account_name,
                owner_account_key,
                room_members (
                    member_key,
                    user_id,
                    account_name,
                    account_key,
                    role,
                    created_at
                )
            `)
            .order("name", { ascending: true });

        if (error) throw error;

        return (data || [])
            .filter((room) => canAccessRoomRecord(user, room))
            .map((room) => createRoomSummary(room, user))
            .sort((left, right) => left.name.localeCompare(right.name, "ja"));
    }

    async function listRooms() {
        const { data, error } = await supabase
            .from("rooms")
            .select("name")
            .order("name", { ascending: true });

        if (error) throw error;

        return [...new Set((data || []).map((room) => room.name).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, "ja"));
    }

    async function saveDmRoom(name) {
        const { error } = await supabase
            .from("rooms")
            .upsert([{ name, updated_at: new Date().toISOString() }], { onConflict: "name" });

        if (error) throw error;
    }

    async function saveOwnerMember(room, user) {
        const member = createOwnerMember(user);

        if (!member.member_key) return;

        const { error } = await supabase
            .from("room_members")
            .upsert([{ room, ...member }], { onConflict: "room,member_key" });

        if (error) throw error;
    }

    async function bindAccountMember(room, user) {
        const accountKey = getAccountKey(user?.accountKey || user?.accountName);

        if (!room || !accountKey || !user?.id) return;

        const { error } = await supabase
            .from("room_members")
            .update({
                user_id: user.id,
                updated_at: new Date().toISOString()
            })
            .eq("room", room)
            .eq("account_key", accountKey)
            .is("user_id", null);

        if (error) throw error;
    }

    async function createOwnedRoom(name, user) {
        const accountName = normalizeAccountName(user?.accountName || user?.accountKey);
        const accountKey = getAccountKey(accountName);
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from("rooms")
            .insert([{
                name,
                owner_user_id: user?.id || null,
                owner_account_name: accountName || null,
                owner_account_key: accountKey || null,
                updated_at: now
            }])
            .select(`
                name,
                owner_user_id,
                owner_account_name,
                owner_account_key
            `)
            .single();

        if (error) throw error;

        await saveOwnerMember(name, user);

        return data;
    }

    async function claimRoom(name, user) {
        const accountName = normalizeAccountName(user?.accountName || user?.accountKey);
        const accountKey = getAccountKey(accountName);

        const { data, error } = await supabase
            .from("rooms")
            .update({
                owner_user_id: user?.id || null,
                owner_account_name: accountName || null,
                owner_account_key: accountKey || null,
                updated_at: new Date().toISOString()
            })
            .eq("name", name)
            .is("owner_user_id", null)
            .select("name")
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        await saveOwnerMember(name, user);

        return fetchRoom(name);
    }

    async function ensureRoomForJoin(name, user) {
        if (isDmRoom(name)) {
            const currentDmRoom = await fetchRoom(name);

            if (!canAccessDmRoom(user, name) && !canAccessRoomRecord(user, currentDmRoom)) {
                return null;
            }

            await saveDmRoom(name);
            await saveOwnerMember(name, user);
            return fetchRoom(name);
        }

        let room = await fetchRoom(name);

        if (!room) {
            await createOwnedRoom(name, user);
            return fetchRoom(name);
        }

        if (canAccessRoomRecord(user, room)) {
            await bindAccountMember(name, user);
            return room;
        }

        if (!room.owner_user_id && (room.room_members || []).length === 0) {
            room = await claimRoom(name, user);

            if (room) return room;
        }

        return null;
    }

    async function canUserAccessRoom(name, user) {
        const room = await fetchRoom(name);

        return canAccessRoomRecord(user, room);
    }

    async function renameRoom({ room, nextName, user }) {
        assertNormalRoom(room);
        assertNormalRoom(nextName);

        const currentRoom = await fetchRoom(room);

        if (!currentRoom) return null;

        assertOwner(user, currentRoom);

        const duplicate = await fetchRoom(nextName);

        if (duplicate && duplicate.name !== room) {
            const error = new Error("同じ名前の部屋がすでにあります");
            error.code = "room-name-taken";
            throw error;
        }

        const { data, error } = await supabase
            .from("rooms")
            .update({
                name: nextName,
                updated_at: new Date().toISOString()
            })
            .eq("name", room)
            .select(`
                name,
                owner_user_id,
                owner_account_name,
                owner_account_key,
                room_members (
                    member_key,
                    user_id,
                    account_name,
                    account_key,
                    role,
                    created_at
                )
            `)
            .single();

        if (error) throw error;

        return createRoomSummary(data, user);
    }

    async function deleteRoom({ room, user }) {
        assertNormalRoom(room);

        const currentRoom = await fetchRoom(room);

        if (!currentRoom) return false;

        assertOwner(user, currentRoom);

        const { error } = await supabase
            .from("rooms")
            .delete()
            .eq("name", room);

        if (error) throw error;

        return true;
    }

    async function deleteDmRoom(name) {
        const { error } = await supabase
            .from("rooms")
            .delete()
            .eq("name", name);

        if (error) throw error;
    }

    async function listRoomMembers(room, user) {
        assertNormalRoom(room);

        const currentRoom = await fetchRoom(room);

        if (!currentRoom || !canAccessRoomRecord(user, currentRoom)) return null;

        return currentRoom.room_members
            .map(normalizeMember)
            .sort((left, right) =>
                left.role === right.role
                    ? (left.accountName || left.userId).localeCompare(right.accountName || right.userId, "ja")
                    : left.role === "owner"
                        ? -1
                        : 1
            );
    }

    async function addRoomMember({ room, accountName, user }) {
        assertNormalRoom(room);

        const currentRoom = await fetchRoom(room);

        if (!currentRoom) return null;

        assertOwner(user, currentRoom);

        const member = createInvitedMember(accountName, user);

        if (!member.member_key || !member.account_key) {
            const error = new Error("アカウント名を入力してください");
            error.code = "invalid-account-name";
            throw error;
        }

        const { error } = await supabase
            .from("room_members")
            .upsert([{ room, ...member }], { onConflict: "room,member_key" });

        if (error) throw error;

        return listRoomMembers(room, user);
    }

    async function removeRoomMember({ room, memberKey, user }) {
        assertNormalRoom(room);

        const currentRoom = await fetchRoom(room);

        if (!currentRoom) return null;

        assertOwner(user, currentRoom);

        const target = (currentRoom.room_members || []).find((member) =>
            member.member_key === memberKey
        );

        if (!target) return listRoomMembers(room, user);

        if (target.role === "owner") {
            const error = new Error("部屋主は削除できません");
            error.code = "cannot-remove-owner";
            throw error;
        }

        const { error } = await supabase
            .from("room_members")
            .delete()
            .eq("room", room)
            .eq("member_key", memberKey);

        if (error) throw error;

        return listRoomMembers(room, user);
    }

    return {
        addRoomMember,
        canUserAccessRoom,
        deleteDmRoom,
        deleteRoom,
        ensureRoomForJoin,
        listRoomMembers,
        listRooms,
        listRoomsForUser,
        removeRoomMember,
        renameRoom,
        saveDmRoom
    };
}

module.exports = {
    createRoomsRepository,
    getAccountKey,
    isDmRoom
};
