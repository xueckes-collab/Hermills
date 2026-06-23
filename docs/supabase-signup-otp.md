# Supabase signup OTP setup

This file is kept as a short pointer for older references.

Use the current setup guide instead:

- `docs/SUPABASE_EMAIL_OTP_SETUP.md`
- `docs/AUTH_OTP_QA.md`

Hermills is a Windows desktop app, so signup confirmation must happen inside the app. The Supabase email template must include `{{ .Token }}` so the user receives a visible numeric code. Do not send users to a hosted callback page such as `anybot-api.onrender.com`.
