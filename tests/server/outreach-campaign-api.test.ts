import { mkdtemp } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createServer, type RuntimeAdapter } from "../../apps/server/src/index.js";
import type { InstallEvent, RuntimeStatus } from "@hermills/core";
import type { HermesReplyRequest } from "@hermills/runtime";

const mailMock = vi.hoisted(() => {
  const sendMail = vi.fn(async (_message: Record<string, unknown>) => ({ messageId: "message-1" }));
  const verify = vi.fn(async () => true);
  return {
    sendMail,
    verify,
    createTransport: vi.fn(() => ({ verify, sendMail }))
  };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: mailMock.createTransport },
  createTransport: mailMock.createTransport
}));

describe("outreach campaign API", () => {
  let server: FastifyInstance;
  let runtime: ReturnType<typeof createFakeRuntime>;
  let baseDir: string;
  const headers = { "x-hermills-token": "test-token" };

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-campaign-"));
    runtime = createFakeRuntime();
    server = await createServer({ baseDir, desktopToken: "test-token", runtimeService: runtime });
    mailMock.sendMail.mockClear();
    mailMock.verify.mockClear();
    mailMock.createTransport.mockClear();
  });

  afterEach(async () => {
    await server.close();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("marks slow batch recipients as failed instead of leaving them researching forever", async () => {
    vi.stubEnv("HERMILLS_CAMPAIGN_RECIPIENT_TIMEOUT_MS", "25");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return new Response(`<html><body>Slow buyer page for ${String(url)}.</body></html>`, {
        status: 200,
        headers: { "content-type": "text/html" }
      });
    });
    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      return JSON.stringify({
        icps: [],
        usps: [],
        initialEmail: {
          subject: "Slow buyer options",
          body: "Hi Slow Buyer team,\n\nYour page suggests a relevant sourcing check.\nWe can share a concise comparison with MOQ and lead time.\nWould a short table help?\n\nBest regards\nEckes Export"
        },
        followUps: []
      });
    };

    const lead = await createLead("Slow Buyer", "https://slow.example", "buyer@slow.example");
    await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Eckes Export",
      website: "https://eckes-export.example",
      mainProducts: ["SPC flooring"],
      certifications: ["CE"]
    } });
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/campaigns",
      headers,
      payload: { name: "Slow campaign", leadIds: [lead.id], language: "English", tone: "warm", researchDepth: "quick" }
    });
    expect(createResponse.statusCode, createResponse.body).toBe(200);

    const generateResponse = await server.inject({ method: "POST", url: `/api/outreach/campaigns/${createResponse.json().id}/generate`, headers });

    expect(generateResponse.statusCode, generateResponse.body).toBe(200);
    expect(generateResponse.json().status).toBe("failed");
    expect(generateResponse.json().stats).toMatchObject({ failed: 1, generated: 0 });
    expect(generateResponse.json().recipients[0]).toMatchObject({ status: "failed" });
    expect(generateResponse.json().recipients[0].sendError).toContain("Timed out");
    expect(runtime.requests).toHaveLength(0);
  });

  it("creates a batch campaign, generates reviewed drafts, and sends only approved first emails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      const name = href.includes("bravo") ? "Bravo Buyer" : "Atlas Buyer";
      return new Response(`<html><head><title>${name}</title></head><body>${name} imports work lights for contractor channels.</body></html>`, {
        status: 200,
        headers: { "content-type": "text/html" }
      });
    });
    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      const prompt = request.messages.map((message) => message.content).join("\n");
      if (prompt.includes("Rewrite this B2B cold email")) {
        return JSON.stringify({
          subject: "Contractor work light options",
          body: "Hi Atlas Buyer team,\n\nYour contractor lighting channel means jobsite availability and fast sample checks can matter before adding another work-light option.\nWe can prepare two sample-ready LED work light options with MOQ and lead time side by side.\nWould a fast-sampling comparison or a repeat-supply comparison be more useful?\n\nBest regards\nEckes Export"
        });
      }
      return JSON.stringify({
        icps: [{
          name: "Contractor importer",
          industrySegment: "Lighting importers",
          companyCharacteristics: ["Imports repeat batches"],
          buyerRoles: ["Sourcing manager"],
          buyingBehavior: ["Checks proof before samples"],
          painPoints: ["Late supply hurts launches"],
          triggerEvents: ["Seasonal stock planning"],
          salesAngles: ["Lead with sample-ready options"]
        }],
        usps: [{
          category: "Operational",
          headline: "Fast sample comparison",
          buyerAngle: "Lets the buyer compare options quickly.",
          proof: "Share MOQ and lead time side by side."
        }],
        initialEmail: {
          subject: "Work light options",
          body: "Hi Atlas Buyer team,\n\nYour contractor lighting channel means jobsite availability and fast sample checks can matter before adding another work-light option.\nWe can prepare two sample-ready LED work light options with MOQ and lead time side by side.\nWould a fast-sampling comparison or a repeat-supply comparison be more useful?\n\nBest regards\nEckes Export"
        },
        followUps: Array.from({ length: 9 }, (_, index) => ({
          step: index + 1,
          delayDays: [2, 4, 7, 7, 10, 10, 14, 21, 28][index],
          strategy: `Follow-up ${index + 1}`,
          subject: `Follow-up ${index + 1}`,
          body: `Useful follow-up ${index + 1}.`
        }))
      });
    };

    const leadA = await createLead("Atlas Buyer", "https://atlas.example", "buyer@atlas.example");
    const leadB = await createLead("Bravo Buyer", "https://bravo.example", "buyer@bravo.example");
    await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Eckes Export",
      website: "https://eckes-export.example",
      mainProducts: ["LED work light"],
      certifications: ["CE"]
    } });

    const createResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/campaigns",
      headers,
      payload: { name: "June outreach", leadIds: [leadA.id, leadB.id], language: "English", tone: "warm", researchDepth: "deep" }
    });
    expect(createResponse.statusCode, createResponse.body).toBe(200);
    expect(createResponse.json().stats).toMatchObject({ total: 2, pending: 2, sent: 0 });
    expect(createResponse.json().researchDepth).toBe("deep");
    expect(createResponse.json().generationMode).toBe("deep");
    expect(runtime.requests).toHaveLength(0);
    expect(mailMock.sendMail).not.toHaveBeenCalled();

    const campaignId = createResponse.json().id;
    const generatedResponse = await server.inject({ method: "POST", url: `/api/outreach/campaigns/${campaignId}/generate`, headers });
    expect(generatedResponse.statusCode).toBe(200);
    expect(generatedResponse.json().stats).toMatchObject({ generated: 2, sent: 0 });
    expect(generatedResponse.json().recipients.every((recipient: { draft?: unknown; status: string }) => recipient.status === "generated" && recipient.draft)).toBe(true);
    expect(generatedResponse.json().recipients.every((recipient: { draft?: { qualityReview?: { passed?: boolean } } }) => recipient.draft?.qualityReview?.passed === true)).toBe(true);
    expect(generatedResponse.json().recipients.every((recipient: { draft?: { generationMode?: string; evidenceMap?: unknown; strategyMatch?: unknown; sendRiskReview?: { passed?: boolean } } }) =>
      recipient.draft?.generationMode === "deep" && recipient.draft.evidenceMap && recipient.draft.strategyMatch && recipient.draft.sendRiskReview?.passed === true
    )).toBe(true);
    expect(generatedResponse.json().recipients.every((recipient: { draft?: { researchBrief?: { fitVerdict?: string; shouldWrite?: string } } }) =>
      recipient.draft?.researchBrief?.fitVerdict === "good-fit" && recipient.draft.researchBrief.shouldWrite === "yes"
    )).toBe(true);
    expect(generatedResponse.json().recipients.every((recipient: { researchSummary?: { depth?: string; confidenceScore?: number } }) => recipient.researchSummary?.depth === "deep" && Number(recipient.researchSummary.confidenceScore) > 0)).toBe(true);
    expect(runtime.requests.every((request) => request.messages[0]?.content.includes("Research depth: deep"))).toBe(true);
    expect(runtime.requests.every((request) => request.messages[0]?.content.includes("Outreach OS evidence and asset map"))).toBe(true);
    expect(mailMock.sendMail).not.toHaveBeenCalled();

    const exportResponse = await server.inject({
      method: "GET",
      url: `/api/outreach/campaigns/${campaignId}/export.csv`,
      headers
    });
    expect(exportResponse.statusCode, exportResponse.body).toBe(200);
    expect(exportResponse.headers["content-type"]).toContain("text/csv");
    expect(exportResponse.headers["content-disposition"]).toContain("outreach-campaign-june-outreach");
    expect(exportResponse.body).toContain("companyName,email,website,status,qualityScore,subject,body,evidenceUrls,error");
    expect(exportResponse.body).toContain("Atlas Buyer");
    expect(exportResponse.body).toContain("Work light options");
    expect(exportResponse.body).toContain("https://atlas.example");

    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      const prompt = request.messages.map((message) => message.content).join("\n");
      if (prompt.includes("Rewrite this B2B cold email")) {
        return JSON.stringify({
          subject: "Retry work light options",
          body: "Hi Retry Buyer team,\n\nYour contractor lighting channel suggests sample timing and replenishment proof may matter before trialing another work-light option.\nWe can prepare two CE-backed work light options with MOQ and lead time side by side.\nWould a sample-ready comparison be useful first?\n\nBest regards\nEckes Export"
        });
      }
      if (prompt.includes("Fail Once Buyer") && !runtime.failOnceTriggered) {
        runtime.failOnceTriggered = true;
        throw new Error("temporary research generation failure");
      }
      return JSON.stringify({
        icps: [],
        usps: [],
        initialEmail: {
          subject: "Retry work light options",
          body: "Hi Retry Buyer team,\n\nYour contractor lighting channel suggests sample timing and replenishment proof may matter before trialing another work-light option.\nWe can prepare two CE-backed work light options with MOQ and lead time side by side.\nWould a sample-ready comparison be useful first?\n\nBest regards\nEckes Export"
        },
        followUps: []
      });
    };
    const failOnceLead = await createLead("Fail Once Buyer", "https://fail-once.example", "buyer@fail-once.example");
    const failCampaignResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/campaigns",
      headers,
      payload: { name: "Retry campaign", leadIds: [failOnceLead.id], language: "English", tone: "warm", researchDepth: "deep" }
    });
    expect(failCampaignResponse.statusCode, failCampaignResponse.body).toBe(200);
    const failCampaignId = failCampaignResponse.json().id;
    const failedGeneration = await server.inject({ method: "POST", url: `/api/outreach/campaigns/${failCampaignId}/generate`, headers });
    expect(failedGeneration.statusCode, failedGeneration.body).toBe(200);
    const failedRecipient = failedGeneration.json().recipients[0];
    expect(failedRecipient.status).toBe("failed");
    expect(failedRecipient.sendError).toContain("temporary research generation failure");
    const retryResponse = await server.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${failCampaignId}/recipients/${failedRecipient.id}/retry`,
      headers
    });
    expect(retryResponse.statusCode, retryResponse.body).toBe(200);
    expect(retryResponse.json().recipients[0]).toMatchObject({ status: "generated" });
    expect(retryResponse.json().recipients[0].sendError).toBeUndefined();
    expect(retryResponse.json().recipients[0].draft.subject).toBe("Retry work light options");

    runtime.createHermesReply = async (request: HermesReplyRequest) => {
      runtime.requests.push(request);
      const prompt = request.messages.map((message) => message.content).join("\n");
      if (prompt.includes("Rewrite this B2B cold email")) {
        return JSON.stringify({
          subject: "Contractor work light options",
          body: "Hi Atlas Buyer team,\n\nYour contractor lighting channel means jobsite availability and fast sample checks can matter before adding another work-light option.\nWe can prepare two sample-ready LED work light options with MOQ and lead time side by side.\nWould a fast-sampling comparison or a repeat-supply comparison be more useful?\n\nBest regards\nEckes Export"
        });
      }
      return JSON.stringify({
        icps: [],
        usps: [],
        initialEmail: {
          subject: "Contractor work light options",
          body: "Hi Atlas Buyer team,\n\nYour contractor lighting channel means jobsite availability and fast sample checks can matter before adding another work-light option.\nWe can prepare two sample-ready LED work light options with MOQ and lead time side by side.\nWould a fast-sampling comparison or a repeat-supply comparison be more useful?\n\nBest regards\nEckes Export"
        },
        followUps: []
      });
    };

    const senderResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/sender-accounts",
      headers,
      payload: {
        label: "Sales",
        fromName: "Sales team",
        email: "sales@example.com",
        host: "smtp.example.com",
        port: 587,
        secure: false,
        username: "sales@example.com",
        password: "smtp-password"
      }
    });
    expect(senderResponse.statusCode).toBe(200);

    const blockedSend = await server.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/start`,
      headers,
      payload: { senderAccountId: senderResponse.json().id, confirm: true }
    });
    expect(blockedSend.statusCode).toBe(400);
    expect(blockedSend.json().error.message).toContain("Confirm the sender mailbox");

    await server.inject({ method: "POST", url: `/api/outreach/sender-accounts/${senderResponse.json().id}/confirm-delivery`, headers });
    const firstRecipient = generatedResponse.json().recipients[0];
    const secondRecipient = generatedResponse.json().recipients[1];
    const blockedApproval = await server.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/recipients/${secondRecipient.id}/approve`,
      headers,
      payload: {
        confirm: true,
        subject: "High quality and competitive price",
        body: "Dear Sir/Madam, we are a leading manufacturer with high quality and competitive price. Please kindly send your requirements so we can establish long term cooperation."
      }
    });
    expect(blockedApproval.statusCode).toBe(400);
    expect(blockedApproval.json().error.message).toContain("Email needs rewrite");

    const blockedRiskApproval = await server.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/recipients/${firstRecipient.id}/approve`,
      headers,
      payload: {
        confirm: true,
        subject: "Re: purchase order attached",
        body: "Hi Atlas Buyer team,\n\nI saw Atlas Buyer serves contractor channels, so reliable work-light supply likely affects jobsite availability.\nWe can send two sample-ready work light options with MOQ and lead time side by side.\nIf useful, I can send an A/B comparison: fast sampling or repeat supply. Which fits better?\n\nBest regards\nSales team"
      }
    });
    expect(blockedRiskApproval.statusCode).toBe(400);
    expect(blockedRiskApproval.json().error.message).toContain("Email send risk blocked");
    expect(blockedRiskApproval.json().error.message).toContain("fake reply");

    const reviewResponse = await server.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/recipients/${firstRecipient.id}/review`,
      headers
    });
    expect(reviewResponse.statusCode, reviewResponse.body).toBe(200);
    expect(reviewResponse.json()).toMatchObject({ passed: true });

    const rewriteResponse = await server.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/recipients/${firstRecipient.id}/rewrite`,
      headers
    });
    expect(rewriteResponse.statusCode, rewriteResponse.body).toBe(200);
    expect(rewriteResponse.json().recipients.find((recipient: { id: string }) => recipient.id === firstRecipient.id).draft).toMatchObject({
      subject: "Contractor work light options",
      qualityReview: { passed: true }
    });

    const approveResponse = await server.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/recipients/${firstRecipient.id}/approve`,
      headers,
      payload: {
        confirm: true,
        subject: "Contractor work light options",
        body: "Hi Atlas Buyer team,\n\nI saw Atlas Buyer serves contractor channels, so reliable work-light supply likely affects jobsite availability.\nWe can send two sample-ready work light options with MOQ and lead time side by side.\nIf useful, I can send an A/B comparison: fast sampling or repeat supply. Which fits better?\n\nBest regards\nSales team"
      }
    });
    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.json().stats).toMatchObject({ approved: 1, generated: 1 });
    expect(approveResponse.json().recipients.find((recipient: { id: string }) => recipient.id === firstRecipient.id).draft.qualityReview.passed).toBe(true);

    const signatureResponse = await server.inject({
      method: "PUT",
      url: "/api/outreach/email-signature",
      headers,
      payload: {
        enabled: true,
        text: "Best regards\nSales team",
        html: "<strong>Sales team</strong><br />Eckes Export",
        logoEnabled: true,
        logoAlt: "Eckes Export logo",
        logoWidth: 96
      }
    });
    expect(signatureResponse.statusCode, signatureResponse.body).toBe(200);
    expect(signatureResponse.json()).toMatchObject({ enabled: true, logoWidth: 96 });
    const logoResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/email-signature/logo",
      headers: { ...headers, "content-type": "multipart/form-data; boundary=hermills-logo-test" },
      payload: multipartPayload("hermills-logo-test", "logo.png", "image/png", "png-bytes")
    });
    expect(logoResponse.statusCode, logoResponse.body).toBe(200);
    expect(logoResponse.json().logo).toMatchObject({ fileName: "logo.png", mimeType: "image/png" });

    const sendResponse = await server.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/start`,
      headers,
      payload: { senderAccountId: senderResponse.json().id, confirm: true }
    });
    expect(sendResponse.statusCode, sendResponse.body).toBe(200);
    expect(sendResponse.json().stats, sendResponse.body).toMatchObject({ sent: 1, generated: 1 });
    expect(mailMock.sendMail).toHaveBeenCalledTimes(1);
    const sentMail = mailMock.sendMail.mock.calls[0]?.[0];
    expect(sentMail).toMatchObject({
      to: firstRecipient.email,
      subject: "Contractor work light options",
      text: "Hi Atlas Buyer team,\n\nI saw Atlas Buyer serves contractor channels, so reliable work-light supply likely affects jobsite availability.\nWe can send two sample-ready work light options with MOQ and lead time side by side.\nIf useful, I can send an A/B comparison: fast sampling or repeat supply. Which fits better?\n\nBest regards\nSales team"
    });
    expect(String(sentMail.html)).toContain("Best regards<br />Sales team");
    expect(String(sentMail.html)).toContain("cid:hermills-signature-logo");
    expect(sentMail.attachments).toEqual([
      expect.objectContaining({
        cid: "hermills-signature-logo",
        filename: "logo.png",
        contentType: "image/png",
        contentDisposition: "inline"
      })
    ]);

    const followUpsResponse = await server.inject({
      method: "GET",
      url: `/api/outreach/followups?campaignId=${campaignId}`,
      headers
    });
    expect(followUpsResponse.statusCode, followUpsResponse.body).toBe(200);
    expect(followUpsResponse.json()).toHaveLength(9);
    expect(followUpsResponse.json()[0]).toMatchObject({
      campaignId,
      recipientId: firstRecipient.id,
      senderAccountId: senderResponse.json().id,
      mode: "confirm",
      status: "scheduled",
      step: 1
    });

    const tickResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/followups/tick",
      headers,
      payload: { now: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(), limit: 3 }
    });
    expect(tickResponse.statusCode, tickResponse.body).toBe(200);
    expect(tickResponse.json()).toMatchObject({ processed: 3, ready: 3, sent: 0, failed: 0 });

    const readyFollowUpsResponse = await server.inject({
      method: "GET",
      url: `/api/outreach/followups?campaignId=${campaignId}`,
      headers
    });
    expect(readyFollowUpsResponse.json().filter((job: { status: string }) => job.status === "ready")).toHaveLength(3);

    const fakeImap = await createFakeImapServer({
      replyFrom: firstRecipient.email,
      subject: "Re: Contractor work light options"
    });
    try {
      const updateInboxSender = await server.inject({
        method: "PUT",
        url: `/api/outreach/sender-accounts/${senderResponse.json().id}`,
        headers,
        payload: {
          imapHost: "127.0.0.1",
          imapPort: fakeImap.port,
          imapSecure: false,
          imapUsername: "sales@example.com"
        }
      });
      expect(updateInboxSender.statusCode, updateInboxSender.body).toBe(200);

      const inboxResponse = await server.inject({
        method: "POST",
        url: "/api/outreach/inbox/check",
        headers,
        payload: { senderAccountId: senderResponse.json().id, campaignId }
      });
      expect(inboxResponse.statusCode, inboxResponse.body).toBe(200);
      expect(inboxResponse.json()).toMatchObject({ ok: true, status: "ready", stopped: 9 });
      expect(inboxResponse.json().matched[0]).toMatchObject({
        recipientId: firstRecipient.id,
        type: "replied",
        from: `Buyer <${firstRecipient.email}>`
      });
      expect(fakeImap.commands.some((command) => /UID SEARCH FROM "buyer@atlas\.example" SINCE /i.test(command))).toBe(true);
      expect(fakeImap.commands.some((command) => /^UID SEARCH SINCE /i.test(command))).toBe(false);
    } finally {
      await fakeImap.close();
    }

    const stopResponse = await server.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/stop`,
      headers
    });
    expect(stopResponse.statusCode, stopResponse.body).toBe(200);
    const stoppedFollowUpsResponse = await server.inject({
      method: "GET",
      url: `/api/outreach/followups?campaignId=${campaignId}`,
      headers
    });
    expect(stoppedFollowUpsResponse.json().filter((job: { status: string }) => job.status === "stopped")).toHaveLength(9);
  });

  async function createLead(companyName: string, website: string, email: string) {
    const response = await server.inject({
      method: "POST",
      url: "/api/outreach/leads",
      headers,
      payload: { companyName, website, email }
    });
    expect(response.statusCode).toBe(200);
    return response.json();
  }
});

function createFakeRuntime() {
  const requests: HermesReplyRequest[] = [];
  const status: RuntimeStatus = {
    platform: process.platform,
    arch: process.arch,
    installed: true,
    state: "ready",
    runtimeHome: os.tmpdir(),
    checks: []
  };
  return {
    requests,
    failOnceTriggered: false as boolean,
    async getLatest() {
      return {};
    },
    async getUpdateCheck() {
      return { updateAvailable: false, checkState: "current" };
    },
    async getStatus() {
      return status;
    },
    async startInstall() {
      return { jobId: "job-test" };
    },
    getEvents(_jobId: string) {
      return [];
    },
    onEvent(_jobId: string, _listener: (event: InstallEvent) => void) {
      return () => undefined;
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
    async createHermesReply(request: HermesReplyRequest) {
      requests.push(request);
      return "fake Hermes reply";
    },
    async dispose() {
      return undefined;
    }
  } satisfies RuntimeAdapter & { requests: HermesReplyRequest[]; failOnceTriggered: boolean };
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

async function createFakeImapServer(input: { replyFrom: string; subject: string }): Promise<{
  port: number;
  commands: string[];
  close: () => Promise<void>;
}> {
  const commands: string[] = [];
  const server = net.createServer((socket) => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.write("* OK fake imap ready\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/^(\S+)\s+(.+)$/);
        if (!match) continue;
        const [, tag, command] = match;
        commands.push(command);
        if (/^LOGIN /i.test(command)) {
          socket.write(`${tag} OK LOGIN completed\r\n`);
        } else if (/^SELECT INBOX$/i.test(command)) {
          socket.write(`* 1 EXISTS\r\n${tag} OK SELECT completed\r\n`);
        } else if (/^UID SEARCH FROM /i.test(command)) {
          socket.write(`* SEARCH 42\r\n${tag} OK SEARCH completed\r\n`);
        } else if (/^UID FETCH /i.test(command)) {
          const headers = [
            `From: Buyer <${input.replyFrom}>`,
            `Subject: ${input.subject}`,
            "Date: Wed, 17 Jun 2026 10:00:00 +0000",
            "",
            ""
          ].join("\r\n");
          socket.write(`* 1 FETCH (UID 42 BODY[HEADER.FIELDS (FROM SUBJECT DATE)] {${Buffer.byteLength(headers)}}\r\n${headers})\r\n${tag} OK FETCH completed\r\n`);
        } else if (/^LOGOUT$/i.test(command)) {
          socket.write(`* BYE fake imap closing\r\n${tag} OK LOGOUT completed\r\n`);
          socket.end();
        } else {
          socket.write(`${tag} BAD unsupported command\r\n`);
        }
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fake IMAP server did not expose a TCP port.");
  return {
    port: address.port,
    commands,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}
