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

  it("always releases the file-generate busy state after selecting a batch file", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const handler = sourceWindow(appSource, "async function importLetterFileAndGenerate", 1200);

    expect(handler).toContain("finally");
    expect(handler).toContain("setBusy('')");
  });

  it("starts batch import generation in the background after the campaign is queued", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const handler = sourceWindow(appSource, "async function importAndGenerateLetterLeads", 1700);

    expect(handler).toContain("void watchCampaignGeneration(created.id");
    expect(handler).not.toContain("const generated = await pollCampaignGeneration(created.id)");
  });

  it("exposes batch export and failed-recipient retry actions", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const apiSource = await readFile(projectFile("apps/renderer/src/api.ts"), "utf8");
    const batchView = sourceWindow(appSource, "{letterView === 'automation' ? (", 19000);

    expect(apiSource).toContain("retryOutreachCampaignRecipient");
    expect(apiSource).toContain("exportOutreachCampaignCsv");
    expect(batchView).toContain("导出 CSV");
    expect(batchView).toContain("重试失败项");
    expect(batchView).toContain("retryCampaignRecipient");
  });

  it("styles the batch page with stable setup and review workspaces", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toMatch(/\.hm-batch-stats\s*\{[\s\S]*?display:\s*grid/);
    expect(stylesSource).toMatch(/\.hm-batch-setup-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(300px,\s*1fr\)\)/);
    expect(stylesSource).toMatch(/\.hm-batch-review-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(260px,\s*0\.46fr\) minmax\(0,\s*1\.54fr\)/);
    expect(stylesSource).toMatch(/\.hm-batch-recipient-list\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 260px\)/);
  });
});
