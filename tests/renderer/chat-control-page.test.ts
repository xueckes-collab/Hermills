import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

function sourceWindow(source: string, marker: string, length: number) {
  const index = source.indexOf(marker);
  expect(index, `Missing marker: ${marker}`).toBeGreaterThanOrEqual(0);
  return source.slice(index, index + length);
}

describe("chat control page redesign contract", () => {
  it("uses outreach components for platform binding and local command testing", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const chatView = sourceWindow(appSource, "{letterView === 'chatControl' ? (", 12000);

    expect(chatView).toContain("<OutreachCard");
    expect(chatView).toContain("<OutreachButton");
    expect(chatView).toContain("<OutreachStatusBanner");
    expect(chatView).toContain("<OutreachTextarea");
    expect(chatView).toContain("<OutreachEmptyState");
    expect(chatView).toContain("扫码绑定");
    expect(chatView).toContain("命令预览");
    expect(chatView).toContain("最近命令");
    expect(chatView).not.toContain("className=\"letter-panel");
  });

  it("adds a clearer layout for chat control", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toMatch(/\.chat-control-workspace\s*\{[\s\S]*?display:\s*grid/);
    expect(stylesSource).toMatch(/\.chat-control-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
    expect(stylesSource).toMatch(/\.chat-control-command-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax/);
    expect(stylesSource).toMatch(/\.chat-command-chip\s*\{[\s\S]*?min-height:\s*34px/);
  });
});
