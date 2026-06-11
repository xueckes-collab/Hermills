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
});
