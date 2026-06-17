import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { LocalCredentialVault } from "@hermills/agent-builder";
import { getDataHome, redactSecrets } from "@hermills/core";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\bhttps?:\/\/[^\s"'<>]+/gi;
const BARE_DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|co|io|cn|de|fr|es|it|nl|pl|us|uk|ca|au|jp|kr|in|br|mx|ru|tr|ae|sa|za|biz|info|shop|store)\b/gi;
const SECRET_RE = /\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|[A-Za-z0-9_-]{32,})\b/g;

export const CloudAuthBodySchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(200),
  fullName: z.string().trim().max(160).optional()
}).strict();

export const CloudSignupBodySchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
  fullName: z.string().trim().max(160).optional(),
  nickname: z.string().trim().max(80).optional(),
  termsAccepted: z.boolean().default(false)
}).strict();

export const CloudEmailBodySchema = z.object({
  email: z.string().trim().email().max(320)
}).strict();

export const CloudVerifySignupCodeBodySchema = z.object({
  email: z.string().trim().email().max(320),
  token: z.string().trim().regex(/^\d{6}$/, "验证码必须是 6 位数字")
}).strict();

export const CloudAdminUserStatusBodySchema = z.object({
  status: z.enum(["active", "disabled"])
}).strict();

export const CloudSyncBodySchema = z.object({
  force: z.boolean().default(false)
}).strict();

export const CloudSummarizeLearningRulesBodySchema = z.object({
  profileId: z.string().min(1).optional(),
  windowDays: z.coerce.number().int().min(7).max(365).default(90),
  minEvidence: z.coerce.number().int().min(3).max(500).default(5),
  dryRun: z.boolean().default(false),
  forceSync: z.boolean().default(true)
}).strict();

export type CloudUser = {
  id: string;
  email: string;
  fullName?: string;
};

export type CloudAccountProfile = {
  userId: string;
  email: string;
  displayName: string;
  nickname: string;
  status: "active" | "disabled";
  emailVerified: boolean;
  termsAcceptedAt?: string;
  lastLoginAt?: string;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
  isAdmin?: boolean;
};

export type CloudAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: CloudUser;
};

export type CloudLearningPack = {
  version: string;
  generatedAt: string;
  userPreferences: {
    preferredTone?: string;
    preferredCta?: string;
    preferredEmailLength?: string;
    avoidPhrases: string[];
    commonEdits: string[];
  };
  companyRules: string[];
  customerRules: string[];
  globalRules: Array<{
    ruleType: string;
    condition: Record<string, unknown>;
    recommendation: string;
    confidence: number;
    evidenceCount: number;
  }>;
};

export type CloudStatus = {
  configured: boolean;
  required: boolean;
  authenticated: boolean;
  user?: CloudUser;
  account?: CloudAccountProfile;
  expiresAt?: string;
  cloudUrl?: string;
  lastSyncAt?: string;
  syncQueued: number;
  learningPackVersion?: string;
  learningRulesUpdatedAt?: string;
  message: string;
};

type CloudSyncState = {
  version: 1;
  lastSyncAt?: string;
  syncQueued: number;
  learningPackVersion?: string;
  learningRulesUpdatedAt?: string;
  localToCloud: Record<string, string>;
};

type SupabaseAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
  error?: string;
  error_description?: string;
  msg?: string;
};

type LearningPackInput = {
  profileId?: string;
  companyProfile: {
    name?: string;
    website?: string;
    mainProducts?: string[];
    markets?: string[];
    certifications?: string[];
    brandVoice?: string;
  };
  lead?: {
    companyName?: string;
    country?: string;
    industry?: string;
    need?: string;
    tags?: string[];
    leadFitScore?: unknown;
    valueMatch?: unknown;
  };
  customerType?: string;
  industry?: string;
};

export type CloudSyncSnapshot = {
  profileId: string;
  companyProfile: unknown;
  leads: Array<unknown>;
  drafts: Array<unknown>;
  workflows: Array<unknown>;
  campaigns: Array<unknown>;
  feedback: Array<unknown>;
};

export type CloudLearningRuleCandidate = {
  scope: "user" | "company" | "global_anonymous";
  ruleType: string;
  ruleKey: string;
  condition: Record<string, unknown>;
  recommendation: string;
  confidence: number;
  evidenceCount: number;
  stats: {
    sent: number;
    replied: number;
    bounced: number;
    replyRate: number;
    bounceRate: number;
    baselineReplyRate: number;
    lift: number;
    windowDays: number;
  };
};

export type CloudLearningRuleSummary = {
  ok: true;
  generatedAt: string;
  scope: "user";
  scanned: {
    redactedEvents: number;
    legacyEvents: number;
  };
  candidates: number;
  upserted: number;
  skipped: Array<{ reason: string; count: number }>;
  rules: CloudLearningRuleCandidate[];
};

export class HermillsCloudService {
  private readonly authStore: CloudAuthStore;
  private readonly syncStore: CloudSyncStore;
  private readonly config: CloudConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { baseDir?: string; fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv }) {
    const env = options.env ?? process.env;
    this.config = {
      url: env.SUPABASE_URL?.replace(/\/+$/, "") ?? "",
      anonKey: env.SUPABASE_ANON_KEY ?? "",
      required: env.HERMILLS_CLOUD_REQUIRED !== "0"
    };
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.authStore = new CloudAuthStore(options.baseDir);
    this.syncStore = new CloudSyncStore(options.baseDir);
  }

  isConfigured(): boolean {
    return Boolean(this.config.url && this.config.anonKey);
  }

  async status(): Promise<CloudStatus> {
    const [storedSession, sync] = await Promise.all([this.authStore.get(), this.syncStore.get()]);
    if (!this.isConfigured()) {
      return {
        configured: false,
        required: this.config.required,
        authenticated: false,
        syncQueued: sync.syncQueued,
        lastSyncAt: sync.lastSyncAt,
        learningRulesUpdatedAt: sync.learningRulesUpdatedAt,
        message: "Hermills Cloud is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY before publishing."
      };
    }
    let session = storedSession;
    if (session?.accessToken && new Date(session.expiresAt).getTime() - Date.now() <= 60_000) {
      session = await this.requireSession().catch(async () => {
        await this.authStore.clear();
        return undefined;
      });
    }
    const account = session?.accessToken
      ? await this.readAccountProfile(session.accessToken, session.user).catch(() => undefined)
      : undefined;
    const accountDisabled = account?.status === "disabled";
    return {
      configured: true,
      required: this.config.required,
      authenticated: Boolean(session?.accessToken) && !accountDisabled,
      user: session?.user,
      account,
      expiresAt: session?.expiresAt,
      cloudUrl: this.config.url,
      syncQueued: sync.syncQueued,
      lastSyncAt: sync.lastSyncAt,
      learningPackVersion: sync.learningPackVersion,
      learningRulesUpdatedAt: sync.learningRulesUpdatedAt,
      message: accountDisabled
        ? "这个 Hermills 账号已被管理员停用。"
        : session?.accessToken ? "Hermills Cloud is connected." : "Sign in to enable cloud memory and Learning Pack."
    };
  }

  async signUp(input: z.infer<typeof CloudSignupBodySchema>): Promise<CloudStatus> {
    this.assertConfigured();
    if (!input.termsAccepted) throw new CloudError("请先同意服务条款和隐私政策。", "CLOUD_TERMS_REQUIRED");
    const now = new Date().toISOString();
    const displayName = input.fullName || input.nickname || input.email.split("@")[0] || "";
    const response = await this.authRequest("/auth/v1/signup", {
      method: "POST",
      body: {
        email: input.email,
        password: input.password,
        data: {
          full_name: displayName,
          nickname: input.nickname || displayName,
          terms_accepted: true,
          terms_accepted_at: now
        }
      }
    });
    if (response.access_token) {
      await this.saveSession(response);
      const session = await this.requireSession();
      await this.upsertAccountFromSession(session, {
        display_name: displayName,
        nickname: input.nickname || displayName,
        terms_accepted_at: now,
        last_login_at: now,
        last_seen_at: now
      }).catch(() => undefined);
      await this.logAuthEvent(session, "user_registered", { termsAccepted: true }).catch(() => undefined);
      await this.logAuthEvent(session, "user_logged_in", { method: "signup" }).catch(() => undefined);
    }
    return this.status();
  }

  async login(input: z.infer<typeof CloudAuthBodySchema>): Promise<CloudStatus> {
    this.assertConfigured();
    const response = await this.authRequest("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: {
        email: input.email,
        password: input.password
      }
    });
    await this.saveSession(response);
    const session = await this.requireSession();
    const now = new Date().toISOString();
    const account = await this.upsertAccountFromSession(session, {
      last_login_at: now,
      last_seen_at: now
    }).catch(() => undefined);
    if (account?.status === "disabled") {
      await this.authStore.clear();
      throw new CloudError("这个账号已被管理员停用。", "CLOUD_ACCOUNT_DISABLED", 403);
    }
    await this.logAuthEvent(session, "user_logged_in", { method: "password" }).catch(() => undefined);
    return this.status();
  }

  async logout(): Promise<CloudStatus> {
    const session = await this.authStore.get();
    if (session?.accessToken && this.isConfigured()) {
      await this.logAuthEvent(session, "user_logged_out", {}).catch(() => undefined);
      await this.fetchImpl(`${this.config.url}/auth/v1/logout`, {
        method: "POST",
        headers: this.authHeaders(session.accessToken)
      }).catch(() => undefined);
    }
    await this.authStore.clear();
    return this.status();
  }

  async resetPassword(email: string): Promise<{ ok: true }> {
    this.assertConfigured();
    await this.authRequest("/auth/v1/recover", {
      method: "POST",
      body: { email }
    });
    return { ok: true };
  }

  async resendSignupConfirmation(email: string): Promise<{ ok: true }> {
    this.assertConfigured();
    await this.authRequest("/auth/v1/resend", {
      method: "POST",
      body: { type: "signup", email }
    });
    return { ok: true };
  }

  async verifySignupCode(input: z.infer<typeof CloudVerifySignupCodeBodySchema>): Promise<CloudStatus> {
    this.assertConfigured();
    const response = await this.authRequest("/auth/v1/verify", {
      method: "POST",
      body: {
        email: input.email,
        token: input.token,
        type: "email"
      }
    });
    await this.saveSession(response);
    const session = await this.requireSession();
    const now = new Date().toISOString();
    const account = await this.upsertAccountFromSession(session, {
      email_verified: true,
      last_login_at: now,
      last_seen_at: now
    }).catch(() => undefined);
    if (account?.status === "disabled") {
      await this.authStore.clear();
      throw new CloudError("这个账号已被管理员停用。", "CLOUD_ACCOUNT_DISABLED", 403);
    }
    await this.logAuthEvent(session, "user_email_code_verified", { method: "signup_otp" }).catch(() => undefined);
    await this.logAuthEvent(session, "user_logged_in", { method: "signup_otp" }).catch(() => undefined);
    return this.status();
  }

  async me(): Promise<CloudStatus> {
    return this.status();
  }

  async acceptTerms(): Promise<CloudStatus> {
    const session = await this.requireSession();
    const now = new Date().toISOString();
    await this.upsertAccountFromSession(session, {
      terms_accepted_at: now,
      last_seen_at: now
    });
    await this.logAuthEvent(session, "terms_accepted", {}).catch(() => undefined);
    return this.status();
  }

  async adminUsers(): Promise<CloudAccountProfile[]> {
    const session = await this.requireSession();
    await this.assertAdmin(session);
    const rows = await this.select("hermills_accounts", session.accessToken, [
      "select=user_id,email,display_name,nickname,status,email_verified,terms_accepted_at,last_login_at,last_seen_at,created_at,updated_at",
      "order=created_at.desc",
      "limit=500"
    ].join("&"));
    return rows.map((row) => toCloudAccountProfile(row));
  }

  async updateAdminUserStatus(userId: string, status: "active" | "disabled"): Promise<CloudAccountProfile> {
    const session = await this.requireSession();
    await this.assertAdmin(session);
    const rows = await this.patch("hermills_accounts", {
      status,
      updated_at: new Date().toISOString()
    }, session.accessToken, `user_id=eq.${encodeURIComponent(userId)}`);
    await this.logAuthEvent(session, "admin_user_status_updated", { targetUserId: stableHash(userId), status }).catch(() => undefined);
    return toCloudAccountProfile(rows[0] ?? { user_id: userId, status });
  }

  async requireSession(): Promise<CloudAuthSession> {
    this.assertConfigured();
    const session = await this.authStore.get();
    if (!session?.accessToken) throw new CloudError("Cloud login is required.", "CLOUD_LOGIN_REQUIRED");
    if (new Date(session.expiresAt).getTime() - Date.now() > 60_000) return session;
    const refreshed = await this.authRequest("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: session.refreshToken }
    });
    await this.saveSession(refreshed);
    const next = await this.authStore.get();
    if (!next) throw new CloudError("Cloud session refresh failed.", "CLOUD_LOGIN_REQUIRED");
    return next;
  }

  async syncSnapshot(snapshot: CloudSyncSnapshot): Promise<CloudStatus> {
    if (!this.isConfigured()) return this.status();
    const session = await this.requireSession();
    const now = new Date().toISOString();
    const withUser = (row: Record<string, unknown>) => ({ user_id: session.user.id, ...row });
    const sellerProfile = toSellerProfileRow(snapshot.profileId, objectValue(snapshot.companyProfile));
    await this.upsert("seller_profiles", [withUser(sellerProfile)], session.accessToken, "user_id,source_local_id");
    await this.upsert("customers", snapshot.leads.map((lead) => withUser(toCustomerRow(snapshot.profileId, objectValue(lead)))), session.accessToken, "user_id,source_local_id");
    await this.upsert("email_generations", snapshot.drafts.map((draft) => withUser(toEmailGenerationRow(snapshot.profileId, objectValue(draft)))), session.accessToken, "user_id,source_local_id");
    const learningEvents = snapshot.drafts
      .map((draft) => toLearningEventRow(snapshot.profileId, objectValue(draft)))
      .filter((row): row is Record<string, unknown> => Boolean(row));
    await this.upsert("learning_events", learningEvents.map(withUser), session.accessToken, "user_id,event_key")
      .catch(() => this.insert("learning_events", learningEvents.map(withUser), session.accessToken));
    await this.upsert("hermills_redacted_events", learningEvents.map((row) => withUser(toRedactedEventRow(snapshot.profileId, row))), session.accessToken, "user_id,source_type,source_local_id,event_type")
      .catch(() => undefined);
    await this.insert("event_logs", [withUser({
      event_type: "cloud_sync",
      event_data: {
        profileId: stableHash(`profile:${snapshot.profileId}`),
        leads: snapshot.leads.length,
        drafts: snapshot.drafts.length,
        workflows: snapshot.workflows.length,
        campaigns: snapshot.campaigns.length,
        feedback: snapshot.feedback.length
      },
      created_at: now
    })], session.accessToken);
    await this.syncStore.update({ lastSyncAt: now, syncQueued: 0 });
    await this.summarizeLearningRules({
      profileId: snapshot.profileId,
      windowDays: 90,
      minEvidence: 3,
      dryRun: false,
      forceSync: false
    }).catch(() => undefined);
    return this.status();
  }

  async summarizeLearningRules(input: z.infer<typeof CloudSummarizeLearningRulesBodySchema>): Promise<CloudLearningRuleSummary> {
    if (!this.isConfigured()) throw new CloudError("Hermills Cloud is not configured.", "CLOUD_NOT_CONFIGURED");
    const session = await this.requireSession();
    const generatedAt = new Date().toISOString();
    const windowStart = new Date(Date.now() - input.windowDays * 24 * 60 * 60 * 1000).toISOString();
    const profileKey = input.profileId ? stableHash(`profile:${input.profileId}`) : "";
    const redactedRows = await this.select("hermills_redacted_events", session.accessToken, [
      "select=*",
      `recorded_at=gte.${encodeURIComponent(windowStart)}`,
      "order=recorded_at.desc",
      "limit=2000"
    ].join("&")).catch(() => [] as Record<string, unknown>[]);
    const legacyRows = redactedRows.length
      ? []
      : await this.select("learning_events", session.accessToken, [
        "select=*",
        `created_at=gte.${encodeURIComponent(windowStart)}`,
        "order=created_at.desc",
        "limit=2000"
      ].join("&")).catch(() => [] as Record<string, unknown>[]);
    const events = [...redactedRows, ...legacyRows]
      .map(normalizeLearningEventForRules)
      .filter((event) => !profileKey || !event.profileKey || event.profileKey === profileKey);
    const rules = buildLearningRuleCandidates(events, input.windowDays, input.minEvidence);
    let upserted = 0;
    if (!input.dryRun && rules.length) {
      await this.upsert("learning_rules", rules.map((rule) => ({
        user_id: session.user.id,
        scope: rule.scope,
        rule_type: rule.ruleType,
        rule_key: rule.ruleKey,
        condition: rule.condition,
        recommendation: rule.recommendation,
        confidence: rule.confidence,
        evidence_count: rule.evidenceCount,
        stats: rule.stats,
        updated_at: generatedAt
      })), session.accessToken, "user_id,rule_key").catch(async () => {
        await this.insert("learning_rules", rules.map((rule) => ({
          user_id: session.user.id,
          scope: rule.scope,
          rule_type: rule.ruleType,
          condition: rule.condition,
          recommendation: rule.recommendation,
          confidence: rule.confidence,
          evidence_count: rule.evidenceCount
        })), session.accessToken);
      });
      upserted = rules.length;
      await this.upsert("hermills_rule_summaries", [{
        user_id: session.user.id,
        local_profile_id: profileKey,
        scope: "user",
        summary_type: "learning_rules",
        summary_key: `rules:${profileKey || "all"}:${input.windowDays}`,
        summary_text: rules.map((rule) => rule.recommendation).slice(0, 8).join("\n"),
        summary_payload: { rules, windowDays: input.windowDays, minEvidence: input.minEvidence },
        source_event_count: events.length,
        confidence: average(rules.map((rule) => rule.confidence)),
        evidence_count: rules.reduce((sum, rule) => sum + rule.evidenceCount, 0),
        event_window_start: windowStart,
        event_window_end: generatedAt,
        status: "active",
        generated_at: generatedAt,
        updated_at: generatedAt
      }], session.accessToken, "user_id,summary_key").catch(() => undefined);
      const packHash = stableHash(JSON.stringify(rules));
      await this.upsert("hermills_learning_pack_versions", [{
        user_id: session.user.id,
        local_profile_id: profileKey,
        pack_version: `cloud-${generatedAt.slice(0, 10)}-${packHash.slice(0, 8)}`,
        pack_hash: packHash,
        source_event_count: events.length,
        source_rule_ids: [],
        source_rule_summary_ids: [],
        rules_fingerprint: stableHash(rules.map((rule) => rule.ruleKey).join("|")),
        pack_payload: { ruleCount: rules.length, windowDays: input.windowDays },
        is_current: true,
        generated_at: generatedAt
      }], session.accessToken, "user_id,local_profile_id,pack_version").catch(() => undefined);
    }
    if (!input.dryRun) await this.syncStore.update({ learningRulesUpdatedAt: generatedAt });
    return {
      ok: true,
      generatedAt,
      scope: "user",
      scanned: { redactedEvents: redactedRows.length, legacyEvents: legacyRows.length },
      candidates: rules.length,
      upserted,
      skipped: events.length < input.minEvidence ? [{ reason: "not_enough_evidence", count: events.length }] : [],
      rules
    };
  }

  async learningPack(input: LearningPackInput): Promise<CloudLearningPack> {
    const localDefault = defaultLearningPack(input);
    if (!this.isConfigured()) return localDefault;
    const session = await this.authStore.get();
    if (!session?.accessToken) return localDefault;
    const token = (await this.requireSession()).accessToken;
    const [preferences, rules, samples] = await Promise.all([
      this.select("user_preferences", token, "select=preferred_tone,preferred_cta,preferred_email_length,avoid_phrases,common_edits&limit=1&order=updated_at.desc"),
      this.select("learning_rules", token, "select=scope,rule_type,condition,recommendation,confidence,evidence_count&or=(scope.eq.global_anonymous,scope.eq.user)&order=confidence.desc&limit=20"),
      this.select("golden_samples", token, "select=customer_type,industry,angle,cta_type,why_it_worked&order=created_at.desc&limit=10")
    ]).catch(() => [[], [], []] as Array<Record<string, unknown>[]>);
    const pref = preferences[0] ?? {};
    const globalRules = rules.map((rule) => ({
      ruleType: stringValue(rule.rule_type),
      condition: objectValue(rule.condition),
      recommendation: stringValue(rule.recommendation),
      confidence: numberValue(rule.confidence),
      evidenceCount: Math.round(numberValue(rule.evidence_count))
    })).filter((rule) => rule.recommendation);
    const pack: CloudLearningPack = {
      version: `cloud-${new Date().toISOString().slice(0, 10)}`,
      generatedAt: new Date().toISOString(),
      userPreferences: {
        preferredTone: stringValue(pref.preferred_tone) || input.companyProfile.brandVoice,
        preferredCta: stringValue(pref.preferred_cta),
        preferredEmailLength: stringValue(pref.preferred_email_length),
        avoidPhrases: stringArray(pref.avoid_phrases),
        commonEdits: stringArray(pref.common_edits)
      },
      companyRules: localDefault.companyRules,
      customerRules: [
        ...localDefault.customerRules,
        ...samples.map((sample) => stringValue(sample.why_it_worked)).filter(Boolean).slice(0, 4)
      ],
      globalRules: globalRules.length ? globalRules : localDefault.globalRules
    };
    await this.syncStore.update({ learningPackVersion: pack.version });
    return pack;
  }

  async learningPackContext(input: LearningPackInput): Promise<string> {
    return formatLearningPackContext(await this.learningPack(input));
  }

  private async readAccountProfile(token: string, user: CloudUser): Promise<CloudAccountProfile> {
    const fullRows = await this.select("hermills_accounts", token, [
      "select=user_id,email,display_name,nickname,status,email_verified,terms_accepted_at,last_login_at,last_seen_at,created_at,updated_at",
      `user_id=eq.${encodeURIComponent(user.id)}`,
      "limit=1"
    ].join("&")).catch(async () => this.select("hermills_accounts", token, [
      "select=user_id,email,display_name,created_at,updated_at",
      `user_id=eq.${encodeURIComponent(user.id)}`,
      "limit=1"
    ].join("&")));
    const isAdmin = await this.isAdmin(token, user.id).catch(() => false);
    return toCloudAccountProfile(fullRows[0] ?? {
      user_id: user.id,
      email: user.email,
      display_name: user.fullName ?? ""
    }, isAdmin);
  }

  private async upsertAccountFromSession(session: CloudAuthSession, patch: Record<string, unknown> = {}): Promise<CloudAccountProfile> {
    const baseRow = {
      user_id: session.user.id,
      email: session.user.email,
      display_name: session.user.fullName ?? session.user.email.split("@")[0] ?? "",
      updated_at: new Date().toISOString(),
      ...patch
    };
    await this.upsert("hermills_accounts", [baseRow], session.accessToken, "user_id").catch(async () => {
      const legacyRow: Record<string, unknown> = { ...baseRow };
      delete legacyRow.nickname;
      delete legacyRow.status;
      delete legacyRow.email_verified;
      delete legacyRow.terms_accepted_at;
      delete legacyRow.last_login_at;
      delete legacyRow.last_seen_at;
      await this.upsert("hermills_accounts", [legacyRow], session.accessToken, "user_id");
    });
    return this.readAccountProfile(session.accessToken, session.user);
  }

  private async logAuthEvent(session: CloudAuthSession, eventType: string, eventData: Record<string, unknown>): Promise<void> {
    await this.insert("event_logs", [{
      user_id: session.user.id,
      event_type: eventType,
      event_data: sanitizeEventData(eventData),
      created_at: new Date().toISOString()
    }], session.accessToken);
  }

  private async isAdmin(token: string, userId: string): Promise<boolean> {
    const rows = await this.select("hermills_admins", token, [
      "select=user_id",
      `user_id=eq.${encodeURIComponent(userId)}`,
      "limit=1"
    ].join("&"));
    return rows.length > 0;
  }

  private async assertAdmin(session: CloudAuthSession): Promise<void> {
    if (await this.isAdmin(session.accessToken, session.user.id).catch(() => false)) return;
    throw new CloudError("需要管理员权限。", "CLOUD_ADMIN_REQUIRED", 403);
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) throw new CloudError("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.", "CLOUD_NOT_CONFIGURED");
  }

  private async saveSession(response: SupabaseAuthResponse): Promise<void> {
    if (!response.access_token || !response.refresh_token || !response.user?.id) {
      throw new CloudError("Supabase did not return a usable session. Confirm email verification and retry.", "CLOUD_LOGIN_FAILED");
    }
    const expiresAt = new Date(Date.now() + Math.max(60, response.expires_in ?? 3600) * 1000).toISOString();
    await this.authStore.set({
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt,
      user: {
        id: response.user.id,
        email: response.user.email ?? "",
        fullName: stringValue(response.user.user_metadata?.full_name)
      }
    });
  }

  private async authRequest(pathname: string, input: { method: string; body: unknown }): Promise<SupabaseAuthResponse> {
    const response = await this.fetchImpl(`${this.config.url}${pathname}`, {
      method: input.method,
      headers: this.authHeaders(),
      body: JSON.stringify(input.body)
    });
    const json = await response.json().catch(() => ({})) as SupabaseAuthResponse;
    if (!response.ok) {
      throw new CloudError(redactSecrets(json.error_description || json.msg || json.error || `Supabase auth failed with HTTP ${response.status}.`), "CLOUD_AUTH_FAILED");
    }
    return json;
  }

  private authHeaders(accessToken?: string): HeadersInit {
    return {
      "apikey": this.config.anonKey,
      "authorization": `Bearer ${accessToken ?? this.config.anonKey}`,
      "content-type": "application/json"
    };
  }

  private async select(table: string, token: string, query: string): Promise<Record<string, unknown>[]> {
    const response = await this.fetchImpl(`${this.config.url}/rest/v1/${table}?${query}`, {
      headers: this.authHeaders(token)
    });
    if (!response.ok) throw new CloudError(`Supabase select failed for ${table}.`, "CLOUD_DB_FAILED");
    const json = await response.json().catch(() => []);
    return Array.isArray(json) ? json as Record<string, unknown>[] : [];
  }

  private async insert(table: string, rows: Array<Record<string, unknown>>, token: string): Promise<void> {
    if (!rows.length) return;
    const response = await this.fetchImpl(`${this.config.url}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        ...this.authHeaders(token),
        "prefer": "return=minimal"
      },
      body: JSON.stringify(rows)
    });
    if (!response.ok) throw new CloudError(redactSecrets(await response.text()), "CLOUD_DB_FAILED");
  }

  private async upsert(table: string, rows: Array<Record<string, unknown>>, token: string, onConflict: string): Promise<void> {
    if (!rows.length) return;
    const response = await this.fetchImpl(`${this.config.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: {
        ...this.authHeaders(token),
        "prefer": "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(rows)
    });
    if (!response.ok) throw new CloudError(redactSecrets(await response.text()), "CLOUD_DB_FAILED");
  }

  private async patch(table: string, row: Record<string, unknown>, token: string, filter: string): Promise<Record<string, unknown>[]> {
    const response = await this.fetchImpl(`${this.config.url}/rest/v1/${table}?${filter}`, {
      method: "PATCH",
      headers: {
        ...this.authHeaders(token),
        "prefer": "return=representation"
      },
      body: JSON.stringify(row)
    });
    if (!response.ok) throw new CloudError(redactSecrets(await response.text()), "CLOUD_DB_FAILED");
    const json = await response.json().catch(() => []);
    return Array.isArray(json) ? json as Record<string, unknown>[] : [];
  }
}

type CloudConfig = {
  url: string;
  anonKey: string;
  required: boolean;
};

class CloudAuthStore {
  private readonly vault: LocalCredentialVault;
  private readonly legacyFilePath: string;
  private readonly secretRef = "credential:hermills-cloud-auth";

  constructor(baseDir?: string) {
    this.vault = new LocalCredentialVault(baseDir);
    this.legacyFilePath = path.join(path.dirname(getDataHome(baseDir)), "secure", "cloud-auth.json");
  }

  async get(): Promise<CloudAuthSession | undefined> {
    const encrypted = await this.vault.readSecret(this.secretRef);
    if (encrypted) return CloudAuthSessionSchema.parse(JSON.parse(encrypted));
    try {
      const legacy = CloudAuthSessionSchema.parse(JSON.parse(await readFile(this.legacyFilePath, "utf8")));
      await this.set(legacy);
      await unlink(this.legacyFilePath).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
      return legacy;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async set(session: CloudAuthSession): Promise<void> {
    await this.vault.saveSecret("hermills-cloud-auth", JSON.stringify(CloudAuthSessionSchema.parse(session)));
  }

  async clear(): Promise<void> {
    await this.vault.deleteSecret(this.secretRef);
    await unlink(this.legacyFilePath).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  }
}

class CloudSyncStore {
  private readonly filePath: string;

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "cloud-sync-state.json");
  }

  async get(): Promise<CloudSyncState> {
    try {
      return CloudSyncStateSchema.parse(JSON.parse(await readFile(this.filePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, syncQueued: 0, localToCloud: {} };
      throw error;
    }
  }

  async update(input: Partial<CloudSyncState>): Promise<CloudSyncState> {
    const next = CloudSyncStateSchema.parse({ ...(await this.get()), ...input, version: 1 });
    await writePrivateJson(this.filePath, next);
    return next;
  }
}

const CloudAuthSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  user: z.object({
    id: z.string().min(1),
    email: z.string().max(320),
    fullName: z.string().optional()
  })
}).strict();

const CloudSyncStateSchema = z.object({
  version: z.literal(1).default(1),
  lastSyncAt: z.string().datetime().optional(),
  syncQueued: z.number().int().nonnegative().default(0),
  learningPackVersion: z.string().optional(),
  learningRulesUpdatedAt: z.string().optional(),
  localToCloud: z.record(z.string()).default({})
}).strict();

export class CloudError extends Error {
  readonly status: number;

  constructor(message: string, readonly code: string, status?: number) {
    super(message);
    this.status = status ?? cloudErrorStatus(code);
  }
}

function cloudErrorStatus(code: string): number {
  if (code === "CLOUD_LOGIN_REQUIRED") return 401;
  if (code === "CLOUD_NOT_CONFIGURED") return 503;
  if (code === "CLOUD_AUTH_FAILED" || code === "CLOUD_LOGIN_FAILED") return 401;
  if (code === "CLOUD_DB_FAILED") return 502;
  return 400;
}

function toCloudAccountProfile(row: Record<string, unknown>, isAdmin = false): CloudAccountProfile {
  const displayName = stringValue(row.display_name);
  const nickname = stringValue(row.nickname) || displayName;
  return {
    userId: stringValue(row.user_id),
    email: stringValue(row.email),
    displayName,
    nickname,
    status: stringValue(row.status) === "disabled" ? "disabled" : "active",
    emailVerified: booleanValue(row.email_verified),
    termsAcceptedAt: stringValue(row.terms_accepted_at) || undefined,
    lastLoginAt: stringValue(row.last_login_at) || undefined,
    lastSeenAt: stringValue(row.last_seen_at) || undefined,
    createdAt: stringValue(row.created_at) || undefined,
    updatedAt: stringValue(row.updated_at) || undefined,
    isAdmin
  };
}

function sanitizeEventData(input: Record<string, unknown>): Record<string, unknown> {
  try {
    return objectValue(JSON.parse(redactSecrets(JSON.stringify(input))));
  } catch {
    return {};
  }
}

export function formatLearningPackContext(pack: CloudLearningPack): string {
  const lines = [
    "--- Hermills Learning Pack ---",
    `Version: ${pack.version}`,
    pack.userPreferences.preferredTone ? `User preferred tone: ${pack.userPreferences.preferredTone}` : "",
    pack.userPreferences.preferredCta ? `User preferred CTA style: ${pack.userPreferences.preferredCta}` : "",
    pack.userPreferences.preferredEmailLength ? `User preferred email length: ${pack.userPreferences.preferredEmailLength}` : "",
    pack.userPreferences.avoidPhrases.length ? `Avoid phrases the user often removes: ${pack.userPreferences.avoidPhrases.slice(0, 12).join("; ")}` : "",
    pack.companyRules.length ? `Company pack rules:\n${pack.companyRules.slice(0, 8).map((item) => `- ${item}`).join("\n")}` : "",
    pack.customerRules.length ? `Customer pack rules:\n${pack.customerRules.slice(0, 8).map((item) => `- ${item}`).join("\n")}` : "",
    pack.globalRules.length ? `Global anonymous learning rules:\n${pack.globalRules.slice(0, 12).map((rule) => `- ${rule.recommendation} (confidence ${Math.round(rule.confidence * 100)}%, evidence ${rule.evidenceCount})`).join("\n")}` : "",
    "Use these as private writing guidance. Do not mention Learning Pack, data collection, users, or analytics in the email."
  ].filter(Boolean);
  return lines.join("\n");
}

function defaultLearningPack(input: LearningPackInput): CloudLearningPack {
  const products = input.companyProfile.mainProducts ?? [];
  const certifications = input.companyProfile.certifications ?? [];
  return {
    version: "local-default",
    generatedAt: new Date().toISOString(),
    userPreferences: {
      preferredTone: input.companyProfile.brandVoice || "professional, warm, concise",
      avoidPhrases: ["leading manufacturer", "one-stop solution", "hope this email finds you well", "potential cooperation"],
      commonEdits: []
    },
    companyRules: [
      products.length ? `Anchor the email on one relevant product line only: ${products.slice(0, 4).join(", ")}.` : "",
      certifications.length ? `Use certifications only when directly relevant: ${certifications.slice(0, 4).join(", ")}.` : "",
      "Do not mention price, capacity, exclusive partnership, or guaranteed results unless the seller profile proves it."
    ].filter(Boolean),
    customerRules: [
      input.customerType ? `Customer type hint: ${input.customerType}.` : "",
      input.industry ? `Industry hint: ${input.industry}.` : "",
      "Open with a customer-specific observation, then one seller value point, then a light CTA."
    ].filter(Boolean),
    globalRules: [{
      ruleType: "cold_email_structure",
      condition: { channel: "first_email" },
      recommendation: "Keep the first email short, English, natural, evidence-based, and end with a low-pressure CTA such as sending 2-3 matched options.",
      confidence: 0.72,
      evidenceCount: 1
    }]
  };
}

function toSellerProfileRow(profileId: string, profile: Record<string, unknown>): Record<string, unknown> {
  return {
    source_local_id: `seller:${stableHash(profileId)}`,
    company_name: pseudonym("seller-company", stringValue(profile.name) || profileId),
    website: stringValue(profile.website) ? "[url]" : "",
    main_products: listFeatureSummary(profile.mainProducts),
    target_markets: listFeatureSummary(profile.markets),
    certifications: listFeatureSummary(profile.certifications),
    payment_terms: listFeatureSummary(profile.paymentTerms),
    shipping_terms: listFeatureSummary(profile.shippingTerms),
    brand_tone: sanitizePrivateText(stringValue(profile.brandVoice)),
    updated_at: new Date().toISOString()
  };
}

function toCustomerRow(profileId: string, lead: Record<string, unknown>): Record<string, unknown> {
  return {
    source_local_id: `lead:${stableHash(`${profileId}:${stringValue(lead.id)}`)}`,
    company_name: pseudonym("customer-company", stringValue(lead.companyName) || stringValue(lead.id)),
    website: stringValue(lead.website) ? "[url]" : "",
    country: sanitizePrivateText(stringValue(lead.country)),
    customer_type: sanitizePrivateText(nestedString(lead.leadFitScore, "customerType")),
    industry: sanitizePrivateText(stringValue(lead.industry)),
    main_products: "",
    channel_type: "",
    fit_score: sanitizePrivateText(nestedString(lead.leadFitScore, "score")),
    recommended_angle: sanitizePrivateText(nestedString(lead.leadFitScore, "primaryAngle")),
    updated_at: new Date().toISOString(),
    local_profile_id: stableHash(`profile:${profileId}`)
  };
}

function toEmailGenerationRow(profileId: string, draft: Record<string, unknown>): Record<string, unknown> {
  const subject = stringValue(draft.subject);
  const body = stringValue(draft.body);
  return {
    source_local_id: `draft:${stableHash(`${profileId}:${stringValue(draft.id)}`)}`,
    local_customer_id: stableHash(`${profileId}:${stringValue(draft.leadId)}`),
    subject: patternizeSubject(subject),
    email_body: JSON.stringify(summarizeEmailForCloudLearning(subject, body)),
    angle: sanitizePrivateText(nestedString(draft.strategyMatch, "selectedUsp") || nestedString(draft.leadFitScore, "primaryAngle")),
    cta_type: sanitizePrivateText(nestedString(draft.valueMatch, "cta")),
    customer_type: sanitizePrivateText(nestedString(draft.learningSignal, "customerType")),
    fit_score: sanitizePrivateText(nestedString(draft.leadFitScore, "score")),
    ai_score: nestedNumber(draft.qualityReview, "score"),
    risk_score: riskScore(draft.sendRiskReview),
    prompt_version: stringValue(draft.writingEngine),
    model_name: stringValue(draft.modelUsed) || stringValue(draft.model),
    local_profile_id: stableHash(`profile:${profileId}`),
    created_at: stringValue(draft.createdAt) || new Date().toISOString()
  };
}

function toLearningEventRow(profileId: string, draft: Record<string, unknown>): Record<string, unknown> | undefined {
  const signal = objectValue(draft.learningSignal);
  const subject = stringValue(signal.subject) || stringValue(draft.subject);
  if (!subject) return undefined;
  const sourceLocalId = `draft:${stableHash(`${profileId}:${stringValue(draft.id)}`)}`;
  return {
    event_key: `learning:${sourceLocalId}`,
    source_type: "draft",
    source_local_id: sourceLocalId,
    local_profile_id: stableHash(`profile:${profileId}`),
    industry: stringValue(signal.customerIndustry),
    customer_type: stringValue(signal.customerType) || nestedString(draft.leadFitScore, "customerType"),
    country_region: stringValue(signal.customerCountry),
    development_angle: stringValue(signal.developmentAngle) || nestedString(draft.leadFitScore, "primaryAngle"),
    subject_pattern: patternizeSubject(subject),
    cta_type: stringValue(signal.cta),
    email_word_count: Math.round(numberValue(signal.emailWordCount)),
    quality_score: nestedNumber(draft.qualityReview, "score"),
    user_edited: false,
    sent: stringValue(draft.status) === "sent",
    replied: stringValue(signal.replyOutcome) === "positive" || stringValue(signal.replyOutcome) === "referral",
    bounced: stringValue(draft.status) === "failed",
    reply_type: stringValue(signal.replyOutcome),
    created_at: new Date().toISOString()
  };
}

function toRedactedEventRow(profileId: string, event: Record<string, unknown>): Record<string, unknown> {
  const sourceLocalId = stringValue(event.source_local_id) || stringValue(event.event_key) || stableHash(JSON.stringify(event));
  return {
    local_profile_id: stableHash(`profile:${profileId}`),
    source_type: stringValue(event.source_type) || "draft",
    source_local_id: sourceLocalId,
    event_type: "learning_signal",
    schema_version: 1,
    redaction_version: "hermills-cloud-v2",
    redaction_status: "aggregate_only",
    payload_hash: stableHash(JSON.stringify(event)),
    redacted_payload: {
      subjectPattern: stringValue(event.subject_pattern),
      ctaType: stringValue(event.cta_type),
      developmentAngle: stringValue(event.development_angle),
      emailWordCount: Math.round(numberValue(event.email_word_count)),
      qualityScore: numberValue(event.quality_score),
      sent: Boolean(event.sent),
      replied: Boolean(event.replied),
      bounced: Boolean(event.bounced)
    },
    pii_detected: { rawTextUploaded: false },
    customer_type: sanitizePrivateText(stringValue(event.customer_type)),
    industry: sanitizePrivateText(stringValue(event.industry)),
    country_region: sanitizePrivateText(stringValue(event.country_region)),
    development_angle: sanitizePrivateText(stringValue(event.development_angle)),
    subject_pattern: patternizeSubject(stringValue(event.subject_pattern)),
    cta_type: sanitizePrivateText(stringValue(event.cta_type)),
    first_line_type: sanitizePrivateText(stringValue(event.first_line_type)),
    value_point_pattern: sanitizePrivateText(stringValue(event.value_point_pattern)),
    email_word_count: Math.round(numberValue(event.email_word_count)),
    quality_score: numberValue(event.quality_score),
    sent: Boolean(event.sent),
    replied: Boolean(event.replied),
    bounced: Boolean(event.bounced),
    reply_type: sanitizePrivateText(stringValue(event.reply_type)),
    occurred_at: stringValue(event.created_at) || new Date().toISOString(),
    recorded_at: new Date().toISOString()
  };
}

function patternizeSubject(value: string): string {
  return sanitizePrivateText(value)
    .replace(/\b\d+(?:[.,]\d+)?\b/g, "{number}")
    .replace(/\b[A-Z][A-Za-z0-9&.-]{2,}\b/g, "{name}")
    .slice(0, 160);
}

function sanitizePrivateText(value: string): string {
  return redactSecrets(value)
    .replace(EMAIL_RE, "[email]")
    .replace(URL_RE, "[url]")
    .replace(BARE_DOMAIN_RE, "[domain]")
    .replace(SECRET_RE, "[secret]")
    .trim();
}

function summarizeEmailForCloudLearning(subject: string, body: string): Record<string, unknown> {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return {
    redaction: "body_not_uploaded",
    subjectPattern: patternizeSubject(subject),
    wordCount: wordCount(body),
    lineCount: lines.length,
    hasQuestion: /\?/.test(body),
    hasSignature: /\b(?:regards|best|sincerely|thanks|thank you)\b/i.test(body),
    firstLineType: classifyFirstLine(lines[0] ?? "")
  };
}

function classifyFirstLine(value: string): string {
  const text = value.toLowerCase();
  if (!text) return "empty";
  if (text.includes("i noticed") || text.includes("saw that") || text.includes("noticed")) return "customer_observation";
  if (text.includes("hope")) return "generic_greeting";
  if (text.includes("congrats") || text.includes("congratulations")) return "trigger_event";
  return "direct";
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function listFeatureSummary(value: unknown): string {
  const items = stringArray(value);
  return items.length ? `item_count:${items.length}` : "";
}

function pseudonym(label: string, value: string): string {
  return value ? `[${label}:${stableHash(value).slice(0, 10)}]` : "";
}

function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type NormalizedLearningEvent = {
  profileKey: string;
  customerType: string;
  industry: string;
  countryRegion: string;
  developmentAngle: string;
  subjectPattern: string;
  ctaType: string;
  emailWordCount: number;
  qualityScore: number;
  sent: boolean;
  replied: boolean;
  bounced: boolean;
};

function normalizeLearningEventForRules(row: Record<string, unknown>): NormalizedLearningEvent {
  const payload = objectValue(row.redacted_payload);
  return {
    profileKey: stringValue(row.local_profile_id),
    customerType: sanitizePrivateText(stringValue(row.customer_type)),
    industry: sanitizePrivateText(stringValue(row.industry)),
    countryRegion: sanitizePrivateText(stringValue(row.country_region)),
    developmentAngle: sanitizePrivateText(stringValue(row.development_angle)),
    subjectPattern: patternizeSubject(stringValue(row.subject_pattern) || stringValue(payload.subjectPattern)),
    ctaType: sanitizePrivateText(stringValue(row.cta_type) || stringValue(payload.ctaType)),
    emailWordCount: Math.round(numberValue(row.email_word_count) || numberValue(payload.emailWordCount)),
    qualityScore: numberValue(row.quality_score) || numberValue(payload.qualityScore),
    sent: booleanValue(row.sent) || booleanValue(payload.sent),
    replied: booleanValue(row.replied) || booleanValue(payload.replied),
    bounced: booleanValue(row.bounced) || booleanValue(payload.bounced)
  };
}

function buildLearningRuleCandidates(events: NormalizedLearningEvent[], windowDays: number, minEvidence: number): CloudLearningRuleCandidate[] {
  const sentEvents = events.filter((event) => event.sent || event.replied || event.bounced);
  const baseline = rate(sentEvents.filter((event) => event.replied).length, sentEvents.length);
  const groups = new Map<string, NormalizedLearningEvent[]>();
  for (const event of sentEvents) {
    const customerType = event.customerType || "unknown";
    const industry = event.industry || "unknown";
    for (const dimension of ["cta", "angle", "length"] as const) {
      const value = dimension === "cta"
        ? event.ctaType
        : dimension === "angle"
          ? event.developmentAngle
          : wordBucket(event.emailWordCount);
      if (!value) continue;
      const key = `${dimension}|${customerType}|${industry}|${value}`;
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }
  }
  const rules: CloudLearningRuleCandidate[] = [];
  for (const [key, group] of groups) {
    if (group.length < minEvidence) continue;
    const [dimension, customerType, industry, value] = key.split("|");
    const sent = group.length;
    const replied = group.filter((event) => event.replied).length;
    const bounced = group.filter((event) => event.bounced).length;
    const replyRate = rate(replied, sent);
    const bounceRate = rate(bounced, sent);
    const lift = replyRate - baseline;
    const quality = average(group.map((event) => event.qualityScore).filter((score) => score > 0)) / 100;
    if (lift < 0.03 && replyRate < 0.08 && quality < 0.72) continue;
    const ruleType = dimension === "cta" ? "cta_preference" : dimension === "angle" ? "angle_preference" : "email_length";
    const condition = {
      channel: "outreach",
      customerType,
      industry,
      ...(dimension === "cta" ? { ctaType: value } : {}),
      ...(dimension === "angle" ? { developmentAngle: value } : {}),
      ...(dimension === "length" ? { emailLength: value } : {})
    };
    rules.push({
      scope: "user",
      ruleType,
      ruleKey: stableHash(`${ruleType}:${JSON.stringify(condition)}`).slice(0, 32),
      condition,
      recommendation: recommendationForRule(ruleType, customerType, industry, value, replyRate, lift),
      confidence: Math.max(0.1, Math.min(0.95, 0.45 + lift * 2 + Math.min(0.25, group.length / 100) + quality * 0.15 - bounceRate * 0.4)),
      evidenceCount: sent,
      stats: { sent, replied, bounced, replyRate, bounceRate, baselineReplyRate: baseline, lift, windowDays }
    });
  }
  return rules.sort((a, b) => b.confidence - a.confidence).slice(0, 24);
}

function recommendationForRule(ruleType: string, customerType: string, industry: string, value: string, replyRate: number, lift: number): string {
  const audience = `${customerType === "unknown" ? "this customer type" : customerType}${industry === "unknown" ? "" : ` in ${industry}`}`;
  const percent = Math.round(replyRate * 100);
  const liftText = lift > 0 ? `, about ${Math.round(lift * 100)} points above baseline` : "";
  if (ruleType === "cta_preference") return `For ${audience}, prefer CTA style "${value}" because it has shown a ${percent}% reply rate${liftText}.`;
  if (ruleType === "angle_preference") return `For ${audience}, lead with development angle "${value}" when evidence supports it; it has shown a ${percent}% reply rate${liftText}.`;
  return `For ${audience}, keep the first email in the "${value}" length range; it has shown a ${percent}% reply rate${liftText}.`;
}

function wordBucket(value: number): string {
  if (!value) return "";
  if (value <= 70) return "very_short";
  if (value <= 120) return "short";
  if (value <= 180) return "medium";
  return "long";
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function average(values: number[]): number {
  const filtered = values.filter((value) => Number.isFinite(value));
  return filtered.length ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : 0;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function riskScore(value: unknown): number {
  const obj = objectValue(value);
  const risk = stringValue(obj.overallRisk);
  if (risk === "high") return 90;
  if (risk === "medium") return 55;
  if (risk === "low") return 15;
  return 0;
}

function nestedString(source: unknown, key: string): string {
  return stringValue(objectValue(source)[key]);
}

function nestedNumber(source: unknown, key: string): number {
  return numberValue(objectValue(source)[key]);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(stringValue).filter(Boolean);
}

function sanitizedStringArray(value: unknown): string[] {
  return stringArray(value).map(sanitizePrivateText).filter(Boolean);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function ensurePrivateDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
  await chmod(dirPath, 0o700).catch(() => undefined);
}

async function writePrivateJson(filePath: string, value: unknown): Promise<void> {
  await ensurePrivateDirectory(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${createHash("sha1").update(filePath).digest("hex").slice(0, 8)}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(tmpPath, filePath);
  await chmod(filePath, 0o600).catch(() => undefined);
}
