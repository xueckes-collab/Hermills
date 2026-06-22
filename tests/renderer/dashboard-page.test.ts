import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

function sourceWindow(source: string, marker: string, length: number) {
  const index = source.indexOf(marker);
  expect(index, `Missing marker: ${marker}`).toBeGreaterThanOrEqual(0);
  return source.slice(index, index + length);
}

describe("dashboard page redesign contract", () => {
  it("uses the outreach design system for today's workspace", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const dashboardView = sourceWindow(appSource, "{letterView === 'dashboard' ? (", 7000);

    expect(dashboardView).toContain("<OutreachStatCard");
    expect(dashboardView).toContain("<OutreachCard");
    expect(dashboardView).toContain("<OutreachButton");
    expect(dashboardView).toContain("<OutreachStatusBanner");
    expect(dashboardView).toContain("写单封开发信");
    expect(dashboardView).toContain("整理客户");
    expect(dashboardView).toContain("批量写开发信");
    expect(dashboardView).toContain("检查邮箱");
    expect(dashboardView).toContain("自动学习");
    expect(dashboardView).not.toContain("hm-action-card");
  });

  it("styles the dashboard as a focused action hub", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toMatch(/\.hm-dashboard-workspace\s*\{[\s\S]*?display:\s*grid/);
    expect(stylesSource).toMatch(/\.hm-dashboard-stats\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5/);
    expect(stylesSource).toMatch(/\.hm-dashboard-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4/);
    expect(stylesSource).toMatch(/\.hm-dashboard-card-button\s*\{[\s\S]*?min-height:\s*140px/);
  });
});
