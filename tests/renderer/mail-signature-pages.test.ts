import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

function sourceWindow(source: string, marker: string, length: number) {
  const index = source.indexOf(marker);
  expect(index, `Missing marker: ${marker}`).toBeGreaterThanOrEqual(0);
  return source.slice(index, index + length);
}

describe("mail and signature page redesign contract", () => {
  it("keeps the mail setup page simple while using outreach components", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const mailView = sourceWindow(appSource, "{letterView === 'mail' ? (", 12000);
    const visibleMailView = mailView.slice(0, mailView.indexOf("<details className=\"mail-advanced-settings\""));

    expect(mailView).toContain("<OutreachCard");
    expect(mailView).toContain("<OutreachField");
    expect(mailView).toContain("<OutreachInput");
    expect(mailView).toContain("<OutreachButton");
    expect(mailView).toContain("<OutreachStatusBanner");
    expect(mailView).toContain("<OutreachStickyActionBar");
    expect(visibleMailView).toContain("你的发件邮箱");
    expect(visibleMailView).toContain("邮箱授权码 / SMTP 密码");
    expect(visibleMailView).toContain("获取 SMTP 授权码");
    expect(visibleMailView).toContain("保存并测试邮箱");
    expect(visibleMailView).not.toContain("SMTP 主机");
    expect(visibleMailView).not.toContain("SMTP 端口");
  });

  it("keeps the signature page to text signature, logo upload, preview, and save", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const signatureView = sourceWindow(appSource, "{letterView === 'signature' ? (", 5200);

    expect(signatureView).toContain("<OutreachCard");
    expect(signatureView).toContain("<OutreachTextarea");
    expect(signatureView).toContain("<OutreachUploadDropzone");
    expect(signatureView).toContain("<OutreachButton");
    expect(signatureView).toContain("<OutreachStatusBanner");
    expect(signatureView).toContain("文字签名");
    expect(signatureView).toContain("上传 Logo");
    expect(signatureView).toContain("发送预览");
    expect(signatureView).toContain("保存签名和 Logo");
    expect(signatureView).not.toContain("HTML 签名");
    expect(signatureView).not.toContain("Logo 宽度");
    expect(signatureView).not.toContain("Logo 替代文字");
  });

  it("styles mail and signature as focused setup workspaces", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toMatch(/\.hm-mail-workspace\s*\{[\s\S]*?max-width:\s*900px/);
    expect(stylesSource).toMatch(/\.hm-mail-helper\s*\{[\s\S]*?display:\s*grid/);
    expect(stylesSource).toMatch(/\.hm-signature-workspace\s*\{[\s\S]*?max-width:\s*920px/);
    expect(stylesSource).toMatch(/\.hm-signature-logo-upload\s*\{[\s\S]*?display:\s*grid/);
  });
});
