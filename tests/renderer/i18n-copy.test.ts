import { describe, expect, it } from "vitest";
import { getUiCopy } from "../../apps/renderer/src/i18n.js";
import type { UiLanguage } from "../../apps/renderer/src/i18n.js";

const languages: UiLanguage[] = ["zh-CN", "zh-TW", "ja", "ko", "en"];

describe("renderer language copy", () => {
  it("keeps all visible panels behind the selected language copy", () => {
    const expectations: Record<UiLanguage, string[]> = {
      "zh-CN": ["设置 Hermes", "文件", "助手", "个人设置", "运行时"],
      "zh-TW": ["設定 Hermes", "檔案", "助手", "個人設定", "執行時"],
      ja: ["Hermes を設定", "ファイル", "アシスタント", "個人設定", "ランタイム"],
      ko: ["Hermes 설정", "파일", "도우미", "개인 설정", "런타임"],
      en: ["Set up Hermes", "Files", "Assistants", "Personal setup", "Runtime"],
    };

    for (const language of languages) {
      const copy = getUiCopy(language);
      const visibleCopy = [
        copy.runtime.action.setUp,
        copy.files.title,
        copy.assistant.drawerTitle,
        copy.personalization.eyebrow,
        copy.diagnostics.runtime,
      ];

      expect(visibleCopy).toEqual(expectations[language]);
    }
  });

  it("localizes setup, files, assistants, keys, diagnostics, and feature descriptions outside English", () => {
    const english = getUiCopy("en");

    for (const language of languages.filter((item) => item !== "en")) {
      const copy = getUiCopy(language);

      expect(copy.runtime.action.setUp).not.toBe(english.runtime.action.setUp);
      expect(copy.files.empty).not.toBe(english.files.empty);
      expect(copy.assistant.noAssistants).not.toBe(english.assistant.noAssistants);
      expect(copy.keys.noProviders).not.toBe(english.keys.noProviders);
      expect(copy.diagnostics.localChatHistory).not.toBe(english.diagnostics.localChatHistory);
      expect(copy.onboarding.features.files.detail).not.toBe(english.onboarding.features.files.detail);
    }
  });

  it("localizes company knowledge copy in every supported language", () => {
    const english = getUiCopy("en");

    for (const language of languages) {
      const copy = getUiCopy(language);
      const visibleCopy = [
        copy.common.companyKnowledge,
        copy.advanced.tabs.company,
        copy.chat.emptyActions.companyKnowledge.title,
        copy.companyKnowledge.title,
        copy.companyKnowledge.profileTitle,
        copy.companyKnowledge.materialsTitle,
        copy.companyKnowledge.categories["product-catalog"],
        copy.diagnostics.companyKnowledge,
      ];

      expect(visibleCopy.every((item) => typeof item === "string" && item.trim().length > 0), `${language} company knowledge copy should not be blank`).toBe(true);

      if (language !== "en") {
        expect(copy.companyKnowledge.title).not.toBe(english.companyKnowledge.title);
        expect(copy.chat.emptyActions.companyKnowledge.title).not.toBe(english.chat.emptyActions.companyKnowledge.title);
      }
    }
  });

  it("keeps outreach writer copy available in every supported language", () => {
    const english = getUiCopy("en");

    for (const language of languages) {
      const copy = getUiCopy(language);
      const visibleCopy = [
        copy.topbar.devLetter,
        copy.devLetter.title,
        copy.devLetter.quickTitle,
        copy.devLetter.quickSubtitle,
        copy.devLetter.steps.auto,
        copy.devLetter.steps.draft,
        copy.devLetter.steps.send,
        copy.devLetter.fields.companyName,
        copy.devLetter.fields.website,
        copy.devLetter.fields.email,
        copy.devLetter.fields.senderEmail,
        copy.devLetter.actions.researchGenerate,
        copy.devLetter.actions.generate,
        copy.devLetter.actions.send,
        copy.devLetter.status.researched,
        copy.devLetter.status.workflowGenerated,
        copy.devLetter.status.noLeads,
        copy.devLetter.results.title,
        copy.devLetter.results.customerResearch,
        copy.devLetter.results.icp,
        copy.devLetter.results.usp,
        copy.devLetter.results.firstEmail,
        copy.devLetter.results.followUp(1),
        copy.devLetter.results.daysLater(2),
        copy.devLetter.results.status.draft,
        copy.devLetter.warnings.quickRequired,
        copy.devLetter.warnings.confirmSend,
        copy.devLetter.warnings.confirmBatchSend(3),
        copy.devLetter.warnings.confirmStopCampaign,
        copy.devLetter.batch.singleMode,
        copy.devLetter.batch.campaignMode,
        copy.devLetter.batch.title,
        copy.devLetter.batch.actions.create,
        copy.devLetter.batch.actions.generate,
        copy.devLetter.batch.actions.approve,
        copy.devLetter.batch.actions.send,
        copy.devLetter.batch.campaignStatus.ready,
        copy.devLetter.batch.recipientStatus.generated,
        copy.devLetter.batch.recipientStatus.approved,
        copy.devLetter.batch.status.created(2),
        copy.devLetter.batch.status.sent(1),
        copy.devLetter.batch.warnings.noApproved,
      ];

      expect(visibleCopy.every((item) => typeof item === "string" && item.trim().length > 0), `${language} outreach copy should not be blank`).toBe(true);
    }

    expect(getUiCopy("zh-CN").devLetter.title).not.toBe(english.devLetter.title);
  });
});
