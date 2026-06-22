import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

function sourceWindow(source: string, marker: string, length: number) {
  const index = source.indexOf(marker);
  expect(index, `Missing marker: ${marker}`).toBeGreaterThanOrEqual(0);
  return source.slice(index, index + length);
}

describe("customer management page redesign contract", () => {
  it("uses the outreach component library for list, filters, details, and draft review", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const leadsView = sourceWindow(appSource, "{letterView === 'leads' ? (", 13000);

    expect(leadsView).toContain("<OutreachCard");
    expect(leadsView).toContain("<OutreachField");
    expect(leadsView).toContain("<OutreachInput");
    expect(leadsView).toContain("<OutreachButton");
    expect(leadsView).toContain("<OutreachLeadRow");
    expect(leadsView).toContain("<OutreachEmailEditor");
    expect(leadsView).toContain("<OutreachStickyActionBar");
    expect(leadsView).toContain("<OutreachEmptyState");
  });

  it("keeps customer rows selectable without nesting inputs inside buttons", async () => {
    const componentSource = await readFile(projectFile("apps/renderer/src/components/outreach-ui.tsx"), "utf8");
    const leadRow = sourceWindow(componentSource, "export type OutreachLeadRowProps", 2400);

    expect(leadRow).toContain("checked?: boolean");
    expect(leadRow).toContain("onToggle?: () => void");
    expect(leadRow).toContain('type="checkbox"');
    expect(leadRow).toContain("onClick={(event) => event.stopPropagation()}");
  });

  it("styles the customer page as a master-detail workspace with stable scroll regions", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toMatch(/\.hm-leads-workspace\s*\{[\s\S]*?display:\s*grid/);
    expect(stylesSource).toMatch(/\.hm-leads-master\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 220px\)/);
    expect(stylesSource).toMatch(/\.hm-leads-detail\s*\{[\s\S]*?position:\s*sticky/);
    expect(stylesSource).toMatch(/\.hm-leads-draft-review\s*\{[\s\S]*?display:\s*grid/);
  });
});
