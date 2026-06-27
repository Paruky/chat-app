# Notifications

Push notifications use the existing `web-push` package.

## Server setup

Generate VAPID keys:

```sh
npx web-push generate-vapid-keys
```

Set these environment variables on Render:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`, for example `mailto:you@example.com`

## Supabase table

The app can temporarily fall back to memory, but real deploys should keep
subscriptions in Supabase:

```sql
create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id text not null,
  account_name text,
  subscription jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions(user_id);

create index if not exists push_subscriptions_account_name_idx
  on push_subscriptions(account_name);
```

## iPhone test flow

1. Deploy the app with the VAPID environment variables.
2. Open the deployed app in Safari.
3. Add it to the Home Screen.
4. Open the Home Screen app and log in.
5. Go to Settings and turn notifications on.
6. Send a message from another account or browser and confirm the iPhone banner appears.

This succeeded on the real iPhone PWA from another account, so the visible
version was promoted to `Alpha 1.0`.

## Foreground behavior

- If the app is open on the same room or DM as the incoming message, the push is suppressed.
- If the app is open somewhere else and notifications are on, the banner is suppressed and the app requests a short vibration when the browser supports it.
- If the app is not visibly open, the normal notification banner is shown.

## Display format

Notifications put the sender in the title, then the conversation label and
message preview in the body.
