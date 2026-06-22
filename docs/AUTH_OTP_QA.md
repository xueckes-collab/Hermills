# Hermills Email OTP QA Checklist

Use this checklist before publishing a Windows build that changes account registration or login.

## Local QA

- Open Hermills with cloud auth enabled.
- Open the registration page.
- Enter an invalid email.
- Confirm the app shows a validation error and does not call Supabase.
- Enter a valid test email.
- Accept the terms checkbox.
- Click send verification code.
- Confirm a loading state appears.
- Confirm the app shows a success message.
- Confirm the OTP input appears.
- Confirm the resend button shows a 60-second cooldown.
- Enter a non-6-digit code.
- Confirm the app blocks verification before calling Supabase.
- Enter a wrong 6-digit code.
- Confirm a friendly error appears.
- Confirm the user is not logged in.
- Wait for the resend cooldown.
- Request a new OTP.
- Enter the real OTP from the email.
- Confirm login succeeds.
- Confirm Hermills redirects to the authenticated workspace.
- Refresh / restart Hermills.
- Confirm the session persists.
- Log out.
- Confirm the protected workspace is blocked until login.

## Production QA

- Confirm production `SUPABASE_URL` exists.
- Confirm production `SUPABASE_ANON_KEY` exists.
- Confirm no service role key is packaged.
- Confirm Supabase Email provider is enabled.
- Confirm the email template contains `{{ .Token }}`.
- Confirm the email template does not rely only on `{{ .ConfirmationURL }}`.
- Confirm custom SMTP is configured.
- Confirm the sender domain is verified.
- Confirm a real Gmail inbox receives the OTP.
- Confirm a real Outlook inbox receives the OTP if possible.
- Check spam if the OTP does not arrive.
- Check Supabase Auth logs if the OTP does not arrive.
- Check SMTP provider logs if the OTP does not arrive.
- Confirm resend cooldown behavior.
- Confirm rate-limit behavior after repeated sends.
- Confirm invalid OTP does not authenticate.
- Confirm expired OTP does not authenticate.
- Confirm successful OTP creates a valid Supabase session.
- Confirm the account profile row is created or updated after login.

## Expected Network Calls

- Send code: `POST /auth/v1/otp`
- Verify code: `POST /auth/v1/verify` with `type: "email"`
- Password login for existing password users: `POST /auth/v1/token?grant_type=password`

Hermills should not use `/auth/v1/signup` for the visible-code registration flow, and should not use `/auth/v1/resend` for resend-code in this flow.
