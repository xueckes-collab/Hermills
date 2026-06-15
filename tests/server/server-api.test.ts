import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createServer, type RuntimeAdapter } from "../../apps/server/src/index.js";
import { builtinAgentSeeds } from "@hermills/agent-builder";
import type { DeepResearchSidecarConfig, InstallEvent, RuntimeStatus } from "@hermills/core";
import type { HermesReplyRequest } from "@hermills/runtime";

describe("Hermills local API", () => {
  let server: FastifyInstance;
  let runtime: ReturnType<typeof createFakeRuntime>;
  let baseDir: string;
  const headers = { "x-hermills-token": "test-token" };

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-server-"));
    runtime = createFakeRuntime();
    server = await createServer({ baseDir, desktopToken: "test-token", runtimeService: runtime, deepResearch: { enabled: false } });
  });

  afterEach(async () => {
    await server.close();
    vi.restoreAllMocks();
  });

  async function restartServerWithDeepResearch(deepResearch: Partial<DeepResearchSidecarConfig>) {
    await server.close();
    server = await createServer({ baseDir, desktopToken: "test-token", runtimeService: runtime, deepResearch });
  }

  async function seedOutreachCompanyProfile() {
    await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Eckes Export",
      website: "https://eckes-export.example",
      mainProducts: ["LED work light"],
      certifications: ["CE"]
    } });
  }

  function mockWorkflowReply() {
    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      return JSON.stringify({
        icps: [],
        usps: [],
        initialEmail: {
          subject: "Contractor lighting options",
          body: "Hi, I saw this buyer imports work lights for contractor channels, so supplier reliability likely affects project availability.\nWe can share two LED work light options with MOQ and lead time side by side.\nIf useful, I can send an A/B comparison: fast sampling or repeat supply. Which fits better?"
        },
        followUps: []
      });
    };
  }

  async function generateDeepWorkflow(website: string, email: string) {
    return server.inject({
      method: "POST",
      url: "/api/outreach/workflows/auto",
      headers,
      payload: {
        website,
        email,
        language: "English",
        tone: "warm and concise",
        researchDepth: "deep"
      }
    });
  }

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

  it("exposes fixed computer-control actions behind the desktop token", async () => {
    expect((await server.inject({ method: "GET", url: "/api/computer-control/status" })).statusCode).toBe(401);

    const statusResponse = await server.inject({ method: "GET", url: "/api/computer-control/status", headers });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json()).toMatchObject({
      hermesCli: { found: true },
      readiness: "preparing",
      dashboard: { state: "stopped" }
    });

    const prepareResponse = await server.inject({ method: "POST", url: "/api/computer-control/prepare", headers, payload: {} });
    expect(prepareResponse.statusCode).toBe(200);
    expect(prepareResponse.json()).toMatchObject({
      ok: true,
      status: { readiness: "ready" }
    });

    const permissionResponse = await server.inject({ method: "POST", url: "/api/computer-control/request-permission", headers, payload: { permission: "accessibility" } });
    expect(permissionResponse.statusCode).toBe(200);
    expect(permissionResponse.json()).toMatchObject({
      ok: true,
      status: { readiness: "ready" }
    });

    const toolsResponse = await server.inject({ method: "POST", url: "/api/computer-control/enable-tools", headers, payload: {} });
    expect(toolsResponse.statusCode).toBe(200);
    expect(toolsResponse.json()).toMatchObject({
      ok: true,
      status: { toolsets: { computerUseEnabled: true } }
    });

    const dashboardResponse = await server.inject({ method: "POST", url: "/api/computer-control/dashboard/start", headers, payload: {} });
    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.json()).toMatchObject({
      ok: true,
      status: { dashboard: { state: "running", url: "http://127.0.0.1:9119" } }
    });
  });

  it("routes computer-control requests from normal chat into built-in Hermes computer operation", async () => {
    const sessionResponse = await server.inject({ method: "POST", url: "/api/chat/sessions", headers, payload: { title: "Computer chat" } });

    const messageResponse = await server.inject({
      method: "POST",
      url: `/api/chat/sessions/${sessionResponse.json().id}/messages`,
      headers,
      payload: { content: "帮我控制这台 Mac 打开浏览器" }
    });

    expect(messageResponse.statusCode).toBe(200);
    expect(runtime.requests).toEqual([]);
    expect(runtime.computerPrompts).toEqual(["帮我控制这台 Mac 打开浏览器"]);
    expect(messageResponse.json().messages).toHaveLength(2);
    const assistantMessage = messageResponse.json().messages[1].content as string;
    expect(assistantMessage).toContain("我已经按你的要求操作这台电脑。");
    expect(assistantMessage).toContain("fake computer output");
    expect(assistantMessage).not.toContain("[[HERMILLS_COMPUTER_CONTROL:");
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

  it("imports outreach leads, generates company-aware drafts, and stores sender passwords privately", async () => {
    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      return JSON.stringify({
        subject: "LED work light options",
        body: "Hello Taylor, I noticed Bright LLC handles industrial lighting, so proof and lead time may matter before adding work-light options.\nWe make CE-backed LED work lights and can share a compact MOQ/lead-time comparison.\nIf useful, I can send two options: A for fast sampling, B for repeat supply. Which fits better?"
      });
    };

    await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Eckes Export",
      website: "https://eckes-export.example",
      mainProducts: ["LED work light"],
      certifications: ["CE"],
      shippingTerms: ["FOB Ningbo"]
    } });

    const personaResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/personas",
      headers,
      payload: {
        name: "Industrial lighting importer",
        companyType: "Contractor-channel distributors",
        painPoints: ["Needs proof and lead-time clarity before adding new lighting SKUs"],
        triggerEvents: ["Seasonal stock planning"],
        evidenceNotes: ["Certifications", "MOQ", "Repeat supply reliability"]
      }
    });
    expect(personaResponse.statusCode, personaResponse.body).toBe(200);
    const uspResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/usps",
      headers,
      payload: {
        category: "Operational",
        headline: "CE-backed work lights with lead-time clarity",
        buyerAngle: "Helps distributors compare sample-ready work-light options without a long catalog review.",
        proof: "CE certification and FOB Ningbo shipping terms are in the company profile.",
        proofLevel: "profile-derived"
      }
    });
    expect(uspResponse.statusCode, uspResponse.body).toBe(200);
    const ctaResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/cta-assets",
      headers,
      payload: {
        name: "MOQ and lead-time comparison",
        type: "moq_leadtime_sheet",
        description: "A small side-by-side option sheet for fast sampling or repeat supply.",
        assetText: "Includes MOQ, lead time, CE status, FOB terms, and two recommended options."
      }
    });
    expect(ctaResponse.statusCode, ctaResponse.body).toBe(200);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      const html = href.includes("/products")
        ? "<html><body><h1>Industrial lighting products</h1><p>Bright LLC reviews LED work lights for contractor and warehouse channels.</p></body></html>"
        : "<html><head><title>Bright LLC - Industrial Lighting Distributor</title><meta name=\"description\" content=\"Bright LLC distributes industrial lighting and work lights.\"></head><body><a href=\"/products\">Products</a><p>We import work lights and compare supplier proof before repeat supply.</p></body></html>";
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    });

    const importResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/leads/import",
      headers,
      payload: {
        csvText: "公司,email,联系人,国家,网站,需求\nBright LLC,taylor@example.com,Taylor,US,https://bright.example,industrial lighting\n,missing@example.com,,,,"
      }
    });
    expect(importResponse.statusCode).toBe(200);
    expect(importResponse.json().imported).toHaveLength(1);
    expect(importResponse.json().skipped).toHaveLength(1);
    expect(importResponse.json().imported[0]).toMatchObject({
      status: "new",
      currentState: "input_ready",
      replyStatus: "not_checked",
      statusColor: "slate",
      currentRound: 0
    });

    const initialStatsResponse = await server.inject({ method: "GET", url: "/api/outreach/leads/stats", headers });
    expect(initialStatsResponse.statusCode).toBe(200);
    expect(initialStatsResponse.json()).toMatchObject({ total: 1, new: 1, drafted: 0, waiting: 0, replied: 0 });

    const leadId = importResponse.json().imported[0].id;
    const draftResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/drafts/generate",
      headers,
      payload: { leadId, language: "English", tone: "short and direct" }
    });
    expect(draftResponse.statusCode).toBe(200);
    expect(draftResponse.json()).toMatchObject({
      leadId,
      subject: "LED work light options",
      status: "draft",
      qualityReview: { passed: true },
      generationMode: "deep",
      strategyMatch: {
        personaId: personaResponse.json().id,
        uspId: uspResponse.json().id,
        ctaAssetId: ctaResponse.json().id
      },
      sendRiskReview: { passed: true, level: "warning" }
    });
    expect(draftResponse.json().evidenceMap.verifiedFacts.map((item: { label: string }) => item.label)).toContain("Lead company");
    expect(draftResponse.json().evidenceMap.verifiedFacts.some((item: { source: string }) => item.source === "website")).toBe(true);
    expect(draftResponse.json().sendRiskReview.issues.map((issue: { id: string }) => issue.id)).toContain("unsubscribe_missing");
    const runtimeContent = runtime.requests.at(-1)?.messages.at(-1)?.content ?? "";
    expect(runtimeContent).toContain("Bright LLC");
    expect(runtimeContent).toContain("Eckes Export");
    expect(runtimeContent).toContain("Return JSON only");
    expect(runtimeContent).toContain("--- Outreach OS evidence and asset map ---");
    expect(runtimeContent).toContain("--- Customer website research ---");
    expect(runtimeContent).toContain("Research depth: adaptive");
    expect(runtimeContent).toContain("Bright LLC distributes industrial lighting and work lights");
    expect(runtimeContent).toContain("Backed by asset: MOQ and lead-time comparison");

    const draftedStatsResponse = await server.inject({ method: "GET", url: "/api/outreach/leads/stats", headers });
    expect(draftedStatsResponse.statusCode).toBe(200);
    expect(draftedStatsResponse.json()).toMatchObject({ total: 1, new: 0, drafted: 1, waiting: 0 });

    const senderResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/sender-accounts",
      headers,
      payload: {
        label: "Sales mailbox",
        fromName: "Sales",
        email: "sales@example.com",
        host: "smtp.example.com",
        port: 587,
        secure: false,
        username: "sales@example.com",
        password: "super-secret-password"
      }
    });
    expect(senderResponse.statusCode).toBe(200);
    expect(senderResponse.json()).toMatchObject({ label: "Sales mailbox", passwordPreview: expect.any(String) });
    expect(senderResponse.json()).not.toHaveProperty("passwordRef");
    expect(JSON.stringify(senderResponse.json())).not.toContain("super-secret-password");

    const listResponse = await server.inject({ method: "GET", url: "/api/outreach/sender-accounts", headers });
    expect(JSON.stringify(listResponse.json())).not.toContain("super-secret-password");

    const confirmResponse = await server.inject({ method: "POST", url: `/api/outreach/sender-accounts/${senderResponse.json().id}/confirm-delivery`, headers });
    expect(confirmResponse.statusCode, confirmResponse.body).toBe(200);
    expect(confirmResponse.json().sender.deliveryConfirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const deleteManyResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/leads/delete-many",
      headers,
      payload: { ids: [leadId] }
    });
    expect(deleteManyResponse.statusCode).toBe(200);
    expect(deleteManyResponse.json()).toEqual({ deleted: 1, missing: [] });
    const deletedStatsResponse = await server.inject({ method: "GET", url: "/api/outreach/leads/stats", headers });
    expect(deletedStatsResponse.json()).toMatchObject({ total: 0 });
  });

  it("manages local Outreach OS persona, USP, and CTA assets", async () => {
    const personaResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/personas",
      headers,
      payload: {
        name: "Flooring importer",
        companyType: "SPC/LVT distributors",
        painPoints: ["Needs stable samples"],
        triggerEvents: ["New catalog planning"],
        evidenceNotes: ["Certifications"]
      }
    });
    expect(personaResponse.statusCode, personaResponse.body).toBe(200);
    expect(personaResponse.json()).toMatchObject({ name: "Flooring importer", enabled: true });

    const updatedPersonaResponse = await server.inject({
      method: "PUT",
      url: `/api/outreach/personas/${personaResponse.json().id}`,
      headers,
      payload: { painPoints: ["Needs stable samples", "Needs proof before trial order"] }
    });
    expect(updatedPersonaResponse.statusCode, updatedPersonaResponse.body).toBe(200);
    expect(updatedPersonaResponse.json().painPoints).toContain("Needs proof before trial order");

    const uspResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/usps",
      headers,
      payload: {
        category: "Trust-building",
        headline: "Proof-backed SPC flooring options",
        buyerAngle: "Lets buyers compare sample-ready SPC options before committing warehouse space.",
        proof: "Catalog and certification pack available.",
        proofLevel: "verified"
      }
    });
    expect(uspResponse.statusCode, uspResponse.body).toBe(200);

    const ctaResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/cta-assets",
      headers,
      payload: {
        name: "Certification pack",
        type: "certification_pack",
        description: "Current certificates and test reports.",
        assetText: "CE, SGS, and product test report links."
      }
    });
    expect(ctaResponse.statusCode, ctaResponse.body).toBe(200);

    const listResponse = await server.inject({ method: "GET", url: "/api/outreach/cta-assets", headers });
    expect(listResponse.statusCode, listResponse.body).toBe(200);
    expect(listResponse.json()).toEqual([expect.objectContaining({ name: "Certification pack", type: "certification_pack" })]);

    const deleteResponse = await server.inject({ method: "DELETE", url: `/api/outreach/cta-assets/${ctaResponse.json().id}`, headers });
    expect(deleteResponse.statusCode).toBe(204);
    const deletedListResponse = await server.inject({ method: "GET", url: "/api/outreach/cta-assets", headers });
    expect(deletedListResponse.json()).toEqual([]);
  });

  it("defaults normal Tencent and Alibaba sender accounts to authorization-code SMTP settings", async () => {
    const tencentResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/sender-accounts",
      headers,
      payload: {
        label: "Tencent enterprise mailbox",
        provider: "tencent",
        email: "sales@brand.example",
        username: "sales@brand.example",
        password: "smtp-auth-code"
      }
    });
    expect(tencentResponse.statusCode, tencentResponse.body).toBe(200);
    expect(tencentResponse.json()).toMatchObject({
      provider: "tencent",
      sendChannel: "smtp",
      host: "smtp.exmail.qq.com",
      port: 465,
      secure: true,
      imapHost: "imap.exmail.qq.com",
      imapPort: 993,
      imapSecure: true,
      passwordPreview: expect.any(String)
    });
    expect(tencentResponse.json()).not.toHaveProperty("passwordRef");
    expect(JSON.stringify(tencentResponse.json())).not.toContain("smtp-auth-code");

    const aliyunResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/sender-accounts",
      headers,
      payload: {
        label: "Alibaba mailbox",
        provider: "aliyun",
        email: "sales@brand.example",
        username: "sales@brand.example",
        password: "alimail-auth-code"
      }
    });
    expect(aliyunResponse.statusCode, aliyunResponse.body).toBe(200);
    expect(aliyunResponse.json()).toMatchObject({
      provider: "aliyun",
      sendChannel: "smtp",
      host: "smtp.mxhichina.com",
      port: 465,
      secure: true,
      imapHost: "imap.mxhichina.com",
      imapPort: 993,
      imapSecure: true
    });
    expect(JSON.stringify(aliyunResponse.json())).not.toContain("alimail-auth-code");
  });

  it("saves service API sender config without pretending missing or unsupported credentials can send", async () => {
    const missingCredentialResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/sender-accounts",
      headers,
      payload: {
        label: "Tencent Cloud Email",
        provider: "tencent",
        sendChannel: "service-api",
        email: "sales@brand.example"
      }
    });
    expect(missingCredentialResponse.statusCode, missingCredentialResponse.body).toBe(200);
    expect(missingCredentialResponse.json()).toMatchObject({
      provider: "tencent",
      sendChannel: "service-api"
    });
    expect(missingCredentialResponse.json().serviceApi).toBeUndefined();

    const missingCredentialTest = await server.inject({
      method: "POST",
      url: `/api/outreach/sender-accounts/${missingCredentialResponse.json().id}/test`,
      headers
    });
    expect(missingCredentialTest.statusCode, missingCredentialTest.body).toBe(200);
    expect(missingCredentialTest.json()).toMatchObject({ ok: false });
    expect(missingCredentialTest.json().message).toContain("credential");
    expect(missingCredentialTest.json().message).not.toContain("ready");

    const aliyunApiResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/sender-accounts",
      headers,
      payload: {
        label: "Alibaba DirectMail",
        provider: "aliyun",
        sendChannel: "service-api",
        email: "sales@brand.example",
        serviceApi: { credential: "aliyun-access-secret" }
      }
    });
    expect(aliyunApiResponse.statusCode, aliyunApiResponse.body).toBe(200);
    expect(aliyunApiResponse.json()).toMatchObject({
      provider: "aliyun",
      sendChannel: "service-api",
      serviceApi: {
        credentialPreview: expect.any(String)
      }
    });
    expect(aliyunApiResponse.json().serviceApi).not.toHaveProperty("credentialRef");
    expect(JSON.stringify(aliyunApiResponse.json())).not.toContain("aliyun-access-secret");

    const aliyunApiTest = await server.inject({
      method: "POST",
      url: `/api/outreach/sender-accounts/${aliyunApiResponse.json().id}/test`,
      headers
    });
    expect(aliyunApiTest.statusCode, aliyunApiTest.body).toBe(200);
    expect(aliyunApiTest.json()).toMatchObject({ ok: false });
    expect(aliyunApiTest.json().message).toContain("endpoint");

    const customApiResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/sender-accounts",
      headers,
      payload: {
        label: "Custom HTTP API",
        provider: "custom",
        sendChannel: "service-api",
        email: "sales@brand.example",
        serviceApi: { apiBaseUrl: "https://mail-gateway.example/send" }
      }
    });
    expect(customApiResponse.statusCode, customApiResponse.body).toBe(200);
    const customApiTest = await server.inject({
      method: "POST",
      url: `/api/outreach/sender-accounts/${customApiResponse.json().id}/test`,
      headers
    });
    expect(customApiTest.statusCode, customApiTest.body).toBe(200);
    expect(customApiTest.json()).toMatchObject({ ok: false });
    expect(customApiTest.json().message).toContain("credential");
  });

  it("refuses outreach generation until company profile has the required basics", async () => {
    const leadResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/leads",
      headers,
      payload: {
        companyName: "Missing Company Context Buyer",
        email: "buyer@missing-context.example",
        website: "https://missing-context.example"
      }
    });
    expect(leadResponse.statusCode).toBe(200);

    const draftResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/drafts/generate",
      headers,
      payload: { leadId: leadResponse.json().id, language: "English", tone: "short" }
    });
    expect(draftResponse.statusCode).toBe(400);
    expect(draftResponse.json().error.message).toContain("Company profile is required");
    expect(runtime.requests).toHaveLength(0);
  });

  it("refuses to send outreach until the sender mailbox delivery is confirmed", async () => {
    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      return JSON.stringify({
        subject: "Work light sourcing",
        body: "Hello, I saw your team sources work lights. Would it help if I sent a concise option list?"
      });
    };
    await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Eckes Export",
      website: "https://eckes-export.example",
      mainProducts: ["LED work light"]
    } });

    const leadResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/leads",
      headers,
      payload: {
        companyName: "Unconfirmed Buyer",
        email: "buyer@unconfirmed.example",
        website: "https://unconfirmed.example"
      }
    });
    expect(leadResponse.statusCode).toBe(200);

    const draftResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/drafts/generate",
      headers,
      payload: { leadId: leadResponse.json().id, language: "English", tone: "short" }
    });
    expect(draftResponse.statusCode).toBe(200);

    const senderResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/sender-accounts",
      headers,
      payload: {
        label: "Unconfirmed mailbox",
        email: "sales@example.com",
        host: "smtp.example.com",
        port: 587,
        secure: false,
        username: "sales@example.com",
        password: "super-secret-password"
      }
    });
    expect(senderResponse.statusCode).toBe(200);
    expect(senderResponse.json().deliveryConfirmedAt).toBeUndefined();

    const sendResponse = await server.inject({
      method: "POST",
      url: `/api/outreach/drafts/${draftResponse.json().id}/send`,
      headers,
      payload: { senderAccountId: senderResponse.json().id, confirm: true }
    });
    expect(sendResponse.statusCode).toBe(400);
    expect(sendResponse.json().error.message).toContain("Confirm the sender mailbox");
  });

  it("auto researches a customer website before generating an outreach draft", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      const html = href.includes("/about")
        ? "<html><body><h1>About Preview Buyer</h1><p>We are an industrial lighting distributor and importer.</p></body></html>"
        : "<html><head><title>Preview Buyer - Industrial Lighting Distributor</title><meta name=\"description\" content=\"Preview Buyer imports and distributes work lights.\"></head><body><a href=\"/about\">About</a><p>We wholesale industrial lighting products.</p></body></html>";
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    });
    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      const prompt = request.messages.map((message) => message.content).join("\n");
      if (prompt.includes("Rewrite this B2B cold email")) {
        return JSON.stringify({
          subject: "Work light options",
          body: "Hello, I saw Preview Buyer imports work lights for industrial lighting channels, so a short supplier comparison may save review time.\nWe can share CE-backed LED work light options with MOQ and lead time notes.\nIf useful, I can send A for fast sampling or B for repeat supply. Which fits better?"
        });
      }
      return JSON.stringify({
        subject: "Work light supply",
        body: "Hello, I saw Preview Buyer imports industrial lighting. We can support work light supply. Would you like details?"
      });
    };
    await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Eckes Export",
      website: "https://eckes-export.example",
      mainProducts: ["LED work light"]
    } });

    const draftResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/drafts/auto",
      headers,
      payload: {
        website: "preview-buyer.example",
        email: "buyer@preview-buyer.example",
        language: "English",
        tone: "short"
      }
    });

    expect(draftResponse.statusCode).toBe(200);
    expect(draftResponse.json()).toMatchObject({
      subject: "Work light options",
      status: "draft",
      generationMode: "deep",
      qualityReview: { passed: true }
    });
    expect(draftResponse.json().body).toContain("A for fast sampling");
    expect(runtime.requests.at(-1)?.messages.at(-1)?.content).toContain("Would you like details?");
    const runtimeContent = runtime.requests.at(-1)?.messages.at(-1)?.content ?? "";
    expect(runtimeContent).toContain("--- Customer website research ---");
    expect(runtimeContent).toContain("Research depth: adaptive");
    expect(runtimeContent).toContain("Preview Buyer imports and distributes work lights");
    expect(runtimeContent).toContain("industrial lighting distributor");
    const leadsResponse = await server.inject({ method: "GET", url: "/api/outreach/leads?q=Preview", headers });
    expect(leadsResponse.json()[0]).toMatchObject({
      email: "buyer@preview-buyer.example",
      website: "https://preview-buyer.example/",
      tags: ["auto-researched"]
    });
    const workflowsResponse = await server.inject({ method: "GET", url: "/api/outreach/workflows?q=Preview", headers });
    expect(workflowsResponse.json()[0]).toMatchObject({
      draftId: draftResponse.json().id,
      research: { depth: "adaptive" }
    });
  });

  it("uses the deep research sidecar for deep workflows and only sends website and email", async () => {
    await restartServerWithDeepResearch({ enabled: true, url: "http://sidecar.test", timeoutMs: 1000 });
    const sidecarBodies: unknown[] = [];
    const fetchUrls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      fetchUrls.push(String(url));
      expect(String(url)).toBe("http://sidecar.test/v1/research/company");
      sidecarBodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({
        website: "https://deep-buyer.example/",
        company_name: "Deep Buyer Ltd",
        confidence_score: 91,
        buyer_type: "Importer / distributor",
        industry: "Industrial lighting distribution",
        inferred_need: "Needs reliable work light supply with proof before sampling.",
        recommended_angle: "Lead with a small proof-backed option comparison.",
        title: "Deep Buyer - Contractor Lighting Importer",
        description: "Deep Buyer imports work lights for contractor channels.",
        product_signals: ["Bulk or wholesale buying"],
        buying_signals: ["Supplier comparison likely"],
        pain_signals: ["Needs proof before samples"],
        fetched_urls: ["https://deep-buyer.example/", "https://deep-buyer.example/about"],
        text_preview: "Deep Buyer imports work lights and compares suppliers before sampling.",
        evidence: [{
          label: "Buyer channel",
          value: "Contractor lighting importer",
          source_url: "https://deep-buyer.example/about",
          snippet: "imports work lights for contractor channels"
        }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    mockWorkflowReply();
    await seedOutreachCompanyProfile();

    const response = await generateDeepWorkflow("deep-buyer.example", "buyer@deep-buyer.example");

    expect(response.statusCode, response.body).toBe(200);
    expect(fetchUrls).toEqual(["http://sidecar.test/v1/research/company"]);
    expect(sidecarBodies).toEqual([{ website: "https://deep-buyer.example/", email: "buyer@deep-buyer.example", maxPages: 8, mode: "outreach" }]);
    expect(Object.keys(sidecarBodies[0] as Record<string, unknown>).sort()).toEqual(["email", "maxPages", "mode", "website"]);
    expect(response.json().research).toMatchObject({
      depth: "deep",
      companyName: "Deep Buyer Ltd",
      confidenceScore: 91,
      buyerType: "Importer / distributor",
      industry: "Industrial lighting distribution",
      evidence: [{ label: "Buyer channel", sourceUrl: "https://deep-buyer.example/about" }]
    });
    expect(response.json().research.error).toBeUndefined();
    expect(runtime.requests.at(-1)?.messages[0]?.content).toContain("Evidence: Buyer channel");
  });

  it("falls back to Node website research when the deep sidecar fails", async () => {
    await restartServerWithDeepResearch({ enabled: true, url: "http://sidecar.test", timeoutMs: 1000 });
    const fetchUrls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      fetchUrls.push(href);
      if (href === "http://sidecar.test/v1/research/company") {
        return new Response(JSON.stringify({ error: "boom" }), { status: 500, headers: { "content-type": "application/json" } });
      }
      return new Response(
        "<html><head><title>Fallback Buyer - Lighting Importer</title><meta name=\"description\" content=\"Fallback Buyer imports work lights for contractors.\"></head><body><p>We distribute work lights to contractors and compare suppliers.</p></body></html>",
        { status: 200, headers: { "content-type": "text/html" } }
      );
    });
    mockWorkflowReply();
    await seedOutreachCompanyProfile();

    const response = await generateDeepWorkflow("fallback-buyer.example", "buyer@fallback-buyer.example");

    expect(response.statusCode, response.body).toBe(200);
    expect(fetchUrls[0]).toBe("http://sidecar.test/v1/research/company");
    expect(fetchUrls).toContain("https://fallback-buyer.example/");
    expect(response.json().research).toMatchObject({
      depth: "deep",
      companyName: "Fallback Buyer",
      buyerType: "Importer / distributor"
    });
    expect(response.json().research.textPreview).toContain("compare suppliers");
    expect(response.json().research.error).toContain("HTTP 500");
    expect(response.json().research.error).toContain("Node website research fallback");
  });

  it("falls back to Node website research when the deep sidecar returns 401", async () => {
    await restartServerWithDeepResearch({ enabled: true, url: "http://sidecar.test", timeoutMs: 1000 });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      if (href === "http://sidecar.test/v1/research/company") {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
      }
      return new Response(
        "<html><head><title>Auth Fallback Buyer - Importer</title></head><body><p>Auth Fallback Buyer imports work lights for contractor channels.</p></body></html>",
        { status: 200, headers: { "content-type": "text/html" } }
      );
    });
    mockWorkflowReply();
    await seedOutreachCompanyProfile();

    const response = await generateDeepWorkflow("auth-fallback.example", "buyer@auth-fallback.example");

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().research.textPreview).toContain("contractor channels");
    expect(response.json().research.error).toContain("HTTP 401");
  });

  it("falls back to Node website research when the deep sidecar times out", async () => {
    await restartServerWithDeepResearch({ enabled: true, url: "http://sidecar.test", timeoutMs: 1 });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const href = String(url);
      if (href === "http://sidecar.test/v1/research/company") {
        return new Promise<Response>((_resolve, reject) => {
          (init?.signal as AbortSignal | undefined)?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      }
      return new Response(
        "<html><head><title>Timeout Fallback Buyer - Importer</title></head><body><p>Timeout Fallback Buyer imports work lights and reviews supplier lead time.</p></body></html>",
        { status: 200, headers: { "content-type": "text/html" } }
      );
    });
    mockWorkflowReply();
    await seedOutreachCompanyProfile();

    const response = await generateDeepWorkflow("timeout-fallback.example", "buyer@timeout-fallback.example");

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().research.textPreview).toContain("reviews supplier lead time");
    expect(response.json().research.error).toContain("timed out");
  });

  it("repairs a weak auto-generated outreach email before storing it", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(
      "<html><head><title>Repair Buyer - Lighting Importer</title><meta name=\"description\" content=\"Repair Buyer imports work lights for contractor channels.\"></head><body><p>We distribute work lights to contractors and review reliable suppliers.</p></body></html>",
      { status: 200, headers: { "content-type": "text/html" } }
    ));
    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      const prompt = request.messages.map((message) => message.content).join("\n");
      if (prompt.includes("Rewrite this B2B cold email")) {
        return JSON.stringify({
          subject: "Contractor work light options",
          body: "Hi, I saw Repair Buyer imports work lights for contractor channels, so supplier reliability likely affects contractor availability.\nOur LED work light options can help compare reliable supply without a full catalog.\nIf useful, I can send 2-3 matched options with MOQ and lead time. Which fits better?"
        });
      }
      return JSON.stringify({
        icps: [],
        usps: [],
        initialEmail: {
          subject: "High quality and competitive price",
          body: "Dear Sir/Madam, we are a leading manufacturer with high quality and competitive price. Please kindly send your requirements so we can establish long term cooperation."
        },
        followUps: []
      });
    };
    await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Eckes Export",
      website: "https://eckes-export.example",
      mainProducts: ["LED work light"],
      certifications: ["CE"]
    } });

    const workflowResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/workflows/auto",
      headers,
      payload: {
        website: "repair-buyer.example",
        email: "buyer@repair-buyer.example",
        language: "English",
        tone: "warm and concise"
      }
    });

    expect(workflowResponse.statusCode, workflowResponse.body).toBe(200);
    expect(runtime.requests).toHaveLength(2);
    expect(runtime.requests[0]?.messages[0]?.content).toContain("Private outreach brief");
    expect(runtime.requests[1]?.messages[0]?.content).toContain("QA failures");
    expect(runtime.requests[1]?.messages[0]?.content).toContain("A/B choices");
    expect(workflowResponse.json().initialEmail).toMatchObject({
      subject: "Contractor work light options",
      qualityReview: { passed: true }
    });
    expect(workflowResponse.json().initialEmail.body).not.toContain("Dear Sir/Madam");
    expect(workflowResponse.json().initialEmail.body).not.toContain("high quality and competitive price");
  });

  it("blocks robotic keyword CTAs and shallow SPC emails before storing them", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(
      [
        "<html><head><title>Europine - SPC Flooring Distributor</title>",
        "<meta name=\"description\" content=\"Europine runs quick-ship, TruckLoad, and Container Direct programs for Fortika SPC flooring.\"></head>",
        "<body><p>Fortika SPC 5mm and 7.5mm ranges support flooring distributors, retailers, and container-direct orders.</p></body></html>"
      ].join(""),
      { status: 200, headers: { "content-type": "text/html" } }
    ));
    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      const prompt = request.messages.map((message) => message.content).join("\n");
      if (prompt.includes("Rewrite this B2B cold email")) {
        return JSON.stringify({
          subject: "Fortika SPC backup options",
          body: "Hi, I noticed Europine runs TruckLoad and Container Direct programs alongside Fortika SPC ranges, so supplier backup has to protect both quick-ship inventory and container timing.\nAnyway Flooring can be a backup SPC source for 5mm or 7.5mm-style ranges while keeping OEM packaging discussion separate from a full catalog.\nWould a short A/B sheet be more useful: A for matched specs, or B for MOQ and lead-time checks?"
        });
      }
      return JSON.stringify({
        icps: [],
        usps: [],
        initialEmail: {
          subject: "SPC fit check for your quick-ship model",
          body: "Saw Europine's focus on quick-ship and reliable supply for SPC luxury vinyl. That's exactly where lead time consistency makes or breaks a distributor's margin.\n\nIf you're comparing SPC suppliers, I can send a simple table with MOQ and lead times for 2-3 options matching your Fortika 5mm or 7.5mm specs. No samples needed—just data to see if we align.\n\nReply 'SPC table' and I'll email it within 24 hours."
        },
        followUps: []
      });
    };
    await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Anyway Flooring",
      website: "https://anywayflooring.com",
      mainProducts: ["SPC", "LVT"]
    } });

    const workflowResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/workflows/auto",
      headers,
      payload: {
        website: "europine.example",
        email: "info@europine.example",
        language: "English",
        tone: "warm and concise"
      }
    });

    expect(workflowResponse.statusCode, workflowResponse.body).toBe(200);
    expect(runtime.requests).toHaveLength(2);
    expect(runtime.requests[1]?.messages[0]?.content).toContain("Reply 'SPC table'");
    expect(workflowResponse.json().initialEmail).toMatchObject({
      subject: "Fortika SPC backup options",
      qualityReview: { passed: true }
    });
    expect(workflowResponse.json().initialEmail.body).not.toContain("No samples needed");
    expect(workflowResponse.json().initialEmail.body).not.toContain("Reply 'SPC table'");
  });

  it("rejects domain-as-evidence wording and compare-fit fallback copy", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(
      [
        "<html><head><title>Luxury Vinyl Plank Flooring | Europine.Com</title>",
        "<meta name=\"description\" content=\"Europine runs quick-ship, TruckLoad, and Container Direct programs for Fortika SPC flooring.\"></head>",
        "<body><p>Fortika SPC 5mm and 7.5mm ranges support flooring distributors, retailers, and container-direct orders.</p></body></html>"
      ].join(""),
      { status: 200, headers: { "content-type": "text/html" } }
    ));
    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      const prompt = request.messages.map((message) => message.content).join("\n");
      if (prompt.includes("Rewrite this B2B cold email")) {
        return JSON.stringify({
          subject: "Fortika SPC backup options",
          body: "Hi, I noticed Europine runs TruckLoad and Container Direct programs for Fortika SPC ranges, so lead time and matched specs likely matter before adding another supplier.\nI can prepare a short backup option sheet with MOQ, lead time, and proof notes instead of a full catalog.\nWould A) matched specs or B) MOQ and lead-time checks be more useful first?"
        });
      }
      return JSON.stringify({
        icps: [],
        usps: [],
        initialEmail: {
          subject: "SPC fit check",
          body: "Hi, I noticed Luxury Vinyl Plank Flooring works around europine.Com, so proof and timing may matter before adding another option.\nSPC fit check gives your team a simpler way to compare fit. It keeps the first step low-risk by offering only the few details needed to judge supplier fit.\nI can send two options: A for fast sampling, B for repeat supply, with a small MOQ and lead-time comparison for 2-3 options. Which fits better?"
        },
        followUps: []
      });
    };
    await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Anyway Flooring",
      website: "https://anywayflooring.com",
      mainProducts: ["SPC", "LVT"]
    } });

    const workflowResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/workflows/auto",
      headers,
      payload: {
        website: "europine.example",
        email: "info@europine.example",
        language: "English",
        tone: "warm and concise"
      }
    });

    expect(workflowResponse.statusCode, workflowResponse.body).toBe(200);
    expect(runtime.requests).toHaveLength(2);
    expect(runtime.requests[1]?.messages[0]?.content).toContain("works around europine.Com");
    const email = workflowResponse.json().initialEmail;
    expect(email).toMatchObject({
      subject: "Fortika SPC backup options",
      qualityReview: { passed: true }
    });
    expect(email.body).toContain("TruckLoad");
    expect(email.body).toContain("Container Direct");
    expect(email.body).not.toContain("works around");
    expect(email.body).not.toContain("compare fit");
  });

  it("builds a full outreach workflow with ICPs, USPs, and nine follow-ups", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      const html = href.includes("/about")
        ? "<html><body><h1>About Atlas Buyer</h1><p>Atlas Buyer imports industrial lighting and sells to regional contractors.</p></body></html>"
        : "<html><head><title>Atlas Buyer - Lighting Importer</title><meta name=\"description\" content=\"Atlas Buyer sources rugged work lights for contractor channels.\"></head><body><a href=\"/about\">About</a><p>We distribute work lights to contractors.</p></body></html>";
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    });
    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      return JSON.stringify({
        icps: [
          {
            name: "Contractor-channel lighting importer",
            industrySegment: "Industrial lighting distributors serving contractor buyers.",
            companyCharacteristics: ["Imports repeat batches", "Needs fast comparison material"],
            buyerRoles: ["Procurement manager", "Category owner"],
            buyingBehavior: ["Reviews proof before sampling"],
            painPoints: ["Supplier delays hurt contractor availability"],
            triggerEvents: ["New seasonal stock planning"],
            salesAngles: ["Lead with rugged SKU comparison"]
          }
        ],
        usps: [
          {
            category: "Operational",
            headline: "Fast sample comparison",
            buyerAngle: "Helps Atlas Buyer compare rugged work light options before a larger order.",
            proof: "Share MOQ, lead time, and certifications in one small table."
          }
        ],
        initialEmail: {
          subject: "Rugged work light options",
          body: "Hi, I saw Atlas Buyer serves contractor channels, so rugged work-light availability likely affects jobsite stock planning.\nIf rugged work lights are still in your sourcing plan, I can send two sample-ready options with MOQ and lead time side by side.\nWould option A for fast sampling or option B for repeat supply be more useful?"
        },
        followUps: Array.from({ length: 9 }, (_, index) => ({
          step: index + 1,
          delayDays: [2, 4, 7, 7, 10, 10, 14, 21, 28][index],
          strategy: [
            "Friendly reminder",
            "Additional value",
            "Quick yes/no",
            "Social proof",
            "Limited incentive",
            "Feedback request",
            "Prior interaction",
            "Breakup email",
            "New angle"
          ][index],
          subject: `Atlas follow-up ${index + 1}`,
          body: `Hi, follow-up ${index + 1} with a useful contractor lighting angle.`
        }))
      });
    };
    await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Eckes Export",
      website: "https://eckes-export.example",
      mainProducts: ["LED work light"],
      certifications: ["CE"]
    } });

    const workflowResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/workflows/auto",
      headers,
      payload: {
        website: "atlas-buyer.example",
        email: "sourcing@atlas-buyer.example",
        language: "English",
        tone: "warm and concise"
      }
    });

    expect(workflowResponse.statusCode).toBe(200);
    const workflow = workflowResponse.json();
    expect(workflow).toMatchObject({
      email: "sourcing@atlas-buyer.example",
      website: "https://atlas-buyer.example/",
      language: "English",
      initialEmail: { subject: "Rugged work light options", status: "draft", qualityReview: { passed: true } }
    });
    expect(workflow.icps).toHaveLength(1);
    expect(workflow.usps).toHaveLength(1);
    expect(workflow.followUps).toHaveLength(9);
    expect(workflow.initialEmail.draftId).toBe(workflow.draftId);
    expect(workflow.followUps.every((email: { draftId?: string }) => Boolean(email.draftId))).toBe(true);
    expect(workflow.research.textPreview).toContain("contractor");

    const runtimeContent = runtime.requests.at(-1)?.messages.at(-1)?.content ?? "";
    expect(runtimeContent).toContain("Generate exactly 9 follow-up emails");
    expect(runtimeContent).toContain("Customer website research");
    expect(runtimeContent).toContain("Return JSON only");

    const listResponse = await server.inject({ method: "GET", url: "/api/outreach/workflows?q=Atlas", headers });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toHaveLength(1);
    expect(listResponse.json()[0].id).toBe(workflow.id);

    const fetchedResponse = await server.inject({ method: "GET", url: `/api/outreach/workflows/${workflow.id}`, headers });
    expect(fetchedResponse.statusCode).toBe(200);
    expect(fetchedResponse.json().followUps).toHaveLength(9);

    const draftsResponse = await server.inject({ method: "GET", url: "/api/outreach/drafts?q=Atlas", headers });
    expect(draftsResponse.statusCode).toBe(200);
    expect(draftsResponse.json()).toHaveLength(10);
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
  const computerPrompts: string[] = [];
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
    computerPrompts,
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
    async getComputerControlStatus() {
      return fakeComputerControlStatus();
    },
    async prepareComputerControl() {
      return { ok: true, message: "computer control prepared", status: fakeComputerControlStatus({ driverInstalled: true, computerUseEnabled: true }) };
    },
    async requestComputerControlPermission() {
      return { ok: true, message: "permission requested", status: fakeComputerControlStatus({ driverInstalled: true, computerUseEnabled: true }) };
    },
    async installComputerControlDriver() {
      return { ok: true, message: "driver installed", status: fakeComputerControlStatus({ driverInstalled: true }) };
    },
    async enableComputerControlTools() {
      return { ok: true, message: "tools enabled", status: fakeComputerControlStatus({ computerUseEnabled: true }) };
    },
    async startComputerControlDashboard() {
      return { ok: true, message: "dashboard started", status: fakeComputerControlStatus({ dashboardRunning: true }) };
    },
    async stopComputerControlDashboard() {
      return { ok: true, message: "dashboard stopped", status: fakeComputerControlStatus() };
    },
    async runComputerControlPrompt(prompt: string) {
      computerPrompts.push(prompt);
      return {
        ok: true,
        message: "computer operation finished",
        output: "fake computer output",
        status: fakeComputerControlStatus({ driverInstalled: true, computerUseEnabled: true })
      };
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
    computerPrompts: string[];
    installs: Parameters<RuntimeAdapter["startInstall"]>[0][];
    status: RuntimeStatus;
    updateCheck: FakeRuntimeUpdateCheck;
    emit(jobId: string, event: InstallEvent): void;
  };
}

function fakeComputerControlStatus(input: { driverInstalled?: boolean; computerUseEnabled?: boolean; dashboardRunning?: boolean } = {}) {
  return {
    platform: process.platform,
    supported: process.platform === "darwin",
    hermesCli: { found: true, path: "/usr/local/bin/hermes", version: "Hermes fake" },
    driver: { installed: input.driverInstalled ?? false, statusText: input.driverInstalled ? "cua-driver: installed" : "cua-driver: not installed" },
    toolsets: {
      computerUseEnabled: input.computerUseEnabled ?? false,
      enabled: input.computerUseEnabled ? ["browser", "computer_use", "file", "terminal"] : ["browser", "file", "terminal"],
      missingRequired: input.computerUseEnabled ? [] : ["computer_use"],
      output: ""
    },
    dashboard: input.dashboardRunning
      ? { state: "running" as const, pid: 1234, port: 9119, url: "http://127.0.0.1:9119", message: "running" }
      : { state: "stopped" as const, message: "stopped" },
    readiness: input.driverInstalled && input.computerUseEnabled ? "ready" as const : "preparing" as const,
    permissions: [
      { id: "screen-recording" as const, label: "Screen Recording", state: "unknown" as const, detail: "macOS may ask." },
      { id: "accessibility" as const, label: "Accessibility", state: "unknown" as const, detail: "macOS may ask." },
      { id: "automation" as const, label: "Automation", state: "unknown" as const, detail: "macOS may ask." },
      { id: "files" as const, label: "Files and folders", state: "required" as const, detail: "Choose folders carefully." }
    ]
  };
}
