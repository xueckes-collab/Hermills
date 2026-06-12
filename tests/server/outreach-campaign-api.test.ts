import { mkdtemp } from "node:fs/promises";
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
          body: "Hi, I saw Atlas Buyer serves contractor channels, so reliable work-light supply likely affects jobsite availability.\nWe can send two sample-ready work light options with MOQ and lead time side by side.\nIf useful, I can send an A/B comparison: fast sampling or repeat supply. Which fits better?"
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
          body: "Hi, I saw your contractor lighting channel, so reliable stock likely matters before adding work-light options.\nI can share two sample-ready work light options with MOQ and lead time.\nIf useful, I can send an A/B comparison: fast sampling or repeat supply. Which fits better?"
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
    expect(generatedResponse.json().recipients.every((recipient: { researchSummary?: { depth?: string; confidenceScore?: number } }) => recipient.researchSummary?.depth === "deep" && Number(recipient.researchSummary.confidenceScore) > 0)).toBe(true);
    expect(runtime.requests.every((request) => request.messages[0]?.content.includes("Research depth: deep"))).toBe(true);
    expect(runtime.requests.every((request) => request.messages[0]?.content.includes("Outreach OS evidence and asset map"))).toBe(true);
    expect(mailMock.sendMail).not.toHaveBeenCalled();

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
        body: "Hi, I saw Atlas Buyer serves contractor channels, so reliable work-light supply likely affects jobsite availability.\nWe can send two sample-ready work light options with MOQ and lead time side by side.\nIf useful, I can send an A/B comparison: fast sampling or repeat supply. Which fits better?"
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
        body: "Hi, I saw Atlas Buyer serves contractor channels, so reliable work-light supply likely affects jobsite availability.\nWe can send two sample-ready work light options with MOQ and lead time side by side.\nIf useful, I can send an A/B comparison: fast sampling or repeat supply. Which fits better?"
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
      text: "Hi, I saw Atlas Buyer serves contractor channels, so reliable work-light supply likely affects jobsite availability.\nWe can send two sample-ready work light options with MOQ and lead time side by side.\nIf useful, I can send an A/B comparison: fast sampling or repeat supply. Which fits better?\n\nBest regards\nSales team"
    });
    expect(String(sentMail.html)).toContain("<strong>Sales team</strong>");
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
  } satisfies RuntimeAdapter & { requests: HermesReplyRequest[] };
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
