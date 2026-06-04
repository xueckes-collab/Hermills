import { z } from "zod";

export const CapabilitySchema = z.object({
  memory: z.boolean().default(false),
  files: z.boolean().default(true),
  tools: z.boolean().default(false),
  approvals: z.enum(["never", "on-demand", "always"]).default("on-demand")
}).strict();

export const KnowledgeFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(180),
  path: z.string().min(1),
  size: z.number().int().nonnegative(),
  mimeType: z.string().default("application/octet-stream"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  source: z.enum(["upload", "local-file", "generated"]).default("upload"),
  addedAt: z.string().datetime()
}).strict();

export const MaterialExtractionStateSchema = z.enum(["stored", "extracting", "indexed", "failed"]);
export const MaterialScopeSchema = z.enum(["personal", "company"]);
export const CompanyMaterialCategorySchema = z.enum([
  "company-profile",
  "product-catalog",
  "price-list",
  "certification",
  "shipping-logistics",
  "payment-terms",
  "faq",
  "case-study",
  "other"
]);

export const MaterialRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(180),
  folder: z.string().min(1).max(160).optional(),
  scope: MaterialScopeSchema.default("personal"),
  category: CompanyMaterialCategorySchema.optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(24).default([]),
  description: z.string().trim().max(1000).optional(),
  path: z.string().min(1).optional(),
  mimeType: z.string().default("application/octet-stream"),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  extractionState: MaterialExtractionStateSchema.default("stored"),
  textPreview: z.string().optional(),
  extractionError: z.string().max(500).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional()
}).strict();

export const AgentDefinitionSchema = z.object({
  version: z.literal(1).default(1),
  id: z.string().min(1),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().min(2).max(80),
  description: z.string().max(240).default(""),
  instructions: z.string().min(1).max(20000),
  starters: z.array(z.string().min(1).max(160)).max(8).default([]),
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).max(100).optional(),
  capabilities: CapabilitySchema.default({}),
  knowledge: z.array(KnowledgeFileSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const ProviderApiKeyInputSchema = z.object({
  providerId: z.string().min(1).optional(),
  apiKey: z.string().min(1)
}).strict();

export const ProviderCredentialSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["openai-compatible", "openai", "anthropic", "local"]),
  displayName: z.string().min(2).max(80),
  baseUrl: z.string().url().optional(),
  defaultModel: z.string().min(1).max(100).optional(),
  credentialRef: z.string().min(1).optional(),
  keyPreview: z.string().optional(),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

const OptionalTrimmedString = (maxLength: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).max(maxLength).optional()
);

const CompanyTextListSchema = z.array(z.string().trim().min(1).max(180)).max(60).default([]);

export const CompanyProfileSchema = z.object({
  version: z.literal(1).default(1),
  name: z.string().trim().max(160).default(""),
  legalName: OptionalTrimmedString(180),
  website: OptionalTrimmedString(500),
  markets: CompanyTextListSchema,
  mainProducts: CompanyTextListSchema,
  certifications: CompanyTextListSchema,
  paymentTerms: CompanyTextListSchema,
  shippingTerms: CompanyTextListSchema,
  brandVoice: z.string().trim().max(2000).default(""),
  notes: z.string().trim().max(8000).default(""),
  updatedAt: z.string().datetime().optional()
}).strict();

export const CompanyProfileUpdateSchema = CompanyProfileSchema.omit({ version: true, updatedAt: true }).partial().strict();

export const OnboardingLanguageSchema = z.enum(["zh-CN", "zh-TW", "ja", "ko", "en"]);
export const OnboardingThemeSchema = z.enum(["warm", "night", "plain", "system"]);

export const OnboardingProviderInputSchema = z.object({
  id: z.string().min(1).optional(),
  kind: ProviderCredentialSchema.shape.kind.default("openai-compatible"),
  displayName: z.string().trim().min(2).max(80),
  baseUrl: OptionalTrimmedString(500).pipe(z.string().url().optional()),
  defaultModel: OptionalTrimmedString(100),
  apiKey: OptionalTrimmedString(4000),
  enabled: z.boolean().default(true)
}).strict();

export const OnboardingProviderStateSchema = OnboardingProviderInputSchema.omit({ apiKey: true }).extend({
  keyPreview: z.string().optional()
}).strict();

export const OnboardingStateSchema = z.object({
  version: z.literal(1).default(1),
  language: OnboardingLanguageSchema.default("zh-CN"),
  userDisplayName: z.string().trim().max(80).default(""),
  agentName: z.string().trim().max(80).default("Hermes"),
  memoryEnabled: z.boolean().default(false),
  theme: OnboardingThemeSchema.default("warm"),
  workspacePath: OptionalTrimmedString(1000),
  provider: OnboardingProviderStateSchema.optional(),
  onboardingCompletedAt: z.string().datetime().optional(),
  defaultAgentId: z.string().min(1).optional()
}).strict();

export const OnboardingUpdateSchema = OnboardingStateSchema.omit({
  version: true,
  onboardingCompletedAt: true,
  provider: true
}).partial().extend({
  onboardingCompletedAt: z.string().datetime().nullable().optional(),
  provider: OnboardingProviderInputSchema.nullable().optional()
}).strict();

export const RuntimeStatusSchema = z.object({
  platform: z.string(),
  arch: z.string(),
  installed: z.boolean(),
  state: z.enum(["not-installed", "checking", "downloading", "installing", "configuring", "starting", "verifying", "ready", "needs-user-action", "failed"]).optional(),
  version: z.string().optional(),
  latestVersion: z.string().optional(),
  updateAvailable: z.boolean().optional(),
  executablePath: z.string().optional(),
  runtimeHome: z.string(),
  hermesHome: z.string().optional(),
  installerUrl: z.string().url().optional(),
  installMetadata: z.object({
    installedAt: z.string().datetime(),
    sourceUrl: z.string().url(),
    installerUrl: z.string().url(),
    licenseUrl: z.string().url(),
    latestReleaseTag: z.string().optional(),
    latestReleaseName: z.string().optional(),
    executablePath: z.string().optional(),
    version: z.string().optional()
  }).strict().optional(),
  gateway: z.object({
    state: z.enum(["stopped", "starting", "running", "failed"]),
    pid: z.number().int().positive().optional(),
    apiBaseUrl: z.string().url().optional(),
    message: z.string().optional()
  }).optional(),
  checks: z.array(z.object({ id: z.string(), label: z.string(), ok: z.boolean(), detail: z.string().optional() }).strict()),
  activeInstallJob: z.string().optional()
}).strict();

export const AppStateSchema = z.object({
  version: z.literal(1).default(1),
  firstDeployHidden: z.boolean().default(false),
  localDeployCompletedAt: z.string().datetime().optional(),
  lastSuccessfulRuntimeVersion: z.string().optional(),
  lastSuccessfulGatewayAt: z.string().datetime().optional()
}).strict();

export const InstallRequestSchema = z.object({
  channel: z.enum(["official-docs-latest"]).default("official-docs-latest"),
  dryRun: z.boolean().default(false),
  force: z.boolean().default(false),
  skipBrowser: z.boolean().default(true),
  installerUrl: z.string().url().optional(),
  licenseUrl: z.string().url().optional(),
  installerSha256: z.string().regex(/^[a-f0-9]{64}$/).optional()
}).strict();

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative().default(0),
    outputTokens: z.number().int().nonnegative().default(0),
    totalTokens: z.number().int().nonnegative().default(0),
    estimatedCostUsd: z.number().nonnegative().optional()
  }).strict().optional(),
  createdAt: z.string().datetime()
}).strict();

export const ChatSessionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  agentId: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  messages: z.array(ChatMessageSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const UsageEstimateSchema = z.object({
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  estimatedCostUsd: z.number().nonnegative().optional()
}).strict();

export const JobStatusSchema = z.enum(["active", "paused"]);
export const JobRunStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "skipped"]);
export const JobRunTriggerSchema = z.enum(["manual", "schedule"]);

export const JobScheduleSchema = z.object({
  expression: z.string().min(1).max(120),
  timezone: z.string().min(1).max(80).default("Asia/Shanghai")
}).strict();

export const JobTaskSchema = z.object({
  type: z.literal("chat-prompt").default("chat-prompt"),
  prompt: z.string().min(1).max(20000),
  agentId: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).max(100).optional(),
  materialIds: z.array(z.string().min(1)).max(12).default([])
}).strict();

export const JobRecordSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  schedule: JobScheduleSchema,
  status: JobStatusSchema.default("active"),
  task: JobTaskSchema,
  nextRunAt: z.string().datetime().optional(),
  lastRunAt: z.string().datetime().optional(),
  deletedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const JobRunRecordSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  jobId: z.string().min(1),
  trigger: JobRunTriggerSchema,
  status: JobRunStatusSchema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  input: z.string().max(20000).optional(),
  outputPreview: z.string().max(4000).optional(),
  error: z.string().max(1000).optional(),
  usage: UsageEstimateSchema.optional(),
  model: z.string().min(1).max(100).optional(),
  providerId: z.string().min(1).optional()
}).strict();

export const ChannelKindSchema = z.enum(["telegram", "discord", "slack", "whatsapp", "matrix", "feishu", "wechat", "wecom"]);
export const ChannelStatusSchema = z.enum(["disabled", "needs-setup", "connected", "failed"]);

export const ChannelRecordSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  kind: ChannelKindSchema,
  label: z.string().min(1).max(120),
  enabled: z.boolean().default(false),
  status: ChannelStatusSchema.default("needs-setup"),
  endpoint: z.string().url().optional(),
  secretRef: z.string().min(1).optional(),
  secretPreview: z.string().optional(),
  config: z.record(z.unknown()).default({}),
  lastTestedAt: z.string().datetime().optional(),
  lastError: z.string().max(1000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const LogLevelSchema = z.enum(["debug", "info", "warn", "error", "done"]);
export const LogSourceSchema = z.enum(["server", "job", "channel", "gateway", "install"]);

export const LogEntrySchema = z.object({
  id: z.string().min(1),
  source: LogSourceSchema,
  fileId: z.string().optional(),
  line: z.number().int().positive().optional(),
  level: LogLevelSchema,
  message: z.string(),
  createdAt: z.string().datetime().optional()
}).strict();

export type InstallRequest = z.infer<typeof InstallRequestSchema>;
export type OnboardingProviderInput = z.infer<typeof OnboardingProviderInputSchema>;
export type OnboardingProviderState = z.infer<typeof OnboardingProviderStateSchema>;
export type OnboardingState = z.infer<typeof OnboardingStateSchema>;
export type OnboardingUpdate = z.infer<typeof OnboardingUpdateSchema>;
