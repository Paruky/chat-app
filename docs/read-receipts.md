# Read Receipts

既読機能は `/server/repositories/readReceiptsRepository.js` が担当します。

## Supabase table

Use this table for persistent read receipts:

```sql
create table if not exists read_receipts (
  room text not null,
  user_id text not null,
  last_read_message_id bigint not null,
  updated_at timestamptz not null default now(),
  primary key (room, user_id)
);

create index if not exists read_receipts_room_idx
  on read_receipts(room);
```

After creating the table, apply the production RLS setup in
`docs/security-rls.md`. Read receipts are written by the app server, not directly
by browser clients.

If the table is missing or blocked by permissions, the server falls back to
memory for the current process only.
