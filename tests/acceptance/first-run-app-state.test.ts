import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RuntimeStatusSchema } from "@hermills/core";
import { RuntimeService } from "@hermills/runtime";
import { fallback } from "../../apps/renderer/src/api.js";
import { getUiCopy } from "../../apps/renderer/src/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function projectFile(...segments: string[]): string {
  return path.join(root, ...segments);
}

describe("first-run app-state acceptance", () => {
  it("starts a clean runtime profile in the install-required state", async () => {
    const service = new RuntimeService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-first-run-")),
      fetchImpl: async () => {
        throw new Error("offline fixture");
      }
    });

    try {
      const status = RuntimeStatusSchema.parse(await service.getStatus());
      expect(status.installed).toBe(false);
      expect(status.state).toBe("not-installed");
      expect(status.activeInstallJob).toBeUndefined();
      expect(status.gateway?.state).toBe("stopped");
      expect(status.checks.find((check) => check.id === "executable")).toMatchObject({ ok: false });
      expect(status.checks.find((check) => check.id === "gateway")).toMatchObject({ ok: false });
    } finally {
      await service.dispose();
    }
  });

  it("keeps renderer fallback and chat guard aligned with install-before-chat", async () => {
    expect(fallback.runtime).toMatchObject({
      state: "not-installed",
      installed: false,
      progress: 0
    });
    expect(fallback.runtime.message).toMatch(/Set up Hermes.*private local chat/i);

    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    expect(appSource).toContain("FirstRunDeployPage");
    expect(appSource).toContain("isLocalDeploymentComplete");
    expect(appSource).toContain("runtime.state === 'ready'");
    expect(appSource).toContain("workspaceEnabled");
    expect(getUiCopy("en").runtime.action.setUp).toBe("Set up Hermes");
    expect(getUiCopy("en").runtime.action.update).toBe("Update Hermes");
    expect(getUiCopy("en").runtime.action.current).toBe("Hermes is up to date");
    expect(appSource).toContain("getRuntimeActionState(runtime, updateCheck, firstRun, installing, copy)");
    expect(appSource).not.toContain("Install latest Hermes Agent");
    expect(getUiCopy("en").chat.placeholderReady).toBe("Ask Hermes...");
    expect(getUiCopy("en").chat.placeholderNotReady).toBe("Start Hermes first");
    expect(getUiCopy("en").common.assistants).toBe("Assistants");
    expect(appSource).toContain("copy.chat.placeholderReady");
  });

  it("documents one-time install acceptance instead of the legacy navigation smoke", async () => {
    const doc = await readFile(projectFile("docs/acceptance/local-desktop.md"), "utf8");
    expect(doc).toMatch(/one-time local Hermes install\/setup flow/i);
    expect(doc).toMatch(/transitions from setup into the chat workspace/i);
    expect(doc).toContain("npm run verify:alpha");
    expect(doc).not.toContain("Chat, Deploy, Home, Agents, and Keys");
    expect(doc).not.toContain("Chat, Deploy, Agents, and Keys panels");
  });

  it("keeps the simple client assistant flow available from the main UI", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const apiSource = await readFile(projectFile("apps/renderer/src/api.ts"), "utf8");
    expect(appSource).toContain("agentTemplates");
    expect(appSource).toContain("AssistantDrawer");
    expect(appSource).toContain("onStartChat");
    expect(getUiCopy("en").chat.defaultAssistant).toBe("Default assistant");
    expect(appSource).toContain("copy.chat.defaultAssistant");
    expect(apiSource).toContain("async updateAgent");
    expect(apiSource).toContain("async deleteAgent");
  });

  it("keeps first onboarding to three simple steps before chat", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const stepsBlock = appSource.match(/const onboardingSteps:[\s\S]*?\n\]/)?.[0] ?? "";

    expect(stepsBlock).toContain("id: 'language'");
    expect(stepsBlock).toContain("id: 'identity'");
    expect(stepsBlock).toContain("id: 'workspace'");
    expect(stepsBlock).not.toContain("id: 'provider'");
    expect(stepsBlock).not.toContain("id: 'theme'");
    expect(stepsBlock).not.toContain("id: 'features'");
    expect(getUiCopy("zh-CN").onboarding.stepProgress(1, 3)).toBe("第 1 步，共 3 步");
    expect(getUiCopy("en").firstRun.oneTimeSetup).toBe("Set up Hermes");
    expect(getUiCopy("zh-CN").firstRun.oneTimeSetup).toBe("设置 Hermes");
  });
});
