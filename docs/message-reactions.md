# Message Reactions

絵文字リアクションは `/server/repositories/messageReactionsRepository.js` が担当します。

## Supabase table

Use this table for persistent message reactions:

```sql
create table if not exists message_reactions (
  room text not null,
  message_id bigint not null,
  user_id text not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (room, message_id, user_id, emoji)
);

create index if not exists message_reactions_room_message_idx
  on message_reactions(room, message_id);

alter table message_reactions disable row level security;

grant select, insert, update, delete on table message_reactions
  to anon, authenticated;
```

If the table is missing or blocked by permissions, the server falls back to
memory for the current process only.
