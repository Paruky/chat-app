# Architecture

## Folder map

- `server/server.js` starts the app.
- `server/config.js` reads environment settings.
- `server/supabase.js` creates the Supabase client.
- `server/repositories/` keeps database access in one place.
- `server/pushNotifications.js` owns Web Push setup, API routes, and notification sending.
- `server/socketHandlers.js` owns realtime chat events.
- `public/js/app.mjs` wires the browser app together.
- `public/js/messages.mjs` renders chat messages.
- `public/js/messageActions.mjs` owns the right-click and long-press message action menu.
- `public/js/notifications.mjs` owns browser notification subscription and unsubscribe behavior.
- `public/js/rooms.mjs` renders the room list and unread badges.
- `public/js/typing.mjs` owns typing indicators.
- `public/js/storage.mjs` owns localStorage access.
- `public/js/version.mjs` owns the visible app version.

## Adding features

1. Add database reads and writes to a repository file.
2. Add realtime events in `server/socketHandlers.js`.
3. Add browser behavior in a focused file under `public/js/`.
4. Wire the new feature from `public/js/app.mjs`.

Before pushing a visible update, check `docs/versioning.md` and update the version when it feels right.

## Current next items

- Keep improving mobile PWA input behavior.
- Keep iPhone push notifications stable after future messaging changes.
- Add a visible error message area for failed sends or failed room joins.
- Add basic automated browser checks once the app has stable test data.
