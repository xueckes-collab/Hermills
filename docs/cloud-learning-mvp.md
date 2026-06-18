# Hermills Cloud Learning MVP

This MVP keeps Hermills local-first while adding optional cloud identity and learning data.

## Environment

Set these before packaging a cloud-enabled build:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
HERMILLS_CLOUD_REQUIRED=1
HERMILLS_CHAT_RELAY_URL=https://your-chat-relay.example.com
```

Use `HERMILLS_CLOUD_REQUIRED=0` for local/offline builds that should never block on login.

For Windows releases, copy `build/hermills-cloud.example.json` to `build/hermills-cloud.json` and fill in the public Supabase URL, anon key, and chat relay URL before packaging. `electron-builder` includes `build/hermills-cloud.json` as an app resource. Do not commit the real file.

## Database

Apply the migration in:

```text
supabase/migrations/202606160116_cloud_learning_mvp.sql
supabase/migrations/202606180101_chat_control_relay.sql
```

It creates:

- user-owned account, seller profile, customer, email generation, edit, outcome, event log tables.
- anonymized `learning_events`, `learning_rules`, and `golden_samples` tables for Learning Pack assembly.
- RLS policies so each authenticated user can only read/write their own private rows.
- global anonymous learning rules can be read by all signed-in users.
- `hermills_chat_binding_sessions` and `hermills_chat_commands` tables for phone/desktop chat-control relay.

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

## Chat-Control Relay

The desktop app never exposes its local `127.0.0.1` API to Feishu, DingTalk, WeCom, WeChat, or QQ. Those platforms must call a cloud relay. The relay writes normalized commands into `hermills_chat_commands`; the desktop app polls `/api/chat-control/cloud/poll`, executes the command locally, and writes the result back to the same command row.

If `HERMILLS_CHAT_RELAY_URL` is not configured, the QR code is only a local preview and the UI still offers a local “测试连接” button. Real platform scanning requires:

- official platform app/bot credentials in the relay server.
- the Supabase migration above applied with RLS enabled.
- the packaged app configured with `chatRelayUrl` in `build/hermills-cloud.json`.
