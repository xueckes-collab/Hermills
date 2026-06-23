import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OutreachButton } from "../../apps/renderer/src/components/outreach-ui.js";
import { Button } from "../../apps/renderer/src/components/ui/button.js";

const projectFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

describe("motion feedback harness", () => {
  it("documents the map, goals, and acceptance gates for motion feedback", async () => {
    const doc = await readFile(projectFile("docs/ui-harness/motion-feedback-harness.md"), "utf8");

    expect(doc).toContain("实现地图");
    expect(doc).toContain("实现目标");
    expect(doc).toContain("验收标准");
    expect(doc).toContain("即时点击反馈层");
    expect(doc).toContain("加载反馈层");
    expect(doc).toContain("长任务进度层");
    expect(doc).toContain("prefers-reduced-motion");
  });

  it("marks outreach loading buttons with the universal feedback contract", () => {
    const html = renderToStaticMarkup(
      React.createElement(OutreachButton, { loading: true, variant: "primary" }, "正在分析客户官网"),
    );

    expect(html).toContain("aria-busy=\"true\"");
    expect(html).toContain("data-feedback=\"button\"");
    expect(html).toContain("data-loading=\"true\"");
    expect(html).toContain("outreach-button-spinner");
    expect(html).toContain("正在分析客户官网");
  });

  it("marks the shared Button primitive with the universal feedback contract", () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { "aria-busy": true, variant: "secondary" }, "保存并测试邮箱"),
    );

    expect(html).toContain("data-slot=\"button\"");
    expect(html).toContain("data-feedback=\"button\"");
    expect(html).toContain("aria-busy=\"true\"");
    expect(html).toContain("data-loading=\"true\"");
    expect(html).toContain("保存并测试邮箱");
  });

  it("ships a CSS motion contract for buttons, loading, progress, and reduced motion", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    for (const token of [
      "--motion-duration-fast",
      "--motion-duration-standard",
      "--motion-duration-slow",
      "--motion-ease-standard",
      "--motion-ease-emphasis",
    ]) {
      expect(stylesSource).toContain(token);
    }

    expect(stylesSource).toMatch(/button\[data-feedback="button"\],[\s\S]*?\[data-slot="button"\]\[data-feedback="button"\],[\s\S]*?\.outreach-button\[data-feedback="button"\]\s*\{/);
    expect(stylesSource).toMatch(/button\[data-feedback="button"\]:not\(:disabled\):active,[\s\S]*?\[data-slot="button"\]\[data-feedback="button"\]:not\(:disabled\):active,[\s\S]*?\.outreach-button\[data-feedback="button"\]:not\(:disabled\):active\s*\{/);
    expect(stylesSource).toMatch(/\[aria-busy="true"\]\[data-feedback="button"\],[\s\S]*?\[data-loading="true"\]\[data-feedback="button"\]\s*\{/);
    expect(stylesSource).toMatch(/button:not\(:disabled\):not\(\[aria-busy="true"\]\):not\(\[data-feedback="button"\]\):active\s*\{/);
    expect(stylesSource).toMatch(/button:not\(\[data-feedback="button"\]\):focus-visible\s*\{/);
    expect(stylesSource).toContain(".hm-operation-progress");
    expect(stylesSource).toContain("hm-motion-button-sheen");
    expect(stylesSource).toContain("hm-motion-progress");
    expect(stylesSource).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
  });

  it("renders operation progress rails for single and batch outreach generation", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");

    expect(appSource).toContain("singleGenerationRunning ? <div className=\"hm-operation-progress\"");
    expect(appSource).toContain("campaignGenerationRunning ? <div className=\"hm-operation-progress\"");
    expect(appSource).toContain("role=\"progressbar\"");
    expect(appSource).toContain("aria-label=\"正在生成开发信\"");
    expect(appSource).toContain("aria-label=\"正在批量生成开发信\"");
  });
});
