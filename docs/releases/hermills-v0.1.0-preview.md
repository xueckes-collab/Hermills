# Download Hermills for macOS

## Direct Download

[Download Hermills-0.1.0-arm64.dmg](https://github.com/xueckes-collab/Hermills/releases/download/hermills-v0.1.0-preview/Hermills-0.1.0-arm64.dmg)

For Apple Silicon Macs: M1, M2, M3, M4.

If the DMG download does not work, use the ZIP fallback:
[Hermills-0.1.0-arm64-mac.zip](https://github.com/xueckes-collab/Hermills/releases/download/hermills-v0.1.0-preview/Hermills-0.1.0-arm64-mac.zip)

## Preview Notice

This preview build is ad-hoc signed for local test bundle integrity, but it is not signed with Apple Developer ID and is not notarized yet. macOS Gatekeeper may block first launch.
For testers, use right-click > Open, or remove quarantine manually if you trust this build.
A fully signed and notarized installer will be published after Developer ID certificate and notarization credentials are ready.

## What Changed

- Added the Hermills outbound sales letter workflow for foreign trade users:
  - Company knowledge base input, so emails can use the user's company profile.
  - Customer website + email one-step research.
  - ICP, USP, first email, and 9 follow-up email sequence generation.
  - A compact step-by-step quest UI for company data, customer input, research, draft review, mailbox setup, and sending.
  - Mailbox provider presets, authorization-code helper links, SMTP login test, test email, and "I received it" confirmation.
  - Server-side sending guard: real outreach cannot be sent until mailbox delivery is confirmed.
- Removed the previous 3 imported GPT agents from the built-in seed list.
- Added 3 newly imported GPT agents as built-ins: `专业领英热点选题`, `专业领英帖子写作引擎`, and `SEO Blog Conversion Writer`.
- Existing local installs prune the deprecated built-ins while preserving user-created agents.
- Rebuilt the macOS Apple Silicon DMG and ZIP.
- Fixed the unsigned preview package startup crash caused by Electron helper library validation.

## Files

- `Hermills-0.1.0-arm64.dmg`: recommended installer for macOS Apple Silicon.
- `Hermills-0.1.0-arm64-mac.zip`: portable archive fallback.
- `SHA256SUMS.txt`: checksums for release assets.

## Current Scope

- First-run local Hermes deployment flow.
- Chat UI.
- File attachment workflows.
- Foreign trade company knowledge base.
- Customer research and outbound email workflow.
- SMTP sender mailbox testing and confirmed sending.
- Custom assistant/agent configuration.
- Bundled imported GPT agents.
- First-run onboarding and settings screens.
