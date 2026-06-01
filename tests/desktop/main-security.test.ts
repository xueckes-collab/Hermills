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
});
