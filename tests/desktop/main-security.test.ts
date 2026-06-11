import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function projectFile(...segments: string[]): string {
  return path.join(root, ...segments);
}

describe("desktop main process security contract", () => {
  it("keeps the packaged renderer isolated from Node and dev endpoints", async () => {
    const source = await readFile(projectFile("apps/desktop/main.cjs"), "utf8");

    expect(source).toContain("contextIsolation: true");
    expect(source).toContain("nodeIntegration: false");
    expect(source).toContain("sandbox: true");
    expect(source).toContain("return !app.isPackaged");
    expect(source).toContain("mainWindow.loadFile");
    expect(source).toContain("apps\", \"renderer\", \"dist\", \"index.html");
  });

  it("keeps external windows denied by default", async () => {
    const source = await readFile(projectFile("apps/desktop/main.cjs"), "utf8");

    expect(source).toContain("setWindowOpenHandler");
    expect(source).toContain("url.startsWith(\"https://\")");
    expect(source).toContain("return { action: \"deny\" }");
  });

  it("removes the default Electron application menu from the desktop shell", async () => {
    const source = await readFile(projectFile("apps/desktop/main.cjs"), "utf8");

    expect(source).toContain("Menu.setApplicationMenu(null)");
  });

  it("keeps the app running in the tray when the window close button is clicked", async () => {
    const source = await readFile(projectFile("apps/desktop/main.cjs"), "utf8");

    expect(source).toContain("Tray");
    expect(source).toContain("Menu.buildFromTemplate");
    expect(source).toContain("getTrayIconPath");
    expect(source).toContain("process.resourcesPath");
    expect(source).toContain("mainWindow.on(\"close\"");
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain("mainWindow.hide()");
    expect(source).toContain("Quit Hermills");
    expect(source).toContain("app.quit()");
  });

  it("checks app updates from the packaged Windows app with user consent", async () => {
    const source = await readFile(projectFile("apps/desktop/main.cjs"), "utf8");

    expect(source).toContain("require(\"electron-updater\")");
    expect(source).toContain("autoUpdater.autoDownload = false");
    expect(source).toContain("autoUpdater.autoInstallOnAppQuit = false");
    expect(source).toContain("if (!app.isPackaged || !autoUpdater)");
    expect(source).toContain("showAppUpdateDialog");
    expect(source).toContain("Download Update");
    expect(source).toContain("downloadUpdate()");
    expect(source).toContain("Restart and Install");
    expect(source).toContain("quitAndInstall(false, true)");
    expect(source).toContain("Check for Updates...");
    expect(source).toContain("checkForAppUpdates(false)");
  });

  it("keeps Windows release builds ready for trusted code signing", async () => {
    const builderConfig = await readFile(projectFile("electron-builder.yml"), "utf8");
    const signedBuilderConfig = await readFile(projectFile("electron-builder.win-signed.yml"), "utf8");
    const packageJson = await readFile(projectFile("package.json"), "utf8");
    const signingPreflight = await readFile(projectFile("scripts/check-win-signing-env.mjs"), "utf8");
    const signingVerifier = await readFile(projectFile("scripts/verify-win-signing.mjs"), "utf8");
    const signingDocs = await readFile(projectFile("docs/acceptance/windows-signing.md"), "utf8");

    expect(builderConfig).toContain("signAndEditExecutable: false");
    expect(signedBuilderConfig).toContain("extends: electron-builder.yml");
    expect(signedBuilderConfig).toContain("signAndEditExecutable: true");
    expect(signedBuilderConfig).toContain("verifyUpdateCodeSignature: true");
    expect(signedBuilderConfig).toContain("signtoolOptions:");
    expect(signedBuilderConfig).toContain("signingHashAlgorithms:");
    expect(signedBuilderConfig).toContain("- sha256");
    expect(signedBuilderConfig).toContain("rfc3161TimeStampServer: http://timestamp.digicert.com");
    expect(packageJson).toContain('"build:win:signed": "node scripts/check-win-signing-env.mjs');
    expect(packageJson).toContain('"verify:win:signing": "node scripts/verify-win-signing.mjs"');
    expect(signingPreflight).toContain("WIN_CSC_LINK");
    expect(signingPreflight).toContain("WIN_CSC_KEY_PASSWORD");
    expect(signingPreflight).toContain("HERMILLS_ALLOW_CERT_STORE_SIGNING");
    expect(signingVerifier).toContain("Get-AuthenticodeSignature");
    expect(signingVerifier).toContain("release\", \"win-unpacked\", \"Hermills.exe");
    expect(signingVerifier).toContain("x64-setup.exe");
    expect(signingVerifier).toContain("Status === \"Valid\"");
    expect(signingDocs).toContain("WIN_CSC_LINK");
    expect(signingDocs).toContain("WIN_CSC_KEY_PASSWORD");
    expect(signingDocs).toContain("OV or EV code-signing certificate");
    expect(signingDocs).toContain("Windows Developer Mode");
  });
});
