import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

function sourceWindow(source: string, marker: string, length: number) {
  const index = source.indexOf(marker);
  expect(index, `Missing marker: ${marker}`).toBeGreaterThanOrEqual(0);
  return source.slice(index, index + length);
}

function sourceBlock(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  expect(start, `Missing marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start);
  expect(end, `Missing marker: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("full Hermills UI replacement contract", () => {
  it("uses the new hm workbench shell instead of the old letter shell", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const pageSource = sourceBlock(appSource, "function DevelopmentLetterPage", "function emptyLeadDraft");

    expect(pageSource).toContain('className="hm-outreach-shell"');
    expect(pageSource).not.toContain('className="letter-app-shell"');
    expect(pageSource).not.toContain('className="letter-sidebar"');
    expect(pageSource).not.toContain('className="letter-main"');
  });

  it("defines new page workspaces for every daily outreach module", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const pageSource = sourceBlock(appSource, "function DevelopmentLetterPage", "function emptyLeadDraft");

    for (const className of [
      "hm-today-workspace",
      "hm-customer-workspace",
      "hm-single-workspace",
      "hm-batch-workspace",
      "hm-mail-workspace",
      "hm-signature-workspace",
      "hm-company-workspace",
      "hm-assets-workspace",
      "hm-chat-workspace",
    ]) {
      expect(pageSource).toContain(className);
    }
  });

  it("ships the visual tokens and replacement shell CSS", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toContain("--hm-bg-page: #f3f7fb");
    expect(stylesSource).toContain(".hm-outreach-shell");
    expect(stylesSource).toContain(".hm-sidebar");
    expect(stylesSource).toContain(".hm-primary-button");
    expect(stylesSource).toContain(".hm-ai-timeline");
    expect(stylesSource).toContain(".hm-quality-card");
    expect(stylesSource).toContain(".hm-evidence-card");
  });
});
