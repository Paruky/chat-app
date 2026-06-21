# Versioning

This app uses visible versions because it is cool.

The public reason is simple: friends can tell when an update arrived.
The real reason is also simple: it makes the app feel cooler.

## Current Version

Beta 1.3

## Rules

- Use a stage name plus major and minor numbers, such as `Beta 1.0`.
- During the beta period, keep the visible label as `Beta X.Y`.
- Raise the major number when the update feels big.
- Raise the minor number for smaller updates and bug fixes.
- There is no strict corporate-style line. Coolness and update feeling matter.
- When the app feels ready for normal daily chat use, call it the official release and move to `ver1.0`.

## Before Pushing

1. Decide whether this push deserves a version bump.
2. Update `public/js/version.mjs`.
3. Keep the small bottom-left display working.
4. Mention the version in the commit message when it helps.
