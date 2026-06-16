# Hermills Cloud Learning MVP

This MVP keeps Hermills local-first while adding optional cloud identity and learning data.

## Environment

Set these before packaging a cloud-enabled build:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
HERMILLS_CLOUD_REQUIRED=1
```

Use `HERMILLS_CLOUD_REQUIRED=0` for local/offline builds that should never block on login.

For Windows releases, copy `build/hermills-cloud.example.json` to `build/hermills-cloud.json` and fill in the public Supabase URL and anon key before packaging. `electron-builder` includes `build/hermills-cloud.json` as an app resource. Do not commit the real file.

## Database

Apply the migration in:

```text
supabase/migrations/202606160116_cloud_learning_mvp.sql
```

It creates:

- user-owned account, seller profile, customer, email generation, edit, outcome, event log tables.
- anonymized `learning_events`, `learning_rules`, and `golden_samples` tables for Learning Pack assembly.
- RLS policies so each authenticated user can only read/write their own private rows.
- global anonymous learning rules can be read by all signed-in users.

## Privacy Boundary

Hermills does not upload local provider API keys, SMTP passwords, OAuth refresh tokens, or sender mailbox secrets.

Cloud auth refresh tokens are encrypted through the existing local credential vault as `credential:hermills-cloud-auth`. General sync state is stored under `data/cloud-sync-state.json`.

The first sync pass uploads:

- seller/company profile summary.
- customer records with sanitized website/email-like text.
- generated email drafts with redacted email addresses, URLs, and secret-looking tokens.
- anonymized learning events from draft quality, customer type, angle, CTA, sent/replied flags.

## Product Behavior

If Supabase is not configured, Hermills keeps running locally. The cloud status endpoint returns `configured: false`; writing emails and managing customers still works.

If Supabase is configured and `HERMILLS_CLOUD_REQUIRED` is not `0`, the renderer shows the login gate before the workspace. After login, Hermills auto-syncs once and the user can manually sync from the outreach sidebar.
