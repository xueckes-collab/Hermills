import { Buffer } from "node:buffer";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { OutreachSenderAccount, InstallEvent, RuntimeStatus } from "@hermills/core";
import type { HermesReplyRequest } from "@hermills/runtime";
import { createServer, type RuntimeAdapter } from "../../apps/server/src/index.js";
import { MailTransportError, sendApiMail, verifyApiMailTransport } from "../../apps/server/src/mail-transports.js";

describe("mail API transports", () => {
  it("sends Gmail messages as base64url MIME through users.messages.send", async () => {
    const calls = createFetchRecorder(new Response(JSON.stringify({ id: "gmail-message-1" }), {
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "gmail-request-1" }
    }));

    const result = await sendApiMail({
      sender: senderAccount({ provider: "gmail", sendChannel: "oauth-api", accountId: "me" }),
      credential: { token: "ya29.test-token" },
      fetchImpl: calls.fetchImpl,
      message: {
        from: "\"Sales\" <sales@example.com>",
        to: "buyer@example.com",
        subject: "API hello",
        text: "Hello from Gmail API."
      }
    });

    expect(result).toMatchObject({ provider: "gmail", messageId: "gmail-message-1", accepted: ["buyer@example.com"] });
    expect(calls.items[0].url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(calls.items[0].headers.authorization).toBe("Bearer ya29.test-token");
    const raw = JSON.parse(String(calls.items[0].body)).raw;
    const mime = Buffer.from(raw, "base64url").toString("utf8");
    expect(mime).toContain("From: Sales <sales@example.com>");
    expect(mime).toContain("To: buyer@example.com");
    expect(mime).toContain("Subject: API hello");
    expect(mime).toContain("Hello from Gmail API.");
  });

  it("sends Outlook mail through Microsoft Graph sendMail", async () => {
    const calls = createFetchRecorder(new Response(null, {
      status: 202,
      headers: { "request-id": "graph-request-1" }
    }));

    const result = await sendApiMail({
      sender: senderAccount({ provider: "microsoft-graph", sendChannel: "oauth-api" }),
      credential: { token: "graph-token" },
      fetchImpl: calls.fetchImpl,
      message: {
        from: "sales@example.com",
        to: "buyer@example.com",
        cc: "manager@example.com",
        subject: "Graph hello",
        html: "<p>Hello from Graph.</p>"
      }
    });

    expect(result).toMatchObject({ provider: "microsoft-graph", statusCode: 202, requestId: "graph-request-1" });
    expect(calls.items[0].url).toBe("https://graph.microsoft.com/v1.0/me/sendMail");
    expect(calls.items[0].headers.authorization).toBe("Bearer graph-token");
    expect(JSON.parse(String(calls.items[0].body))).toMatchObject({
      message: {
        subject: "Graph hello",
        body: { contentType: "HTML", content: "<p>Hello from Graph.</p>" },
        toRecipients: [{ emailAddress: { address: "buyer@example.com" } }],
        ccRecipients: [{ emailAddress: { address: "manager@example.com" } }]
      },
      saveToSentItems: true
    });
  });

  it("sends Zoho Mail messages with accountId and Zoho OAuth header", async () => {
    const calls = createFetchRecorder(new Response(JSON.stringify({ data: { messageId: "zoho-message-1" } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));

    const result = await sendApiMail({
      sender: senderAccount({
        provider: "zoho",
        sendChannel: "oauth-api",
        accountId: "123456789",
        apiBaseUrl: "https://mail.zoho.com"
      }),
      credential: { token: "zoho-token" },
      fetchImpl: calls.fetchImpl,
      message: {
        from: "sales@example.com",
        to: "buyer@example.com",
        bcc: "ops@example.com",
        subject: "Zoho hello",
        text: "Hello from Zoho."
      }
    });

    expect(result).toMatchObject({ provider: "zoho", messageId: "zoho-message-1" });
    expect(calls.items[0].url).toBe("https://mail.zoho.com/api/accounts/123456789/messages");
    expect(calls.items[0].headers.authorization).toBe("Zoho-oauthtoken zoho-token");
    expect(JSON.parse(String(calls.items[0].body))).toMatchObject({
      fromAddress: "sales@example.com",
      toAddress: "buyer@example.com",
      bccAddress: "ops@example.com",
      subject: "Zoho hello",
      content: "Hello from Zoho.",
      mailFormat: "plaintext"
    });
  });

  it("sends custom HTTP service API mail only with endpoint and credentials", async () => {
    const calls = createFetchRecorder(new Response(JSON.stringify({ messageId: "custom-message-1" }), {
      status: 202,
      headers: { "content-type": "application/json", "x-request-id": "custom-request-1" }
    }));
    const sender = senderAccount({
      provider: "custom",
      sendChannel: "service-api",
      apiBaseUrl: "https://mail-gateway.example/send"
    });

    await expect(sendApiMail({
      sender,
      fetchImpl: calls.fetchImpl,
      message: { from: "sales@example.com", to: "buyer@example.com", subject: "Custom hello", text: "Hello from custom API." }
    })).rejects.toMatchObject({
      detail: { code: "missing_service_api_credential", provider: "custom-http" }
    } satisfies Partial<MailTransportError>);

    const result = await sendApiMail({
      sender,
      credential: { apiKey: "custom-api-key" },
      fetchImpl: calls.fetchImpl,
      message: { from: "sales@example.com", to: "buyer@example.com", subject: "Custom hello", text: "Hello from custom API." }
    });

    expect(result).toMatchObject({ provider: "custom-http", statusCode: 202, messageId: "custom-message-1" });
    expect(calls.items).toHaveLength(1);
    expect(calls.items[0].url).toBe("https://mail-gateway.example/send");
    expect(calls.items[0].headers.authorization).toBe("Bearer custom-api-key");
    expect(JSON.parse(String(calls.items[0].body))).toMatchObject({
      provider: "custom",
      from: "sales@example.com",
      to: ["buyer@example.com"],
      subject: "Custom hello",
      text: "Hello from custom API."
    });
  });

  it("returns structured API error details without real credentials", async () => {
    const calls = createFetchRecorder(new Response(JSON.stringify({
      error: { code: "InvalidAuthenticationToken", message: "Access token is invalid." }
    }), {
      status: 401,
      statusText: "Unauthorized",
      headers: { "request-id": "graph-request-error" }
    }));

    await expect(sendApiMail({
      sender: senderAccount({ provider: "microsoft-graph", sendChannel: "oauth-api" }),
      credential: { token: "bad-token" },
      fetchImpl: calls.fetchImpl,
      message: { from: "sales@example.com", to: "buyer@example.com", subject: "Hi", text: "Body" }
    })).rejects.toMatchObject({
      detail: {
        provider: "microsoft-graph",
        statusCode: 401,
        code: "InvalidAuthenticationToken",
        requestId: "graph-request-error",
        responseMessage: "Access token is invalid."
      }
    } satisfies Partial<MailTransportError>);
  });

  it("verifies mock and missing-token API transports without network", async () => {
    await expect(verifyApiMailTransport({
      sender: senderAccount({ provider: "mock", sendChannel: "service-api" })
    })).resolves.toMatchObject({ provider: "mock", messageId: "mock-verify" });

    await expect(verifyApiMailTransport({
      sender: senderAccount({ provider: "gmail", sendChannel: "oauth-api" })
    })).rejects.toMatchObject({
      detail: { code: "missing_api_token", provider: "gmail" }
    } satisfies Partial<MailTransportError>);
  });
});

describe("mail API sender endpoints", () => {
  let server: FastifyInstance | undefined;
  const headers = { "x-hermills-token": "test-token" };

  afterEach(async () => {
    await server?.close();
    server = undefined;
    vi.restoreAllMocks();
  });

  it("stores an OAuth API sender privately and sends a Gmail test email through fetch", async () => {
    const calls = createFetchRecorder(new Response(JSON.stringify({ id: "gmail-test-id" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-mail-api-"));
    server = await createServer({
      baseDir,
      desktopToken: "test-token",
      runtimeService: createFakeRuntime(),
      fetchImpl: calls.fetchImpl
    });

    const createResponse = await server.inject({
      method: "POST",
      url: "/api/outreach/sender-accounts",
      headers,
      payload: {
        label: "Gmail API",
        provider: "gmail",
        sendChannel: "oauth-api",
        fromName: "Sales",
        email: "sales@example.com",
        oauthApi: {
          credential: "ya29.endpoint-test-token",
          accountId: "me",
          scopes: ["https://www.googleapis.com/auth/gmail.send"]
        }
      }
    });
    expect(createResponse.statusCode, createResponse.body).toBe(200);
    expect(JSON.stringify(createResponse.json())).not.toContain("ya29.endpoint-test-token");
    expect(JSON.stringify(createResponse.json())).not.toContain("credentialRef");
    expect(createResponse.json()).toMatchObject({
      provider: "gmail",
      sendChannel: "oauth-api",
      oauthApi: { accountId: "me", credentialPreview: expect.any(String) }
    });

    const testResponse = await server.inject({
      method: "POST",
      url: `/api/outreach/sender-accounts/${createResponse.json().id}/test-email`,
      headers,
      payload: { to: "buyer@example.com" }
    });

    expect(testResponse.statusCode, testResponse.body).toBe(200);
    expect(testResponse.json()).toMatchObject({ ok: true, message: "Test email sent to buyer@example.com." });
    expect(calls.items).toHaveLength(1);
    expect(calls.items[0].url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(calls.items[0].headers.authorization).toBe("Bearer ya29.endpoint-test-token");
  });
});

function senderAccount(input: {
  provider: string;
  sendChannel: OutreachSenderAccount["sendChannel"];
  accountId?: string;
  apiBaseUrl?: string;
}): OutreachSenderAccount {
  const now = new Date().toISOString();
  return {
    id: "sender-1",
    profileId: "profile-1",
    label: "Sales",
    provider: input.provider,
    sendChannel: input.sendChannel,
    fromName: "Sales",
    email: "sales@example.com",
    port: 587,
    secure: false,
    enabled: true,
    oauthApi: input.sendChannel === "oauth-api" ? {
      credentialRef: "credential-ref",
      accountId: input.accountId,
      apiBaseUrl: input.apiBaseUrl,
      scopes: []
    } : undefined,
    serviceApi: input.sendChannel === "service-api" ? {
      credentialRef: "credential-ref",
      accountId: input.accountId,
      apiBaseUrl: input.apiBaseUrl,
      scopes: []
    } : undefined,
    createdAt: now,
    updatedAt: now
  };
}

function createFetchRecorder(response: Response) {
  const items: Array<{ url: string; headers: Record<string, string>; body?: BodyInit | null }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    items.push({
      url: String(input),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body
    });
    return response.clone();
  }) as typeof fetch;
  return { fetchImpl, items };
}

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
