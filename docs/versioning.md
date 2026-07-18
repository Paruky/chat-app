# Versioning

This app uses visible versions because it is cool.

The public reason is simple: friends can tell when an update arrived.
The real reason is also simple: it makes the app feel cooler.

## Current Version

Ver 1.1

## Rules

- Use a stage name plus major and minor numbers, such as `Beta 1.0`.
- During the beta period, keep the visible label as `Beta X.Y`.
- `Alpha 1.0` started when iPhone push notifications worked from another account.
- `Alpha 1.1` added clickable hyperlinks in messages.
- `Alpha 1.2` added large bubble-free emoji-only messages.
- `Alpha 1.3` added soft message deletion from the message action menu.
- `Alpha 1.4` tuned foreground push notifications by current conversation. Also, made push notifications lead with the sender, then the room, then the message.
- `Alpha 1.5` fixed image message bubble sizing, cleared notifications when read, and moved the version badge to the top right.
- `Alpha 1.6` added the in-app version history page with PC editing and mobile read-only viewing.
- `Alpha 1.7` added send-with-effect messages, including bubble effects and screen effects from a long-press send menu.
- `Alpha 1.8` added general file attachments for PDFs, HTML, and other small files.
- `Alpha 1.9` added canned messages with shared presets and account-scoped custom phrases.
- `Alpha 1.10` added loading screen in message loading.
- `Alpha 1.11` fixed the version badge being selected while opening the message action menu.
- `Alpha 1.12` added emoji reactions from the message action menu and reaction pills.
- `Ver 1.0` is the first official release. It landed after the production
  Supabase tables had RLS enabled, public table grants revoked, Render used
  `SUPABASE_SERVICE_ROLE_KEY`, direct table access was denied, and the app still
  worked normally.
- `Ver 1.1` added the new message inbox at the top of the menu, showing who sent
  the message, the preview, and where it came from.
- Raise the major number when the update feels big.
- Raise the minor number for smaller updates and bug fixes.
- There is no strict corporate-style line. Coolness and update feeling matter.
- From this point, use `Ver X.Y` for official releases.

## Before Pushing

1. Decide whether this push deserves a version bump.
2. Update `public/js/version.mjs`.
3. Keep the small top-right display working.
4. Mention the version in the commit message when it helps.
