import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { LocalCredentialVault } from "@hermills/agent-builder";
import { getDataHome, redactSecrets } from "@hermills/core";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\bhttps?:\/\/[^\s"'<>]+/gi;
const SECRET_RE = /\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|[A-Za-z0-9_-]{32,})\b/g;

export const CloudAuthBodySchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(200),
  fullName: z.string().trim().max(160).optional()
}).strict();

export const CloudEmailBodySchema = z.object({
  email: z.string().trim().email().max(320)
}).strict();

export const CloudSyncBodySchema = z.object({
  force: z.boolean().default(false)
}).strict();

export type CloudUser = {
  id: string;
  email: string;
  fullName?: string;
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
  expiresAt?: string;
  cloudUrl?: string;
  lastSyncAt?: string;
  syncQueued: number;
  learningPackVersion?: string;
  message: string;
};

type CloudSyncState = {
  version: 1;
  lastSyncAt?: string;
  syncQueued: number;
  learningPackVersion?: string;
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
    const [session, sync] = await Promise.all([this.authStore.get(), this.syncStore.get()]);
    if (!this.isConfigured()) {
      return {
        configured: false,
        required: this.config.required,
        authenticated: false,
        syncQueued: sync.syncQueued,
        lastSyncAt: sync.lastSyncAt,
        message: "Hermills Cloud is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY before publishing."
      };
    }
    return {
      configured: true,
      required: this.config.required,
      authenticated: Boolean(session?.accessToken),
      user: session?.user,
      expiresAt: session?.expiresAt,
      cloudUrl: this.config.url,
      syncQueued: sync.syncQueued,
      lastSyncAt: sync.lastSyncAt,
      learningPackVersion: sync.learningPackVersion,
      message: session?.accessToken ? "Hermills Cloud is connected." : "Sign in to enable cloud memory and Learning Pack."
    };
  }

  async signUp(input: z.infer<typeof CloudAuthBodySchema>): Promise<CloudStatus> {
    this.assertConfigured();
    const response = await this.authRequest("/auth/v1/signup", {
      method: "POST",
      body: {
        email: input.email,
        password: input.password,
        data: { full_name: input.fullName ?? "" }
      }
    });
    if (response.access_token) await this.saveSession(response);
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
    return this.status();
  }

  async logout(): Promise<CloudStatus> {
    const session = await this.authStore.get();
    if (session?.accessToken && this.isConfigured()) {
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
    await this.insert("learning_events", learningEvents, session.accessToken);
    await this.insert("event_logs", [{
      event_type: "cloud_sync",
      event_data: {
        profileId: snapshot.profileId,
        leads: snapshot.leads.length,
        drafts: snapshot.drafts.length,
        workflows: snapshot.workflows.length,
        campaigns: snapshot.campaigns.length,
        feedback: snapshot.feedback.length
      },
      created_at: now
    }], session.accessToken);
    await this.syncStore.update({ lastSyncAt: now, syncQueued: 0 });
    return this.status();
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
    source_local_id: `seller:${profileId}`,
    company_name: sanitizePrivateText(stringValue(profile.name)),
    website: sanitizePrivateText(stringValue(profile.website)),
    main_products: sanitizedStringArray(profile.mainProducts).join("\n"),
    target_markets: sanitizedStringArray(profile.markets).join("\n"),
    certifications: sanitizedStringArray(profile.certifications).join("\n"),
    payment_terms: sanitizedStringArray(profile.paymentTerms).join("\n"),
    shipping_terms: sanitizedStringArray(profile.shippingTerms).join("\n"),
    brand_tone: sanitizePrivateText(stringValue(profile.brandVoice)),
    updated_at: new Date().toISOString()
  };
}

function toCustomerRow(profileId: string, lead: Record<string, unknown>): Record<string, unknown> {
  return {
    source_local_id: `lead:${stringValue(lead.id)}`,
    company_name: sanitizePrivateText(stringValue(lead.companyName)),
    website: sanitizePrivateText(stringValue(lead.website)),
    country: sanitizePrivateText(stringValue(lead.country)),
    customer_type: sanitizePrivateText(nestedString(lead.leadFitScore, "customerType")),
    industry: sanitizePrivateText(stringValue(lead.industry)),
    main_products: "",
    channel_type: "",
    fit_score: sanitizePrivateText(nestedString(lead.leadFitScore, "score")),
    recommended_angle: sanitizePrivateText(nestedString(lead.leadFitScore, "primaryAngle")),
    updated_at: new Date().toISOString(),
    local_profile_id: profileId
  };
}

function toEmailGenerationRow(profileId: string, draft: Record<string, unknown>): Record<string, unknown> {
  return {
    source_local_id: `draft:${stringValue(draft.id)}`,
    local_customer_id: stringValue(draft.leadId),
    subject: sanitizePrivateText(stringValue(draft.subject)),
    email_body: sanitizePrivateText(stringValue(draft.body)).slice(0, 20000),
    angle: sanitizePrivateText(nestedString(draft.strategyMatch, "selectedUsp") || nestedString(draft.leadFitScore, "primaryAngle")),
    cta_type: sanitizePrivateText(nestedString(draft.valueMatch, "cta")),
    customer_type: sanitizePrivateText(nestedString(draft.learningSignal, "customerType")),
    fit_score: sanitizePrivateText(nestedString(draft.leadFitScore, "score")),
    ai_score: nestedNumber(draft.qualityReview, "score"),
    risk_score: riskScore(draft.sendRiskReview),
    prompt_version: stringValue(draft.writingEngine),
    model_name: stringValue(draft.modelUsed) || stringValue(draft.model),
    local_profile_id: profileId,
    created_at: stringValue(draft.createdAt) || new Date().toISOString()
  };
}

function toLearningEventRow(profileId: string, draft: Record<string, unknown>): Record<string, unknown> | undefined {
  const signal = objectValue(draft.learningSignal);
  const subject = stringValue(signal.subject) || stringValue(draft.subject);
  if (!subject) return undefined;
  return {
    local_profile_id: profileId,
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
    .replace(SECRET_RE, "[secret]")
    .trim();
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
