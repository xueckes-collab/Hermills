# Supabase Email OTP Setup

Hermills uses Supabase Auth Email OTP for desktop signup verification. The app sends the code through Supabase Auth and verifies the code inside the Windows app. Users should not be sent to a hosted callback page or a magic-link-only page.

## Required Dashboard Settings

1. Open the Supabase Dashboard.
2. Select the Hermills project.
3. Go to Authentication -> Providers.
4. Enable the Email provider.
5. Go to Authentication -> Email Templates.
6. Edit the email template used for signup / magic link / OTP.
7. Make the code visible in the email body:

```html
<p>Your Hermills verification code is:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{{ .Token }}</p>
```

8. Do not make the only useful action a `{{ .ConfirmationURL }}` button. Hermills needs the user to copy the numeric code into the desktop app.
9. Confirm the Site URL matches the production app or landing page.
10. Add local development and production redirect URLs if redirects are used elsewhere.
11. Configure custom SMTP for production.
12. Verify the sender domain if using Resend, SendGrid, Mailgun, AWS SES, Postmark, Brevo, or another SMTP provider.
13. Review Authentication -> Rate Limits.
14. For production abuse protection, consider CAPTCHA or other bot protection.
15. Test with a real inbox before shipping.

## Environment Variables

Hermills server reads these values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
HERMILLS_CLOUD_REQUIRED=0
HERMILLS_ACCOUNT_LOGIN_ENABLED=0
```

Hermills currently ships with account login disabled. To turn the login gate back on after production SMTP is reliable, set both `HERMILLS_ACCOUNT_LOGIN_ENABLED=1` and `HERMILLS_CLOUD_REQUIRED=1`.

For Windows releases, copy `build/hermills-cloud.example.json` to `build/hermills-cloud.json` and fill in the public Supabase URL and anon key before packaging. Do not commit the real file.

Never expose the Supabase service role key in renderer code, packaged resources, or public repositories.

## Why Emails May Still Not Arrive

Real email delivery can fail even if the Hermills code is correct when:

- The Supabase email template still only sends a magic link.
- `{{ .Token }}` is missing from the template.
- Custom SMTP is not configured for production.
- The sender domain is not verified.
- The email provider blocks or throttles the message.
- The email lands in spam.
- Supabase Auth rate limits are hit.
- Production environment variables are missing or incorrect.

## Expected App Flow

1. User enters email and accepts terms.
2. Hermills server calls Supabase Auth `/auth/v1/otp`.
3. Supabase sends a visible 6-digit code.
4. User enters the code in Hermills.
5. Hermills server calls Supabase Auth `/auth/v1/verify` with `type: "email"`.
6. Supabase returns a session.
7. Hermills stores the session locally in the encrypted credential vault.
8. Hermills redirects into the authenticated workspace.
