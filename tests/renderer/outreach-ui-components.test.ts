import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  OutreachButton,
  OutreachBadge,
  OutreachCard,
  OutreachEmptyState,
  OutreachEmailEditor,
  OutreachErrorState,
  OutreachEvidenceCard,
  OutreachField,
  OutreachLeadRow,
  OutreachPageHeader,
  OutreachQualityScore,
  OutreachShell,
  OutreachSidebar,
  OutreachSkeleton,
  OutreachStatCard,
  OutreachStickyActionBar,
  OutreachStatusBanner,
  OutreachTextarea,
  OutreachTimeline,
  OutreachUploadDropzone,
} from "../../apps/renderer/src/components/outreach-ui.js";

const projectFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

describe("outreach UI component library", () => {
  it("renders the new shell, sidebar, and page header without depending on App.tsx", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        OutreachShell,
        {
          sidebar: React.createElement(OutreachSidebar, {
            brand: "Outbound Mail OS",
            subtitle: "Hermills 本地版",
            activeId: "today",
            items: [
              { id: "today", label: "今日外联" },
              { id: "single", label: "单封写信" },
            ],
            footer: React.createElement("span", null, "公司资料已准备"),
          }),
          children: React.createElement(OutreachPageHeader, {
            title: "今日外联",
            description: "查看今天要处理的客户、草稿、发送和回复",
            action: React.createElement(OutreachButton, { variant: "primary" }, "写单封开发信"),
          }),
        },
      ),
    );

    expect(html).toContain("outreach-ui-shell");
    expect(html).toContain("outreach-sidebar");
    expect(html).toContain("outreach-main");
    expect(html).toContain("aria-label=\"外联导航\"");
    expect(html).toContain("aria-current=\"page\"");
    expect(html).toContain("今日外联");
    expect(html).toContain("写单封开发信");
  });

  it("renders clear actions, fields, status, cards, rows, and timeline states", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(OutreachButton, { variant: "primary", loading: true }, "正在分析客户官网"),
        React.createElement(OutreachButton, { variant: "danger" }, "删除客户"),
        React.createElement(OutreachField, {
          id: "customer-email",
          label: "客户邮箱",
          hint: "例如 buyer@company.com",
          children: React.createElement("input", { id: "customer-email", className: "outreach-input", placeholder: "buyer@company.com" }),
        }),
        React.createElement(OutreachStatusBanner, { tone: "warning", title: "邮箱还没测试", action: "保存并测试邮箱" }, "先测试邮箱再发送。"),
        React.createElement(OutreachCard, { title: "单个客户", description: "输入客户的网站和邮箱。" }, "表单区域"),
        React.createElement(OutreachStatCard, { label: "待发送", value: 8, tone: "orange" }),
        React.createElement(OutreachLeadRow, {
          company: "SPC Flooring Store",
          email: "sales@spcflooringstore.com",
          website: "https://spcflooringstore.com",
          status: "待发送",
          score: 88,
          selected: true,
        }),
        React.createElement(OutreachQualityScore, { score: 88, label: "可发送" }),
        React.createElement(OutreachEmptyState, { title: "还没有客户", description: "输入一个客户官网和邮箱。", action: "写第一封开发信" }),
        React.createElement(OutreachTimeline, {
          steps: [
            { label: "正在读取客户官网", state: "complete" },
            { label: "正在匹配公司资料", state: "current" },
            { label: "正在保存草稿", state: "waiting" },
          ],
        }),
      ),
    );

    expect(html).toContain("aria-busy=\"true\"");
    expect(html).toContain("outreach-button-spinner");
    expect(html).toContain("outreach-field");
    expect(html).toContain("outreach-status-banner warning");
    expect(html).toContain("outreach-card");
    expect(html).toContain("outreach-stat-card orange");
    expect(html).toContain("outreach-lead-row selected");
    expect(html).toContain("outreach-quality-score good");
    expect(html).toContain("outreach-empty-state");
    expect(html).toContain("outreach-timeline-step current");
  });

  it("renders the remaining acceptance components for page replacement work", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(OutreachBadge, { tone: "green" }, "可发送"),
        React.createElement(OutreachTextarea, { defaultValue: "Hi buyer,", "aria-label": "邮件正文" }),
        React.createElement(OutreachSkeleton, { label: "客户列表加载中", rows: 3 }),
        React.createElement(OutreachErrorState, {
          title: "客户网站暂时无法读取",
          action: React.createElement(OutreachButton, { variant: "secondary" }, "重试读取"),
          technicalDetails: "FetchError: timeout",
        }, "Hermills 可以稍后重试，或使用轻量信息继续生成。"),
        React.createElement(OutreachUploadDropzone, {
          title: "点击选择 Excel / CSV 文件",
          description: "支持 .xlsx、.xls、.csv、.txt",
          action: "选择文件并生成开发信",
        }),
        React.createElement(OutreachEvidenceCard, {
          title: "产品线索",
          sourceUrl: "https://example.com/products",
          confidence: "高",
        }, "官网显示该客户销售 SPC flooring。"),
        React.createElement(OutreachEmailEditor, {
          subject: "Quick SPC comparison?",
          body: "Hi team,\nWould a comparison help?",
          subjectLabel: "邮件主题",
          bodyLabel: "邮件正文",
        }),
        React.createElement(OutreachStickyActionBar, null,
          React.createElement(OutreachButton, { variant: "secondary" }, "保存草稿"),
          React.createElement(OutreachButton, { variant: "primary" }, "发送开发信"),
        ),
      ),
    );

    expect(html).toContain("outreach-badge green");
    expect(html).toContain("outreach-textarea");
    expect(html).toContain("outreach-skeleton");
    expect(html).toContain("aria-label=\"客户列表加载中\"");
    expect(html).toContain("outreach-error-state");
    expect(html).toContain("FetchError: timeout");
    expect(html).toContain("outreach-upload-dropzone");
    expect(html).toContain("选择文件并生成开发信");
    expect(html).toContain("outreach-evidence-card");
    expect(html).toContain("https://example.com/products");
    expect(html).toContain("outreach-email-editor");
    expect(html).toContain("outreach-sticky-action-bar");
  });

  it("ships the CSS contract for the new component set", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toMatch(/\.outreach-ui-shell\s*\{[\s\S]*?grid-template-columns:\s*232px minmax\(0,\s*1fr\)/);
    expect(stylesSource).toMatch(/\.outreach-button\.primary\s*\{[\s\S]*?background:\s*#2563eb/);
    expect(stylesSource).toMatch(/\.outreach-button\.danger\s*\{[\s\S]*?color:\s*#b91c1c/);
    expect(stylesSource).toMatch(/\.outreach-input:focus,[\s\S]*?\.outreach-textarea:focus\s*\{[\s\S]*?box-shadow:\s*0 0 0 3px rgba\(37,\s*99,\s*235,\s*0\.12\)/);
    expect(stylesSource).toMatch(/\.outreach-status-banner\.error\s*\{[\s\S]*?background:\s*#fef2f2/);
    expect(stylesSource).toMatch(/\.outreach-ai-timeline\s*\{[\s\S]*?background:\s*#eff6ff/);
    expect(stylesSource).toMatch(/\.outreach-upload-dropzone\s*\{[\s\S]*?border:\s*1px dashed #a9d8ff/);
    expect(stylesSource).toMatch(/\.outreach-sticky-action-bar\s*\{[\s\S]*?position:\s*sticky/);
    expect(stylesSource).toMatch(/\.outreach-error-state\s*\{[\s\S]*?background:\s*#fef2f2/);
    expect(stylesSource).toMatch(/@media \(max-width:\s*920px\)[\s\S]*?\.outreach-ui-shell\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  });
});
