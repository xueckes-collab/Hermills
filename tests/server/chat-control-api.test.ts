import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createServer, type RuntimeAdapter } from "../../apps/server/src/index.js";
import { getDataHome, OutreachDraftSchema, type InstallEvent, type RuntimeStatus } from "@hermills/core";
import type { HermesReplyRequest } from "@hermills/runtime";

describe("chat control API", () => {
  let server: FastifyInstance;
  let baseDir: string;
  const headers = { "x-hermills-token": "test-token" };

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-chat-control-"));
    server = await createServer({ baseDir, desktopToken: "test-token", runtimeService: createFakeRuntime(), deepResearch: { enabled: false } });
  });

  afterEach(async () => {
    await server.close();
  });

  it("stores official chat platform channels including DingTalk and QQ", async () => {
    const dingtalk = await server.inject({
      method: "POST",
      url: "/api/channels",
      headers,
      payload: { kind: "dingtalk", label: "DingTalk chat control", enabled: false, config: { mode: "official-bot" } }
    });
    expect(dingtalk.statusCode, dingtalk.body).toBe(200);
    expect(dingtalk.json()).toMatchObject({ kind: "dingtalk", status: "disabled" });

    const qq = await server.inject({
      method: "POST",
      url: "/api/channels",
      headers,
      payload: { kind: "qq", label: "QQ chat control", enabled: false, config: { mode: "official-bot" } }
    });
    expect(qq.statusCode, qq.body).toBe(200);
    expect(qq.json()).toMatchObject({ kind: "qq", status: "disabled" });
  });

  it("creates a scan binding session and verifies the local command chain", async () => {
    const created = await server.inject({
      method: "POST",
      url: "/api/chat-control/bindings",
      headers,
      payload: { platform: "dingtalk", label: "DingTalk chat control" }
    });
    expect(created.statusCode, created.body).toBe(200);
    expect(created.json()).toMatchObject({
      platform: "dingtalk",
      status: "pending"
    });
    expect(created.json().bindingCode).toMatch(/^[A-Z0-9-]+$/);
    expect(created.json().qrPayload).toContain("chat-control/bind");
    expect(created.json().channelId).toBeTruthy();

    const bindings = await server.inject({ method: "GET", url: "/api/chat-control/bindings?kind=dingtalk", headers });
    expect(bindings.statusCode, bindings.body).toBe(200);
    expect(bindings.json()).toHaveLength(1);
    expect(bindings.json()[0].id).toBe(created.json().id);

    const test = await server.inject({
      method: "POST",
      url: `/api/chat-control/bindings/${created.json().id}/test`,
      headers,
      payload: {}
    });
    expect(test.statusCode, test.body).toBe(200);
    expect(test.json()).toMatchObject({
      platform: "dingtalk",
      status: "connected"
    });
    expect(test.json().resultText).toContain("Hermills 今日状态");

    const commands = await server.inject({ method: "GET", url: "/api/chat-control/commands", headers });
    expect(commands.statusCode, commands.body).toBe(200);
    expect(commands.json()[0]).toMatchObject({
      platform: "dingtalk",
      rawText: "今日状态",
      status: "completed"
    });
  });

  it("keeps cloud chat polling harmless when cloud relay is not configured", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/chat-control/cloud/poll",
      headers,
      payload: {}
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      pulled: 0,
      executed: 0,
      failed: 0
    });
  });

  it("executes a status command from a normalized chat message", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/chat-control/commands",
      headers,
      payload: {
        platform: "feishu",
        conversationId: "chat-1",
        senderId: "user-1",
        rawText: "今日状态"
      }
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      platform: "feishu",
      action: "status",
      status: "completed"
    });
    expect(response.json().resultText).toContain("Hermills 今日状态");

    const list = await server.inject({ method: "GET", url: "/api/chat-control/commands", headers });
    expect(list.statusCode, list.body).toBe(200);
    expect(list.json()[0].rawText).toBe("今日状态");
  });

  it("accepts signed platform webhooks without exposing the desktop API token", async () => {
    const channel = await server.inject({
      method: "POST",
      url: "/api/channels",
      headers,
      payload: { kind: "feishu", label: "Feishu chat control", enabled: true, secret: "platform-secret", config: { mode: "official-bot" } }
    });
    expect(channel.statusCode, channel.body).toBe(200);

    const rejected = await server.inject({
      method: "POST",
      url: `/api/chat-control/webhooks/${channel.json().id}`,
      headers: { "x-hermills-channel-secret": "wrong-secret" },
      payload: { event: { message: { content: JSON.stringify({ text: "今日状态" }), chat_id: "chat-feishu" }, sender: { sender_id: { user_id: "ou_1" } } } }
    });
    expect(rejected.statusCode, rejected.body).toBe(401);

    const accepted = await server.inject({
      method: "POST",
      url: `/api/chat-control/webhooks/${channel.json().id}`,
      headers: { "x-hermills-channel-secret": "platform-secret" },
      payload: { event: { message: { content: JSON.stringify({ text: "今日状态" }), chat_id: "chat-feishu" }, sender: { sender_id: { user_id: "ou_1" } } } }
    });
    expect(accepted.statusCode, accepted.body).toBe(200);
    expect(accepted.json()).toMatchObject({ ok: true });
    expect(accepted.json().reply).toContain("Hermills 今日状态");
    expect(accepted.json().command).toMatchObject({
      platform: "feishu",
      conversationId: "chat-feishu",
      senderId: "ou_1",
      action: "status",
      status: "completed"
    });
  });

  it("requires approval before sending a draft from chat control", async () => {
    await server.inject({ method: "PUT", url: "/api/company/profile", headers, payload: {
      name: "Eckes Export",
      website: "https://eckes-export.example",
      mainProducts: ["LED work light"],
      certifications: ["CE"]
    } });
    const lead = await server.inject({
      method: "POST",
      url: "/api/outreach/leads",
      headers,
      payload: { companyName: "Atlas Buyer", website: "https://atlas.example", email: "buyer@atlas.example" }
    });
    const draft = OutreachDraftSchema.parse({
      id: "abcdef12-3456-7890-abcd-ef1234567890",
      profileId: lead.json().profileId,
      leadId: lead.json().id,
      subject: "Contractor lighting options",
      body: "Hi Atlas Buyer team,\n\nI saw Atlas Buyer sells LED work lights for contractor channels, so stock availability and basic CE proof likely matter before testing another supplier.\n\nEckes Export can share 2-3 LED work light options with CE proof, MOQ, and lead-time notes side by side.\n\nWould a quick comparison table be useful before samples?\n\nBest regards,\nEckes Export",
      language: "English",
      tone: "warm",
      promptSnapshot: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await mkdir(getDataHome(baseDir), { recursive: true });
    await writeFile(path.join(getDataHome(baseDir), "outreach-drafts.json"), JSON.stringify({ drafts: [draft] }, null, 2));

    const send = await server.inject({
      method: "POST",
      url: "/api/chat-control/commands",
      headers,
      payload: {
        platform: "feishu",
        conversationId: "chat-1",
        senderId: "user-1",
        rawText: `发送草稿 ${draft.id.slice(0, 8)}`
      }
    });
    expect(send.statusCode, send.body).toBe(200);
    expect(send.json()).toMatchObject({
      action: "send-draft",
      status: "needs-approval",
      requiresApproval: true
    });
    expect(send.json().resultText).toContain("确认发送");
  });
});

function createFakeRuntime(): RuntimeAdapter & { requests: HermesReplyRequest[] } {
  const requests: HermesReplyRequest[] = [];
  return {
    requests,
    async getStatus(): Promise<RuntimeStatus> {
      return {
        platform: process.platform,
        arch: process.arch,
        installed: true,
        state: "ready",
        runtimeHome: os.tmpdir(),
        gateway: { state: "running" },
        checks: []
      };
    },
    async getLatest() {
      return { sourceUrl: "https://example.com", installerUrl: "https://example.com/hermes.exe", fetchedAt: new Date().toISOString() };
    },
    async getUpdateCheck() {
      return { installed: true, updateAvailable: false, checkState: "current", checkedAt: new Date().toISOString() };
    },
    async startInstall() {
      return { jobId: "install-job" };
    },
    getEvents(): InstallEvent[] {
      return [];
    },
    onEvent() {
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
      return { ok: false, message: "unsupported", status: fakeComputerControlStatus() };
    },
    async requestComputerControlPermission() {
      return { ok: false, message: "unsupported", status: fakeComputerControlStatus() };
    },
    async installComputerControlDriver() {
      return { ok: false, message: "unsupported", status: fakeComputerControlStatus() };
    },
    async enableComputerControlTools() {
      return { ok: false, message: "unsupported", status: fakeComputerControlStatus() };
    },
    async startComputerControlDashboard() {
      return { ok: false, message: "unsupported", status: fakeComputerControlStatus() };
    },
    async stopComputerControlDashboard() {
      return { ok: true, message: "stopped", status: fakeComputerControlStatus() };
    },
    async runComputerControlPrompt() {
      return { ok: false, message: "unsupported", output: "", status: fakeComputerControlStatus() };
    },
    async createHermesReply(request: HermesReplyRequest) {
      requests.push(request);
      return JSON.stringify({
        subject: "Contractor lighting options",
        body: "Hi Atlas Buyer team,\n\nI saw Atlas Buyer sells LED work lights for contractor channels, so stock availability and basic CE proof likely matter before testing another supplier.\n\nEckes Export can share 2-3 LED work light options with CE proof, MOQ, and lead-time notes side by side.\n\nWould a quick comparison table be useful before samples?\n\nBest regards,\nEckes Export\nhttps://eckes-export.example"
      });
    },
    async dispose() {
      return undefined;
    }
  };
}

function fakeComputerControlStatus() {
  return {
    platform: process.platform,
    supported: false,
    hermesCli: { found: true, version: "Hermes fake" },
    driver: { installed: false, statusText: "unsupported" },
    toolsets: { computerUseEnabled: false, enabled: [], missingRequired: ["computer_use"], output: "" },
    dashboard: { state: "stopped" as const, message: "stopped" },
    readiness: "unsupported" as const,
    permissions: []
  };
}
