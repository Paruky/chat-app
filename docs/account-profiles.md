# Paruky Chat Account Profiles

Paruky Chat uses an in-app account name for invites and DMs.

## Rules

- Account names are saved in `public.user_profiles`.
- Users must set a Paruky Chat account name before connecting to rooms.
- Japanese names are supported.
- Names must be 1 to 20 characters.
- Spaces and `# / : ? & %` are blocked because room routes and invite keys use
  those characters.
- Display keeps the user's original casing.
- Matching uses the lowercased `account_key`.

## Security

The browser never reads or writes `user_profiles` directly. The table has RLS
enabled and grants are revoked from `anon` and `authenticated`; the Node server
uses the service role key through `/api/profile`.

## Related Data

When a user changes their Paruky Chat account name, the server also updates:

- room owner account display fields,
- room member account display fields for the same `user_id`,
- push subscription account names for the same `user_id`.

OAuth-derived account keys are kept as temporary compatibility aliases in the
authenticated server session. This keeps older DM room names visible after a
user chooses a cleaner Paruky Chat account name.
