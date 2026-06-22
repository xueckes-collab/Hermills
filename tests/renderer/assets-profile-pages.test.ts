import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

function sourceWindow(source: string, marker: string, length: number) {
  const index = source.indexOf(marker);
  expect(index, `Missing marker: ${marker}`).toBeGreaterThanOrEqual(0);
  return source.slice(index, index + length);
}

describe("assets and company profile page redesign contract", () => {
  it("uses outreach components for the sales asset library", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const assetsView = sourceWindow(appSource, "{letterView === 'assets' ? (", 15000);

    expect(assetsView).toContain("<OutreachStatCard");
    expect(assetsView).toContain("<OutreachCard");
    expect(assetsView).toContain("<OutreachField");
    expect(assetsView).toContain("<OutreachInput");
    expect(assetsView).toContain("<OutreachTextarea");
    expect(assetsView).toContain("<OutreachButton");
    expect(assetsView).toContain("买家画像库");
    expect(assetsView).toContain("USP 库");
    expect(assetsView).toContain("CTA 资产库");
    expect(assetsView).toContain("黄金邮件样例");
    expect(assetsView).not.toContain("className=\"letter-panel\"");
  });

  it("uses outreach components for the company profile overview", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const profileView = sourceWindow(appSource, "{letterView === 'profile' ? (", 5000);

    expect(profileView).toContain("<OutreachCard");
    expect(profileView).toContain("<OutreachStatCard");
    expect(profileView).toContain("<OutreachButton");
    expect(profileView).toContain("<OutreachStatusBanner");
    expect(profileView).toContain("编辑公司资料");
    expect(profileView).toContain("公司名称");
    expect(profileView).toContain("主营产品");
  });

  it("adds focused layouts for assets and company profile", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toMatch(/\.letter-assets-workspace\s*\{[\s\S]*?display:\s*grid/);
    expect(stylesSource).toMatch(/\.letter-assets-stat-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5/);
    expect(stylesSource).toMatch(/\.letter-assets-form-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
    expect(stylesSource).toMatch(/\.letter-profile-workspace\s*\{[\s\S]*?display:\s*grid/);
    expect(stylesSource).toMatch(/\.letter-profile-stat-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3/);
  });
});
