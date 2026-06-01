import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getUiCopy } from "../../apps/renderer/src/i18n.js";
import type { UiLanguage } from "../../apps/renderer/src/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const languages: UiLanguage[] = ["zh-CN", "zh-TW", "ja", "ko", "en"];

function projectFile(...segments: string[]): string {
  return path.join(root, ...segments);
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  return Object.values(value).flatMap(collectStrings);
}

function sourceWindow(source: string, token: string, length = 1600): string {
  const index = source.indexOf(token);
  expect(index, `${token} should exist in App.tsx`).toBeGreaterThanOrEqual(0);
  return source.slice(index, index + length);
}

describe("renderer usability contract", () => {
  it("keeps simple and expert mode copy available in every supported language", () => {
    const expectations: Record<UiLanguage, { simple: RegExp; expert: RegExp }> = {
      "zh-CN": { simple: /(普通|简单|基础)模式|simple mode|normal mode|basic mode/i, expert: /专家模式|expert mode/i },
      "zh-TW": { simple: /(普通|简单|簡單|基础|基礎)模式|simple mode|normal mode|basic mode/i, expert: /(专家|專家)模式|expert mode/i },
      ja: { simple: /(通常|シンプル|簡単)モード|simple mode|normal mode|basic mode/i, expert: /(エキスパート|専門家)モード|expert mode/i },
      ko: { simple: /(일반|간단|기본) 모드|simple mode|normal mode|basic mode/i, expert: /(전문가|고급) 모드|expert mode/i },
      en: { simple: /(simple|normal|basic) mode/i, expert: /expert mode/i },
    };

    for (const language of languages) {
      const visibleCopy = collectStrings(getUiCopy(language)).join("\n");

      expect(visibleCopy, `${language} should include simple or normal mode copy`).toMatch(expectations[language].simple);
      expect(visibleCopy, `${language} should include expert mode copy`).toMatch(expectations[language].expert);
    }
  });

  it("localizes file actions and assistant role copy in every supported language", () => {
    const english = getUiCopy("en");

    for (const language of languages) {
      const copy = getUiCopy(language);
      const fileActions = [
        copy.files.addFiles,
        copy.files.previewAria("brief.pdf"),
        copy.files.downloadAria("brief.pdf"),
        copy.files.copyAria("brief.pdf"),
        copy.files.renameAria("brief.pdf"),
        copy.files.deleteAria("brief.pdf"),
      ];

      expect(fileActions, `${language} file actions should expose the expected commands`).toHaveLength(6);
      expect(fileActions.every((item) => typeof item === "string"), `${language} file actions should be visible strings`).toBe(true);
      expect(fileActions.every((item) => item.trim().length > 0), `${language} file actions should not be blank`).toBe(true);

      const assistantTemplates = copy.assistant.templates;
      expect(assistantTemplates.map((template) => template.id)).toEqual(["study", "writing", "code", "files"]);
      for (const template of assistantTemplates) {
        expect(template.label.trim(), `${language} ${template.id} role label should exist`).not.toBe("");
        expect(template.description.trim(), `${language} ${template.id} role description should exist`).not.toBe("");
        expect(template.form.name.trim(), `${language} ${template.id} role form name should exist`).not.toBe("");
        expect(template.form.instructions.trim(), `${language} ${template.id} role instructions should exist`).not.toBe("");
      }

      if (language !== "en") {
        expect(copy.files.previewAria("brief.pdf")).not.toBe(english.files.previewAria("brief.pdf"));
        expect(copy.assistant.templates.map((template) => template.label)).not.toEqual(
          english.assistant.templates.map((template) => template.label)
        );
      }
    }
  });

  it("keeps the normal/expert mode switch wired in the app source", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const hasModeUnion = /(?:'simple'|'normal')[\s\S]{0,200}(?:'expert'|'advanced')|(?:'expert'|'advanced')[\s\S]{0,200}(?:'simple'|'normal')/.test(appSource);
    const hasModeState = /useState[\s\S]{0,180}(?:'simple'|'normal')/.test(appSource) && /useState[\s\S]{0,240}(?:'expert'|'advanced')/.test(appSource);
    const hasModeSetter = /set[A-Za-z]*(?:Mode|Level|View)[\s\S]{0,240}(?:'simple'|'normal')/.test(appSource)
      && /set[A-Za-z]*(?:Mode|Level|View)[\s\S]{0,240}(?:'expert'|'advanced')/.test(appSource);
    const hasLocalizedModeCopy = /copy\.(?:mode|viewMode|experienceMode|usabilityMode)[A-Za-z0-9_.]*(?:simple|normal|expert|advanced)/i.test(appSource);

    expect(hasModeUnion, "App.tsx should define a simple/normal plus expert/advanced mode union.").toBe(true);
    expect(hasModeState, "App.tsx should keep the selected mode in React state.").toBe(true);
    expect(hasModeSetter, "App.tsx should expose a control that switches between normal and expert modes.").toBe(true);
    expect(hasLocalizedModeCopy, "The mode switch should render localized copy instead of hard-coded labels.").toBe(true);
  });

  it("keeps an actionable entry in the chat empty state", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const emptyChat = sourceWindow(appSource, 'className="empty-chat"');

    expect(emptyChat).toContain("copy.chat.emptyTitle");
    expect(emptyChat).toContain("copy.chat.emptyDescription");
    expect(emptyChat, "The empty chat state should include a button-level entry point.").toMatch(/<button\b/);
    expect(emptyChat, "The empty chat entry should open setup, files, assistants, or a new conversation.").toMatch(
      /setSourcesOpen|setAssistantsOpen|openAdvanced|newSession|copy\.chat\.(?:empty|openSetup|addFile|newConversation)/
    );
  });

  it("keeps file rows behind an action bar with localized accessible labels", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");
    const sourcesDrawer = sourceWindow(appSource, "function SourcesDrawer", 7600);

    expect(sourcesDrawer).toContain('className="material-actions"');
    expect(sourcesDrawer).toContain("copy.files.previewAria(material.name)");
    expect(sourcesDrawer).toContain("copy.files.downloadAria(material.name)");
    expect(sourcesDrawer).toContain("copy.files.copyAria(material.name)");
    expect(sourcesDrawer).toContain("copy.files.renameAria(material.name)");
    expect(sourcesDrawer).toContain("copy.files.deleteAria(material.name)");
    expect(stylesSource).toMatch(/\.material-actions\s*\{/);
  });

  it("keeps runtime errors routed through a human-readable helper", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");

    expect(appSource).toMatch(/function\s+(?:friendly|human|plain)[A-Za-z]*(?:Error|Message)\(/);
    expect(appSource).toMatch(/(?:friendly|human|plain)[A-Za-z]*(?:Error|Message)\(runtime,\s*copy\)/);
    expect(appSource).toContain("copy.gateway.failed");
    expect(appSource).toContain("copy.gateway.notInstalled");
    expect(appSource).toContain("copy.gateway.paused");
  });
});
