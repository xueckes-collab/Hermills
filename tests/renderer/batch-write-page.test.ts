import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

function sourceWindow(source: string, marker: string, length: number) {
  const index = source.indexOf(marker);
  expect(index, `Missing marker: ${marker}`).toBeGreaterThanOrEqual(0);
  return source.slice(index, index + length);
}

describe("batch write page redesign contract", () => {
  it("uses the outreach component library for import, queue, sending, and review", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const batchView = sourceWindow(appSource, "{letterView === 'automation' ? (", 19000);

    expect(batchView).toContain("<OutreachStatCard");
    expect(batchView).toContain("<OutreachCard");
    expect(batchView).toContain("<OutreachUploadDropzone");
    expect(batchView).toContain("<OutreachTextarea");
    expect(batchView).toContain("<OutreachButton");
    expect(batchView).toContain("<OutreachTimeline");
    expect(batchView).toContain("<OutreachLeadRow");
    expect(batchView).toContain("<OutreachEmailEditor");
    expect(batchView).toContain("<OutreachStickyActionBar");
    expect(batchView).toContain("<OutreachEmptyState");
  });

  it("keeps batch generation progressive instead of waiting for every recipient", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const batchView = sourceWindow(appSource, "{letterView === 'automation' ? (", 19000);

    expect(batchView).toContain("写好一封会自动显示一封");
    expect(batchView).toContain("campaignRecipients.length ? campaignRecipients.map");
    expect(batchView).toContain("selectedCampaignRecipient?.draft");
  });

  it("styles the batch page with stable setup and review workspaces", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toMatch(/\.letter-batch-stats\s*\{[\s\S]*?display:\s*grid/);
    expect(stylesSource).toMatch(/\.letter-batch-setup-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(300px,\s*1fr\)\)/);
    expect(stylesSource).toMatch(/\.letter-batch-review-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(260px,\s*0\.46fr\) minmax\(0,\s*1\.54fr\)/);
    expect(stylesSource).toMatch(/\.letter-batch-recipient-list\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 260px\)/);
  });
});
