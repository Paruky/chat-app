# Todo

## Stability

- Keep bumping the visible version before push-worthy updates.
- Keep checking iOS PWA send-button behavior.
- Show a friendly error when a room join or message send fails.
- Add a small browser test for joining a room and sending a message.

## Rooms

- Keep room order stable and easy to scan.
- Consider pinning favorite rooms.
- Consider room search when the list grows.

## Messages

- Consider image upload.
- Consider reactions.
- Consider message delete.

## Notifications

- Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in Render.
- Create the `push_subscriptions` table in Supabase for persistent notifications.
- Test push notifications on an iPhone Home Screen PWA before calling this Alpha 1.0.
- Keep unread badges reliable across reloads.
