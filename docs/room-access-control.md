# Room Access Control

Rooms are invite-only from `Ver 1.2`.

## Model

- DM rooms keep using the existing `dm:` room name format.
- Normal rooms use `rooms.name` as the current room key.
- `rooms.owner_user_id` / `rooms.owner_account_key` identify the room owner.
- `room_members` stores invited users by normalized account key and, once known,
  Supabase Auth user ID.

## Permissions

- A normal room can be joined only by its owner or a row in `room_members`.
- The room owner can rename the room, delete the room, add members, and remove
  non-owner members.
- Removing a member kicks that member out if they are currently in the room.
- Room notifications are delivered only to users that still have access.

## Database Notes

Room renames depend on these foreign keys:

- `messages.room -> rooms.name on update cascade on delete cascade`
- `read_receipts.room -> rooms.name on update cascade on delete cascade`
- `message_reactions.room -> rooms.name on update cascade on delete cascade`
- `room_members.room -> rooms.name on update cascade on delete cascade`

This keeps old messages and reactions attached when the room owner changes the
room name.
