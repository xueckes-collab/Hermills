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
          body: "Hi, I saw your contractor lighting channel. I can share two sample-ready work light options with MOQ and lead time. Would a short comparison help?"
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

    const createResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/campaigns",
      headers,
      payload: { name: "June outreach", leadIds: [leadA.id, leadB.id], language: "English", tone: "warm" }
    });
    expect(createResponse.statusCode, createResponse.body).toBe(200);
    expect(createResponse.json().stats).toMatchObject({ total: 2, pending: 2, sent: 0 });
    expect(runtime.requests).toHaveLength(0);
    expect(mailMock.sendMail).not.toHaveBeenCalled();

    const campaignId = createResponse.json().id;
    const generatedResponse = await server.inject({ method: "POST", url: `/api/outreach/campaigns/${campaignId}/generate`, headers });
    expect(generatedResponse.statusCode).toBe(200);
    expect(generatedResponse.json().stats).toMatchObject({ generated: 2, sent: 0 });
    expect(generatedResponse.json().recipients.every((recipient: { draft?: unknown; status: string }) => recipient.status === "generated" && recipient.draft)).toBe(true);
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
    const approveResponse = await server.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/recipients/${firstRecipient.id}/approve`,
      headers,
      payload: { confirm: true, subject: "Reviewed subject", body: "Reviewed body" }
    });
    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.json().stats).toMatchObject({ approved: 1, generated: 1 });

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
      subject: "Reviewed subject",
      text: "Reviewed body"
    });
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
    async createHermesReply(request: HermesReplyRequest) {
      requests.push(request);
      return "fake Hermes reply";
    },
    async dispose() {
      return undefined;
    }
  } satisfies RuntimeAdapter & { requests: HermesReplyRequest[] };
}
