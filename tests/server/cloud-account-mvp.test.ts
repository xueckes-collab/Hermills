import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HermillsCloudService } from "../../apps/server/src/cloud.js";

describe("Hermills cloud account MVP", () => {
  it("refuses signup until the user accepts terms", async () => {
    const calls: string[] = [];
    const service = new HermillsCloudService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-cloud-account-")),
      env: cloudEnv(),
      fetchImpl: async (input) => {
        calls.push(String(input));
        return json({});
      }
    });

    await expect(service.signUp({
      email: "buyer@example.com",
      password: "secret123",
      termsAccepted: false
    })).rejects.toThrow("请先同意");
    expect(calls).toEqual([]);
  });

  it("stores account profile metadata during signup", async () => {
    const calls: Array<{ url: string; body?: unknown; method?: string }> = [];
    const service = new HermillsCloudService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-cloud-account-")),
      env: cloudEnv(),
      fetchImpl: mockSupabase(calls, {
        account: {
          user_id: "user-1",
          email: "buyer@example.com",
          display_name: "Eckes",
          nickname: "Eckes",
          status: "active",
          email_verified: true,
          terms_accepted_at: "2026-06-17T00:00:00.000Z"
        }
      })
    });

    const status = await service.signUp({
      email: "buyer@example.com",
      password: "secret123",
      fullName: "Eckes",
      nickname: "Eckes",
      termsAccepted: true
    });

    expect(status.authenticated).toBe(true);
    expect(status.account).toMatchObject({
      userId: "user-1",
      nickname: "Eckes",
      status: "active",
      emailVerified: true
    });
    const signup = calls.find((call) => call.url.endsWith("/auth/v1/signup"));
    expect(signup?.body).toMatchObject({
      email: "buyer@example.com",
      data: {
        full_name: "Eckes",
        nickname: "Eckes",
        terms_accepted: true
      }
    });
    expect(calls.some((call) => call.url.includes("/rest/v1/event_logs"))).toBe(true);
  });

  it("verifies signup with the numeric email code inside Hermills", async () => {
    const calls: Array<{ url: string; body?: unknown; method?: string }> = [];
    const service = new HermillsCloudService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-cloud-account-")),
      env: cloudEnv(),
      fetchImpl: mockSupabase(calls, {
        account: {
          user_id: "user-1",
          email: "buyer@example.com",
          display_name: "Eckes",
          nickname: "Eckes",
          status: "active",
          email_verified: true
        }
      })
    });

    const status = await service.verifySignupCode({
      email: "buyer@example.com",
      token: "12345678"
    });

    expect(status.authenticated).toBe(true);
    expect(status.account).toMatchObject({
      userId: "user-1",
      status: "active",
      emailVerified: true
    });
    const verify = calls.find((call) => call.url.endsWith("/auth/v1/verify"));
    expect(verify?.body).toEqual({
      email: "buyer@example.com",
      token: "12345678",
      type: "email"
    });
  });

  it("blocks disabled accounts after password login", async () => {
    const service = new HermillsCloudService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-cloud-account-")),
      env: cloudEnv(),
      fetchImpl: mockSupabase([], {
        account: {
          user_id: "user-1",
          email: "buyer@example.com",
          display_name: "Eckes",
          nickname: "Eckes",
          status: "disabled",
          email_verified: true
        }
      })
    });

    await expect(service.login({
      email: "buyer@example.com",
      password: "secret123"
    })).rejects.toThrow("停用");
    await expect(service.status()).resolves.toMatchObject({
      configured: true,
      authenticated: false
    });
  });

  it("does not upload raw customer identifiers in cloud learning sync", async () => {
    const calls: Array<{ url: string; body?: unknown; method?: string }> = [];
    const service = new HermillsCloudService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-cloud-account-")),
      env: cloudEnv(),
      fetchImpl: mockSupabase(calls, {
        account: {
          user_id: "user-1",
          email: "owner@example.com",
          display_name: "Eckes",
          nickname: "Eckes",
          status: "active",
          email_verified: true
        }
      })
    });

    await service.login({ email: "owner@example.com", password: "secret123" });
    await service.syncSnapshot({
      profileId: "profile-1",
      companyProfile: {
        name: "Anyway Flooring",
        website: "https://anywayflooring.com",
        mainProducts: ["SPC Flooring"]
      },
      leads: [{
        id: "lead-1",
        companyName: "Czanyway",
        website: "https://czanyway.com",
        email: "sherry@czanyway.com",
        industry: "Flooring importer"
      }],
      drafts: [{
        id: "draft-1",
        leadId: "lead-1",
        subject: "Quick question for czanyway.com",
        body: "Hi Sherry, I saw https://czanyway.com and wanted to email sherry@czanyway.com.",
        status: "sent",
        writingEngine: "harness-v2",
        modelUsed: "deepseek-v4-pro",
        learningSignal: {
          customerIndustry: "Flooring importer",
          customerType: "Distributor at czanyway.com",
          customerCountry: "US",
          developmentAngle: "Compare SPC options for sherry@czanyway.com",
          cta: "Send 2-3 options",
          emailWordCount: 18,
          replyOutcome: "unknown"
        },
        qualityReview: { score: 91 }
      }],
      workflows: [],
      campaigns: [],
      feedback: []
    });

    const syncedBodies = calls
      .filter((call) => /\/rest\/v1\/(?:customers|email_generations|learning_events|hermills_redacted_events)/.test(call.url))
      .map((call) => JSON.stringify(call.body));
    expect(syncedBodies.join("\n")).not.toMatch(/sherry@czanyway\.com/i);
    expect(syncedBodies.join("\n")).not.toMatch(/https:\/\/czanyway\.com/i);
    expect(syncedBodies.join("\n")).not.toMatch(/\bczanyway\.com\b/i);
  });
});

function cloudEnv(): NodeJS.ProcessEnv {
  return {
    SUPABASE_URL: "https://supabase.example",
    SUPABASE_ANON_KEY: "anon-key",
    HERMILLS_CLOUD_REQUIRED: "1"
  };
}

function mockSupabase(
  calls: Array<{ url: string; body?: unknown; method?: string }>,
  options: { account: Record<string, unknown>; admin?: boolean }
): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = parseBody(init?.body);
    calls.push({ url, method, body });

    if (url.endsWith("/auth/v1/signup") || url.endsWith("/auth/v1/token?grant_type=password") || url.endsWith("/auth/v1/verify")) {
      return json({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        user: {
          id: "user-1",
          email: "buyer@example.com",
          user_metadata: { full_name: "Eckes" }
        }
      });
    }

    if (url.includes("/rest/v1/hermills_accounts") && method === "POST") {
      return json({}, 201);
    }

    if (url.includes("/rest/v1/hermills_accounts")) {
      return json([options.account]);
    }

    if (url.includes("/rest/v1/hermills_admins")) {
      return json(options.admin ? [{ user_id: "user-1" }] : []);
    }

    if (url.includes("/rest/v1/event_logs")) {
      return json({}, 201);
    }

    if (url.includes("/rest/v1/hermills_redacted_events")) {
      return method === "GET" ? json([]) : json({}, 201);
    }

    if (url.includes("/rest/v1/learning_events")) {
      return method === "GET" ? json([]) : json({}, 201);
    }

    if (url.includes("/rest/v1/learning_rules")) {
      return method === "GET" ? json([]) : json({}, 201);
    }

    if (url.includes("/rest/v1/hermills_learning_pack_versions") || url.includes("/rest/v1/learning_summaries")) {
      return json({}, 201);
    }

    if (/\/rest\/v1\/(?:seller_profiles|customers|email_generations)/.test(url)) {
      return json({}, 201);
    }

    if (url.endsWith("/auth/v1/logout")) {
      return json({});
    }

    return json({});
  };
}

function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
