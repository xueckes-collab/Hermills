# Local Desktop Clean-Machine Acceptance

This checklist verifies a packaged Hermills desktop build on a clean macOS machine or a fresh macOS user account. It is intended for release acceptance, not day-to-day development.

## Scope

- Confirms the packaged renderer loads from `file://` with relative `assets/` references.
- Confirms alpha verification covers typecheck, unit tests, license audit, renderer build, and first-run app-state checks.
- Confirms at least one release `.zip` or `.dmg` artifact exists.
- Confirms the unpacked `.app`, mounted DMG app, and extracted ZIP app pass Developer ID, hardened runtime, Gatekeeper, and notarization-ticket checks.
- Confirms the app launches without development environment variables or a Vite server.
- Confirms a clean profile starts at the one-time local Hermes install/setup flow before entering chat.
- Confirms first onboarding after local setup is only language, names/memory, and workspace path.
- Confirms a ready runtime opens the chat workspace and can send a local message.

## Clean Machine Prerequisites

- macOS on the target architecture for the artifact being accepted.
- Xcode Command Line Tools installed so `codesign`, `spctl`, `xcrun`, and `hdiutil` are available.
- Node.js and npm installed.
- Network access to the official Hermes Agent release and installer sources, unless the run is intentionally recorded as blocked before install.
- No development server running for Hermills.
- No `HERMILLS_RENDERER_URL`, `HERMILLS_SERVER_URL`, or `HERMILLS_DESKTOP_TOKEN` environment variables set in the launch shell.

Use a fresh macOS user account when possible. If reusing a machine, do not delete shared user data; instead record that the run was not from a clean profile and note whether Hermes Agent was already installed.

## Build And Scripted Verification

From the repository root:

```bash
npm install
unset HERMILLS_RENDERER_URL HERMILLS_SERVER_URL HERMILLS_DESKTOP_TOKEN
npm run verify:alpha
npm run build:dmg
npm run verify:release
```

`npm run verify:alpha` must pass before manual acceptance starts. It verifies the alpha-level app contract, including the clean first-run state, three-step onboarding, and install-before-chat guards. `npm run verify:release` must pass before a release artifact is accepted.

Common failures:

- Absolute renderer asset paths such as `/assets/...`: rebuild the renderer with a relative asset base before packaging.
- Missing first-run or app-state coverage in `tests/acceptance/first-run-app-state.test.ts`: restore the acceptance test or update it with the new equivalent contract.
- Missing `.zip` or `.dmg`: rerun the release build and confirm `electron-builder` wrote to `release/`.
- `codesign`, `spctl`, or `stapler` failure: the `.app`/DMG is unsigned, incorrectly signed, not notarized, not stapled, or the verification Mac has Gatekeeper assessments disabled.

## Manual App Acceptance

Prefer accepting the same artifact customers will receive.

For a zip artifact:

```bash
mkdir -p /tmp/hermills-acceptance
ditto -x -k release/*.zip /tmp/hermills-acceptance
open /tmp/hermills-acceptance/Hermills.app
```

For a dmg artifact:

```bash
hdiutil attach release/*.dmg
open /Volumes/Hermills/Hermills.app
```

### First-Run Install Flow

Acceptance checks on a clean profile:

- The app launches without setting `HERMILLS_RENDERER_URL` or running `npm run dev`.
- The first window is not blank and presents the one-time local Hermes install/setup flow.
- The setup flow stays simple: one clear setup action, plain progress, and a recoverable error if install cannot complete.
- Installer status, install path, gateway details, diagnostics, and update controls are available only from settings or detail controls, not as the clean-machine landing path.
- The primary action starts the official Hermes Agent setup, or clearly offers repair/update if the profile is not clean.
- Chat input is disabled or redirects back to setup until runtime state is `ready`.
- The local service warning is absent after startup settles.

If the installer cannot complete because signing credentials, network access, or upstream availability are missing, record the blocker and stop before accepting the artifact.

### Ready Chat Flow

Acceptance checks after the install flow completes:

- The app transitions from setup into the chat workspace without requiring a development server.
- The first onboarding path has exactly three choices: language, user/assistant names with memory, and workspace folder.
- Provider/API key setup, theme selection, feature toggles, diagnostics, and update controls do not block first entry to chat.
- Runtime status reads as ready, and the gateway status is running.
- The chat composer is enabled and uses the ready-state prompt.
- A new conversation can be created from the conversations list.
- Sending a short local message produces a Hermes assistant response or a clear recoverable runtime error with diagnostics.
- Attaching a small text file keeps the answer grounded in local context and does not expose local storage paths.
- Quit and relaunch the app once; it should reopen to the ready chat workspace without showing the one-time install flow again.

Advanced settings for setup, agents, keys, and diagnostics may remain available behind the settings control, but they are not the clean-machine landing path.

After a dmg run, detach the mounted volume:

```bash
hdiutil detach /Volumes/Hermills
```

## Signing And Notarization

Release signing credentials are not required for unsigned local smoke builds, but a customer-facing macOS release must be signed, notarized, and stapled before acceptance.

The release signer needs either a Developer ID certificate exported as a `.p12`:

```bash
export CSC_LINK=/secure/path/DeveloperIDApplication.p12
export CSC_KEY_PASSWORD=...
export APPLE_TEAM_ID=...
export APPLE_ID=...
export APPLE_APP_SPECIFIC_PASSWORD=...
```

Or App Store Connect API key credentials for notarization:

```bash
export CSC_LINK=/secure/path/DeveloperIDApplication.p12
export CSC_KEY_PASSWORD=...
export APPLE_TEAM_ID=...
export APPLE_API_KEY=/secure/path/AuthKey_XXXXXXXXXX.p8
export APPLE_API_KEY_ID=XXXXXXXXXX
export APPLE_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

When signing is enabled in the release workflow, use the checked-in entitlement templates:

- `entitlements.mac.plist` for the main app.
- `entitlements.mac.inherit.plist` for inherited helper process entitlements.

If signing or notarization credentials are unavailable, record the release as blocked for external distribution. The manual blocker is not waived by a successful unsigned app launch.

Post-signing verification commands:

```bash
codesign --verify --deep --strict --verbose=2 release/mac-*/Hermills.app
spctl -a -vvv -t install release/mac-*/Hermills.app
xcrun stapler validate release/mac-*/Hermills.app
xcrun stapler validate release/*.dmg
```

## Evidence To Record

- macOS version and CPU architecture.
- Node and npm versions used for the build.
- Release artifact names and file sizes from `release/`.
- Full output of `npm run verify:alpha`.
- Full output of `npm run verify:release`.
- First-run result: clean install flow shown, install completed, ready chat reached, or exact blocker.
- Onboarding result: three steps completed, then chat shown.
- A chat smoke result, including whether local file attachment was tested.
- Signing identity and notarization result, or the explicit reason those credentials were unavailable.
- Any manual launch issues, screenshots, or logs needed to reproduce a failure.
