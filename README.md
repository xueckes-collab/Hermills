# Hermills

Hermills is a clean-room commercial desktop application for local agent deployment, custom agent configuration, user-owned provider keys, and desktop chat workflows.

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
