import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function projectFile(...segments: string[]): string {
  return path.join(root, ...segments);
}

describe("renderer onboarding routing contract", () => {
  it("routes deployed first-run users through onboarding before workspace data loads", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");

    expect(appSource).toContain("const onboarding = useEndpoint(loadOnboardingState, fallbackOnboarding, workspaceEnabled)");
    expect(appSource).toContain("const chatEnabled = workspaceEnabled && onboarding.data.completed");
    expect(appSource).toContain("if (!onboarding.data.completed)");
    expect(appSource.indexOf("if (!onboarding.data.completed)")).toBeLessThan(appSource.indexOf("className={`client-shell"));
  });

  it("keeps provider setup optional in the onboarding wizard", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");

    expect(appSource).toContain("type OnboardingProviderChoice = ProviderPresetId | 'skip'");
    expect(appSource).toContain("providerChoice === 'skip'");
    expect(appSource).toContain("provider: null");
    expect(appSource).toContain("copy.onboarding.provider.skip");
  });

  it("treats persisted onboardingCompletedAt as completed so onboarding stays hidden", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const mapsPersistedCompletion = /completed:\s*Boolean\([^)]*onboardingCompletedAt/.test(appSource);

    expect(
      mapsPersistedCompletion,
      "normalizeOnboardingState should map the server's onboardingCompletedAt field into completed=true."
    ).toBe(true);
  });

  it("keeps language editable after onboarding inside settings", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");

    expect(appSource).toContain("function PersonalizationPanel");
    expect(appSource).toContain("select value={draft.language}");
    expect(appSource).toContain("languageOptions.map");
    expect(appSource).toContain("function setPersonalizationLanguage(language: OnboardingLanguage)");
    expect(appSource).toContain("setOnboardingState({ ...onboardingState, language })");
    expect(appSource).toContain("setOnboardingState(await completeOnboardingState");
  });
});
