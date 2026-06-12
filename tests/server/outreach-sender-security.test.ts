import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { LocalCredentialVault } from "@hermills/agent-builder";
import type { InstallEvent, RuntimeStatus } from "@hermills/core";
import type { HermesReplyRequest } from "@hermills/runtime";
import { createServer, type RuntimeAdapter } from "../../apps/server/src/index.js";

const mailMock = vi.hoisted(() => {
  const sendMail = vi.fn(async (_message: Record<string, unknown>) => ({ messageId: "message-1" }));
  const verify = vi.fn(async () => true);
  const transportOptions: unknown[] = [];
  return {
    sendMail,
    verify,
    transportOptions,
    createTransport: vi.fn((options: unknown) => {
      transportOptions.push(options);
      return { verify, sendMail };
    })
  };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: mailMock.createTransport },
  createTransport: mailMock.createTransport
}));

describe("outreach sender security and transport selection", () => {
  let server: FastifyInstance;
  let runtime: ReturnType<typeof createFakeRuntime>;
  let baseDir: string;
  let fetchMock: typeof fetch;
  let fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }>;
  const headers = { "x-hermills-token": "test-token" };

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-sender-security-"));
    runtime = createFakeRuntime();
    fetchCalls = [];
    fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input, init });
      return Response.json({ ok: true });
    }) as typeof fetch;
    server = await createServer({ baseDir, desktopToken: "test-token", runtimeService: runtime, fetchImpl: fetchMock });
    mailMock.sendMail.mockReset();
    mailMock.sendMail.mockResolvedValue({ messageId: "message-1" });
    mailMock.verify.mockReset();
    mailMock.verify.mockResolvedValue(true);
    mailMock.createTransport.mockClear();
    mailMock.transportOptions.length = 0;
  });

  afterEach(async () => {
    await server.close();
    vi.restoreAllMocks();
  });

  it("migrates legacy SMTP sender records to the SMTP transport without exposing the vault ref", async () => {
    const vault = new LocalCredentialVault(baseDir);
    const passwordRef = await vault.saveSecret("outreach-sender-legacy-smtp", "legacy-smtp-password");
    const now = new Date().toISOString();
    await writeSenderStore([{
      id: "legacy-smtp",
      label: "Legacy SMTP",
      fromName: "Legacy Sales",
      email: "sales@legacy.example",
      host: " smtp.legacy.example ",
      port: 587,
      secure: false,
      username: "sales@legacy.example",
      passwordRef,
      passwordPreview: "lega••••word",
      enabled: true,
      createdAt: now,
      updatedAt: now
    }]);

    const listResponse = await server.inject({ method: "GET", url: "/api/outreach/sender-accounts", headers });
    expect(listResponse.statusCode, listResponse.body).toBe(200);
    expect(listResponse.json()).toHaveLength(1);
    expect(listResponse.json()[0]).toMatchObject({
      id: "legacy-smtp",
      provider: "custom",
      sendChannel: "smtp",
      host: "smtp.legacy.example"
    });
    expect(JSON.stringify(listResponse.json())).not.toContain(passwordRef);
    expect(JSON.stringify(listResponse.json())).not.toContain("legacy-smtp-password");

    const testResponse = await server.inject({ method: "POST", url: "/api/outreach/sender-accounts/legacy-smtp/test", headers });
    expect(testResponse.statusCode, testResponse.body).toBe(200);
    expect(testResponse.json()).toMatchObject({ ok: true, message: "SMTP connection is ready." });
    expect(mailMock.createTransport).toHaveBeenCalledTimes(1);
    expect(mailMock.transportOptions[0]).toMatchObject({
      host: "smtp.legacy.example",
      port: 587,
      secure: false,
      requireTLS: true,
      name: "hermills.local",
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      tls: { servername: "smtp.legacy.example" },
      authMethod: "PLAIN",
      auth: { user: "sales@legacy.example", pass: "legacy-smtp-password" }
    });
  });

  it("uses API transport for OAuth senders and redacts OAuth state and tokens from responses", async () => {
    fetchCalls = [];
    fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input, init });
      return new Response(JSON.stringify({
      error: { message: "bad access_token=oauth-access-secret oauth_state=oauth-state-secret refresh_token=oauth-refresh-secret" }
    }), {
      status: 401,
      statusText: "Unauthorized",
      headers: { "content-type": "application/json", "request-id": "request-1" }
    });
    }) as typeof fetch;
    await server.close();
    server = await createServer({ baseDir, desktopToken: "test-token", runtimeService: runtime, fetchImpl: fetchMock });

    const createResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/sender-accounts",
      headers,
      payload: {
        label: "Gmail OAuth",
        provider: "gmail",
        sendChannel: "oauth-api",
        email: "sales@gmail.com",
        oauthApi: {
          credential: JSON.stringify({
            token: "oauth-access-secret",
            oauth_state: "oauth-state-secret",
            refresh_token: "oauth-refresh-secret"
          }),
          accountId: "me",
          scopes: ["gmail.send"]
        }
      }
    });
    expect(createResponse.statusCode, createResponse.body).toBe(200);
    expect(JSON.stringify(createResponse.json())).not.toContain("credentialRef");
    expect(JSON.stringify(createResponse.json())).not.toContain("oauth-access-secret");
    expect(JSON.stringify(createResponse.json())).not.toContain("oauth-state-secret");

    const senderId = createResponse.json().id;
    const sendResponse = await server.inject({
      method: "POST",
      url: `/api/outreach/sender-accounts/${senderId}/test-email`,
      headers,
      payload: { to: "qa.external@example.net" }
    });

    expect(sendResponse.statusCode, sendResponse.body).toBe(200);
    expect(sendResponse.json().ok).toBe(false);
    expect(sendResponse.json().message).toContain("gmail send failed with HTTP 401");
    expect(sendResponse.json().message).toContain("requestId=request-1");
    expect(JSON.stringify(sendResponse.json())).not.toContain("credentialRef");
    expect(JSON.stringify(sendResponse.json())).not.toContain("oauth-access-secret");
    expect(JSON.stringify(sendResponse.json())).not.toContain("oauth-state-secret");
    expect(JSON.stringify(sendResponse.json())).not.toContain("oauth-refresh-secret");
    expect(mailMock.createTransport).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(1);
  });

  it("does not report external recipient test failures as delivered", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/sender-accounts",
      headers,
      payload: {
        label: "SMTP sender",
        fromName: "Sales",
        email: "sales@example.com",
        host: "smtp.example.com",
        port: 587,
        secure: false,
        username: "sales@example.com",
        password: "smtp-password"
      }
    });
    expect(createResponse.statusCode, createResponse.body).toBe(200);
    const failure = Object.assign(new Error("RCPT rejected token=external-secret"), {
      code: "EENVELOPE",
      command: "RCPT TO",
      responseCode: 550,
      response: "550 mailbox unavailable password=mail-secret"
    });
    mailMock.sendMail.mockRejectedValueOnce(failure);

    const response = await server.inject({
      method: "POST",
      url: `/api/outreach/sender-accounts/${createResponse.json().id}/test-email`,
      headers,
      payload: { to: "qa.external@example.net" }
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().ok).toBe(false);
    expect(response.json().message).toContain("EENVELOPE");
    expect(response.json().message).toContain("RCPT TO");
    expect(response.json().message).toContain("smtp=550");
    expect(response.json().message).not.toContain("external-secret");
    expect(response.json().message).not.toContain("mail-secret");
    expect(response.json().sender.lastTestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(response.json().sender.lastTestEmailAt).toBeUndefined();
    expect(response.json().sender.deliveryConfirmedAt).toBeUndefined();
    expect(mailMock.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "qa.external@example.net",
      text: expect.stringContaining("external delivery test")
    }));
  });

  async function writeSenderStore(senders: unknown[]) {
    const dataDir = path.join(baseDir, "data");
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, "outreach-senders.json"), JSON.stringify({ senders }, null, 2));
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
      return { ok: true, message: "prepared", status: fakeComputerControlStatus() };
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
      return { ok: true, message: "done", output: "ok", status: fakeComputerControlStatus() };
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
    supported: false,
    hermesCli: { found: true, version: "Hermes fake" },
    driver: { installed: false, statusText: "not installed" },
    toolsets: { computerUseEnabled: false, enabled: [], missingRequired: ["computer_use"] },
    dashboard: { state: "stopped" as const, message: "stopped" },
    readiness: "unsupported" as const,
    permissions: []
  };
}
