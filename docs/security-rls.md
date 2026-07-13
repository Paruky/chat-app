# Security and RLS

Paruky Chat now treats the Express/Socket.IO server as the only database writer.
The browser may keep the Supabase publishable key for GitHub login, but it must
not read or write chat tables directly.

## Required Render environment variables

Set these before enabling RLS:

```sh
SUPABASE_URL=https://duowjfmjbvfknrvjygll.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
VERSION_HISTORY_EDITOR_ACCOUNTS=Paruky
```

Prefer `VERSION_HISTORY_EDITOR_USER_IDS` when you know the Supabase Auth user ID.
Keep the service role key only on Render/server-side environments. Never paste it
into `public/js/config.mjs` or any browser file.

## Production RLS SQL

Run this in the Supabase SQL Editor only after the server environment uses the
service role key. It closes direct browser access to the chat tables and leaves
the server-side service role as the database boundary.

```sql
begin;

alter table public.messages enable row level security;
alter table public.rooms enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.version_history enable row level security;
alter table public.read_receipts enable row level security;
alter table public.message_reactions enable row level security;

revoke all on table public.messages from anon, authenticated;
revoke all on table public.rooms from anon, authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.version_history from anon, authenticated;
revoke all on table public.read_receipts from anon, authenticated;
revoke all on table public.message_reactions from anon, authenticated;

grant select, insert, update, delete on table public.messages to service_role;
grant select, insert, update, delete on table public.rooms to service_role;
grant select, insert, update, delete on table public.push_subscriptions to service_role;
grant select, insert, update, delete on table public.version_history to service_role;
grant select, insert, update, delete on table public.read_receipts to service_role;
grant select, insert, update, delete on table public.message_reactions to service_role;

revoke usage, select on sequence public.messages_id_seq from anon, authenticated;
revoke usage, select on sequence public.rooms_id_seq from anon, authenticated;
revoke usage, select on sequence public.version_history_id_seq from anon, authenticated;

grant usage, select on sequence public.messages_id_seq to service_role;
grant usage, select on sequence public.rooms_id_seq to service_role;
grant usage, select on sequence public.version_history_id_seq to service_role;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

notify pgrst, 'reload schema';

commit;
```

## Verification

After deploy and SQL:

1. Sign in and send a message.
2. Edit/delete your own message.
3. Add a reaction and a read receipt by opening the room on another account.
4. Turn notifications on from Settings.
5. Open Settings > Version history and confirm Paruky can edit it.
6. Run Supabase Security Advisors and confirm there are no `RLS Disabled in Public` findings.

Supabase currently also warns when leaked password protection is disabled. This
app primarily uses GitHub OAuth, but enable that Auth setting too if password
login is added later.

## Current policy model

- Browser clients authenticate with Supabase Auth and send the access token to the app server.
- The app server verifies tokens with `supabase.auth.getUser`.
- Chat table reads and writes go through server repositories using the server-only service role key.
- Socket events ignore client-supplied `userId` for persistent actions.
- Authorization checks use the Supabase Auth user ID plus OAuth identity/email
  data. Do not use user-editable `user_metadata` for new permission checks.
- DM sockets are accepted only when the authenticated account is part of the DM room name.
- Version history writes require the server-side editor allowlist.
