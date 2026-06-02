# Hermills

Hermills is a clean-room commercial desktop application for local agent deployment, custom agent configuration, user-owned provider keys, and desktop chat workflows.

## Download

[Download Hermills for macOS Apple Silicon](https://github.com/xueckes-collab/Hermills/releases/latest/download/Hermills-0.1.0-arm64.dmg)

If the latest download link is unavailable, open the [Hermills Releases page](https://github.com/xueckes-collab/Hermills/releases) and choose the first `Hermills-0.1.0-arm64.dmg` file.

This preview build is ad-hoc signed for local test bundle integrity, but it is not signed with Apple Developer ID and is not notarized yet. macOS Gatekeeper may block first launch.

All new commercial code lives under `hermills/` and must not copy the parent Hermes Web UI source, UI, wording, styles, assets, tests, or configuration.

## Commands

```bash
npm install
npm run test
npm run build
npm run dev
npm run verify:release
npm run build:dmg
```

`npm run verify:release` is intentionally strict. It will block external macOS distribution until the app is built with a supported Electron major and signed with Developer ID credentials; see `docs/acceptance/local-desktop.md`.
