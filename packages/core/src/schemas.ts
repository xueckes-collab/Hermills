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

export const OutreachLeadSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  companyName: z.string().trim().min(1).max(180),
  website: OptionalTrimmedString(500),
  country: OptionalTrimmedString(120),
  industry: OptionalTrimmedString(160),
  contactName: OptionalTrimmedString(160),
  contactTitle: OptionalTrimmedString(160),
  email: OptionalTrimmedString(320),
  need: z.string().trim().max(2000).default(""),
  notes: z.string().trim().max(4000).default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(24).default([]),
  source: z.string().trim().min(1).max(64).default("manual"),
  status: z.enum(["new", "email_drafted", "followup_drafted", "email_sent", "contacted", "reply_received", "followup_due"]).default("new"),
  currentState: z.enum(["input_ready", "waiting_user_send", "waiting_user_send_followup", "waiting_response_status", "drafting_reply_email"]).default("input_ready"),
  replyStatus: z.enum(["not_checked", "checking", "no_reply", "reply_received", "bounced", "unsubscribed"]).default("not_checked"),
  statusColor: z.enum(["slate", "blue", "amber", "green", "rose", "violet"]).default("slate"),
  currentRound: z.number().int().min(0).max(9).default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const OutreachDraftStatusSchema = z.enum(["draft", "sent", "failed"]);
export const OutreachGenerationModeSchema = z.enum(["lite", "deep"]);

export const OutreachEvidenceLevelSchema = z.enum(["verified", "inferred", "generic", "prohibited"]);

export const OutreachEvidenceItemSchema = z.object({
  id: z.string().min(1),
  level: OutreachEvidenceLevelSchema,
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(800),
  source: z.enum(["lead", "website", "company-profile", "material", "model", "user"]).default("lead"),
  sourceUrl: z.string().trim().max(1000).optional(),
  snippet: z.string().trim().max(1000).default(""),
  usedInEmail: z.boolean().default(false)
}).strict();

export const OutreachEvidenceMapSchema = z.object({
  status: z.enum(["success", "need_more_data"]).default("success"),
  minimumDataAvailable: z.boolean().default(false),
  verifiedFacts: z.array(OutreachEvidenceItemSchema).max(24).default([]),
  inferredInsights: z.array(OutreachEvidenceItemSchema).max(24).default([]),
  genericContext: z.array(OutreachEvidenceItemSchema).max(12).default([]),
  prohibitedClaims: z.array(OutreachEvidenceItemSchema).max(12).default([]),
  missingFields: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  createdAt: z.string().datetime().optional()
}).strict();

export const OutreachCtaAssetTypeSchema = z.enum([
  "catalog",
  "sample_options",
  "spec_comparison",
  "moq_leadtime_sheet",
  "case_study",
  "certification_pack",
  "packaging_options",
  "quote_range",
  "custom"
]);

export const OutreachCtaAssetSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(160),
  type: OutreachCtaAssetTypeSchema.default("custom"),
  description: z.string().trim().max(1000).default(""),
  assetText: z.string().trim().max(8000).default(""),
  materialId: z.string().min(1).optional(),
  url: z.string().trim().max(1000).optional(),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const OutreachBuyerPersonaSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(160),
  companyType: z.string().trim().max(160).default(""),
  buyerRoles: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  painPoints: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  successMetrics: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  objections: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  triggerEvents: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  evidenceNotes: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const OutreachUspCandidateSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  category: z.string().trim().max(80).default("Strategic value"),
  headline: z.string().trim().min(1).max(180),
  buyerAngle: z.string().trim().max(800).default(""),
  proof: z.string().trim().max(800).default(""),
  proofLevel: z.enum(["verified", "profile-derived", "needs-proof"]).default("needs-proof"),
  assetIds: z.array(z.string().min(1)).max(12).default([]),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const OutreachGoldenExampleSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(180),
  industry: z.string().trim().max(160).default(""),
  buyerType: z.string().trim().max(160).default(""),
  productLine: z.string().trim().max(180).default(""),
  market: z.string().trim().max(120).default(""),
  subject: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(12000),
  tags: z.array(z.string().trim().min(1).max(80)).max(16).default([]),
  sourceDraftId: z.string().min(1).optional(),
  qualityScore: z.number().int().min(0).max(100).optional(),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const OutreachStrategyMatchSchema = z.object({
  personaId: z.string().min(1).optional(),
  uspId: z.string().min(1).optional(),
  ctaAssetId: z.string().min(1).optional(),
  buyerPain: z.string().trim().max(800).default(""),
  buyerImplication: z.string().trim().max(800).default(""),
  selectedUsp: z.string().trim().max(300).default(""),
  microOffer: z.string().trim().max(300).default(""),
  rationale: z.string().trim().max(1200).default(""),
  confidenceScore: z.number().int().min(0).max(100).default(0),
  evidenceIds: z.array(z.string().min(1)).max(12).default([]),
  warnings: z.array(z.string().trim().min(1).max(300)).max(12).default([])
}).strict();

export const OutreachSendRiskIssueSchema = z.object({
  id: z.string().trim().min(1).max(80),
  severity: z.enum(["info", "warning", "block"]),
  message: z.string().trim().min(1).max(500),
  blocking: z.boolean().default(false)
}).strict();

export const OutreachSendRiskReviewSchema = z.object({
  score: z.number().int().min(0).max(100),
  passed: z.boolean(),
  level: z.enum(["pass", "warning", "blocked"]),
  issues: z.array(OutreachSendRiskIssueSchema).max(20).default([]),
  checkedAt: z.string().datetime()
}).strict();

export const OutreachEmailQualityCheckSchema = z.object({
  id: z.enum(["buyerReason", "humanTone", "personalized", "nextStep", "twoSecondRead"]),
  label: z.string().trim().min(1).max(120),
  passed: z.boolean(),
  score: z.number().int().min(0).max(20),
  message: z.string().trim().max(400).default("")
}).strict();

export const OutreachEmailQualityReviewSchema = z.object({
  score: z.number().int().min(0).max(100),
  passed: z.boolean(),
  level: z.enum(["pass", "needs-work", "blocked"]),
  summary: z.string().trim().max(500).default(""),
  checks: z.array(OutreachEmailQualityCheckSchema).length(5),
  issues: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  rewriteHints: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  reviewedAt: z.string().datetime()
}).strict();

export const OutreachDraftSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
  status: OutreachDraftStatusSchema.default("draft"),
  subject: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(20000),
  language: z.string().trim().min(1).max(80).default("English"),
  tone: z.string().trim().min(1).max(120).default("professional"),
  generationMode: OutreachGenerationModeSchema.default("deep"),
  promptSnapshot: z.string().trim().max(30000).default(""),
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).max(100).optional(),
  usage: UsageEstimateSchema.optional(),
  qualityReview: OutreachEmailQualityReviewSchema.optional(),
  evidenceMap: OutreachEvidenceMapSchema.optional(),
  strategyMatch: OutreachStrategyMatchSchema.optional(),
  sendRiskReview: OutreachSendRiskReviewSchema.optional(),
  writingEngine: z.enum(["legacy-chat", "harness-v2"]).default("legacy-chat"),
  modelUsed: z.string().trim().min(1).max(120).optional(),
  rewriteAttempts: z.number().int().min(0).max(5).default(0),
  evidenceUsed: z.array(OutreachEvidenceItemSchema).max(12).default([]),
  matchedExampleIds: z.array(z.string().min(1)).max(8).default([]),
  generationSummary: z.string().trim().max(2000).default(""),
  sentAt: z.string().datetime().optional(),
  sendError: z.string().max(1000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const OutreachSendChannelSchema = z.enum(["smtp", "oauth-api", "service-api"]);

export const OutreachSenderApiCredentialSchema = z.object({
  credentialRef: z.string().min(1).optional(),
  credentialPreview: z.string().optional(),
  accountId: OptionalTrimmedString(240),
  apiBaseUrl: OptionalTrimmedString(500),
  scopes: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  expiresAt: z.string().datetime().optional()
}).strict();

export const OutreachSenderAccountSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(120),
  provider: z.string().trim().min(1).max(80).default("custom"),
  sendChannel: OutreachSendChannelSchema.default("smtp"),
  fromName: OptionalTrimmedString(160),
  email: z.string().trim().min(3).max(320),
  host: OptionalTrimmedString(240),
  port: z.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  imapHost: OptionalTrimmedString(240),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapSecure: z.boolean().optional(),
  imapUsername: OptionalTrimmedString(320),
  username: OptionalTrimmedString(320),
  passwordRef: z.string().min(1).optional(),
  passwordPreview: z.string().optional(),
  oauthApi: OutreachSenderApiCredentialSchema.optional(),
  serviceApi: OutreachSenderApiCredentialSchema.optional(),
  enabled: z.boolean().default(true),
  lastTestedAt: z.string().datetime().optional(),
  lastTestEmailAt: z.string().datetime().optional(),
  deliveryConfirmedAt: z.string().datetime().optional(),
  lastInboxCheckedAt: z.string().datetime().optional(),
  lastInboxCheckStatus: z.enum(["ready", "unsupported", "failed"]).optional(),
  lastInboxCheckMessage: z.string().max(1000).optional(),
  lastError: z.string().max(1000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const OutreachEmailSignatureLogoSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  size: z.number().int().nonnegative().max(2 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  uploadedAt: z.string().datetime()
}).strict();

export const OutreachEmailSignatureSchema = z.object({
  version: z.literal(1).default(1),
  enabled: z.boolean().default(false),
  text: z.string().trim().max(4000).default(""),
  html: z.string().trim().max(12000).default(""),
  logoEnabled: z.boolean().default(true),
  logoAlt: z.string().trim().max(120).default("Company logo"),
  logoWidth: z.number().int().min(24).max(240).default(120),
  logo: OutreachEmailSignatureLogoSchema.optional(),
  updatedAt: z.string().datetime().optional()
}).strict();

export const OutreachResearchDepthSchema = z.enum(["adaptive", "quick", "standard", "deep"]);

export const DeepResearchSidecarConfigSchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().trim().url().optional(),
  timeoutMs: z.number().int().min(1).max(120_000).default(30_000),
  maxPages: z.number().int().min(1).max(20).default(8),
  apiKey: z.string().trim().min(1).max(4000).optional()
}).strict();

export const CustomerResearchSummarySchema = z.object({
  depth: OutreachResearchDepthSchema.default("adaptive"),
  confidenceScore: z.number().int().min(0).max(100).default(0),
  buyerType: z.string().trim().max(160).default(""),
  likelyNeed: z.string().trim().max(800).default(""),
  primaryAngle: z.string().trim().max(800).default(""),
  riskNotes: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
  checkedPages: z.number().int().nonnegative().max(20).default(0)
}).strict();

export const CustomerResearchEvidenceSchema = z.object({
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(600),
  sourceUrl: z.string().trim().min(1).max(1000),
  snippet: z.string().trim().max(800).default("")
}).strict();

export const CustomerResearchSnapshotSchema = z.object({
  website: z.string().min(1).max(500),
  companyName: z.string().trim().min(1).max(180),
  depth: OutreachResearchDepthSchema.default("adaptive"),
  confidenceScore: z.number().int().min(0).max(100).default(0),
  buyerType: z.string().trim().max(160).default(""),
  productSignals: z.array(z.string().trim().min(1).max(220)).max(12).default([]),
  buyingSignals: z.array(z.string().trim().min(1).max(220)).max(12).default([]),
  painSignals: z.array(z.string().trim().min(1).max(220)).max(12).default([]),
  recommendedAngle: z.string().trim().max(800).default(""),
  industry: z.string().trim().max(160).default(""),
  inferredNeed: z.string().trim().max(2000).default(""),
  title: z.string().trim().max(240).default(""),
  description: z.string().trim().max(1000).default(""),
  fetchedUrls: z.array(z.string().min(1).max(1000)).max(12).default([]),
  evidence: z.array(CustomerResearchEvidenceSchema).max(40).default([]),
  textPreview: z.string().trim().max(12000).default(""),
  error: z.string().max(1000).optional(),
  createdAt: z.string().datetime()
}).strict();

export const GeneratedIcpSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  industrySegment: z.string().trim().max(500).default(""),
  companyCharacteristics: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  buyerRoles: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  buyingBehavior: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  painPoints: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  triggerEvents: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  salesAngles: z.array(z.string().trim().min(1).max(500)).max(8).default([])
}).strict();

export const GeneratedUspSchema = z.object({
  id: z.string().min(1),
  category: z.string().trim().max(80).default("Strategic value"),
  headline: z.string().trim().min(1).max(180),
  buyerAngle: z.string().trim().max(800).default(""),
  proof: z.string().trim().max(800).default("")
}).strict();

export const EmailSequenceDraftStatusSchema = z.enum(["draft", "sent", "failed"]);

export const EmailSequenceDraftSchema = z.object({
  id: z.string().min(1),
  draftId: z.string().min(1).optional(),
  step: z.number().int().min(0).max(9),
  delayDays: z.number().int().min(0).max(60).default(0),
  strategy: z.string().trim().min(1).max(180),
  subject: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(20000),
  status: EmailSequenceDraftStatusSchema.default("draft"),
  qualityReview: OutreachEmailQualityReviewSchema.optional(),
  evidenceMap: OutreachEvidenceMapSchema.optional(),
  strategyMatch: OutreachStrategyMatchSchema.optional(),
  sendRiskReview: OutreachSendRiskReviewSchema.optional(),
  sentAt: z.string().datetime().optional(),
  sendError: z.string().max(1000).optional()
}).strict();

export const OutreachWorkflowSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  leadId: z.string().min(1),
  draftId: z.string().min(1),
  website: z.string().min(1).max(500),
  email: z.string().min(3).max(320),
  language: z.string().trim().min(1).max(80).default("English"),
  tone: z.string().trim().min(1).max(120).default("professional, warm, concise"),
  generationMode: OutreachGenerationModeSchema.default("deep"),
  research: CustomerResearchSnapshotSchema,
  icps: z.array(GeneratedIcpSchema).max(3).default([]),
  usps: z.array(GeneratedUspSchema).max(6).default([]),
  initialEmail: EmailSequenceDraftSchema,
  followUps: z.array(EmailSequenceDraftSchema).max(9).default([]),
  promptSnapshot: z.string().trim().max(30000).default(""),
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).max(100).optional(),
  usage: UsageEstimateSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const OutreachCampaignStatusSchema = z.enum(["draft", "generating", "ready", "sending", "paused", "completed", "failed", "stopped"]);
export const OutreachCampaignRecipientStatusSchema = z.enum(["pending", "researching", "generated", "approved", "queued", "sending", "sent", "replied", "bounced", "unsubscribed", "stopped", "failed", "skipped"]);

export const OutreachCampaignRateLimitSchema = z.object({
  maxPerHour: z.number().int().min(1).max(60).default(10),
  minDelayMinutes: z.number().int().min(1).max(60).default(6)
}).strict();

export const OutreachCampaignStatsSchema = z.object({
  total: z.number().int().nonnegative().default(0),
  pending: z.number().int().nonnegative().default(0),
  researching: z.number().int().nonnegative().default(0),
  generated: z.number().int().nonnegative().default(0),
  approved: z.number().int().nonnegative().default(0),
  queued: z.number().int().nonnegative().default(0),
  sending: z.number().int().nonnegative().default(0),
  sent: z.number().int().nonnegative().default(0),
  replied: z.number().int().nonnegative().default(0),
  bounced: z.number().int().nonnegative().default(0),
  unsubscribed: z.number().int().nonnegative().default(0),
  stopped: z.number().int().nonnegative().default(0),
  failed: z.number().int().nonnegative().default(0),
  skipped: z.number().int().nonnegative().default(0)
}).strict();

export const OutreachCampaignSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).default(""),
  senderAccountId: z.string().min(1).optional(),
  mode: z.literal("first-email-only").default("first-email-only"),
  status: OutreachCampaignStatusSchema.default("draft"),
  language: z.string().trim().min(1).max(80).default("English"),
  tone: z.string().trim().min(1).max(120).default("professional, warm, concise"),
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).max(100).optional(),
  generationMode: OutreachGenerationModeSchema.default("deep"),
  researchDepth: OutreachResearchDepthSchema.default("adaptive"),
  rateLimit: OutreachCampaignRateLimitSchema.default({}),
  stats: OutreachCampaignStatsSchema.default({}),
  startedAt: z.string().datetime().optional(),
  pausedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  stoppedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const OutreachCampaignRecipientSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  campaignId: z.string().min(1),
  leadId: z.string().min(1),
  workflowId: z.string().min(1).optional(),
  initialDraftId: z.string().min(1).optional(),
  email: z.string().trim().min(3).max(320),
  companyName: z.string().trim().min(1).max(180),
  website: z.string().trim().min(3).max(500),
  contactName: OptionalTrimmedString(160),
  contactTitle: OptionalTrimmedString(160),
  status: OutreachCampaignRecipientStatusSchema.default("pending"),
  researchSummary: CustomerResearchSummarySchema.optional(),
  approvedAt: z.string().datetime().optional(),
  queuedAt: z.string().datetime().optional(),
  sentAt: z.string().datetime().optional(),
  repliedAt: z.string().datetime().optional(),
  bouncedAt: z.string().datetime().optional(),
  unsubscribedAt: z.string().datetime().optional(),
  stoppedAt: z.string().datetime().optional(),
  lastInboxEventAt: z.string().datetime().optional(),
  stopReason: z.string().max(1000).optional(),
  skippedAt: z.string().datetime().optional(),
  sendError: z.string().max(1000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const OutreachFollowUpStatusSchema = z.enum(["scheduled", "ready", "sending", "sent", "failed", "stopped"]);
export const OutreachFollowUpModeSchema = z.enum(["confirm", "auto"]);

export const OutreachFollowUpJobSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  campaignId: z.string().min(1),
  recipientId: z.string().min(1),
  leadId: z.string().min(1),
  workflowId: z.string().min(1),
  draftId: z.string().min(1),
  senderAccountId: z.string().min(1),
  step: z.number().int().min(1).max(9),
  mode: OutreachFollowUpModeSchema.default("confirm"),
  status: OutreachFollowUpStatusSchema.default("scheduled"),
  email: z.string().trim().min(3).max(320),
  companyName: z.string().trim().min(1).max(180),
  subject: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(20000),
  sendAt: z.string().datetime(),
  readyAt: z.string().datetime().optional(),
  sentAt: z.string().datetime().optional(),
  stoppedAt: z.string().datetime().optional(),
  stopReason: z.string().max(1000).optional(),
  sendError: z.string().max(1000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const OutreachFeedbackSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1).optional(),
  targetType: z.enum(["draft", "workflow", "campaign", "recipient", "general"]).default("general"),
  targetId: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(5),
  category: z.enum(["good", "too-generic", "wrong-context", "too-long", "not-my-company", "other"]).default("other"),
  comment: z.string().trim().max(2000).default(""),
  status: z.enum(["new", "valuable", "archived"]).default("new"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
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
