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

- Bundled 3 imported GPT agents:
  - SEO Blog写手
  - 专业社交热点选题写作系统
  - Eckes智能开发信定制官
- Removed the old 10 bundled agents from the built-in seed list.
- Existing local installs prune those deprecated built-ins while preserving user-created agents.
- Rebuilt the macOS Apple Silicon DMG and ZIP.

## Files

- `Hermills-0.1.0-arm64.dmg`: recommended installer for macOS Apple Silicon.
- `Hermills-0.1.0-arm64-mac.zip`: portable archive fallback.
- `SHA256SUMS.txt`: checksums for release assets.

## Current Scope

- First-run local Hermes deployment flow.
- Chat UI.
- File attachment workflows.
- Custom assistant/agent configuration.
- Bundled imported GPT agents.
- First-run onboarding and settings screens.
