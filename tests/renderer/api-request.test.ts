import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../apps/renderer/src/api.js";

describe("renderer API request wrapper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not send a JSON content type for empty DELETE requests", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    stubDesktop(fetchMock);

    await api.deleteChatSession("session-1");

    const init = fetchMock.mock.calls[0]?.[1];
    const headers = init?.headers as Headers;
    expect(init?.method).toBe("DELETE");
    expect(headers.get("Content-Type")).toBeNull();
    expect(headers.get("x-hermills-token")).toBe("test-token");
  });

  it("shows the server error message instead of raw JSON", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      error: { code: "INTERNAL_ERROR", message: "Body cannot be empty when content-type is set to 'application/json'" }
    }), { status: 500 }));
    stubDesktop(fetchMock);

    await expect(api.deleteChatSession("session-1")).rejects.toThrow("Body cannot be empty when content-type is set to 'application/json'");
  });

  it("does not mark provider entries without saved keys as connected", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json([
      {
        id: "provider-missing-key",
        displayName: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini",
        enabled: true
      },
      {
        id: "provider-ready",
        displayName: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        defaultModel: "openai/gpt-4o-mini",
        keyPreview: "sk••••ready",
        enabled: true
      }
    ]));
    stubDesktop(fetchMock);

    await expect(api.providers()).resolves.toMatchObject([
      { id: "provider-missing-key", status: "missing", maskedKey: "No key saved" },
      { id: "provider-ready", status: "connected", maskedKey: "sk••••ready" }
    ]);
  });

  it("keeps the selected provider kind when saving API keys", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({
      id: "provider-claude",
      kind: "anthropic",
      displayName: "Anthropic Claude",
      baseUrl: "https://api.anthropic.com/v1",
      defaultModel: "claude-sonnet-4-20250514",
      keyPreview: "sk-ant••••test",
      enabled: true
    }));
    stubDesktop(fetchMock);

    await api.saveProvider({
      kind: "anthropic",
      displayName: "Anthropic Claude",
      baseUrl: "https://api.anthropic.com/v1",
      defaultModel: "claude-sonnet-4-20250514",
      apiKey: "sk-ant-test"
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      kind: "anthropic",
      displayName: "Anthropic Claude",
      baseUrl: "https://api.anthropic.com/v1",
      defaultModel: "claude-sonnet-4-20250514",
      apiKey: "sk-ant-test"
    });
  });

  it("creates outreach campaigns without a send confirmation flag", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ id: "campaign-1", recipients: [], stats: {} }));
    stubDesktop(fetchMock);

    await api.createOutreachCampaign({ name: "Batch", leadIds: ["lead-1", "lead-2"], language: "English" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/api/outreach/campaigns");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ name: "Batch", leadIds: ["lead-1", "lead-2"], language: "English" });
  });

  it("uses explicit confirmation only for campaign approval and sending", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ id: "campaign-1", recipients: [], stats: {} }));
    stubDesktop(fetchMock);

    await api.generateOutreachCampaign("campaign-1");
    await api.approveOutreachCampaignRecipient("campaign-1", "recipient-1", { subject: "Hi", body: "Body" });
    await api.startOutreachCampaign("campaign-1", { senderAccountId: "sender-1" });
    await api.scheduleOutreachFollowUps("campaign-1", { senderAccountId: "sender-1" });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({});
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ subject: "Hi", body: "Body", confirm: true });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({ senderAccountId: "sender-1", confirm: true });
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({ senderAccountId: "sender-1", mode: "confirm", confirm: true });
  });

  it("uses dedicated outreach quality review and rewrite endpoints", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith("/review")) return Response.json({ score: 100, passed: true, blocked: false, checks: [], summary: "ok" });
      if (String(url).endsWith("/rewrite") && String(url).includes("/recipients/")) {
        return Response.json({ id: "campaign-1", recipients: [{ id: "recipient-1", draft: { id: "draft-1", qualityReview: { score: 100, passed: true } } }], stats: {} });
      }
      return Response.json({ id: "draft-1", subject: "Better subject", body: "Better body", qualityReview: { score: 100, passed: true } });
    });
    stubDesktop(fetchMock);

    await api.reviewOutreachDraft("draft-1");
    await api.rewriteOutreachDraft("draft-1", { providerId: "provider-1", model: "model-1" });
    await api.reviewOutreachCampaignRecipient("campaign-1", "recipient-1");
    await api.rewriteOutreachCampaignRecipient("campaign-1", "recipient-1", { providerId: "provider-2" });

    expect(fetchMock.mock.calls.map((call) => String(call[0]).replace("http://127.0.0.1:47321", ""))).toEqual([
      "/api/outreach/drafts/draft-1/review",
      "/api/outreach/drafts/draft-1/rewrite",
      "/api/outreach/campaigns/campaign-1/recipients/recipient-1/review",
      "/api/outreach/campaigns/campaign-1/recipients/recipient-1/rewrite"
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({});
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ providerId: "provider-1", model: "model-1" });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({});
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({ providerId: "provider-2" });
  });

  it("uses dedicated outreach follow-up and inbox endpoints", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (String(url).includes("/api/outreach/followups?")) return Response.json([]);
      if (String(url).includes("/api/outreach/followups/stats")) return Response.json({ total: 0, scheduled: 0, ready: 0, sent: 0, failed: 0, stopped: 0 });
      if (String(url).includes("/api/outreach/inbox/check")) return Response.json({ ok: true, status: "ready", message: "ok", sender: { id: "sender-1" }, matched: [], stopped: 0 });
      return Response.json({ processed: 0, sent: 0, ready: 0, failed: 0, stopped: 0 });
    });
    stubDesktop(fetchMock);

    await api.outreachFollowUps("campaign-1");
    await api.outreachFollowUpStats("campaign-1");
    await api.tickOutreachFollowUps({ limit: 7 });
    await api.checkOutreachInbox({ senderAccountId: "sender-1", campaignId: "campaign-1" });

    expect(fetchMock.mock.calls.map((call) => String(call[0]).replace("http://127.0.0.1:47321", ""))).toEqual([
      "/api/outreach/followups?campaignId=campaign-1",
      "/api/outreach/followups/stats?campaignId=campaign-1",
      "/api/outreach/followups/tick",
      "/api/outreach/inbox/check"
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({ limit: 7 });
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({ senderAccountId: "sender-1", campaignId: "campaign-1" });
  });

  it("uses fixed computer-control API paths", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith("/api/computer-control/status")) return Response.json(fakeComputerControlStatus());
      return Response.json({ ok: true, message: "ok", status: fakeComputerControlStatus() });
    });
    stubDesktop(fetchMock);

    await api.computerControlStatus();
    await api.prepareComputerControl();
    await api.requestComputerControlPermission("accessibility");
    await api.enableComputerControlTools();
    await api.installComputerControlDriver();
    await api.startComputerControlDashboard();
    await api.stopComputerControlDashboard();

    expect(fetchMock.mock.calls.map((call) => String(call[0]).replace("http://127.0.0.1:47321", ""))).toEqual([
      "/api/computer-control/status",
      "/api/computer-control/prepare",
      "/api/computer-control/request-permission",
      "/api/computer-control/enable-tools",
      "/api/computer-control/install-driver",
      "/api/computer-control/dashboard/start",
      "/api/computer-control/dashboard/stop"
    ]);
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get("x-hermills-token")).toBe("test-token");
  });
});

function fakeComputerControlStatus() {
  return {
    platform: "darwin",
    supported: true,
    hermesCli: { found: true, version: "Hermes fake" },
    driver: { installed: false, statusText: "cua-driver: not installed" },
    toolsets: { computerUseEnabled: false, enabled: [], missingRequired: ["computer_use"] },
    dashboard: { state: "stopped", message: "stopped" },
    readiness: "preparing",
    permissions: []
  };
}

function stubDesktop(fetchMock: typeof fetch): void {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {
    hermillsDesktop: {
      getConfig: async () => ({ apiBaseUrl: "http://127.0.0.1:47321", desktopToken: "test-token" })
    }
  });
}
