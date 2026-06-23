import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const docsRoot = path.join(root, "docs", "ui-harness");
const splitDocsRoot = path.join(docsRoot, "Hermills_UI_Spec_Split_v1");

const corePages = [
  "登录注册",
  "初始化",
  "今日外联",
  "客户管理",
  "单封写信",
  "批量写信",
  "邮箱配置",
  "签名 Logo",
  "公司资料",
  "聊天控制"
];

async function readHarnessDoc(name: string): Promise<string> {
  return readFile(path.join(docsRoot, name), "utf8");
}

async function readSplitDoc(name: string): Promise<string> {
  return readFile(path.join(splitDocsRoot, name), "utf8");
}

describe("UI harness documentation", () => {
  it("vendors the upgraded split UI specification as the active implementation contract", async () => {
    const requiredDocs = [
      "00_UI_MAP.md",
      "01_VISUAL_SYSTEM.md",
      "02_COMPONENT_SPECS.md",
      "03_PAGE_SPECS.md",
      "04_STATE_SPECS.md",
      "05_ACCEPTANCE_CRITERIA.md",
    ];

    for (const file of requiredDocs) {
      const doc = await readSplitDoc(file);
      expect(doc.length, `${file} should contain real specification text`).toBeGreaterThan(4000);
    }

    expect(await readSplitDoc("00_UI_MAP.md")).toContain("Windows 桌面外联工作台");
    expect(await readSplitDoc("01_VISUAL_SYSTEM.md")).toContain("--hm-bg-page: #f3f7fb");
    expect(await readSplitDoc("02_COMPONENT_SPECS.md")).toContain("主按钮");
    expect(await readSplitDoc("03_PAGE_SPECS.md")).toContain("单封写信页面");
    expect(await readSplitDoc("04_STATE_SPECS.md")).toContain("AI 生成中状态");
    expect(await readSplitDoc("05_ACCEPTANCE_CRITERIA.md")).toContain("Hermills UI 不能由实现 Agent 自己宣布完成");
  });

  it("defines the product map for the full outreach workflow", async () => {
    const doc = await readHarnessDoc("project-map.md");

    expect(doc).toContain("Windows 桌面端外贸开发信工作台");
    expect(doc).toContain("登录");
    expect(doc).toContain("公司资料");
    expect(doc).toContain("邮箱");
    expect(doc).toContain("背调");
    expect(doc).toContain("写信");
    expect(doc).toContain("发送");
    expect(doc).toContain("跟进");
    expect(doc).toContain("apps/renderer/src/App.tsx");
    expect(doc).toContain("apps/renderer/src/styles.css");
    expect(doc).toContain("tests/renderer/usability-contract.test.ts");
  });

  it("lists every required page with user jobs and UI risks", async () => {
    const doc = await readHarnessDoc("page-inventory.md");

    for (const page of corePages) {
      expect(doc, `${page} should be in the page inventory`).toContain(page);
    }

    expect(doc).toContain("用户任务");
    expect(doc).toContain("主要操作");
    expect(doc).toContain("UI 风险");
    expect(doc).toContain("验收证据");
  });

  it("locks clear goals for each outreach page", async () => {
    const doc = await readHarnessDoc("ui-goals.md");

    for (const page of corePages) {
      expect(doc, `${page} should have an explicit goal`).toContain(page);
    }

    expect(doc).toContain("一个主操作");
    expect(doc).toContain("清爽浅色 SaaS");
    expect(doc).toContain("普通用户");
    expect(doc).toContain("逐条返回结果");
  });

  it("requires objective acceptance evidence instead of self-reported completion", async () => {
    const doc = await readHarnessDoc("acceptance-criteria.md");

    expect(doc).toContain("1366x768");
    expect(doc).toContain("1440x900");
    expect(doc).toContain("1280x720");
    expect(doc).toContain("不能出现页面级横向滚动");
    expect(doc).toContain("按钮文字必须清楚");
    expect(doc).toContain("不能出现 `undefined/`");
    expect(doc).toContain("npm run typecheck");
    expect(doc).toContain("npm run test");
    expect(doc).toContain("npm run build");
    expect(doc).toContain("截图");
    expect(doc).toContain("实现 Agent 不能自己验收");
  });

  it("provides a detailed UI design specification for implementation", async () => {
    const doc = await readHarnessDoc("detailed-ui-design-spec.md");

    for (const section of [
      "用户目标设计",
      "信息架构",
      "核心工作流",
      "页面布局",
      "视觉层级",
      "组件系统",
      "交互反馈",
      "状态设计",
      "表单与输入体验",
      "文案系统",
      "数据展示",
      "设计系统与品牌感"
    ]) {
      expect(doc, `${section} should be covered`).toContain(section);
    }

    for (const page of corePages) {
      expect(doc, `${page} should have detailed design rules`).toContain(page);
    }

    for (const component of ["按钮", "输入框", "卡片", "表格", "弹窗", "提示条", "进度条", "加载状态", "空状态"]) {
      expect(doc, `${component} should have component guidance`).toContain(component);
    }

    expect(doc).toContain("AI 生成中");
    expect(doc).toContain("逐条完成");
    expect(doc).toContain("扫码绑定");
    expect(doc).toContain("不允许出现 `undefined/`");
  });
});
