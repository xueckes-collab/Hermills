import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createServer, type RuntimeAdapter } from "../../apps/server/src/index.js";
import type { InstallEvent, RuntimeStatus } from "@hermills/core";

describe("onboarding state contract", () => {
  let server: FastifyInstance;
  let runtime: ReturnType<typeof createFakeRuntime>;
  let baseDir: string;
  const headers = { "x-hermills-token": "test-token" };

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-onboarding-"));
    runtime = createFakeRuntime();
    server = await createServer({ baseDir, desktopToken: "test-token", runtimeService: runtime });
  });

  afterEach(async () => {
    await server.close();
  });

  it("enters onboarding after the first local deploy completes", async () => {
    const deployedState = await completeFirstDeploy(server, runtime, headers);
    const onboardingState = await getOnboarding(server, headers);

    expect(deployedState).toMatchObject({
      firstDeployHidden: true,
      shouldShowFirstDeploy: false
    });
    expect(onboardingState).toMatchObject({
      version: 1,
      language: "zh-CN",
      agentName: "Hermes",
      memoryEnabled: false,
      theme: "warm"
    });
    expect(onboardingState).not.toHaveProperty("onboardingCompletedAt");
    expect(onboardingState).not.toHaveProperty("provider");
  });

  it("allows provider setup to be skipped and persists completion", async () => {
    await completeFirstDeploy(server, runtime, headers);

    const skipResponse = await server.inject({
      method: "PUT",
      url: "/api/onboarding",
      headers,
      payload: {
        userDisplayName: "Alex",
        agentName: "Hermes",
        memoryEnabled: true,
        provider: null
      }
    });
    expect(skipResponse.statusCode, skipResponse.body).toBe(200);
    expect(skipResponse.json()).toMatchObject({
      userDisplayName: "Alex",
      agentName: "Hermes",
      memoryEnabled: true
    });
    expect(skipResponse.json()).not.toHaveProperty("provider");
    expect(skipResponse.json()).not.toHaveProperty("onboardingCompletedAt");

    const completeResponse = await server.inject({
      method: "POST",
      url: "/api/onboarding/complete",
      headers,
      payload: { provider: null, workspacePath: "~/Hermills" }
    });
    expect(completeResponse.statusCode, `POST /api/onboarding/complete should persist completion without requiring a provider. ${completeResponse.body}`).toBe(200);
    expect(completeResponse.json()).toMatchObject({
      workspacePath: "~/Hermills"
    });
    expect(completeResponse.json().onboardingCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(completeResponse.json()).not.toHaveProperty("provider");

    const providerResponse = await server.inject({ method: "GET", url: "/api/settings/providers", headers });
    expect(providerResponse.statusCode, providerResponse.body).toBe(200);
    expect(providerResponse.json()).toEqual([]);

    const appState = await getAppState(server, headers);
    expect(appState).toMatchObject({
      firstDeployHidden: true,
      shouldShowFirstDeploy: false
    });
  });

  it("can modify onboarding path without resetting existing app state", async () => {
    const deployedState = await completeFirstDeploy(server, runtime, headers);
    const completedAt = deployedState.localDeployCompletedAt;
    expect(completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const pathResponse = await server.inject({
      method: "PUT",
      url: "/api/onboarding",
      headers,
      payload: { workspacePath: "/tmp/hermills-workspace" }
    });
    expect(pathResponse.statusCode, `PUT /api/onboarding should update onboarding choices independently of deploy state. ${pathResponse.body}`).toBe(200);
    expect(pathResponse.json()).toMatchObject({
      workspacePath: "/tmp/hermills-workspace"
    });

    const appState = await getAppState(server, headers);
    expect(appState).toMatchObject({
      firstDeployHidden: true,
      localDeployCompletedAt: completedAt,
      shouldShowFirstDeploy: false
    });
  });

  it("can reopen onboarding from settings without resetting existing app state", async () => {
    const deployedState = await completeFirstDeploy(server, runtime, headers);
    const completedAt = deployedState.localDeployCompletedAt;

    const completeResponse = await server.inject({
      method: "POST",
      url: "/api/onboarding/complete",
      headers,
      payload: { provider: null }
    });
    expect(completeResponse.statusCode, completeResponse.body).toBe(200);
    expect(completeResponse.json().onboardingCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const reopenResponse = await server.inject({
      method: "PUT",
      url: "/api/onboarding",
      headers,
      payload: { onboardingCompletedAt: null }
    });
    expect(reopenResponse.statusCode, `PUT /api/onboarding with onboardingCompletedAt: null should let Settings/Status reopen onboarding. ${reopenResponse.body}`).toBe(200);
    expect(reopenResponse.json()).not.toHaveProperty("onboardingCompletedAt");

    const appState = await getAppState(server, headers);
    expect(appState).toMatchObject({
      firstDeployHidden: true,
      localDeployCompletedAt: completedAt,
      shouldShowFirstDeploy: false
    });
  });

  it("creates a provider only when the onboarding path includes provider credentials", async () => {
    await completeFirstDeploy(server, runtime, headers);

    const completeResponse = await server.inject({
      method: "POST",
      url: "/api/onboarding/complete",
      headers,
      payload: {
        provider: {
          kind: "openai-compatible",
          displayName: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          defaultModel: "gpt-4o-mini",
          apiKey: "sk-onboarding-test"
        }
      }
    });
    expect(completeResponse.statusCode, completeResponse.body).toBe(200);
    expect(completeResponse.json()).toMatchObject({
      provider: {
        displayName: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini"
      }
    });
    expect(completeResponse.json().provider.keyPreview).toMatch(/^sk-o.*test$/);

    const providerResponse = await server.inject({ method: "GET", url: "/api/settings/providers", headers });
    expect(providerResponse.statusCode, providerResponse.body).toBe(200);
    expect(providerResponse.json()).toHaveLength(1);
    expect(providerResponse.json()[0]).not.toHaveProperty("credentialRef");
  });
});

async function completeFirstDeploy(
  server: FastifyInstance,
  runtime: ReturnType<typeof createFakeRuntime>,
  headers: Record<string, string>,
): Promise<Record<string, unknown>> {
  const installResponse = await server.inject({ method: "POST", url: "/api/runtime/install", headers, payload: {} });
  expect(installResponse.statusCode).toBe(200);

  runtime.status = successfulRuntimeStatus();
  runtime.emit("job-test", {
    jobId: "job-test",
    level: "done",
    step: "verifying",
    progress: 100,
    message: "Gateway ready.",
    createdAt: new Date().toISOString()
  });

  await waitFor(async () => {
    const state = (await server.inject({ method: "GET", url: "/api/app-state", headers })).json();
    return state.firstDeployHidden === true;
  });

  return (await server.inject({ method: "GET", url: "/api/app-state", headers })).json();
}

async function getAppState(server: FastifyInstance, headers: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await server.inject({ method: "GET", url: "/api/app-state", headers });
  expect(response.statusCode, response.body).toBe(200);
  return response.json();
}

async function getOnboarding(server: FastifyInstance, headers: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await server.inject({ method: "GET", url: "/api/onboarding", headers });
  expect(response.statusCode, response.body).toBe(200);
  return response.json();
}

function successfulRuntimeStatus(): RuntimeStatus {
  return {
    platform: process.platform,
    arch: process.arch,
    installed: true,
    state: "ready",
    version: "hermes-agent fake-v1",
    runtimeHome: os.tmpdir(),
    installMetadata: {
      installedAt: new Date().toISOString(),
      sourceUrl: "https://example.com",
      installerUrl: "https://example.com/install.sh",
      licenseUrl: "https://example.com/LICENSE",
      version: "hermes-agent fake-v1"
    },
    gateway: {
      state: "running",
      apiBaseUrl: "http://127.0.0.1:8642"
    },
    checks: []
  };
}

function createFakeRuntime() {
  const listeners = new Map<string, Set<(event: InstallEvent) => void>>();
  const initialStatus: RuntimeStatus = {
    platform: process.platform,
    arch: process.arch,
    installed: false,
    state: "not-installed",
    runtimeHome: os.tmpdir(),
    checks: []
  };

  return {
    status: initialStatus,
    async getLatest() {
      return {
        sourceUrl: "https://example.com",
        installerUrl: "https://example.com/install.sh",
        licenseUrl: "https://example.com/LICENSE",
        fetchedAt: new Date().toISOString()
      };
    },
    async getUpdateCheck() {
      return {
        installed: this.status.installed,
        updateAvailable: false,
        checkState: this.status.installed ? "current" : "not-installed",
        checkedAt: new Date().toISOString()
      } as const;
    },
    async getStatus() {
      return this.status;
    },
    async startInstall() {
      return { jobId: "job-test" };
    },
    getEvents() {
      return [];
    },
    onEvent(jobId: string, listener: Parameters<RuntimeAdapter["onEvent"]>[1]) {
      const set = listeners.get(jobId) ?? new Set<(event: InstallEvent) => void>();
      set.add(listener);
      listeners.set(jobId, set);
      return () => set.delete(listener);
    },
    emit(jobId: string, event: InstallEvent) {
      for (const listener of listeners.get(jobId) ?? []) listener(event);
    },
    async getGatewayStatus() {
      return { state: "running", apiBaseUrl: "http://127.0.0.1:8642" };
    },
    async startGateway() {
      return { state: "running", apiBaseUrl: "http://127.0.0.1:8642" };
    },
    async stopGateway() {
      return { state: "stopped", apiBaseUrl: "http://127.0.0.1:8642" };
    },
    async restartGateway() {
      return { state: "running", apiBaseUrl: "http://127.0.0.1:8642" };
    },
    async getComputerControlStatus() {
      return fakeComputerControlStatus();
    },
    async prepareComputerControl() {
      return { ok: true, message: "computer control prepared", status: fakeComputerControlStatus() };
    },
    async requestComputerControlPermission() {
      return { ok: true, message: "permission requested", status: fakeComputerControlStatus() };
    },
    async installComputerControlDriver() {
      return { ok: true, message: "driver installed", status: fakeComputerControlStatus() };
    },
    async enableComputerControlTools() {
      return { ok: true, message: "tools enabled", status: fakeComputerControlStatus() };
    },
    async startComputerControlDashboard() {
      return { ok: true, message: "dashboard started", status: fakeComputerControlStatus() };
    },
    async stopComputerControlDashboard() {
      return { ok: true, message: "dashboard stopped", status: fakeComputerControlStatus() };
    },
    async runComputerControlPrompt() {
      return { ok: true, message: "computer operation finished", output: "fake computer output", status: fakeComputerControlStatus() };
    },
    async createHermesReply() {
      return "fake Hermes reply";
    },
    async dispose() {
      return undefined;
    }
  } satisfies RuntimeAdapter & {
    status: RuntimeStatus;
    emit(jobId: string, event: InstallEvent): void;
  };
}

function fakeComputerControlStatus() {
  return {
    platform: process.platform,
    supported: process.platform === "darwin",
    hermesCli: { found: true, version: "Hermes fake" },
    driver: { installed: false, statusText: "cua-driver: not installed" },
    toolsets: { computerUseEnabled: false, enabled: [], missingRequired: ["computer_use"] },
    dashboard: { state: "stopped" as const, message: "stopped" },
    readiness: "preparing" as const,
    permissions: []
  };
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("Timed out waiting for onboarding state");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
