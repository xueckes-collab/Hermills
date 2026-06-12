import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getUiCopy, normalizeUiLanguage } from "../../apps/renderer/src/i18n.js";
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
    const emptyChat = sourceWindow(appSource, 'className="empty-chat hermills-empty-chat"');
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(emptyChat).toContain("copy.chat.emptyTitle");
    expect(emptyChat).toContain("copy.chat.emptyDescription");
    expect(emptyChat, "The empty chat state should include a button-level entry point.").toMatch(/<(?:button|Button)\b/);
    expect(emptyChat, "The empty chat entry should open setup, files, assistants, or a new conversation.").toMatch(
      /setSourcesOpen|setAssistantsOpen|openAdvanced|newSession|copy\.chat\.(?:empty|openSetup|addFile|newConversation)/
    );
    expect(stylesSource).toMatch(/\.hermills-empty-chat \[data-slot="card-title"\],[\s\S]*?width:\s*100%/);
    expect(stylesSource).toMatch(/\.hermills-empty-chat \[data-slot="card-header"\]\s*\{[\s\S]*?width:\s*100%/);
    expect(stylesSource).toMatch(/\.hermills-empty-chat \[data-slot="card-content"\]\s*\{[\s\S]*?width:\s*100%/);
    expect(stylesSource).toMatch(/\.hermills-empty-chat\s*\{[\s\S]*?max-height:\s*100%/);
    expect(stylesSource).toMatch(/\.hermills-empty-chat\s*\{[\s\S]*?overflow:\s*auto/);
    expect(stylesSource).toMatch(/\.hermills-empty-chat \.empty-chat-entry\s*\{[\s\S]*?display:\s*grid !important/);
    expect(stylesSource).toMatch(/\.hermills-empty-chat \.empty-chat-entry\s*\{[\s\S]*?grid-template-columns:\s*42px minmax\(0,\s*1fr\) !important/);
    expect(stylesSource).toMatch(/\.hermills-empty-chat \.empty-chat-entry > span\s*\{[\s\S]*?grid-column:\s*2/);
    expect(stylesSource).toMatch(/\.hermills-empty-chat \.empty-chat-entry svg\s*\{[\s\S]*?grid-column:\s*1/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell \.service-warning\s*\{[\s\S]*?position:\s*static/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell \.service-warning\s*\{[\s\S]*?transform:\s*none/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell \.service-warning\s*\{[\s\S]*?white-space:\s*normal/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell \.service-warning\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell \.hermills-inline-service-warning\s*\{[\s\S]*?-webkit-line-clamp:\s*2/);
  });

  it("normalizes persisted language aliases instead of falling back to English", () => {
    expect(normalizeUiLanguage("zh")).toBe("zh-CN");
    expect(normalizeUiLanguage("zh_CN")).toBe("zh-CN");
    expect(normalizeUiLanguage("zh-Hans")).toBe("zh-CN");
    expect(normalizeUiLanguage("zh_Hant")).toBe("zh-TW");
    expect(normalizeUiLanguage(undefined)).toBe("zh-CN");
    expect(getUiCopy("zh").common.chat).toBe(getUiCopy("zh-CN").common.chat);
    expect(getUiCopy("zh_CN").common.chat).toBe(getUiCopy("zh-CN").common.chat);
  });

  it("keeps the desktop shell chrome and inspector localized", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const sidebar = sourceWindow(appSource, "const navItems", 1800);
    const inspector = sourceWindow(appSource, "function InspectorPanel", 4200);

    expect(sidebar).toContain("copy.common.chat");
    expect(sidebar).toContain("copy.common.assistants");
    expect(sidebar).toContain("copy.common.files");
    expect(sidebar).toContain("copy.common.provider");
    expect(sidebar).toContain("copy.common.settings");
    expect(sidebar).toContain("copy.common.brandSubtitle");
    expect(sidebar).toContain("copy.session.newConversation");
    expect(sidebar).toContain("aria-label={copy.advanced.navAria}");
    expect(sidebar).not.toContain("label: 'Chat'");
    expect(sidebar).not.toContain("Desktop AI workspace");
    expect(sidebar).not.toContain("New Chat");

    expect(inspector).toContain("copy.assistant.drawerTitle");
    expect(inspector).toContain("copy.diagnostics.localFiles");
    expect(inspector).toContain("copy.computerControl.cards.tools");
    expect(inspector).toContain("computerReadinessLabel");
    expect(inspector).toContain("computerReadinessDescription");
    expect(inspector).toContain("localizedAgentDescription");
    expect(inspector).toContain('className="hermills-tool-label"');
    expect(inspector).toContain("copy.providerStatus.connected");
    expect(inspector).not.toContain("Current Agent");
    expect(inspector).not.toContain("local files");
    expect(inspector).not.toContain("Local tools");
    expect(inspector).not.toContain("Provider Status");
    expect(inspector).not.toContain(">Open<");
  });

  it("keeps narrow inspector and sidebar status rows from overlapping text and icons", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(appSource).toContain("serviceWarning={serviceWarningMessage}");
    expect(appSource).toContain("hermills-inline-service-warning");
    expect(appSource).toContain("copy.assistant.localHermes");
    expect(appSource).not.toContain("'Hermes local'");
    expect(stylesSource).toMatch(/\.hermills-sidebar-status-label\s*\{[\s\S]*?text-overflow:\s*ellipsis/);
    expect(stylesSource).toMatch(/\.hermills-tool-list\s*\{[\s\S]*?display:\s*grid/);
    expect(stylesSource).toMatch(/\.hermills-tool-list\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(stylesSource).toMatch(/\.hermills-tool-label\s*\{[\s\S]*?grid-template-columns:\s*16px minmax\(0,\s*1fr\)/);
    expect(stylesSource).toMatch(/\.hermills-tool-label span\s*\{[\s\S]*?text-overflow:\s*ellipsis/);
    expect(stylesSource).toMatch(/\.hermills-inspector-card \[data-slot="card-description"\]\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
    expect(stylesSource).toMatch(/\.hermills-composer\s*\{[\s\S]*?width:\s*auto/);
    expect(stylesSource).toMatch(/\.hermills-composer\s*\{[\s\S]*?min-width:\s*0/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell \.service-warning\s*\{[\s\S]*?position:\s*static/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell \.service-warning\s*\{[\s\S]*?transform:\s*none/);
  });

  it("keeps dark desktop buttons readable in normal and disabled states", async () => {
    const buttonSource = await readFile(projectFile("apps/renderer/src/components/ui/button.tsx"), "utf8");
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(buttonSource).not.toContain("disabled:opacity-50");
    expect(stylesSource).not.toContain("opacity: 0.55");
    expect(stylesSource).not.toContain("opacity: 0.54");
    expect(stylesSource).toMatch(/\.first-run-shell \.primary-button,[\s\S]*?\.first-run-card \.primary-button\s*\{[\s\S]*?background:\s*#7c3aed/);
    expect(stylesSource).toMatch(/\[data-slot="button"\]\[data-variant="outline"\],[\s\S]*?\[data-slot="button"\]\[data-variant="secondary"\]\s*\{[\s\S]*?background:\s*var\(--button-secondary-bg\)/);
    expect(stylesSource).toMatch(/\[data-slot="button"\]:disabled\s*\{[\s\S]*?background:\s*var\(--button-disabled-bg\) !important/);
    expect(stylesSource).toMatch(/\[data-slot="button"\]:disabled\s*\{[\s\S]*?color:\s*var\(--button-disabled-text\) !important/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell \.primary-button,\s*\.hermills-dark-shell \.send-button\s*\{[\s\S]*?background:\s*#7c3aed/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell \[data-slot="button"\]\[data-variant="outline"\],[\s\S]*?\.hermills-dark-shell \.soft-button\s*\{[\s\S]*?background:\s*var\(--button-secondary-bg\)/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell \[data-slot="button"\]\[data-variant="link"\],[\s\S]*?\.hermills-dark-shell \.text-button\s*\{[\s\S]*?color:\s*#ddd6fe/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell button:disabled,[\s\S]*?background:\s*var\(--button-disabled-bg\) !important/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell button:disabled,[\s\S]*?color:\s*var\(--button-disabled-text\) !important/);
    expect(stylesSource).toMatch(/\.hermills-dark-shell button:disabled,[\s\S]*?opacity:\s*1/);
    expect(stylesSource).toMatch(/\.letter-primary\s*\{[\s\S]*?background:\s*var\(--button-primary-bg\)/);
    expect(stylesSource).toMatch(/\.letter-secondary\s*\{[\s\S]*?background:\s*var\(--button-secondary-bg\)/);
    expect(stylesSource).toMatch(/\.letter-primary:disabled,[\s\S]*?\.letter-automation-banner button:disabled\s*\{[\s\S]*?opacity:\s*1/);
  });

  it("keeps outreach and drawers inside the desktop shell instead of creating page-level horizontal scroll", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(appSource).toContain("singleSendBlocker");
    expect(appSource).toContain('className="letter-app-shell"');
    expect(appSource).not.toContain('className="outreach-workspace"');
    expect(stylesSource).toMatch(/\.hermills-menu-sidebar,\s*\.hermills-chat-panel,\s*\.hermills-inspector\s*\{[\s\S]*?min-width:\s*0/);
    expect(stylesSource).toMatch(/\.hermills-chat-panel\s*\{[\s\S]*?container-name:\s*hermills-workspace/);
    expect(stylesSource).toMatch(/\.hermills-chat-panel\s*\{[\s\S]*?container-type:\s*inline-size/);
    expect(stylesSource).toMatch(/\.letter-app-shell\s*\{[\s\S]*?max-width:\s*100%/);
    expect(stylesSource).toMatch(/\.letter-main\s*\{[\s\S]*?overflow-x:\s*hidden/);
    expect(stylesSource).toMatch(/\.letter-toolbar\s*\{[\s\S]*?flex-wrap:\s*wrap/);
    expect(stylesSource).toMatch(/\.letter-filter-row\s*\{[\s\S]*?flex-wrap:\s*wrap/);
    expect(stylesSource).toMatch(/@container \(max-width:\s*920px\)[\s\S]*?\.letter-leads-layout,[\s\S]*?\.letter-campaign-review-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
    expect(stylesSource).toMatch(/@container \(max-width:\s*920px\)[\s\S]*?\.letter-toolbar\s*\{[\s\S]*?display:\s*grid/);
    expect(stylesSource).toMatch(/@container \(max-width:\s*920px\)[\s\S]*?\.letter-filter-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(92px,\s*1fr\)\)/);
    expect(stylesSource).toMatch(/\.hermills-app-shell > \.sources-drawer,[\s\S]*?\.hermills-app-shell > \.assistant-drawer\s*\{[\s\S]*?position:\s*fixed/);
    expect(stylesSource).toMatch(/\.hermills-app-shell\.sources-visible > \.sources-drawer\.open,[\s\S]*?\.hermills-app-shell > \.assistant-drawer\.open\s*\{[\s\S]*?display:\s*grid/);
  });

  it("keeps the Letter App outreach workspace readable and scrollable", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(appSource).toContain('className="letter-app-shell"');
    expect(appSource).toContain("workspaceView === 'outreach' ? 'outreach-active' : ''");
    expect(appSource).toContain("type LetterOutreachView");
    expect(appSource).toContain("工作台");
    expect(appSource).toContain("客户管理");
    expect(appSource).toContain("批量导入");
    expect(appSource).toContain("importLetterFile");
    expect(appSource).toContain("deleteOutreachLeads");
    expect(appSource).toContain("LetterGenerationTrace");
    expect(appSource).toContain('className="letter-draft-card"');
    expect(appSource).toContain("api.outreachDrafts");
    expect(appSource).toContain("letter-campaign-review-grid");
    expect(stylesSource).toMatch(/\.letter-app-shell\s*\{[\s\S]*?overflow:\s*hidden/);
    expect(stylesSource).toMatch(/\.letter-main\s*\{[\s\S]*?overflow:\s*auto/);
    expect(stylesSource).toMatch(/\.letter-nav button,[\s\S]*?\.letter-primary,[\s\S]*?\.letter-secondary,[\s\S]*?min-height:\s*36px/);
    expect(stylesSource).toMatch(/\.letter-form-grid input,[\s\S]*?\.letter-import-textarea\s*\{[\s\S]*?color:\s*#111827/);
    expect(stylesSource).toMatch(/\.letter-thinking-panel\s*\{/);
    expect(stylesSource).toMatch(/\.letter-draft-card\s*\{/);
    expect(stylesSource).toMatch(/\.letter-campaign-review-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(220px,\s*0\.72fr\) minmax\(320px,\s*1\.28fr\)/);
    expect(stylesSource).toMatch(/\.hermills-chat-panel\.outreach-active \.mobile-workspace-toolbar\s*\{[\s\S]*?position:\s*static/);
    expect(stylesSource).toMatch(/@container \(max-width:\s*920px\)[\s\S]*?\.letter-sidebar\s*\{[\s\S]*?display:\s*grid/);
    expect(stylesSource).toMatch(/@container \(max-width:\s*920px\)[\s\S]*?\.letter-brand\s*\{[\s\S]*?padding:\s*0/);
    expect(stylesSource).toMatch(/@media \(max-width:\s*1180px\)[\s\S]*?\.letter-leads-layout,[\s\S]*?\.letter-campaign-review-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  });

  it("keeps onboarding actions reachable by scrolling the content region instead of the whole card", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toMatch(/\.hermills-onboarding-shell\s*\{[\s\S]*?height:\s*100vh/);
    expect(stylesSource).toMatch(/\.hermills-onboarding-shell\s*\{[\s\S]*?height:\s*100dvh/);
    expect(stylesSource).toMatch(/\.hermills-onboarding-shell\s*\{[\s\S]*?overflow:\s*hidden/);
    expect(stylesSource).toMatch(/\.hermills-onboarding-shell \.onboarding-card\s*\{[\s\S]*?height:\s*100%/);
    expect(stylesSource).toMatch(/\.hermills-onboarding-shell \.onboarding-card\s*\{[\s\S]*?min-height:\s*0/);
    expect(stylesSource).toMatch(/\.hermills-onboarding-shell \.onboarding-card\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0,\s*1fr\)/);
    expect(stylesSource).toMatch(/@media \(max-width:\s*820px\)[\s\S]*?\.hermills-onboarding-shell \.onboarding-card\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\)/);
    expect(stylesSource).toMatch(/\.hermills-onboarding-shell \.onboarding-panel\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(0,\s*1fr\) auto auto/);
    expect(stylesSource).toMatch(/\.hermills-onboarding-shell \.onboarding-content\s*\{[\s\S]*?overflow:\s*auto/);
    expect(stylesSource).toMatch(/\.hermills-onboarding-shell \.onboarding-actions\s*\{[\s\S]*?flex:\s*0 0 auto/);
  });

  it("keeps outreach defaults and system permission copy localized", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const serverSource = await readFile(projectFile("apps/server/src/index.ts"), "utf8");

    expect(getUiCopy("zh-CN").devLetter.defaults.language).toBe("中文");
    expect(getUiCopy("zh-CN").devLetter.defaults.tone).toBe("专业、真诚、简洁");
    expect(getUiCopy("zh-CN").devLetter.mailSetup.defaultSenderLabel).toBe("公司发件邮箱");
    expect(getUiCopy("zh-CN").devLetter.mailSetup.defaultSenderFromName).toBe("销售团队");
    expect(getUiCopy("zh-CN").devLetter.mailSetup.providerSenderLabel("Gmail")).toBe("Gmail 发件邮箱");
    expect(getUiCopy("zh-CN").computerControl.permissionNudgeDetail).not.toContain("macOS");
    expect(appSource).toContain("copy.devLetter.defaults.language");
    expect(appSource).toContain("copy.devLetter.defaults.tone");
    expect(appSource).toContain("copy.devLetter.batch.defaultName");
    expect(appSource).toContain("emptySenderDraft(companyProfile, copy)");
    expect(appSource).toContain("copy.devLetter.mailSetup.providerSenderLabel");
    expect(appSource).toContain("document.documentElement.lang = normalizeUiLanguage");
    expect(appSource).not.toContain("useState('English')");
    expect(appSource).not.toContain("useState('professional, warm, concise')");
    expect(appSource).not.toContain("useState('开发信批量任务')");
    expect(serverSource).toContain("defaultOnboardingAgentDescription(input.state.language)");
    expect(serverSource).not.toContain("这台 Mac");
    expect(serverSource).not.toContain("如果 macOS");
  });

  it("sends the chat composer on Enter while keeping Shift+Enter for new lines", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const composer = sourceWindow(appSource, 'className="composer-input"', 1400);

    expect(appSource).toContain("function handleComposerKeyDown");
    expect(appSource).toContain("event.key !== 'Enter'");
    expect(appSource).toContain("event.shiftKey");
    expect(appSource).toContain("event.nativeEvent.isComposing");
    expect(appSource).toContain("event.currentTarget.form?.requestSubmit()");
    expect(composer).toContain("onKeyDown={handleComposerKeyDown}");
  });

  it("shows sent messages and a Hermes thinking bubble before the reply resolves", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const sendFlow = sourceWindow(appSource, "async function sendMessage", 3200);
    const messageStream = sourceWindow(appSource, 'className="hermills-message-stream"', 2600);

    expect(sendFlow).toContain("optimisticUserMessage");
    expect(sendFlow).toContain("optimisticSession");
    expect(sendFlow).toMatch(/setSessions\(nextSessionList\)[\s\S]{0,500}await api\.sendChatMessage/);
    expect(sendFlow).toMatch(/setDraft\(''\)[\s\S]{0,500}await api\.sendChatMessage/);
    expect(messageStream).toContain("sending ? (");
    expect(messageStream).toContain('className="message agent pending"');
    expect(messageStream).toContain("copy.chat.thinking");
  });

  it("keeps native Hermes computer control inside the ordinary chat stream", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const apiSource = await readFile(projectFile("apps/renderer/src/api.ts"), "utf8");
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(appSource).toContain("type WorkspaceView = 'chat' | 'outreach'");
    expect(appSource).toContain("function ComputerControlInlinePanel");
    expect(appSource).toContain("function ComputerPermissionNudge");
    expect(appSource).toContain("parseComputerControlMessage(message.content)");
    expect(appSource).toContain("api.prepareComputerControl");
    expect(appSource).toContain("api.requestComputerControlPermission");
    expect(appSource).toContain("COMPUTER_CONTROL_MESSAGE_PREFIX");
    expect(appSource).not.toContain("setWorkspaceView('computer')");
    expect(appSource).not.toContain("api.startComputerControlDashboard");
    expect(appSource).not.toContain("api.enableComputerControlTools");
    expect(appSource).not.toContain("api.installComputerControlDriver");
    expect(appSource).not.toContain("id: 'computerControl'");
    expect(apiSource).toContain("/api/computer-control/status");
    expect(apiSource).toContain("/api/computer-control/dashboard/start");
    expect(stylesSource).toContain(".message.computer-control-message");
    expect(stylesSource).toContain(".computer-inline-note");
    expect(stylesSource).toContain(".computer-permission-nudge");
    expect(stylesSource).not.toContain(".computer-inline-frame");
    expect(stylesSource).not.toContain(".computer-inline-actions");
  });

  it("keeps computer control as chat-only copy in every supported language", () => {
    for (const language of languages) {
      const copy = getUiCopy(language);
      expect(copy.topbar.computer.trim(), `${language} computer topbar copy should exist`).not.toBe("");
      expect(copy.computerControl.inlineTitle.trim(), `${language} inline computer title should exist`).not.toBe("");
      expect(copy.computerControl.inlineSubtitle.trim(), `${language} inline computer subtitle should exist`).not.toBe("");
      expect(copy.computerControl.permissionNudgeTitle.trim(), `${language} permission title should exist`).not.toBe("");
      expect(copy.computerControl.permissionNudgeAction.trim(), `${language} permission action should exist`).not.toBe("");
      expect("computerControl" in copy.chat.emptyActions, `${language} should not expose computer control as an empty-card action`).toBe(false);
    }
  });

  it("keeps the lightweight paper UI system wired into chat", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toContain("--paper:");
    expect(stylesSource).toContain("--paper-soft:");
    expect(stylesSource).toContain("--paper-green:");
    expect(stylesSource).toContain("--radius-lg:");
    expect(stylesSource).toContain("--shadow-soft:");
    expect(stylesSource).toMatch(/\.conversation-title\s*\{[\s\S]*width:\s*min\(1124px,\s*100%\)/);
    expect(stylesSource).toMatch(/\.message-stream\s*\{[\s\S]*width:\s*min\(1124px,\s*100%\)/);
    expect(stylesSource).toMatch(/\.composer\s*\{[\s\S]*width:\s*min\(1124px,\s*100%\)/);
    expect(stylesSource).toContain(".message-role");
    expect(appSource).toContain('className="message-role"');
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
    expect(appSource).toContain("'Hermes is installed. Start Hermes to chat.': copy.gateway.paused");
  });
});
