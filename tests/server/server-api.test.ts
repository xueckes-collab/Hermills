import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createServer, type RuntimeAdapter } from "../../apps/server/src/index.js";
import { builtinAgentSeeds } from "@hermills/agent-builder";
import type { InstallEvent, RuntimeStatus } from "@hermills/core";
import type { HermesReplyRequest } from "@hermills/runtime";

describe("Hermills local API", () => {
  let server: FastifyInstance;
  let runtime: ReturnType<typeof createFakeRuntime>;
  let baseDir: string;
  const headers = { "x-hermills-token": "test-token" };

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-server-"));
    runtime = createFakeRuntime();
    server = await createServer({ baseDir, desktopToken: "test-token", runtimeService: runtime });
  });

  afterEach(async () => {
    await server.close();
  });

  it("requires desktop token for protected routes", async () => {
    expect((await server.inject({ method: "GET", url: "/api/agents" })).statusCode).toBe(401);
  });

  it("refuses to start without authentication outside explicit insecure dev mode", async () => {
    await expect(createServer({ baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-server-no-token-")) })).rejects.toThrow("desktop token is required");
  });

  it("returns app state for the first deploy gate", async () => {
    const response = await server.inject({ method: "GET", url: "/api/app-state", headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      version: 1,
      firstDeployHidden: false,
      shouldShowFirstDeploy: true,
      runtimeRecoverable: false
    });
  });

  it("marks first deploy hidden only after install completes with a running gateway", async () => {
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

    const response = await server.inject({ method: "GET", url: "/api/app-state", headers });
    expect(response.json()).toMatchObject({
      firstDeployHidden: true,
      shouldShowFirstDeploy: false,
      runtimeRecoverable: false,
      lastSuccessfulRuntimeVersion: "hermes-agent fake-v1"
    });
    expect(response.json().localDeployCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns update checks and starts runtime updates as force installs", async () => {
    runtime.status = successfulRuntimeStatus();
    runtime.updateCheck = {
      installed: true,
      installedVersion: "hermes-agent fake-v1",
      installedReleaseTag: "v0.14.0",
      latestVersion: "v0.15.0",
      latestReleaseName: "Hermes Agent v0.15.0",
      updateAvailable: true,
      checkState: "available",
      checkedAt: new Date().toISOString(),
      installerSha256: "a".repeat(64)
    };

    const checkResponse = await server.inject({ method: "GET", url: "/api/runtime/update-check?force=1", headers });
    expect(checkResponse.statusCode).toBe(200);
    expect(checkResponse.json()).toMatchObject({
      latestVersion: "v0.15.0",
      updateAvailable: true,
      checkState: "available"
    });

    const updateResponse = await server.inject({
      method: "POST",
      url: "/api/runtime/update",
      headers,
      payload: { installerSha256: "a".repeat(64) }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toEqual({ jobId: "job-test" });
    expect(runtime.installs.at(-1)).toMatchObject({
      channel: "official-docs-latest",
      force: true,
      skipBrowser: true,
      installerSha256: "a".repeat(64)
    });
  });

  it("keeps first deploy visible after a failed install event", async () => {
    await server.inject({ method: "POST", url: "/api/runtime/install", headers, payload: {} });
    runtime.emit("job-test", {
      jobId: "job-test",
      level: "error",
      step: "failed",
      progress: 100,
      message: "Installer failed.",
      createdAt: new Date().toISOString()
    });

    const response = await server.inject({ method: "GET", url: "/api/app-state", headers });
    expect(response.json()).toMatchObject({
      firstDeployHidden: false,
      shouldShowFirstDeploy: true
    });
    expect(response.json().localDeployCompletedAt).toBeUndefined();
  });

  it("creates provider, agent, session, and preview assistant reply", async () => {
    const providerCreateResponse = await server.inject({ method: "POST", url: "/api/settings/providers", headers, payload: {
      kind: "openai-compatible",
      displayName: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4.1-mini",
      apiKey: "sk-test-secret-value"
    } });
    expect(providerCreateResponse.statusCode).toBe(200);
    const providerResponse = await server.inject({ method: "GET", url: "/api/settings/providers", headers });
    expect(providerResponse.json()[0]).not.toHaveProperty("credentialRef");

    const agentResponse = await server.inject({ method: "POST", url: "/api/agents", headers, payload: {
      displayName: "Research Operator",
      instructions: "Answer precisely.",
      model: "gpt-4.1-mini",
      providerId: providerCreateResponse.json().id
    } });
    expect(agentResponse.statusCode).toBe(200);

    const sessionResponse = await server.inject({ method: "POST", url: "/api/chat/sessions", headers, payload: { agentId: agentResponse.json().id } });
    expect(sessionResponse.statusCode).toBe(200);

    const messageResponse = await server.inject({ method: "POST", url: `/api/chat/sessions/${sessionResponse.json().id}/messages`, headers, payload: { content: "Hello" } });
    expect(messageResponse.statusCode).toBe(200);
    expect(messageResponse.json().messages).toHaveLength(2);
    expect(runtime.requests[0]).toMatchObject({
      model: "gpt-4.1-mini",
      instructions: "Answer precisely.",
      provider: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test-secret-value",
        defaultModel: "gpt-4.1-mini"
      }
    });
  });

  it("tells users to add a model key instead of reinstalling when Hermes has no provider", async () => {
    runtime.createHermesReply = async () => {
      throw new Error("Internal server error: No inference provider configured. Run 'hermes model' to choose a provider and model, or set an API key (OPENAI_API_KEY).");
    };
    const sessionResponse = await server.inject({ method: "POST", url: "/api/chat/sessions", headers, payload: { title: "No key chat" } });
    expect(sessionResponse.statusCode).toBe(200);

    const messageResponse = await server.inject({
      method: "POST",
      url: `/api/chat/sessions/${sessionResponse.json().id}/messages`,
      headers,
      payload: { content: "Hello" }
    });

    expect(messageResponse.statusCode).toBe(200);
    const assistantMessage = messageResponse.json().messages[1].content as string;
    expect(assistantMessage).toContain("no model API key is ready");
    expect(assistantMessage).toContain("Add one API key");
    expect(assistantMessage).not.toContain("install Hermes Agent");
  });

  it("uploads materials and attaches text context to chat messages", async () => {
    const materialResponse = await server.inject({ method: "POST", url: "/api/materials", headers, payload: {
      name: "notes.md",
      mimeType: "text/markdown",
      size: 21,
      contentText: "# Notes\nUse Hermes first."
    } });
    expect(materialResponse.statusCode).toBe(200);
    expect(materialResponse.json()).not.toHaveProperty("path");

    const sessionResponse = await server.inject({ method: "POST", url: "/api/chat/sessions", headers, payload: { title: "Material chat" } });
    expect(sessionResponse.statusCode).toBe(200);

    const messageResponse = await server.inject({
      method: "POST",
      url: `/api/chat/sessions/${sessionResponse.json().id}/messages`,
      headers,
      payload: { content: "Use the notes.", materialIds: [materialResponse.json().id] }
    });
    expect(messageResponse.statusCode).toBe(200);
    expect(messageResponse.json().messages[0].content).toBe("Use the notes.");
    expect(runtime.requests.at(-1)?.messages.at(-1)?.content).toContain("--- Attached materials ---");
    expect(runtime.requests.at(-1)?.messages.at(-1)?.content).toContain("Use Hermes first.");
  });

  it("saves company profile, uploads company materials, and auto-attaches company context to chat", async () => {
    const profileResponse = await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Eckes Export",
      website: "https://example.com",
      markets: ["United States", "Germany"],
      mainProducts: ["LED work light"],
      paymentTerms: ["T/T", "L/C"],
      shippingTerms: ["FOB Ningbo"],
      brandVoice: "Professional and direct.",
      notes: "Always mention MOQ when buyers ask for samples."
    } });
    expect(profileResponse.statusCode).toBe(200);
    expect(profileResponse.json()).toMatchObject({ name: "Eckes Export", mainProducts: ["LED work light"] });

    const materialResponse = await server.inject({ method: "POST", url: "/api/company/materials", headers, payload: {
      name: "catalog.md",
      mimeType: "text/markdown",
      size: 36,
      contentText: "Model X has CE certification.",
      category: "product-catalog"
    } });
    expect(materialResponse.statusCode).toBe(200);
    expect(materialResponse.json()).toMatchObject({ scope: "company", category: "product-catalog" });
    expect(materialResponse.json()).not.toHaveProperty("path");

    const ordinaryMaterials = await server.inject({ method: "GET", url: "/api/materials", headers });
    expect(ordinaryMaterials.statusCode).toBe(200);
    expect(ordinaryMaterials.json()).toEqual([]);

    const sessionResponse = await server.inject({ method: "POST", url: "/api/chat/sessions", headers, payload: { title: "Company chat" } });
    expect(sessionResponse.statusCode).toBe(200);

    const messageResponse = await server.inject({
      method: "POST",
      url: `/api/chat/sessions/${sessionResponse.json().id}/messages`,
      headers,
      payload: { content: "What should I tell this buyer?" }
    });
    expect(messageResponse.statusCode).toBe(200);
    expect(messageResponse.json().messages[0].content).toBe("What should I tell this buyer?");
    const runtimeContent = runtime.requests.at(-1)?.messages.at(-1)?.content ?? "";
    expect(runtimeContent).toContain("--- Company knowledge ---");
    expect(runtimeContent).toContain("Eckes Export");
    expect(runtimeContent).toContain("Model X has CE certification.");
  });

  it("previews, updates, copies, and deletes company materials", async () => {
    const materialResponse = await server.inject({ method: "POST", url: "/api/company/materials", headers, payload: {
      name: "payment.md",
      mimeType: "text/markdown",
      size: 24,
      contentText: "Use 30% deposit and 70% before shipment.",
      category: "payment-terms"
    } });
    expect(materialResponse.statusCode).toBe(200);

    const id = materialResponse.json().id;
    const previewResponse = await server.inject({ method: "GET", url: `/api/company/materials/${id}/preview`, headers });
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json().contentText).toContain("30% deposit");

    const updateResponse = await server.inject({
      method: "PUT",
      url: `/api/company/materials/${id}`,
      headers,
      payload: { category: "faq", tags: ["payment"], description: "Buyer payment terms" }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({ category: "faq", tags: ["payment"], description: "Buyer payment terms" });

    const copyResponse = await server.inject({ method: "POST", url: `/api/company/materials/${id}/copy`, headers, payload: { name: "payment copy.md" } });
    expect(copyResponse.statusCode).toBe(200);
    expect(copyResponse.json()).toMatchObject({ scope: "company", name: "payment copy.md" });

    const deleteResponse = await server.inject({ method: "DELETE", url: `/api/company/materials/${id}`, headers });
    expect(deleteResponse.statusCode).toBe(204);
    const listResponse = await server.inject({ method: "GET", url: "/api/company/materials", headers });
    expect(listResponse.json().map((item: { id: string }) => item.id)).not.toContain(id);
  });

  it("searches, renames, deletes chat sessions, and reports estimated usage", async () => {
    const sessionResponse = await server.inject({ method: "POST", url: "/api/chat/sessions", headers, payload: { title: "Alpha chat" } });
    expect(sessionResponse.statusCode).toBe(200);

    const messageResponse = await server.inject({
      method: "POST",
      url: `/api/chat/sessions/${sessionResponse.json().id}/messages`,
      headers,
      payload: { content: "Find the deployment note." }
    });
    expect(messageResponse.statusCode).toBe(200);
    expect(messageResponse.json().messages[1].usage.totalTokens).toBeGreaterThan(0);

    const searchResponse = await server.inject({ method: "GET", url: "/api/chat/sessions?q=deployment", headers });
    expect(searchResponse.statusCode).toBe(200);
    expect(searchResponse.json()).toHaveLength(1);

    const renameResponse = await server.inject({
      method: "PUT",
      url: `/api/chat/sessions/${sessionResponse.json().id}`,
      headers,
      payload: { title: "Renamed chat" }
    });
    expect(renameResponse.statusCode).toBe(200);
    expect(renameResponse.json().title).toBe("Renamed chat");

    const usageResponse = await server.inject({ method: "GET", url: "/api/usage/summary", headers });
    expect(usageResponse.statusCode).toBe(200);
    expect(usageResponse.json()).toMatchObject({
      conversations: 1,
      messages: 2
    });
    expect(usageResponse.json().usage.totalTokens).toBeGreaterThan(0);

    const deleteResponse = await server.inject({ method: "DELETE", url: `/api/chat/sessions/${sessionResponse.json().id}`, headers });
    expect(deleteResponse.statusCode).toBe(204);
    const listResponse = await server.inject({ method: "GET", url: "/api/chat/sessions", headers });
    expect(listResponse.json()).toEqual([]);
  });

  it("previews, renames, copies, downloads, and deletes materials", async () => {
    const materialResponse = await server.inject({ method: "POST", url: "/api/materials", headers, payload: {
      name: "notes.md",
      folder: "Research",
      mimeType: "text/markdown",
      size: 24,
      contentText: "# Notes\nLocal only context."
    } });
    expect(materialResponse.statusCode).toBe(200);
    expect(materialResponse.json()).toMatchObject({ folder: "Research", extractionState: "indexed" });

    const previewResponse = await server.inject({ method: "GET", url: `/api/materials/${materialResponse.json().id}/preview`, headers });
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json().contentText).toContain("Local only context.");

    const renameResponse = await server.inject({
      method: "PUT",
      url: `/api/materials/${materialResponse.json().id}`,
      headers,
      payload: { name: "renamed.md", folder: null }
    });
    expect(renameResponse.statusCode).toBe(200);
    expect(renameResponse.json()).toMatchObject({ name: "renamed.md" });
    expect(renameResponse.json().folder).toBeUndefined();

    const copyResponse = await server.inject({
      method: "POST",
      url: `/api/materials/${materialResponse.json().id}/copy`,
      headers,
      payload: { folder: "Copies" }
    });
    expect(copyResponse.statusCode).toBe(200);
    expect(copyResponse.json()).toMatchObject({ folder: "Copies" });
    expect(copyResponse.json().name).toContain("copy");

    const downloadResponse = await server.inject({ method: "GET", url: `/api/materials/${materialResponse.json().id}/download`, headers });
    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.headers["content-disposition"]).toContain("renamed.md");
    expect(downloadResponse.body).toContain("Local only context.");

    const deleteResponse = await server.inject({ method: "DELETE", url: `/api/materials/${materialResponse.json().id}`, headers });
    expect(deleteResponse.statusCode).toBe(204);
    const listResponse = await server.inject({ method: "GET", url: "/api/materials", headers });
    expect(listResponse.json().map((material: { id: string }) => material.id)).not.toContain(materialResponse.json().id);
  });

  it("creates, activates, renames, and deletes local profiles", async () => {
    const initialResponse = await server.inject({ method: "GET", url: "/api/profiles", headers });
    expect(initialResponse.statusCode).toBe(200);
    expect(initialResponse.json().profiles).toHaveLength(1);

    const createResponse = await server.inject({ method: "POST", url: "/api/profiles", headers, payload: { name: "Work" } });
    expect(createResponse.statusCode).toBe(200);
    const workProfile = createResponse.json().profiles.find((profile: { name: string }) => profile.name === "Work");
    expect(workProfile).toBeTruthy();

    const activateResponse = await server.inject({ method: "PUT", url: `/api/profiles/${workProfile.id}`, headers, payload: { active: true, name: "Work mode" } });
    expect(activateResponse.statusCode).toBe(200);
    expect(activateResponse.json().activeProfileId).toBe(workProfile.id);
    expect(activateResponse.json().profiles.find((profile: { id: string }) => profile.id === workProfile.id).name).toBe("Work mode");

    const defaultProfile = activateResponse.json().profiles.find((profile: { id: string }) => profile.id !== workProfile.id);
    const deleteResponse = await server.inject({ method: "DELETE", url: `/api/profiles/${defaultProfile.id}`, headers });
    expect(deleteResponse.statusCode).toBe(204);

    const finalResponse = await server.inject({ method: "GET", url: "/api/profiles", headers });
    expect(finalResponse.json().profiles).toHaveLength(1);
    expect(finalResponse.json().activeProfileId).toBe(workProfile.id);
  });

  it("saves onboarding state without storing provider secrets in the response", async () => {
    const initialResponse = await server.inject({ method: "GET", url: "/api/onboarding", headers });
    expect(initialResponse.statusCode).toBe(200);
    expect(initialResponse.json()).toMatchObject({
      version: 1,
      language: "zh-CN",
      userDisplayName: "",
      agentName: "Hermes",
      memoryEnabled: false,
      theme: "warm"
    });

    const updateResponse = await server.inject({
      method: "PUT",
      url: "/api/onboarding",
      headers,
      payload: {
        language: "zh-CN",
        userDisplayName: "Ilya",
        agentName: "Research Guide",
        memoryEnabled: true,
        theme: "night",
        workspacePath: path.join(baseDir, "workspace"),
        provider: {
          kind: "openai-compatible",
          displayName: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          defaultModel: "gpt-4.1-mini",
          apiKey: "sk-onboarding-secret-value"
        }
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      language: "zh-CN",
      userDisplayName: "Ilya",
      agentName: "Research Guide",
      memoryEnabled: true,
      theme: "night",
      provider: {
        kind: "openai-compatible",
        displayName: "OpenAI",
        defaultModel: "gpt-4.1-mini",
        keyPreview: "sk-o••••alue"
      }
    });
    expect(updateResponse.json().provider).not.toHaveProperty("apiKey");

    const persistedResponse = await server.inject({ method: "GET", url: "/api/onboarding", headers });
    expect(persistedResponse.json()).toEqual(updateResponse.json());
  });

  it("completes onboarding, creates then updates the default profile and agent, and optionally saves a provider", async () => {
    const firstCompleteResponse = await server.inject({
      method: "POST",
      url: "/api/onboarding/complete",
      headers,
      payload: {
        language: "en",
        userDisplayName: "Ilya",
        agentName: "Hermes Guide",
        memoryEnabled: true,
        theme: "system",
        workspacePath: path.join(baseDir, "workspace")
      }
    });
    expect(firstCompleteResponse.statusCode).toBe(200);
    expect(firstCompleteResponse.json().onboardingCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(firstCompleteResponse.json().defaultAgentId).toBeTruthy();
    expect(firstCompleteResponse.json().provider).toBeUndefined();

    const profileResponse = await server.inject({ method: "GET", url: "/api/profiles", headers });
    expect(profileResponse.json().profiles).toHaveLength(1);
    expect(profileResponse.json().profiles[0]).toMatchObject({ name: "Ilya", active: true });

    const agentResponse = await server.inject({ method: "GET", url: "/api/agents", headers });
    expect(agentResponse.json()).toHaveLength(builtinAgentSeeds.length + 1);
    const defaultAgent = agentResponse.json().find((agent: { id: string }) => agent.id === firstCompleteResponse.json().defaultAgentId);
    expect(defaultAgent).toMatchObject({
      id: firstCompleteResponse.json().defaultAgentId,
      displayName: "Hermes Guide",
      model: "hermes-agent",
      capabilities: { memory: true }
    });
    expect(defaultAgent.providerId).toBeUndefined();

    const secondCompleteResponse = await server.inject({
      method: "POST",
      url: "/api/onboarding/complete",
      headers,
      payload: {
        userDisplayName: "Ilya Work",
        agentName: "Research Guide",
        memoryEnabled: false,
        provider: {
          kind: "openai-compatible",
          displayName: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          defaultModel: "gpt-4.1-mini",
          apiKey: "sk-onboarding-provider-secret"
        }
      }
    });
    expect(secondCompleteResponse.statusCode).toBe(200);
    expect(secondCompleteResponse.json().defaultAgentId).toBe(firstCompleteResponse.json().defaultAgentId);
    expect(secondCompleteResponse.json().provider).toMatchObject({
      kind: "openai-compatible",
      displayName: "OpenAI",
      defaultModel: "gpt-4.1-mini",
      keyPreview: "sk-o••••cret"
    });
    expect(secondCompleteResponse.json().provider).not.toHaveProperty("apiKey");

    const updatedProfiles = await server.inject({ method: "GET", url: "/api/profiles", headers });
    expect(updatedProfiles.json().profiles).toHaveLength(1);
    expect(updatedProfiles.json().profiles[0].name).toBe("Ilya Work");

    const providersResponse = await server.inject({ method: "GET", url: "/api/settings/providers", headers });
    expect(providersResponse.json()).toHaveLength(1);
    expect(providersResponse.json()[0]).not.toHaveProperty("credentialRef");

    const updatedAgents = await server.inject({ method: "GET", url: "/api/agents", headers });
    expect(updatedAgents.json()).toHaveLength(builtinAgentSeeds.length + 1);
    const updatedDefaultAgent = updatedAgents.json().find((agent: { id: string }) => agent.id === firstCompleteResponse.json().defaultAgentId);
    expect(updatedDefaultAgent).toMatchObject({
      id: firstCompleteResponse.json().defaultAgentId,
      displayName: "Research Guide",
      model: "gpt-4.1-mini",
      providerId: secondCompleteResponse.json().provider.id,
      capabilities: { memory: false }
    });
  });

  it("indexes extractable PDF uploads and keeps storage paths private", async () => {
    const materialResponse = await server.inject({
      method: "POST",
      url: "/api/materials",
      headers: {
        ...headers,
        "content-type": "multipart/form-data; boundary=hermills-test-boundary"
      },
      payload: multipartPayload("hermills-test-boundary", "brief.pdf", "application/pdf", minimalPdf("Hermes PDF context"))
    });
    expect(materialResponse.statusCode).toBe(200);
    expect(materialResponse.json()).toMatchObject({
      name: "brief.pdf",
      mimeType: "application/pdf",
      extractionState: "indexed",
      textPreview: "Hermes PDF context"
    });
    expect(materialResponse.json()).not.toHaveProperty("path");
  });

  it("persists multipart files, indexes text, and hides storage paths", async () => {
    const materialResponse = await server.inject({
      method: "POST",
      url: "/api/materials",
      headers: {
        ...headers,
        "content-type": "multipart/form-data; boundary=hermills-test-boundary"
      },
      payload: multipartPayload("hermills-test-boundary", "notes.txt", "text/plain", "local file upload")
    });
    expect(materialResponse.statusCode).toBe(200);
    expect(materialResponse.json()).toMatchObject({
      name: "notes.txt",
      mimeType: "text/plain",
      size: 17,
      extractionState: "indexed",
      textPreview: "local file upload"
    });
    expect(materialResponse.json()).toHaveProperty("sha256");
    expect(materialResponse.json()).not.toHaveProperty("path");
  });

  it("rejects unsupported material uploads", async () => {
    const materialResponse = await server.inject({
      method: "POST",
      url: "/api/materials",
      headers: {
        ...headers,
        "content-type": "multipart/form-data; boundary=hermills-test-boundary"
      },
      payload: multipartPayload("hermills-test-boundary", "program.exe", "application/x-msdownload", "MZ")
    });
    expect(materialResponse.statusCode).toBe(400);
    expect(materialResponse.json().error.message).toContain("Unsupported material type");
  });

  it("creates scheduled jobs, runs them, records history, and hides soft deleted jobs", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/jobs",
      headers,
      payload: {
        name: "Morning brief",
        schedule: { expression: "0 9 * * *", timezone: "Asia/Shanghai" },
        task: { prompt: "Write a short local brief.", model: "hermes-agent" }
      }
    });
    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json()).toMatchObject({ name: "Morning brief", status: "active" });

    const runResponse = await server.inject({ method: "POST", url: `/api/jobs/${createResponse.json().id}/run`, headers });
    expect(runResponse.statusCode).toBe(200);
    expect(runResponse.json()).toMatchObject({ status: "succeeded", jobId: createResponse.json().id });
    expect(runResponse.json().usage.totalTokens).toBeGreaterThan(0);
    expect(runtime.requests.at(-1)?.messages.at(-1)?.content).toContain("Write a short local brief.");

    const pauseResponse = await server.inject({ method: "POST", url: `/api/jobs/${createResponse.json().id}/pause`, headers });
    expect(pauseResponse.statusCode).toBe(200);
    expect(pauseResponse.json().status).toBe("paused");

    const skippedResponse = await server.inject({ method: "POST", url: `/api/jobs/${createResponse.json().id}/run-now`, headers });
    expect(skippedResponse.statusCode).toBe(200);
    expect(skippedResponse.json()).toMatchObject({ status: "skipped", error: "Job is paused." });

    const historyResponse = await server.inject({ method: "GET", url: `/api/jobs/${createResponse.json().id}/history`, headers });
    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.json().map((run: { status: string }) => run.status)).toEqual(["skipped", "succeeded"]);

    const deleteResponse = await server.inject({ method: "DELETE", url: `/api/jobs/${createResponse.json().id}`, headers });
    expect(deleteResponse.statusCode).toBe(204);
    const listResponse = await server.inject({ method: "GET", url: "/api/jobs", headers });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([]);
    const retainedHistory = await server.inject({ method: "GET", url: `/api/jobs/${createResponse.json().id}/history`, headers });
    expect(retainedHistory.json()).toHaveLength(2);
  });

  it("keeps job and channel records scoped to the active profile", async () => {
    const initialProfiles = (await server.inject({ method: "GET", url: "/api/profiles", headers })).json();
    const personalId = initialProfiles.activeProfileId;
    const createProfile = await server.inject({ method: "POST", url: "/api/profiles", headers, payload: { name: "Work" } });
    const workId = createProfile.json().profiles.find((profile: { name: string }) => profile.name === "Work").id;
    await server.inject({ method: "PUT", url: `/api/profiles/${workId}`, headers, payload: { active: true } });

    const jobResponse = await server.inject({
      method: "POST",
      url: "/api/jobs",
      headers,
      payload: {
        name: "Work job",
        schedule: { expression: "*/15 * * * *" },
        task: { prompt: "Use work profile only." }
      }
    });
    const channelResponse = await server.inject({
      method: "POST",
      url: "/api/channels",
      headers,
      payload: { kind: "slack", label: "Work Slack", enabled: true, secret: "xoxb-work-secret" }
    });
    expect((await server.inject({ method: "GET", url: "/api/jobs", headers })).json()).toHaveLength(1);
    expect((await server.inject({ method: "GET", url: "/api/channels", headers })).json()).toHaveLength(1);

    await server.inject({ method: "PUT", url: `/api/profiles/${personalId}`, headers, payload: { active: true } });
    expect((await server.inject({ method: "GET", url: "/api/jobs", headers })).json()).toEqual([]);
    expect((await server.inject({ method: "GET", url: "/api/channels", headers })).json()).toEqual([]);
    expect((await server.inject({ method: "GET", url: `/api/jobs/${jobResponse.json().id}`, headers })).statusCode).toBe(400);
    expect((await server.inject({ method: "POST", url: `/api/channels/${channelResponse.json().id}/test`, headers })).statusCode).toBe(400);
  });

  it("manages platform channels without returning stored secrets", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/settings/channels",
      headers,
      payload: { kind: "telegram", label: "Telegram bot", enabled: true, secret: "telegram-secret-token" }
    });
    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json()).toMatchObject({ kind: "telegram", label: "Telegram bot", status: "connected" });
    expect(createResponse.json()).not.toHaveProperty("secret");
    expect(createResponse.json()).not.toHaveProperty("secretRef");
    expect(createResponse.json().secretPreview).toContain("••••");

    const listResponse = await server.inject({ method: "GET", url: "/api/channels", headers });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()[0]).not.toHaveProperty("secretRef");

    const testResponse = await server.inject({ method: "POST", url: `/api/settings/channels/${createResponse.json().id}/test`, headers });
    expect(testResponse.statusCode).toBe(200);
    expect(testResponse.json()).toMatchObject({ ok: true, status: "connected" });

    const updateResponse = await server.inject({
      method: "PUT",
      url: `/api/channels/${createResponse.json().id}`,
      headers,
      payload: { clearSecret: true }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({ status: "needs-setup" });
    expect(updateResponse.json().secretPreview).toBeUndefined();
  });

  it("redacts logs and reports analytics across chat, jobs, channels, and logs", async () => {
    const logDir = path.join(baseDir, "logs");
    await mkdir(logDir, { recursive: true });
    await writeFile(path.join(logDir, "gateway-123.log"), "2026-05-25T01:02:03.000Z error api_key=sk-test-secret-value failed\n", "utf8");

    const logResponse = await server.inject({
      method: "POST",
      url: "/api/logs",
      headers,
      payload: { source: "server", level: "warn", message: "token=sk-another-secret-value check" }
    });
    expect(logResponse.statusCode).toBe(200);
    expect(logResponse.json().message).toContain("[REDACTED]");

    const jobResponse = await server.inject({
      method: "POST",
      url: "/api/jobs",
      headers,
      payload: {
        name: "Analytics job",
        schedule: { expression: "0 * * * *" },
        task: { prompt: "Count this job usage.", model: "hermes-agent" }
      }
    });
    await server.inject({ method: "POST", url: `/api/jobs/${jobResponse.json().id}/run`, headers });
    await server.inject({
      method: "POST",
      url: "/api/channels",
      headers,
      payload: { kind: "discord", label: "Discord", enabled: true, endpoint: "https://example.com/webhook" }
    });

    const logsResponse = await server.inject({ method: "GET", url: "/api/logs?q=secret", headers });
    expect(logsResponse.statusCode).toBe(200);
    expect(JSON.stringify(logsResponse.json())).not.toContain("sk-test-secret-value");
    expect(JSON.stringify(logsResponse.json())).not.toContain("sk-another-secret-value");

    const analyticsResponse = await server.inject({ method: "GET", url: "/api/analytics/summary", headers });
    expect(analyticsResponse.statusCode).toBe(200);
    expect(analyticsResponse.json()).toMatchObject({
      jobs: 1,
      activeJobs: 1,
      jobRuns: 1,
      channels: 1,
      connectedChannels: 1
    });
    expect(analyticsResponse.json().logs).toBeGreaterThanOrEqual(2);

    const usageResponse = await server.inject({ method: "GET", url: "/api/analytics/usage?source=job-run", headers });
    expect(usageResponse.statusCode).toBe(200);
    expect(usageResponse.json().totals.totalTokens).toBeGreaterThan(0);
    expect(usageResponse.json().sources[0]).toMatchObject({ key: "job-run", runs: 1 });
  });
});

function multipartPayload(boundary: string, fileName: string, contentType: string, body: string): Buffer {
  return Buffer.from([
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
    `Content-Type: ${contentType}`,
    "",
    body,
    `--${boundary}--`,
    ""
  ].join("\r\n"));
}

function minimalPdf(text: string): string {
  return [
    "%PDF-1.4",
    "1 0 obj",
    "<< /Length 48 >>",
    "stream",
    `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`,
    "endstream",
    "endobj",
    "trailer << /Root 1 0 R >>",
    "%%EOF"
  ].join("\n");
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("Timed out waiting for server state");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
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

type FakeRuntimeUpdateCheck = {
  installed: boolean;
  installedVersion?: string;
  installedReleaseTag?: string;
  latestVersion?: string;
  latestReleaseName?: string;
  updateAvailable: boolean;
  checkState: "not-installed" | "current" | "available" | "unknown";
  checkedAt: string;
  installerSha256?: string;
};

function createFakeRuntime() {
  const requests: HermesReplyRequest[] = [];
  const installs: Parameters<RuntimeAdapter["startInstall"]>[0][] = [];
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
    requests,
    installs,
    status: initialStatus,
    updateCheck: {
      installed: false,
      updateAvailable: false,
      checkState: "not-installed",
      checkedAt: new Date().toISOString()
    } as FakeRuntimeUpdateCheck,
    emit(jobId: string, event: InstallEvent) {
      for (const listener of listeners.get(jobId) ?? []) listener(event);
    },
    async getLatest() {
      return { sourceUrl: "https://example.com", installerUrl: "https://example.com/install.sh", licenseUrl: "https://example.com/LICENSE", fetchedAt: new Date().toISOString() };
    },
    async getUpdateCheck(_force = false) {
      return this.updateCheck;
    },
    async getStatus() {
      return this.status;
    },
    async startInstall(request: Parameters<RuntimeAdapter["startInstall"]>[0]) {
      installs.push(request);
      return { jobId: "job-test" };
    },
    getEvents(_jobId: string) {
      return [];
    },
    onEvent(jobId: string, listener: Parameters<RuntimeAdapter["onEvent"]>[1]) {
      const set = listeners.get(jobId) ?? new Set<(event: InstallEvent) => void>();
      set.add(listener);
      listeners.set(jobId, set);
      return () => set.delete(listener);
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
    async createHermesReply(request: HermesReplyRequest) {
      requests.push(request);
      return "fake Hermes reply";
    },
    async dispose() {
      return undefined;
    }
  } satisfies RuntimeAdapter & {
    requests: HermesReplyRequest[];
    installs: Parameters<RuntimeAdapter["startInstall"]>[0][];
    status: RuntimeStatus;
    updateCheck: FakeRuntimeUpdateCheck;
    emit(jobId: string, event: InstallEvent): void;
  };
}
