# Windows code signing

Hermills Windows releases must be signed before customer distribution. Unsigned NSIS installers can be blocked by Microsoft Defender or SmartScreen before the installer UI opens.

## Required credential

Use a trusted Windows code-signing certificate:

- OV or EV code-signing certificate from a public CA, exported as `.pfx` or `.p12`.
- Or Microsoft Trusted Signing/Azure Trusted Signing, wired through electron-builder later if that account is chosen.

A self-signed certificate is only useful for local engineering tests. It does not make ordinary customer machines trust the installer.

## Local `.pfx` or `.p12` signing

Set signing credentials in the shell that runs the build. Do not commit the certificate or password.

PowerShell:

```powershell
$env:WIN_CSC_LINK = "C:\secure\Hermills-CodeSigning.pfx"
$env:WIN_CSC_KEY_PASSWORD = "<certificate-password>"
npm run build:win:signed
npm run checksum:win
```

`CSC_LINK` and `CSC_KEY_PASSWORD` also work, but the `WIN_` variables are preferred for Windows-only signing.

`npm run build:win` remains the unsigned preview build. `npm run build:win:signed` uses `electron-builder.win-signed.yml`, fails early if signing credentials are missing, and runs `npm run verify:win:signing` after packaging.

## Windows build host requirement

electron-builder downloads and extracts its `winCodeSign` helper the first time signed Windows packaging runs. On Windows, that archive contains symbolic links, so the build account must be allowed to create symbolic links.

Use one of these options before the first signed build:

- Enable Windows Developer Mode for the build machine.
- Or run the first signed build from an elevated administrator shell.
- Or prewarm `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign` on a machine/account that can create symbolic links.

If this is not configured, 7-Zip can fail with `Cannot create symbolic link` before signing starts.

## Expected signed files

`npm run verify:win:signing` currently requires valid Authenticode signatures on:

- `release/win-unpacked/Hermills.exe`
- `release/Hermills-<version>-x64-setup.exe`

If either file is unsigned or Windows refuses to read it because Defender quarantined it, rebuild after configuring the certificate.

## Release upload checklist

After a signed build passes verification, upload these files together:

- `release/Hermills-<version>-x64-setup.exe`
- `release/Hermills-<version>-x64-setup.exe.blockmap`
- `release/latest.yml`
- `release/SHA256SUMS-win.txt`

Future auto-updates require `package.json` version to increase and the signed installer, `latest.yml`, and blockmap to come from the same build.
