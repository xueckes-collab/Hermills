# Supabase signup OTP setup

Hermills is a Windows desktop app, so signup confirmation must happen inside the app.
Do not send users to a hosted web callback such as `anybot-api.onrender.com`.

In Supabase Dashboard:

1. Open Authentication -> Email Templates.
2. Edit the "Confirm signup" template.
3. Use `{{ .Token }}` in the email body so the user receives a numeric code.
4. Do not make the primary action a `{{ .ConfirmationURL }}` link.

Suggested subject:

```text
Hermills 邮箱验证码
```

Suggested body:

```html
<h2>Your Hermills verification code</h2>
<p>Use this code in Hermills to finish creating your account:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{{ .Token }}</p>
<p>This code expires shortly. If you did not request this, you can ignore this email.</p>
```

The Hermills app verifies the code with Supabase Auth using the email OTP flow.
