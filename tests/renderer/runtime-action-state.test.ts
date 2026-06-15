import { describe, expect, it } from "vitest";
import { getChatSessionDefaults, getDefaultChatProvider, getRuntimeActionState } from "../../apps/renderer/src/App.js";
import type { Agent, Provider, RuntimeStatus, RuntimeUpdateCheck } from "../../apps/renderer/src/api.js";

const baseRuntime: RuntimeStatus = {
  state: "ready",
  installed: true,
  localDeploymentComplete: true,
  version: "hermes-agent fake-v1",
  progress: 100,
  message: "Hermes is ready."
};

function updateCheck(updateAvailable: boolean): RuntimeUpdateCheck {
  return {
    installed: true,
    installedVersion: "hermes-agent fake-v1",
    installedReleaseTag: updateAvailable ? "v0.14.0" : "v0.15.0",
    latestVersion: "v0.15.0",
    updateAvailable,
    checkState: updateAvailable ? "available" : "current",
    checkedAt: new Date().toISOString()
  };
}

describe("runtime install action state", () => {
  it("keeps deploy as the first-run action", () => {
    expect(getRuntimeActionState({ ...baseRuntime, installed: false, state: "not-installed" }, undefined, true, false)).toEqual({
      kind: "deploy",
      label: "Set up Hermes"
    });
  });

  it("shows no install action when local Hermes is current", () => {
    expect(getRuntimeActionState(baseRuntime, updateCheck(false), false, false)).toEqual({
      kind: "none",
      label: "Hermes is up to date"
    });
  });

  it("shows update action only when an official update exists", () => {
    expect(getRuntimeActionState(baseRuntime, updateCheck(true), false, false)).toEqual({
      kind: "update",
      label: "Update Hermes"
    });
  });
});

describe("chat provider defaults", () => {
  const provider: Provider = {
    id: "provider-1",
    name: "OpenAI",
    status: "connected",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.5",
    maskedKey: "sk-..."
  };

  it("uses the first connected provider for new default chats", () => {
    expect(getDefaultChatProvider([{ ...provider, status: "missing" }, provider])).toEqual(provider);
    expect(getDefaultChatProvider([{ ...provider, status: "missing" }])).toBeUndefined();
    expect(getChatSessionDefaults(undefined, provider)).toEqual({
      providerId: "provider-1",
      model: "gpt-5.5"
    });
  });

  it("keeps an assistant-specific provider when one is configured", () => {
    const agent: Agent = {
      id: "agent-1",
      name: "Research",
      providerId: "agent-provider",
      model: "agent-model"
    };
    expect(getChatSessionDefaults(agent, provider)).toEqual({
      agentId: "agent-1",
      providerId: "agent-provider",
      model: "agent-model"
    });
  });
});
