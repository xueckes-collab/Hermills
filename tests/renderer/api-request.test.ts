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
});

function stubDesktop(fetchMock: typeof fetch): void {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {
    hermillsDesktop: {
      getConfig: async () => ({ apiBaseUrl: "http://127.0.0.1:47321", desktopToken: "test-token" })
    }
  });
}
