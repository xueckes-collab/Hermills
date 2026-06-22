import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function projectFile(...segments: string[]): string {
  return path.join(root, ...segments);
}

function sourceWindow(source: string, token: string, length = 2400): string {
  const index = source.indexOf(token);
  expect(index, `${token} should exist`).toBeGreaterThanOrEqual(0);
  return source.slice(index, index + length);
}

describe("cloud auth email OTP UI contract", () => {
  it("keeps signup passwordless and sends a 6-digit email OTP before verification", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const signupSubmit = sourceWindow(appSource, "if (mode === 'signup')", 3200);
    const verifySubmit = sourceWindow(appSource, "if (mode === 'verifySignup')", 1800);

    expect(signupSubmit).toContain("api.cloudSignup");
    expect(signupSubmit).not.toContain("confirmPassword");
    expect(signupSubmit).not.toContain("password,");
    expect(signupSubmit).toContain("setResendCooldown(60)");
    expect(verifySubmit).toMatch(/\\d\{6\}/);
    expect(appSource).toContain("maxLength={6}");
  });

  it("keeps resend protected by a visible cooldown", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const resend = sourceWindow(appSource, "async function resendSignupConfirmation", 2600);

    expect(resend).toContain("resendCooldown > 0");
    expect(resend).toContain("api.cloudResendSignupConfirmation");
    expect(resend).toContain("setResendCooldown(60)");
    expect(appSource).toContain("`${resendCooldown}s 后重发`");
  });
});
