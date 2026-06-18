import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { chmod, lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import type { SendMailOptions } from "nodemailer";
import { z } from "zod";
import { AgentRepository, LocalCredentialVault, ProviderRepository } from "@hermills/agent-builder";
import {
  AgentDefinitionSchema,
  CapabilitySchema,
  ChannelKindSchema,
  ChannelRecordSchema,
  ChatControlBindingSessionSchema,
  ChatControlCommandSchema,
  ChatMessageSchema,
  ChatSessionSchema,
  getDataHome,
  getLogHome,
  CompanyMaterialCategorySchema,
  CompanyProfileSchema,
  CompanyProfileUpdateSchema,
  EmailSequenceDraftSchema,
  InstallRequestSchema,
  JobRecordSchema,
  JobRunRecordSchema,
  JobStatusSchema,
  MaterialRecordSchema,
  LogEntrySchema,
  LogLevelSchema,
  LogSourceSchema,
  previewSecret,
  CustomerResearchBriefSchema,
  CustomerResearchSummarySchema,
  CustomerResearchSnapshotSchema,
  OutreachBuyerPersonaSchema,
  OutreachResearchDepthSchema,
  OutreachCtaAssetSchema,
  OutreachSendChannelSchema,
  OutreachCampaignRecipientSchema,
  OutreachCampaignSchema,
  OutreachDraftSchema,
  OutreachEmailSignatureLogoSchema,
  OutreachEmailSignatureSchema,
  OutreachEmailQualityReviewSchema,
  OutreachEvidenceLockSchema,
  OutreachEvidenceItemSchema,
  OutreachEvidenceMapSchema,
  OutreachFeedbackSchema,
  OutreachFollowUpJobSchema,
  OutreachGenerationModeSchema,
  OutreachGoldenExampleSchema,
  OutreachLeadSchema,
  OutreachLeadFitScoreSchema,
  OutreachLearningSignalSchema,
  OutreachSendRiskReviewSchema,
  OutreachSenderAccountSchema,
  OutreachSendOutcomeSchema,
  OutreachStrategyMatchSchema,
  OutreachUspCandidateSchema,
  OutreachValueMatchSchema,
  OutreachWorkflowSchema,
  ProviderCredentialSchema,
  RuntimeStatusSchema,
  redactSecrets,
  type AppState,
  type ChannelRecord,
  type ChatMessage,
  type ChatSession,
  type ChatControlBindingSession,
  type ChatControlCommand,
  type CompanyProfile,
  type DeepResearchSidecarConfig,
  type InstallEvent,
  type InstallRequest,
  type JobRecord,
  type JobRunRecord,
  type LogEntry,
  type MaterialRecord,
  type OnboardingProviderInput,
  type OnboardingProviderState,
  type OnboardingState,
  type OnboardingUpdate,
  type CustomerResearchBrief,
  type OutreachCampaign,
  type OutreachCampaignRecipient,
  type OutreachBuyerPersona,
  type OutreachCtaAsset,
  type OutreachDraft,
  type OutreachEmailQualityReview,
  type OutreachEvidenceLock,
  type OutreachEmailSignature,
  type OutreachEvidenceItem,
  type OutreachEvidenceMap,
  type OutreachFeedback,
  type OutreachFollowUpJob,
  type OutreachGenerationMode,
  type OutreachGoldenExample,
  type OutreachLead,
  type OutreachLeadFitScore,
  type OutreachLearningSignal,
  type OutreachResearchDepth,
  type OutreachSendRiskReview,
  type OutreachSenderAccount,
  type OutreachSendOutcome,
  type OutreachStrategyMatch,
  type OutreachUspCandidate,
  type OutreachValueMatch,
  type OutreachWorkflow,
  type ProviderCredential,
  type RuntimeStatus
} from "@hermills/core";
import {
  RuntimeService,
  modelsUrl,
  type ComputerControlCommandResult,
  type ComputerControlPermissionId,
  type ComputerControlRunResult,
  type ComputerControlStatus,
  type HermesReplyRequest
} from "@hermills/runtime";
import {
  MailTransportError,
  createSmtpTransporter,
  parseApiMailCredential,
  sendApiMail,
  verifyApiMailTransport,
  type ApiMailCredential
} from "./mail-transports.js";
import {
  CloudAdminUserStatusBodySchema,
  CloudAuthBodySchema,
  CloudEmailBodySchema,
  CloudError,
  CloudSignupBodySchema,
  CloudSummarizeLearningRulesBodySchema,
  CloudSyncBodySchema,
  CloudVerifySignupCodeBodySchema,
  HermillsCloudService,
  type CloudChatControlCommand
} from "./cloud.js";

export interface ServerOptions {
  host?: string;
  port?: number;
  baseDir?: string;
  desktopToken?: string;
  allowInsecureDev?: boolean;
  runtimeService?: RuntimeAdapter;
  fetchImpl?: typeof fetch;
  deepResearch?: Partial<DeepResearchSidecarConfig>;
}

export interface RuntimeAdapter {
  getLatest(): Promise<unknown>;
  getUpdateCheck(force?: boolean): Promise<unknown>;
  getStatus(): Promise<unknown>;
  startInstall(request: InstallRequest): Promise<{ jobId: string }>;
  getEvents(jobId: string): InstallEvent[];
  onEvent(jobId: string, listener: (event: InstallEvent) => void): () => void;
  getGatewayStatus(): Promise<unknown>;
  startGateway(): Promise<unknown>;
  stopGateway(): Promise<unknown>;
  restartGateway(): Promise<unknown>;
  getComputerControlStatus(): Promise<ComputerControlStatus>;
  prepareComputerControl(): Promise<ComputerControlCommandResult>;
  requestComputerControlPermission(permission: ComputerControlPermissionId): Promise<ComputerControlCommandResult>;
  installComputerControlDriver(): Promise<ComputerControlCommandResult>;
  enableComputerControlTools(): Promise<ComputerControlCommandResult>;
  startComputerControlDashboard(): Promise<ComputerControlCommandResult>;
  stopComputerControlDashboard(): Promise<ComputerControlCommandResult>;
  runComputerControlPrompt(prompt: string): Promise<ComputerControlRunResult>;
  createHermesReply(request: HermesReplyRequest): Promise<string>;
  configureInferenceProvider?(provider?: HermesReplyRequest["provider"]): Promise<void>;
  dispose?(): Promise<void>;
}

export interface OutreachSenderTransport {
  provider: string;
  sendChannel: OutreachSenderAccount["sendChannel"];
  verify(): Promise<void>;
  sendMail(message: SendMailOptions): Promise<void>;
}

export interface OutreachSenderTransportSelection {
  provider: string;
  sendChannel: OutreachSenderAccount["sendChannel"];
  senderId: string;
  senderEmail: string;
  transport: OutreachSenderTransport;
}

const MAX_MATERIAL_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MATERIAL_TEXT_BYTES = 1_000_000;
const MAX_MATERIAL_COUNT = 200;
const MAX_TOTAL_MATERIAL_BYTES = 250 * 1024 * 1024;
const MAX_SIGNATURE_LOGO_BYTES = 2 * 1024 * 1024;
const SIGNATURE_LOGO_CID = "hermills-signature-logo";
const SIGNATURE_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_OUTREACH_LEAD_NOTES_CHARS = 20_000;
const OUTREACH_EMAIL_LANGUAGE = "English";
const OUTREACH_MIN_DELIVERABLE_SCORE = 85;
const OUTREACH_FAST_REPAIR_ATTEMPTS = 4;

const UpsertAgentBody = z.object({
  displayName: z.string().min(2).max(80),
  description: z.string().max(240).optional(),
  instructions: z.string().min(1).max(20000),
  starters: z.array(z.string().min(1).max(160)).max(8).optional(),
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).max(100).optional(),
  capabilities: CapabilitySchema.partial().optional()
});

const UpsertProviderBody = z.object({
  kind: ProviderCredentialSchema.shape.kind,
  displayName: z.string().min(2).max(80),
  baseUrl: z.string().url().optional(),
  defaultModel: z.string().min(1).max(100).optional(),
  apiKey: z.string().min(1).optional(),
  enabled: z.boolean().optional()
});

const OptionalOnboardingString = (maxLength: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).max(maxLength).optional()
);

const OnboardingProviderInputSchema = z.object({
  id: z.string().min(1).optional(),
  kind: ProviderCredentialSchema.shape.kind.default("openai-compatible"),
  displayName: z.string().trim().min(2).max(80),
  baseUrl: OptionalOnboardingString(500).pipe(z.string().url().optional()),
  defaultModel: OptionalOnboardingString(100),
  apiKey: OptionalOnboardingString(4000),
  enabled: z.boolean().default(true)
}).strict();

const OnboardingProviderStateSchema = OnboardingProviderInputSchema.omit({ apiKey: true }).extend({
  keyPreview: z.string().optional()
}).strict();

const OnboardingStateSchema = z.object({
  version: z.literal(1).default(1),
  language: z.enum(["zh-CN", "zh-TW", "ja", "ko", "en"]).default("zh-CN"),
  userDisplayName: z.string().trim().max(80).default(""),
  agentName: z.string().trim().max(80).default("Hermes"),
  memoryEnabled: z.boolean().default(false),
  theme: z.enum(["warm", "night", "plain", "system"]).default("warm"),
  workspacePath: OptionalOnboardingString(1000),
  provider: OnboardingProviderStateSchema.optional(),
  onboardingCompletedAt: z.string().datetime().optional(),
  defaultAgentId: z.string().min(1).optional()
}).strict();

const OnboardingUpdateSchema = OnboardingStateSchema.omit({
  version: true,
  onboardingCompletedAt: true,
  provider: true
}).partial().extend({
  onboardingCompletedAt: z.string().datetime().nullable().optional(),
  provider: OnboardingProviderInputSchema.nullable().optional()
}).strict();

const KnowledgeBody = z.object({
  name: z.string().min(1).max(180),
  path: z.string().min(1),
  size: z.number().int().nonnegative(),
  mimeType: z.string().optional()
});

const CreateSessionBody = z.object({
  agentId: z.string().optional(),
  providerId: z.string().optional(),
  model: z.string().optional(),
  title: z.string().min(1).max(120).optional()
});

const SendChatMessageBody = z.object({
  content: z.string().min(1).max(20000),
  materialIds: z.array(z.string().min(1)).max(12).optional()
});

const UpdateSessionBody = z.object({
  title: z.string().min(1).max(120).optional(),
  agentId: z.string().min(1).nullable().optional(),
  providerId: z.string().min(1).nullable().optional(),
  model: z.string().min(1).nullable().optional()
}).strict();

const SessionListQuery = z.object({
  q: z.string().max(120).optional()
}).strict();

const UploadMaterialBody = z.object({
  name: z.string().min(1).max(180),
  folder: z.string().min(1).max(160).optional(),
  mimeType: z.string().max(120).optional(),
  size: z.number().int().nonnegative().max(MAX_MATERIAL_FILE_BYTES),
  contentText: z.string().max(MAX_MATERIAL_TEXT_BYTES).optional()
});

const UpdateMaterialBody = z.object({
  name: z.string().min(1).max(180).optional(),
  folder: z.string().min(1).max(160).nullable().optional(),
  category: CompanyMaterialCategorySchema.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(24).optional(),
  description: z.string().trim().max(1000).nullable().optional()
}).strict();

const CopyMaterialBody = z.object({
  name: z.string().min(1).max(180).optional(),
  folder: z.string().min(1).max(160).nullable().optional(),
  category: CompanyMaterialCategorySchema.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(24).optional(),
  description: z.string().trim().max(1000).nullable().optional()
}).strict();

const UploadCompanyMaterialBody = UploadMaterialBody.extend({
  category: CompanyMaterialCategorySchema.optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(24).optional(),
  description: z.string().trim().max(1000).optional()
});

const AppStateDocumentSchema = z.object({
  version: z.literal(1).default(1),
  firstDeployHidden: z.boolean().default(false),
  localDeployCompletedAt: z.string().datetime().optional(),
  lastSuccessfulRuntimeVersion: z.string().optional(),
  lastSuccessfulGatewayAt: z.string().datetime().optional()
}).strict();

const ReinitializeBody = z.object({
  mode: z.enum(["repair", "reset-runtime", "reset-first-run"]).default("repair")
}).strict();

const UpdateCheckQuery = z.object({
  force: z.string().optional()
}).strict();

const RuntimeUpdateBody = z.object({
  installerSha256: z.string().regex(/^[a-f0-9]{64}$/).optional()
}).strict();

const ComputerControlPermissionRequestBody = z.object({
  permission: z.enum(["screen-recording", "accessibility"])
}).strict();

const CreateProfileBody = z.object({
  name: z.string().min(2).max(80)
}).strict();

const UpdateProfileBody = z.object({
  name: z.string().min(2).max(80).optional(),
  active: z.boolean().optional()
}).strict();

const CreateJobBody = z.object({
  profileId: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  schedule: JobRecordSchema.shape.schedule,
  status: JobStatusSchema.optional(),
  task: JobRecordSchema.shape.task
}).strict();

const UpdateJobBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  schedule: JobRecordSchema.shape.schedule.optional(),
  status: JobStatusSchema.optional(),
  task: JobRecordSchema.shape.task.optional()
}).strict();

const JobListQuery = z.object({
  profileId: z.string().min(1).optional(),
  status: JobStatusSchema.optional(),
  q: z.string().max(120).optional(),
  includeDeleted: z.string().optional()
}).strict();

const JobHistoryQuery = z.object({
  limit: z.coerce.number().int().positive().max(200).optional()
}).strict();

const CreateChannelBody = z.object({
  profileId: z.string().min(1).optional(),
  kind: ChannelKindSchema,
  label: z.string().min(1).max(120),
  enabled: z.boolean().optional(),
  endpoint: z.string().url().optional(),
  secret: z.string().min(1).max(4000).optional(),
  config: z.record(z.unknown()).optional()
}).strict();

const UpdateChannelBody = z.object({
  label: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  endpoint: z.string().url().nullable().optional(),
  secret: z.string().min(1).max(4000).optional(),
  clearSecret: z.boolean().optional(),
  config: z.record(z.unknown()).optional()
}).strict();

const ChannelListQuery = z.object({
  profileId: z.string().min(1).optional(),
  kind: ChannelKindSchema.optional()
}).strict();

const ChatControlCommandListQuery = z.object({
  profileId: z.string().min(1).optional(),
  status: ChatControlCommandSchema.shape.status.optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
}).strict();

const CreateChatControlCommandBody = z.object({
  profileId: z.string().min(1).optional(),
  channelId: z.string().min(1).optional(),
  platform: ChannelKindSchema.default("feishu"),
  conversationId: z.string().trim().min(1).max(240).default("local-preview"),
  senderId: z.string().trim().min(1).max(240).default("local-user"),
  senderDisplayName: z.string().trim().max(160).default(""),
  rawText: z.string().trim().min(1).max(4000),
  executeNow: z.boolean().default(true)
}).strict();

const CreateChatControlBindingBody = z.object({
  profileId: z.string().min(1).optional(),
  platform: ChannelKindSchema.default("feishu"),
  label: z.string().trim().max(120).optional()
}).strict();

const ChatControlWebhookQuery = z.object({
  token: z.string().trim().min(1).max(4000).optional()
}).strict();

const ChatControlWebhookBody = z.record(z.unknown());

const LogListQuery = z.object({
  source: LogSourceSchema.optional(),
  level: LogLevelSchema.optional(),
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().positive().max(500).optional()
}).strict();

const CreateLogBody = z.object({
  source: LogSourceSchema.default("server"),
  level: LogLevelSchema.default("info"),
  message: z.string().min(1).max(4000)
}).strict();

const AnalyticsUsageQuery = z.object({
  source: z.enum(["chat", "job-run"]).optional(),
  bucket: z.enum(["day", "week", "month"]).default("day")
}).strict();

const OutreachLeadInputBody = z.object({
  companyName: z.string().trim().min(1).max(180),
  website: OptionalOnboardingString(500),
  country: OptionalOnboardingString(120),
  industry: OptionalOnboardingString(160),
  contactName: OptionalOnboardingString(160),
  contactTitle: OptionalOnboardingString(160),
  email: OptionalOnboardingString(320),
  need: z.string().trim().max(2000).default(""),
  notes: z.string().trim().max(MAX_OUTREACH_LEAD_NOTES_CHARS).default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(24).default([]),
  source: z.string().trim().min(1).max(64).optional(),
  status: z.enum(["new", "email_drafted", "followup_drafted", "email_sent", "contacted", "reply_received", "followup_due"]).optional(),
  currentState: z.enum(["input_ready", "waiting_user_send", "waiting_user_send_followup", "waiting_response_status", "drafting_reply_email"]).optional(),
  replyStatus: z.enum(["not_checked", "checking", "no_reply", "reply_received", "bounced", "unsubscribed"]).optional(),
  statusColor: z.enum(["slate", "blue", "amber", "green", "rose", "violet"]).optional(),
  currentRound: z.number().int().min(0).max(9).optional()
}).strict();

const CreateOutreachLeadBody = OutreachLeadInputBody.extend({
  profileId: z.string().min(1).optional()
}).strict();

const UpdateOutreachLeadBody = OutreachLeadInputBody.partial().strict();

const OutreachLeadListQuery = z.object({
  profileId: z.string().min(1).optional(),
  q: z.string().max(120).optional()
}).strict();

const ImportOutreachLeadsBody = z.object({
  csvText: z.string().min(1).max(1_000_000),
  profileId: z.string().min(1).optional()
}).strict();

const DeleteOutreachLeadsBody = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  profileId: z.string().min(1).optional()
}).strict();

const UpsertOutreachBuyerPersonaBody = OutreachBuyerPersonaSchema.omit({
  id: true,
  profileId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  profileId: z.string().min(1).optional()
}).strict();

const UpdateOutreachBuyerPersonaBody = UpsertOutreachBuyerPersonaBody.partial().strict();

const UpsertOutreachUspBody = OutreachUspCandidateSchema.omit({
  id: true,
  profileId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  profileId: z.string().min(1).optional()
}).strict();

const UpdateOutreachUspBody = UpsertOutreachUspBody.partial().strict();

const UpsertOutreachCtaAssetBody = OutreachCtaAssetSchema.omit({
  id: true,
  profileId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  profileId: z.string().min(1).optional()
}).strict();

const UpdateOutreachCtaAssetBody = UpsertOutreachCtaAssetBody.partial().strict();

const UpsertOutreachGoldenExampleBody = OutreachGoldenExampleSchema.omit({
  id: true,
  profileId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  profileId: z.string().min(1).optional()
}).strict();

const UpdateOutreachGoldenExampleBody = UpsertOutreachGoldenExampleBody.partial().strict();

const GenerateOutreachDraftBody = z.object({
  profileId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
  lead: OutreachLeadInputBody.optional(),
  language: z.string().trim().min(1).max(80).default("English"),
  tone: z.string().trim().min(1).max(120).default("professional, warm, concise"),
  generationMode: OutreachGenerationModeSchema.default("deep"),
  researchDepth: OutreachResearchDepthSchema.default("adaptive"),
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).max(100).optional()
}).strict().refine((body) => Boolean(body.leadId || body.lead), {
  message: "Choose an existing lead or provide lead details."
});

const AutoOutreachDraftBody = z.object({
  profileId: z.string().min(1).optional(),
  website: z.string().trim().min(3).max(500),
  email: z.string().trim().min(3).max(320),
  language: z.string().trim().min(1).max(80).default("English"),
  tone: z.string().trim().min(1).max(120).default("professional, warm, concise"),
  generationMode: OutreachGenerationModeSchema.default("deep"),
  researchDepth: OutreachResearchDepthSchema.default("adaptive"),
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).max(100).optional()
}).strict();

const UpdateOutreachDraftBody = z.object({
  subject: z.string().trim().min(1).max(240).optional(),
  body: z.string().trim().min(1).max(20000).optional(),
  language: z.string().trim().min(1).max(80).optional(),
  tone: z.string().trim().min(1).max(120).optional()
}).strict();

const RewriteOutreachDraftBody = z.object({
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).max(100).optional()
}).strict();

const OutreachSenderApiCredentialBody = z.object({
  credential: OptionalOnboardingString(4000),
  accountId: OptionalOnboardingString(240),
  apiBaseUrl: OptionalOnboardingString(500),
  scopes: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  expiresAt: z.string().datetime().optional()
}).strict();

const CreateOutreachSenderBody = z.object({
  profileId: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(120),
  provider: OptionalOnboardingString(80),
  sendChannel: OutreachSendChannelSchema.default("smtp"),
  fromName: OptionalOnboardingString(160),
  email: z.string().trim().min(3).max(320),
  host: OptionalOnboardingString(240),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  imapHost: OptionalOnboardingString(240),
  imapPort: z.coerce.number().int().min(1).max(65535).optional(),
  imapSecure: z.boolean().optional(),
  imapUsername: OptionalOnboardingString(320),
  username: OptionalOnboardingString(320),
  password: OptionalOnboardingString(4000),
  oauthApi: OutreachSenderApiCredentialBody.optional(),
  serviceApi: OutreachSenderApiCredentialBody.optional(),
  enabled: z.boolean().default(true)
}).strict();

const UpdateOutreachSenderBody = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  provider: OptionalOnboardingString(80).nullable().optional(),
  sendChannel: OutreachSendChannelSchema.optional(),
  fromName: OptionalOnboardingString(160).nullable().optional(),
  email: z.string().trim().min(3).max(320).optional(),
  host: OptionalOnboardingString(240).nullable().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  imapHost: OptionalOnboardingString(240).nullable().optional(),
  imapPort: z.coerce.number().int().min(1).max(65535).nullable().optional(),
  imapSecure: z.boolean().nullable().optional(),
  imapUsername: OptionalOnboardingString(320).nullable().optional(),
  username: OptionalOnboardingString(320).nullable().optional(),
  password: OptionalOnboardingString(4000),
  clearPassword: z.boolean().optional(),
  oauthApi: OutreachSenderApiCredentialBody.nullable().optional(),
  serviceApi: OutreachSenderApiCredentialBody.nullable().optional(),
  clearOAuthApiCredential: z.boolean().optional(),
  clearServiceApiCredential: z.boolean().optional(),
  enabled: z.boolean().optional()
}).strict();

const UpdateOutreachEmailSignatureBody = z.object({
  enabled: z.boolean().optional(),
  text: z.string().trim().max(4000).optional(),
  html: z.string().trim().max(12000).optional(),
  logoEnabled: z.boolean().optional(),
  logoAlt: z.string().trim().max(120).optional(),
  logoWidth: z.coerce.number().int().min(24).max(240).optional()
}).strict();

const SendOutreachDraftBody = z.object({
  senderAccountId: z.string().min(1),
  confirm: z.literal(true),
  to: OptionalOnboardingString(320)
}).strict();

const OutreachCampaignRateLimitBody = z.object({
  maxPerHour: z.coerce.number().int().min(1).max(60).default(10),
  minDelayMinutes: z.coerce.number().int().min(1).max(60).default(6)
}).strict();

const CreateOutreachCampaignBody = z.object({
  profileId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  leadIds: z.array(z.string().min(1)).min(1).max(200),
  senderAccountId: z.string().min(1).optional(),
  language: z.string().trim().min(1).max(80).default("English"),
  tone: z.string().trim().min(1).max(120).default("professional, warm, concise"),
  providerId: z.string().min(1).optional(),
  model: z.string().min(1).max(100).optional(),
  generationMode: OutreachGenerationModeSchema.default("deep"),
  researchDepth: OutreachResearchDepthSchema.default("adaptive"),
  rateLimit: OutreachCampaignRateLimitBody.optional()
}).strict();

const ApproveOutreachCampaignRecipientBody = z.object({
  confirm: z.literal(true),
  subject: OptionalOnboardingString(240),
  body: OptionalOnboardingString(20_000)
}).strict();

const StartOutreachCampaignBody = z.object({
  senderAccountId: z.string().min(1),
  confirm: z.literal(true)
}).strict();

const ScheduleOutreachFollowUpsBody = z.object({
  senderAccountId: z.string().min(1),
  mode: z.enum(["confirm", "auto"]).default("confirm"),
  confirm: z.literal(true)
}).strict();

const TickOutreachFollowUpsBody = z.object({
  now: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10)
}).strict();

const CheckOutreachInboxBody = z.object({
  senderAccountId: z.string().min(1),
  campaignId: z.string().min(1).optional()
}).strict();

const CreateOutreachFeedbackBody = z.object({
  targetType: z.enum(["draft", "workflow", "campaign", "recipient", "general"]).default("general"),
  targetId: z.string().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  category: z.enum(["good", "too-generic", "wrong-context", "too-long", "not-my-company", "other"]).default("other"),
  comment: z.string().trim().max(2000).default("")
}).strict();

const SendOutreachTestEmailBody = z.object({
  to: OptionalOnboardingString(320)
}).strict();

const DeepResearchRuntimeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  url: z.string().trim().url().optional(),
  timeoutMs: z.number().int().min(1).max(120_000).default(30_000),
  maxPages: z.number().int().min(1).max(20).default(8),
  apiKey: z.string().trim().min(1).max(4000).optional()
}).strict();

export async function createServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const server = Fastify({ logger: false });
  server.addContentTypeParser(/^multipart\/form-data/i, { parseAs: "buffer", bodyLimit: MAX_MATERIAL_FILE_BYTES + 16_384 }, (_request, body, done) => {
    done(null, body);
  });
  await server.register(cors, { origin: allowedRendererOrigins() });

  const allowInsecureDev = options.allowInsecureDev || process.env.HERMILLS_INSECURE_DEV === "1";
  if (!options.desktopToken && !allowInsecureDev) {
    throw new Error("Hermills desktop token is required. Set HERMILLS_DESKTOP_TOKEN or HERMILLS_INSECURE_DEV=1 for local development only.");
  }

  if (options.desktopToken) {
    server.addHook("preHandler", async (request, reply) => {
      if (request.url === "/api/health") return;
      if (request.method === "POST" && request.url.startsWith("/api/chat-control/webhooks/")) return;
      if (request.headers["x-hermills-token"] !== options.desktopToken) {
        await reply.code(401).send(errorBody("UNAUTHORIZED", "Invalid Hermills desktop token."));
      }
    });
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const agents = new AgentRepository(options.baseDir, { seedBuiltinAgents: true });
  const providers = new ProviderRepository(options.baseDir);
  const runtime: RuntimeAdapter = options.runtimeService ?? new RuntimeService({ baseDir: options.baseDir });
  const chats = new ChatRepository(options.baseDir);
  const materials = new MaterialRepository(options.baseDir);
  const appState = new AppStateRepository(options.baseDir);
  const onboarding = new OnboardingRepository(options.baseDir);
  const companyProfile = new CompanyProfileRepository(options.baseDir);
  const outreachLeads = new OutreachLeadRepository(options.baseDir);
  const outreachAssets = new OutreachAssetRepository(options.baseDir);
  const outreachDrafts = new OutreachDraftRepository(options.baseDir);
  const outreachSenders = new OutreachSenderRepository(options.baseDir, fetchImpl);
  const outreachEmailSignature = new OutreachEmailSignatureRepository(options.baseDir);
  const outreachWorkflows = new OutreachWorkflowRepository(options.baseDir);
  const outreachCampaigns = new OutreachCampaignRepository(options.baseDir);
  const outreachFollowUps = new OutreachFollowUpRepository(options.baseDir);
  const outreachFeedback = new OutreachFeedbackRepository(options.baseDir);
  const customerResearchCache = new CustomerResearchCacheRepository(options.baseDir);
  const profiles = new ProfileRepository(options.baseDir);
  const jobs = new JobRepository(options.baseDir);
  const channels = new ChannelRepository(options.baseDir);
  const chatControlCommands = new ChatControlCommandRepository(options.baseDir);
  const chatControlBindings = new ChatControlBindingSessionRepository(options.baseDir);
  const logs = new LogRepository(options.baseDir);
  const cloud = new HermillsCloudService({ baseDir: options.baseDir, fetchImpl });
  await syncDefaultRuntimeInferenceProvider(runtime, providers, logs);
  const researchFetchImpl: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const deepResearch = new DeepResearchClient({ baseDir: options.baseDir, config: options.deepResearch, fetchImpl: researchFetchImpl, logs });
  const resolveProfileId = async (profileId?: string) => {
    const state = await profiles.list();
    const nextProfileId = profileId ?? state.activeProfileId;
    if (!state.profiles.some((profile) => profile.id === nextProfileId)) throw new ClientInputError(`Profile not found: ${nextProfileId}`);
    return nextProfileId;
  };
  const assertActiveProfile = async (profileId?: string) => {
    const activeProfileId = await resolveProfileId();
    if (profileId && profileId !== activeProfileId) throw new ClientInputError("Resource belongs to another profile.");
    return activeProfileId;
  };
  const assertJobProfile = async (id: string, includeDeleted = false) => {
    const job = await jobs.get(id);
    if (!job || (!includeDeleted && job.deletedAt)) throw new ClientInputError(`Job not found: ${id}`);
    await assertActiveProfile(job.profileId);
    return job;
  };
  const assertChannelProfile = async (id: string) => {
    const channel = await channels.get(id);
    if (!channel) throw new ClientInputError(`Channel not found: ${id}`);
    await assertActiveProfile(channel.profileId);
    return channel;
  };
  const executeChatControlCommand = async (command: ChatControlCommand): Promise<ChatControlCommand> => {
    const profileId = await resolveProfileId(command.profileId);
    await chatControlCommands.update(command.id, { status: "running", profileId });
    const intent = parseChatControlIntent(command.rawText);
    try {
      if (intent.action === "help" || intent.action === "unknown") {
        return chatControlCommands.update(command.id, {
          action: intent.action,
          payload: intent.payload,
          status: "completed",
          resultText: chatControlHelpText(),
          completedAt: new Date().toISOString()
        });
      }
      if (intent.action === "status") {
        const [leads, drafts, campaigns, senders] = await Promise.all([
          outreachLeads.list({ profileId }),
          outreachDrafts.list({ profileId }),
          outreachCampaigns.list({ profileId }),
          outreachSenders.list({ profileId })
        ]);
        const waitingSend = drafts.filter((draft) => draft.status !== "sent").length;
        const replyReady = leads.filter((lead) => lead.replyStatus === "reply_received" || lead.status === "reply_received").length;
        return chatControlCommands.update(command.id, {
          action: intent.action,
          payload: intent.payload,
          status: "completed",
          resultText: [
            `Hermills 今日状态：${leads.length} 个客户，${drafts.length} 封草稿，${waitingSend} 封待发送，${replyReady} 个客户已回复。`,
            `批量任务：${campaigns.length} 个。已确认发件邮箱：${senders.filter((sender) => sender.enabled && sender.deliveryConfirmedAt).length} 个。`,
            "可继续发送：写信 客户邮箱 官网，或：查看草稿。"
          ].join("\n"),
          completedAt: new Date().toISOString()
        });
      }
      if (intent.action === "generate-outreach-draft") {
        const website = stringPayload(intent.payload, "website");
        const email = stringPayload(intent.payload, "email");
        if (!website || !email) throw new ClientInputError("写开发信需要同时提供客户官网和邮箱。例：给 buyer@company.com https://company.com 写开发信");
        const research = await researchCustomerWebsite(website, "adaptive", { email, deepResearch, cache: customerResearchCache });
        const lead = await outreachLeads.create({
          profileId,
          companyName: research.companyName || companyNameFromWebsite(research.website) || companyNameFromEmail(email),
          website: research.website,
          email,
          country: "",
          industry: research.industry || "",
          contactName: "",
          contactTitle: "",
          need: research.inferredNeed || "",
          notes: formatCustomerResearchNotes(research),
          tags: ["chat-control", "auto-researched"]
        });
        const draft = await generateFastOutreachDraft({
          lead,
          body: {
            language: "English",
            tone: "professional, warm, concise",
            generationMode: "deep",
            researchDepth: "adaptive"
          },
          profileId,
          runtime,
          providers,
          companyProfile,
          materials,
          emailSignature: outreachEmailSignature,
          assets: outreachAssets,
          drafts: outreachDrafts,
          research
        });
        await outreachLeads.update(lead.id, { status: "email_drafted", currentState: "waiting_user_send", statusColor: "amber" });
        return chatControlCommands.update(command.id, {
          action: intent.action,
          payload: { ...intent.payload, leadId: lead.id, draftId: draft.id },
          status: "completed",
          resultText: chatControlDraftSummary(draft),
          completedAt: new Date().toISOString()
        });
      }
      if (intent.action === "list-drafts") {
        const drafts = (await outreachDrafts.list({ profileId })).slice(0, 8);
        return chatControlCommands.update(command.id, {
          action: intent.action,
          payload: intent.payload,
          status: "completed",
          resultText: drafts.length ? drafts.map((draft, index) => `${index + 1}. ${draft.id.slice(0, 8)} · ${draft.status} · ${draft.subject}`).join("\n") : "还没有开发信草稿。可以发送：给 buyer@company.com https://company.com 写开发信",
          completedAt: new Date().toISOString()
        });
      }
      if (intent.action === "review-draft") {
        const draft = await resolveChatControlDraft(intent.payload, profileId, outreachDrafts);
        const lead = draft.leadId ? await outreachLeads.get(draft.leadId) : undefined;
        const review = reviewOutreachEmail({ subject: draft.subject, body: draft.body, lead });
        await outreachDrafts.update(draft.id, { qualityReview: review });
        return chatControlCommands.update(command.id, {
          action: intent.action,
          payload: { ...intent.payload, draftId: draft.id },
          status: "completed",
          resultText: `草稿 ${draft.id.slice(0, 8)} 质量分：${review.score} 分。${review.summary || (review.passed ? "可以发送。" : "建议先重写。")}`,
          completedAt: new Date().toISOString()
        });
      }
      if (intent.action === "rewrite-draft") {
        const draft = await resolveChatControlDraft(intent.payload, profileId, outreachDrafts);
        const lead = draft.leadId ? await outreachLeads.get(draft.leadId) : undefined;
        const rewritten = await rewriteOutreachDraft({
          draft,
          lead,
          body: {},
          runtime,
          providers,
          companyProfile,
          materials,
          assets: outreachAssets,
          drafts: outreachDrafts
        });
        return chatControlCommands.update(command.id, {
          action: intent.action,
          payload: { ...intent.payload, draftId: rewritten.id },
          status: "completed",
          resultText: chatControlDraftSummary(rewritten),
          completedAt: new Date().toISOString()
        });
      }
      if (intent.action === "check-inbox") {
        const sender = await resolveChatControlSender(profileId, outreachSenders);
        const result = await checkOutreachInbox({
          sender,
          senders: outreachSenders,
          drafts: outreachDrafts,
          campaigns: outreachCampaigns,
          followUps: outreachFollowUps
        });
        return chatControlCommands.update(command.id, {
          action: intent.action,
          payload: { ...intent.payload, senderAccountId: sender.id },
          status: "completed",
          resultText: `已检查 ${sender.email}：匹配到 ${result.matched.length} 个回复/退信事件，停止跟进 ${result.stopped} 个。${result.message}`,
          completedAt: new Date().toISOString()
        });
      }
      if (intent.action === "send-draft") {
        const approvalCode = stringPayload(intent.payload, "approvalCode");
        if (approvalCode) {
          const pending = await chatControlCommands.findPendingApproval(approvalCode, profileId);
          if (!pending) throw new ClientInputError("确认码无效或已过期。请重新发送：发送草稿 草稿ID。");
          const draft = await resolveChatControlDraft(pending.payload, profileId, outreachDrafts);
          const sender = await resolveChatControlSender(profileId, outreachSenders);
          const lead = draft.leadId ? await outreachLeads.get(draft.leadId) : undefined;
          const sent = await sendOutreachDraft({
            draft,
            sender,
            lead,
            senders: outreachSenders,
            drafts: outreachDrafts,
            emailSignature: outreachEmailSignature,
            ctaAssets: await outreachAssets.listCtaAssets(profileId),
            companyKnowledgeContext: await buildCompanyKnowledgeContext(companyProfile, materials)
          });
          await chatControlCommands.update(pending.id, {
            status: "completed",
            resultText: `已确认并发送：${sent.subject}`,
            completedAt: new Date().toISOString()
          });
          return chatControlCommands.update(command.id, {
            action: intent.action,
            payload: { approvalCode, draftId: draft.id, senderAccountId: sender.id },
            status: "completed",
            resultText: `已发送给 ${lead?.email || "客户"}：${sent.subject}`,
            completedAt: new Date().toISOString()
          });
        }
        const draft = await resolveChatControlDraft(intent.payload, profileId, outreachDrafts);
        const code = createApprovalCode();
        return chatControlCommands.update(command.id, {
          action: intent.action,
          payload: { ...intent.payload, draftId: draft.id },
          status: "needs-approval",
          requiresApproval: true,
          approvalCode: code,
          resultText: `发送邮件需要确认。草稿：${draft.subject}\n如果确认发送，请回复：确认发送 ${code}`,
        });
      }
      return chatControlCommands.update(command.id, {
        action: "unknown",
        payload: intent.payload,
        status: "completed",
        resultText: chatControlHelpText(),
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return chatControlCommands.update(command.id, {
        action: intent.action,
        payload: intent.payload,
        status: "failed",
        error: message,
        resultText: `Hermills 没能完成这次请求：${message}`,
        completedAt: new Date().toISOString()
      });
    }
  };
  const executeCloudChatControlCommand = async (incoming: CloudChatControlCommand) => {
    const platform = ChannelKindSchema.safeParse(incoming.platform);
    if (!platform.success || !isOfficialChatControlPlatform(platform.data)) {
      await cloud.completeChatControlCommand(incoming.id, {
        ok: false,
        error: `Unsupported chat platform: ${incoming.platform}`
      }).catch(() => undefined);
      return { ok: false, command: undefined, error: `Unsupported chat platform: ${incoming.platform}` };
    }
    const profileId = await resolveProfileId();
    let channelId = incoming.channelId;
    if (channelId) {
      const channel = await channels.get(channelId).catch(() => undefined);
      if (!channel || channel.profileId !== profileId || channel.kind !== platform.data || !channel.enabled) channelId = undefined;
    }
    if (!channelId) {
      const existing = (await channels.list({ profileId, kind: platform.data })).find((channel) => channel.enabled);
      channelId = existing?.id;
    }
    const command = await chatControlCommands.create({
      profileId,
      channelId,
      platform: platform.data,
      conversationId: incoming.conversationId,
      senderId: incoming.senderId,
      senderDisplayName: incoming.senderDisplayName,
      rawText: incoming.rawText,
      payload: {
        ...incoming.payload,
        cloudCommandId: incoming.id
      }
    });
    const executed = await executeChatControlCommand(command);
    await cloud.completeChatControlCommand(incoming.id, {
      ok: executed.status !== "failed",
      resultText: executed.resultText,
      error: executed.error
    }).catch(() => undefined);
    return { ok: executed.status !== "failed", command: executed };
  };
  const buildCloudSyncSnapshot = async () => {
    const profileId = await resolveProfileId();
    const [companyProfileRecord, leads, drafts, workflows, campaigns, feedback] = await Promise.all([
      companyProfile.get(),
      outreachLeads.list({ profileId }),
      outreachDrafts.list({ profileId }),
      outreachWorkflows.list({ profileId }),
      outreachCampaigns.listWithRecipients({ profileId }, outreachDrafts),
      outreachFeedback.list({ profileId })
    ]);
    return { profileId, companyProfile: companyProfileRecord, leads, drafts, workflows, campaigns, feedback };
  };
  const campaignGenerationJobs = new Map<string, Promise<void>>();
  const startCampaignGeneration = async (campaignId: string) => {
    const campaign = await outreachCampaigns.require(campaignId);
    await assertActiveProfile(campaign.profileId);
    if (!campaignGenerationJobs.has(campaignId)) {
      const job = generateOutreachCampaignWorkflows({
        campaignId,
        runtime,
        providers,
        companyProfile,
        materials,
        emailSignature: outreachEmailSignature,
        assets: outreachAssets,
        leads: outreachLeads,
        drafts: outreachDrafts,
        workflows: outreachWorkflows,
        campaigns: outreachCampaigns,
        deepResearch,
        customerResearchCache,
        cloud
      }).then(() => undefined).catch(async (error) => {
        await outreachCampaigns.updateCampaign(campaignId, { status: "failed" }).catch(() => undefined);
        await logs.create({
          level: "error",
          source: "server",
          message: `Campaign generation failed (${campaignId}): ${redactSecrets(error instanceof Error ? error.message : String(error))}`
        }).catch(() => undefined);
      }).finally(() => {
        campaignGenerationJobs.delete(campaignId);
      });
      campaignGenerationJobs.set(campaignId, job);
    }
    return outreachCampaigns.requireWithRecipients(campaignId, outreachDrafts);
  };

  server.get("/api/health", async () => ({ ok: true, product: "Hermills" }));
  server.get("/api/cloud/status", async () => cloud.status());
  server.get("/api/auth/me", async () => cloud.me());
  server.post("/api/auth/signup", async (request) => cloud.signUp(CloudSignupBodySchema.parse(request.body ?? {})));
  server.post("/api/auth/register", async (request) => cloud.signUp(CloudSignupBodySchema.parse(request.body ?? {})));
  server.post("/api/auth/login", async (request) => cloud.login(CloudAuthBodySchema.parse(request.body ?? {})));
  server.post("/api/auth/logout", async () => cloud.logout());
  server.post("/api/auth/accept-terms", async () => cloud.acceptTerms());
  server.post("/api/auth/password-reset", async (request) => cloud.resetPassword(CloudEmailBodySchema.parse(request.body ?? {}).email));
  server.post("/api/auth/resend-signup-confirmation", async (request) => cloud.resendSignupConfirmation(CloudEmailBodySchema.parse(request.body ?? {}).email));
  server.post("/api/auth/verify-signup-code", async (request) => cloud.verifySignupCode(CloudVerifySignupCodeBodySchema.parse(request.body ?? {})));
  server.get("/api/admin/users", async () => cloud.adminUsers());
  server.patch("/api/admin/users/:id/status", async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params ?? {});
    const body = CloudAdminUserStatusBodySchema.parse(request.body ?? {});
    return cloud.updateAdminUserStatus(params.id, body.status);
  });
  server.post("/api/cloud/sync", async (request) => {
    CloudSyncBodySchema.parse(request.body ?? {});
    const snapshot = await buildCloudSyncSnapshot();
    return cloud.syncSnapshot(snapshot);
  });
  server.post("/api/cloud/learning-rules/summarize", async (request) => {
    const body = CloudSummarizeLearningRulesBodySchema.parse(request.body ?? {});
    if (body.forceSync) {
      await cloud.syncSnapshot(await buildCloudSyncSnapshot());
    }
    return cloud.summarizeLearningRules({ ...body, forceSync: false });
  });
  server.get("/api/learning-pack", async () => {
    const profileId = await resolveProfileId();
    return cloud.learningPack({ companyProfile: await companyProfile.get(), profileId });
  });
  server.get("/api/app-state", async () => appState.response(await runtime.getStatus()));
  server.get("/api/onboarding", async () => onboarding.get());
  server.put("/api/onboarding", async (request) => onboarding.update(OnboardingUpdateSchema.parse(request.body ?? {})));
  server.post("/api/onboarding/complete", async (request) => {
    const body = OnboardingUpdateSchema.parse(request.body ?? {});
    return completeOnboarding(body, onboarding, profiles, agents, providers, runtime, logs);
  });
  server.get("/api/runtime/latest", async () => runtime.getLatest());
  server.get("/api/runtime/update-check", async (request) => {
    const query = UpdateCheckQuery.parse(request.query ?? {});
    return runtime.getUpdateCheck(query.force === "1" || query.force === "true");
  });
  server.get("/api/runtime/status", async () => runtime.getStatus());
  server.post("/api/runtime/install", async (request) => {
    const result = await runtime.startInstall(InstallRequestSchema.parse(request.body ?? {}));
    trackInstallCompletion(result.jobId, runtime, appState);
    return result;
  });
  server.post("/api/runtime/update", async (request) => {
    const body = RuntimeUpdateBody.parse(request.body ?? {});
    const result = await runtime.startInstall({ channel: "official-docs-latest", dryRun: false, force: true, skipBrowser: true, installerSha256: body.installerSha256 });
    trackInstallCompletion(result.jobId, runtime, appState);
    return result;
  });
  server.post("/api/runtime/reinitialize", async (request) => {
    const body = ReinitializeBody.parse(request.body ?? {});
    if (body.mode === "reset-first-run") return appState.resetFirstRun();
    const result = await runtime.startInstall({ channel: "official-docs-latest", dryRun: false, force: true, skipBrowser: true });
    trackInstallCompletion(result.jobId, runtime, appState);
    return result;
  });
  server.get("/api/runtime/install/:jobId/events.json", async (request) => {
    const { jobId } = request.params as { jobId: string };
    return runtime.getEvents(jobId);
  });
  server.get("/api/runtime/install/:jobId/events", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
    for (const event of runtime.getEvents(jobId)) reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    const off = runtime.onEvent(jobId, (event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.level === "done" || event.level === "error") {
        off();
        reply.raw.end();
      }
    });
    request.raw.on("close", off);
    return reply;
  });
  server.get("/api/gateway/status", async () => runtime.getGatewayStatus());
  server.post("/api/gateway/start", async () => runtime.startGateway());
  server.post("/api/gateway/stop", async () => runtime.stopGateway());
  server.post("/api/gateway/restart", async () => runtime.restartGateway());
  server.get("/api/computer-control/status", async () => runtime.getComputerControlStatus());
  server.post("/api/computer-control/prepare", async () => runtime.prepareComputerControl());
  server.post("/api/computer-control/request-permission", async (request) => {
    const body = ComputerControlPermissionRequestBody.parse(request.body ?? {});
    return runtime.requestComputerControlPermission(body.permission);
  });
  server.post("/api/computer-control/install-driver", async () => runtime.installComputerControlDriver());
  server.post("/api/computer-control/enable-tools", async () => runtime.enableComputerControlTools());
  server.post("/api/computer-control/dashboard/start", async () => runtime.startComputerControlDashboard());
  server.post("/api/computer-control/dashboard/stop", async () => runtime.stopComputerControlDashboard());

  server.addHook("onClose", async () => {
    await deepResearch.dispose();
    await runtime.dispose?.();
  });

  server.get("/api/agents", async () => agents.list());
  server.post("/api/agents", async (request) => agents.create(UpsertAgentBody.parse(request.body)));
  server.put("/api/agents/:id", async (request) => {
    const { id } = request.params as { id: string };
    return agents.update(id, UpsertAgentBody.partial().parse(request.body));
  });
  server.delete("/api/agents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await agents.remove(id);
    return reply.code(204).send();
  });
  server.post("/api/agents/:id/knowledge", async (request) => {
    const { id } = request.params as { id: string };
    const body = KnowledgeBody.parse(request.body);
    return agents.addKnowledge(id, { ...body, mimeType: body.mimeType ?? "application/octet-stream", source: "upload" });
  });

  server.get("/api/settings/providers", async () => (await providers.list()).map(publicProvider));
  server.post("/api/settings/providers", async (request) => {
    const provider = await providers.create(UpsertProviderBody.parse(request.body));
    await syncRuntimeInferenceProvider(runtime, provider, await providers.readApiKey(provider).catch(() => undefined), logs);
    return publicProvider(provider);
  });
  server.put("/api/settings/providers/:id", async (request) => {
    const { id } = request.params as { id: string };
    const provider = await providers.update(id, UpsertProviderBody.partial().parse(request.body));
    await syncRuntimeInferenceProvider(runtime, provider, await providers.readApiKey(provider).catch(() => undefined), logs);
    return publicProvider(provider);
  });
  server.delete("/api/settings/providers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await providers.remove(id);
    return reply.code(204).send();
  });
  server.get("/api/settings/providers/:id/models", async (request) => {
    const { id } = request.params as { id: string };
    const provider = await providers.get(id);
    if (!provider) throw new ClientInputError(`Provider not found: ${id}`);
    return discoverProviderModels(provider, await providers.readApiKey(provider), fetchImpl);
  });
  server.post("/api/settings/providers/:id/test", async (request) => {
    const { id } = request.params as { id: string };
    const provider = await providers.get(id);
    if (!provider) throw new ClientInputError(`Provider not found: ${id}`);
    await discoverProviderModels(provider, await providers.readApiKey(provider), fetchImpl);
    return { ok: true };
  });

  server.get("/api/profiles", async () => profiles.list());
  server.post("/api/profiles", async (request) => profiles.create(CreateProfileBody.parse(request.body)));
  server.put("/api/profiles/:id", async (request) => {
    const { id } = request.params as { id: string };
    return profiles.update(id, UpdateProfileBody.parse(request.body));
  });
  server.delete("/api/profiles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await profiles.remove(id);
    return reply.code(204).send();
  });

  server.get("/api/jobs", async (request) => {
    const query = JobListQuery.parse(request.query ?? {});
    return jobs.list({
      profileId: await resolveProfileId(query.profileId),
      status: query.status,
      q: query.q,
      includeDeleted: parseBooleanQuery(query.includeDeleted)
    });
  });
  server.post("/api/jobs", async (request) => {
    const body = CreateJobBody.parse(request.body ?? {});
    return jobs.create({ ...body, profileId: await resolveProfileId(body.profileId) });
  });
  server.get("/api/jobs/:id", async (request) => {
    const { id } = request.params as { id: string };
    return assertJobProfile(id);
  });
  server.put("/api/jobs/:id", async (request) => {
    const { id } = request.params as { id: string };
    await assertJobProfile(id);
    return jobs.update(id, UpdateJobBody.parse(request.body ?? {}));
  });
  server.post("/api/jobs/:id/pause", async (request) => {
    const { id } = request.params as { id: string };
    await assertJobProfile(id);
    return jobs.update(id, { status: "paused" });
  });
  server.post("/api/jobs/:id/resume", async (request) => {
    const { id } = request.params as { id: string };
    await assertJobProfile(id);
    return jobs.update(id, { status: "active" });
  });
  server.post("/api/jobs/:id/run", async (request) => {
    const { id } = request.params as { id: string };
    await assertJobProfile(id);
    return runJobNow(id, jobs, logs, runtime, agents, providers, materials, companyProfile);
  });
  server.post("/api/jobs/:id/run-now", async (request) => {
    const { id } = request.params as { id: string };
    await assertJobProfile(id);
    return runJobNow(id, jobs, logs, runtime, agents, providers, materials, companyProfile);
  });
  server.get("/api/jobs/:id/history", async (request) => {
    const { id } = request.params as { id: string };
    await assertJobProfile(id, true);
    const query = JobHistoryQuery.parse(request.query ?? {});
    return jobs.runs(id, query.limit);
  });
  server.delete("/api/jobs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await assertJobProfile(id);
    await jobs.softDelete(id);
    return reply.code(204).send();
  });

  const listChannels = async (request: FastifyRequest) => {
    const query = ChannelListQuery.parse(request.query ?? {});
    return (await channels.list({
      profileId: await resolveProfileId(query.profileId),
      kind: query.kind
    })).map(publicChannel);
  };
  const createChannel = async (request: FastifyRequest) => {
    const body = CreateChannelBody.parse(request.body ?? {});
    return publicChannel(await channels.create({ ...body, profileId: await resolveProfileId(body.profileId) }));
  };
  server.get("/api/channels", listChannels);
  server.get("/api/settings/channels", listChannels);
  server.post("/api/channels", createChannel);
  server.post("/api/settings/channels", createChannel);
  server.put("/api/channels/:id", async (request) => {
    const { id } = request.params as { id: string };
    await assertChannelProfile(id);
    return publicChannel(await channels.update(id, UpdateChannelBody.parse(request.body ?? {})));
  });
  server.put("/api/settings/channels/:id", async (request) => {
    const { id } = request.params as { id: string };
    await assertChannelProfile(id);
    return publicChannel(await channels.update(id, UpdateChannelBody.parse(request.body ?? {})));
  });
  server.post("/api/channels/:id/test", async (request) => {
    const { id } = request.params as { id: string };
    await assertChannelProfile(id);
    return channels.test(id);
  });
  server.post("/api/settings/channels/:id/test", async (request) => {
    const { id } = request.params as { id: string };
    await assertChannelProfile(id);
    return channels.test(id);
  });
  server.delete("/api/channels/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await assertChannelProfile(id);
    await channels.remove(id);
    return reply.code(204).send();
  });
  server.delete("/api/settings/channels/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await assertChannelProfile(id);
    await channels.remove(id);
    return reply.code(204).send();
  });

  server.get("/api/chat-control/bindings", async (request) => {
    const query = ChannelListQuery.parse(request.query ?? {});
    return chatControlBindings.list({
      profileId: await resolveProfileId(query.profileId),
      platform: query.kind
    });
  });
  server.post("/api/chat-control/bindings", async (request) => {
    const body = CreateChatControlBindingBody.parse(request.body ?? {});
    const profileId = await resolveProfileId(body.profileId);
    const existing = (await channels.list({ profileId, kind: body.platform }))[0];
    const label = body.label?.trim() || `${chatControlPlatformLabel(body.platform)} 聊天控制`;
    const config = {
      ...(existing?.config ?? {}),
      mode: "official-bot",
      relay: "cloud-binding",
      accountType: body.platform === "wechat" ? "service_account" : undefined,
      localWebhookPath: existing ? `/api/chat-control/webhooks/${existing.id}` : undefined,
      allowedActions: ["status", "generate-outreach-draft", "list-drafts", "review-draft", "rewrite-draft", "check-inbox", "send-draft-with-approval"]
    };
    const channel = existing
      ? await channels.update(existing.id, {
        label,
        enabled: true,
        secret: existing.secretRef ? undefined : createChatControlRelaySecret(),
        config
      })
      : await channels.create({
        profileId,
        kind: body.platform,
        label,
        enabled: true,
        secret: createChatControlRelaySecret(),
        config
      });
    const binding = await chatControlBindings.create({
      profileId,
      platform: body.platform,
      channelId: channel.id,
      relayUrl: chatControlRelayUrl()
    });
    await channels.update(channel.id, {
      config: {
        ...channel.config,
        ...config,
        localWebhookPath: `/api/chat-control/webhooks/${channel.id}`,
        bindingSessionId: binding.id,
        bindingUrl: binding.bindingUrl
      }
    });
    return binding;
  });
  server.get("/api/chat-control/bindings/:id", async (request) => {
    const { id } = request.params as { id: string };
    const binding = await chatControlBindings.get(id);
    if (!binding) throw new ClientInputError(`Chat control binding session not found: ${id}`);
    await assertActiveProfile(binding.profileId);
    return binding;
  });
  server.post("/api/chat-control/bindings/:id/test", async (request) => {
    const { id } = request.params as { id: string };
    const binding = await chatControlBindings.get(id);
    if (!binding) throw new ClientInputError(`Chat control binding session not found: ${id}`);
    const profileId = await assertActiveProfile(binding.profileId);
    if (!binding.channelId) throw new ClientInputError("Chat control binding session is missing its local channel.");
    await assertChannelProfile(binding.channelId);
    await chatControlBindings.update(binding.id, { status: "testing", error: undefined, resultText: "正在发送测试命令：今日状态。" });
    const command = await chatControlCommands.create({
      profileId,
      channelId: binding.channelId,
      platform: binding.platform,
      conversationId: "binding-test",
      senderId: "binding-test-user",
      senderDisplayName: "Binding test",
      rawText: "今日状态"
    });
    const executed = await executeChatControlCommand(command);
    return chatControlBindings.update(binding.id, {
      status: executed.status === "failed" ? "failed" : "connected",
      testCommandId: executed.id,
      resultText: executed.resultText || "聊天助手连接成功。你现在可以发送“今日状态”或“写开发信”。",
      error: executed.status === "failed" ? executed.error || "测试命令失败。" : undefined,
      completedAt: new Date().toISOString()
    });
  });

  server.post("/api/chat-control/cloud/poll", async () => {
    const pulled = await cloud.pullChatControlCommands(10);
    let executed = 0;
    let failed = 0;
    const results: Array<{ id: string; ok: boolean; resultText?: string; error?: string }> = [];
    for (const incoming of pulled.commands) {
      try {
        const result = await executeCloudChatControlCommand(incoming);
        if (result.ok) executed += 1;
        else failed += 1;
        results.push({
          id: incoming.id,
          ok: result.ok,
          resultText: result.command?.resultText,
          error: result.command?.error ?? result.error
        });
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        await cloud.completeChatControlCommand(incoming.id, { ok: false, error: message }).catch(() => undefined);
        results.push({ id: incoming.id, ok: false, error: message });
      }
    }
    return {
      ok: true,
      pulled: pulled.pulled,
      executed,
      failed,
      results
    };
  });

  server.get("/api/chat-control/commands", async (request) => {
    const query = ChatControlCommandListQuery.parse(request.query ?? {});
    return chatControlCommands.list({
      profileId: await resolveProfileId(query.profileId),
      status: query.status,
      limit: query.limit
    });
  });
  server.post("/api/chat-control/commands", async (request) => {
    const body = CreateChatControlCommandBody.parse(request.body ?? {});
    const profileId = await resolveProfileId(body.profileId);
    if (body.channelId) {
      const channel = await assertChannelProfile(body.channelId);
      if (channel.kind !== body.platform) throw new ClientInputError("Chat command platform does not match the selected channel.");
    }
    const command = await chatControlCommands.create({
      profileId,
      channelId: body.channelId,
      platform: body.platform,
      conversationId: body.conversationId,
      senderId: body.senderId,
      senderDisplayName: body.senderDisplayName,
      rawText: body.rawText
    });
    return body.executeNow ? executeChatControlCommand(command) : command;
  });
  server.post("/api/chat-control/commands/:id/run", async (request) => {
    const { id } = request.params as { id: string };
    const command = await chatControlCommands.get(id);
    if (!command) throw new ClientInputError(`Chat control command not found: ${id}`);
    await assertActiveProfile(command.profileId);
    return executeChatControlCommand(command);
  });
  server.post("/api/chat-control/webhooks/:channelId", async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const query = ChatControlWebhookQuery.parse(request.query ?? {});
    const body = ChatControlWebhookBody.parse(request.body ?? {});
    const challenge = extractChatWebhookChallenge(body);
    if (challenge) return { challenge };
    const channel = await channels.get(channelId);
    if (!channel) return reply.code(404).send(errorBody("NOT_FOUND", `Chat control channel not found: ${channelId}`));
    if (!channel.enabled) return reply.code(403).send(errorBody("CHANNEL_DISABLED", "Chat control channel is disabled."));
    const secret = await channels.secret(channel.id);
    if (!secret) return reply.code(403).send(errorBody("CHANNEL_SECRET_REQUIRED", "Chat control channel secret is required."));
    if (!verifyChatWebhookSecret(secret, request.headers, query.token)) {
      return reply.code(401).send(errorBody("INVALID_CHANNEL_SECRET", "Invalid chat control webhook secret."));
    }
    const rawText = extractChatWebhookText(channel.kind, body);
    if (!rawText) throw new ClientInputError("Chat webhook payload does not contain a text command.");
    const command = await chatControlCommands.create({
      profileId: await resolveProfileId(channel.profileId),
      channelId: channel.id,
      platform: channel.kind,
      conversationId: extractChatWebhookConversationId(channel.kind, body),
      senderId: extractChatWebhookSenderId(channel.kind, body),
      senderDisplayName: extractChatWebhookSenderName(channel.kind, body),
      rawText
    });
    const executed = await executeChatControlCommand(command);
    return {
      ok: executed.status !== "failed",
      reply: executed.resultText || executed.error || "Hermills 已收到命令。",
      command: executed
    };
  });

  server.get("/api/chat/sessions", async (request) => {
    const query = SessionListQuery.parse(request.query ?? {});
    return chats.list(query.q);
  });
  server.post("/api/chat/sessions", async (request) => {
    const body = CreateSessionBody.parse(request.body ?? {});
    const agent = body.agentId ? await agents.get(body.agentId) : undefined;
    return chats.create({
      title: body.title ?? agent?.displayName ?? "New conversation",
      agentId: body.agentId,
      providerId: body.providerId ?? agent?.providerId,
      model: body.model ?? agent?.model
    });
  });
  server.put("/api/chat/sessions/:id", async (request) => {
    const { id } = request.params as { id: string };
    return chats.update(id, UpdateSessionBody.parse(request.body ?? {}));
  });
  server.delete("/api/chat/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await chats.remove(id);
    return reply.code(204).send();
  });
  server.post("/api/chat/sessions/:id/messages", async (request) => {
    const { id } = request.params as { id: string };
    const body = SendChatMessageBody.parse(request.body);
    const attachedMaterials = body.materialIds?.length ? await materials.getMany(body.materialIds) : [];
    const session = await chats.append(id, { id: randomUUID(), role: "user", content: body.content, createdAt: new Date().toISOString() });
    if (isComputerControlRequest(body.content)) return chats.append(id, await createComputerControlReply(runtime, body.content));
    return chats.append(id, await createAssistantReply(session, runtime, agents, providers, attachedMaterials, await buildCompanyKnowledgeContext(companyProfile, materials)));
  });
  server.get("/api/company/profile", async () => companyProfile.get());
  server.put("/api/company/profile", async (request) => companyProfile.update(CompanyProfileUpdateSchema.parse(request.body ?? {})));
  server.get("/api/company/materials", async () => (await materials.listCompany()).map(publicMaterial));
  server.post("/api/company/materials", async (request) => {
    if (isMultipartRequest(request)) {
      return publicMaterial(await materials.createFromMultipart(await readMaterialUpload(request), { scope: "company", folder: "Company knowledge" }));
    }
    return publicMaterial(await materials.createFromJson({
      ...UploadCompanyMaterialBody.parse(request.body),
      scope: "company",
      folder: "Company knowledge"
    }));
  });
  server.get("/api/company/materials/:id/preview", async (request) => {
    const { id } = request.params as { id: string };
    await materials.assertCompanyMaterial(id);
    return materials.preview(id);
  });
  server.get("/api/company/materials/:id/download", async (request, reply) => {
    const { id } = request.params as { id: string };
    await materials.assertCompanyMaterial(id);
    const download = await materials.download(id);
    reply.header("Content-Type", download.mimeType);
    reply.header("Content-Disposition", `attachment; filename="${safeDownloadName(download.fileName)}"`);
    return reply.send(download.buffer);
  });
  server.put("/api/company/materials/:id", async (request) => {
    const { id } = request.params as { id: string };
    await materials.assertCompanyMaterial(id);
    return publicMaterial(await materials.update(id, UpdateMaterialBody.parse(request.body ?? {})));
  });
  server.post("/api/company/materials/:id/copy", async (request) => {
    const { id } = request.params as { id: string };
    await materials.assertCompanyMaterial(id);
    return publicMaterial(await materials.copy(id, { ...CopyMaterialBody.parse(request.body ?? {}), scope: "company", folder: "Company knowledge" }));
  });
  server.delete("/api/company/materials/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await materials.assertCompanyMaterial(id);
    await materials.remove(id);
    return reply.code(204).send();
  });
  server.get("/api/outreach/leads", async (request) => {
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    return outreachLeads.list({ profileId: await resolveProfileId(query.profileId), q: query.q });
  });
  server.get("/api/outreach/leads/stats", async (request) => {
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    return outreachLeads.stats({ profileId: await resolveProfileId(query.profileId), q: query.q });
  });
  server.post("/api/outreach/leads", async (request) => {
    const body = CreateOutreachLeadBody.parse(request.body ?? {});
    return outreachLeads.create({ ...body, profileId: await resolveProfileId(body.profileId) });
  });
  server.post("/api/outreach/leads/import", async (request) => {
    const body = ImportOutreachLeadsBody.parse(request.body ?? {});
    return outreachLeads.importCsv(body.csvText, await resolveProfileId(body.profileId));
  });
  server.post("/api/outreach/leads/delete-many", async (request) => {
    const body = DeleteOutreachLeadsBody.parse(request.body ?? {});
    return outreachLeads.removeMany(body.ids, await resolveProfileId(body.profileId));
  });
  server.put("/api/outreach/leads/:id", async (request) => {
    const { id } = request.params as { id: string };
    const lead = await outreachLeads.require(id);
    await assertActiveProfile(lead.profileId);
    return outreachLeads.update(id, UpdateOutreachLeadBody.parse(request.body ?? {}));
  });
  server.delete("/api/outreach/leads/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const lead = await outreachLeads.require(id);
    await assertActiveProfile(lead.profileId);
    await outreachLeads.remove(id);
    return reply.code(204).send();
  });
  server.get("/api/outreach/personas", async (request) => {
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    return outreachAssets.listPersonas(await resolveProfileId(query.profileId));
  });
  server.post("/api/outreach/personas", async (request) => {
    const body = UpsertOutreachBuyerPersonaBody.parse(request.body ?? {});
    return outreachAssets.createPersona({ ...body, profileId: await resolveProfileId(body.profileId) });
  });
  server.put("/api/outreach/personas/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateOutreachBuyerPersonaBody.parse(request.body ?? {});
    return outreachAssets.updatePersona(id, await resolveProfileId(body.profileId), body);
  });
  server.delete("/api/outreach/personas/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    await outreachAssets.deletePersona(id, await resolveProfileId(query.profileId));
    return reply.code(204).send();
  });
  server.get("/api/outreach/usps", async (request) => {
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    return outreachAssets.listUsps(await resolveProfileId(query.profileId));
  });
  server.post("/api/outreach/usps", async (request) => {
    const body = UpsertOutreachUspBody.parse(request.body ?? {});
    return outreachAssets.createUsp({ ...body, profileId: await resolveProfileId(body.profileId) });
  });
  server.put("/api/outreach/usps/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateOutreachUspBody.parse(request.body ?? {});
    return outreachAssets.updateUsp(id, await resolveProfileId(body.profileId), body);
  });
  server.delete("/api/outreach/usps/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    await outreachAssets.deleteUsp(id, await resolveProfileId(query.profileId));
    return reply.code(204).send();
  });
  server.get("/api/outreach/cta-assets", async (request) => {
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    return outreachAssets.listCtaAssets(await resolveProfileId(query.profileId));
  });
  server.post("/api/outreach/cta-assets", async (request) => {
    const body = UpsertOutreachCtaAssetBody.parse(request.body ?? {});
    return outreachAssets.createCtaAsset({ ...body, profileId: await resolveProfileId(body.profileId) });
  });
  server.put("/api/outreach/cta-assets/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateOutreachCtaAssetBody.parse(request.body ?? {});
    return outreachAssets.updateCtaAsset(id, await resolveProfileId(body.profileId), body);
  });
  server.delete("/api/outreach/cta-assets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    await outreachAssets.deleteCtaAsset(id, await resolveProfileId(query.profileId));
    return reply.code(204).send();
  });
  server.get("/api/outreach/golden-examples", async (request) => {
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    return outreachAssets.listGoldenExamples(await resolveProfileId(query.profileId));
  });
  server.post("/api/outreach/golden-examples", async (request) => {
    const body = UpsertOutreachGoldenExampleBody.parse(request.body ?? {});
    return outreachAssets.createGoldenExample({ ...body, profileId: await resolveProfileId(body.profileId) });
  });
  server.put("/api/outreach/golden-examples/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateOutreachGoldenExampleBody.parse(request.body ?? {});
    return outreachAssets.updateGoldenExample(id, await resolveProfileId(body.profileId), body);
  });
  server.delete("/api/outreach/golden-examples/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    await outreachAssets.deleteGoldenExample(id, await resolveProfileId(query.profileId));
    return reply.code(204).send();
  });
  server.get("/api/outreach/drafts", async (request) => {
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    return outreachDrafts.list({ profileId: await resolveProfileId(query.profileId), q: query.q });
  });
  server.post("/api/outreach/drafts/generate", async (request) => {
    const body = GenerateOutreachDraftBody.parse(request.body ?? {});
    const profileId = await resolveProfileId(body.profileId);
    const lead = body.leadId
      ? await outreachLeads.require(body.leadId)
      : await outreachLeads.create({ ...body.lead!, profileId });
    await assertActiveProfile(lead.profileId);
    const research = lead.website
      ? await researchCustomerWebsite(lead.website, body.researchDepth, {
        email: lead.email,
        deepResearch,
        cache: customerResearchCache
      })
      : undefined;
    const draft = await generateOutreachDraft({
      lead,
      body,
      profileId,
      runtime,
      providers,
      companyProfile,
      materials,
      emailSignature: outreachEmailSignature,
      assets: outreachAssets,
      drafts: outreachDrafts,
      cloud,
      research
    });
    await outreachLeads.update(lead.id, { status: "email_drafted", currentState: "waiting_user_send", statusColor: "amber" });
    return draft;
  });
  server.post("/api/outreach/drafts/auto", async (request) => {
    const body = AutoOutreachDraftBody.parse(request.body ?? {});
    const profileId = await resolveProfileId(body.profileId);
    const research = await researchCustomerWebsite(body.website, body.researchDepth, {
      email: body.email,
      deepResearch,
      cache: customerResearchCache
    });
    const lead = await outreachLeads.create({
      profileId,
      companyName: research.companyName || companyNameFromWebsite(research.website) || companyNameFromEmail(body.email),
      website: research.website,
      email: body.email,
      country: "",
      industry: research.industry || "",
      contactName: "",
      contactTitle: "",
      need: research.inferredNeed || "",
      notes: formatCustomerResearchNotes(research),
      tags: ["auto-researched", "fast-draft"]
    });
    const draft = await generateFastOutreachDraft({
      lead,
      body,
      profileId,
      runtime,
      providers,
      companyProfile,
      materials,
      emailSignature: outreachEmailSignature,
      assets: outreachAssets,
      drafts: outreachDrafts,
      research
    });
    await outreachLeads.update(lead.id, { status: "email_drafted", currentState: "waiting_user_send", statusColor: "amber" });
    return draft;
  });
  server.post("/api/outreach/workflows/auto", async (request) => {
    const body = AutoOutreachDraftBody.parse(request.body ?? {});
    const workflow = await generateOutreachWorkflow({
      body,
      runtime,
      providers,
      companyProfile,
      materials,
      emailSignature: outreachEmailSignature,
      assets: outreachAssets,
      leads: outreachLeads,
      drafts: outreachDrafts,
      workflows: outreachWorkflows,
      deepResearch,
      customerResearchCache,
      cloud,
      profileId: await resolveProfileId(body.profileId)
    });
    await outreachLeads.update(workflow.leadId, { status: "email_drafted", currentState: "waiting_user_send", statusColor: "amber" });
    return workflow;
  });
  server.get("/api/outreach/workflows", async (request) => {
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    return outreachWorkflows.list({ profileId: await resolveProfileId(query.profileId), q: query.q });
  });
  server.get("/api/outreach/workflows/:id", async (request) => {
    const { id } = request.params as { id: string };
    const workflow = await outreachWorkflows.require(id);
    await assertActiveProfile(workflow.profileId);
    return workflow;
  });
  server.get("/api/outreach/campaigns", async (request) => {
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    return outreachCampaigns.listWithRecipients({ profileId: await resolveProfileId(query.profileId), q: query.q }, outreachDrafts);
  });
  server.post("/api/outreach/campaigns", async (request) => {
    const body = CreateOutreachCampaignBody.parse(request.body ?? {});
    const profileId = await resolveProfileId(body.profileId);
    if (body.senderAccountId) {
      const sender = await outreachSenders.require(body.senderAccountId);
      if (sender.profileId !== profileId) throw new ClientInputError("Sender account belongs to another profile.");
    }
    const leads = await Promise.all(body.leadIds.map((id) => outreachLeads.require(id)));
    return outreachCampaigns.create({
      profileId,
      name: body.name,
      description: body.description,
      senderAccountId: body.senderAccountId,
      language: normalizeOutreachEmailLanguage(body.language),
      tone: body.tone,
      providerId: body.providerId,
      model: body.model,
      generationMode: body.generationMode,
      researchDepth: body.researchDepth,
      rateLimit: body.rateLimit,
      leads
    });
  });
  server.get("/api/outreach/campaigns/:id", async (request) => {
    const { id } = request.params as { id: string };
    const campaign = await outreachCampaigns.requireWithRecipients(id, outreachDrafts);
    await assertActiveProfile(campaign.profileId);
    return campaign;
  });
  server.post("/api/outreach/campaigns/:id/generate", async (request) => {
    const { id } = request.params as { id: string };
    const campaign = await outreachCampaigns.require(id);
    await assertActiveProfile(campaign.profileId);
    return generateOutreachCampaignWorkflows({
      campaignId: id,
      runtime,
      providers,
      companyProfile,
      materials,
      emailSignature: outreachEmailSignature,
      assets: outreachAssets,
      leads: outreachLeads,
      drafts: outreachDrafts,
      workflows: outreachWorkflows,
      campaigns: outreachCampaigns,
      deepResearch,
      customerResearchCache,
      cloud
    });
  });
  server.post("/api/outreach/campaigns/:id/generate/start", async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await startCampaignGeneration(id);
    return reply.code(202).send(campaign);
  });
  server.post("/api/outreach/campaigns/:id/recipients/:recipientId/approve", async (request) => {
    const { id, recipientId } = request.params as { id: string; recipientId: string };
    const campaign = await outreachCampaigns.require(id);
    await assertActiveProfile(campaign.profileId);
    const body = ApproveOutreachCampaignRecipientBody.parse(request.body ?? {});
    return approveOutreachCampaignRecipient({
      campaignId: id,
      recipientId,
      subject: body.subject,
      body: body.body,
      companyProfile,
      materials,
      assets: outreachAssets,
      drafts: outreachDrafts,
      workflows: outreachWorkflows,
      campaigns: outreachCampaigns
    });
  });
  server.post("/api/outreach/campaigns/:id/recipients/:recipientId/review", async (request) => {
    const { id, recipientId } = request.params as { id: string; recipientId: string };
    const campaign = await outreachCampaigns.require(id);
    await assertActiveProfile(campaign.profileId);
    return reviewOutreachCampaignRecipient(id, recipientId, outreachLeads, outreachDrafts, outreachWorkflows, outreachCampaigns);
  });
  server.post("/api/outreach/campaigns/:id/recipients/:recipientId/rewrite", async (request) => {
    const { id, recipientId } = request.params as { id: string; recipientId: string };
    const campaign = await outreachCampaigns.require(id);
    await assertActiveProfile(campaign.profileId);
    const body = RewriteOutreachDraftBody.parse(request.body ?? {});
    return rewriteOutreachCampaignRecipient({
      campaignId: id,
      recipientId,
      body,
      runtime,
      providers,
      companyProfile,
      materials,
      assets: outreachAssets,
      leads: outreachLeads,
      drafts: outreachDrafts,
      workflows: outreachWorkflows,
      campaigns: outreachCampaigns
    });
  });
  server.post("/api/outreach/campaigns/:id/recipients/:recipientId/skip", async (request) => {
    const { id, recipientId } = request.params as { id: string; recipientId: string };
    const campaign = await outreachCampaigns.require(id);
    await assertActiveProfile(campaign.profileId);
    return skipOutreachCampaignRecipient(id, recipientId, outreachCampaigns, outreachDrafts);
  });
  server.post("/api/outreach/campaigns/:id/start", async (request) => {
    const { id } = request.params as { id: string };
    const campaign = await outreachCampaigns.require(id);
    await assertActiveProfile(campaign.profileId);
    const body = StartOutreachCampaignBody.parse(request.body ?? {});
    const sentCampaign = await sendOutreachCampaignBatch({
      campaignId: id,
      senderAccountId: body.senderAccountId,
      leads: outreachLeads,
      drafts: outreachDrafts,
      senders: outreachSenders,
      campaigns: outreachCampaigns,
      companyProfile,
      materials,
      assets: outreachAssets,
      emailSignature: outreachEmailSignature
    });
    await scheduleOutreachFollowUps({
      campaignId: id,
      senderAccountId: body.senderAccountId,
      mode: "confirm",
      drafts: outreachDrafts,
      workflows: outreachWorkflows,
      followUps: outreachFollowUps,
      campaigns: outreachCampaigns
    });
    return sentCampaign;
  });
  server.post("/api/outreach/campaigns/:id/schedule-followups", async (request) => {
    const { id } = request.params as { id: string };
    const campaign = await outreachCampaigns.require(id);
    await assertActiveProfile(campaign.profileId);
    const body = ScheduleOutreachFollowUpsBody.parse(request.body ?? {});
    const sender = await outreachSenders.require(body.senderAccountId);
    await assertActiveProfile(sender.profileId);
    return scheduleOutreachFollowUps({
      campaignId: id,
      senderAccountId: body.senderAccountId,
      mode: body.mode,
      drafts: outreachDrafts,
      workflows: outreachWorkflows,
      followUps: outreachFollowUps,
      campaigns: outreachCampaigns
    });
  });
  server.post("/api/outreach/campaigns/:id/pause", async (request) => {
    const { id } = request.params as { id: string };
    const campaign = await outreachCampaigns.require(id);
    await assertActiveProfile(campaign.profileId);
    await outreachCampaigns.updateCampaign(id, { status: "paused", pausedAt: new Date().toISOString() });
    return outreachCampaigns.requireWithRecipients(id, outreachDrafts);
  });
  server.post("/api/outreach/campaigns/:id/resume", async (request) => {
    const { id } = request.params as { id: string };
    const campaign = await outreachCampaigns.require(id);
    await assertActiveProfile(campaign.profileId);
    if (campaign.status === "stopped") throw new ClientInputError("Stopped campaigns cannot be resumed.");
    await outreachCampaigns.updateCampaign(id, { status: "ready", pausedAt: undefined });
    return outreachCampaigns.requireWithRecipients(id, outreachDrafts);
  });
  server.post("/api/outreach/campaigns/:id/stop", async (request) => {
    const { id } = request.params as { id: string };
    const campaign = await outreachCampaigns.require(id);
    await assertActiveProfile(campaign.profileId);
    await stopOutreachCampaign(id, outreachCampaigns, outreachDrafts);
    for (const recipient of (await outreachCampaigns.requireWithRecipients(id, outreachDrafts)).recipients) {
      await outreachFollowUps.stopByRecipient(recipient.id, "Campaign stopped by user.");
    }
    return outreachCampaigns.requireWithRecipients(id, outreachDrafts);
  });
  server.get("/api/outreach/followups", async (request) => {
    const query = z.object({
      profileId: z.string().min(1).optional(),
      campaignId: z.string().min(1).optional(),
      recipientId: z.string().min(1).optional()
    }).strict().parse(request.query ?? {});
    return outreachFollowUps.list({ profileId: await resolveProfileId(query.profileId), campaignId: query.campaignId, recipientId: query.recipientId });
  });
  server.post("/api/outreach/followups/tick", async (request) => {
    const body = TickOutreachFollowUpsBody.parse(request.body ?? {});
    return tickOutreachFollowUps({
      now: body.now ?? new Date().toISOString(),
      limit: body.limit,
      senders: outreachSenders,
      drafts: outreachDrafts,
      leads: outreachLeads,
      campaigns: outreachCampaigns,
      followUps: outreachFollowUps,
      companyProfile,
      materials,
      assets: outreachAssets,
      emailSignature: outreachEmailSignature
    });
  });
  server.get("/api/outreach/followups/stats", async (request) => {
    const query = z.object({ profileId: z.string().min(1).optional(), campaignId: z.string().min(1).optional() }).strict().parse(request.query ?? {});
    return outreachFollowUps.stats({ profileId: await resolveProfileId(query.profileId), campaignId: query.campaignId });
  });
  server.put("/api/outreach/drafts/:id", async (request) => {
    const { id } = request.params as { id: string };
    const draft = await outreachDrafts.require(id);
    await assertActiveProfile(draft.profileId);
    return outreachDrafts.update(id, UpdateOutreachDraftBody.parse(request.body ?? {}));
  });
  server.post("/api/outreach/drafts/:id/review", async (request) => {
    const { id } = request.params as { id: string };
    const draft = await outreachDrafts.require(id);
    await assertActiveProfile(draft.profileId);
    const lead = draft.leadId ? await outreachLeads.get(draft.leadId) : undefined;
    const review = reviewOutreachEmail({ subject: draft.subject, body: draft.body, lead });
    const companyKnowledgeContext = await buildCompanyKnowledgeContext(companyProfile, materials);
    const sendRiskReview = reviewOutreachSendRisk({
      subject: draft.subject,
      body: draft.body,
      qualityReview: review,
      lead,
      evidenceLock: draft.evidenceLock,
      ctaAssets: await outreachAssets.listCtaAssets(await resolveProfileId(draft.profileId)),
      companyKnowledgeContext
    });
    await outreachDrafts.update(id, { qualityReview: review, sendRiskReview });
    return review;
  });
  server.post("/api/outreach/drafts/:id/rewrite", async (request) => {
    const { id } = request.params as { id: string };
    const draft = await outreachDrafts.require(id);
    await assertActiveProfile(draft.profileId);
    const body = RewriteOutreachDraftBody.parse(request.body ?? {});
    const lead = draft.leadId ? await outreachLeads.get(draft.leadId) : undefined;
    return rewriteOutreachDraft({
      draft,
      lead,
      body,
      runtime,
      providers,
      companyProfile,
      materials,
      assets: outreachAssets,
      drafts: outreachDrafts
    });
  });
  server.get("/api/outreach/email-signature", async () => outreachEmailSignature.get());
  server.put("/api/outreach/email-signature", async (request) => (
    outreachEmailSignature.update(UpdateOutreachEmailSignatureBody.parse(request.body ?? {}))
  ));
  server.post("/api/outreach/email-signature/logo", async (request) => {
    if (!isMultipartRequest(request)) throw new ClientInputError("Upload the logo as multipart/form-data with one file field named file.");
    return outreachEmailSignature.uploadLogo(await readSignatureLogoUpload(request));
  });
  server.get("/api/outreach/email-signature/logo", async (_request, reply) => {
    const logo = await outreachEmailSignature.readLogo();
    if (!logo) return reply.code(404).send({ error: "Signature logo not found." });
    reply.header("Content-Type", logo.mimeType);
    reply.header("Content-Disposition", `inline; filename="${safeDownloadName(logo.fileName)}"`);
    return reply.send(logo.buffer);
  });
  server.delete("/api/outreach/email-signature/logo", async () => outreachEmailSignature.deleteLogo());
  server.get("/api/outreach/sender-accounts", async (request) => {
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    return (await outreachSenders.list({ profileId: await resolveProfileId(query.profileId) })).map(publicOutreachSender);
  });
  server.post("/api/outreach/sender-accounts", async (request) => {
    const body = CreateOutreachSenderBody.parse(request.body ?? {});
    return publicOutreachSender(await outreachSenders.create({ ...body, profileId: await resolveProfileId(body.profileId) }));
  });
  server.put("/api/outreach/sender-accounts/:id", async (request) => {
    const { id } = request.params as { id: string };
    const sender = await outreachSenders.require(id);
    await assertActiveProfile(sender.profileId);
    return publicOutreachSender(await outreachSenders.update(id, UpdateOutreachSenderBody.parse(request.body ?? {})));
  });
  server.post("/api/outreach/sender-accounts/:id/test", async (request) => {
    const { id } = request.params as { id: string };
    const sender = await outreachSenders.require(id);
    await assertActiveProfile(sender.profileId);
    return outreachSenders.test(id);
  });
  server.post("/api/outreach/sender-accounts/:id/test-email", async (request) => {
    const { id } = request.params as { id: string };
    const sender = await outreachSenders.require(id);
    await assertActiveProfile(sender.profileId);
    const body = SendOutreachTestEmailBody.parse(request.body ?? {});
    return outreachSenders.sendTestEmail(id, body.to);
  });
  server.post("/api/outreach/sender-accounts/:id/confirm-delivery", async (request) => {
    const { id } = request.params as { id: string };
    const sender = await outreachSenders.require(id);
    await assertActiveProfile(sender.profileId);
    return {
      ok: true,
      message: "Test email delivery confirmed.",
      sender: publicOutreachSender(await outreachSenders.confirmDelivery(id))
    };
  });
  server.post("/api/outreach/inbox/check", async (request) => {
    const body = CheckOutreachInboxBody.parse(request.body ?? {});
    const sender = await outreachSenders.require(body.senderAccountId);
    await assertActiveProfile(sender.profileId);
    return checkOutreachInbox({
      sender,
      campaignId: body.campaignId,
      senders: outreachSenders,
      drafts: outreachDrafts,
      campaigns: outreachCampaigns,
      followUps: outreachFollowUps
    });
  });
  server.delete("/api/outreach/sender-accounts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const sender = await outreachSenders.require(id);
    await assertActiveProfile(sender.profileId);
    await outreachSenders.remove(id);
    return reply.code(204).send();
  });
  server.post("/api/outreach/drafts/:id/send", async (request) => {
    const { id } = request.params as { id: string };
    const draft = await outreachDrafts.require(id);
    await assertActiveProfile(draft.profileId);
    const body = SendOutreachDraftBody.parse(request.body ?? {});
    const sender = await outreachSenders.require(body.senderAccountId);
    await assertActiveProfile(sender.profileId);
    const lead = draft.leadId ? await outreachLeads.get(draft.leadId) : undefined;
    const sent = await sendOutreachDraft({
      draft,
      sender,
      lead,
      to: body.to,
      senders: outreachSenders,
      drafts: outreachDrafts,
      emailSignature: outreachEmailSignature,
      ctaAssets: await outreachAssets.listCtaAssets(await resolveProfileId(draft.profileId)),
      companyKnowledgeContext: await buildCompanyKnowledgeContext(companyProfile, materials)
    });
    if (lead) await outreachLeads.update(lead.id, { status: "email_sent", currentState: "waiting_response_status", statusColor: "blue", currentRound: Math.max(lead.currentRound ?? 0, 1) });
    return sent;
  });
  server.get("/api/outreach/feedback", async (request) => {
    const query = OutreachLeadListQuery.parse(request.query ?? {});
    return outreachFeedback.list({ profileId: await resolveProfileId(query.profileId) });
  });
  server.post("/api/outreach/feedback", async (request) => {
    const body = CreateOutreachFeedbackBody.parse(request.body ?? {});
    return outreachFeedback.create({ ...body, profileId: await resolveProfileId() });
  });
  server.get("/api/materials", async () => (await materials.listPersonal()).map(publicMaterial));
  server.post("/api/materials", async (request) => {
    if (isMultipartRequest(request)) {
      return publicMaterial(await materials.createFromMultipart(await readMaterialUpload(request)));
    }
    return publicMaterial(await materials.createFromJson(UploadMaterialBody.parse(request.body)));
  });
  server.get("/api/materials/:id/preview", async (request) => {
    const { id } = request.params as { id: string };
    return materials.preview(id);
  });
  server.get("/api/materials/:id/download", async (request, reply) => {
    const { id } = request.params as { id: string };
    const download = await materials.download(id);
    reply.header("Content-Type", download.mimeType);
    reply.header("Content-Disposition", `attachment; filename="${safeDownloadName(download.fileName)}"`);
    return reply.send(download.buffer);
  });
  server.put("/api/materials/:id", async (request) => {
    const { id } = request.params as { id: string };
    return publicMaterial(await materials.update(id, UpdateMaterialBody.parse(request.body ?? {})));
  });
  server.post("/api/materials/:id/copy", async (request) => {
    const { id } = request.params as { id: string };
    return publicMaterial(await materials.copy(id, CopyMaterialBody.parse(request.body ?? {})));
  });
  server.delete("/api/materials/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await materials.remove(id);
    return reply.code(204).send();
  });
  server.get("/api/usage/summary", async () => usageSummary(await chats.list(), await materials.list(), await providers.list(), await agents.list()));
  server.get("/api/analytics/summary", async () => analyticsSummary(
    usageSummary(await chats.list(), await materials.list(), await providers.list(), await agents.list()),
    await jobs.list({ includeDeleted: true }),
    await jobs.allRuns(),
    await channels.list(),
    await logs.list({ limit: 500 })
  ));
  server.get("/api/analytics/usage", async (request) => {
    const query = AnalyticsUsageQuery.parse(request.query ?? {});
    return analyticsUsage(await chats.list(), await jobs.allRuns(), query.source, query.bucket);
  });
  server.get("/api/logs", async (request) => logs.list(LogListQuery.parse(request.query ?? {})));
  server.post("/api/logs", async (request) => logs.create(CreateLogBody.parse(request.body ?? {})));
  server.get("/api/logs/export", async (request, reply) => {
    const entries = await logs.list(LogListQuery.parse(request.query ?? {}));
    reply.header("Content-Type", "application/x-ndjson; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="hermills-logs.ndjson"`);
    return reply.send(entries.map((entry) => JSON.stringify(entry)).join("\n"));
  });

  server.setErrorHandler(async (error, request, reply) => {
    const code = error instanceof CloudError ? error.code : error instanceof z.ZodError || error instanceof ClientInputError ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
    const status = error instanceof CloudError ? error.status : error instanceof z.ZodError || error instanceof ClientInputError ? 400 : 500;
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    const stack = error instanceof Error ? error.stack : undefined;
    const route = `${request.method} ${request.url}`;
    const diagnostic = `${route} -> ${code}: ${message}`;
    server.log.error(redactSecrets(stack ? `${diagnostic}\n${stack}` : diagnostic));
    await logs.create({ source: "server", level: "error", message: diagnostic }).catch(() => undefined);
    await reply.code(status).send(errorBody(code, message, error instanceof z.ZodError ? error.flatten() : undefined));
  });

  return server;
}

async function createComputerControlReply(runtime: RuntimeAdapter, prompt: string): Promise<ChatMessage> {
  let replyText = "";
  try {
    const result = await runtime.runComputerControlPrompt(prompt);
    const output = redactSecrets(result.output.trim());
    if (result.ok) {
      replyText = output
        ? `我已经按你的要求操作这台电脑。\n\n${output}`
        : "我已经按你的要求操作这台电脑。";
    } else {
      replyText = output
        ? `这次没有完成电脑操作。\n\n${output}`
        : `这次没有完成电脑操作。${redactSecrets(result.message)}`;
    }
  } catch (error) {
    const detail = redactSecrets(error instanceof Error ? error.message : String(error));
    replyText = [
      "我已经把电脑操作作为内置能力处理，但这次还没有完成。",
      "如果系统弹出“屏幕录制、辅助功能、自动化、文件夹权限”的请求，请允许 Hermills/Hermes。",
      `详细原因：${detail}`
    ].join("\n\n");
  }

  return {
    id: randomUUID(),
    role: "assistant",
    content: replyText,
    usage: estimateMessageUsage(prompt, replyText),
    createdAt: new Date().toISOString()
  };
}

function isComputerControlRequest(content: string): boolean {
  const text = content.trim().toLowerCase();
  if (!text) return false;
  return [
    /电脑.{0,12}(控制|操作|接管|点击|输入|打开)/,
    /(控制|操作|接管).{0,12}(电脑|这台\s*mac|mac|屏幕|鼠标|键盘)/,
    /hermes.{0,16}(控制|操作).{0,12}(电脑|mac)/i,
    /terminal\s+hermes.{0,16}(computer|control|operate)/i,
    /(control|operate|use).{0,16}(my|this)?\s*(computer|mac|screen|mouse|keyboard)/i,
    /computer\s+control/i
  ].some((pattern) => pattern.test(text));
}

async function createAssistantReply(
  session: ChatSession,
  runtime: RuntimeAdapter,
  agents: AgentRepository,
  providers: ProviderRepository,
  attachedMaterials: MaterialRecord[] = [],
  companyKnowledgeContext = ""
): Promise<ChatMessage> {
  try {
    const agent = session.agentId ? await agents.get(session.agentId).catch(() => undefined) : undefined;
    const providerId = session.providerId ?? agent?.providerId;
    const providerRecord = providerId ? await providers.get(providerId).catch(() => undefined) : undefined;
    const apiKey = providerRecord ? await providers.readApiKey(providerRecord).catch(() => undefined) : undefined;
    const provider = providerRecord ? {
      kind: providerRecord.kind,
      baseUrl: providerRecord.baseUrl,
      apiKey,
      defaultModel: providerRecord.defaultModel
    } : undefined;
    const runtimeMessages = withRuntimeCompanyKnowledge(withRuntimeAttachedMaterials(session.messages, attachedMaterials), companyKnowledgeContext);
    const promptText = runtimeMessages.map((message) => message.content).join("\n");
    const replyText = await runtime.createHermesReply({
      messages: runtimeMessages,
      model: session.model ?? agent?.model,
      instructions: agent?.instructions,
      provider
    });
    return {
      id: randomUUID(),
      role: "assistant",
      content: replyText,
      usage: estimateMessageUsage(promptText, replyText),
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    const fallback = assistantFailureMessage(error);
    return {
      id: randomUUID(),
      role: "assistant",
      content: fallback,
      usage: estimateMessageUsage(session.messages.map((message) => message.content).join("\n"), fallback),
      createdAt: new Date().toISOString()
    };
  }
}

function assistantFailureMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (/No inference provider configured|OPENROUTER_API_KEY|OPENAI_API_KEY|API key|provider is missing an API key|missing-key/i.test(detail)) {
    return `Hermes is installed, but no model API key is ready. Add one API key in Hermills, then send again. Detail: ${detail}`;
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|timeout|401|403|invalid_api_key/i.test(detail)) {
    return `Hermills could not reach the selected model provider. Check the API key and provider URL, then try again. Detail: ${detail}`;
  }
  return `Hermes is not ready yet. Start Hermes, then retry. Detail: ${detail}`;
}

async function completeOnboarding(
  input: OnboardingUpdate,
  onboarding: OnboardingRepository,
  profiles: ProfileRepository,
  agents: AgentRepository,
  providers: ProviderRepository,
  runtime: RuntimeAdapter,
  logs: LogRepository
): Promise<OnboardingState> {
  const draft = await onboarding.update(input);
  const providerInput = input.provider === undefined ? draft.provider : input.provider;
  const provider = providerInput ? await upsertOnboardingProvider(providerInput, providers) : undefined;
  if (provider) {
    const providerRecord = await providers.get(provider.id);
    if (providerRecord) {
      await syncRuntimeInferenceProvider(runtime, providerRecord, await providers.readApiKey(providerRecord).catch(() => undefined), logs);
    }
  }
  const providerState = provider ? onboardingProviderFromCredential(provider) : undefined;
  const profileState = await profiles.list();
  const activeProfileId = profileState.activeProfileId;
  await profiles.update(activeProfileId, {
    name: displayNameOrDefault(draft.userDisplayName, profileState.profiles.find((profile) => profile.id === activeProfileId)?.name ?? "Personal"),
    active: true
  });
  const agent = await upsertDefaultOnboardingAgent({
    state: draft,
    defaultAgentId: draft.defaultAgentId,
    providerId: provider?.id,
    agents
  });
  return onboarding.saveState({
    provider: providerState ?? null,
    defaultAgentId: agent.id,
    onboardingCompletedAt: new Date().toISOString()
  });
}

async function upsertOnboardingProvider(input: OnboardingProviderUpsert, providers: ProviderRepository): Promise<PublicProviderCredential> {
  const payload = {
    kind: input.kind,
    displayName: input.displayName,
    baseUrl: input.baseUrl,
    defaultModel: input.defaultModel,
    apiKey: input.apiKey,
    enabled: input.enabled
  };
  const existing = input.id ? await providers.get(input.id) : undefined;
  return publicProvider(existing ? await providers.update(existing.id, payload) : await providers.create(payload));
}

function onboardingProviderFromCredential(provider: PublicProviderCredential): OnboardingProviderState {
  return {
    id: provider.id,
    kind: provider.kind,
    displayName: provider.displayName,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel,
    keyPreview: provider.keyPreview,
    enabled: provider.enabled
  };
}

async function syncDefaultRuntimeInferenceProvider(
  runtime: RuntimeAdapter,
  providers: ProviderRepository,
  logs: LogRepository
): Promise<void> {
  const provider = (await providers.list()).find((item) => item.enabled && item.kind !== "local" && Boolean(item.credentialRef));
  if (!provider) return;
  await syncRuntimeInferenceProvider(runtime, provider, await providers.readApiKey(provider).catch(() => undefined), logs);
}

async function syncRuntimeInferenceProvider(
  runtime: RuntimeAdapter,
  provider: ProviderCredential,
  apiKey: string | undefined,
  logs: LogRepository
): Promise<void> {
  if (!runtime.configureInferenceProvider || provider.kind === "local" || !apiKey) return;
  try {
    await runtime.configureInferenceProvider({
      kind: provider.kind,
      baseUrl: provider.baseUrl,
      apiKey,
      defaultModel: provider.defaultModel
    });
    await logs.create({
      source: "server",
      level: "info",
      message: `Synced local Hermes inference provider: ${provider.displayName} (${provider.defaultModel ?? "default model"}).`
    });
  } catch (error) {
    await logs.create({
      source: "server",
      level: "warn",
      message: `Could not sync local Hermes inference provider: ${redactSecrets(error instanceof Error ? error.message : String(error))}`
    });
  }
}

async function upsertDefaultOnboardingAgent(input: {
  state: OnboardingState;
  defaultAgentId?: string;
  providerId?: string;
  agents: AgentRepository;
}) {
  const displayName = displayNameOrDefault(input.state.agentName, "Hermes");
  const agentInput = {
    displayName,
    description: defaultOnboardingAgentDescription(input.state.language),
    instructions: defaultOnboardingInstructions(displayName, input.state),
    model: input.state.provider?.defaultModel ?? "hermes-agent",
    providerId: input.providerId,
    capabilities: {
      memory: input.state.memoryEnabled,
      files: true,
      tools: false,
      approvals: "on-demand" as const
    }
  };
  const existing = input.defaultAgentId ? await input.agents.get(input.defaultAgentId) : undefined;
  return existing ? input.agents.update(existing.id, agentInput) : input.agents.create(agentInput);
}

function defaultOnboardingAgentDescription(language: string | undefined): string {
  const normalized = language?.toLowerCase().replace(/_/g, "-") ?? "";
  if (normalized === "zh" || normalized.startsWith("zh-cn") || normalized.startsWith("zh-hans")) return "首次设置时创建的默认助手。";
  if (normalized.startsWith("zh-tw") || normalized.startsWith("zh-hk") || normalized.startsWith("zh-mo") || normalized.startsWith("zh-hant")) return "首次設定時建立的預設助手。";
  if (normalized.startsWith("ja")) return "初期設定で作成された既定アシスタントです。";
  if (normalized.startsWith("ko")) return "초기 설정 중 생성된 기본 도우미입니다.";
  return "Default assistant created during onboarding.";
}

function defaultOnboardingInstructions(agentName: string, state: OnboardingState): string {
  const userName = displayNameOrDefault(state.userDisplayName, "");
  return [
    `You are ${agentName}, the user's default Hermills assistant.`,
    "Be concise, practical, and explicit about local runtime limitations.",
    `Prefer the user's onboarding language (${state.language}) unless they ask otherwise.`,
    userName ? `The user's display name is ${userName}.` : undefined
  ].filter(Boolean).join("\n");
}

function displayNameOrDefault(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= 2 ? trimmed : fallback;
}

function allowedRendererOrigins(): string[] {
  const origins = new Set<string>();
  for (const port of [5177, 5178, 5179, 5180, 5181, 5182]) {
    origins.add(`http://127.0.0.1:${port}`);
    origins.add(`http://localhost:${port}`);
  }
  const rendererUrl = process.env.HERMILLS_RENDERER_URL;
  if (rendererUrl) {
    try {
      origins.add(new URL(rendererUrl).origin);
    } catch {
      // Keep the default dev origins when a malformed renderer URL is supplied.
    }
  }
  return [...origins];
}

interface AppStateResponse extends AppState {
  shouldShowFirstDeploy: boolean;
  runtimeRecoverable: boolean;
}

class AppStateRepository {
  private readonly filePath: string;

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "app-state.json");
  }

  async response(runtimeStatus: unknown): Promise<AppStateResponse> {
    const status = RuntimeStatusSchema.safeParse(runtimeStatus).success ? RuntimeStatusSchema.parse(runtimeStatus) : undefined;
    const state = status ? await this.migrateFromRuntime(stateFromUnknown(await this.read()), status) : stateFromUnknown(await this.read());
    return {
      ...state,
      shouldShowFirstDeploy: !state.firstDeployHidden,
      runtimeRecoverable: Boolean(status?.installed && status.gateway?.state !== "running")
    };
  }

  async markLocalDeployComplete(runtimeStatus: unknown): Promise<AppState> {
    const status = RuntimeStatusSchema.parse(runtimeStatus);
    const current = await this.read();
    if (!status.installed || status.gateway?.state !== "running") return current;
    const now = new Date().toISOString();
    const next = AppStateDocumentSchema.parse({
      ...current,
      firstDeployHidden: true,
      localDeployCompletedAt: current.localDeployCompletedAt ?? status.installMetadata?.installedAt ?? now,
      lastSuccessfulRuntimeVersion: status.version ?? status.installMetadata?.version ?? current.lastSuccessfulRuntimeVersion,
      lastSuccessfulGatewayAt: status.gateway?.state === "running" ? now : current.lastSuccessfulGatewayAt
    });
    await this.write(next);
    return next;
  }

  async resetFirstRun(): Promise<AppStateResponse> {
    const next = AppStateDocumentSchema.parse({ firstDeployHidden: false });
    await this.write(next);
    return {
      ...next,
      shouldShowFirstDeploy: true,
      runtimeRecoverable: false
    };
  }

  private async migrateFromRuntime(current: AppState, status: RuntimeStatus): Promise<AppState> {
    if (current.firstDeployHidden || !status.installed || status.gateway?.state !== "running" || !status.installMetadata?.installedAt) return current;
    const next = AppStateDocumentSchema.parse({
      ...current,
      firstDeployHidden: true,
      localDeployCompletedAt: status.installMetadata.installedAt,
      lastSuccessfulRuntimeVersion: status.version ?? status.installMetadata.version,
      lastSuccessfulGatewayAt: status.gateway?.state === "running" ? new Date().toISOString() : current.lastSuccessfulGatewayAt
    });
    await this.write(next);
    return next;
  }

  private async read(): Promise<AppState> {
    try {
      return stateFromUnknown(JSON.parse(await readFile(this.filePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return AppStateDocumentSchema.parse({});
      throw error;
    }
  }

  private async write(document: AppState): Promise<void> {
    await writePrivateJson(this.filePath, AppStateDocumentSchema.parse(document));
  }
}

type OnboardingStatePatch = Partial<Omit<OnboardingState, "version" | "provider">> & {
  provider?: OnboardingProviderState | null;
};

class OnboardingRepository {
  private readonly filePath: string;

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "onboarding.json");
  }

  async get(): Promise<OnboardingState> {
    return OnboardingStateSchema.parse(await this.read());
  }

  async update(input: OnboardingUpdate): Promise<OnboardingState> {
    const { onboardingCompletedAt, provider, ...rest } = input;
    const patch: OnboardingStatePatch = rest;
    if (hasOwn(input, "onboardingCompletedAt")) patch.onboardingCompletedAt = onboardingCompletedAt ?? undefined;
    if (hasOwn(input, "provider")) patch.provider = provider ? publicOnboardingProvider(provider) : null;
    return this.writeMerged(patch);
  }

  async saveState(input: OnboardingStatePatch): Promise<OnboardingState> {
    return this.writeMerged(input);
  }

  private async writeMerged(input: OnboardingStatePatch): Promise<OnboardingState> {
    const current = await this.get();
    const { provider, ...rest } = input;
    const next = OnboardingStateSchema.parse({
      ...current,
      ...rest,
      provider: hasOwn(input, "provider") ? provider ?? undefined : current.provider
    });
    await this.write(next);
    return next;
  }

  private async read(): Promise<unknown> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  private async write(document: OnboardingState): Promise<void> {
    await writePrivateJson(this.filePath, OnboardingStateSchema.parse(document));
  }
}

function stateFromUnknown(value: unknown): AppState {
  return AppStateDocumentSchema.parse(value ?? {});
}

interface ProfileRecord {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProfileStoreDocument {
  profiles: ProfileRecord[];
  activeProfileId?: string;
}

class ProfileRepository {
  private readonly filePath: string;

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "profiles.json");
  }

  async list(): Promise<{ profiles: ProfileRecord[]; activeProfileId: string }> {
    const document = await this.ensureDefault(await this.read());
    return { profiles: document.profiles, activeProfileId: document.activeProfileId ?? document.profiles[0].id };
  }

  async create(input: z.infer<typeof CreateProfileBody>): Promise<{ profiles: ProfileRecord[]; activeProfileId: string }> {
    const now = new Date().toISOString();
    const document = await this.ensureDefault(await this.read());
    const profile: ProfileRecord = { id: randomUUID(), name: input.name, active: false, createdAt: now, updatedAt: now };
    document.profiles.push(profile);
    await this.write(document);
    return this.list();
  }

  async update(id: string, input: z.infer<typeof UpdateProfileBody>): Promise<{ profiles: ProfileRecord[]; activeProfileId: string }> {
    const document = await this.ensureDefault(await this.read());
    const index = document.profiles.findIndex((profile) => profile.id === id);
    if (index === -1) throw new Error(`Profile not found: ${id}`);
    document.profiles[index] = {
      ...document.profiles[index],
      name: input.name ?? document.profiles[index].name,
      updatedAt: new Date().toISOString()
    };
    if (input.active) document.activeProfileId = id;
    await this.write(document);
    return this.list();
  }

  async remove(id: string): Promise<void> {
    const document = await this.ensureDefault(await this.read());
    if (document.profiles.length <= 1) throw new ClientInputError("Keep at least one profile.");
    const profiles = document.profiles.filter((profile) => profile.id !== id);
    if (profiles.length === document.profiles.length) throw new Error(`Profile not found: ${id}`);
    const activeProfileId = document.activeProfileId === id ? profiles[0].id : document.activeProfileId;
    await this.write({ profiles, activeProfileId });
  }

  private async ensureDefault(document: ProfileStoreDocument): Promise<ProfileStoreDocument> {
    if (document.profiles.length) {
      const activeProfileId = document.activeProfileId ?? document.profiles[0].id;
      return {
        profiles: document.profiles.map((profile) => ({ ...profile, active: profile.id === activeProfileId })),
        activeProfileId
      };
    }
    const now = new Date().toISOString();
    const profile = { id: randomUUID(), name: "Personal", active: true, createdAt: now, updatedAt: now };
    const next = { profiles: [profile], activeProfileId: profile.id };
    await this.write(next);
    return next;
  }

  private async read(): Promise<ProfileStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as ProfileStoreDocument;
      return { profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [], activeProfileId: parsed.activeProfileId };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { profiles: [] };
      throw error;
    }
  }

  private async write(document: ProfileStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, document);
  }
}

interface JobStoreDocument {
  jobs: JobRecord[];
}

interface JobRunStoreDocument {
  runs: JobRunRecord[];
}

interface JobListOptions {
  profileId?: string;
  status?: JobRecord["status"];
  q?: string;
  includeDeleted?: boolean;
}

class JobRepository {
  private readonly jobsPath: string;
  private readonly runsPath: string;

  constructor(baseDir?: string) {
    this.jobsPath = path.join(getDataHome(baseDir), "cron-jobs.json");
    this.runsPath = path.join(getDataHome(baseDir), "job-runs.json");
  }

  async list(options: JobListOptions = {}): Promise<JobRecord[]> {
    const needle = options.q?.trim().toLowerCase();
    return (await this.readJobs()).jobs.filter((job) => {
      if (!options.includeDeleted && job.deletedAt) return false;
      if (options.profileId && job.profileId !== options.profileId) return false;
      if (options.status && job.status !== options.status) return false;
      if (!needle) return true;
      return [job.name, job.description, job.task.prompt, job.task.model].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    });
  }

  async get(id: string): Promise<JobRecord | undefined> {
    return (await this.readJobs()).jobs.find((job) => job.id === id);
  }

  async create(input: z.infer<typeof CreateJobBody> & { profileId: string }): Promise<JobRecord> {
    const now = new Date().toISOString();
    const job = JobRecordSchema.parse({
      id: randomUUID(),
      profileId: input.profileId,
      name: input.name,
      description: input.description ?? "",
      schedule: input.schedule,
      status: input.status ?? "active",
      task: input.task,
      nextRunAt: estimateNextRunAt(now),
      createdAt: now,
      updatedAt: now
    });
    const document = await this.readJobs();
    document.jobs.unshift(job);
    await this.writeJobs(document);
    return job;
  }

  async update(id: string, input: z.infer<typeof UpdateJobBody>): Promise<JobRecord> {
    const document = await this.readJobs();
    const index = document.jobs.findIndex((job) => job.id === id);
    if (index === -1) throw new Error(`Job not found: ${id}`);
    const current = document.jobs[index];
    const now = new Date().toISOString();
    const next = JobRecordSchema.parse({
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      schedule: input.schedule ?? current.schedule,
      status: input.status ?? current.status,
      task: input.task ?? current.task,
      nextRunAt: input.status === "paused" ? undefined : estimateNextRunAt(now),
      updatedAt: now
    });
    document.jobs[index] = next;
    await this.writeJobs(document);
    return next;
  }

  async softDelete(id: string): Promise<void> {
    const document = await this.readJobs();
    const index = document.jobs.findIndex((job) => job.id === id);
    if (index === -1) throw new Error(`Job not found: ${id}`);
    document.jobs[index] = JobRecordSchema.parse({ ...document.jobs[index], deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await this.writeJobs(document);
  }

  async recordRun(run: JobRunRecord): Promise<JobRunRecord> {
    const document = await this.readRuns();
    document.runs.unshift(JobRunRecordSchema.parse(run));
    await this.writeRuns({ runs: document.runs.slice(0, 5000) });
    if (run.status !== "skipped") await this.markRan(run.jobId, run.startedAt);
    return run;
  }

  async runs(jobId: string, limit = 50): Promise<JobRunRecord[]> {
    return (await this.readRuns()).runs.filter((run) => run.jobId === jobId).slice(0, limit);
  }

  async allRuns(): Promise<JobRunRecord[]> {
    return (await this.readRuns()).runs;
  }

  private async markRan(jobId: string, lastRunAt: string): Promise<void> {
    const document = await this.readJobs();
    const index = document.jobs.findIndex((job) => job.id === jobId);
    if (index === -1) return;
    document.jobs[index] = JobRecordSchema.parse({
      ...document.jobs[index],
      lastRunAt,
      nextRunAt: document.jobs[index].status === "active" ? estimateNextRunAt(lastRunAt) : undefined,
      updatedAt: new Date().toISOString()
    });
    await this.writeJobs(document);
  }

  private async readJobs(): Promise<JobStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.jobsPath, "utf8")) as JobStoreDocument;
      return { jobs: Array.isArray(parsed.jobs) ? parsed.jobs.map((job) => JobRecordSchema.parse(job)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { jobs: [] };
      throw error;
    }
  }

  private async writeJobs(document: JobStoreDocument): Promise<void> {
    await writePrivateJson(this.jobsPath, { jobs: document.jobs.map((job) => JobRecordSchema.parse(job)) });
  }

  private async readRuns(): Promise<JobRunStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.runsPath, "utf8")) as JobRunStoreDocument;
      return { runs: Array.isArray(parsed.runs) ? parsed.runs.map((run) => JobRunRecordSchema.parse(run)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { runs: [] };
      throw error;
    }
  }

  private async writeRuns(document: JobRunStoreDocument): Promise<void> {
    await writePrivateJson(this.runsPath, { runs: document.runs.map((run) => JobRunRecordSchema.parse(run)) });
  }
}

interface ChannelStoreDocument {
  channels: ChannelRecord[];
}

interface ChannelListOptions {
  profileId?: string;
  kind?: ChannelRecord["kind"];
}

class ChannelRepository {
  private readonly filePath: string;
  private readonly vault: LocalCredentialVault;

  constructor(private readonly baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "channels.json");
    this.vault = new LocalCredentialVault(baseDir);
  }

  async list(options: ChannelListOptions = {}): Promise<ChannelRecord[]> {
    return (await this.read()).channels.filter((channel) => {
      if (options.profileId && channel.profileId !== options.profileId) return false;
      if (options.kind && channel.kind !== options.kind) return false;
      return true;
    });
  }

  async get(id: string): Promise<ChannelRecord | undefined> {
    return (await this.read()).channels.find((channel) => channel.id === id);
  }

  async create(input: z.infer<typeof CreateChannelBody> & { profileId: string }): Promise<ChannelRecord> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const secretRef = input.secret ? await this.vault.saveSecret(`channel-${id}`, input.secret) : undefined;
    const channel = ChannelRecordSchema.parse({
      id,
      profileId: input.profileId,
      kind: input.kind,
      label: input.label,
      enabled: input.enabled ?? false,
      status: channelStatus(input.enabled ?? false, Boolean(secretRef), input.endpoint),
      endpoint: input.endpoint,
      secretRef,
      secretPreview: input.secret ? previewSecret(input.secret) : undefined,
      config: input.config ?? {},
      createdAt: now,
      updatedAt: now
    });
    const document = await this.read();
    document.channels.unshift(channel);
    await this.write(document);
    return channel;
  }

  async update(id: string, input: z.infer<typeof UpdateChannelBody>): Promise<ChannelRecord> {
    const document = await this.read();
    const index = document.channels.findIndex((channel) => channel.id === id);
    if (index === -1) throw new Error(`Channel not found: ${id}`);
    const current = document.channels[index];
    let secretRef = current.secretRef;
    let secretPreview = current.secretPreview;
    if (input.clearSecret && secretRef) {
      await this.vault.deleteSecret(secretRef);
      secretRef = undefined;
      secretPreview = undefined;
    }
    if (input.secret) {
      if (secretRef) await this.vault.deleteSecret(secretRef);
      secretRef = await this.vault.saveSecret(`channel-${id}`, input.secret);
      secretPreview = previewSecret(input.secret);
    }
    const endpoint = input.endpoint === null ? undefined : input.endpoint ?? current.endpoint;
    const enabled = input.enabled ?? current.enabled;
    const next = ChannelRecordSchema.parse({
      ...current,
      label: input.label ?? current.label,
      enabled,
      endpoint,
      secretRef,
      secretPreview,
      config: input.config ?? current.config,
      status: channelStatus(enabled, Boolean(secretRef), endpoint),
      lastError: undefined,
      updatedAt: new Date().toISOString()
    });
    document.channels[index] = next;
    await this.write(document);
    return next;
  }

  async test(id: string): Promise<{ ok: boolean; status: ChannelRecord["status"]; message?: string }> {
    const document = await this.read();
    const index = document.channels.findIndex((channel) => channel.id === id);
    if (index === -1) throw new Error(`Channel not found: ${id}`);
    const channel = document.channels[index];
    const status = channelStatus(channel.enabled, Boolean(channel.secretRef), channel.endpoint);
    const ok = status === "connected";
    document.channels[index] = ChannelRecordSchema.parse({
      ...channel,
      status,
      lastTestedAt: new Date().toISOString(),
      lastError: ok ? undefined : "Channel is disabled or missing endpoint/secret.",
      updatedAt: new Date().toISOString()
    });
    await this.write(document);
    return { ok, status, message: ok ? "Channel settings are ready." : "Channel is disabled or missing endpoint/secret." };
  }

  async secret(id: string): Promise<string | undefined> {
    const channel = await this.get(id);
    return channel?.secretRef ? this.vault.readSecret(channel.secretRef) : undefined;
  }

  async remove(id: string): Promise<void> {
    const document = await this.read();
    const channel = document.channels.find((item) => item.id === id);
    if (!channel) throw new Error(`Channel not found: ${id}`);
    await this.write({ channels: document.channels.filter((item) => item.id !== id) });
    if (channel.secretRef) await this.vault.deleteSecret(channel.secretRef);
  }

  private async read(): Promise<ChannelStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as ChannelStoreDocument;
      return { channels: Array.isArray(parsed.channels) ? parsed.channels.map((channel) => ChannelRecordSchema.parse(channel)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { channels: [] };
      throw error;
    }
  }

  private async write(document: ChannelStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, { channels: document.channels.map((channel) => ChannelRecordSchema.parse(channel)) });
  }
}

interface ChatControlCommandStoreDocument {
  commands: ChatControlCommand[];
}

interface ChatControlCommandListOptions {
  profileId?: string;
  status?: ChatControlCommand["status"];
  limit?: number;
}

class ChatControlCommandRepository {
  private readonly filePath: string;
  private readonly withWriteLock = createWriteLock();

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "chat-control-commands.json");
  }

  async list(options: ChatControlCommandListOptions = {}): Promise<ChatControlCommand[]> {
    const commands = (await this.read()).commands.filter((command) => {
      if (options.profileId && command.profileId !== options.profileId) return false;
      if (options.status && command.status !== options.status) return false;
      return true;
    });
    return commands.slice(0, options.limit ?? 100);
  }

  async get(id: string): Promise<ChatControlCommand | undefined> {
    return (await this.read()).commands.find((command) => command.id === id);
  }

  async findPendingApproval(code: string, profileId?: string): Promise<ChatControlCommand | undefined> {
    const normalized = code.trim();
    return (await this.read()).commands.find((command) => (
      command.status === "needs-approval"
      && command.approvalCode === normalized
      && (!profileId || command.profileId === profileId)
    ));
  }

  async create(input: Omit<ChatControlCommand, "id" | "status" | "action" | "payload" | "resultText" | "requiresApproval" | "createdAt" | "updatedAt"> & Partial<Pick<ChatControlCommand, "status" | "action" | "payload" | "resultText" | "requiresApproval">>): Promise<ChatControlCommand> {
    return this.withWriteLock(async () => {
      const now = new Date().toISOString();
      const command = ChatControlCommandSchema.parse({
        ...input,
        id: randomUUID(),
        status: input.status ?? "queued",
        action: input.action ?? "unknown",
        payload: input.payload ?? {},
        resultText: input.resultText ?? "",
        requiresApproval: input.requiresApproval ?? false,
        createdAt: now,
        updatedAt: now
      });
      const document = await this.read();
      document.commands.unshift(command);
      await this.write({ commands: document.commands.slice(0, 1000) });
      return command;
    });
  }

  async update(id: string, input: Partial<Omit<ChatControlCommand, "id" | "createdAt">>): Promise<ChatControlCommand> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.commands.findIndex((command) => command.id === id);
      if (index === -1) throw new ClientInputError(`Chat control command not found: ${id}`);
      const next = ChatControlCommandSchema.parse({
        ...document.commands[index],
        ...input,
        updatedAt: new Date().toISOString()
      });
      document.commands[index] = next;
      await this.write(document);
      return next;
    });
  }

  private async read(): Promise<ChatControlCommandStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as ChatControlCommandStoreDocument;
      return { commands: Array.isArray(parsed.commands) ? parsed.commands.map((command) => ChatControlCommandSchema.parse(command)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { commands: [] };
      throw error;
    }
  }

  private async write(document: ChatControlCommandStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, { commands: document.commands.map((command) => ChatControlCommandSchema.parse(command)) });
  }
}

interface ChatControlBindingSessionStoreDocument {
  sessions: ChatControlBindingSession[];
}

interface ChatControlBindingSessionListOptions {
  profileId?: string;
  platform?: ChannelRecord["kind"];
}

class ChatControlBindingSessionRepository {
  private readonly filePath: string;
  private readonly withWriteLock = createWriteLock();

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "chat-control-bindings.json");
  }

  async list(options: ChatControlBindingSessionListOptions = {}): Promise<ChatControlBindingSession[]> {
    const now = Date.now();
    const sessions = (await this.read()).sessions.map((session) => (
      session.status === "pending" && new Date(session.expiresAt).getTime() <= now
        ? ChatControlBindingSessionSchema.parse({ ...session, status: "expired", updatedAt: new Date().toISOString() })
        : session
    ));
    return sessions.filter((session) => {
      if (options.profileId && session.profileId !== options.profileId) return false;
      if (options.platform && session.platform !== options.platform) return false;
      return true;
    });
  }

  async get(id: string): Promise<ChatControlBindingSession | undefined> {
    return (await this.list()).find((session) => session.id === id);
  }

  async create(input: {
    profileId: string;
    platform: ChannelRecord["kind"];
    channelId: string;
    relayUrl?: string;
  }): Promise<ChatControlBindingSession> {
    return this.withWriteLock(async () => {
      const now = new Date();
      const id = randomUUID();
      const bindingCode = createChatControlBindingCode();
      const relayUrl = normalizeChatControlRelayUrl(input.relayUrl);
      const bindingUrl = relayUrl
        ? `${relayUrl}/chat-control/bind/${id}?code=${encodeURIComponent(bindingCode)}`
        : "";
      const session = ChatControlBindingSessionSchema.parse({
        id,
        profileId: input.profileId,
        platform: input.platform,
        channelId: input.channelId,
        status: "pending",
        bindingCode,
        bindingUrl,
        qrPayload: bindingUrl,
        relayUrl,
        linkedAccount: {},
        resultText: relayUrl
          ? "等待扫码绑定。"
          : "当前没有配置 Hermills 云端聊天中转，不能生成手机可扫码二维码。请先配置 chatRelayUrl，或使用“测试连接”验证本地命令链路。",
        expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
      const document = await this.read();
      document.sessions.unshift(session);
      await this.write({ sessions: document.sessions.slice(0, 200) });
      return session;
    });
  }

  async update(id: string, input: Partial<Omit<ChatControlBindingSession, "id" | "createdAt">>): Promise<ChatControlBindingSession> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.sessions.findIndex((session) => session.id === id);
      if (index === -1) throw new ClientInputError(`Chat control binding session not found: ${id}`);
      const next = ChatControlBindingSessionSchema.parse({
        ...document.sessions[index],
        ...input,
        updatedAt: new Date().toISOString()
      });
      document.sessions[index] = next;
      await this.write(document);
      return next;
    });
  }

  private async read(): Promise<ChatControlBindingSessionStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as ChatControlBindingSessionStoreDocument;
      return { sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map((session) => normalizeStoredChatControlBindingSession(session)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { sessions: [] };
      throw error;
    }
  }

  private async write(document: ChatControlBindingSessionStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, { sessions: document.sessions.map((session) => ChatControlBindingSessionSchema.parse(session)) });
  }
}

function normalizeStoredChatControlBindingSession(input: unknown): ChatControlBindingSession {
  const session = ChatControlBindingSessionSchema.parse(input);
  const invalidBindingUrl = !session.relayUrl && (
    session.bindingUrl.toLowerCase().startsWith("undefined/")
    || session.bindingUrl.toLowerCase().startsWith("null/")
    || session.qrPayload.toLowerCase().startsWith("undefined/")
    || session.qrPayload.toLowerCase().startsWith("null/")
  );
  if (!invalidBindingUrl) return session;
  return ChatControlBindingSessionSchema.parse({
    ...session,
    status: "failed",
    bindingUrl: "",
    qrPayload: "",
    resultText: "这个绑定二维码是在云端中转地址缺失时生成的，已经失效。请配置 chatRelayUrl 后重新生成。",
    error: "聊天云端中转地址缺失。",
    updatedAt: new Date().toISOString()
  });
}

interface LogStoreDocument {
  entries: LogEntry[];
}

interface LogListOptions {
  source?: LogEntry["source"];
  level?: LogEntry["level"];
  q?: string;
  limit?: number;
}

class LogRepository {
  private readonly filePath: string;
  private readonly logHome: string;

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "logs.json");
    this.logHome = getLogHome(baseDir);
  }

  async create(input: z.infer<typeof CreateLogBody>): Promise<LogEntry> {
    const entry = LogEntrySchema.parse({
      id: randomUUID(),
      source: input.source,
      level: input.level,
      message: redactSecrets(input.message),
      createdAt: new Date().toISOString()
    });
    const document = await this.read();
    document.entries.unshift(entry);
    await this.write({ entries: document.entries.slice(0, 5000) });
    return entry;
  }

  async list(options: LogListOptions = {}): Promise<LogEntry[]> {
    const entries = [...(await this.read()).entries, ...(await this.readRuntimeLogs())];
    const needle = options.q?.trim().toLowerCase();
    return entries
      .filter((entry) => !options.source || entry.source === options.source)
      .filter((entry) => !options.level || entry.level === options.level)
      .filter((entry) => !needle || entry.message.toLowerCase().includes(needle))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, options.limit ?? 100);
  }

  private async readRuntimeLogs(): Promise<LogEntry[]> {
    const names = await readdir(this.logHome).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [] as string[];
      throw error;
    });
    const entries: LogEntry[] = [];
    for (const name of names.filter((entry) => /^(gateway|install)-\d+\.log$/.test(entry))) {
      const source = name.startsWith("gateway-") ? "gateway" : "install";
      const filePath = path.join(this.logHome, name);
      const content = await readFile(filePath, "utf8").catch(() => "");
      const lines = content.split(/\r?\n/).filter(Boolean).slice(-300);
      lines.forEach((line, index) => {
        entries.push(LogEntrySchema.parse({
          id: `${name}:${index + 1}`,
          source,
          fileId: name,
          line: index + 1,
          level: inferLogLevel(line),
          message: redactSecrets(line),
          createdAt: inferLogCreatedAt(line)
        }));
      });
    }
    return entries;
  }

  private async read(): Promise<LogStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as LogStoreDocument;
      return { entries: Array.isArray(parsed.entries) ? parsed.entries.map((entry) => LogEntrySchema.parse(entry)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { entries: [] };
      throw error;
    }
  }

  private async write(document: LogStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, { entries: document.entries.map((entry) => LogEntrySchema.parse(entry)) });
  }
}

function trackInstallCompletion(jobId: string, runtime: RuntimeAdapter, appState: AppStateRepository): void {
  let off: () => void = () => undefined;
  off = runtime.onEvent(jobId, (event) => {
    if (event.level === "error") {
      off();
      return;
    }
    if (event.level !== "done" || event.step !== "verifying" || (event.progress ?? 0) < 100) return;
    off();
    void runtime.getStatus()
      .then((status) => {
        const parsed = RuntimeStatusSchema.parse(status);
        if (parsed.installed && parsed.gateway?.state === "running") return appState.markLocalDeployComplete(parsed);
        return undefined;
      })
      .catch(() => undefined);
  });
}

interface ChatStoreDocument {
  sessions: ChatSession[];
}

class ChatRepository {
  private readonly filePath: string;

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "chat-sessions.json");
  }

  async list(query = ""): Promise<ChatSession[]> {
    const sessions = (await this.read()).sessions;
    const needle = query.trim().toLowerCase();
    if (!needle) return sessions;
    return sessions.filter((session) => [
      session.title,
      session.model,
      ...session.messages.map((message) => message.content)
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)));
  }

  async create(input: Pick<ChatSession, "title" | "agentId" | "providerId" | "model">): Promise<ChatSession> {
    const now = new Date().toISOString();
    const session = ChatSessionSchema.parse({ id: randomUUID(), title: input.title, agentId: input.agentId, providerId: input.providerId, model: input.model, messages: [], createdAt: now, updatedAt: now });
    const document = await this.read();
    document.sessions.unshift(session);
    await this.write(document);
    return session;
  }

  async append(id: string, message: ChatMessage): Promise<ChatSession> {
    const document = await this.read();
    const index = document.sessions.findIndex((session) => session.id === id);
    if (index === -1) throw new Error(`Chat session not found: ${id}`);
    const next = ChatSessionSchema.parse({ ...document.sessions[index], messages: [...document.sessions[index].messages, ChatMessageSchema.parse(message)], updatedAt: new Date().toISOString() });
    document.sessions[index] = next;
    await this.write(document);
    return next;
  }

  async update(id: string, input: z.infer<typeof UpdateSessionBody>): Promise<ChatSession> {
    const document = await this.read();
    const index = document.sessions.findIndex((session) => session.id === id);
    if (index === -1) throw new Error(`Chat session not found: ${id}`);
    const current = document.sessions[index];
    const next = ChatSessionSchema.parse({
      ...current,
      title: input.title ?? current.title,
      agentId: input.agentId === null ? undefined : input.agentId ?? current.agentId,
      providerId: input.providerId === null ? undefined : input.providerId ?? current.providerId,
      model: input.model === null ? undefined : input.model ?? current.model,
      updatedAt: new Date().toISOString()
    });
    document.sessions[index] = next;
    await this.write(document);
    return next;
  }

  async remove(id: string): Promise<void> {
    const document = await this.read();
    const sessions = document.sessions.filter((session) => session.id !== id);
    if (sessions.length === document.sessions.length) throw new Error(`Chat session not found: ${id}`);
    await this.write({ sessions });
  }

  private async read(): Promise<ChatStoreDocument> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as ChatStoreDocument;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { sessions: [] };
      throw error;
    }
  }

  private async write(document: ChatStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, document);
  }
}

interface MaterialStoreDocument {
  materials: MaterialRecord[];
}

class CompanyProfileRepository {
  private readonly filePath: string;

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "company-profile.json");
  }

  async get(): Promise<CompanyProfile> {
    try {
      return CompanyProfileSchema.parse(JSON.parse(await readFile(this.filePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return CompanyProfileSchema.parse({});
      throw error;
    }
  }

  async update(input: z.infer<typeof CompanyProfileUpdateSchema>): Promise<CompanyProfile> {
    const current = await this.get();
    const next = CompanyProfileSchema.parse({
      ...current,
      ...input,
      updatedAt: new Date().toISOString()
    });
    await writePrivateJson(this.filePath, next);
    return next;
  }
}

interface OutreachLeadStoreDocument {
  leads: OutreachLead[];
}

interface OutreachAssetStoreDocument {
  personas: OutreachBuyerPersona[];
  usps: OutreachUspCandidate[];
  ctaAssets: OutreachCtaAsset[];
  goldenExamples: OutreachGoldenExample[];
}

interface OutreachDraftStoreDocument {
  drafts: OutreachDraft[];
}

interface OutreachSenderStoreDocument {
  senders: OutreachSenderAccount[];
}

interface OutreachEmailSignatureStoreDocument extends OutreachEmailSignature {
}

interface OutreachWorkflowStoreDocument {
  workflows: OutreachWorkflow[];
}

interface OutreachCampaignStoreDocument {
  campaigns: OutreachCampaign[];
  recipients: OutreachCampaignRecipient[];
}

interface OutreachFollowUpStoreDocument {
  jobs: OutreachFollowUpJob[];
}

interface OutreachFeedbackStoreDocument {
  feedback: OutreachFeedback[];
}

interface OutreachCampaignWithRecipients extends OutreachCampaign {
  recipients: Array<OutreachCampaignRecipient & { draft?: OutreachDraft }>;
}

interface OutreachListOptions {
  profileId?: string;
  q?: string;
}

interface CustomerResearchCacheEntry {
  key: string;
  website: string;
  depth: OutreachResearchDepth;
  result: CustomerResearchResult;
  createdAt: string;
  expiresAt: string;
}

interface CustomerResearchCacheDocument {
  entries: CustomerResearchCacheEntry[];
}

function createWriteLock() {
  let queue: Promise<void> = Promise.resolve();
  return async function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
    }
  };
}

class CustomerResearchCacheRepository {
  private readonly filePath: string;
  private readonly withWriteLock = createWriteLock();

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "outreach-research-cache.json");
  }

  async get(key: string): Promise<CustomerResearchResult | undefined> {
    const now = Date.now();
    const document = await this.read();
    const entry = document.entries.find((item) => item.key === key);
    if (!entry) return undefined;
    if (new Date(entry.expiresAt).getTime() <= now) {
      await this.write({ entries: document.entries.filter((item) => item.key !== key) });
      return undefined;
    }
    return entry.result;
  }

  async set(key: string, website: string, depth: OutreachResearchDepth, result: CustomerResearchResult): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + researchCacheTtlMs(result)).toISOString();
    await this.withWriteLock(async () => {
      const document = await this.read();
      const next: CustomerResearchCacheEntry = {
        key,
        website,
        depth,
        result,
        createdAt: now.toISOString(),
        expiresAt
      };
      const active = document.entries.filter((entry) => entry.key !== key && new Date(entry.expiresAt).getTime() > Date.now());
      await this.write({ entries: [next, ...active].slice(0, 500) });
    });
  }

  private async read(): Promise<CustomerResearchCacheDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as CustomerResearchCacheDocument;
      return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { entries: [] };
      throw error;
    }
  }

  private async write(document: CustomerResearchCacheDocument): Promise<void> {
    await writePrivateJson(this.filePath, { entries: document.entries });
  }
}

class OutreachAssetRepository {
  private readonly filePath: string;
  private readonly withWriteLock = createWriteLock();

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "outreach-assets.json");
  }

  async listPersonas(profileId: string): Promise<OutreachBuyerPersona[]> {
    return (await this.read()).personas.filter((item) => item.profileId === profileId && item.enabled);
  }

  async createPersona(input: z.infer<typeof UpsertOutreachBuyerPersonaBody> & { profileId: string }): Promise<OutreachBuyerPersona> {
    return this.withWriteLock(async () => {
      const now = new Date().toISOString();
      const persona = OutreachBuyerPersonaSchema.parse({ ...input, id: randomUUID(), createdAt: now, updatedAt: now });
      const document = await this.read();
      document.personas.unshift(persona);
      await this.write(document);
      return persona;
    });
  }

  async updatePersona(id: string, profileId: string, input: z.infer<typeof UpdateOutreachBuyerPersonaBody>): Promise<OutreachBuyerPersona> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.personas.findIndex((item) => item.id === id && item.profileId === profileId);
      if (index === -1) throw new ClientInputError(`Buyer persona not found: ${id}`);
      const next = OutreachBuyerPersonaSchema.parse({ ...document.personas[index], ...input, profileId, updatedAt: new Date().toISOString() });
      document.personas[index] = next;
      await this.write(document);
      return next;
    });
  }

  async deletePersona(id: string, profileId: string): Promise<void> {
    await this.withWriteLock(async () => {
      const document = await this.read();
      const next = document.personas.filter((item) => item.id !== id || item.profileId !== profileId);
      if (next.length === document.personas.length) throw new ClientInputError(`Buyer persona not found: ${id}`);
      await this.write({ ...document, personas: next });
    });
  }

  async listUsps(profileId: string): Promise<OutreachUspCandidate[]> {
    return (await this.read()).usps.filter((item) => item.profileId === profileId && item.enabled);
  }

  async createUsp(input: z.infer<typeof UpsertOutreachUspBody> & { profileId: string }): Promise<OutreachUspCandidate> {
    return this.withWriteLock(async () => {
      const now = new Date().toISOString();
      const usp = OutreachUspCandidateSchema.parse({ ...input, id: randomUUID(), createdAt: now, updatedAt: now });
      const document = await this.read();
      document.usps.unshift(usp);
      await this.write(document);
      return usp;
    });
  }

  async updateUsp(id: string, profileId: string, input: z.infer<typeof UpdateOutreachUspBody>): Promise<OutreachUspCandidate> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.usps.findIndex((item) => item.id === id && item.profileId === profileId);
      if (index === -1) throw new ClientInputError(`USP asset not found: ${id}`);
      const next = OutreachUspCandidateSchema.parse({ ...document.usps[index], ...input, profileId, updatedAt: new Date().toISOString() });
      document.usps[index] = next;
      await this.write(document);
      return next;
    });
  }

  async deleteUsp(id: string, profileId: string): Promise<void> {
    await this.withWriteLock(async () => {
      const document = await this.read();
      const next = document.usps.filter((item) => item.id !== id || item.profileId !== profileId);
      if (next.length === document.usps.length) throw new ClientInputError(`USP asset not found: ${id}`);
      await this.write({ ...document, usps: next });
    });
  }

  async listCtaAssets(profileId: string): Promise<OutreachCtaAsset[]> {
    return (await this.read()).ctaAssets.filter((item) => item.profileId === profileId && item.enabled);
  }

  async createCtaAsset(input: z.infer<typeof UpsertOutreachCtaAssetBody> & { profileId: string }): Promise<OutreachCtaAsset> {
    return this.withWriteLock(async () => {
      const now = new Date().toISOString();
      const asset = OutreachCtaAssetSchema.parse({ ...input, id: randomUUID(), createdAt: now, updatedAt: now });
      const document = await this.read();
      document.ctaAssets.unshift(asset);
      await this.write(document);
      return asset;
    });
  }

  async updateCtaAsset(id: string, profileId: string, input: z.infer<typeof UpdateOutreachCtaAssetBody>): Promise<OutreachCtaAsset> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.ctaAssets.findIndex((item) => item.id === id && item.profileId === profileId);
      if (index === -1) throw new ClientInputError(`CTA asset not found: ${id}`);
      const next = OutreachCtaAssetSchema.parse({ ...document.ctaAssets[index], ...input, profileId, updatedAt: new Date().toISOString() });
      document.ctaAssets[index] = next;
      await this.write(document);
      return next;
    });
  }

  async deleteCtaAsset(id: string, profileId: string): Promise<void> {
    await this.withWriteLock(async () => {
      const document = await this.read();
      const next = document.ctaAssets.filter((item) => item.id !== id || item.profileId !== profileId);
      if (next.length === document.ctaAssets.length) throw new ClientInputError(`CTA asset not found: ${id}`);
      await this.write({ ...document, ctaAssets: next });
    });
  }

  async listGoldenExamples(profileId: string): Promise<OutreachGoldenExample[]> {
    return (await this.read()).goldenExamples.filter((item) => item.profileId === profileId && item.enabled);
  }

  async createGoldenExample(input: z.infer<typeof UpsertOutreachGoldenExampleBody> & { profileId: string }): Promise<OutreachGoldenExample> {
    return this.withWriteLock(async () => {
      const now = new Date().toISOString();
      const example = OutreachGoldenExampleSchema.parse({ ...input, id: randomUUID(), createdAt: now, updatedAt: now });
      const document = await this.read();
      document.goldenExamples.unshift(example);
      await this.write(document);
      return example;
    });
  }

  async updateGoldenExample(id: string, profileId: string, input: z.infer<typeof UpdateOutreachGoldenExampleBody>): Promise<OutreachGoldenExample> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.goldenExamples.findIndex((item) => item.id === id && item.profileId === profileId);
      if (index === -1) throw new ClientInputError(`Golden email example not found: ${id}`);
      const next = OutreachGoldenExampleSchema.parse({ ...document.goldenExamples[index], ...input, profileId, updatedAt: new Date().toISOString() });
      document.goldenExamples[index] = next;
      await this.write(document);
      return next;
    });
  }

  async deleteGoldenExample(id: string, profileId: string): Promise<void> {
    await this.withWriteLock(async () => {
      const document = await this.read();
      const next = document.goldenExamples.filter((item) => item.id !== id || item.profileId !== profileId);
      if (next.length === document.goldenExamples.length) throw new ClientInputError(`Golden email example not found: ${id}`);
      await this.write({ ...document, goldenExamples: next });
    });
  }

  private async read(): Promise<OutreachAssetStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<OutreachAssetStoreDocument>;
      return {
        personas: Array.isArray(parsed.personas) ? parsed.personas.map((item) => OutreachBuyerPersonaSchema.parse(item)) : [],
        usps: Array.isArray(parsed.usps) ? parsed.usps.map((item) => OutreachUspCandidateSchema.parse(item)) : [],
        ctaAssets: Array.isArray(parsed.ctaAssets) ? parsed.ctaAssets.map((item) => OutreachCtaAssetSchema.parse(item)) : [],
        goldenExamples: Array.isArray(parsed.goldenExamples) ? parsed.goldenExamples.map((item) => OutreachGoldenExampleSchema.parse(item)) : []
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { personas: [], usps: [], ctaAssets: [], goldenExamples: [] };
      throw error;
    }
  }

  private async write(document: OutreachAssetStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, {
      personas: document.personas.map((item) => OutreachBuyerPersonaSchema.parse(item)),
      usps: document.usps.map((item) => OutreachUspCandidateSchema.parse(item)),
      ctaAssets: document.ctaAssets.map((item) => OutreachCtaAssetSchema.parse(item)),
      goldenExamples: document.goldenExamples.map((item) => OutreachGoldenExampleSchema.parse(item))
    });
  }
}

class OutreachLeadRepository {
  private readonly filePath: string;
  private readonly withWriteLock = createWriteLock();

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "outreach-leads.json");
  }

  async list(options: OutreachListOptions = {}): Promise<OutreachLead[]> {
    const needle = options.q?.trim().toLowerCase();
    return (await this.read()).leads.filter((lead) => {
      if (options.profileId && lead.profileId !== options.profileId) return false;
      if (!needle) return true;
      return [
        lead.companyName,
        lead.website,
        lead.country,
        lead.industry,
        lead.contactName,
        lead.contactTitle,
        lead.email,
        lead.need,
        lead.notes,
        ...lead.tags
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    });
  }

  async get(id: string): Promise<OutreachLead | undefined> {
    return (await this.read()).leads.find((lead) => lead.id === id);
  }

  async require(id: string): Promise<OutreachLead> {
    const lead = await this.get(id);
    if (!lead) throw new ClientInputError(`Lead not found: ${id}`);
    return lead;
  }

  async create(input: z.infer<typeof CreateOutreachLeadBody> & { profileId: string }): Promise<OutreachLead> {
    return this.withWriteLock(async () => {
      const now = new Date().toISOString();
      const lead = OutreachLeadSchema.parse({
        id: randomUUID(),
        profileId: input.profileId,
        companyName: input.companyName,
        website: input.website,
        country: input.country,
        industry: input.industry,
        contactName: input.contactName,
        contactTitle: input.contactTitle,
        email: input.email,
        need: input.need ?? "",
        notes: input.notes ?? "",
        tags: input.tags ?? [],
        source: input.source,
        status: input.status,
        currentState: input.currentState,
        replyStatus: input.replyStatus,
        statusColor: input.statusColor,
        currentRound: input.currentRound,
        createdAt: now,
        updatedAt: now
      });
      const document = await this.read();
      document.leads.unshift(lead);
      await this.write(document);
      return lead;
    });
  }

  async importCsv(csvText: string, profileId: string): Promise<{ imported: OutreachLead[]; skipped: Array<{ row: number; reason: string }> }> {
    const rows = parseCsvRows(csvText);
    if (rows.length < 2) throw new ClientInputError("CSV must include a header row and at least one lead row.");
    const headers = rows[0].map(normalizeCsvHeader);
    const imported: OutreachLead[] = [];
    const skipped: Array<{ row: number; reason: string }> = [];
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row.some((value) => value.trim())) continue;
      const input = leadInputFromCsv(headers, row);
      if (!input.companyName) {
        skipped.push({ row: index + 1, reason: "Missing company name." });
        continue;
      }
      imported.push(await this.create({ ...OutreachLeadInputBody.parse(input), profileId }));
    }
    return { imported, skipped };
  }

  async stats(options: OutreachListOptions = {}): Promise<{ total: number; new: number; drafted: number; sent: number; waiting: number; replied: number; followupDue: number }> {
    const leads = await this.list(options);
    return {
      total: leads.length,
      new: leads.filter((lead) => lead.status === "new" || lead.currentState === "input_ready").length,
      drafted: leads.filter((lead) => lead.status === "email_drafted" || lead.status === "followup_drafted" || lead.currentState === "waiting_user_send" || lead.currentState === "waiting_user_send_followup").length,
      sent: leads.filter((lead) => lead.status === "email_sent" || lead.status === "contacted" || lead.currentState === "waiting_response_status").length,
      waiting: leads.filter((lead) => lead.currentState === "waiting_response_status").length,
      replied: leads.filter((lead) => lead.status === "reply_received" || lead.replyStatus === "reply_received").length,
      followupDue: leads.filter((lead) => lead.status === "followup_due").length
    };
  }

  async update(id: string, input: z.infer<typeof UpdateOutreachLeadBody>): Promise<OutreachLead> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.leads.findIndex((lead) => lead.id === id);
      if (index === -1) throw new ClientInputError(`Lead not found: ${id}`);
      const next = OutreachLeadSchema.parse({
        ...document.leads[index],
        ...input,
        updatedAt: new Date().toISOString()
      });
      document.leads[index] = next;
      await this.write(document);
      return next;
    });
  }

  async remove(id: string): Promise<void> {
    await this.withWriteLock(async () => {
      const document = await this.read();
      const leads = document.leads.filter((lead) => lead.id !== id);
      if (leads.length === document.leads.length) throw new ClientInputError(`Lead not found: ${id}`);
      await this.write({ leads });
    });
  }

  async removeMany(ids: string[], profileId: string): Promise<{ deleted: number; missing: string[] }> {
    return this.withWriteLock(async () => {
      const wanted = new Set(ids);
      const document = await this.read();
      const missing = ids.filter((id) => !document.leads.some((lead) => lead.id === id && lead.profileId === profileId));
      const leads = document.leads.filter((lead) => lead.profileId !== profileId || !wanted.has(lead.id));
      const deleted = document.leads.length - leads.length;
      await this.write({ leads });
      return { deleted, missing };
    });
  }

  private async read(): Promise<OutreachLeadStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as OutreachLeadStoreDocument;
      return { leads: Array.isArray(parsed.leads) ? parsed.leads.map((lead) => OutreachLeadSchema.parse(lead)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { leads: [] };
      throw error;
    }
  }

  private async write(document: OutreachLeadStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, { leads: document.leads.map((lead) => OutreachLeadSchema.parse(lead)) });
  }
}

class OutreachDraftRepository {
  private readonly filePath: string;
  private readonly withWriteLock = createWriteLock();

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "outreach-drafts.json");
  }

  async list(options: OutreachListOptions = {}): Promise<OutreachDraft[]> {
    const needle = options.q?.trim().toLowerCase();
    return (await this.read()).drafts.filter((draft) => {
      if (options.profileId && draft.profileId !== options.profileId) return false;
      if (!needle) return true;
      return [draft.subject, draft.body, draft.language, draft.tone, draft.sendError].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    });
  }

  async get(id: string): Promise<OutreachDraft | undefined> {
    return (await this.read()).drafts.find((draft) => draft.id === id);
  }

  async require(id: string): Promise<OutreachDraft> {
    const draft = await this.get(id);
    if (!draft) throw new ClientInputError(`Outreach draft not found: ${id}`);
    return draft;
  }

  async create(input: Omit<OutreachDraft, "id" | "status" | "createdAt" | "updatedAt" | "leadFitScore" | "evidenceLock" | "valueMatch" | "sendOutcome" | "learningSignal"> & Partial<Pick<OutreachDraft, "status" | "leadFitScore" | "evidenceLock" | "valueMatch" | "sendOutcome" | "learningSignal">>): Promise<OutreachDraft> {
    return this.withWriteLock(async () => {
      const now = new Date().toISOString();
      const draft = OutreachDraftSchema.parse({
        ...input,
        id: randomUUID(),
        status: input.status ?? "draft",
        createdAt: now,
        updatedAt: now
      });
      const document = await this.read();
      document.drafts.unshift(draft);
      await this.write(document);
      return draft;
    });
  }

  async update(id: string, input: z.infer<typeof UpdateOutreachDraftBody> & Partial<Pick<OutreachDraft, "status" | "sentAt" | "sendError" | "leadFitScore" | "evidenceLock" | "valueMatch" | "qualityReview" | "evidenceMap" | "strategyMatch" | "sendRiskReview" | "writingEngine" | "model" | "modelUsed" | "rewriteAttempts" | "evidenceUsed" | "matchedExampleIds" | "researchBrief" | "generationSummary" | "sendOutcome" | "learningSignal">>): Promise<OutreachDraft> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.drafts.findIndex((draft) => draft.id === id);
      if (index === -1) throw new ClientInputError(`Outreach draft not found: ${id}`);
      const clearsReview = (input.subject !== undefined || input.body !== undefined) && input.qualityReview === undefined;
      const clearsRiskReview = (input.subject !== undefined || input.body !== undefined) && input.sendRiskReview === undefined;
      const next = OutreachDraftSchema.parse({
        ...document.drafts[index],
        ...input,
        qualityReview: clearsReview ? undefined : input.qualityReview ?? document.drafts[index].qualityReview,
        sendRiskReview: clearsRiskReview ? undefined : input.sendRiskReview ?? document.drafts[index].sendRiskReview,
        updatedAt: new Date().toISOString()
      });
      document.drafts[index] = next;
      await this.write(document);
      return next;
    });
  }

  private async read(): Promise<OutreachDraftStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as OutreachDraftStoreDocument;
      return { drafts: Array.isArray(parsed.drafts) ? parsed.drafts.map((draft) => OutreachDraftSchema.parse(draft)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { drafts: [] };
      throw error;
    }
  }

  private async write(document: OutreachDraftStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, { drafts: document.drafts.map((draft) => OutreachDraftSchema.parse(draft)) });
  }
}

class OutreachWorkflowRepository {
  private readonly filePath: string;
  private readonly withWriteLock = createWriteLock();

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "outreach-workflows.json");
  }

  async list(options: OutreachListOptions = {}): Promise<OutreachWorkflow[]> {
    const needle = options.q?.trim().toLowerCase();
    return (await this.read()).workflows.filter((workflow) => {
      if (options.profileId && workflow.profileId !== options.profileId) return false;
      if (!needle) return true;
      return [
        workflow.website,
        workflow.email,
        workflow.research.companyName,
        workflow.research.industry,
        ...workflow.icps.map((icp) => icp.name),
        ...workflow.usps.map((usp) => usp.headline)
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    });
  }

  async get(id: string): Promise<OutreachWorkflow | undefined> {
    return (await this.read()).workflows.find((workflow) => workflow.id === id);
  }

  async require(id: string): Promise<OutreachWorkflow> {
    const workflow = await this.get(id);
    if (!workflow) throw new ClientInputError(`Outreach workflow not found: ${id}`);
    return workflow;
  }

  async create(input: Omit<OutreachWorkflow, "id" | "createdAt" | "updatedAt">): Promise<OutreachWorkflow> {
    return this.withWriteLock(async () => {
      const now = new Date().toISOString();
      const workflow = OutreachWorkflowSchema.parse({
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now
      });
      const document = await this.read();
      document.workflows.unshift(workflow);
      await this.write(document);
      return workflow;
    });
  }

  async update(id: string, input: Partial<Omit<OutreachWorkflow, "id" | "createdAt" | "updatedAt">>): Promise<OutreachWorkflow> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.workflows.findIndex((workflow) => workflow.id === id);
      if (index === -1) throw new ClientInputError(`Outreach workflow not found: ${id}`);
      const next = OutreachWorkflowSchema.parse({
        ...document.workflows[index],
        ...input,
        updatedAt: new Date().toISOString()
      });
      document.workflows[index] = next;
      await this.write(document);
      return next;
    });
  }

  private async read(): Promise<OutreachWorkflowStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as OutreachWorkflowStoreDocument;
      return { workflows: Array.isArray(parsed.workflows) ? parsed.workflows.map((workflow) => OutreachWorkflowSchema.parse(workflow)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { workflows: [] };
      throw error;
    }
  }

  private async write(document: OutreachWorkflowStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, { workflows: document.workflows.map((workflow) => OutreachWorkflowSchema.parse(workflow)) });
  }
}

class OutreachCampaignRepository {
  private readonly filePath: string;
  private readonly withWriteLock = createWriteLock();

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "outreach-campaigns.json");
  }

  async list(options: OutreachListOptions = {}): Promise<OutreachCampaign[]> {
    const needle = options.q?.trim().toLowerCase();
    return (await this.read()).campaigns.filter((campaign) => {
      if (options.profileId && campaign.profileId !== options.profileId) return false;
      if (!needle) return true;
      return [campaign.name, campaign.description, campaign.language, campaign.tone, campaign.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    });
  }

  async listWithRecipients(options: OutreachListOptions = {}, drafts: OutreachDraftRepository): Promise<OutreachCampaignWithRecipients[]> {
    const document = await this.read();
    const needle = options.q?.trim().toLowerCase();
    const campaigns = document.campaigns.filter((campaign) => {
      if (options.profileId && campaign.profileId !== options.profileId) return false;
      if (!needle) return true;
      return [campaign.name, campaign.description, campaign.language, campaign.tone, campaign.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    });
    return Promise.all(campaigns.map((campaign) => this.enrich(campaign, document.recipients.filter((recipient) => recipient.campaignId === campaign.id), drafts)));
  }

  async get(id: string): Promise<OutreachCampaign | undefined> {
    return (await this.read()).campaigns.find((campaign) => campaign.id === id);
  }

  async require(id: string): Promise<OutreachCampaign> {
    const campaign = await this.get(id);
    if (!campaign) throw new ClientInputError(`Outreach campaign not found: ${id}`);
    return campaign;
  }

  async getWithRecipients(id: string, drafts: OutreachDraftRepository): Promise<OutreachCampaignWithRecipients | undefined> {
    const document = await this.read();
    const campaign = document.campaigns.find((item) => item.id === id);
    if (!campaign) return undefined;
    return this.enrich(campaign, document.recipients.filter((recipient) => recipient.campaignId === id), drafts);
  }

  async requireWithRecipients(id: string, drafts: OutreachDraftRepository): Promise<OutreachCampaignWithRecipients> {
    const campaign = await this.getWithRecipients(id, drafts);
    if (!campaign) throw new ClientInputError(`Outreach campaign not found: ${id}`);
    return campaign;
  }

  async create(input: {
    profileId: string;
    name: string;
    description?: string;
    senderAccountId?: string;
    language: string;
    tone: string;
    providerId?: string;
    model?: string;
    generationMode?: OutreachGenerationMode;
    rateLimit?: z.infer<typeof OutreachCampaignRateLimitBody>;
    researchDepth?: OutreachResearchDepth;
    leads: OutreachLead[];
  }): Promise<OutreachCampaignWithRecipients> {
    return this.withWriteLock(async () => {
      const now = new Date().toISOString();
      const id = randomUUID();
      const seenLeadIds = new Set<string>();
      const recipients: OutreachCampaignRecipient[] = input.leads.map((lead) => {
        if (lead.profileId !== input.profileId) throw new ClientInputError(`Lead belongs to another profile: ${lead.companyName}`);
        if (seenLeadIds.has(lead.id)) throw new ClientInputError(`Lead was selected twice: ${lead.companyName}`);
        seenLeadIds.add(lead.id);
        if (!lead.website || !lead.email) throw new ClientInputError(`Every batch customer needs website and email before campaign creation: ${lead.companyName}`);
        return OutreachCampaignRecipientSchema.parse({
          id: randomUUID(),
          profileId: input.profileId,
          campaignId: id,
          leadId: lead.id,
          email: lead.email,
          companyName: lead.companyName,
          website: lead.website,
          contactName: lead.contactName,
          contactTitle: lead.contactTitle,
          status: "pending",
          createdAt: now,
          updatedAt: now
        });
      });
      const campaign = OutreachCampaignSchema.parse({
        id,
        profileId: input.profileId,
        name: input.name,
        description: input.description ?? "",
        senderAccountId: input.senderAccountId,
        language: input.language,
        tone: input.tone,
        providerId: input.providerId,
        model: input.model,
        generationMode: input.generationMode ?? "deep",
        researchDepth: input.researchDepth ?? "adaptive",
        rateLimit: input.rateLimit ?? {},
        status: "draft",
        createdAt: now,
        updatedAt: now
      });
      const document = await this.read();
      document.campaigns.unshift(campaign);
      document.recipients.unshift(...recipients);
      const written = await this.write(document);
      const saved = written.campaigns.find((item) => item.id === id)!;
      return this.enrich(saved, written.recipients.filter((recipient) => recipient.campaignId === id), undefined);
    });
  }

  async updateCampaign(id: string, input: Partial<Omit<OutreachCampaign, "id" | "profileId" | "createdAt" | "updatedAt" | "stats" | "mode">>): Promise<OutreachCampaign> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.campaigns.findIndex((campaign) => campaign.id === id);
      if (index === -1) throw new ClientInputError(`Outreach campaign not found: ${id}`);
      const next = OutreachCampaignSchema.parse({
        ...document.campaigns[index],
        ...input,
        updatedAt: new Date().toISOString()
      });
      document.campaigns[index] = next;
      const written = await this.write(document);
      return written.campaigns.find((campaign) => campaign.id === id)!;
    });
  }

  async updateRecipient(id: string, input: Partial<Omit<OutreachCampaignRecipient, "id" | "profileId" | "campaignId" | "leadId" | "createdAt" | "updatedAt">>): Promise<OutreachCampaignRecipient> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.recipients.findIndex((recipient) => recipient.id === id);
      if (index === -1) throw new ClientInputError(`Campaign recipient not found: ${id}`);
      const next = OutreachCampaignRecipientSchema.parse({
        ...document.recipients[index],
        ...input,
        updatedAt: new Date().toISOString()
      });
      document.recipients[index] = next;
      const written = await this.write(document);
      return written.recipients.find((recipient) => recipient.id === id)!;
    });
  }

  private async enrich(campaign: OutreachCampaign, recipients: OutreachCampaignRecipient[], drafts?: OutreachDraftRepository): Promise<OutreachCampaignWithRecipients> {
    const enriched = await Promise.all(recipients.map(async (recipient) => ({
      ...recipient,
      draft: recipient.initialDraftId && drafts ? await drafts.get(recipient.initialDraftId) : undefined
    })));
    return { ...campaign, recipients: enriched };
  }

  private async read(): Promise<OutreachCampaignStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as OutreachCampaignStoreDocument;
      return {
        campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns.map((campaign) => OutreachCampaignSchema.parse(campaign)) : [],
        recipients: Array.isArray(parsed.recipients) ? parsed.recipients.map((recipient) => OutreachCampaignRecipientSchema.parse(recipient)) : []
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { campaigns: [], recipients: [] };
      throw error;
    }
  }

  private async write(document: OutreachCampaignStoreDocument): Promise<OutreachCampaignStoreDocument> {
    const campaigns = document.campaigns.map((campaign) => OutreachCampaignSchema.parse({
      ...campaign,
      stats: campaignStats(document.recipients.filter((recipient) => recipient.campaignId === campaign.id)),
      deliverabilityStats: campaignDeliverabilityStats(document.recipients.filter((recipient) => recipient.campaignId === campaign.id)),
      learningSummary: campaignLearningSummary(document.recipients.filter((recipient) => recipient.campaignId === campaign.id))
    }));
    const recipients = document.recipients.map((recipient) => OutreachCampaignRecipientSchema.parse(recipient));
    await writePrivateJson(this.filePath, { campaigns, recipients });
    return { campaigns, recipients };
  }
}

class OutreachEmailSignatureRepository {
  private readonly filePath: string;
  private readonly logoDir: string;
  private readonly withWriteLock = createWriteLock();

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "outreach-email-signature.json");
    this.logoDir = path.join(getDataHome(baseDir), "outreach-email-signature");
  }

  async get(): Promise<OutreachEmailSignature> {
    return this.read();
  }

  async update(input: z.infer<typeof UpdateOutreachEmailSignatureBody>): Promise<OutreachEmailSignature> {
    return this.withWriteLock(async () => {
      const current = await this.read();
      const next = OutreachEmailSignatureSchema.parse({
        ...current,
        ...input,
        updatedAt: new Date().toISOString()
      });
      await this.write(next);
      return next;
    });
  }

  async uploadLogo(file: MaterialUpload): Promise<OutreachEmailSignature> {
    assertAllowedSignatureLogo(file);
    return this.withWriteLock(async () => {
      const current = await this.read();
      if (current.logo) await this.deleteLogoFile(current.logo.id).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
      const now = new Date().toISOString();
      const id = randomUUID();
    const logo = OutreachEmailSignatureLogoSchema.parse({
        id,
        fileName: safeFileName(file.name) || "signature-logo",
        mimeType: file.mimeType,
        size: file.buffer.byteLength,
        sha256: createHash("sha256").update(file.buffer).digest("hex"),
        uploadedAt: now
      });
      await writePrivateFile(this.logoPath(id), file.buffer);
      const next = OutreachEmailSignatureSchema.parse({
        ...current,
        logo,
        logoEnabled: true,
        updatedAt: now
      });
      await this.write(next);
      return next;
    });
  }

  async deleteLogo(): Promise<OutreachEmailSignature> {
    return this.withWriteLock(async () => {
      const current = await this.read();
      if (current.logo) await this.deleteLogoFile(current.logo.id).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
      const next = OutreachEmailSignatureSchema.parse({
        ...current,
        logo: undefined,
        updatedAt: new Date().toISOString()
      });
      await this.write(next);
      return next;
    });
  }

  async readLogo(): Promise<{ signature: OutreachEmailSignature; buffer: Buffer; fileName: string; mimeType: string } | undefined> {
    const signature = await this.read();
    if (!signature.logo) return undefined;
    try {
      return {
        signature,
        buffer: await readFile(this.logoPath(signature.logo.id)),
        fileName: signature.logo.fileName,
        mimeType: signature.logo.mimeType
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  private logoPath(id: string): string {
    return path.join(this.logoDir, `${safeFileName(id) || "logo"}.bin`);
  }

  private async deleteLogoFile(id: string): Promise<void> {
    await unlink(this.logoPath(id));
  }

  private defaultSignature(): OutreachEmailSignature {
    return OutreachEmailSignatureSchema.parse({ version: 1, enabled: false });
  }

  private async read(): Promise<OutreachEmailSignatureStoreDocument> {
    try {
      return OutreachEmailSignatureSchema.parse(JSON.parse(await readFile(this.filePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return this.defaultSignature();
      throw error;
    }
  }

  private async write(document: OutreachEmailSignatureStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, OutreachEmailSignatureSchema.parse(document));
  }
}

class OutreachSenderRepository {
  private readonly filePath: string;
  private readonly vault: LocalCredentialVault;
  private readonly baseDir?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(baseDir?: string, fetchImpl: typeof fetch = fetch) {
    this.baseDir = baseDir;
    this.fetchImpl = fetchImpl;
    this.filePath = path.join(getDataHome(baseDir), "outreach-senders.json");
    this.vault = new LocalCredentialVault(baseDir);
  }

  async list(options: Pick<OutreachListOptions, "profileId"> = {}): Promise<OutreachSenderAccount[]> {
    return (await this.read()).senders.filter((sender) => !options.profileId || !sender.profileId || sender.profileId === options.profileId);
  }

  async get(id: string): Promise<OutreachSenderAccount | undefined> {
    return (await this.read()).senders.find((sender) => sender.id === id);
  }

  async require(id: string): Promise<OutreachSenderAccount> {
    const sender = await this.get(id);
    if (!sender) throw new ClientInputError(`Sender account not found: ${id}`);
    return sender;
  }

  async create(input: z.infer<typeof CreateOutreachSenderBody> & { profileId: string }): Promise<OutreachSenderAccount> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const normalized = normalizeOutreachSenderCreateInput(input);
    const { provider, sendChannel } = normalized;
    assertSenderTransportBasics({ provider, sendChannel, host: normalized.host });
    const passwordRef = normalized.password ? await this.vault.saveSecret(`outreach-sender-${id}`, normalized.password) : undefined;
    const oauthApi = await this.updateApiCredential({
      senderId: id,
      kind: "oauth-api",
      input: normalized.oauthApi
    });
    const serviceApi = await this.updateApiCredential({
      senderId: id,
      kind: "service-api",
      input: normalized.serviceApi
    });
    const imap = inferImapSettings(normalized);
    const sender = OutreachSenderAccountSchema.parse({
      id,
      profileId: normalized.profileId,
      label: normalized.label,
      provider,
      sendChannel,
      fromName: normalized.fromName,
      email: normalized.email,
      host: normalized.host,
      port: normalized.port,
      secure: normalized.secure,
      imapHost: normalized.imapHost ?? imap.host,
      imapPort: normalized.imapPort ?? imap.port,
      imapSecure: normalized.imapSecure ?? imap.secure,
      imapUsername: normalized.imapUsername ?? normalized.username ?? normalized.email,
      username: normalized.username,
      passwordRef,
      passwordPreview: normalized.password ? previewSecret(normalized.password) : undefined,
      oauthApi,
      serviceApi,
      enabled: normalized.enabled,
      createdAt: now,
      updatedAt: now
    });
    const document = await this.read();
    document.senders.unshift(sender);
    await this.write(document);
    return sender;
  }

  async update(id: string, input: z.infer<typeof UpdateOutreachSenderBody>): Promise<OutreachSenderAccount> {
    const document = await this.read();
    const index = document.senders.findIndex((sender) => sender.id === id);
    if (index === -1) throw new ClientInputError(`Sender account not found: ${id}`);
    const current = document.senders[index];
    let passwordRef = current.passwordRef;
    let passwordPreview = current.passwordPreview;
    if (input.clearPassword && passwordRef) {
      await this.vault.deleteSecret(passwordRef);
      passwordRef = undefined;
      passwordPreview = undefined;
    }
    if (input.password) {
      if (passwordRef) await this.vault.deleteSecret(passwordRef);
      passwordRef = await this.vault.saveSecret(`outreach-sender-${id}`, input.password);
      passwordPreview = previewSecret(input.password);
    }
    const normalized = normalizeOutreachSenderUpdateInput(current, input);
    const { provider, sendChannel, host } = normalized;
    assertSenderTransportBasics({ provider, sendChannel, host });
    const oauthApi = await this.updateApiCredential({
      senderId: id,
      kind: "oauth-api",
      current: current.oauthApi,
      input: normalized.oauthApi,
      clear: input.clearOAuthApiCredential
    });
    const serviceApi = await this.updateApiCredential({
      senderId: id,
      kind: "service-api",
      current: current.serviceApi,
      input: normalized.serviceApi,
      clear: input.clearServiceApiCredential
    });
    const next = OutreachSenderAccountSchema.parse({
      ...current,
      label: normalized.label,
      provider,
      sendChannel,
      fromName: normalized.fromName,
      email: normalized.email,
      host,
      port: normalized.port,
      secure: normalized.secure,
      imapHost: normalized.imapHost,
      imapPort: normalized.imapPort,
      imapSecure: normalized.imapSecure,
      imapUsername: normalized.imapUsername,
      username: normalized.username,
      passwordRef,
      passwordPreview,
      oauthApi,
      serviceApi,
      enabled: input.enabled ?? current.enabled,
      lastError: undefined,
      lastInboxCheckStatus: undefined,
      lastInboxCheckMessage: undefined,
      updatedAt: new Date().toISOString()
    });
    document.senders[index] = next;
    await this.write(document);
    return next;
  }

  async test(id: string): Promise<{ ok: boolean; message: string; sender: PublicOutreachSenderAccount }> {
    const sender = await this.require(id);
    try {
      const selection = await this.selectTransport(sender);
      await selection.transport.verify();
      const next = await this.updateTestState(id, { lastError: undefined, markLoginTested: true });
      return { ok: true, message: transportReadyMessage(selection), sender: publicOutreachSender(next) };
    } catch (error) {
      const message = formatMailError(error, sender);
      const next = await this.updateTestState(id, { lastError: message, markLoginTested: true });
      return { ok: false, message, sender: publicOutreachSender(next) };
    }
  }

  async sendTestEmail(id: string, to?: string): Promise<{ ok: boolean; message: string; sender: PublicOutreachSenderAccount }> {
    const sender = await this.require(id);
    const target = to?.trim() || sender.email;
    if (!target) throw new ClientInputError("Test email recipient is missing.");
    try {
      const selection = await this.selectTransport(sender);
      await selection.transport.verify();
      const selfTest = target.trim().toLowerCase() === sender.email.trim().toLowerCase();
      await selection.transport.sendMail({
        from: formatEmailAddress(sender.fromName, sender.email),
        to: target,
        subject: "Hermills mailbox test",
        text: selfTest ? [
          "Hermills sent this test email to confirm your mailbox can send real outreach messages.",
          "",
          "If you received it, go back to Hermills and click \"I received it\"."
        ].join("\n") : [
          "Hermills sent this external delivery test from your configured mailbox.",
          "",
          "No action is needed."
        ].join("\n")
      });
      const next = await this.updateTestState(id, { lastError: undefined, markLoginTested: true, markTestEmailSent: true });
      return { ok: true, message: `Test email sent to ${target}.`, sender: publicOutreachSender(next) };
    } catch (error) {
      const message = formatMailError(error, sender);
      const next = await this.updateTestState(id, { lastError: message, markLoginTested: true });
      return { ok: false, message, sender: publicOutreachSender(next) };
    }
  }

  async confirmDelivery(id: string): Promise<OutreachSenderAccount> {
    return this.updateTestState(id, { lastError: undefined, markDeliveryConfirmed: true });
  }

  async sendMail(sender: OutreachSenderAccount, message: SendMailOptions): Promise<void> {
    const selection = await this.selectTransport(sender);
    await selection.transport.sendMail(message);
  }

  async selectTransport(sender: OutreachSenderAccount): Promise<OutreachSenderTransportSelection> {
    const provider = sender.provider ?? inferOutreachSenderProvider(sender, sender.sendChannel ?? "smtp");
    const sendChannel = sender.sendChannel ?? "smtp";
    assertSenderTransportBasics({ provider, sendChannel, host: sender.host });
    const transport = sendChannel === "smtp"
      ? await this.createSmtpTransport(sender, provider)
      : await this.createApiTransport(sender, provider, sendChannel);
    return {
      provider,
      sendChannel,
      senderId: sender.id,
      senderEmail: sender.email,
      transport
    };
  }

  private async createSmtpTransport(sender: OutreachSenderAccount, provider: string): Promise<OutreachSenderTransport> {
    const password = sender.passwordRef ? await this.vault.readSecret(sender.passwordRef) : undefined;
    const transporter = await createSmtpTransporter({ sender, password });
    return {
      provider,
      sendChannel: "smtp",
      verify: () => transporter.verify().then(() => undefined),
      sendMail: (message) => transporter.sendMail(message).then(() => undefined)
    };
  }

  private async createApiTransport(sender: OutreachSenderAccount, provider: string, sendChannel: "oauth-api" | "service-api"): Promise<OutreachSenderTransport> {
    const credential = sendChannel === "oauth-api" ? sender.oauthApi : sender.serviceApi;
    const secret = credential?.credentialRef ? await this.vault.readSecret(credential.credentialRef) : undefined;
    const apiCredential: ApiMailCredential | undefined = parseApiMailCredential(secret);
    return {
      provider,
      sendChannel,
      verify: async () => {
        await verifyApiMailTransport({ sender, credential: apiCredential });
      },
      sendMail: async (message) => {
        await sendApiMail({ sender, message, credential: apiCredential, fetchImpl: this.fetchImpl });
      }
    };
  }

  async readPassword(sender: OutreachSenderAccount): Promise<string | undefined> {
    return sender.passwordRef ? this.vault.readSecret(sender.passwordRef) : undefined;
  }

  async remove(id: string): Promise<void> {
    const document = await this.read();
    const sender = document.senders.find((item) => item.id === id);
    if (!sender) throw new ClientInputError(`Sender account not found: ${id}`);
    await this.write({ senders: document.senders.filter((item) => item.id !== id) });
    if (sender.passwordRef) await this.vault.deleteSecret(sender.passwordRef);
    if (sender.oauthApi?.credentialRef) await this.vault.deleteSecret(sender.oauthApi.credentialRef);
    if (sender.serviceApi?.credentialRef) await this.vault.deleteSecret(sender.serviceApi.credentialRef);
  }

  async updateInboxState(id: string, input: { status: "ready" | "unsupported" | "failed"; message: string }): Promise<OutreachSenderAccount> {
    const document = await this.read();
    const index = document.senders.findIndex((sender) => sender.id === id);
    if (index === -1) throw new ClientInputError(`Sender account not found: ${id}`);
    const now = new Date().toISOString();
    const next = OutreachSenderAccountSchema.parse({
      ...document.senders[index],
      lastInboxCheckedAt: now,
      lastInboxCheckStatus: input.status,
      lastInboxCheckMessage: input.message,
      lastError: input.status === "failed" ? input.message : undefined,
      updatedAt: now
    });
    document.senders[index] = next;
    await this.write(document);
    return next;
  }

  private async updateTestState(id: string, input: { lastError?: string; markLoginTested?: boolean; markTestEmailSent?: boolean; markDeliveryConfirmed?: boolean }): Promise<OutreachSenderAccount> {
    const document = await this.read();
    const index = document.senders.findIndex((sender) => sender.id === id);
    if (index === -1) throw new ClientInputError(`Sender account not found: ${id}`);
    const now = new Date().toISOString();
    const next = OutreachSenderAccountSchema.parse({
      ...document.senders[index],
      lastTestedAt: input.markLoginTested ? now : document.senders[index].lastTestedAt,
      lastTestEmailAt: input.markTestEmailSent ? now : document.senders[index].lastTestEmailAt,
      deliveryConfirmedAt: input.markDeliveryConfirmed ? now : document.senders[index].deliveryConfirmedAt,
      lastError: input.lastError,
      updatedAt: now
    });
    document.senders[index] = next;
    await this.write(document);
    return next;
  }

  private async read(): Promise<OutreachSenderStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as OutreachSenderStoreDocument;
      return { senders: Array.isArray(parsed.senders) ? parsed.senders.map((sender) => OutreachSenderAccountSchema.parse(sender)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { senders: [] };
      throw error;
    }
  }

  private async write(document: OutreachSenderStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, { senders: document.senders.map((sender) => OutreachSenderAccountSchema.parse(sender)) });
  }

  private async updateApiCredential(input: {
    senderId: string;
    kind: "oauth-api" | "service-api";
    current?: NonNullable<OutreachSenderAccount["oauthApi"]>;
    input?: z.infer<typeof OutreachSenderApiCredentialBody> | null;
    clear?: boolean;
  }): Promise<NonNullable<OutreachSenderAccount["oauthApi"]> | undefined> {
    if (input.clear || input.input === null) {
      if (input.current?.credentialRef) await this.vault.deleteSecret(input.current.credentialRef);
      return undefined;
    }
    if (input.input === undefined) return input.current;
    let credentialRef = input.current?.credentialRef;
    let credentialPreview = input.current?.credentialPreview;
    if (input.input.credential) {
      if (credentialRef) await this.vault.deleteSecret(credentialRef);
      credentialRef = await this.vault.saveSecret(`outreach-sender-${input.senderId}-${input.kind}`, input.input.credential);
      credentialPreview = previewSecret(input.input.credential);
    }
    const accountId = input.input.accountId ?? input.current?.accountId;
    const apiBaseUrl = input.input.apiBaseUrl ?? input.current?.apiBaseUrl;
    const scopes = input.input.scopes ?? input.current?.scopes ?? [];
    const expiresAt = input.input.expiresAt ?? input.current?.expiresAt;
    if (!credentialRef && !accountId && !apiBaseUrl && !scopes.length && !expiresAt) return undefined;
    return {
      credentialRef,
      credentialPreview,
      accountId,
      apiBaseUrl,
      scopes,
      expiresAt
    };
  }
}

class OutreachFollowUpRepository {
  private readonly filePath: string;
  private readonly withWriteLock = createWriteLock();

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "outreach-followups.json");
  }

  async list(options: { profileId?: string; campaignId?: string; recipientId?: string } = {}): Promise<OutreachFollowUpJob[]> {
    return (await this.read()).jobs
      .filter((job) => !options.profileId || job.profileId === options.profileId)
      .filter((job) => !options.campaignId || job.campaignId === options.campaignId)
      .filter((job) => !options.recipientId || job.recipientId === options.recipientId)
      .sort((a, b) => a.sendAt.localeCompare(b.sendAt));
  }

  async createMany(jobs: OutreachFollowUpJob[]): Promise<OutreachFollowUpJob[]> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const existingKeys = new Set(document.jobs.map((job) => followUpJobKey(job)));
      const nextJobs = jobs.filter((job) => !existingKeys.has(followUpJobKey(job))).map((job) => OutreachFollowUpJobSchema.parse(job));
      document.jobs.unshift(...nextJobs);
      await this.write(document);
      return nextJobs;
    });
  }

  async due(nowIso: string, limit: number): Promise<OutreachFollowUpJob[]> {
    return (await this.read()).jobs
      .filter((job) => job.status === "scheduled" && job.sendAt <= nowIso)
      .sort((a, b) => a.sendAt.localeCompare(b.sendAt))
      .slice(0, limit);
  }

  async update(id: string, input: Partial<Omit<OutreachFollowUpJob, "id" | "profileId" | "campaignId" | "recipientId" | "leadId" | "workflowId" | "draftId" | "createdAt" | "updatedAt">>): Promise<OutreachFollowUpJob> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.jobs.findIndex((job) => job.id === id);
      if (index === -1) throw new ClientInputError(`Follow-up job not found: ${id}`);
      const next = OutreachFollowUpJobSchema.parse({
        ...document.jobs[index],
        ...input,
        updatedAt: new Date().toISOString()
      });
      document.jobs[index] = next;
      await this.write(document);
      return next;
    });
  }

  async stopByRecipient(recipientId: string, reason: string): Promise<number> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const now = new Date().toISOString();
      let stopped = 0;
      const jobs = document.jobs.map((job) => {
        if (job.recipientId !== recipientId || ["sent", "failed", "stopped"].includes(job.status)) return job;
        stopped += 1;
        return OutreachFollowUpJobSchema.parse({ ...job, status: "stopped", stoppedAt: now, stopReason: reason, updatedAt: now });
      });
      await this.write({ jobs });
      return stopped;
    });
  }

  async stats(options: { profileId?: string; campaignId?: string } = {}) {
    const jobs = await this.list(options);
    return {
      total: jobs.length,
      scheduled: jobs.filter((job) => job.status === "scheduled").length,
      ready: jobs.filter((job) => job.status === "ready").length,
      sent: jobs.filter((job) => job.status === "sent").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      stopped: jobs.filter((job) => job.status === "stopped").length
    };
  }

  private async read(): Promise<OutreachFollowUpStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as OutreachFollowUpStoreDocument;
      return { jobs: Array.isArray(parsed.jobs) ? parsed.jobs.map((job) => OutreachFollowUpJobSchema.parse(job)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { jobs: [] };
      throw error;
    }
  }

  private async write(document: OutreachFollowUpStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, { jobs: document.jobs.map((job) => OutreachFollowUpJobSchema.parse(job)) });
  }
}

class OutreachFeedbackRepository {
  private readonly filePath: string;
  private readonly withWriteLock = createWriteLock();

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "outreach-feedback.json");
  }

  async list(options: { profileId?: string } = {}): Promise<OutreachFeedback[]> {
    return (await this.read()).feedback
      .filter((item) => !options.profileId || item.profileId === options.profileId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(input: Omit<OutreachFeedback, "id" | "createdAt" | "updatedAt" | "status" | "learningSignal" | "userEditedFields" | "keptPhrases" | "removedPhrases" | "nextOptimization"> & Partial<Pick<OutreachFeedback, "status" | "learningSignal" | "userEditedFields" | "keptPhrases" | "removedPhrases" | "nextOptimization">>): Promise<OutreachFeedback> {
    return this.withWriteLock(async () => {
      const now = new Date().toISOString();
      const feedback = OutreachFeedbackSchema.parse({
        ...input,
        id: randomUUID(),
        status: input.status ?? "new",
        createdAt: now,
        updatedAt: now
      });
      const document = await this.read();
      document.feedback.unshift(feedback);
      await this.write(document);
      return feedback;
    });
  }

  private async read(): Promise<OutreachFeedbackStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as OutreachFeedbackStoreDocument;
      return { feedback: Array.isArray(parsed.feedback) ? parsed.feedback.map((item) => OutreachFeedbackSchema.parse(item)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { feedback: [] };
      throw error;
    }
  }

  private async write(document: OutreachFeedbackStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, { feedback: document.feedback.map((item) => OutreachFeedbackSchema.parse(item)) });
  }
}

type PublicProviderCredential = Omit<ProviderCredential, "credentialRef">;
type PublicMaterialRecord = Omit<MaterialRecord, "path">;
type PublicChannelRecord = Omit<ChannelRecord, "secretRef">;
type PublicOutreachSenderApiCredential = Omit<NonNullable<OutreachSenderAccount["oauthApi"]>, "credentialRef">;
type PublicOutreachSenderAccount = Omit<OutreachSenderAccount, "passwordRef" | "oauthApi" | "serviceApi"> & {
  oauthApi?: PublicOutreachSenderApiCredential;
  serviceApi?: PublicOutreachSenderApiCredential;
};
type OnboardingProviderUpsert = Omit<OnboardingProviderInput, "apiKey"> & { apiKey?: string };

interface MaterialUpload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

type MaterialMetadataInput = {
  scope?: MaterialRecord["scope"];
  category?: MaterialRecord["category"] | null;
  tags?: string[];
  description?: string | null;
  folder?: string | null;
};

interface MultipartCandidate {
  filename: string;
  mimetype: string;
}

function publicProvider(provider: ProviderCredential): PublicProviderCredential {
  const { credentialRef: _credentialRef, ...safeProvider } = provider;
  return safeProvider;
}

function publicOnboardingProvider(provider: OnboardingProviderUpsert): OnboardingProviderState {
  const { apiKey: _apiKey, ...safeProvider } = provider;
  return {
    ...safeProvider,
    keyPreview: provider.apiKey ? previewSecret(provider.apiKey) : undefined
  };
}

function publicMaterial(material: MaterialRecord): PublicMaterialRecord {
  const { path: _path, ...safeMaterial } = material;
  return safeMaterial;
}

function publicChannel(channel: ChannelRecord): PublicChannelRecord {
  const { secretRef: _secretRef, ...safeChannel } = channel;
  return safeChannel;
}

function publicOutreachSender(sender: OutreachSenderAccount): PublicOutreachSenderAccount {
  const { passwordRef: _passwordRef, oauthApi, serviceApi, ...safeSender } = sender;
  return {
    ...safeSender,
    lastError: safeSender.lastError ? redactSecrets(safeSender.lastError) : undefined,
    lastInboxCheckMessage: safeSender.lastInboxCheckMessage ? redactSecrets(safeSender.lastInboxCheckMessage) : undefined,
    oauthApi: publicOutreachSenderApiCredential(oauthApi),
    serviceApi: publicOutreachSenderApiCredential(serviceApi)
  };
}

function publicOutreachSenderApiCredential(credential: OutreachSenderAccount["oauthApi"]): PublicOutreachSenderApiCredential | undefined {
  if (!credential) return undefined;
  const { credentialRef: _credentialRef, ...safeCredential } = credential;
  return safeCredential;
}

function campaignStats(recipients: OutreachCampaignRecipient[]): OutreachCampaign["stats"] {
  const stats: OutreachCampaign["stats"] = {
    total: recipients.length,
    pending: 0,
    researching: 0,
    generated: 0,
    approved: 0,
    queued: 0,
    sending: 0,
    sent: 0,
    replied: 0,
    bounced: 0,
    unsubscribed: 0,
    stopped: 0,
    failed: 0,
    skipped: 0
  };
  for (const recipient of recipients) {
    stats[recipient.status] += 1;
  }
  return stats;
}

function campaignDeliverabilityStats(recipients: OutreachCampaignRecipient[]): OutreachCampaign["deliverabilityStats"] {
  const stats = {
    attempted: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    bounced: 0,
    unsubscribed: 0,
    highSpamRisk: 0,
    mailboxIssues: 0,
    domainIssues: 0,
    abnormalFrequency: 0
  };
  for (const recipient of recipients) {
    const outcome = recipient.sendOutcome;
    if (["queued", "sent", "delivered", "opened", "clicked", "replied", "bounced", "failed", "unsubscribed"].includes(outcome.status) || ["sent", "replied", "bounced", "unsubscribed", "failed"].includes(recipient.status)) stats.attempted += 1;
    if (outcome.status === "sent" || recipient.status === "sent") stats.sent += 1;
    if (outcome.status === "delivered") stats.delivered += 1;
    if (outcome.opened) stats.opened += 1;
    if (outcome.clicked) stats.clicked += 1;
    if (outcome.replied || recipient.status === "replied") stats.replied += 1;
    if (outcome.bounced || recipient.status === "bounced") stats.bounced += 1;
    if (outcome.status === "unsubscribed" || recipient.status === "unsubscribed") stats.unsubscribed += 1;
    if (outcome.spamFolderRisk === "high" || outcome.subjectMarketingRisk === "high") stats.highSpamRisk += 1;
    if (outcome.senderMailboxHealth === "poor") stats.mailboxIssues += 1;
    if (outcome.senderDomainHealth === "poor") stats.domainIssues += 1;
    if (outcome.abnormalSendFrequency) stats.abnormalFrequency += 1;
  }
  return stats;
}

function campaignLearningSummary(recipients: OutreachCampaignRecipient[]): OutreachCampaign["learningSummary"] {
  const effective = recipients.filter((recipient) => recipient.status === "replied" || recipient.learningSignal.replyOutcome === "positive" || recipient.learningSignal.replyOutcome === "referral");
  const weak = recipients.filter((recipient) => recipient.status === "bounced" || recipient.status === "unsubscribed" || recipient.learningSignal.replyOutcome === "rejection");
  const unique = <T extends string | undefined>(values: T[], limit: number): NonNullable<T>[] => Array.from(new Set(values.filter(Boolean) as NonNullable<T>[])).slice(0, limit);
  return {
    sampleSize: recipients.filter((recipient) => recipient.learningSignal.recordedAt || recipient.sendOutcome.status !== "not-sent").length,
    responsiveCustomerTypes: unique(effective.map((recipient) => recipient.learningSignal.customerType), 12),
    responsiveCountries: unique(effective.map((recipient) => recipient.learningSignal.customerCountry), 20),
    responsiveIndustries: unique(effective.map((recipient) => recipient.learningSignal.customerIndustry), 20),
    effectiveAngles: unique(effective.map((recipient) => recipient.learningSignal.developmentAngle), 12),
    effectiveSubjects: unique(effective.map((recipient) => recipient.learningSignal.subject), 20),
    effectiveCtas: unique(effective.map((recipient) => recipient.learningSignal.cta), 20),
    effectiveValuePoints: unique(effective.map((recipient) => recipient.learningSignal.valuePoint), 20),
    weakSignals: unique(weak.map((recipient) => recipient.sendOutcome.notes || recipient.stopReason || recipient.sendError), 20),
    riskyPhrases: [],
    userKeptPatterns: [],
    userRemovedPatterns: [],
    updatedAt: new Date().toISOString()
  };
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value.length)) rows.push(row);
  return rows;
}

function normalizeCsvHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-()（）:：/\\]+/g, "");
}

function csvValue(headers: string[], row: string[], aliases: string[]): string | undefined {
  const normalizedAliases = aliases.map(normalizeCsvHeader);
  const index = headers.findIndex((header) => normalizedAliases.includes(header));
  const value = index >= 0 ? row[index]?.trim() : "";
  return value || undefined;
}

function leadInputFromCsv(headers: string[], row: string[]): z.input<typeof OutreachLeadInputBody> {
  const tags = csvValue(headers, row, ["tags", "tag", "标签"])?.split(/[;,，、]/).map((tag) => tag.trim()).filter(Boolean) ?? [];
  return {
    companyName: csvValue(headers, row, ["company", "company name", "companyName", "公司", "公司名", "客户公司", "客户公司名"]) ?? "",
    website: csvValue(headers, row, ["website", "url", "site", "官网", "网站", "网址"]),
    country: csvValue(headers, row, ["country", "market", "region", "国家", "市场", "地区"]),
    industry: csvValue(headers, row, ["industry", "sector", "行业"]),
    contactName: csvValue(headers, row, ["contact", "contact name", "contactName", "name", "联系人", "客户姓名", "姓名"]),
    contactTitle: csvValue(headers, row, ["title", "position", "job title", "职位", "岗位"]),
    email: csvValue(headers, row, ["email", "mail", "e-mail", "邮箱", "邮件", "客户邮箱"]),
    need: csvValue(headers, row, ["need", "pain", "pain point", "需求", "痛点", "采购需求"]) ?? "",
    notes: csvValue(headers, row, ["notes", "note", "remark", "备注", "说明"]) ?? "",
    tags
  };
}

interface CustomerResearchResult {
  website: string;
  companyName: string;
  depth: OutreachResearchDepth;
  confidenceScore: number;
  buyerType: string;
  productSignals: string[];
  buyingSignals: string[];
  painSignals: string[];
  recommendedAngle: string;
  industry: string;
  inferredNeed: string;
  title: string;
  description: string;
  fetchedUrls: string[];
  evidence: CustomerResearchEvidence[];
  brief?: CustomerResearchBrief;
  structuredBrief?: CustomerResearchStructuredBrief;
  textPreview: string;
  error?: string;
}

interface CustomerResearchEvidence {
  label: string;
  value: string;
  sourceUrl: string;
  snippet: string;
}

type CustomerResearchStructuredSignalKind = "website_structure" | "product" | "channel" | "news" | "certificate" | "procurement";
type CustomerResearchWebsiteSectionType = "home" | "about" | "product" | "channel" | "news" | "certificate" | "contact" | "procurement" | "other";
type CustomerResearchSignalConfidence = "direct" | "inferred";

interface CustomerResearchStructuredSignal {
  kind: CustomerResearchStructuredSignalKind;
  label: string;
  value: string;
  sourceUrl: string;
  evidenceUrl: string;
  snippet: string;
  confidence: CustomerResearchSignalConfidence;
}

interface CustomerResearchWebsiteSection {
  type: CustomerResearchWebsiteSectionType;
  title: string;
  url: string;
  evidence: string[];
}

interface CustomerResearchStructuredBrief {
  version: 1;
  websiteStructure: {
    homepage: string;
    checkedUrls: string[];
    sections: CustomerResearchWebsiteSection[];
  };
  products: CustomerResearchStructuredSignal[];
  channels: CustomerResearchStructuredSignal[];
  news: CustomerResearchStructuredSignal[];
  certificates: CustomerResearchStructuredSignal[];
  procurementSignals: CustomerResearchStructuredSignal[];
  evidenceUrls: string[];
  judgeInput: {
    companyName: string;
    website: string;
    confidenceScore: number;
    fitVerdict?: CustomerResearchBrief["fitVerdict"];
    shouldWrite?: CustomerResearchBrief["shouldWrite"];
    buyerType: string;
    industry: string;
    evidence: CustomerResearchStructuredSignal[];
    claimsToAvoid: string[];
  };
}

interface OutreachGenerationBrief {
  buyerReason: string;
  buyerSegment: string;
  likelyPain: string;
  procurementTrigger: string;
  selectedUsp: {
    headline: string;
    buyerAngle: string;
    proof: string;
  };
  microOffer: string;
  valueMatch?: OutreachMatchedValuePoint;
  missingEvidence: string[];
  developmentJudgment?: CustomerDevelopmentJudgment;
}

interface OutreachMatchedValuePoint {
  customerConcern: string;
  concreteValue: string;
  proof: string;
  cta: string;
  source: "company-profile" | "usp-asset" | "company-material" | "fallback";
  proofLevel: "verified" | "profile-derived" | "needs-proof";
  score: number;
  uspId?: string;
  ctaAssetId?: string;
}

interface CustomerDevelopmentJudgment {
  customerType: string;
  customerTypeReason: string;
  developmentMethod: string;
  successPath: string;
  fitScore: number;
  expectedReplyRate: string;
  fitRationale: string;
  scoreFactors: string[];
  primaryRisks: string[];
}

interface OutreachOsContext {
  mode: OutreachGenerationMode;
  evidenceMap: OutreachEvidenceMap;
  leadFitScore: OutreachLeadFitScore;
  evidenceLock: OutreachEvidenceLock;
  strategyMatch: OutreachStrategyMatch;
  valueMatch: OutreachMatchedValuePoint;
  valueMatchRecord: OutreachValueMatch;
  researchBrief?: CustomerResearchBrief;
  personas: OutreachBuyerPersona[];
  usps: OutreachUspCandidate[];
  ctaAssets: OutreachCtaAsset[];
}

interface PolishedOutreachDraft {
  subject: string;
  body: string;
  qualityReview: OutreachEmailQualityReview;
  repairAttempts: number;
}

interface OutreachHarnessContext {
  model: string | undefined;
  goldenExamples: OutreachGoldenExample[];
  goldenExamplesContext: string;
  evidenceUsed: OutreachEvidenceItem[];
}

interface WebsitePageResult {
  url: string;
  html?: string;
  error?: string;
}

type DeepResearchInsight = {
  label?: string;
  value?: string;
  sourceUrl?: string;
  source_url?: string;
  snippet?: string;
};

type DeepResearchSource = {
  sourceUrl?: string;
  source_url?: string;
  url?: string;
  statusCode?: number;
  status_code?: number;
  title?: string;
  description?: string;
  snippet?: string;
  evidence?: DeepResearchInsight[];
};

type DeepResearchCompanyResponse = {
  website?: string;
  websiteUrl?: string;
  website_url?: string;
  companyName?: string;
  company_name?: string;
  confidenceScore?: number;
  confidence_score?: number;
  buyerType?: string;
  buyer_type?: string;
  industry?: string;
  inferredNeed?: string;
  inferred_need?: string;
  recommendedAngle?: string;
  recommended_angle?: string;
  title?: string;
  description?: string;
  productSignals?: string[];
  product_signals?: string[];
  buyingSignals?: string[];
  buying_signals?: string[];
  painSignals?: string[];
  pain_signals?: string[];
  fetchedUrls?: string[];
  fetched_urls?: string[];
  textPreview?: string;
  text_preview?: string;
  summary?: string;
  status?: string;
  sources?: DeepResearchSource[];
  warnings?: string[];
  errors?: Array<{ sourceUrl?: string; source_url?: string; code?: string; message?: string }>;
  evidence?: DeepResearchInsight[];
  error?: string;
};

class DeepResearchClient {
  private child?: ChildProcess;
  private endpoint?: string;
  private readonly config: DeepResearchSidecarConfig;
  private token = process.env.HERMILLS_DEEP_RESEARCH_TOKEN || randomUUID();
  private missingLogged = false;
  private readonly fetchImpl: typeof fetch;
  private readonly logs: LogRepository;
  private readonly baseDir?: string;

  constructor(options: { baseDir?: string; config?: Partial<DeepResearchSidecarConfig>; fetchImpl: typeof fetch; logs: LogRepository }) {
    this.baseDir = options.baseDir;
    this.config = resolveDeepResearchSidecarConfig(options.config);
    if (this.config.apiKey) this.token = this.config.apiKey;
    this.fetchImpl = options.fetchImpl;
    this.logs = options.logs;
  }

  async research(input: { website: string; email?: string; maxPages: number; timeoutMs: number }): Promise<CustomerResearchResult | undefined> {
    if (!this.config.enabled) return undefined;
    const endpoint = await this.ensureEndpoint();
    if (!endpoint) return undefined;
    const controller = new AbortController();
    const timeoutMs = this.config.timeoutMs || input.timeoutMs;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await this.fetchImpl(`${endpoint}/v1/research/company`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "authorization": `Bearer ${this.token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          website: input.website,
          email: input.email,
          maxPages: input.maxPages,
          mode: "outreach"
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json() as DeepResearchCompanyResponse;
      return normalizeDeepResearchResult(input.website, payload);
    } catch (error) {
      const message = timedOut ? `timed out after ${timeoutMs} ms` : error instanceof Error ? error.message : String(error);
      await this.logs.create({ source: "server", level: "warn", message: `Deep research engine failed; falling back to lightweight research: ${redactSecrets(message)}` });
      throw new Error(message);
    } finally {
      clearTimeout(timeout);
    }
  }

  async dispose(): Promise<void> {
    if (!this.child) return;
    this.child.kill();
    this.child = undefined;
  }

  private async ensureEndpoint(): Promise<string | undefined> {
    if (this.config.url) {
      this.endpoint = this.config.url.replace(/\/+$/, "");
      return this.endpoint;
    }
    if (this.endpoint && this.child && !this.child.killed) return this.endpoint;
    const executable = deepResearchExecutablePath(this.baseDir);
    if (!executable) {
      if (!this.missingLogged) {
        this.missingLogged = true;
        await this.logs.create({ source: "server", level: "info", message: "Deep research engine is not bundled yet; using lightweight website research." });
      }
      return undefined;
    }
    const port = await findOpenLocalPort();
    this.endpoint = `http://127.0.0.1:${port}`;
    this.child = spawn(executable.command, executable.args, {
      cwd: executable.cwd,
      env: {
        ...process.env,
        DEEP_RESEARCH_HOST: "127.0.0.1",
        DEEP_RESEARCH_PORT: String(port),
        DEEP_RESEARCH_TOKEN: this.token,
        DEEP_RESEARCH_MAX_PAGES: String(this.config.maxPages ?? 8),
        DEEP_RESEARCH_TIMEOUT_SECONDS: String(Math.max(1, Math.ceil(timeoutMsToSeconds(this.config.timeoutMs || 30_000)))),
        HERMILLS_RESEARCH_HOST: "127.0.0.1",
        HERMILLS_RESEARCH_PORT: String(port),
        HERMILLS_RESEARCH_TOKEN: this.token,
        PYTHONHOME: "",
        PYTHONPATH: ""
      },
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true
    });
    this.child.once("exit", () => {
      this.endpoint = undefined;
      this.child = undefined;
    });
    const startupTimeoutMs = Math.min(90_000, Math.max(45_000, this.config.timeoutMs || 30_000));
    const health = await waitForDeepResearchHealth(this.fetchImpl, this.endpoint, this.token, startupTimeoutMs);
    if (!health.ok) {
      await this.dispose();
      await this.logs.create({ source: "server", level: "warn", message: `Deep research engine did not become ready within ${startupTimeoutMs} ms; using lightweight website research.` });
      return undefined;
    }
    if (health.warning) {
      await this.logs.create({ source: "server", level: "warn", message: `Deep research engine is running with degraded fetchers: ${redactSecrets(health.warning)}` });
    }
    return this.endpoint;
  }
}

function resolveDeepResearchSidecarConfig(input?: Partial<DeepResearchSidecarConfig>): DeepResearchSidecarConfig {
  const envUrl = process.env.HERMILLS_DEEP_RESEARCH_URL || process.env.HERMILLS_DEEP_RESEARCH_SIDECAR_URL || undefined;
  const envEnabled = parseOptionalBoolean(process.env.HERMILLS_DEEP_RESEARCH_ENABLED);
  const envTimeoutMs = parseOptionalPositiveInteger(process.env.HERMILLS_DEEP_RESEARCH_TIMEOUT_MS);
  const envMaxPages = parseOptionalPositiveInteger(process.env.HERMILLS_DEEP_RESEARCH_MAX_PAGES);
  return DeepResearchRuntimeConfigSchema.parse({
    enabled: input?.enabled ?? envEnabled ?? true,
    url: input?.url ?? envUrl,
    timeoutMs: input?.timeoutMs ?? envTimeoutMs ?? undefined,
    maxPages: input?.maxPages ?? envMaxPages ?? undefined,
    apiKey: input?.apiKey ?? process.env.HERMILLS_DEEP_RESEARCH_API_KEY ?? undefined
  });
}

function timeoutMsToSeconds(value: number): number {
  return value / 1000;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (/^(1|true|yes|on)$/i.test(value)) return true;
  if (/^(0|false|no|off)$/i.test(value)) return false;
  return undefined;
}

function parseOptionalPositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeDeepResearchResult(website: string, payload: DeepResearchCompanyResponse): CustomerResearchResult {
  const normalizedWebsite = normalizeWebsiteUrl(payload.website || payload.websiteUrl || payload.website_url || website);
  const sources = normalizeDeepResearchSources(payload.sources ?? []);
  const sourceEvidence = sources.flatMap((source) => source.evidence.length ? source.evidence.map((item) => ({
    ...item,
    sourceUrl: item.sourceUrl ?? item.source_url ?? source.sourceUrl
  })) : [{
    label: source.title ? "Page title" : "Page text",
    value: source.title || source.description || source.snippet,
    sourceUrl: source.sourceUrl,
    snippet: source.snippet || source.description || source.title
  }]);
  const evidence = normalizeResearchEvidence([...(payload.evidence ?? []), ...sourceEvidence]);
  const title = payload.title?.trim() || sources.find((source) => source.title)?.title || "";
  const description = payload.description?.trim() || sources.find((source) => source.description)?.description || "";
  const sourceTextPreview = sources.map((source) => [source.title, source.description, source.snippet].filter(Boolean).join("\n")).filter(Boolean).join("\n\n");
  const textPreview = truncateForContext(payload.textPreview || payload.text_preview || payload.summary || sourceTextPreview || evidence.map((item) => `${item.label}: ${item.value}\n${item.snippet}`).join("\n\n"), researchDepthLimits("deep").textChars);
  const productSignals = (normalizeStringArray(payload.productSignals ?? payload.product_signals).length
    ? normalizeStringArray(payload.productSignals ?? payload.product_signals)
    : inferProductSignals(textPreview)).slice(0, 12);
  const buyingSignals = (normalizeStringArray(payload.buyingSignals ?? payload.buying_signals).length
    ? normalizeStringArray(payload.buyingSignals ?? payload.buying_signals)
    : inferBuyingSignals(textPreview)).slice(0, 12);
  const painSignals = (normalizeStringArray(payload.painSignals ?? payload.pain_signals).length
    ? normalizeStringArray(payload.painSignals ?? payload.pain_signals)
    : inferPainSignals(textPreview)).slice(0, 12);
  const industry = truncatePlain(payload.industry?.trim() || inferIndustry(textPreview), 160);
  const inferredNeed = truncatePlain(payload.inferredNeed?.trim() || payload.inferred_need?.trim() || inferCustomerNeed(textPreview), 2000);
  const buyerType = truncatePlain(payload.buyerType?.trim() || payload.buyer_type?.trim() || inferBuyerType(textPreview, industry), 160);
  const recommendedAngle = truncatePlain(payload.recommendedAngle?.trim() || payload.recommended_angle?.trim() || inferRecommendedAngle({ buyerType, industry, inferredNeed, productSignals, buyingSignals, painSignals }), 800);
  const fetchedUrls = Array.from(new Set([
    ...normalizeStringArray(payload.fetchedUrls ?? payload.fetched_urls),
    ...sources.map((source) => source.sourceUrl)
  ])).map((url) => truncatePlain(url, 1000)).slice(0, 12);
  const errors = payload.errors?.map((error) => [error.code, error.message].filter(Boolean).join(": ")).filter(Boolean) ?? [];
  const researchNote = [payload.error, ...(payload.warnings ?? []), ...errors].filter(Boolean).join(" ");
  const result: CustomerResearchResult = {
    website: normalizedWebsite,
    companyName: truncatePlain(payload.companyName?.trim() || payload.company_name?.trim() || inferCompanyName(title, description, normalizedWebsite), 180),
    depth: "deep",
    confidenceScore: clampInteger(payload.confidenceScore ?? payload.confidence_score, 0, 100, scoreResearchConfidence({
      fetchedPages: fetchedUrls.length,
      title,
      description,
      industry,
      inferredNeed,
      productSignals,
      buyingSignals,
      painSignals
    })),
    buyerType,
    productSignals,
    buyingSignals,
    painSignals,
    recommendedAngle,
    industry,
    inferredNeed,
    title: truncatePlain(title, 240),
    description: truncatePlain(description, 1000),
    fetchedUrls,
    evidence,
    textPreview,
    error: researchNote || undefined
  };
  return withCustomerResearchBrief(result);
}

function withCustomerResearchBrief(result: CustomerResearchResult): CustomerResearchResult {
  return {
    ...result,
    brief: buildCustomerResearchBrief(result)
  };
}

function judgeCustomerDevelopment(input: {
  research?: CustomerResearchResult;
  lead?: OutreachLead;
  facts?: ReturnType<typeof extractCompanyKnowledgeFacts>;
}): CustomerDevelopmentJudgment {
  const research = input.research;
  const facts = input.facts;
  const text = normalizeQualityText([
    input.lead?.companyName,
    input.lead?.industry,
    input.lead?.need,
    input.lead?.notes,
    research?.companyName,
    research?.title,
    research?.description,
    research?.buyerType,
    research?.industry,
    research?.inferredNeed,
    research?.recommendedAngle,
    research?.productSignals.join(" "),
    research?.buyingSignals.join(" "),
    research?.painSignals.join(" "),
    research?.evidence.map((item) => `${item.label} ${item.value} ${item.snippet}`).join(" "),
    research?.textPreview
  ].filter(Boolean).join("\n"));
  const type = inferCustomerDevelopmentType(text, research?.buyerType || input.lead?.industry || "");
  const evidenceCount = research?.evidence.length ?? 0;
  const concreteClueCount = research ? bestCustomerResearchClues(research, 5).length : 0;
  const evidenceScore = Math.min(18, evidenceCount * 2 + concreteClueCount * 4 + Math.min(research?.fetchedUrls.length ?? 0, 4));
  const purchase = scoreCustomerPurchaseIntent(text, research);
  const productFit = scoreCustomerProductFit({ text, research, lead: input.lead, facts });
  const sellerReadiness = scoreSellerReadiness(facts);
  const confidenceScore = Math.round((research?.confidenceScore ?? (input.lead?.website ? 35 : 20)) * 0.16);
  const hasEvidence = evidenceCount > 0 || concreteClueCount > 0 || Boolean(input.lead?.need || input.lead?.notes);
  const penalties = [
    !hasEvidence ? 18 : 0,
    research && research.confidenceScore < 25 ? 12 : 0,
    purchase.score < 6 ? 6 : 0,
    type.nonBuyer ? 28 : 0,
    type.peer && productFit.score < 8 ? 8 : 0,
    facts && !facts.mainProducts.length ? 8 : 0
  ];
  const fitScore = clampInteger(
    12 + confidenceScore + type.score + evidenceScore + purchase.score + productFit.score + sellerReadiness.score - penalties.reduce((sum, item) => sum + item, 0),
    0,
    100,
    40
  );
  const method = recommendCustomerDevelopmentMethod({
    type,
    purchase,
    productFit,
    sellerReadiness,
    fitScore,
    text,
    research
  });
  const expectedReplyRate = estimateExpectedReplyRate({
    fitScore,
    purchaseScore: purchase.score,
    evidenceScore,
    sellerReadinessScore: sellerReadiness.score,
    qualityScore: undefined
  });
  const primaryRisks = [
    ...method.risks,
    !hasEvidence ? "Buyer evidence is thin; use permission-based qualification instead of a confident pitch." : "",
    purchase.score < 6 ? "No direct purchasing signal was found; phrase needs as hypotheses." : "",
    type.peer ? "Buyer may make or OEM adjacent products; avoid treating them as a simple importer." : "",
    facts && !facts.mainProducts.length ? "Company profile lacks a product list, so the email must not invent a product fit." : ""
  ].filter(Boolean).slice(0, 5);
  const scoreFactors = [
    `Customer type score ${type.score}/28`,
    `Evidence score ${evidenceScore}/18`,
    `Purchase signal score ${purchase.score}/22`,
    `Product/company fit score ${productFit.score}/18`,
    `Seller readiness score ${sellerReadiness.score}/16`,
    `Research confidence contribution ${confidenceScore}/16`
  ];
  return {
    customerType: type.customerType,
    customerTypeReason: type.reason,
    developmentMethod: method.developmentMethod,
    successPath: method.successPath,
    fitScore,
    expectedReplyRate,
    fitRationale: truncatePlain([...scoreFactors, ...productFit.factors, ...purchase.factors].filter(Boolean).join("; "), 800),
    scoreFactors,
    primaryRisks
  };
}

function inferCustomerDevelopmentType(text: string, fallback: string): {
  customerType: string;
  reason: string;
  score: number;
  peer: boolean;
  nonBuyer: boolean;
} {
  const target = normalizeQualityText(`${text} ${fallback}`);
  const manufacturer = /\b(manufacturer|manufacturing|factory|oem|odm|production|producer|plant|mill|fabricator|assembly)\b/.test(target);
  const channel = /\b(importer|imports|import|distributor|distribution|wholesale|wholesaler|dealer|stockist|reseller|retailer|retail|ecommerce|marketplace|store|showroom|contractor)\b/.test(target);
  const brand = /\b(brand|private label|collection|catalog|category manager|merchandising|assortment|sku|launch|new range)\b/.test(target);
  const project = /\b(construction|contractor|builder|developer|architect|designer|interior|project|hospitality|hotel|commercial|specifier|engineering)\b/.test(target);
  const nonBuyer = /\b(software|consulting|agency|media|school|clinic|finance|insurance|law firm|restaurant|training)\b/.test(target)
    && !/\b(flooring|spc|lvt|vinyl|tile|building material|construction|procurement|sourcing|supplier|wholesale|retail|catalog)\b/.test(target);
  if (manufacturer && channel) {
    return {
      customerType: "Hybrid manufacturer/channel buyer",
      reason: "Website suggests both production capability and channel/resale activity; develop with a peer-aware supply or benchmark angle.",
      score: 20,
      peer: true,
      nonBuyer: false
    };
  }
  if (manufacturer) {
    return {
      customerType: "Manufacturer / OEM or peer",
      reason: "Website language points to manufacturing, OEM, production, or factory capability.",
      score: 12,
      peer: true,
      nonBuyer: false
    };
  }
  if (channel) {
    return {
      customerType: "Channel buyer / importer / distributor",
      reason: "Website shows import, distribution, wholesale, dealer, retail, ecommerce, showroom, or contractor channel signals.",
      score: 28,
      peer: false,
      nonBuyer: false
    };
  }
  if (brand) {
    return {
      customerType: "Brand or category owner",
      reason: "Website suggests category, catalog, collection, private-label, merchandising, or SKU ownership.",
      score: 24,
      peer: false,
      nonBuyer: false
    };
  }
  if (project) {
    return {
      customerType: "Project/specification buyer",
      reason: "Website suggests construction, contractor, design, hospitality, engineering, or project-specification work.",
      score: 20,
      peer: false,
      nonBuyer: false
    };
  }
  if (nonBuyer) {
    return {
      customerType: "Low-probability non-buyer",
      reason: "Website appears service-led and has weak product sourcing or channel-buying signals.",
      score: 0,
      peer: false,
      nonBuyer: true
    };
  }
  return {
    customerType: fallback || "Unclear B2B prospect",
    reason: "Buyer role is not explicit enough; use a qualification-first development path.",
    score: 8,
    peer: false,
    nonBuyer: false
  };
}

function scoreCustomerPurchaseIntent(text: string, research?: CustomerResearchResult): { score: number; factors: string[] } {
  let score = 0;
  const factors: string[] = [];
  const buyingSignalCount = research?.buyingSignals.length ?? 0;
  if (buyingSignalCount) {
    const value = Math.min(12, buyingSignalCount * 5);
    score += value;
    factors.push(`buying signals +${value}`);
  }
  const directPatterns = [
    { pattern: /\b(rfq|request a quote|quote request|get a quote|contact sales|procurement|sourcing|supplier|vendor|purchase|purchasing)\b/, label: "direct procurement wording", value: 8 },
    { pattern: /\b(import|distributor|wholesale|dealer|stock|inventory|warehouse|container|truckload|bulk)\b/, label: "channel or stock signal", value: 6 },
    { pattern: /\b(sample|samples|catalog|catalogue|specification|specs|download|certification|compliance|lead time|moq)\b/, label: "evaluation artifact signal", value: 5 }
  ];
  for (const item of directPatterns) {
    if (item.pattern.test(text)) {
      score += item.value;
      factors.push(`${item.label} +${item.value}`);
    }
  }
  return { score: Math.min(22, score), factors: factors.slice(0, 4) };
}

function scoreCustomerProductFit(input: {
  text: string;
  research?: CustomerResearchResult;
  lead?: OutreachLead;
  facts?: ReturnType<typeof extractCompanyKnowledgeFacts>;
}): { score: number; factors: string[] } {
  const facts = input.facts;
  const sellerTerms = sellerProductTerms(facts?.mainProducts ?? []);
  const target = normalizeQualityText([
    input.text,
    input.research?.productSignals.join(" "),
    input.lead?.need
  ].filter(Boolean).join(" "));
  const hits = sellerTerms.filter((term) => qualityTextContainsToken(target, term));
  let score = Math.min(18, hits.length * 6);
  const factors: string[] = [];
  if (hits.length) factors.push(`seller product terms matched: ${hits.slice(0, 4).join(", ")}`);
  if (!hits.length && sellerTerms.length && (input.research?.productSignals.length || input.lead?.need)) {
    score += 6;
    factors.push("buyer category exists but exact seller-product overlap is inferred");
  }
  if (!sellerTerms.length && (input.research?.productSignals.length || input.lead?.need)) {
    score += 4;
    factors.push("buyer product signal exists, but seller product list is missing");
  }
  return { score: Math.min(18, score), factors };
}

function sellerProductTerms(products: string[]): string[] {
  const terms = products.flatMap((product) => {
    const normalized = normalizeQualityText(product);
    const pieces = normalized.split(/[,;/|]+|\band\b/).map((item) => item.trim()).filter(Boolean);
    const tokens = normalized.split(/[^a-z0-9]+/i).map((token) => token.trim()).filter((token) => token.length >= 3);
    return [normalized, ...pieces, ...tokens];
  });
  return Array.from(new Set(terms
    .map((term) => normalizeQualityText(term))
    .filter((term) => term.length >= 3 && !commonQualityTokens.has(term))))
    .slice(0, 30);
}

function scoreSellerReadiness(facts?: ReturnType<typeof extractCompanyKnowledgeFacts>): { score: number; factors: string[] } {
  if (!facts) return { score: 0, factors: ["seller profile not loaded"] };
  let score = 0;
  const factors: string[] = [];
  if (facts.mainProducts.length) {
    score += 8;
    factors.push("seller product list +8");
  }
  if (facts.certifications.length) {
    score += 4;
    factors.push("certification proof +4");
  }
  if (facts.shippingTerms.length) {
    score += 3;
    factors.push("shipping/lead-time proof +3");
  }
  if (facts.paymentTerms.length) {
    score += 1;
    factors.push("payment terms +1");
  }
  return { score: Math.min(16, score), factors };
}

function recommendCustomerDevelopmentMethod(input: {
  type: ReturnType<typeof inferCustomerDevelopmentType>;
  purchase: ReturnType<typeof scoreCustomerPurchaseIntent>;
  productFit: ReturnType<typeof scoreCustomerProductFit>;
  sellerReadiness: ReturnType<typeof scoreSellerReadiness>;
  fitScore: number;
  text: string;
  research?: CustomerResearchResult;
}): { developmentMethod: string; successPath: string; risks: string[] } {
  const proofSignal = /\b(certification|compliance|test report|testing|spec|specification|quality|warranty|audit)\b/.test(input.text)
    || input.research?.painSignals.some((signal) => /proof|certification|quality|compliance/i.test(signal));
  const logisticsSignal = /\b(lead time|lead-time|delivery|ship|shipping|warehouse|inventory|stock|replenish|container|truckload)\b/.test(input.text)
    || input.research?.painSignals.some((signal) => /lead time|delivery|supply/i.test(signal));
  if (input.type.nonBuyer || input.fitScore < 30) {
    return {
      developmentMethod: "Qualification-first development",
      successPath: "Ask a low-pressure category-owner or referral question, then offer a small proof pack only if they confirm relevance.",
      risks: ["Do not force a supplier pitch; the account may only be useful through referral or future category validation."]
    };
  }
  if (input.type.peer) {
    return {
      developmentMethod: "Complementary / backup development",
      successPath: "Use a peer-to-peer angle: complementary spec benchmark, backup capacity, proof pack, or sample-ready comparison without calling them an importer.",
      risks: ["Generic finished-goods supplier positioning can feel tone-deaf for a manufacturer or OEM peer."]
    };
  }
  if (proofSignal) {
    return {
      developmentMethod: "Proof-first development",
      successPath: "Lead with a small certification/spec proof pack or side-by-side comparison so the buyer can judge risk before a commercial conversation.",
      risks: input.sellerReadiness.score < 12 ? ["Proof angle needs saved company certifications/specs; stay conservative if missing."] : []
    };
  }
  if (logisticsSignal) {
    return {
      developmentMethod: "Backup supply / lead-time development",
      successPath: "Frame the outreach around reducing reorder, stock, lead-time, or backup-supplier risk with a small MOQ/lead-time comparison.",
      risks: ["Do not promise lead time, stock, or delivery performance unless company materials support it."]
    };
  }
  if (/brand|category|retail|ecommerce|collection|catalog|assortment|sku/i.test(input.type.customerType)) {
    return {
      developmentMethod: "Category-fit development",
      successPath: "Connect a visible product/category clue to 2-3 sample-ready options, packaging or market-fit notes, and one easy comparison step.",
      risks: ["Avoid a broad catalog dump; the first reply trigger should make category evaluation easier."]
    };
  }
  if (/project|specification/i.test(input.type.customerType)) {
    return {
      developmentMethod: "Project/spec development",
      successPath: "Offer a compact spec, certification, or application-fit check aligned with their project/channel context.",
      risks: ["Avoid implying active projects unless the website explicitly shows them."]
    };
  }
  return {
    developmentMethod: "Standard channel supply development",
    successPath: "Lead with the strongest website clue, connect it to sourcing or category risk, then offer a small option, MOQ/lead-time, or proof comparison.",
    risks: input.purchase.score < 8 ? ["Purchase intent is inferred, so the email should ask for fit rather than assume active sourcing."] : []
  };
}

function estimateExpectedReplyRate(input: {
  fitScore: number;
  purchaseScore: number;
  evidenceScore: number;
  sellerReadinessScore: number;
  qualityScore?: number;
}): string {
  const qualityMultiplier = input.qualityScore === undefined ? 1 : 0.75 + Math.max(0, Math.min(100, input.qualityScore)) / 400;
  const midpoint = Math.max(0.4, Math.min(14,
    (1.2 + input.fitScore * 0.085 + input.purchaseScore * 0.08 + input.evidenceScore * 0.05 + input.sellerReadinessScore * 0.04) * qualityMultiplier
  ));
  const low = Math.max(0.3, midpoint * 0.65);
  const high = Math.min(18, midpoint * 1.35);
  return `${formatReplyRatePercent(low)}-${formatReplyRatePercent(high)}%`;
}

function formatReplyRatePercent(value: number): string {
  if (value < 3) return value.toFixed(1).replace(/\.0$/, "");
  if (value < 10) return value.toFixed(1).replace(/\.0$/, "");
  return String(Math.round(value));
}

function buildCustomerResearchBrief(research: CustomerResearchResult): CustomerResearchBrief {
  const text = normalizeQualityText([
    research.companyName,
    research.title,
    research.description,
    research.buyerType,
    research.industry,
    research.inferredNeed,
    research.recommendedAngle,
    research.productSignals.join(" "),
    research.buyingSignals.join(" "),
    research.painSignals.join(" "),
    research.evidence.map((item) => `${item.label} ${item.value} ${item.snippet}`).join(" "),
    research.textPreview
  ].filter(Boolean).join("\n"));
  const concreteClues = bestCustomerResearchClues(research, 5);
  const evidenceLines = concreteClues.length
    ? concreteClues
    : research.evidence.slice(0, 5).map((item) => item.snippet || item.value).filter(Boolean);
  const judgment = judgeCustomerDevelopment({ research });
  const isFlooringContext = /\b(spc|lvt|vinyl|flooring|plank|rigid core|laminate|tile)\b/.test(text);
  const isManufacturerOrPeer = /\b(manufacturer|manufacturing|factory|oem|odm|production|producer|plant|mill)\b/.test(text)
    || /\b(manufacturer|oem|peer)\b/i.test(judgment.customerType);
  const isDistributorOrImporter = /\b(importer|import|distributor|distribution|wholesale|wholesaler|dealer|retailer|retail|ecommerce|store|showroom|contractor)\b/.test(text);
  const hasPurchaseIntent = research.buyingSignals.length > 0
    || /\b(sourcing|procurement|supplier|suppliers|import|distributor|wholesale|dealer|stock|inventory|catalog|sample|quote|rfq|request a quote|contact sales|quick[- ]ship|container|truckload)\b/.test(text);
  const hasEvidence = evidenceLines.length > 0 || research.evidence.length > 0;
  const fitVerdict: CustomerResearchBrief["fitVerdict"] = !hasEvidence || research.confidenceScore < 25
    ? "unknown"
    : judgment.fitScore >= 72 || isDistributorOrImporter || hasPurchaseIntent
      ? "good-fit"
      : judgment.fitScore < 32
        ? "poor-fit"
        : "cautious";
  const shouldWrite: CustomerResearchBrief["shouldWrite"] = fitVerdict === "good-fit" ? "yes" : "cautious";
  const purchaseIntentSignal = hasPurchaseIntent
    ? (research.buyingSignals[0] || "Website shows buying/sourcing-style signals, but the email must still phrase them as signals, not confirmed intent.")
    : "No direct purchasing signal was found. Treat the buyer need as inferred, not proven.";
  const buyerTypeDetail = truncatePlain(`${judgment.customerType}: ${judgment.customerTypeReason} Fit score ${judgment.fitScore}/100; estimated cold reply rate ${judgment.expectedReplyRate}.`, 500);
  const bestOutreachPath = truncatePlain(`${judgment.developmentMethod}: ${judgment.successPath}`, 800);
  const mainRisk = judgment.primaryRisks[0] ?? (isManufacturerOrPeer && isFlooringContext
    ? "Biggest risk: sending a generic supplier email to a company that may already manufacture similar products."
    : !hasPurchaseIntent
      ? "Biggest risk: overstating buying intent when the website only shows general business context."
      : (research.painSignals[0] || "Biggest risk: writing a generic email that does not connect the buyer clue to a practical sourcing task."));
  const recommendedContactRoles = /brand|category|retail|ecommerce/i.test(judgment.customerType)
    ? ["Category manager", "Merchandising manager", "Sourcing manager", "Owner"]
    : /project|specification/i.test(judgment.customerType)
      ? ["Project manager", "Specification manager", "Sourcing manager", "Owner"]
      : /low-probability/i.test(judgment.customerType)
        ? ["Owner", "Operations manager", "Category owner"]
        : isManufacturerOrPeer
    ? ["Business development", "Product manager", "Sourcing manager", "International sales director"]
    : isDistributorOrImporter
      ? ["Category manager", "Sourcing manager", "Purchasing manager", "Owner"]
      : ["Sourcing manager", "Owner", "Operations manager"];
  const claimsToAvoid = [
    "Do not say the buyer is purchasing now unless the website explicitly shows it.",
    "Do not say we can solve their problem unless the problem is visible in the evidence.",
    "Do not use generic supplier claims like high quality, competitive price, one-stop solution, or factory direct.",
    isManufacturerOrPeer && isFlooringContext ? "Do not position them as a basic importer if they appear to manufacture or OEM similar flooring products." : "",
    "Do not mention certifications, cases, prices, MOQ, lead time, or sample policy unless those facts exist in company materials."
  ].filter(Boolean);
  const angles: CustomerResearchBrief["outreachAngles"] = [
    {
      name: judgment.developmentMethod,
      whyItFits: judgment.successPath,
      buyerConcern: mainRisk,
      evidence: evidenceLines.slice(0, 4),
      claimsToAvoid: claimsToAvoid.slice(0, 4),
      riskLevel: judgment.fitScore >= 72 ? "low" : judgment.fitScore < 40 || isManufacturerOrPeer && isFlooringContext ? "high" : "medium"
    },
    {
      name: "Reply-rate recovery path",
      whyItFits: `Use the expected ${judgment.expectedReplyRate} reply range as a discipline check: one buyer clue, one risk-reduction value, one concrete micro-offer.`,
      buyerConcern: "The buyer may ignore a long supplier introduction if it does not reduce a practical evaluation task.",
      evidence: [research.recommendedAngle, research.inferredNeed, ...evidenceLines].filter(Boolean).slice(0, 4),
      claimsToAvoid: ["Do not promise a custom plan before seeing requirements.", "Do not ask for all requirements in the first email."],
      riskLevel: "low"
    }
  ];
  const bestAngle = angles[0]?.name ?? judgment.developmentMethod;
  const handoffBrief = [
    `Fit verdict: ${fitVerdict}; write mode: ${shouldWrite}.`,
    `Customer type: ${judgment.customerType}`,
    `Customer type reason: ${judgment.customerTypeReason}`,
    `Development method: ${judgment.developmentMethod}`,
    `Fit score: ${judgment.fitScore}/100; estimated cold reply rate: ${judgment.expectedReplyRate}.`,
    `Score calculation: ${judgment.fitRationale}`,
    `Purchase signal: ${purchaseIntentSignal}`,
    `Best path: ${bestOutreachPath}`,
    `Main risk: ${mainRisk}`,
    evidenceLines.length ? `Evidence to use: ${evidenceLines.slice(0, 5).join(" | ")}` : "Evidence to use: none strong enough; stay conservative.",
    `Contact roles: ${recommendedContactRoles.join(", ")}`,
    `Do not say: ${claimsToAvoid.join(" | ")}`
  ].join("\n");
  return CustomerResearchBriefSchema.parse({
    fitVerdict,
    shouldWrite,
    buyerTypeDetail,
    purchaseIntentSignal,
    bestOutreachPath,
    mainRisk,
    recommendedContactRoles,
    claimsToAvoid,
    outreachAngles: angles,
    bestAngle,
    handoffBrief: truncateForContext(handoffBrief, 3000)
  });
}

function normalizeDeepResearchSources(items: DeepResearchSource[]): Array<{
  sourceUrl: string;
  title: string;
  description: string;
  snippet: string;
  evidence: DeepResearchInsight[];
}> {
  return items.map((item) => ({
    sourceUrl: truncatePlain(String(item.sourceUrl ?? item.source_url ?? item.url ?? "").trim(), 1000),
    title: truncatePlain(String(item.title ?? "").trim(), 240),
    description: truncatePlain(String(item.description ?? "").trim(), 1000),
    snippet: truncatePlain(String(item.snippet ?? "").trim(), 800),
    evidence: item.evidence ?? []
  })).filter((item) => item.sourceUrl).slice(0, 20);
}

function normalizeResearchEvidence(items: DeepResearchInsight[]): CustomerResearchEvidence[] {
  return items.map((item) => {
    const snippet = truncatePlain(String(item.snippet ?? "").trim(), 800);
    const value = truncatePlain(String(item.value ?? snippet ?? "").trim(), 600);
    return {
      label: truncatePlain(String(item.label ?? "Website evidence").trim(), 160) || "Website evidence",
      value,
      sourceUrl: truncatePlain(String(item.sourceUrl ?? item.source_url ?? "").trim(), 1000),
      snippet
    };
  }).filter((item) => item.value && item.sourceUrl).slice(0, 40);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function deepResearchExecutablePath(baseDir?: string): { command: string; args: string[]; cwd: string } | undefined {
  const envPath = process.env.HERMILLS_DEEP_RESEARCH_EXE;
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const candidates = [
    envPath,
    resourcesPath ? path.join(resourcesPath, "hermills-engines", "deep-research", "bin", process.platform === "win32" ? "run-python.cmd" : "run-python") : undefined,
    resourcesPath ? path.join(resourcesPath, "hermills-engines", "deep-research", process.platform === "win32" ? "HermillsResearch.exe" : "HermillsResearch") : undefined,
    resourcesPath ? path.join(resourcesPath, "deep-research", process.platform === "win32" ? "HermillsResearch.exe" : "HermillsResearch") : undefined,
    baseDir ? path.join(baseDir, "hermills-engines", "deep-research", "bin", process.platform === "win32" ? "run-python.cmd" : "run-python") : undefined,
    baseDir ? path.join(baseDir, "deep-research", process.platform === "win32" ? "HermillsResearch.exe" : "HermillsResearch") : undefined
  ].filter((candidate): candidate is string => Boolean(candidate));
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) return undefined;
  if (/run-python\.cmd$/i.test(executable)) {
    const comspec = process.env.ComSpec || "cmd.exe";
    return { command: comspec, args: ["/d", "/s", "/c", `"${executable}" -m deep_research`], cwd: path.dirname(path.dirname(executable)) };
  }
  if (/run-python$/i.test(executable)) {
    return { command: executable, args: ["-m", "deep_research"], cwd: path.dirname(path.dirname(executable)) };
  }
  return { command: executable, args: [], cwd: path.dirname(executable) };
}

async function findOpenLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => port ? resolve(port) : reject(new Error("No local port was assigned.")));
    });
  });
}

async function waitForDeepResearchHealth(fetchImpl: typeof fetch, endpoint: string, token: string, timeoutMs: number): Promise<{ ok: boolean; warning?: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetchImpl(`${endpoint}/health`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(1500)
      });
      if (response.ok) {
        const payload = await response.json().catch(() => undefined) as { fetcher?: { warning?: string; layers?: Array<{ warning?: string }> } } | undefined;
        const warning = [
          payload?.fetcher?.warning,
          ...(payload?.fetcher?.layers ?? []).map((layer) => layer.warning)
        ].filter(Boolean).join("; ");
        return { ok: true, warning: warning || undefined };
      }
    } catch {
      // Retry until deadline.
    }
    await delay(300);
  }
  return { ok: false };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertPublicResearchWebsite(website: string): void {
  let parsed: URL;
  try {
    parsed = new URL(website);
  } catch {
    throw new ClientInputError("Enter a valid customer website.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new ClientInputError("Customer website must use http or https.");
  const host = parsed.hostname.replace(/\.$/, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new ClientInputError("Customer website must be a public company website.");
  }
  const ipVersion = net.isIP(host);
  if (ipVersion && isPrivateOrLocalIp(host)) throw new ClientInputError("Customer website must not point to a local or private network address.");
}

function isPrivateOrLocalIp(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (normalized === "0.0.0.0" || normalized === "255.255.255.255") return true;
  if (normalized === "::" || normalized === "::1") return true;
  if (net.isIP(normalized) === 4) {
    const octets = normalized.split(".").map((part) => Number(part));
    if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = octets;
    return a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIP(normalized) === 6) {
    return normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe80:")
      || normalized.startsWith("::ffff:127.")
      || normalized.startsWith("::ffff:10.")
      || normalized.startsWith("::ffff:192.168.")
      || normalized.startsWith("::ffff:169.254.");
  }
  return false;
}

async function researchCustomerWebsite(rawWebsite: string, depth: OutreachResearchDepth = "adaptive", options: { email?: string; deepResearch?: DeepResearchClient; cache?: CustomerResearchCacheRepository } = {}): Promise<CustomerResearchResult> {
  const website = normalizeWebsiteUrl(rawWebsite);
  assertPublicResearchWebsite(website);
  const cacheKey = customerResearchCacheKey(website, depth);
  const cached = await options.cache?.get(cacheKey);
  if (cached) return cached;
  let deepResearchFallbackReason = "";
  const shouldTryDeepResearch = depth === "adaptive" || depth === "deep";
  const localResearchDepth: OutreachResearchDepth = depth === "adaptive" ? "deep" : depth;
  if (shouldTryDeepResearch && options.deepResearch) {
    try {
      const deepResult = await options.deepResearch.research({
        website,
        email: options.email,
        maxPages: researchDepthLimits("deep").pages,
        timeoutMs: 30_000
      });
      if (deepResult) {
        await options.cache?.set(cacheKey, website, depth, deepResult).catch(() => undefined);
        return deepResult;
      }
    } catch (error) {
      deepResearchFallbackReason = redactSecrets(error instanceof Error ? error.message : String(error));
    }
  }
  const limits = researchDepthLimits(localResearchDepth);
  const initial = await fetchWebsitePage(website);
  const fallbackNote = deepResearchFallbackReason
    ? `Deep research sidecar failed (${deepResearchFallbackReason}); used Node website research fallback.`
    : shouldTryDeepResearch
      ? `${depth === "adaptive" ? "Adaptive" : "Deep"} research sidecar was unavailable; used Node website research fallback.`
      : "";
  if (!initial.html) {
    const failedResult = withCustomerResearchBrief({
      website,
      companyName: companyNameFromWebsite(website),
      depth,
      confidenceScore: 12,
      buyerType: "",
      productSignals: [],
      buyingSignals: [],
      painSignals: [],
      recommendedAngle: "",
      industry: "",
      inferredNeed: "",
      title: "",
      description: "",
      fetchedUrls: [],
      evidence: [],
      textPreview: "",
      error: [fallbackNote, initial.error || "Could not fetch customer website."].filter(Boolean).join(" ")
    });
    await options.cache?.set(cacheKey, website, depth, failedResult).catch(() => undefined);
    return failedResult;
  }

  const urls = [website, ...pickResearchLinks(website, initial.html, localResearchDepth)].slice(0, limits.pages);
  const pages = [initial];
  for (const url of urls.slice(1)) pages.push(await fetchWebsitePage(url));
  const successfulPages = pages.filter((page): page is WebsitePageResult & { html: string } => Boolean(page.html));
  const title = extractHtmlTitle(initial.html);
  const description = extractMetaDescription(initial.html);
  const textPreview = truncateForContext(successfulPages.map((page) => extractReadableHtmlText(page.html)).join("\n\n"), limits.textChars);
  const companyName = inferCompanyName(title, description, website);
  const industry = inferIndustry(textPreview);
  const inferredNeed = inferCustomerNeed(textPreview);
  const productSignals = inferProductSignals(textPreview);
  const buyingSignals = inferBuyingSignals(textPreview);
  const painSignals = inferPainSignals(textPreview);
  const buyerType = inferBuyerType(textPreview, industry);
  const recommendedAngle = inferRecommendedAngle({ buyerType, industry, inferredNeed, productSignals, buyingSignals, painSignals });
  const result = withCustomerResearchBrief({
    website,
    companyName,
    depth,
    confidenceScore: scoreResearchConfidence({
      fetchedPages: successfulPages.length,
      title,
      description,
      industry,
      inferredNeed,
      productSignals,
      buyingSignals,
      painSignals
    }),
    buyerType,
    productSignals,
    buyingSignals,
    painSignals,
    recommendedAngle,
    industry,
    inferredNeed,
    title,
    description,
    fetchedUrls: successfulPages.map((page) => page.url),
    evidence: localResearchEvidence({
      website,
      title,
      description,
      productSignals,
      buyingSignals,
      painSignals,
      fetchedUrls: successfulPages.map((page) => page.url),
      textPreview
    }),
    textPreview,
    error: fallbackNote || undefined
  });
  await options.cache?.set(cacheKey, website, depth, result).catch(() => undefined);
  return result;
}

function customerResearchCacheKey(website: string, depth: OutreachResearchDepth): string {
  const normalized = normalizeWebsiteUrl(website);
  const limits = researchDepthLimits(depth === "adaptive" ? "deep" : depth);
  return `customer-research:v1:${depth}:${limits.pages}:${createHash("sha256").update(normalized).digest("hex")}`;
}

function researchCacheTtlMs(result: CustomerResearchResult): number {
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (!result.fetchedUrls.length || result.confidenceScore < 20) return 15 * minute;
  if (result.error) return hour;
  if (result.confidenceScore >= 60 && result.fetchedUrls.length >= 2) return 14 * day;
  return 7 * day;
}

function localResearchEvidence(input: {
  website: string;
  title: string;
  description: string;
  productSignals: string[];
  buyingSignals: string[];
  painSignals: string[];
  fetchedUrls: string[];
  textPreview: string;
}): CustomerResearchEvidence[] {
  const sourceUrl = input.fetchedUrls[0] ?? input.website;
  const snippets = researchSnippetCandidates(input.textPreview);
  const fallbackSnippets = input.textPreview.split(/[.!?。]\s+/).map((part) => cleanWebsiteSnippetCandidate(part)).filter(Boolean);
  const findSnippet = (pattern: RegExp) => snippets.find((item) => pattern.test(item))
    ?? fallbackSnippets.find((item) => pattern.test(item))
    ?? "";
  const evidence: CustomerResearchEvidence[] = [];
  if (input.title) evidence.push({ label: "Page title", value: input.title, sourceUrl, snippet: snippets[0] ?? input.title });
  if (input.description) evidence.push({ label: "Meta description", value: input.description, sourceUrl, snippet: input.description });
  for (const signal of input.productSignals) evidence.push({ label: "Product signal", value: signal, sourceUrl, snippet: findSnippet(/product|catalog|category|range|collection|series|fortika|spc|lvt|oem|custom/i) || signal });
  for (const signal of input.buyingSignals) evidence.push({ label: "Buying signal", value: signal, sourceUrl, snippet: findSnippet(/supplier|sourcing|stock|inventory|launch|season|compliance|reorder|truckload|container|quick-ship|quick ship/i) || signal });
  for (const signal of input.painSignals) evidence.push({ label: "Risk signal", value: signal, sourceUrl, snippet: findSnippet(/delivery|ship|lead time|quality|certification|testing|cost|margin|packaging|moq|container|truckload/i) || signal });
  return evidence.slice(0, 24);
}

function researchSnippetCandidates(text: string): string[] {
  const decoded = decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
  if (!decoded) return [];
  const candidates: string[] = [];
  for (const part of decoded.split(/(?<=[.!?。])\s+/)) {
    candidates.push(part);
  }
  const keywordPattern = /\b(?:fortika|spc|lvt|luxury vinyl|vinyl plank|rigid core|truckload|container direct|container|quick-ship|quick ship|wholesale|distributor|retailer|collection|series|catalog|5mm|7\.5mm|wear layer|warranty|moq|lead time)\b/gi;
  for (const match of decoded.matchAll(keywordPattern)) {
    const index = match.index ?? 0;
    candidates.push(decoded.slice(Math.max(0, index - 90), Math.min(decoded.length, index + 170)));
  }
  const seen = new Set<string>();
  return candidates
    .map((item) => cleanWebsiteSnippetCandidate(item))
    .filter((item) => item && customerResearchClueScore(item, "") > 0)
    .sort((a, b) => customerResearchClueScore(b, "") - customerResearchClueScore(a, ""))
    .filter((item) => {
      const key = normalizeQualityText(item).replace(/[^a-z0-9]+/g, "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 18);
}

function cleanWebsiteSnippetCandidate(value: string): string {
  let clean = decodeHtmlEntities(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ")
    .replace(/\(?\+?\d[\d\s().-]{7,}\d/g, " ")
    .replace(/&#?\w+;?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  clean = clean.replace(/^.*\bSkip to content\b/i, "").trim();
  clean = clean.replace(/\b(?:Menu|Home|About|Contact|Shop|Cart|Search)\b(?:\s+\b(?:Menu|Home|About|Contact|Shop|Cart|Search)\b)+/gi, " ").trim();
  const keywordIndex = clean.search(/\b(?:Fortika|SPC|LVT|TruckLoad|Container Direct|quick-ship|quick ship|5mm|7\.5mm|wear layer|MOQ|lead time)\b/i);
  if (keywordIndex > 70) clean = clean.slice(Math.max(0, keywordIndex - 55));
  clean = clean.replace(/^[\s:|,，;.-]+|[\s:|,，;.-]+$/g, "").replace(/\s+/g, " ").trim();
  return truncatePlain(clean, 170);
}

async function fetchWebsitePage(url: string): Promise<WebsitePageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Hermills/1.0 customer-research" }
    });
    if (!response.ok) return { url, error: `Website returned HTTP ${response.status}.` };
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return { url, error: `Unsupported content type: ${contentType}` };
    }
    return { url, html: await response.text() };
  } catch (err) {
    return { url, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWebsiteUrl(value: string): string {
  const trimmed = value.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    url.hash = "";
    return url.toString();
  } catch {
    throw new ClientInputError("Enter a valid customer website.");
  }
}

function researchDepthLimits(depth: OutreachResearchDepth): { pages: number; textChars: number } {
  if (depth === "quick") return { pages: 1, textChars: 3_500 };
  if (depth === "deep" || depth === "adaptive") return { pages: 8, textChars: 12_000 };
  return { pages: 4, textChars: 8_000 };
}

function researchConcurrency(depth: OutreachResearchDepth): number {
  if (depth === "quick") return 6;
  if (depth === "deep" || depth === "adaptive") return 2;
  return 4;
}

function pickResearchLinks(baseUrl: string, html: string, depth: OutreachResearchDepth): string[] {
  const base = new URL(baseUrl);
  const researchPattern = depth === "deep" || depth === "adaptive"
    ? /about|company|product|solution|service|catalog|industr|contact|news|blog|case|customer|brand|category|collection|shop/i
    : /about|company|product|solution|service|catalog|industr|contact/i;
  const candidates = Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
    .map((match) => match[1]?.trim())
    .filter((href): href is string => Boolean(href))
    .map((href) => {
      try {
        return new URL(href, base).toString();
      } catch {
        return "";
      }
    })
    .filter((url) => {
      if (!url) return false;
      const parsed = new URL(url);
      if (parsed.origin !== base.origin) return false;
      return researchPattern.test(parsed.pathname);
    });
  return Array.from(new Set(candidates));
}

function extractHtmlTitle(html: string): string {
  return decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
}

function extractMetaDescription(html: string): string {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  return decodeHtmlEntities(match?.[1] ?? "").trim();
}

function extractReadableHtmlText(html: string): string {
  return decodeHtmlEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);?/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function inferCompanyName(title: string, description: string, website: string): string {
  const domainName = companyNameFromWebsite(website);
  const domainKey = comparableCompanyName(domainName);
  const titleSegments = splitTitleSegments(title).map(cleanCompanyTitleSegment).filter(Boolean);
  const matchingDomainSegment = titleSegments.find((segment) => {
    const key = comparableCompanyName(segment);
    return key && domainKey && (key.includes(domainKey) || domainKey.includes(key) || /\.[a-z]{2,}\b/i.test(segment));
  });
  if (matchingDomainSegment && matchingDomainSegment.length <= 80) return matchingDomainSegment;
  const firstUsefulTitleSegment = titleSegments.find((segment) => !companyTitleSegmentLooksGeneric(segment, domainName));
  if (firstUsefulTitleSegment && firstUsefulTitleSegment.length <= 80) return firstUsefulTitleSegment;
  const descriptionCandidate = cleanCompanyTitleSegment(description.split(/[.。]/)[0]?.trim() ?? "");
  if (descriptionCandidate && descriptionCandidate.length <= 80 && !companyTitleSegmentLooksGeneric(descriptionCandidate, domainName)) {
    return descriptionCandidate;
  }
  return companyNameFromWebsite(website);
}

function splitTitleSegments(title: string): string[] {
  return title.split(/\s*(?:\||[-–—])\s*/).map((segment) => segment.trim()).filter(Boolean);
}

function comparableCompanyName(value: string): string {
  return value.toLowerCase().replace(/\b(?:inc|llc|ltd|co|company|corp|corporation)\b/g, "").replace(/[^a-z0-9]+/g, "");
}

function cleanCompanyTitleSegment(value: string): string {
  return value
    .replace(/\b([A-Za-z0-9-]+)\.(?:com|net|org|co|io|cn|com\.cn|de|fr|it|es|nl|pl|uk)\b/gi, "$1")
    .replace(/\b(official\s+site|official\s+website|home\s+page|homepage|welcome\s+to)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:|,，-]+|[\s:|,，-]+$/g, "")
    .trim();
}

function companyTitleSegmentLooksGeneric(segment: string, domainName: string): boolean {
  const normalized = normalizeQualityText(segment);
  if (!normalized) return true;
  const segmentKey = comparableCompanyName(segment);
  const domainKey = comparableCompanyName(domainName);
  if (segmentKey && domainKey && (segmentKey.includes(domainKey) || domainKey.includes(segmentKey))) return false;
  if (/^(home|about us|contact us|products?|catalog(?:ue)?|flooring|spc|lvt)$/i.test(segment.trim())) return true;
  const seoTerms = [
    "flooring",
    "manufacturer",
    "supplier",
    "factory",
    "wholesale",
    "china",
    "vinyl",
    "plank",
    "spc",
    "lvt",
    "luxury",
    "waterproof",
    "rigid core",
    "products",
    "catalog"
  ];
  const termHits = seoTerms.filter((term) => normalized.includes(term)).length;
  const startsWithCategory = /^(spc|lvt|luxury vinyl|vinyl plank|waterproof|rigid core|wood flooring|flooring)\b/.test(normalized);
  return startsWithCategory || termHits >= 2;
}

function companyNameFromWebsite(website: string): string {
  try {
    const host = new URL(normalizeWebsiteUrl(website)).hostname.replace(/^www\./i, "");
    const name = host.split(".")[0] ?? "Customer";
    return name.split(/[-_]/).filter(Boolean).map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ") || "Customer";
  } catch {
    return "Customer";
  }
}

function companyNameFromEmail(email: string): string {
  const domain = email.split("@")[1] ?? email;
  return companyNameFromWebsite(domain);
}

function inferIndustry(text: string): string {
  const lower = text.toLowerCase();
  const matches: Array<[string, string[]]> = [
    ["Import / distribution", ["import", "distributor", "wholesale", "distribution"]],
    ["Retail / ecommerce", ["retail", "ecommerce", "online store", "shopify"]],
    ["Manufacturing", ["manufacturing", "factory", "production", "oem"]],
    ["Construction / engineering", ["construction", "engineering", "contractor"]],
    ["Hospitality", ["hotel", "restaurant", "hospitality"]]
  ];
  return matches.find(([, words]) => words.some((word) => lower.includes(word)))?.[0] ?? "";
}

function inferCustomerNeed(text: string): string {
  const lower = text.toLowerCase();
  if (/(import|distributor|wholesale|supply chain)/.test(lower)) return "May care about reliable supply, pricing, lead time, and product fit for their market.";
  if (/(retail|ecommerce|online store|catalog)/.test(lower)) return "May care about product differentiation, packaging, MOQ, and sell-through support.";
  if (/(manufacturer|factory|oem|production)/.test(lower)) return "May care about stable components, specifications, certification, and delivery reliability.";
  return "";
}

function inferBuyerType(text: string, industry: string): string {
  const lower = text.toLowerCase();
  if (/(importer|imports|distributor|distribution|wholesale|wholesaler)/.test(lower)) return "Importer / distributor";
  if (/(retail|ecommerce|online store|shopify|marketplace|amazon)/.test(lower)) return "Retail / ecommerce buyer";
  if (/(brand|private label|collection|catalog|category)/.test(lower)) return "Brand or category buyer";
  if (/(manufacturer|factory|oem|production|assembly)/.test(lower)) return "Manufacturer / OEM buyer";
  return industry || "Potential B2B buyer";
}

function inferProductSignals(text: string): string[] {
  return collectKeywordSignals(text, [
    ["Catalog / product range", ["catalog", "products", "collection", "categories", "range"]],
    ["Private label / OEM", ["private label", "oem", "custom", "customized", "branding"]],
    ["Samples / new arrivals", ["sample", "new arrival", "new product", "launch"]],
    ["Certification sensitive", ["certified", "certification", "compliance", "ce", "fda", "rohs", "iso"]],
    ["Bulk or wholesale buying", ["bulk", "wholesale", "distributor", "container", "pallet"]]
  ]);
}

function inferBuyingSignals(text: string): string[] {
  return collectKeywordSignals(text, [
    ["Seasonal or launch planning", ["season", "holiday", "launch", "new collection", "new range"]],
    ["Supplier comparison likely", ["supplier", "sourcing", "procurement", "vendor", "rfq"]],
    ["Channel expansion", ["new store", "retail partners", "distribution network", "market expansion"]],
    ["Compliance review", ["compliance", "certification", "testing", "audit", "quality control"]],
    ["Repeat replenishment", ["reorder", "stock", "inventory", "warehouse", "supply chain"]]
  ]);
}

function inferPainSignals(text: string): string[] {
  return collectKeywordSignals(text, [
    ["Needs stable lead time", ["lead time", "delivery", "ship", "logistics", "supply chain"]],
    ["Needs proof before samples", ["quality", "inspection", "certification", "testing", "warranty"]],
    ["Needs easier category selection", ["catalog", "range", "selection", "options", "sku"]],
    ["Needs margin support", ["price", "cost", "margin", "value", "competitive"]],
    ["Needs packaging or brand fit", ["packaging", "label", "brand", "retail ready", "display"]]
  ]);
}

function collectKeywordSignals(text: string, groups: Array<[string, string[]]>): string[] {
  const lower = text.toLowerCase();
  return groups
    .filter(([, keywords]) => keywords.some((keyword) => lower.includes(keyword)))
    .map(([label]) => label)
    .slice(0, 6);
}

function inferRecommendedAngle(input: {
  buyerType: string;
  industry: string;
  inferredNeed: string;
  productSignals: string[];
  buyingSignals: string[];
  painSignals: string[];
}): string {
  if (input.painSignals.some((signal) => /proof|certification|quality/i.test(signal))) return "Lead with proof: certifications, inspection process, or a small verification pack before discussing price.";
  if (input.buyingSignals.some((signal) => /seasonal|launch|channel/i.test(signal))) return "Lead with a small category-fit check and sample-ready options for the next launch or buying window.";
  if (input.productSignals.some((signal) => /catalog|range|selection/i.test(signal))) return "Lead with a short option list instead of a full catalog so the buyer can compare quickly.";
  if (input.inferredNeed) return input.inferredNeed;
  if (/ecommerce|retail/i.test(input.buyerType)) return "Lead with market-fit products, packaging, MOQ, and sell-through support.";
  if (/import|distributor|wholesale/i.test(input.buyerType)) return "Lead with supply reliability, lead time, MOQ, and repeat-order ease.";
  return "Lead with a low-friction question and ask whether this product category is handled by the right buyer.";
}

function scoreResearchConfidence(input: {
  fetchedPages: number;
  title: string;
  description: string;
  industry: string;
  inferredNeed: string;
  productSignals: string[];
  buyingSignals: string[];
  painSignals: string[];
}): number {
  let score = 10;
  score += Math.min(input.fetchedPages, 8) * 7;
  if (input.title) score += 8;
  if (input.description) score += 8;
  if (input.industry) score += 12;
  if (input.inferredNeed) score += 10;
  score += Math.min(input.productSignals.length, 4) * 5;
  score += Math.min(input.buyingSignals.length, 4) * 5;
  score += Math.min(input.painSignals.length, 4) * 4;
  return Math.min(100, score);
}

function formatCustomerResearchNotes(research: CustomerResearchResult): string {
  const notes = [
    "Auto customer research:",
    `Depth: ${research.depth}`,
    `Confidence: ${research.confidenceScore}/100`,
    research.title ? `Title: ${research.title}` : "",
    research.description ? `Description: ${research.description}` : "",
    research.buyerType ? `Buyer type: ${research.buyerType}` : "",
    research.industry ? `Likely industry: ${research.industry}` : "",
    research.inferredNeed ? `Possible concern: ${research.inferredNeed}` : "",
    research.productSignals.length ? `Product signals: ${research.productSignals.join("; ")}` : "",
    research.buyingSignals.length ? `Buying signals: ${research.buyingSignals.join("; ")}` : "",
    research.painSignals.length ? `Risk/pain signals: ${research.painSignals.join("; ")}` : "",
    research.recommendedAngle ? `Recommended angle: ${research.recommendedAngle}` : "",
    research.brief?.handoffBrief ? `Customer decision brief:\n${research.brief.handoffBrief}` : "",
    research.fetchedUrls.length ? `Checked pages: ${research.fetchedUrls.join(", ")}` : "",
    research.evidence.length ? `Evidence: ${formatCustomerResearchEvidence(research.evidence)}` : "",
    research.error ? `Research note: ${research.error}` : ""
  ].filter(Boolean).join("\n");
  return truncateForContext(notes, MAX_OUTREACH_LEAD_NOTES_CHARS);
}

function formatCustomerResearchContext(research: CustomerResearchResult): string {
  return [
    "--- Customer website research ---",
    `Website: ${research.website}`,
    `Research depth: ${research.depth}`,
    `Research confidence: ${research.confidenceScore}/100`,
    research.title ? `Page title: ${research.title}` : "",
    research.description ? `Meta description: ${research.description}` : "",
    research.buyerType ? `Buyer type: ${research.buyerType}` : "",
    research.industry ? `Likely industry: ${research.industry}` : "",
    research.inferredNeed ? `Possible customer concern: ${research.inferredNeed}` : "",
    research.productSignals.length ? `Product signals: ${research.productSignals.join("; ")}` : "",
    research.buyingSignals.length ? `Buying/procurement signals: ${research.buyingSignals.join("; ")}` : "",
    research.painSignals.length ? `Risk/pain signals: ${research.painSignals.join("; ")}` : "",
    research.recommendedAngle ? `Recommended outreach angle: ${research.recommendedAngle}` : "",
    research.brief ? formatCustomerResearchBriefForPrompt(research.brief) : "",
    research.fetchedUrls.length ? `Checked pages: ${research.fetchedUrls.join(", ")}` : "",
    research.evidence.length ? `Evidence: ${formatCustomerResearchEvidence(research.evidence)}` : "",
    research.textPreview ? `Website text preview:\n${research.textPreview}` : "",
    research.error ? `Research limitation: ${research.error}` : ""
  ].filter(Boolean).join("\n");
}

function formatCustomerResearchBriefForPrompt(brief: CustomerResearchBrief): string {
  return [
    "--- Customer decision brief ---",
    `Fit verdict: ${brief.fitVerdict}`,
    `Write mode: ${brief.shouldWrite}`,
    brief.buyerTypeDetail ? `Buyer type detail: ${brief.buyerTypeDetail}` : "",
    brief.purchaseIntentSignal ? `Purchase intent signal: ${brief.purchaseIntentSignal}` : "",
    brief.bestOutreachPath ? `Best outreach path: ${brief.bestOutreachPath}` : "",
    brief.mainRisk ? `Main risk: ${brief.mainRisk}` : "",
    brief.bestAngle ? `Best angle: ${brief.bestAngle}` : "",
    brief.recommendedContactRoles.length ? `Recommended contact roles: ${brief.recommendedContactRoles.join(", ")}` : "",
    brief.claimsToAvoid.length ? `Claims to avoid: ${brief.claimsToAvoid.join("; ")}` : "",
    brief.outreachAngles.length ? `Candidate angles:\n${brief.outreachAngles.map((angle, index) => `${index + 1}. ${angle.name}: ${angle.whyItFits}${angle.evidence.length ? ` Evidence: ${angle.evidence.join(" | ")}` : ""}`).join("\n")}` : "",
    brief.handoffBrief ? `Brief handoff:\n${brief.handoffBrief}` : ""
  ].filter(Boolean).join("\n");
}

function formatCustomerResearchEvidence(evidence: CustomerResearchEvidence[]): string {
  return evidence.slice(0, 8).map((item) => {
    const snippet = item.snippet ? ` (${truncatePlain(item.snippet, 160)})` : "";
    return `${item.label}: ${item.value} - ${item.sourceUrl}${snippet}`;
  }).join("; ");
}

function summarizeCustomerResearch(research: CustomerResearchResult) {
  return CustomerResearchSummarySchema.parse({
    depth: research.depth,
    confidenceScore: research.confidenceScore,
    buyerType: research.buyerType,
    likelyNeed: research.inferredNeed,
    primaryAngle: research.recommendedAngle,
    riskNotes: [research.brief?.mainRisk, ...research.painSignals].filter(Boolean).slice(0, 6),
    checkedPages: research.fetchedUrls.length
  });
}

function buildOutreachGenerationBrief(input: {
  lead: OutreachLead;
  research?: CustomerResearchResult;
  companyKnowledgeContext: string;
}): OutreachGenerationBrief {
  const facts = extractCompanyKnowledgeFacts(input.companyKnowledgeContext);
  const product = facts.mainProducts[0] || input.lead.need || "this product category";
  const buyerSegment = input.research?.buyerType || input.lead.industry || "Potential B2B buyer";
  const buyerReason = input.research?.brief?.purchaseIntentSignal
    ?? strongestResearchSignal(input.research)
    ?? input.lead.need
    ?? input.lead.notes
    ?? `appears to be reviewing ${product}`;
  const likelyPain = input.research?.brief?.mainRisk
    ?? input.research?.painSignals[0]
    ?? input.research?.inferredNeed
    ?? input.lead.need
    ?? "Needs a faster way to judge supplier fit without reading a full catalog.";
  const procurementTrigger = input.research?.brief?.bestOutreachPath
    ?? input.research?.buyingSignals[0]
    ?? triggerFromBuyerSegment(buyerSegment)
    ?? "Supplier comparison or category-fit review.";
  const selectedUsp = selectOutreachUsp({ facts, product, likelyPain, buyerSegment });
  const microOffer = selectMicroOffer({ facts, likelyPain, product });
  const valueMatch = selectProfileValuePoint({
    facts,
    product,
    buyerReason,
    buyerSegment,
    likelyPain,
    procurementTrigger,
    selectedUsp,
    microOffer
  });
  return {
    buyerReason: truncatePlain(buyerReason, 260),
    buyerSegment: truncatePlain(buyerSegment, 160),
    likelyPain: truncatePlain(likelyPain, 260),
    procurementTrigger: truncatePlain(procurementTrigger, 260),
    selectedUsp: {
      headline: valueMatch.concreteValue,
      buyerAngle: selectedUsp.buyerAngle || valueMatch.customerConcern,
      proof: valueMatch.proof
    },
    microOffer: valueMatch.cta,
    valueMatch,
    missingEvidence: missingOutreachEvidence(facts)
  };
}

function buildOutreachOsContext(input: {
  mode: OutreachGenerationMode;
  lead: OutreachLead;
  research?: CustomerResearchResult;
  companyKnowledgeContext: string;
  personas: OutreachBuyerPersona[];
  usps: OutreachUspCandidate[];
  ctaAssets: OutreachCtaAsset[];
  brief: OutreachGenerationBrief;
}): OutreachOsContext {
  const evidenceMap = buildOutreachEvidenceMap(input);
  const leadFitScore = buildOutreachLeadFitScore({
    lead: input.lead,
    research: input.research,
    companyKnowledgeContext: input.companyKnowledgeContext,
    evidenceMap
  });
  const evidenceLock = buildOutreachEvidenceLock({
    lead: input.lead,
    research: input.research,
    evidenceMap
  });
  const valueMatch = selectOutreachValueMatch({
    ...input,
    evidenceMap
  });
  const strategyMatch = buildOutreachStrategyMatch({
    ...input,
    evidenceMap,
    valueMatch
  });
  const valueMatchRecord = buildOutreachValueMatchRecord({
    lead: input.lead,
    research: input.research,
    valueMatch,
    leadFitScore,
    strategyMatch,
    companyKnowledgeContext: input.companyKnowledgeContext
  });
  return {
    mode: input.mode,
    evidenceMap,
    leadFitScore,
    evidenceLock,
    strategyMatch,
    valueMatch,
    valueMatchRecord,
    researchBrief: input.research?.brief,
    personas: input.personas,
    usps: input.usps,
    ctaAssets: input.ctaAssets
  };
}

function buildOutreachEvidenceMap(input: {
  lead: OutreachLead;
  research?: CustomerResearchResult;
  companyKnowledgeContext: string;
  brief: OutreachGenerationBrief;
}): OutreachEvidenceMap {
  const facts = extractCompanyKnowledgeFacts(input.companyKnowledgeContext);
  const verified: OutreachEvidenceItem[] = [];
  const inferred: OutreachEvidenceItem[] = [];
  const generic: OutreachEvidenceItem[] = [];
  const prohibited: OutreachEvidenceItem[] = [];
  const addEvidence = (
    bucket: OutreachEvidenceItem[],
    level: OutreachEvidenceItem["level"],
    label: string,
    value: string | undefined,
    source: OutreachEvidenceItem["source"],
    sourceUrl?: string,
    snippet = ""
  ) => {
    const clean = value?.trim();
    if (!clean) return;
    bucket.push(OutreachEvidenceItemSchema.parse({
      id: stableEvidenceId(label, clean),
      level,
      label,
      value: truncatePlain(clean, 800),
      source,
      sourceUrl,
      snippet: truncatePlain(snippet, 1000)
    }));
  };
  addEvidence(verified, "verified", "Lead company", input.lead.companyName, "lead", input.lead.website);
  addEvidence(verified, "verified", "Lead website", input.lead.website, "lead", input.lead.website);
  addEvidence(verified, "verified", "Lead industry", input.lead.industry, "lead", input.lead.website);
  addEvidence(verified, "verified", "Lead need", input.lead.need, "lead", input.lead.website);
  addEvidence(verified, "verified", "Lead notes", input.lead.notes, "lead", input.lead.website);
  for (const item of input.research?.evidence ?? []) {
    const bucket = researchEvidenceLooksInferred(item) ? inferred : verified;
    const level = bucket === inferred ? "inferred" : "verified";
    addEvidence(bucket, level, item.label, item.value, "website", item.sourceUrl, item.snippet);
  }
  for (const signal of input.research?.productSignals ?? []) addEvidence(inferred, "inferred", "Product signal", signal, "website", input.research?.website);
  for (const signal of input.research?.buyingSignals ?? []) addEvidence(inferred, "inferred", "Buying signal", signal, "website", input.research?.website);
  for (const signal of input.research?.painSignals ?? []) addEvidence(inferred, "inferred", "Pain signal", signal, "model", input.research?.website);
  addEvidence(inferred, "inferred", "Buyer type", input.research?.buyerType || input.brief.buyerSegment, "model", input.research?.website);
  addEvidence(inferred, "inferred", "Likely need", input.research?.inferredNeed || input.brief.likelyPain, "model", input.research?.website);
  addEvidence(inferred, "inferred", "Recommended angle", input.research?.recommendedAngle || input.brief.procurementTrigger, "model", input.research?.website);
  addEvidence(inferred, "inferred", "Customer fit verdict", input.research?.brief ? `${input.research.brief.fitVerdict}; write mode ${input.research.brief.shouldWrite}` : "", "model", input.research?.website);
  addEvidence(inferred, "inferred", "Best outreach path", input.research?.brief?.bestOutreachPath, "model", input.research?.website);
  addEvidence(inferred, "inferred", "Purchase intent signal", input.research?.brief?.purchaseIntentSignal, "model", input.research?.website);
  for (const product of facts.mainProducts) addEvidence(verified, "verified", "Seller product", product, "company-profile");
  for (const certification of facts.certifications) addEvidence(verified, "verified", "Seller certification", certification, "company-profile");
  for (const claim of unsupportedOutreachClaims(input.lead, input.research)) {
    addEvidence(prohibited, "prohibited", "Unsupported claim", claim, "model", input.lead.website);
  }
  for (const claim of input.research?.brief?.claimsToAvoid ?? []) {
    addEvidence(prohibited, "prohibited", "Brief claim to avoid", claim, "model", input.lead.website);
  }
  if (!verified.length && !inferred.length) {
    addEvidence(generic, "generic", "Generic sourcing context", "Teams sourcing this category often need a focused comparison before adding a new option.", "model");
  }
  const missingFields = [
    facts.mainProducts.length ? "" : "seller product category",
    input.lead.website || input.research?.website ? "" : "buyer website",
    input.lead.email ? "" : "buyer email",
    verified.some((item) => item.source === "website") ? "" : "verified buyer website evidence",
    facts.certifications.length || facts.shippingTerms.length ? "" : "seller proof assets"
  ].filter(Boolean);
  return OutreachEvidenceMapSchema.parse({
    status: missingFields.length >= 3 ? "need_more_data" : "success",
    minimumDataAvailable: Boolean((facts.mainProducts.length || input.lead.need) && (input.research?.buyerType || input.lead.industry || input.lead.website)),
    verifiedFacts: rankOutreachEvidenceForWriting(verified).slice(0, 24),
    inferredInsights: rankOutreachEvidenceForWriting(inferred).slice(0, 24),
    genericContext: generic.slice(0, 12),
    prohibitedClaims: prohibited.slice(0, 12),
    missingFields,
    createdAt: new Date().toISOString()
  });
}

function researchEvidenceLooksInferred(item: CustomerResearchEvidence): boolean {
  const label = normalizeQualityText(item.label);
  const value = normalizeQualityText(item.value);
  if (/\b(product|buying|risk|pain|need|recommended|angle|buyer type|industry)\s+signal\b/.test(label)) return true;
  if (/\blikely|may|might|appears|seems|inferred|suggests|probably\b/.test(value)) return true;
  return false;
}

function rankOutreachEvidenceForWriting(items: OutreachEvidenceItem[]): OutreachEvidenceItem[] {
  return [...items].sort((a, b) => evidenceWritingScore(b) - evidenceWritingScore(a));
}

function evidenceWritingScore(item: OutreachEvidenceItem): number {
  let score = 0;
  const label = normalizeQualityText(item.label);
  const text = normalizeQualityText(`${item.label} ${item.value} ${item.snippet}`);
  if (item.source === "website") score += 60;
  if (item.source === "lead") score += 25;
  if (item.source === "company-profile" || item.source === "material") score += 10;
  if (item.sourceUrl) score += 12;
  if (item.snippet && item.snippet !== item.value) score += 10;
  if (/\bproduct|category|collection|catalog|dealer|showroom|distributor|download|spec|faq|certification|contact|purchasing|procurement|stock|sample|moq|lead time\b/.test(text)) score += 18;
  if (/page title|meta description|lead company|lead website/.test(label)) score -= 18;
  return score;
}

function buildOutreachStrategyMatch(input: {
  lead: OutreachLead;
  research?: CustomerResearchResult;
  companyKnowledgeContext: string;
  personas: OutreachBuyerPersona[];
  usps: OutreachUspCandidate[];
  ctaAssets: OutreachCtaAsset[];
  brief: OutreachGenerationBrief;
  evidenceMap: OutreachEvidenceMap;
  valueMatch: OutreachMatchedValuePoint;
}): OutreachStrategyMatch {
  const persona = selectOutreachPersona(input.personas, input.lead, input.research);
  const usp = input.valueMatch.uspId ? input.usps.find((item) => item.id === input.valueMatch.uspId) : selectOutreachUspAsset(input.usps, input.brief);
  const selectedUsp = input.valueMatch.concreteValue;
  const microOffer = input.valueMatch.cta;
  const desiredAssetType = inferCtaAssetType(`${selectedUsp} ${microOffer}`);
  const ctaAsset = input.valueMatch.ctaAssetId
    ? input.ctaAssets.find((asset) => asset.id === input.valueMatch.ctaAssetId)
    : selectOutreachCtaAsset(input.ctaAssets, desiredAssetType, `${selectedUsp} ${microOffer} ${input.brief.likelyPain}`);
  const evidenceIds = rankOutreachEvidenceForWriting([
    ...input.evidenceMap.verifiedFacts.filter((item) => item.source === "website"),
    ...input.evidenceMap.verifiedFacts.filter((item) => item.source === "lead"),
    ...input.evidenceMap.inferredInsights,
    ...input.evidenceMap.verifiedFacts.filter((item) => item.source !== "website" && item.source !== "lead")
  ]).slice(0, 6).map((item) => item.id);
  const buyerImplication = deriveBuyerImplication(input.brief);
  const warnings = [
    input.evidenceMap.status === "need_more_data" ? `Missing data: ${input.evidenceMap.missingFields.join(", ")}` : "",
    input.research?.brief?.shouldWrite === "no" ? "Customer brief says do not write unless the user adds a stronger reason." : "",
    input.research?.brief?.shouldWrite === "cautious" ? `Cautious write mode: ${input.research.brief.mainRisk}` : "",
    input.valueMatch.source === "usp-asset" ? "" : "No better saved USP bank item; using one company-profile value point.",
    ctaAsset ? "" : `No saved ${desiredAssetType.replace(/_/g, " ")} CTA asset; CTA must stay conservative or use profile-derived proof.`,
    input.valueMatch.proofLevel === "needs-proof" ? `Selected value still needs proof: ${input.valueMatch.proof}` : "",
    input.brief.missingEvidence.length ? `Proof still thin: ${input.brief.missingEvidence.join(", ")}` : ""
  ].filter(Boolean);
  return OutreachStrategyMatchSchema.parse({
    personaId: persona?.id,
    uspId: usp?.id,
    ctaAssetId: ctaAsset?.id,
    buyerPain: input.valueMatch.customerConcern,
    buyerImplication,
    selectedUsp,
    microOffer,
    rationale: truncatePlain(`Match customer concern (${input.valueMatch.customerConcern}) to one seller value (${selectedUsp}). Proof allowed: ${input.valueMatch.proof}. CTA: ${microOffer}.`, 1200),
    confidenceScore: Math.min(100, 34 + input.valueMatch.score + input.evidenceMap.verifiedFacts.filter((item) => item.source === "website").length * 8 + input.evidenceMap.inferredInsights.length * 2 + (usp ? 10 : 0) + (ctaAsset ? 8 : 0)),
    evidenceIds,
    warnings
  });
}

function applyOutreachOsStrategyToBrief(brief: OutreachGenerationBrief, strategy: OutreachStrategyMatch, valueMatch?: OutreachMatchedValuePoint): OutreachGenerationBrief {
  const lockedValue = valueMatch ?? brief.valueMatch;
  return {
    ...brief,
    selectedUsp: {
      ...brief.selectedUsp,
      headline: lockedValue?.concreteValue || strategy.selectedUsp || brief.selectedUsp.headline,
      buyerAngle: lockedValue?.customerConcern || brief.selectedUsp.buyerAngle || strategy.buyerImplication,
      proof: lockedValue?.proof || brief.selectedUsp.proof
    },
    microOffer: lockedValue?.cta || strategy.microOffer || brief.microOffer,
    valueMatch: lockedValue
  };
}

function formatOutreachOsContext(context: OutreachOsContext): string {
  const evidenceLine = (item: OutreachEvidenceItem) => `${item.level.toUpperCase()} ${item.label}: ${item.value}${item.sourceUrl ? ` (${item.sourceUrl})` : ""}`;
  const ctaAsset = context.ctaAssets.find((asset) => asset.id === context.strategyMatch.ctaAssetId);
  const usp = context.usps.find((item) => item.id === context.strategyMatch.uspId);
  return [
    "--- Outreach OS evidence and asset map ---",
    `Generation mode: ${context.mode}`,
    "Use this section as private strategy. Do not expose framework names or reasoning.",
    context.researchBrief ? formatCustomerResearchBriefForPrompt(context.researchBrief) : "",
    `Lead fit: ${context.leadFitScore.score}/100 (${context.leadFitScore.fit}); customer type: ${context.leadFitScore.customerType}; primary angle: ${context.leadFitScore.primaryAngle ?? "general-supply"}`,
    context.leadFitScore.recommendedApproach ? `How to successfully develop this customer: ${context.leadFitScore.recommendedApproach}` : "",
    context.leadFitScore.notRecommendedApproach ? `Do not develop this way: ${context.leadFitScore.notRecommendedApproach}` : "",
    context.evidenceLock.usableFacts.length ? `Evidence lock - directly usable facts:\n${context.evidenceLock.usableFacts.slice(0, 8).map((item) => `- ${item.statement}${item.sourceUrl ? ` (${item.sourceUrl})` : ""}`).join("\n")}` : "",
    context.evidenceLock.mustNotSay.length ? `Evidence lock - must not say:\n${context.evidenceLock.mustNotSay.slice(0, 8).map((item) => `- ${item}`).join("\n")}` : "",
    context.evidenceMap.verifiedFacts.length ? `Verified facts:\n${context.evidenceMap.verifiedFacts.slice(0, 8).map(evidenceLine).join("\n")}` : "Verified facts: none",
    context.evidenceMap.inferredInsights.length ? `Inferred insights:\n${context.evidenceMap.inferredInsights.slice(0, 6).map(evidenceLine).join("\n")}` : "",
    context.evidenceMap.missingFields.length ? `Missing data: ${context.evidenceMap.missingFields.join(", ")}` : "",
    formatOutreachValueMatchForPrompt(context.valueMatch),
    `Selected buyer pain: ${context.strategyMatch.buyerPain}`,
    `Selected buyer implication: ${context.strategyMatch.buyerImplication}`,
    `Selected USP: ${context.strategyMatch.selectedUsp}${usp?.proof ? ` | Saved USP proof: ${usp.proof}` : ""}`,
    `Selected CTA: ${context.strategyMatch.microOffer}${ctaAsset ? ` | Backed by asset: ${ctaAsset.name} (${ctaAsset.type})` : " | No saved CTA asset; keep the offer conservative and profile-derived."}`,
    context.strategyMatch.warnings.length ? `Warnings: ${context.strategyMatch.warnings.join("; ")}` : "",
    "Rules:",
    "- Use exactly the locked value match. Do not list any other company strengths, products, certifications, prices, cases, or delivery terms unless they are part of the selected proof.",
    "- VERIFIED facts may be stated directly.",
    "- INFERRED insights must be phrased as likely buyer patterns, not as known facts.",
    "- GENERIC context is only allowed when evidence is thin.",
    "- PROHIBITED claims must never appear in the email.",
    "- MUST-NOT-SAY evidence lock rules override all writing instructions.",
    "- The CTA must map to the selected CTA asset or to visible company-profile proof."
  ].filter(Boolean).join("\n");
}

function stableEvidenceId(label: string, value: string): string {
  return `ev_${createHash("sha1").update(`${label}:${value}`).digest("hex").slice(0, 12)}`;
}

function unsupportedOutreachClaims(lead: OutreachLead, research?: CustomerResearchResult): string[] {
  const text = `${lead.notes}\n${research?.textPreview ?? ""}`;
  const claims = [];
  if (/exclusive supplier|official partner|guaranteed|number one|#1|best in the world/i.test(text)) {
    claims.push("Avoid unsupported superlatives, exclusive-partner claims, or guaranteed results.");
  }
  for (const claim of research?.brief?.claimsToAvoid ?? []) claims.push(claim);
  return claims;
}

function selectOutreachPersona(personas: OutreachBuyerPersona[], lead: OutreachLead, research?: CustomerResearchResult): OutreachBuyerPersona | undefined {
  const target = normalizeQualityText(`${lead.industry} ${lead.need} ${research?.buyerType ?? ""} ${research?.industry ?? ""}`);
  return personas.find((persona) => {
    const haystack = normalizeQualityText(`${persona.name} ${persona.companyType} ${persona.buyerRoles.join(" ")} ${persona.painPoints.join(" ")}`);
    return haystack.split(/\s+/).some((token) => token.length > 3 && target.includes(token));
  }) ?? personas[0];
}

function selectOutreachUspAsset(usps: OutreachUspCandidate[], brief: OutreachGenerationBrief): OutreachUspCandidate | undefined {
  const target = normalizeQualityText(`${brief.likelyPain} ${brief.procurementTrigger} ${brief.selectedUsp.headline}`);
  const ranked = usps
    .filter((usp) => usp.enabled)
    .map((usp) => {
      const haystack = normalizeQualityText(`${usp.category} ${usp.headline} ${usp.buyerAngle} ${usp.proof}`);
      const proofBonus = usp.proofLevel === "verified" ? 3 : usp.proofLevel === "profile-derived" ? 2 : 0;
      return { usp, score: overlapScore(target, haystack) + proofBonus };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score >= 2 ? ranked[0].usp : undefined;
}

function inferCtaAssetType(value: string): OutreachCtaAsset["type"] {
  const text = normalizeQualityText(value);
  if (/moq|lead time|lead-time|delivery table|price table/.test(text)) return "moq_leadtime_sheet";
  if (/option a|option b|a\/b|2-3|matched options|sample-ready|sample options/.test(text)) return "sample_options";
  if (/comparison|side by side|compare|spec comparison/.test(text)) return "spec_comparison";
  if (/certification pack|certification\/spec pack|certification|certificate|ce pack|iso pack|proof pack|test report/.test(text)) return "certification_pack";
  if (/packaging|private label|labeling/.test(text)) return "packaging_options";
  if (/quote|price range|pricing range/.test(text)) return "quote_range";
  if (/case study|case example|project example/.test(text)) return "case_study";
  if (/catalog/.test(text)) return "catalog";
  return "custom";
}

function selectOutreachCtaAsset(assets: OutreachCtaAsset[], desiredType: OutreachCtaAsset["type"], target: string): OutreachCtaAsset | undefined {
  const normalizedTarget = normalizeQualityText(target);
  const ranked = assets
    .filter((asset) => asset.enabled)
    .map((asset) => {
      const haystack = normalizeQualityText(`${asset.name} ${asset.type} ${asset.description} ${asset.assetText}`);
      const typeBonus = asset.type === desiredType ? 8 : asset.type === "custom" ? 1 : 0;
      const materialBonus = asset.materialId || asset.url || asset.assetText ? 2 : 0;
      return { asset, score: typeBonus + materialBonus + overlapScore(normalizedTarget, haystack) };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score >= 5 ? ranked[0].asset : undefined;
}

function deriveBuyerImplication(brief: OutreachGenerationBrief): string {
  const reason = brief.buyerReason.replace(/\s+/g, " ").trim();
  const trigger = brief.procurementTrigger.replace(/\s+/g, " ").trim();
  const pain = brief.likelyPain.replace(/\s+/g, " ").trim();
  if (reason && trigger) return truncatePlain(`${reason}; that points to ${lowercaseFirstBusinessPhrase(trigger)}`, 800);
  if (reason && pain) return truncatePlain(`${reason}; that may make ${lowercaseFirstBusinessPhrase(pain)} worth simplifying`, 800);
  return trigger || pain || "A small supplier comparison may be easier than a broad catalog review.";
}

function overlapScore(target: string, haystack: string): number {
  const targetTokens = new Set(target.split(/[^a-z0-9]+/i).map((token) => token.toLowerCase()).filter((token) => token.length >= 4 && !commonQualityTokens.has(token)));
  const haystackTokens = new Set(haystack.split(/[^a-z0-9]+/i).map((token) => token.toLowerCase()).filter((token) => token.length >= 4 && !commonQualityTokens.has(token)));
  let score = 0;
  for (const token of targetTokens) if (haystackTokens.has(token)) score += 1;
  return score;
}

function extractCompanyKnowledgeFacts(companyKnowledgeContext: string): {
  companyName: string;
  mainProducts: string[];
  certifications: string[];
  paymentTerms: string[];
  shippingTerms: string[];
  brandVoice: string;
} {
  return {
    companyName: firstCompanyKnowledgeLine(companyKnowledgeContext, "Company name"),
    mainProducts: splitCompanyKnowledgeList(firstCompanyKnowledgeLine(companyKnowledgeContext, "Main products")),
    certifications: splitCompanyKnowledgeList(firstCompanyKnowledgeLine(companyKnowledgeContext, "Certifications")),
    paymentTerms: splitCompanyKnowledgeList(firstCompanyKnowledgeLine(companyKnowledgeContext, "Payment terms")),
    shippingTerms: splitCompanyKnowledgeList(firstCompanyKnowledgeLine(companyKnowledgeContext, "Shipping terms")),
    brandVoice: firstCompanyKnowledgeLine(companyKnowledgeContext, "Brand voice")
  };
}

function firstCompanyKnowledgeLine(context: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = context.match(new RegExp(`^${escaped}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

function splitCompanyKnowledgeList(value: string): string[] {
  return value.split(/[,;，、]/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function strongestResearchSignal(research?: CustomerResearchResult): string {
  if (!research) return "";
  const concreteClues = bestCustomerResearchClues(research, 2);
  if (concreteClues.length) return researchCluesToBuyerReason(concreteClues, research.companyName);
  const concreteEvidence = rankCustomerResearchEvidenceForOpening(research.evidence).find((item) => !researchEvidenceLooksInferred(item));
  if (concreteEvidence) return concreteEvidence.value || concreteEvidence.snippet;
  return [
    research.buyingSignals[0],
    research.painSignals[0],
    research.inferredNeed,
    research.recommendedAngle,
    combinedResearchSignal(research),
    research.productSignals[0],
    research.description
  ].find((item) => item && item.trim()) ?? "";
}

function rankCustomerResearchEvidenceForOpening(items: CustomerResearchEvidence[]): CustomerResearchEvidence[] {
  return [...items].sort((a, b) => {
    const score = (item: CustomerResearchEvidence) => {
      const text = normalizeQualityText(`${item.label} ${item.value} ${item.snippet}`);
      let value = item.sourceUrl ? 8 : 0;
      if (item.snippet && item.snippet !== item.value) value += 4;
      value += customerResearchClueScore(`${item.value} ${item.snippet}`, item.label);
      if (/\bproduct|category|collection|dealer|showroom|download|spec|faq|certification|contact|purchasing|procurement|stock|sample|moq|lead time\b/.test(text)) value += 8;
      if (/page title|meta description/.test(normalizeQualityText(item.label))) value -= 12;
      return value;
    };
    return score(b) - score(a);
  });
}

function combinedResearchSignal(research: CustomerResearchResult): string {
  const product = research.productSignals[0];
  const buyer = research.buyerType || research.industry;
  if (product && buyer) return `${buyer} appears to be evaluating ${product}`;
  if (product) return `their site shows interest in ${product}`;
  return "";
}

function bestCustomerResearchClues(research: CustomerResearchResult, limit: number): string[] {
  const candidates: Array<{ value: string; score: number; secondary: boolean }> = [];
  const addCandidate = (value: string | undefined, label = "", priority = 0) => {
    const clean = cleanCustomerResearchClue(value ?? "", research);
    if (!clean) return;
    const score = customerResearchClueScore(clean, label) + priority;
    if (score <= 0) return;
    candidates.push({ value: clean, score, secondary: /page title|meta description/i.test(label) });
  };
  for (const item of rankCustomerResearchEvidenceForOpening(research.evidence)) {
    addCandidate(item.snippet || item.value, item.label, item.sourceUrl ? 10 : 0);
    if (item.value !== item.snippet) addCandidate(item.value, item.label, 2);
  }
  for (const signal of research.buyingSignals) addCandidate(signal, "Buying signal", 8);
  for (const signal of research.productSignals) addCandidate(signal, "Product signal", 6);
  for (const signal of research.painSignals) addCandidate(signal, "Pain signal", 4);
  addCandidate(research.description, "Meta description", -8);
  const seen = new Set<string>();
  const primary = candidates.filter((item) => !item.secondary);
  const pool = primary.length ? primary : candidates;
  return pool
    .sort((a, b) => b.score - a.score)
    .map((item) => item.value)
    .filter((value) => {
      const key = normalizeQualityText(value).replace(/[^a-z0-9]+/g, "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function cleanCustomerResearchClue(value: string, research: CustomerResearchResult): string {
  let clean = decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .replace(/\bhttps?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/^[\s:|,，;.-]+|[\s:|,，;.-]+$/g, "")
    .trim();
  if (!clean) return "";
  const sentences = clean.split(/(?<=[.!?。])\s+/).map((item) => item.trim()).filter(Boolean);
  const concreteSentence = sentences.find((sentence) => customerResearchClueScore(sentence, "") >= 18);
  if (concreteSentence) clean = concreteSentence;
  clean = clean
    .replace(new RegExp(`^${escapeRegExp(research.companyName)}\\s*(?:-|:|\\||,)?\\s*`, "i"), "")
    .replace(/\b(?:learn more|read more|click here|all rights reserved)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = normalizeQualityText(clean);
  const host = safeHostname(research.website);
  if (!normalized || normalized.length < 8) return "";
  if (host && normalized === host) return "";
  if (/^(page title|meta description|lead website|home|about us|contact us)\b/.test(normalized)) return "";
  if (/\b(appears|seems|likely|may|might|probably|inferred)\b/.test(normalized)) return "";
  if (/^[a-z0-9.-]+\.(?:com|net|org|co|io|cn)\b/i.test(clean)) return "";
  return truncatePlain(clean.replace(/[.。]+$/, ""), 150);
}

function customerResearchClueScore(value: string, label: string): number {
  const text = normalizeQualityText(value);
  if (!text) return 0;
  if (/^(page title|meta description|lead website|generic sourcing context)\b/.test(normalizeQualityText(label))) return -12;
  if (/\b(appears|seems|likely|may|might|probably|inferred|teams sourcing this category)\b/.test(text)) return -8;
  if (/\b(skip to content|trusted manufacturer|flooring excellence|all rights reserved|privacy policy|terms of service)\b/.test(text)) return -10;
  if (/^[a-z0-9.-]+\.(?:com|net|org|co|io|cn)\b/.test(text)) return -10;
  let score = 0;
  if (/\b(program|range|collection|series|line|catalog|dealer|distributor|retailer|showroom|inventory|stock|quick-ship|quick ship|truckload|container|direct|import|wholesale|contractor|commercial|residential)\b/i.test(value)) score += 24;
  if (/\b(spc|lvt|luxury vinyl|vinyl plank|rigid core|flooring|fortika|oem|private label)\b/i.test(value)) score += 18;
  if (/\b(?:\d+(?:\.\d+)?\s?(?:mm|mil|inch|in|cm|m)|wear layer|attached pad|waterproof|warranty|certification|spec(?:ification)?s?)\b/i.test(value)) score += 16;
  if (/\b[A-Z][A-Za-z0-9&/-]*(?:\s+[A-Z0-9][A-Za-z0-9&/-]*){1,4}\b/.test(value)) score += 10;
  if (text.length >= 24 && text.length <= 180) score += 6;
  if (/\b(product|category|company|website|business)\b/.test(text) && score < 16) score -= 6;
  return score;
}

function researchCluesToBuyerReason(clues: string[], companyName: string): string {
  const first = stripLeadingCompanyName(clues[0] ?? "", companyName);
  const second = clues[1] ? stripLeadingCompanyName(clues[1], companyName) : "";
  const combined = second && !normalizeQualityText(first).includes(normalizeQualityText(second))
    ? `${first} alongside ${second}`
    : first;
  const phrase = combined.replace(/\s+/g, " ").trim();
  if (/^(runs|offers|stocks|carries|distributes|imports|sells|serves|lists|features|supports|uses|promotes|builds)\b/i.test(phrase)) return phrase;
  if (/\b(program|quick-ship|quick ship|truckload|container|direct)\b/i.test(phrase)) return `runs ${phrase}`;
  if (/\b(range|collection|series|line|catalog|sku|spc|lvt|flooring|vinyl)\b/i.test(phrase)) return `features ${phrase}`;
  return phrase;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeHostname(value: string): string {
  try {
    return new URL(normalizeWebsiteUrl(value)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function triggerFromBuyerSegment(segment: string): string {
  if (/retail|ecommerce|brand|category/i.test(segment)) return "Category refresh, new SKU testing, or seasonal stock planning.";
  if (/import|distributor|wholesale/i.test(segment)) return "Repeat sourcing, supplier comparison, or replenishment planning.";
  if (/manufacturer|oem|production/i.test(segment)) return "Component or specification review before production planning.";
  return "";
}

function selectOutreachUsp(input: {
  facts: ReturnType<typeof extractCompanyKnowledgeFacts>;
  product: string;
  likelyPain: string;
  buyerSegment: string;
}): OutreachGenerationBrief["selectedUsp"] {
  if (input.facts.certifications.length && /proof|certification|quality|compliance|testing/i.test(input.likelyPain)) {
    return {
      headline: `${input.product} proof pack`,
      buyerAngle: "Reduces buyer risk before sampling by putting certification or inspection evidence in the first review.",
      proof: input.facts.certifications.slice(0, 3).join(", ")
    };
  }
  if (input.facts.shippingTerms.length && /lead time|delivery|logistics|supply|repeat|replenishment/i.test(input.likelyPain)) {
    return {
      headline: "Clear supply and delivery comparison",
      buyerAngle: "Helps the buyer compare lead time, MOQ, and shipment terms before committing to a long supplier conversation.",
      proof: input.facts.shippingTerms.slice(0, 3).join(", ")
    };
  }
  if (/retail|ecommerce|brand|category/i.test(input.buyerSegment)) {
    return {
      headline: `Category-fit ${input.product} options`,
      buyerAngle: "Gives the buyer a small set of options matched to their channel instead of a broad catalog.",
      proof: input.facts.mainProducts.length ? `Available product line: ${input.facts.mainProducts.slice(0, 3).join(", ")}` : "Proof needed: add product catalog, sample range, MOQ, and lead-time evidence."
    };
  }
  const backupHeadline = input.product && !/this product category/i.test(input.product)
    ? `${input.product} backup options`
    : "Matched backup options";
  return {
    headline: backupHeadline,
    buyerAngle: "Lets the buyer compare specs, MOQ, lead time, and proof notes before adding a backup supplier.",
    proof: [
      input.facts.mainProducts.length ? `Products: ${input.facts.mainProducts.slice(0, 3).join(", ")}` : "",
      input.facts.certifications.length ? `Certifications: ${input.facts.certifications.slice(0, 3).join(", ")}` : ""
    ].filter(Boolean).join("; ") || "Proof needed: add product, certification, MOQ, lead-time, or sample evidence."
  };
}

function selectMicroOffer(input: {
  facts: ReturnType<typeof extractCompanyKnowledgeFacts>;
  likelyPain: string;
  product: string;
}): string {
  if (input.facts.certifications.length && /proof|certification|quality|compliance|testing/i.test(input.likelyPain)) {
    return "a short certification/spec pack plus 2 matched options";
  }
  if (/lead time|delivery|logistics|supply|repeat|replenishment/i.test(input.likelyPain)) {
    return "a small MOQ and lead-time comparison for 2-3 options";
  }
  if (/catalog|range|selection|sku|category/i.test(input.likelyPain)) {
    return `2-3 ${input.product} options matched to their channel`;
  }
  return "2-3 matched options with MOQ, lead time, and proof notes";
}

function selectProfileValuePoint(input: {
  facts: ReturnType<typeof extractCompanyKnowledgeFacts>;
  product: string;
  buyerReason: string;
  buyerSegment: string;
  likelyPain: string;
  procurementTrigger: string;
  selectedUsp: OutreachGenerationBrief["selectedUsp"];
  microOffer: string;
}): OutreachMatchedValuePoint {
  const target = normalizeQualityText([
    input.buyerReason,
    input.buyerSegment,
    input.likelyPain,
    input.procurementTrigger
  ].join(" "));
  const proofParts = [
    input.selectedUsp.proof,
    input.facts.certifications.length ? `Certifications: ${input.facts.certifications.slice(0, 3).join(", ")}` : "",
    input.facts.shippingTerms.length ? `Shipping/lead-time notes: ${input.facts.shippingTerms.slice(0, 3).join(", ")}` : "",
    input.facts.paymentTerms.length ? `Payment terms: ${input.facts.paymentTerms.slice(0, 2).join(", ")}` : ""
  ].filter(Boolean);
  const proof = proofParts.join("; ") || "Proof needed: add product catalog, certification, sample, MOQ, lead-time, or case evidence.";
  const proofLevel: OutreachMatchedValuePoint["proofLevel"] = proof.includes("Proof needed") ? "needs-proof" : "profile-derived";
  const productMatch = input.facts.mainProducts.find((item) => target.includes(normalizeQualityText(item))) || input.product;
  const score = Math.min(60,
    18
    + (input.facts.mainProducts.length ? 10 : 0)
    + (input.facts.certifications.length ? 8 : 0)
    + (input.facts.shippingTerms.length ? 6 : 0)
    + (input.facts.paymentTerms.length ? 3 : 0)
    + (proofLevel === "needs-proof" ? 0 : 6)
  );
  return {
    customerConcern: truncatePlain(input.selectedUsp.buyerAngle || input.likelyPain || input.procurementTrigger, 800),
    concreteValue: truncatePlain(input.selectedUsp.headline || `${productMatch} options`, 1000),
    proof: truncatePlain(proof, 1000),
    cta: truncatePlain(input.microOffer, 500),
    source: "company-profile",
    proofLevel,
    score
  };
}

function selectOutreachValueMatch(input: {
  lead: OutreachLead;
  research?: CustomerResearchResult;
  companyKnowledgeContext: string;
  usps: OutreachUspCandidate[];
  ctaAssets: OutreachCtaAsset[];
  brief: OutreachGenerationBrief;
  evidenceMap: OutreachEvidenceMap;
}): OutreachMatchedValuePoint {
  const facts = extractCompanyKnowledgeFacts(input.companyKnowledgeContext);
  const savedUsp = selectOutreachUspAsset(input.usps, input.brief);
  const targetText = [
    input.brief.buyerReason,
    input.brief.buyerSegment,
    input.brief.likelyPain,
    input.brief.procurementTrigger,
    input.research?.productSignals.join(" "),
    input.research?.buyingSignals.join(" "),
    input.research?.painSignals.join(" ")
  ].filter(Boolean).join(" ");
  const selectedValue = savedUsp
    ? {
        customerConcern: savedUsp.buyerAngle || input.brief.likelyPain,
        concreteValue: savedUsp.headline,
        proof: savedUsp.proof || input.brief.selectedUsp.proof,
        source: "usp-asset" as const,
        proofLevel: savedUsp.proofLevel,
        uspId: savedUsp.id,
        score: 28 + (savedUsp.proofLevel === "verified" ? 18 : savedUsp.proofLevel === "profile-derived" ? 10 : 3)
      }
    : {
        ...selectProfileValuePoint({
          facts,
          product: facts.mainProducts[0] || input.lead.need || "this product category",
          buyerReason: input.brief.buyerReason,
          buyerSegment: input.brief.buyerSegment,
          likelyPain: input.brief.likelyPain,
          procurementTrigger: input.brief.procurementTrigger,
          selectedUsp: input.brief.selectedUsp,
          microOffer: input.brief.microOffer
        })
      };
  const desiredType = inferCtaAssetType(`${selectedValue.concreteValue} ${input.brief.microOffer} ${targetText}`);
  const ctaAsset = selectOutreachCtaAsset(input.ctaAssets, desiredType, `${selectedValue.concreteValue} ${input.brief.likelyPain} ${targetText}`);
  const cta = ctaAsset
    ? ctaAsset.description || ctaAsset.name || input.brief.microOffer
    : input.brief.microOffer;
  const evidenceBonus = Math.min(18, input.evidenceMap.verifiedFacts.filter((item) => item.source === "website").length * 4);
  return {
    ...selectedValue,
    customerConcern: truncatePlain(selectedValue.customerConcern || input.brief.likelyPain, 800),
    concreteValue: truncatePlain(selectedValue.concreteValue || input.brief.selectedUsp.headline, 1000),
    proof: truncatePlain(selectedValue.proof || input.brief.selectedUsp.proof, 1000),
    cta: truncatePlain(cta, 500),
    ctaAssetId: ctaAsset?.id,
    score: Math.min(60, selectedValue.score + evidenceBonus + (ctaAsset ? 8 : 0))
  };
}

function formatOutreachValueMatchForPrompt(valueMatch: OutreachMatchedValuePoint): string {
  return [
    "--- Locked seller-to-buyer value match ---",
    `Buyer concern to address: ${valueMatch.customerConcern}`,
    `Only value point allowed: ${valueMatch.concreteValue}`,
    `Proof allowed: ${valueMatch.proof}`,
    `CTA to use: ${valueMatch.cta}`,
    `Source: ${valueMatch.source}; proof level: ${valueMatch.proofLevel}; confidence: ${valueMatch.score}/60`,
    "Do not add extra seller strengths. If proof level says needs-proof, make the claim softer and ask permission to send the proof/options."
  ].join("\n");
}

function buildOutreachLeadFitScore(input: {
  lead: OutreachLead;
  research?: CustomerResearchResult;
  companyKnowledgeContext: string;
  evidenceMap: OutreachEvidenceMap;
}): OutreachLeadFitScore {
  const facts = extractCompanyKnowledgeFacts(input.companyKnowledgeContext);
  const judgment = judgeCustomerDevelopment({ lead: input.lead, research: input.research, facts });
  const replyRate = parseExpectedReplyRate(judgment.expectedReplyRate);
  return OutreachLeadFitScoreSchema.parse({
    customerType: mapCustomerTypeForLoop(judgment.customerType),
    fit: mapFitLevel(judgment.fitScore, judgment.primaryRisks.length),
    score: judgment.fitScore,
    purchaseOrCooperationSignal: mapSignalStrength(scoreCustomerPurchaseIntent(normalizeQualityText([
      input.lead.need,
      input.lead.notes,
      input.research?.buyingSignals.join(" "),
      input.research?.textPreview
    ].filter(Boolean).join(" ")), input.research).score),
    recommendedAngles: inferDevelopmentAngles(judgment, input.research, input.evidenceMap),
    primaryAngle: inferDevelopmentAngles(judgment, input.research, input.evidenceMap)[0],
    disallowedAngles: buildDisallowedAngles(judgment, input.evidenceMap),
    recommendedApproach: judgment.successPath,
    notRecommendedApproach: judgment.primaryRisks.join(" "),
    expectedReplyRate: {
      ...replyRate,
      rationale: `Estimated from fit score ${judgment.fitScore}, evidence depth, purchase/cooperation signal, and seller proof readiness.`
    },
    risks: judgment.primaryRisks,
    rationale: judgment.fitRationale,
    scoredAt: new Date().toISOString()
  });
}

function buildOutreachEvidenceLock(input: {
  lead: OutreachLead;
  evidenceMap: OutreachEvidenceMap;
  research?: CustomerResearchResult;
}): OutreachEvidenceLock {
  const toLockItem = (item: OutreachEvidenceItem, reason: string) => ({
    id: `lock_${item.id}`,
    statement: truncatePlain(`${item.label}: ${item.value}`, 1000),
    source: item.source,
    sourceUrl: item.sourceUrl,
    evidenceId: item.id,
    reason
  });
  const usableFacts = input.evidenceMap.verifiedFacts.slice(0, 18).map((item) => toLockItem(item, "Verified enough to mention directly."));
  const unsupportedInferences = input.evidenceMap.inferredInsights.slice(0, 12).map((item) => toLockItem(item, "Can guide strategy, but must be phrased as a hypothesis."));
  const riskyAssumptions = input.evidenceMap.prohibitedClaims.slice(0, 12).map((item) => toLockItem(item, "Blocked unless the user adds direct proof."));
  const mustNotSay = Array.from(new Set([
    ...input.evidenceMap.prohibitedClaims.map((item) => item.value),
    ...(input.research?.brief?.claimsToAvoid ?? []),
    "Do not claim the buyer is actively sourcing unless the website proves it.",
    "Do not say we can replace their current supplier.",
    "Do not promise price, delivery, stock, certification, or exclusivity without saved proof."
  ].map((item) => truncatePlain(item.trim(), 300)).filter(Boolean))).slice(0, 20);
  return OutreachEvidenceLockSchema.parse({
    status: usableFacts.length ? "locked" : "needs-review",
    usableFacts,
    unsupportedInferences,
    riskyAssumptions,
    mustNotSay,
    summary: usableFacts.length
      ? `Locked ${usableFacts.length} usable facts and ${mustNotSay.length} don't-say rules for ${input.lead.companyName}.`
      : `No strong verified customer facts yet for ${input.lead.companyName}; the email must stay cautious.`,
    lockedAt: new Date().toISOString()
  });
}

function buildOutreachValueMatchRecord(input: {
  lead: OutreachLead;
  research?: CustomerResearchResult;
  valueMatch: OutreachMatchedValuePoint;
  leadFitScore: OutreachLeadFitScore;
  strategyMatch: OutreachStrategyMatch;
  companyKnowledgeContext: string;
}): OutreachValueMatch {
  const facts = extractCompanyKnowledgeFacts(input.companyKnowledgeContext);
  const customerProductLine = input.research?.productSignals[0] || input.lead.need || input.research?.industry || input.lead.industry || "";
  const assetIds = [input.valueMatch.uspId, input.valueMatch.ctaAssetId].filter(Boolean) as string[];
  return OutreachValueMatchSchema.parse({
    ourProduct: facts.mainProducts[0] || input.valueMatch.concreteValue,
    customerProductLine,
    customerConcern: input.valueMatch.customerConcern || input.strategyMatch.buyerPain,
    specificValue: input.valueMatch.concreteValue || input.strategyMatch.selectedUsp,
    proofPoints: splitProofPoints(input.valueMatch.proof),
    firstEmailPoint: input.strategyMatch.buyerImplication,
    cta: input.valueMatch.cta || input.strategyMatch.microOffer,
    assetIds,
    confidenceScore: Math.min(100, Math.round(input.valueMatch.score / 60 * 72) + Math.round(input.leadFitScore.score / 100 * 28)),
    rationale: truncatePlain(`Use one value point only: ${input.valueMatch.concreteValue}. It matches ${input.leadFitScore.customerType} via ${input.leadFitScore.primaryAngle ?? "general-supply"}.`, 1200)
  });
}

function buildOutreachLearningSignal(input: {
  lead: OutreachLead;
  subject: string;
  body: string;
  leadFitScore: OutreachLeadFitScore;
  valueMatch: OutreachValueMatch;
  step?: number;
  sentAt?: string;
  replyOutcome?: OutreachLearningSignal["replyOutcome"];
}): OutreachLearningSignal {
  return OutreachLearningSignalSchema.parse({
    customerType: input.leadFitScore.customerType,
    customerCountry: input.lead.country ?? "",
    customerIndustry: input.lead.industry ?? "",
    developmentAngle: input.leadFitScore.primaryAngle,
    subject: input.subject,
    cta: input.valueMatch.cta,
    emailWordCount: countWords(input.body),
    firstLineType: inferFirstLineType(firstBusinessLine(input.body)),
    valuePoint: input.valueMatch.specificValue,
    hadAttachment: false,
    sentAt: input.sentAt,
    replyStep: input.step,
    replyOutcome: input.replyOutcome ?? "unknown",
    recordedAt: new Date().toISOString()
  });
}

function buildOutreachSendOutcome(input: {
  status: OutreachSendOutcome["status"];
  sender?: OutreachSenderAccount;
  notes?: string;
  sentAt?: string;
  repliedAt?: string;
  bouncedAt?: string;
  unsubscribedAt?: string;
}): OutreachSendOutcome {
  const domain = input.sender?.email.split("@")[1]?.toLowerCase();
  return OutreachSendOutcomeSchema.parse({
    status: input.status,
    senderAccountId: input.sender?.id,
    senderEmail: input.sender?.email,
    senderDomain: domain,
    sentAt: input.sentAt,
    repliedAt: input.repliedAt,
    bouncedAt: input.bouncedAt,
    unsubscribedAt: input.unsubscribedAt,
    replied: input.status === "replied",
    bounced: input.status === "bounced",
    spamFolderRisk: "unknown",
    senderMailboxHealth: input.sender?.deliveryConfirmedAt ? "healthy" : "unknown",
    senderDomainHealth: input.sender ? (senderLooksDomainAligned(input.sender) ? "healthy" : "unknown") : "unknown",
    subjectMarketingRisk: "unknown",
    notes: input.notes ?? ""
  });
}

function parseExpectedReplyRate(value: string): { minPercent: number; maxPercent: number } {
  const numbers = value.match(/\d+(?:\.\d+)?/g)?.map((item) => Number(item)).filter(Number.isFinite) ?? [];
  const min = Math.max(0, Math.min(100, Math.round((numbers[0] ?? 0) * 10) / 10));
  const max = Math.max(min, Math.min(100, Math.round((numbers[1] ?? numbers[0] ?? min) * 10) / 10));
  return { minPercent: Math.round(min), maxPercent: Math.round(max) };
}

function mapFitLevel(score: number, riskCount: number): OutreachLeadFitScore["fit"] {
  if (score >= 72 && riskCount <= 2) return "high";
  if (score >= 52) return "medium";
  if (score >= 32) return "cautious";
  return score > 0 ? "low" : "unknown";
}

function mapSignalStrength(score: number): OutreachLeadFitScore["purchaseOrCooperationSignal"] {
  if (score >= 16) return "strong";
  if (score >= 9) return "medium";
  if (score >= 3) return "weak";
  return "none";
}

function mapCustomerTypeForLoop(value: string): OutreachLeadFitScore["customerType"] {
  const text = normalizeQualityText(value);
  if (/import|distributor|wholesale|dealer|retail|channel/.test(text)) return "distributor";
  if (/brand|category/.test(text)) return "brand-owner";
  if (/manufacturer|factory|oem|odm|peer/.test(text)) return "manufacturer";
  if (/project|contractor|specifier|construction/.test(text)) return "contractor";
  if (/competitor/.test(text)) return "competitor";
  if (/oem|odm/.test(text)) return "oem-odm";
  if (text) return "other";
  return "unknown";
}

function inferDevelopmentAngles(
  judgment: CustomerDevelopmentJudgment,
  research: CustomerResearchResult | undefined,
  evidenceMap: OutreachEvidenceMap
): NonNullable<OutreachLeadFitScore["primaryAngle"]>[] {
  const text = normalizeQualityText([
    judgment.developmentMethod,
    judgment.successPath,
    judgment.customerType,
    research?.recommendedAngle,
    research?.brief?.bestAngle,
    research?.brief?.bestOutreachPath,
    evidenceMap.verifiedFacts.map((item) => item.value).join(" "),
    evidenceMap.inferredInsights.map((item) => item.value).join(" ")
  ].filter(Boolean).join(" "));
  const angles: NonNullable<OutreachLeadFitScore["primaryAngle"]>[] = [];
  const add = (angle: NonNullable<OutreachLeadFitScore["primaryAngle"]>) => {
    if (!angles.includes(angle)) angles.push(angle);
  };
  if (/certification|compliance|proof|spec|test report|quality/.test(text)) add("certification-compliance");
  if (/lead time|delivery|backup|stock|replenish|supply/.test(text)) add("backup-capacity");
  if (/private label|packaging|brand|oem|odm/.test(text)) add("private-label-oem");
  if (/project|specification|contractor|construction|architect/.test(text)) add("project-specification");
  if (/category|collection|sku|assortment|sample-ready|sample ready/.test(text)) add("product-line-extension");
  if (/channel|distributor|retail|dealer|wholesale/.test(text)) add("channel-partnership");
  if (/peer|complementary|benchmark/.test(text)) add("material-complement");
  if (!angles.length) add("general-supply");
  return angles.slice(0, 6);
}

function buildDisallowedAngles(judgment: CustomerDevelopmentJudgment, evidenceMap: OutreachEvidenceMap): OutreachLeadFitScore["disallowedAngles"] {
  const blocked = [
    ...judgment.primaryRisks.map((risk) => ({ label: "Risk from customer judgment", reason: risk })),
    ...evidenceMap.prohibitedClaims.map((item) => ({ label: item.label, reason: item.value }))
  ];
  return blocked.slice(0, 8).map((item) => ({
    label: truncatePlain(item.label, 160),
    reason: truncatePlain(item.reason, 600)
  }));
}

function splitProofPoints(value: string): string[] {
  return value
    .split(/[;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function inferFirstLineType(value: string): OutreachLearningSignal["firstLineType"] {
  const text = normalizeQualityText(value);
  if (!text) return "unknown";
  if (/saw|noticed|checked|read|your|certification|proof|spec|test report|compliance|sample|option|product|range|collection|spc|lvt|flooring/.test(text)) return "customer-observation";
  if (/lead time|delivery|stock|supply|moq|replenish|project|market|country|launch|deadline/.test(text)) return "trigger-event";
  if (/channel|dealer|distributor|importer|retailer|contractor|manufacturer|brand/.test(text)) return "business-type";
  return "generic";
}

function missingOutreachEvidence(facts: ReturnType<typeof extractCompanyKnowledgeFacts>): string[] {
  return [
    facts.certifications.length ? "" : "certifications or compliance proof",
    facts.shippingTerms.length ? "" : "lead-time or shipping terms",
    facts.paymentTerms.length ? "" : "payment terms",
    facts.mainProducts.length ? "" : "specific product list"
  ].filter(Boolean);
}

function formatOutreachGenerationBrief(brief: OutreachGenerationBrief): string {
  return [
    "--- Private outreach brief ---",
    "Use this brief internally to write the email. Do not expose this section or mention that a workflow exists.",
    "Goal: decide how to successfully develop this account, not whether to stop at a fit verdict.",
    "Required evidence chain: use Buyer reason as the visible line-1 clue -> connect Likely pain/risk or Procurement trigger -> use Single USP -> ask for Low-friction next step.",
    `Buyer reason: ${brief.buyerReason}`,
    `Buyer segment: ${brief.buyerSegment}`,
    `Likely pain/risk: ${brief.likelyPain}`,
    `Successful development angle: ${brief.procurementTrigger}`,
    `Single USP to use: ${brief.selectedUsp.headline}`,
    `Why it matters to buyer: ${brief.selectedUsp.buyerAngle}`,
    `Allowed proof: ${brief.selectedUsp.proof}`,
    `Low-friction next step: ${brief.microOffer}`,
    brief.missingEvidence.length ? `Missing evidence to avoid inventing: ${brief.missingEvidence.join(", ")}` : "Missing evidence to avoid inventing: none obvious"
  ].join("\n");
}

const outreachTemplatePhrases = [
  "i am reaching out",
  "i'm reaching out",
  "reaching out to",
  "just following up",
  "touching base",
  "hope you are doing well",
  "hope this email finds you well",
  "wanted to check in",
  "dear sir/madam",
  "dear sir or madam",
  "esteemed company",
  "sincerely hope to establish",
  "long term cooperation",
  "long-term cooperation",
  "high quality and competitive price",
  "leading manufacturer",
  "one-stop solution",
  "factory direct",
  "superior service",
  "trusted partner",
  "win-win cooperation",
  "please kindly",
  "best price",
  "do not hesitate to contact",
  "do you have any need",
  "can you share your requirements",
  "we are a manufacturing service",
  "we are manufacturer",
  "we are a manufacturer",
  "supplier-fit check",
  "quick look",
  "worth reviewing",
  "may be relevant here",
  "this matters because",
  "this helps because",
  "no samples needed",
  "works around",
  "gives your team a simpler way to compare fit",
  "simpler way to compare fit",
  "compare fit"
];

const outreachNextStepPhrases = [
  "can i send",
  "could i send",
  "would it help",
  "would it be useful",
  "would you like",
  "which would be",
  "which option",
  "reply with",
  "open to",
  "should i send",
  "i can send",
  "i can share",
  "want me to send"
];

const outreachMicroOfferPhrases = [
  "2-3",
  "two",
  "three",
  "a/b",
  "option a",
  "option b",
  "options",
  "matched options",
  "sample",
  "samples",
  "spec",
  "specs",
  "certification",
  "proof pack",
  "moq",
  "lead time",
  "lead-time",
  "comparison",
  "side by side",
  "table",
  "fit sheet",
  "checklist",
  "short pack",
  "small pack"
];

const outreachBuyerImplicationPhrases = [
  "compare",
  "review",
  "source",
  "sourcing",
  "stock",
  "reorder",
  "replenish",
  "replacement",
  "launch",
  "deadline",
  "seasonal",
  "compliance",
  "certification",
  "proof",
  "risk",
  "delay",
  "lead time",
  "lead-time",
  "moq",
  "margin",
  "channel",
  "contractor",
  "distributor",
  "importer",
  "retail",
  "assortment",
  "category",
  "sampling",
  "sample-ready"
];

const genericOutreachSubjects = [
  "quick question",
  "just checking in",
  "checking in",
  "follow up",
  "following up",
  "hello",
  "cooperation",
  "business cooperation",
  "supply",
  "supplier fit",
  "supplier-fit check",
  "fit check",
  "spc fit check"
];

type OutreachQualityResearchContext = {
  companyName?: string;
  website?: string;
  industry?: string;
  buyerType?: string;
  inferredNeed?: string;
  recommendedAngle?: string;
  title?: string;
  description?: string;
  textPreview?: string;
  evidence?: CustomerResearchEvidence[];
  brief?: CustomerResearchBrief;
  productSignals?: string[];
  buyingSignals?: string[];
  painSignals?: string[];
};

function reviewOutreachEmail(input: {
  subject: string;
  body: string;
  lead?: OutreachLead;
  research?: OutreachQualityResearchContext;
}): OutreachEmailQualityReview {
  const subject = input.subject.trim();
  const body = input.body.trim();
  const normalized = normalizeQualityText(`${subject}\n${body}`);
  const opening = normalizeOpeningLine(firstBusinessLine(body));
  const tokens = buyerContextTokens(input.lead, input.research);
  const evidenceTokens = buyerEvidenceTokens(input.lead, input.research);
  const activePersonalizationTokens = evidenceTokens.length ? evidenceTokens : tokens;
  const templateHits = outreachTemplatePhrases.filter((phrase) => normalized.includes(phrase));
  const containsCjk = hasCjkCharacters(`${subject}\n${body}`);
  const hasGreeting = hasEmailGreeting(body);
  const hasSignoff = hasEmailSignoff(body);
  const hasBusinessSignature = hasSignoff && body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).some((line, index, lines) => (
    index > 0 && /^(best regards|kind regards|regards|thanks|thank you|sincerely)[,，]?$/i.test(lines[index - 1]) && line.length >= 2
  ));
  const genericSubject = isGenericOutreachSubject(subject, activePersonalizationTokens);
  const startsWithSupplierIntro = /^(we|our company|i am|this is)\b/.test(opening) && !/\b(saw|noticed|looking at|checked|read|your)\b/.test(opening);
  const openingEvidenceHits = evidenceTokenHitCount(opening, activePersonalizationTokens);
  const openingHasSpecificEvidence = openingEvidenceHits >= (activePersonalizationTokens.length >= 2 ? 2 : 1);
  const openingHasBuyerObservation = /\b(saw|noticed|looking at|checked|read|your website|your product|your category|your range|your store|your catalog|your channel|your market|your project|your customers)\b/.test(opening);
  const genericWebsiteOpening = /\b(saw|noticed|checked|read|looked at)\s+(your|the)\s+(website|site|company|business)\b/.test(opening) && !openingHasSpecificEvidence;
  const domainOnlyOpening = /\b(?:[a-z0-9-]+\.)+(?:com|net|org|co|io|cn|de|fr|it|es|nl|pl|uk)\b/i.test(opening) && openingEvidenceHits < 2;
  const badPseudoPersonalization = /\bworks around\b|\bsimpler way to compare fit\b|\bcompare fit\b/i.test(opening) || /\bfit check gives\b/i.test(normalized);
  const stiffAiOpening = /^(?:i\s+)?(?:saw|noticed)\s+[a-z0-9 .'-]{2,70}(?:'s)?\s+focus\s+on\b/i.test(opening);
  const localSkeleton = looksLikeLocalOutreachSkeleton(subject, body);
  const hasBuyerImplication = containsAny(normalized, outreachBuyerImplicationPhrases);
  const hasMicroOffer = containsAny(normalized, outreachMicroOfferPhrases);
  const vagueCta = /\b(would you like details|are you interested|can we talk|can we have a call|can we schedule a call|please send (?:me )?your requirements|do you have any need|can i send samples|would you like samples|let me know if interested)\b/i.test(normalized);
  const roboticKeywordCta = /\breply\s+['"][^'"]{3,40}['"]/i.test(`${subject}\n${body}`) && !/\breply\s+['"]?[abc]['"]?\b/i.test(`${subject}\n${body}`);
  const concreteCta = /\b(2-3|two|three|a\/b|option a|option b|matched options|moq|lead time|lead-time|spec(?:ification)? pack|certification pack|proof pack|short comparison|side by side|table)\b/i.test(normalized);
  const fitBrief = input.research?.brief;
  const peerOrManufacturerRisk = Boolean(fitBrief && /\b(manufacturer|oem|peer|factory|manufacture)\b/i.test(`${fitBrief.buyerTypeDetail} ${input.research?.buyerType ?? ""}`));
  const genericSupplierPitch = /\b(we|our)\b.{0,40}\b(supply|supplier|manufacture|manufacturer|factory|products?|flooring|catalog)\b/.test(normalized)
    && /\b(high quality|competitive price|best price|one-stop|factory direct|leading manufacturer|trusted supplier|supply you|provide you)\b/.test(normalized);
  const noDirectPurchaseSignal = Boolean(fitBrief && /no direct purchasing signal|not proven|inferred/i.test(fitBrief.purchaseIntentSignal));
  const overstatesPurchaseIntent = noDirectPurchaseSignal && /\b(you|your team|your company)\b.{0,80}\b(are|is|seem|looks)\b.{0,80}\b(sourcing|buying|purchasing|looking for|need|needs|planning)\b/.test(normalized);
  const violatesFitBrief = (peerOrManufacturerRisk && genericSupplierPitch) || overstatesPurchaseIntent;
  const hasLowFrictionAsk = (normalized.includes("?") || outreachNextStepPhrases.some((phrase) => normalized.includes(phrase)))
    && concreteCta
    && (hasMicroOffer || /\breply with\s+[abc]\b/.test(normalized))
    && !vagueCta
    && !roboticKeywordCta;
  const buyerReasonPassed = Boolean(opening) && !startsWithSupplierIntro && (
    openingHasSpecificEvidence ||
    (!evidenceTokens.length && openingHasBuyerObservation && containsAny(opening, tokens))
  ) && !domainOnlyOpening && !badPseudoPersonalization;
  const strongEvidenceTerms = buyerStrongEvidenceTerms(input.lead, input.research);
  const strongEvidenceHits = evidenceTokenHitCount(normalized, strongEvidenceTerms);
  const openingStrongEvidenceHits = evidenceTokenHitCount(opening, strongEvidenceTerms);
  const hasEnoughConcreteEvidence = !strongEvidenceTerms.length || (strongEvidenceHits >= 2 && openingStrongEvidenceHits >= 1);
  const humanTonePassed = templateHits.length === 0 && !containsCjk && !stiffAiOpening && !badPseudoPersonalization && !localSkeleton && !violatesFitBrief && !/\bcooperation with us\b/.test(normalized) && !/\bkindly\s+\w+/.test(normalized);
  const personalizedPassed = containsAny(normalized, activePersonalizationTokens)
    && hasBuyerImplication
    && hasEnoughConcreteEvidence
    && !violatesFitBrief
    && !looksLikeMassTemplate(normalized)
    && !genericWebsiteOpening
    && !domainOnlyOpening
    && !badPseudoPersonalization
    && !genericSubject;
  const nextStepPassed = hasLowFrictionAsk;
  const words = countWords(body);
  const paragraphCount = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).length || 1;
  const tooFormulaic = localSkeleton || /\b(line 1|line 2|line 3|buyer implication|procurement trigger|micro-offer|evidence chain|selected usp)\b/i.test(normalized);
  const twoSecondPassed = words >= 35 && words <= 125 && countWords(opening) <= 32 && subject.length <= 50 && paragraphCount >= 1 && paragraphCount <= 5 && !genericSubject && !tooFormulaic && hasGreeting && hasBusinessSignature;
  const twoSecondScore = twoSecondPassed ? 20 : Math.max(0,
    20
    - Math.ceil(Math.max(0, words - 125) / 10) * 3
    - (words < 35 ? 10 : 0)
    - (countWords(opening) > 32 ? 12 : 0)
    - (subject.length > 50 ? 8 : 0)
    - (paragraphCount < 1 || paragraphCount > 5 ? 8 : 0)
    - (genericSubject ? 12 : 0)
    - (tooFormulaic ? 12 : 0)
    - (!hasGreeting ? 8 : 0)
    - (!hasBusinessSignature ? 8 : 0)
  );

  const checks = [
    qualityCheck("buyerReason", "Buyer-specific first line", buyerReasonPassed, buyerReasonPassed ? 20 : 0, buyerReasonPassed ? "The opening explains why this buyer is being contacted." : "The first line does not clearly say why this buyer should care."),
    qualityCheck("humanTone", "Human English", humanTonePassed, humanTonePassed ? 20 : Math.max(0, 12 - templateHits.length * 4 - (containsCjk ? 10 : 0) - (stiffAiOpening ? 6 : 0) - (localSkeleton ? 6 : 0) - (violatesFitBrief ? 8 : 0)), humanTonePassed ? "The wording avoids obvious translated-template phrases." : (containsCjk ? "The customer-facing email must be written in English only." : violatesFitBrief ? "The email overstates buyer fit or uses a generic supplier pitch against the research brief." : `Template phrase found: ${templateHits[0] ?? (localSkeleton ? "fixed outreach skeleton" : stiffAiOpening ? "stiff AI opening" : "translated sales wording")}.`)),
    qualityCheck("personalized", "Evidence-backed personalization", personalizedPassed, personalizedPassed ? 20 : 4, personalizedPassed ? "The message links a concrete buyer signal to a likely sourcing implication." : (violatesFitBrief ? "The email ignores the customer decision brief; adjust the angle before sending." : "The message needs 2 concrete buyer clues plus a business implication, not just a name or category.")),
    qualityCheck("nextStep", "Clear next step", nextStepPassed, nextStepPassed ? 20 : 0, nextStepPassed ? "The buyer can answer a low-friction micro-offer." : "The CTA is too vague; offer a specific yes/no, A/B option, comparison, option list, specs, proof pack, or MOQ/lead-time table."),
    qualityCheck("twoSecondRead", "Complete 2-second scan", twoSecondPassed, twoSecondScore, twoSecondPassed ? "The email is short, complete, and scan-friendly." : "Keep it like a complete human business email: greeting, 35-125 words, short subject, 1-5 short paragraphs, low-friction CTA, and a real signoff/signature.")
  ];
  const score = Math.max(0, Math.min(100, checks.reduce((sum, check) => sum + check.score, 0)));
  const criticalFailed = !buyerReasonPassed
    || !humanTonePassed
    || !personalizedPassed
    || !nextStepPassed
    || !hasGreeting
    || !hasBusinessSignature
    || containsCjk
    || localSkeleton;
  const passed = score >= OUTREACH_MIN_DELIVERABLE_SCORE && !criticalFailed;
  const issues = checks.filter((check) => !check.passed).map((check) => check.message).filter(Boolean);
  const rewriteHints = [
    buyerReasonPassed ? "" : "Start with one specific product, channel, procurement, certification, project, or market clue from the buyer website; do not use only a domain, page title, or phrase like 'works around'.",
    humanTonePassed ? "" : (containsCjk ? "Rewrite the customer-facing email in English only; keep Chinese only for internal notes." : violatesFitBrief ? "Remove generic supplier claims and make the email match the customer success angle." : "Remove translated-template phrases and write like a short human business note."),
    personalizedPassed ? "" : (violatesFitBrief ? "Follow the customer decision brief: if the buyer may be a peer/manufacturer or purchase intent is weak, use a cautious complementary angle." : "Add at least two customer-specific clues from the buyer website and explain the buyer implication."),
    nextStepPassed ? "" : "End with one natural low-friction micro-offer: 2-3 matched options, an MOQ/lead-time table, a spec/certification pack, a short comparison, or a natural A/B choice. Avoid keyword-reply CTAs like Reply 'SPC table'.",
    hasGreeting ? "" : "Start the body with a normal greeting such as Hi DECNO team, or Hi [Name],.",
    hasSignoff ? "" : "End with Best regards and the saved sender signature.",
    twoSecondPassed ? "" : "Rewrite as a complete 45-110 word human sales email with greeting, CTA, and signature, not a visible formula."
  ].filter(Boolean);
  return OutreachEmailQualityReviewSchema.parse({
    score,
    passed,
    level: passed ? "pass" : criticalFailed ? "blocked" : "needs-work",
    summary: passed ? "Ready: this reads like a buyer-specific human note." : "Needs rewrite before sending.",
    checks,
    issues,
    rewriteHints,
    reviewedAt: new Date().toISOString()
  });
}

function assertGeneratedDraftQualityReady(review: OutreachEmailQualityReview): void {
  if (review.passed) return;
  throw new ClientInputError([
    `Hermills could not create a draft above the ${OUTREACH_MIN_DELIVERABLE_SCORE}-point quality gate after automatic rewrites.`,
    review.issues[0] ?? review.summary,
    "No low-quality draft was saved. Add more company proof or customer website evidence and try again."
  ].filter(Boolean).join(" "));
}

function qualityCheck(id: OutreachEmailQualityReview["checks"][number]["id"], label: string, passed: boolean, score: number, message: string): OutreachEmailQualityReview["checks"][number] {
  return { id, label, passed, score: Math.max(0, Math.min(20, Math.round(score))), message };
}

function normalizeQualityText(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

function firstBusinessLine(body: string): string {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => {
    const opening = normalizeOpeningLine(line);
    return opening && countWords(opening) > 2;
  }) ?? lines[0] ?? "";
}

function normalizeOutreachEmailLanguage(_language?: string): string {
  return OUTREACH_EMAIL_LANGUAGE;
}

async function outreachDraftSignatureBlock(repository: OutreachEmailSignatureRepository, companyProfile: CompanyProfile): Promise<string> {
  const signature = await repository.get();
  const savedText = signature.enabled ? normalizeEmailSignature(signature).text : "";
  const fallbackText = [companyProfile.name, companyProfile.website].map((item) => item?.trim()).filter(Boolean).join("\n");
  return ensureSignatureSignoff(savedText || fallbackText);
}

function ensureSignatureSignoff(value: string): string {
  const text = value.trim();
  if (!text) return "Best regards,";
  return hasEmailSignoff(text) ? text : `Best regards,\n${text}`;
}

function finalizeCopyReadyOutreachEmail(input: { subject: string; body: string; lead: OutreachLead; signatureBlock?: string }): { subject: string; body: string } {
  const subject = truncatePlain(input.subject.replace(/^subject\s*[:：]\s*/i, "").trim() || "Quick question", 240);
  let body = normalizeEmailBodyText(input.body);
  body = removePlaceholderSignature(body);
  if (!hasEmailGreeting(body)) body = `${outreachGreetingLine(input.lead)}\n\n${body}`;
  const signatureBlock = input.signatureBlock?.trim();
  if (signatureBlock && !hasEmailSignoff(body)) body = `${body}\n\n${signatureBlock}`;
  return { subject, body: truncateForContext(body.trim(), 20_000) };
}

function normalizeEmailBodyText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/^body\s*[:：]\s*/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function outreachGreetingLine(lead: OutreachLead): string {
  const contactName = lead.contactName?.trim();
  if (contactName) return `Hi ${contactName},`;
  const companyName = lead.companyName?.trim();
  if (companyName && !/^customer$/i.test(companyName)) return `Hi ${companyName} team,`;
  return "Hi team,";
}

function hasEmailGreeting(body: string): boolean {
  const firstLine = body.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  return /^(hi|hello)\s+[^,，.!?]{1,80}[,，]\s*$/i.test(firstLine) || /^(hi|hello)[,，]\s*$/i.test(firstLine);
}

function hasEmailSignoff(body: string): boolean {
  return /(?:^|\n)\s*(best regards|kind regards|regards|thanks|thank you|sincerely)[,，]?\s*(?:\n|$)/i.test(body.trim());
}

function hasCjkCharacters(value: string): boolean {
  return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(value);
}

function removePlaceholderSignature(body: string): string {
  if (!/\[(?:your name|company name|website|phone|whatsapp|email|name|company)\]/i.test(body)) return body.trim();
  return body
    .replace(/\n*\s*(?:best regards|kind regards|regards|thanks|thank you|sincerely)[,，]?\s*\n(?:\s*\[[^\]]+\]\s*\n?){1,6}\s*$/i, "")
    .trim();
}

function normalizeOpeningLine(line: string): string {
  return normalizeQualityText(line
    .replace(/^(hi|hello)[,，]\s*/i, "")
    .replace(/^(hi|hello|dear)\s+[^,，.!?]{1,40}[,，]\s*/i, ""));
}

function looksLikeLocalOutreachSkeleton(subject: string, body: string): boolean {
  const text = normalizeQualityText(`${subject}\n${body}`);
  const opening = normalizeOpeningLine(firstBusinessLine(body));
  const noticedSo = /\bi noticed\b.{0,120}\bso\b/.test(opening);
  const fullCatalog = /\binstead of (?:sending )?(?:a )?(?:full|broad) catalog\b/.test(text);
  const abUseful = /\bwould\s+[ab]\)|\bwould\s+a\)|\bwould\s+option\s+a\b|\bbe more useful first\b/.test(text);
  const supplierFit = /\bsupplier[- ]fit check\b|\bbackup options\b/.test(text) && /\bmatched specs\b|\bmoq\b|\blead[- ]time\b/.test(text);
  return (noticedSo && (fullCatalog || abUseful)) || (fullCatalog && abUseful) || supplierFit;
}

function buyerContextTokens(lead?: OutreachLead, research?: OutreachQualityResearchContext): string[] {
  const raw = [
    lead?.companyName,
    lead?.website,
    lead?.industry,
    lead?.need,
    research?.companyName,
    research?.website,
    research?.industry,
    research?.buyerType,
    research?.title,
    research?.description,
    ...(research?.evidence ?? []).flatMap((item) => [item.label, item.value, item.snippet]),
    ...(research?.productSignals ?? []),
    ...(research?.buyingSignals ?? []),
    ...(research?.painSignals ?? []),
    research?.brief?.buyerTypeDetail,
    research?.brief?.bestOutreachPath,
    research?.brief?.purchaseIntentSignal,
    research?.brief?.mainRisk,
    research?.brief?.bestAngle,
    ...(research?.brief?.outreachAngles ?? []).flatMap((angle) => [angle.name, angle.whyItFits, angle.buyerConcern, ...angle.evidence]),
    research?.textPreview,
    research?.inferredNeed,
    research?.recommendedAngle,
    lead?.notes
  ].filter(Boolean).flatMap((value) => String(value).split(/[^a-zA-Z0-9]+/));
  return Array.from(new Set(raw.map((token) => token.toLowerCase()).filter((token) => token.length >= 4 && !commonQualityTokens.has(token)))).slice(0, 48);
}

function buyerEvidenceTokens(lead?: OutreachLead, research?: OutreachQualityResearchContext): string[] {
  const raw = [
    lead?.industry,
    lead?.need,
    research?.industry,
    research?.buyerType,
    research?.title,
    research?.description,
    ...(research?.evidence ?? []).flatMap((item) => [item.label, item.value, item.snippet]),
    ...(research?.productSignals ?? []),
    ...(research?.buyingSignals ?? []),
    ...(research?.painSignals ?? []),
    research?.brief?.buyerTypeDetail,
    research?.brief?.bestOutreachPath,
    research?.brief?.purchaseIntentSignal,
    research?.brief?.mainRisk,
    research?.brief?.bestAngle,
    ...(research?.brief?.outreachAngles ?? []).flatMap((angle) => [angle.name, angle.whyItFits, angle.buyerConcern, ...angle.evidence]),
    research?.textPreview,
    research?.inferredNeed,
    research?.recommendedAngle,
    lead?.notes
  ].filter(Boolean).flatMap((value) => String(value).split(/[^a-zA-Z0-9]+/));
  return Array.from(new Set(raw.map((token) => token.toLowerCase()).filter((token) => token.length >= 4 && !commonQualityTokens.has(token)))).slice(0, 48);
}

function buyerStrongEvidenceTerms(lead?: OutreachLead, research?: OutreachQualityResearchContext): string[] {
  const source = [
    lead?.industry,
    lead?.need,
    research?.title,
    research?.description,
    research?.buyerType,
    research?.industry,
    ...(research?.evidence ?? []).flatMap((item) => [item.value, item.snippet]),
    ...(research?.productSignals ?? []),
    ...(research?.buyingSignals ?? []),
    ...(research?.painSignals ?? []),
    research?.brief?.bestOutreachPath,
    research?.brief?.mainRisk,
    ...(research?.brief?.outreachAngles ?? []).flatMap((angle) => angle.evidence)
  ].filter(Boolean).join("\n");
  const phrases = Array.from(source.matchAll(/\b[A-Z][A-Za-z0-9&/-]*(?:\s+[A-Z0-9][A-Za-z0-9&/-]*){0,4}\b/g))
    .map((match) => match[0])
    .filter((phrase) => phrase.length >= 4 && phrase.length <= 42);
  const specs = Array.from(source.matchAll(/\b(?:\d+(?:\.\d+)?\s?(?:mm|mil|inch|in|cm|m)|[A-Z]{2,6}|[A-Za-z]+-[A-Za-z0-9-]+)\b/g)).map((match) => match[0]);
  const signalPhrases = [
    ...(research?.productSignals ?? []),
    ...(research?.buyingSignals ?? []),
    ...(research?.painSignals ?? [])
  ].flatMap((signal) => signal.split(/[;/,]/)).map((item) => item.trim());
  const tokenTerms = buyerEvidenceTokens(lead, research).filter((token) => token.length >= 5);
  return Array.from(new Set([...phrases, ...specs, ...signalPhrases, ...tokenTerms]
    .map((term) => normalizeQualityText(term).replace(/\s+/g, " "))
    .filter((term) => term.length >= 4 && !commonQualityTokens.has(term) && !/^(page title|meta description|lead need)$/i.test(term))))
    .slice(0, 32);
}

const commonQualityTokens = new Set([
  "http",
  "https",
  "www",
  "com",
  "company",
  "email",
  "buyer",
  "buyers",
  "sales",
  "supply",
  "supplier",
  "suppliers",
  "manufacturer",
  "manufacturers",
  "product",
  "products",
  "service",
  "services",
  "import",
  "imports",
  "export",
  "exports",
  "business",
  "website",
  "quality",
  "price",
  "prices",
  "team",
  "need",
  "needs",
  "work",
  "works",
  "category",
  "categories",
  "channel",
  "channels",
  "details",
  "professional"
]);

function isGenericOutreachSubject(subject: string, tokens: string[]): boolean {
  const normalized = normalizeQualityText(subject);
  if (!normalized) return true;
  if (genericOutreachSubjects.includes(normalized)) return true;
  if (normalized.includes("fit check")) return true;
  const weakGenericPhrases = ["supply", "supplier fit", "supplier-fit check", "fit check", "quick question"];
  return weakGenericPhrases.some((phrase) => normalized.includes(phrase)) && evidenceTokenHitCount(normalized, tokens) === 0;
}

function evidenceTokenHitCount(value: string, tokens: string[]): number {
  const normalized = normalizeQualityText(value);
  return Array.from(new Set(tokens)).filter((token) => {
    const clean = normalizeQualityText(token);
    return clean.length >= 4 && qualityTextContainsToken(normalized, clean);
  }).length;
}

function containsAny(value: string, tokens: string[]): boolean {
  return tokens.some((token) => qualityTextContainsToken(value, normalizeQualityText(token)));
}

function qualityTextContainsToken(value: string, token: string): boolean {
  if (!token) return false;
  if (value.includes(token)) return true;
  if (/^[a-z0-9-]+$/i.test(token) && token.endsWith("s") && token.length > 4 && value.includes(token.slice(0, -1))) return true;
  if (/^[a-z0-9-]+$/i.test(token) && !token.endsWith("s") && token.length > 3 && value.includes(`${token}s`)) return true;
  return false;
}

function looksLikeMassTemplate(value: string): boolean {
  const genericSignals = [
    "we specialize in",
    "we provide",
    "our products are",
    "our company has",
    "many years of experience",
    "wide range of products",
    "looking forward to your reply"
  ];
  return genericSignals.filter((signal) => value.includes(signal)).length >= 2;
}

function countWords(value: string): number {
  const latinWords = value.trim().match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?/g)?.length ?? 0;
  const cjkChars = value.trim().match(/[\u3400-\u9fff]/g)?.length ?? 0;
  return latinWords + Math.ceil(cjkChars / 2);
}

function assertOutreachQualityPassed(review: OutreachEmailQualityReview): void {
  if (!review.passed) throw new ClientInputError(`Email needs rewrite before sending. ${review.issues[0] ?? review.summary}`);
}

function reviewOutreachSendRisk(input: {
  subject: string;
  body: string;
  qualityReview?: OutreachEmailQualityReview;
  sender?: OutreachSenderAccount;
  lead?: OutreachLead;
  research?: OutreachQualityResearchContext;
  evidenceLock?: OutreachEvidenceLock;
  ctaAssets?: OutreachCtaAsset[];
  companyKnowledgeContext?: string;
}): OutreachSendRiskReview {
  const issues: OutreachSendRiskReview["issues"] = [];
  const addIssue = (id: string, severity: OutreachSendRiskReview["issues"][number]["severity"], message: string) => {
    issues.push({ id, severity, message, blocking: severity === "block" });
  };
  const normalized = normalizeQualityText(`${input.subject}\n${input.body}`);
  if (input.qualityReview && !input.qualityReview.passed) {
    addIssue("quality_gate", "block", input.qualityReview.issues[0] ?? "Email quality review did not pass.");
  }
  if (/^\s*(re|fw|fwd)\s*:/i.test(input.subject) || /\b(invoice|payment overdue|urgent order|purchase order|po attached)\b/i.test(input.subject)) {
    addIssue("misleading_subject", "block", "Subject looks like a fake reply, order, invoice, or payment thread.");
  }
  if (/\bguaranteed\s+(profit|result|ranking|delivery)\b|\bexclusive supplier\b|\bofficial partner\b|\b#1\b/i.test(`${input.subject}\n${input.body}`)) {
    addIssue("unsupported_claim", "block", "Email contains unsupported proof or guarantee language.");
  }
  if (/\b(you are looking for|you need|you are planning|your demand is growing|replace your current supplier|solve your quality problems|we know you are sourcing|we noticed you need)\b/i.test(`${input.subject}\n${input.body}`)) {
    addIssue("unsupported_buyer_assumption", "block", "Email states the buyer's intent or problem as fact. Use cautious wording backed by website evidence.");
  }
  for (const rule of input.evidenceLock?.mustNotSay ?? []) {
    const normalizedRule = normalizeQualityText(rule);
    if (!normalizedRule) continue;
    if (/active sourcing|actively sourcing|replace|current supplier|promise|certification|delivery|stock|price|exclusivity/.test(normalizedRule)
      && /\b(active sourcing|actively sourcing|replace|current supplier|certified|certification|guaranteed delivery|in stock|best price|exclusive)\b/i.test(`${input.subject}\n${input.body}`)) {
      addIssue("evidence_lock_violation", "block", `Evidence lock blocks this angle: ${truncatePlain(rule, 160)}`);
      break;
    }
  }
  const fitBrief = input.research?.brief;
  if (fitBrief?.shouldWrite === "no") {
    addIssue("customer_fit_blocked", "block", "Customer research says this buyer is not a good fit unless the user adds a stronger reason.");
  }
  if (fitBrief && /no direct purchasing signal|not proven|inferred/i.test(fitBrief.purchaseIntentSignal)
    && /\b(you|your team|your company)\b.{0,80}\b(are|is|seem|looks)\b.{0,80}\b(sourcing|buying|purchasing|looking for|need|needs|planning)\b/i.test(`${input.subject}\n${input.body}`)) {
    addIssue("purchase_intent_overstated", "block", "Email states or strongly implies purchase intent that the research brief did not prove.");
  }
  if (fitBrief && /\b(manufacturer|oem|peer|factory|manufacture)\b/i.test(`${fitBrief.buyerTypeDetail} ${input.research?.buyerType ?? ""}`)
    && /\b(we|our)\b.{0,40}\b(supply|supplier|manufacture|manufacturer|factory|products?|flooring|catalog)\b/i.test(`${input.subject}\n${input.body}`)
    && /\b(high quality|competitive price|best price|one-stop|factory direct|leading manufacturer|trusted supplier|supply you|provide you)\b/i.test(`${input.subject}\n${input.body}`)) {
    addIssue("peer_buyer_generic_pitch", "block", "Buyer may be a manufacturer or peer; generic supplier-pitch wording is unsafe.");
  }
  const supportContext = normalizeQualityText([
    input.companyKnowledgeContext ?? "",
    input.research?.productSignals?.join(" ") ?? "",
    input.research?.buyingSignals?.join(" ") ?? "",
    input.research?.painSignals?.join(" ") ?? "",
    input.ctaAssets?.map((asset) => `${asset.name} ${asset.description} ${asset.assetText}`).join(" ") ?? ""
  ].join("\n"));
  if (/\b(?:ce|iso|fsc|sgs|ul|rohs|reach)\b[-\s]*(?:certified|certification|backed|compliant)?|\bcertified\b/i.test(`${input.subject}\n${input.body}`)
    && !/\b(?:ce|iso|fsc|sgs|ul|rohs|reach|certification|certifications|test report|compliance)\b/.test(supportContext)) {
    addIssue("unsupported_claim", "block", "Email mentions certification or compliance proof that is not backed by saved company evidence.");
  }
  if (input.sender) {
    if (!input.sender.enabled) addIssue("sender_disabled", "block", "Sender account is disabled.");
    if (!input.sender.deliveryConfirmedAt) addIssue("mailbox_not_confirmed", "block", "Sender mailbox must be tested and delivery-confirmed before sending.");
    if (!input.sender.email.includes("@")) addIssue("sender_identity", "block", "Sender email is invalid.");
    if (!senderLooksDomainAligned(input.sender)) {
      addIssue("domain_alignment", "warning", "Sender domain alignment could not be verified locally. Keep volume low and confirm SPF/DKIM/DMARC with the mailbox provider.");
    }
  } else {
    addIssue("sender_not_checked", "info", "Sender account was not supplied for this draft risk check.");
  }
  const ctaType = inferCtaAssetType(`${input.subject}\n${input.body}`);
  if (mentionsConcreteCtaAsset(normalized)) {
    const backed = hasAvailableCtaAsset(ctaType, input.ctaAssets ?? [], input.companyKnowledgeContext ?? "");
    if (!backed) {
      const severity = ctaType === "certification_pack" || ctaType === "quote_range" ? "block" : "warning";
      addIssue("cta_asset_missing", severity, `CTA mentions a concrete ${ctaType.replace(/_/g, " ")} but no matching saved asset or profile proof was found.`);
    }
  }
  if (!/\bunsubscribe\b|退订|取消订阅/i.test(input.body)) {
    addIssue("unsubscribe_missing", "warning", "No unsubscribe or opt-out sentence was found. Add one for cold outreach compliance where required.");
  }
  if (input.lead?.replyStatus === "unsubscribed") {
    addIssue("lead_unsubscribed", "block", "This lead is marked unsubscribed.");
  }
  const blockingCount = issues.filter((issue) => issue.blocking).length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const score = Math.max(0, 100 - blockingCount * 45 - warningCount * 10);
  return OutreachSendRiskReviewSchema.parse({
    score,
    passed: blockingCount === 0,
    level: blockingCount ? "blocked" : warningCount ? "warning" : "pass",
    issues,
    checkedAt: new Date().toISOString()
  });
}

function assertOutreachSendRiskPassed(review: OutreachSendRiskReview): void {
  if (!review.passed) throw new ClientInputError(`Email send risk blocked: ${review.issues.find((issue) => issue.blocking)?.message ?? "Fix the send risk issues before sending."}`);
}

function mentionsConcreteCtaAsset(normalized: string): boolean {
  return /\b(catalog|sample|samples|spec|specs|certification|proof pack|moq|lead time|lead-time|comparison|quote|pricing|price range|a\/b|option a|option b|matched options)\b/.test(normalized);
}

function hasAvailableCtaAsset(type: OutreachCtaAsset["type"], ctaAssets: OutreachCtaAsset[], companyKnowledgeContext: string): boolean {
  if (ctaAssets.some((asset) => asset.enabled && (asset.type === type || asset.type === "custom"))) return true;
  const context = normalizeQualityText(companyKnowledgeContext);
  if (type === "certification_pack") return /\bcertifications?:\s*\S/.test(companyKnowledgeContext) || /certification|ce|fsc|iso|sgs|test report/.test(context);
  if (type === "moq_leadtime_sheet") return /shipping terms|lead time|moq|delivery|logistics/.test(context);
  if (type === "sample_options") return /main products?:\s*\S/.test(companyKnowledgeContext) || /sample|product catalog|main products/.test(context);
  if (type === "spec_comparison") return /spec|catalog|product|technical|datasheet/.test(context);
  if (type === "catalog") return /catalog|main products|product/.test(context);
  return false;
}

function senderLooksDomainAligned(sender: OutreachSenderAccount): boolean {
  const domain = sender.email.split("@")[1]?.toLowerCase() ?? "";
  const host = sender.host?.toLowerCase() ?? "";
  if (!domain || !host) return false;
  if (/gmail\.com|googlemail\.com|outlook\.com|hotmail\.com|qq\.com|zoho\.com/.test(domain)) return true;
  return host.includes(domain) || domain.split(".").slice(-2).join(".") === host.split(".").slice(-2).join(".");
}

function researchDepthPromptGuidance(depth: OutreachResearchDepth): string {
  if (depth === "adaptive") return "Use self-adaptive depth: prefer deep website evidence from high-value pages, but stay conservative if the crawler had to fall back.";
  if (depth === "quick") return "Keep analysis conservative and compact; use only the strongest website clues.";
  if (depth === "deep") return "Use the full buyer-risk, procurement-trigger, and objection model, but still avoid unsupported claims.";
  return "Use a balanced buyer profile and practical procurement-trigger reasoning.";
}

async function generateFastOutreachDraft(input: {
  lead: OutreachLead;
  body: {
    language: string;
    tone: string;
    generationMode?: OutreachGenerationMode;
    researchDepth?: OutreachResearchDepth;
    providerId?: string;
    model?: string;
  };
  profileId: string;
  runtime: RuntimeAdapter;
  providers: ProviderRepository;
  companyProfile: CompanyProfileRepository;
  materials: MaterialRepository;
  emailSignature: OutreachEmailSignatureRepository;
  assets: OutreachAssetRepository;
  drafts: OutreachDraftRepository;
  research?: CustomerResearchResult;
}): Promise<OutreachDraft> {
  await assertCompanyProfileReady(input.companyProfile);
  const language = normalizeOutreachEmailLanguage(input.body.language);
  const companyProfileRecord = await input.companyProfile.get();
  const signatureBlock = await outreachDraftSignatureBlock(input.emailSignature, companyProfileRecord);
  const providerRecord = await resolveGenerationProvider(input.body.providerId, input.providers);
  const apiKey = providerRecord ? await input.providers.readApiKey(providerRecord).catch(() => undefined) : undefined;
  const provider = providerRecord ? {
    kind: providerRecord.kind,
    baseUrl: providerRecord.baseUrl,
    apiKey,
    defaultModel: providerRecord.defaultModel
  } : undefined;
  const model = resolveOutreachModel(input.body.model, providerRecord);
  const companyKnowledgeContext = await buildCompanyKnowledgeContext(input.companyProfile, input.materials);
  const generationBrief = buildOutreachGenerationBrief({
    lead: input.lead,
    research: input.research,
    companyKnowledgeContext
  });
  const prompt = buildFastOutreachPrompt({
    lead: input.lead,
    research: input.research,
    generationBrief,
    companyKnowledgeContext,
    language,
    tone: input.body.tone,
    signatureBlock
  });
  const replyText = await input.runtime.createHermesReply({
    messages: [{ id: randomUUID(), role: "user", content: prompt, createdAt: new Date().toISOString() }],
    model,
    instructions: outreachFastInstructions(),
    provider,
    reasoningEffort: "medium",
    maxOutputTokens: 1200,
    responseFormat: "json_object"
  });
  const parsed = finalizeCopyReadyOutreachEmail({
    ...parseGeneratedOutreachDraft(replyText),
    lead: input.lead,
    signatureBlock
  });
  const polished = await polishOutreachDraft({
    candidate: parsed,
    lead: input.lead,
    research: input.research,
    brief: generationBrief,
    language,
    tone: input.body.tone,
    companyKnowledgeContext,
    runtime: input.runtime,
    provider,
    model,
    signatureBlock,
    maxRepairAttempts: OUTREACH_FAST_REPAIR_ATTEMPTS
  });
  assertGeneratedDraftQualityReady(polished.qualityReview);
  const ctaAssets = await input.assets.listCtaAssets(input.profileId);
  const sendRiskReview = reviewOutreachSendRisk({
    subject: polished.subject,
    body: polished.body,
    qualityReview: polished.qualityReview,
    lead: input.lead,
    research: input.research,
    evidenceLock: OutreachEvidenceLockSchema.parse({}),
    ctaAssets,
    companyKnowledgeContext
  });
  return input.drafts.create({
    profileId: input.profileId,
    leadId: input.lead.id,
    subject: polished.subject,
    body: polished.body,
    language,
    tone: input.body.tone,
    generationMode: input.body.generationMode ?? "deep",
    promptSnapshot: truncateForContext(prompt, 30_000),
    providerId: providerRecord?.id,
    model,
    modelUsed: model,
    usage: estimateMessageUsage(prompt, `${polished.subject}\n${polished.body}`),
    leadFitScore: OutreachLeadFitScoreSchema.parse({}),
    evidenceLock: OutreachEvidenceLockSchema.parse({}),
    valueMatch: OutreachValueMatchSchema.parse({}),
    qualityReview: polished.qualityReview,
    evidenceMap: OutreachEvidenceMapSchema.parse({}),
    strategyMatch: OutreachStrategyMatchSchema.parse({}),
    sendRiskReview,
    writingEngine: "harness-v2",
    rewriteAttempts: polished.repairAttempts,
    evidenceUsed: [],
    matchedExampleIds: [],
    researchBrief: input.research?.brief,
    generationSummary: [
      `Quality-gated first draft generated from ${input.research?.depth ?? "adaptive"} website research and saved company knowledge.`,
      `QA score ${polished.qualityReview.score}/100 after ${polished.repairAttempts} automatic rewrite attempt(s).`
    ].join(" "),
    learningSignal: buildOutreachLearningSignal({
      lead: input.lead,
      subject: polished.subject,
      body: polished.body,
      leadFitScore: OutreachLeadFitScoreSchema.parse({}),
      valueMatch: OutreachValueMatchSchema.parse({}),
      step: 0
    })
  });
}

async function generateOutreachDraft(input: {
  lead: OutreachLead;
  body: {
    language: string;
    tone: string;
    generationMode?: OutreachGenerationMode;
    researchDepth?: OutreachResearchDepth;
    providerId?: string;
    model?: string;
  };
  profileId: string;
  runtime: RuntimeAdapter;
  providers: ProviderRepository;
  companyProfile: CompanyProfileRepository;
  materials: MaterialRepository;
  emailSignature: OutreachEmailSignatureRepository;
  assets: OutreachAssetRepository;
  drafts: OutreachDraftRepository;
  cloud?: HermillsCloudService;
  research?: CustomerResearchResult;
}): Promise<OutreachDraft> {
  await assertCompanyProfileReady(input.companyProfile);
  const language = normalizeOutreachEmailLanguage(input.body.language);
  const companyProfileRecord = await input.companyProfile.get();
  const signatureBlock = await outreachDraftSignatureBlock(input.emailSignature, companyProfileRecord);
  const providerRecord = await resolveGenerationProvider(input.body.providerId, input.providers);
  const apiKey = providerRecord ? await input.providers.readApiKey(providerRecord).catch(() => undefined) : undefined;
  const provider = providerRecord ? {
    kind: providerRecord.kind,
    baseUrl: providerRecord.baseUrl,
    apiKey,
    defaultModel: providerRecord.defaultModel
  } : undefined;
  const model = resolveOutreachModel(input.body.model, providerRecord);
  const companyKnowledgeContext = await buildCompanyKnowledgeContext(input.companyProfile, input.materials);
  const customerResearchContext = input.research ? formatCustomerResearchContext(input.research) : "";
  const generationBrief = buildOutreachGenerationBrief({
    lead: input.lead,
    research: input.research,
    companyKnowledgeContext
  });
  const [personas, usps, ctaAssets, goldenExamples] = await Promise.all([
    input.assets.listPersonas(input.profileId),
    input.assets.listUsps(input.profileId),
    input.assets.listCtaAssets(input.profileId),
    input.assets.listGoldenExamples(input.profileId)
  ]);
  const outreachOs = buildOutreachOsContext({
    mode: input.body.generationMode ?? "deep",
    lead: input.lead,
    research: input.research,
    companyKnowledgeContext,
    personas,
    usps,
    ctaAssets,
    brief: generationBrief
  });
  const strategicBrief = applyOutreachOsStrategyToBrief(generationBrief, outreachOs.strategyMatch, outreachOs.valueMatch);
  const outreachOsContext = formatOutreachOsContext(outreachOs);
  const harness = buildOutreachHarnessContext({ model, goldenExamples, lead: input.lead, research: input.research, outreachOs, strategicBrief });
  const learningPackContext = input.cloud
    ? await input.cloud.learningPackContext({
      profileId: input.profileId,
      companyProfile: companyProfileRecord,
      lead: input.lead,
      customerType: outreachOs.leadFitScore.customerType,
      industry: input.lead.industry || input.research?.industry
    }).catch(() => "")
    : "";
  const prompt = buildOutreachPrompt(input.lead, language, input.body.tone, companyKnowledgeContext, strategicBrief, [
    customerResearchContext,
    outreachOsContext,
    harness.goldenExamplesContext,
    learningPackContext
  ].filter(Boolean).join("\n\n"), signatureBlock);
  const replyText = await input.runtime.createHermesReply({
    messages: [{ id: randomUUID(), role: "user", content: prompt, createdAt: new Date().toISOString() }],
    model,
    instructions: outreachInstructions(),
    provider,
    reasoningEffort: "medium",
    maxOutputTokens: 4096,
    responseFormat: "json_object"
  });
  const parsed = parseGeneratedOutreachDraft(replyText);
  const polished = await polishOutreachDraft({
    candidate: parsed,
    lead: input.lead,
    research: input.research,
    brief: strategicBrief,
    language,
    tone: input.body.tone,
    companyKnowledgeContext,
    goldenExamplesContext: harness.goldenExamplesContext,
    runtime: input.runtime,
    provider,
    model,
    signatureBlock,
    maxRepairAttempts: OUTREACH_FAST_REPAIR_ATTEMPTS
  });
  assertGeneratedDraftQualityReady(polished.qualityReview);
  const sendRiskReview = reviewOutreachSendRisk({
    subject: polished.subject,
    body: polished.body,
    qualityReview: polished.qualityReview,
    lead: input.lead,
    research: input.research,
    evidenceLock: outreachOs.evidenceLock,
    ctaAssets,
    companyKnowledgeContext
  });
  return input.drafts.create({
    profileId: input.profileId,
    leadId: input.lead.id,
    subject: polished.subject,
    body: polished.body,
    language,
    tone: input.body.tone,
    generationMode: outreachOs.mode,
    promptSnapshot: truncateForContext(prompt, 30_000),
    providerId: providerRecord?.id,
    model,
    modelUsed: model,
    usage: estimateMessageUsage(prompt, `${polished.subject}\n${polished.body}`),
    leadFitScore: outreachOs.leadFitScore,
    evidenceLock: outreachOs.evidenceLock,
    valueMatch: outreachOs.valueMatchRecord,
    qualityReview: polished.qualityReview,
    evidenceMap: outreachOs.evidenceMap,
    strategyMatch: outreachOs.strategyMatch,
    sendRiskReview,
    writingEngine: "harness-v2",
    rewriteAttempts: polished.repairAttempts,
    evidenceUsed: harness.evidenceUsed,
    matchedExampleIds: harness.goldenExamples.map((example) => example.id),
    researchBrief: input.research?.brief,
    generationSummary: summarizeHarnessGeneration({
      research: input.research,
      strategy: outreachOs.strategyMatch,
      matchedExamples: harness.goldenExamples,
      qualityReview: polished.qualityReview,
      repairAttempts: polished.repairAttempts
    }),
    learningSignal: buildOutreachLearningSignal({
      lead: input.lead,
      subject: polished.subject,
      body: polished.body,
      leadFitScore: outreachOs.leadFitScore,
      valueMatch: outreachOs.valueMatchRecord,
      step: 0
    })
  });
}

async function generateOutreachWorkflow(input: {
  body: z.infer<typeof AutoOutreachDraftBody>;
  profileId: string;
  lead?: OutreachLead;
  runtime: RuntimeAdapter;
  providers: ProviderRepository;
  companyProfile: CompanyProfileRepository;
  materials: MaterialRepository;
  emailSignature: OutreachEmailSignatureRepository;
  assets: OutreachAssetRepository;
  leads: OutreachLeadRepository;
  drafts: OutreachDraftRepository;
  workflows: OutreachWorkflowRepository;
  deepResearch?: DeepResearchClient;
  customerResearchCache?: CustomerResearchCacheRepository;
  cloud?: HermillsCloudService;
  research?: CustomerResearchResult;
  researchDepth?: OutreachResearchDepth;
}): Promise<OutreachWorkflow> {
  await assertCompanyProfileReady(input.companyProfile);
  const language = normalizeOutreachEmailLanguage(input.body.language);
  const companyProfileRecord = await input.companyProfile.get();
  const signatureBlock = await outreachDraftSignatureBlock(input.emailSignature, companyProfileRecord);
  const researchDepth = input.researchDepth ?? input.body.researchDepth ?? "adaptive";
  const research = input.research ?? await researchCustomerWebsite(input.body.website, researchDepth, {
    email: input.body.email,
    deepResearch: input.deepResearch,
    cache: input.customerResearchCache
  });
  const lead = input.lead ?? await input.leads.create({
    profileId: input.profileId,
    companyName: research.companyName || companyNameFromWebsite(research.website) || companyNameFromEmail(input.body.email),
    website: research.website,
    email: input.body.email,
    country: "",
    industry: research.industry || "",
    contactName: "",
    contactTitle: "",
    need: research.inferredNeed || "",
    notes: formatCustomerResearchNotes(research),
    tags: ["auto-researched"]
  });
  const providerRecord = await resolveGenerationProvider(input.body.providerId, input.providers);
  const apiKey = providerRecord ? await input.providers.readApiKey(providerRecord).catch(() => undefined) : undefined;
  const provider = providerRecord ? {
    kind: providerRecord.kind,
    baseUrl: providerRecord.baseUrl,
    apiKey,
    defaultModel: providerRecord.defaultModel
  } : undefined;
  const model = resolveOutreachModel(input.body.model, providerRecord);
  const companyKnowledgeContext = await buildCompanyKnowledgeContext(input.companyProfile, input.materials);
  const customerResearchContext = formatCustomerResearchContext(research);
  const generationBrief = buildOutreachGenerationBrief({
    lead,
    research,
    companyKnowledgeContext
  });
  const [personas, usps, ctaAssets, goldenExamples] = await Promise.all([
    input.assets.listPersonas(input.profileId),
    input.assets.listUsps(input.profileId),
    input.assets.listCtaAssets(input.profileId),
    input.assets.listGoldenExamples(input.profileId)
  ]);
  const outreachOs = buildOutreachOsContext({
    mode: input.body.generationMode ?? "deep",
    lead,
    research,
    companyKnowledgeContext,
    personas,
    usps,
    ctaAssets,
    brief: generationBrief
  });
  const strategicBrief = applyOutreachOsStrategyToBrief(generationBrief, outreachOs.strategyMatch, outreachOs.valueMatch);
  const outreachOsContext = formatOutreachOsContext(outreachOs);
  const harness = buildOutreachHarnessContext({ model, goldenExamples, lead, research, outreachOs, strategicBrief });
  const learningPackContext = input.cloud
    ? await input.cloud.learningPackContext({
      profileId: input.profileId,
      companyProfile: companyProfileRecord,
      lead,
      customerType: outreachOs.leadFitScore.customerType,
      industry: lead.industry || research.industry
    }).catch(() => "")
    : "";
  const prompt = buildOutreachWorkflowPrompt({
    lead,
    research,
    generationBrief: strategicBrief,
    outreachOsContext: [outreachOsContext, harness.goldenExamplesContext, learningPackContext].filter(Boolean).join("\n\n"),
    companyKnowledgeContext,
    language,
    tone: input.body.tone,
    signatureBlock
  });
  const replyText = await input.runtime.createHermesReply({
    messages: [{ id: randomUUID(), role: "user", content: prompt, createdAt: new Date().toISOString() }],
    model,
    instructions: outreachWorkflowInstructions(),
    provider,
    reasoningEffort: "medium",
    maxOutputTokens: 8192,
    responseFormat: "json_object"
  });
  const generated = parseGeneratedOutreachWorkflow(replyText, lead, language, input.body.tone);
  const polishedInitial = await polishOutreachDraft({
    candidate: {
      subject: generated.initialEmail.subject,
      body: generated.initialEmail.body
    },
    lead,
    research,
    brief: strategicBrief,
    language,
    tone: input.body.tone,
    companyKnowledgeContext,
    goldenExamplesContext: harness.goldenExamplesContext,
    runtime: input.runtime,
    provider,
    model,
    signatureBlock,
    maxRepairAttempts: OUTREACH_FAST_REPAIR_ATTEMPTS
  });
  const initialQualityReview = polishedInitial.qualityReview;
  assertGeneratedDraftQualityReady(initialQualityReview);
  const polishedFollowUps = polishWorkflowFollowUps({
    followUps: generated.followUps,
    lead,
    brief: strategicBrief,
    language,
    tone: input.body.tone,
    signatureBlock
  });
  const initialSendRiskReview = reviewOutreachSendRisk({
    subject: polishedInitial.subject,
    body: polishedInitial.body,
    qualityReview: initialQualityReview,
    lead,
    research,
    evidenceLock: outreachOs.evidenceLock,
    ctaAssets,
    companyKnowledgeContext
  });
  const initialDraft = await input.drafts.create({
    profileId: input.profileId,
    leadId: lead.id,
    subject: polishedInitial.subject,
    body: polishedInitial.body,
    language,
    tone: input.body.tone,
    generationMode: outreachOs.mode,
    promptSnapshot: truncateForContext(prompt, 30_000),
    providerId: providerRecord?.id,
    model,
    modelUsed: model,
    usage: estimateMessageUsage(prompt, `${polishedInitial.subject}\n${polishedInitial.body}`),
    leadFitScore: outreachOs.leadFitScore,
    evidenceLock: outreachOs.evidenceLock,
    valueMatch: outreachOs.valueMatchRecord,
    qualityReview: initialQualityReview,
    evidenceMap: outreachOs.evidenceMap,
    strategyMatch: outreachOs.strategyMatch,
    sendRiskReview: initialSendRiskReview,
    writingEngine: "harness-v2",
    rewriteAttempts: polishedInitial.repairAttempts,
    evidenceUsed: harness.evidenceUsed,
    matchedExampleIds: harness.goldenExamples.map((example) => example.id),
    researchBrief: research.brief,
    generationSummary: summarizeHarnessGeneration({
      research,
      strategy: outreachOs.strategyMatch,
      matchedExamples: harness.goldenExamples,
      qualityReview: initialQualityReview,
      repairAttempts: polishedInitial.repairAttempts
    }),
    learningSignal: buildOutreachLearningSignal({
      lead,
      subject: polishedInitial.subject,
      body: polishedInitial.body,
      leadFitScore: outreachOs.leadFitScore,
      valueMatch: outreachOs.valueMatchRecord,
      step: 0
    })
  });
  const followUps = [];
  for (const email of polishedFollowUps.slice(0, 9)) {
    const followUpQualityReview = email.qualityReview ?? reviewOutreachEmail({ subject: email.subject, body: email.body, lead, research });
    const sendRiskReview = reviewOutreachSendRisk({
      subject: email.subject,
      body: email.body,
      qualityReview: followUpQualityReview,
      lead,
      evidenceLock: outreachOs.evidenceLock,
      ctaAssets,
      companyKnowledgeContext
    });
    const draft = await input.drafts.create({
      profileId: input.profileId,
      leadId: lead.id,
      subject: email.subject,
      body: email.body,
      language,
      tone: input.body.tone,
      generationMode: outreachOs.mode,
      promptSnapshot: truncateForContext(prompt, 30_000),
      providerId: providerRecord?.id,
      model,
      modelUsed: model,
      usage: estimateMessageUsage(prompt, `${email.subject}\n${email.body}`),
      leadFitScore: outreachOs.leadFitScore,
      evidenceLock: outreachOs.evidenceLock,
      valueMatch: outreachOs.valueMatchRecord,
      qualityReview: followUpQualityReview,
      evidenceMap: outreachOs.evidenceMap,
      strategyMatch: outreachOs.strategyMatch,
      sendRiskReview,
      writingEngine: "harness-v2",
      rewriteAttempts: 0,
      evidenceUsed: harness.evidenceUsed,
      matchedExampleIds: harness.goldenExamples.map((example) => example.id),
      researchBrief: research.brief,
      generationSummary: summarizeHarnessGeneration({
        research,
        strategy: outreachOs.strategyMatch,
        matchedExamples: harness.goldenExamples,
        qualityReview: followUpQualityReview,
        repairAttempts: 0
      }),
      learningSignal: buildOutreachLearningSignal({
        lead,
        subject: email.subject,
        body: email.body,
        leadFitScore: outreachOs.leadFitScore,
        valueMatch: outreachOs.valueMatchRecord,
        step: email.step
      })
    });
    followUps.push({
      ...email,
      draftId: draft.id,
      leadFitScore: outreachOs.leadFitScore,
      evidenceLock: outreachOs.evidenceLock,
      valueMatch: outreachOs.valueMatchRecord,
      qualityReview: followUpQualityReview,
      evidenceMap: outreachOs.evidenceMap,
      strategyMatch: outreachOs.strategyMatch,
      researchBrief: research.brief,
      sendRiskReview,
      learningSignal: draft.learningSignal
    });
  }
  const now = new Date().toISOString();
  return input.workflows.create({
    profileId: input.profileId,
    leadId: lead.id,
    draftId: initialDraft.id,
    website: research.website,
    email: input.body.email,
    language,
    tone: input.body.tone,
    generationMode: outreachOs.mode,
    research: CustomerResearchSnapshotSchema.parse({ ...research, createdAt: now }),
    icps: generated.icps,
    usps: generated.usps,
    initialEmail: {
      ...generated.initialEmail,
      subject: polishedInitial.subject,
      body: polishedInitial.body,
      draftId: initialDraft.id,
      leadFitScore: outreachOs.leadFitScore,
      evidenceLock: outreachOs.evidenceLock,
      valueMatch: outreachOs.valueMatchRecord,
      qualityReview: initialQualityReview,
      evidenceMap: outreachOs.evidenceMap,
      strategyMatch: outreachOs.strategyMatch,
      researchBrief: research.brief,
      sendRiskReview: initialSendRiskReview,
      learningSignal: initialDraft.learningSignal
    },
    followUps,
    promptSnapshot: truncateForContext(`${prompt}\n\n--- Customer context ---\n${customerResearchContext}\n\n${outreachOsContext}`, 30_000),
    providerId: providerRecord?.id,
    model,
    usage: estimateMessageUsage(prompt, replyText)
  });
}

async function generateOutreachCampaignWorkflows(input: {
  campaignId: string;
  runtime: RuntimeAdapter;
  providers: ProviderRepository;
  companyProfile: CompanyProfileRepository;
  materials: MaterialRepository;
  emailSignature: OutreachEmailSignatureRepository;
  assets: OutreachAssetRepository;
  leads: OutreachLeadRepository;
  drafts: OutreachDraftRepository;
  workflows: OutreachWorkflowRepository;
  campaigns: OutreachCampaignRepository;
  deepResearch?: DeepResearchClient;
  customerResearchCache?: CustomerResearchCacheRepository;
  cloud?: HermillsCloudService;
}): Promise<OutreachCampaignWithRecipients> {
  const campaign = await input.campaigns.require(input.campaignId);
  if (campaign.status === "stopped") throw new ClientInputError("Stopped campaigns cannot generate new drafts.");
  await input.campaigns.updateCampaign(campaign.id, { status: "generating" });
  const detail = await input.campaigns.requireWithRecipients(campaign.id, input.drafts);
  const recipients = detail.recipients.filter((recipient) => ["pending", "failed"].includes(recipient.status) && !recipient.workflowId && !recipient.initialDraftId);
  const researchCache = new Map<string, Promise<CustomerResearchResult>>();
  const getResearch = (website: string) => {
    const normalized = normalizeWebsiteUrl(website);
    const key = `${campaign.researchDepth}:${normalized}`;
    const cached = researchCache.get(key);
    if (cached) return cached;
    const recipientEmail = detail.recipients.find((recipient) => normalizeWebsiteUrl(recipient.website) === normalized)?.email;
    const next = researchCustomerWebsite(normalized, campaign.researchDepth, {
      email: recipientEmail,
      deepResearch: input.deepResearch,
      cache: input.customerResearchCache
    });
    researchCache.set(key, next);
    return next;
  };
  await mapWithConcurrency(recipients, researchConcurrency(campaign.researchDepth), async (recipient) => {
    await input.campaigns.updateRecipient(recipient.id, { status: "researching", sendError: undefined });
    try {
      const lead = await input.leads.require(recipient.leadId);
      if (lead.profileId !== campaign.profileId) throw new ClientInputError(`Lead belongs to another profile: ${lead.companyName}`);
      const research = await getResearch(recipient.website);
      const workflow = await generateOutreachWorkflow({
        body: {
          website: recipient.website,
          email: recipient.email,
          language: campaign.language,
          tone: campaign.tone,
          generationMode: campaign.generationMode,
          researchDepth: campaign.researchDepth,
          providerId: campaign.providerId,
          model: campaign.model
        },
        profileId: campaign.profileId,
        lead,
        runtime: input.runtime,
        providers: input.providers,
        companyProfile: input.companyProfile,
        materials: input.materials,
        emailSignature: input.emailSignature,
        assets: input.assets,
        leads: input.leads,
        drafts: input.drafts,
        workflows: input.workflows,
        deepResearch: input.deepResearch,
        customerResearchCache: input.customerResearchCache,
        cloud: input.cloud,
        research,
        researchDepth: campaign.researchDepth
      });
      await input.campaigns.updateRecipient(recipient.id, {
        status: "generated",
        workflowId: workflow.id,
        initialDraftId: workflow.draftId,
        leadFitScore: workflow.initialEmail.leadFitScore,
        evidenceLock: workflow.initialEmail.evidenceLock,
        valueMatch: workflow.initialEmail.valueMatch,
        learningSignal: workflow.initialEmail.learningSignal,
        researchSummary: summarizeCustomerResearch(research),
        sendError: undefined
      });
    } catch (error) {
      await input.campaigns.updateRecipient(recipient.id, {
        status: "failed",
        sendError: redactSecrets(error instanceof Error ? error.message : String(error))
      });
    }
  });
  const refreshed = await input.campaigns.requireWithRecipients(campaign.id, input.drafts);
  await input.campaigns.updateCampaign(campaign.id, { status: nextCampaignStatus(refreshed) });
  return input.campaigns.requireWithRecipients(campaign.id, input.drafts);
}

async function mapWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= items.length) return;
      await worker(items[currentIndex]);
    }
  }));
}

async function approveOutreachCampaignRecipient(input: {
  campaignId: string;
  recipientId: string;
  subject?: string;
  body?: string;
  companyProfile: CompanyProfileRepository;
  materials: MaterialRepository;
  assets: OutreachAssetRepository;
  drafts: OutreachDraftRepository;
  workflows: OutreachWorkflowRepository;
  campaigns: OutreachCampaignRepository;
}): Promise<OutreachCampaignWithRecipients> {
  const detail = await input.campaigns.requireWithRecipients(input.campaignId, input.drafts);
  const recipient = detail.recipients.find((item) => item.id === input.recipientId);
  if (!recipient) throw new ClientInputError(`Campaign recipient not found: ${input.recipientId}`);
  if (["sent", "sending", "skipped"].includes(recipient.status)) throw new ClientInputError("This recipient cannot be approved anymore.");
  if (!recipient.initialDraftId || !recipient.workflowId) throw new ClientInputError("Generate this recipient draft before approving it.");
  let draft = await input.drafts.require(recipient.initialDraftId);
  if (input.subject || input.body) {
    draft = await input.drafts.update(draft.id, {
      subject: input.subject ?? draft.subject,
      body: input.body ?? draft.body
    });
    const workflow = await input.workflows.require(recipient.workflowId);
    await input.workflows.update(workflow.id, {
      initialEmail: {
        ...workflow.initialEmail,
        subject: draft.subject,
        body: draft.body,
        status: draft.status,
        sentAt: draft.sentAt,
        sendError: draft.sendError
      }
    });
  }
  const workflow = await input.workflows.require(recipient.workflowId);
  const review = reviewOutreachEmail({
    subject: draft.subject,
    body: draft.body,
    research: workflow.research
  });
  const sendRiskReview = reviewOutreachSendRisk({
    subject: draft.subject,
    body: draft.body,
    qualityReview: review,
    research: workflow.research,
    evidenceLock: draft.evidenceLock,
    ctaAssets: await input.assets.listCtaAssets(detail.profileId),
    companyKnowledgeContext: await buildCompanyKnowledgeContext(input.companyProfile, input.materials)
  });
  await input.drafts.update(draft.id, { qualityReview: review, sendRiskReview });
  await input.workflows.update(workflow.id, {
    initialEmail: {
      ...workflow.initialEmail,
      subject: draft.subject,
      body: draft.body,
      status: draft.status,
      sentAt: draft.sentAt,
      sendError: draft.sendError,
      qualityReview: review,
      sendRiskReview
    }
  });
  assertOutreachQualityPassed(review);
  assertOutreachSendRiskPassed(sendRiskReview);
  await input.campaigns.updateRecipient(recipient.id, {
    status: "approved",
    approvedAt: new Date().toISOString(),
    sendError: undefined
  });
  await input.campaigns.updateCampaign(input.campaignId, { status: "ready" });
  return input.campaigns.requireWithRecipients(input.campaignId, input.drafts);
}

async function reviewOutreachCampaignRecipient(
  campaignId: string,
  recipientId: string,
  leads: OutreachLeadRepository,
  drafts: OutreachDraftRepository,
  workflows: OutreachWorkflowRepository,
  campaigns: OutreachCampaignRepository
): Promise<OutreachEmailQualityReview> {
  const detail = await campaigns.requireWithRecipients(campaignId, drafts);
  const recipient = detail.recipients.find((item) => item.id === recipientId);
  if (!recipient) throw new ClientInputError(`Campaign recipient not found: ${recipientId}`);
  if (!recipient.initialDraftId || !recipient.workflowId) throw new ClientInputError("Generate this recipient draft before reviewing it.");
  const draft = await drafts.require(recipient.initialDraftId);
  const lead = await leads.get(recipient.leadId);
  const workflow = await workflows.require(recipient.workflowId);
  const review = reviewOutreachEmail({ subject: draft.subject, body: draft.body, lead, research: workflow.research });
  await drafts.update(draft.id, { qualityReview: review });
  await workflows.update(workflow.id, {
    initialEmail: {
      ...workflow.initialEmail,
      subject: draft.subject,
      body: draft.body,
      status: draft.status,
      sentAt: draft.sentAt,
      sendError: draft.sendError,
      qualityReview: review
    }
  });
  return review;
}

async function rewriteOutreachCampaignRecipient(input: {
  campaignId: string;
  recipientId: string;
  body: z.infer<typeof RewriteOutreachDraftBody>;
  runtime: RuntimeAdapter;
  providers: ProviderRepository;
  companyProfile: CompanyProfileRepository;
  materials: MaterialRepository;
  assets: OutreachAssetRepository;
  leads: OutreachLeadRepository;
  drafts: OutreachDraftRepository;
  workflows: OutreachWorkflowRepository;
  campaigns: OutreachCampaignRepository;
}): Promise<OutreachCampaignWithRecipients> {
  const detail = await input.campaigns.requireWithRecipients(input.campaignId, input.drafts);
  const recipient = detail.recipients.find((item) => item.id === input.recipientId);
  if (!recipient) throw new ClientInputError(`Campaign recipient not found: ${input.recipientId}`);
  if (!recipient.initialDraftId || !recipient.workflowId) throw new ClientInputError("Generate this recipient draft before rewriting it.");
  const draft = await input.drafts.require(recipient.initialDraftId);
  const lead = await input.leads.get(recipient.leadId);
  const workflow = await input.workflows.require(recipient.workflowId);
  const rewritten = await rewriteOutreachDraft({
    draft,
    lead,
    workflow,
    body: input.body,
    runtime: input.runtime,
    providers: input.providers,
    companyProfile: input.companyProfile,
    materials: input.materials,
    assets: input.assets,
    drafts: input.drafts
  });
  const review = rewritten.qualityReview ?? reviewOutreachEmail({ subject: rewritten.subject, body: rewritten.body, lead, research: workflow.research });
  await input.workflows.update(workflow.id, {
    initialEmail: {
      ...workflow.initialEmail,
      subject: rewritten.subject,
      body: rewritten.body,
      status: rewritten.status,
      sentAt: rewritten.sentAt,
      sendError: rewritten.sendError,
      qualityReview: review,
      sendRiskReview: rewritten.sendRiskReview
    }
  });
  await input.campaigns.updateRecipient(recipient.id, { status: "generated", approvedAt: undefined, sendError: undefined });
  return input.campaigns.requireWithRecipients(input.campaignId, input.drafts);
}

async function rewriteOutreachDraft(input: {
  draft: OutreachDraft;
  lead?: OutreachLead;
  workflow?: OutreachWorkflow;
  body: z.infer<typeof RewriteOutreachDraftBody>;
  runtime: RuntimeAdapter;
  providers: ProviderRepository;
  companyProfile: CompanyProfileRepository;
  materials: MaterialRepository;
  assets: OutreachAssetRepository;
  drafts: OutreachDraftRepository;
}): Promise<OutreachDraft> {
  await assertCompanyProfileReady(input.companyProfile);
  const currentReview = input.draft.qualityReview ?? reviewOutreachEmail({
    subject: input.draft.subject,
    body: input.draft.body,
    lead: input.lead,
    research: input.workflow?.research
  });
  const providerRecord = await resolveGenerationProvider(input.body.providerId ?? input.draft.providerId, input.providers);
  const apiKey = providerRecord ? await input.providers.readApiKey(providerRecord).catch(() => undefined) : undefined;
  const provider = providerRecord ? {
    kind: providerRecord.kind,
    baseUrl: providerRecord.baseUrl,
    apiKey,
    defaultModel: providerRecord.defaultModel
  } : undefined;
  const model = resolveOutreachModel(input.body.model ?? input.draft.model, providerRecord);
  const companyKnowledgeContext = await buildCompanyKnowledgeContext(input.companyProfile, input.materials);
  const goldenExamples = await input.assets.listGoldenExamples(input.draft.profileId ?? "");
  const matchedExamples = selectOutreachGoldenExamples(goldenExamples, {
    lead: input.lead ?? {
      id: "draft-lead",
      profileId: input.draft.profileId,
      companyName: input.workflow?.research.companyName ?? "",
      website: input.workflow?.research.website ?? "",
      email: input.workflow?.email ?? "",
      country: "",
      industry: input.workflow?.research.industry ?? "",
      contactName: "",
      contactTitle: "",
      need: input.workflow?.research.inferredNeed ?? "",
      notes: "",
      tags: [],
      source: "draft",
      status: "new",
      currentState: "input_ready",
      replyStatus: "not_checked",
      statusColor: "slate",
      currentRound: 0,
      leadFitScore: OutreachLeadFitScoreSchema.parse({}),
      evidenceLock: OutreachEvidenceLockSchema.parse({}),
      valueMatch: OutreachValueMatchSchema.parse({}),
      sendOutcome: OutreachSendOutcomeSchema.parse({}),
      learningSignal: OutreachLearningSignalSchema.parse({}),
      createdAt: input.draft.createdAt,
      updatedAt: input.draft.updatedAt
    },
    research: input.workflow?.research,
    brief: {
      buyerReason: input.draft.strategyMatch?.buyerPain ?? input.workflow?.research.recommendedAngle ?? "",
      buyerSegment: input.workflow?.research.buyerType ?? "",
      likelyPain: input.draft.strategyMatch?.buyerImplication ?? input.workflow?.research.inferredNeed ?? "",
      procurementTrigger: input.workflow?.research.recommendedAngle ?? "",
      selectedUsp: {
        headline: input.draft.strategyMatch?.selectedUsp ?? "",
        buyerAngle: input.draft.strategyMatch?.buyerImplication ?? "",
        proof: ""
      },
      microOffer: input.draft.strategyMatch?.microOffer ?? "",
      missingEvidence: []
    },
    strategy: input.draft.strategyMatch ?? OutreachStrategyMatchSchema.parse({})
  });
  const prompt = buildOutreachRewritePrompt({
    draft: input.draft,
    lead: input.lead,
    workflow: input.workflow,
    currentReview,
    companyKnowledgeContext,
    goldenExamplesContext: formatOutreachGoldenExamplesContext(matchedExamples)
  });
  const replyText = await input.runtime.createHermesReply({
    messages: [{ id: randomUUID(), role: "user", content: prompt, createdAt: new Date().toISOString() }],
    model,
    instructions: outreachInstructions(),
    provider,
    reasoningEffort: "medium",
    maxOutputTokens: 4096,
    responseFormat: "json_object"
  });
  const parsed = parseGeneratedOutreachDraft(replyText);
  const review = reviewOutreachEmail({
    subject: parsed.subject,
    body: parsed.body,
    lead: input.lead,
    research: input.workflow?.research
  });
  const sendRiskReview = reviewOutreachSendRisk({
    subject: parsed.subject,
    body: parsed.body,
    qualityReview: review,
    lead: input.lead,
    research: input.workflow?.research,
    evidenceLock: input.draft.evidenceLock,
    ctaAssets: await input.assets.listCtaAssets(input.draft.profileId ?? ""),
    companyKnowledgeContext
  });
  return input.drafts.update(input.draft.id, {
    subject: parsed.subject,
    body: parsed.body,
    qualityReview: review,
    sendRiskReview,
    model,
    modelUsed: model,
    writingEngine: "harness-v2",
    rewriteAttempts: Math.min(5, (input.draft.rewriteAttempts ?? 0) + 1),
    matchedExampleIds: matchedExamples.map((example) => example.id),
    researchBrief: input.workflow?.research.brief ?? input.draft.researchBrief,
    generationSummary: summarizeHarnessGeneration({
      research: input.workflow?.research,
      strategy: input.draft.strategyMatch ?? OutreachStrategyMatchSchema.parse({}),
      matchedExamples,
      qualityReview: review,
      repairAttempts: Math.min(5, (input.draft.rewriteAttempts ?? 0) + 1)
    })
  });
}

function buildOutreachRewritePrompt(input: {
  draft: OutreachDraft;
  lead?: OutreachLead;
  workflow?: OutreachWorkflow;
  currentReview: OutreachEmailQualityReview;
  companyKnowledgeContext: string;
  goldenExamplesContext?: string;
}): string {
  return [
    "Rewrite this B2B cold email so it passes the buyer 2-second quality gate.",
    "Return JSON only: {\"subject\":\"...\",\"body\":\"...\"}.",
    "",
    "Hard rules:",
    "- Use 45-90 words in 2-4 compact paragraphs.",
    "- The first real sentence must tell this buyer the specific reason they are being contacted and why that clue matters.",
    "- The first real sentence must include a concrete buyer evidence clue from the website, lead notes, or research summary; company name alone does not count.",
    "- Translate the evidence into a buyer implication before saying what we sell.",
    "- Mention one supplier USP and why it is relevant to this buyer's sourcing risk, KPI, channel, procurement task, or timing.",
    "- End with one low-friction micro-offer, such as 2-3 matched options, a small comparison, an MOQ/lead-time table, a certification/spec pack, or A/B choices.",
    "- Do not start with our company credentials.",
    "- Do not use vague CTAs like 'Would you like details?', 'Are you interested?', 'Can we talk?', or 'Please send your requirements'.",
    "- Do not use translated-template phrases, reaching out, hope you are doing well, Dear Sir/Madam, esteemed company, long-term cooperation, high quality and competitive price, best price, one-stop solution, win-win cooperation, or please kindly.",
    "- Do not invent proof, certifications, prices, cases, or fake familiarity.",
    "",
    "--- Current draft ---",
    `Subject: ${input.draft.subject}`,
    input.draft.body,
    "",
    "--- Quality issues to fix ---",
    input.currentReview.issues.length ? input.currentReview.issues.join("\n") : "Make the email shorter, more buyer-specific, and easier to answer.",
    "",
    "--- Lead ---",
    input.lead ? [
      `Company: ${input.lead.companyName}`,
      input.lead.website ? `Website: ${input.lead.website}` : "",
      input.lead.industry ? `Industry: ${input.lead.industry}` : "",
      input.lead.need ? `Need: ${input.lead.need}` : "",
      input.lead.notes ? `Notes: ${input.lead.notes}` : ""
    ].filter(Boolean).join("\n") : "No lead record available.",
    "",
    "--- Customer research ---",
    input.workflow ? [
      `Company: ${input.workflow.research.companyName}`,
      `Website: ${input.workflow.research.website}`,
      input.workflow.research.industry ? `Industry: ${input.workflow.research.industry}` : "",
      input.workflow.research.inferredNeed ? `Likely concern: ${input.workflow.research.inferredNeed}` : "",
      input.workflow.research.recommendedAngle ? `Recommended angle: ${input.workflow.research.recommendedAngle}` : "",
      input.workflow.research.productSignals.length ? `Product signals: ${input.workflow.research.productSignals.join("; ")}` : "",
      input.workflow.research.buyingSignals.length ? `Buying signals: ${input.workflow.research.buyingSignals.join("; ")}` : "",
      input.workflow.research.brief ? formatCustomerResearchBriefForPrompt(input.workflow.research.brief) : ""
    ].filter(Boolean).join("\n") : "No workflow research available.",
    "",
    input.goldenExamplesContext ?? "",
    "",
    "--- Our company knowledge ---",
    input.companyKnowledgeContext || "No company knowledge has been added yet; stay conservative and offer a low-friction next step."
  ].join("\n");
}

async function polishOutreachDraft(input: {
  candidate: { subject: string; body: string };
  lead: OutreachLead;
  research?: CustomerResearchResult;
  brief: OutreachGenerationBrief;
  language: string;
  tone: string;
  companyKnowledgeContext: string;
  goldenExamplesContext?: string;
  runtime: RuntimeAdapter;
  provider?: HermesReplyRequest["provider"];
  model?: string;
  signatureBlock?: string;
  maxRepairAttempts?: number;
}): Promise<PolishedOutreachDraft> {
  const maxRepairAttempts = input.maxRepairAttempts ?? 4;
  const initial = finalizeCopyReadyOutreachEmail({
    subject: input.candidate.subject,
    body: input.candidate.body,
    lead: input.lead,
    signatureBlock: input.signatureBlock
  });
  let best = {
    subject: initial.subject,
    body: initial.body,
    qualityReview: reviewOutreachEmail({ subject: initial.subject, body: initial.body, lead: input.lead, research: input.research }),
    repairAttempts: 0
  };
  if (best.qualityReview.passed) return best;

  for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
    const repairPrompt = buildOutreachRepairPrompt({
      subject: best.subject,
      body: best.body,
      review: best.qualityReview,
      lead: input.lead,
      research: input.research,
      brief: input.brief,
      language: input.language,
      tone: input.tone,
      companyKnowledgeContext: input.companyKnowledgeContext,
      goldenExamplesContext: input.goldenExamplesContext,
      signatureBlock: input.signatureBlock
    });
    const replyText = await input.runtime.createHermesReply({
      messages: [{ id: randomUUID(), role: "user", content: repairPrompt, createdAt: new Date().toISOString() }],
      model: input.model,
      instructions: outreachInstructions(),
      provider: input.provider,
      reasoningEffort: "medium",
      maxOutputTokens: 4096,
      responseFormat: "json_object"
    });
    const parsed = finalizeCopyReadyOutreachEmail({
      ...parseGeneratedOutreachDraft(replyText),
      lead: input.lead,
      signatureBlock: input.signatureBlock
    });
    const qualityReview = reviewOutreachEmail({ subject: parsed.subject, body: parsed.body, lead: input.lead, research: input.research });
    const repaired = { subject: parsed.subject, body: parsed.body, qualityReview, repairAttempts: attempt };
    if (qualityReview.score > best.qualityReview.score) best = repaired;
    if (qualityReview.passed) return repaired;
  }

  const fallback = finalizeCopyReadyOutreachEmail({
    ...fallbackOutreachDraftFromBrief(input.lead, input.brief),
    lead: input.lead,
    signatureBlock: input.signatureBlock
  });
  const fallbackReview = reviewOutreachEmail({ subject: fallback.subject, body: fallback.body, lead: input.lead, research: input.research });
  const fallbackBeatsWeakDraft = best.qualityReview.score < 80 && fallbackReview.score >= best.qualityReview.score;
  if ((fallbackReview.passed || fallbackBeatsWeakDraft) && !looksLikeLocalOutreachSkeleton(fallback.subject, fallback.body)) {
    return {
      subject: fallback.subject,
      body: fallback.body,
      qualityReview: fallbackReview,
      repairAttempts: maxRepairAttempts
    };
  }
  return best;
}

function buildOutreachRepairPrompt(input: {
  subject: string;
  body: string;
  review: OutreachEmailQualityReview;
  lead: OutreachLead;
  research?: CustomerResearchResult;
  brief: OutreachGenerationBrief;
  language: string;
  tone: string;
  companyKnowledgeContext: string;
  goldenExamplesContext?: string;
  signatureBlock?: string;
}): string {
  return [
    "Rewrite this B2B cold email so it passes the buyer 2-second quality gate.",
    "This is an internal repair step after automated QA failed. Do not explain the repair.",
    `Target language: ${input.language}.`,
    `Tone: ${input.tone}.`,
    "Return JSON only: {\"subject\":\"...\",\"body\":\"...\"}.",
    "",
    "Repair rules:",
    "- Keep the body 45-90 words in 2-4 compact paragraphs.",
    "- Write the customer-facing email in English only, even if the app UI or internal notes are Chinese.",
    "- The body must start with a normal greeting such as Hi [Name/team],.",
    "- The body must end with Best regards and the sender signature provided below.",
    "- First real sentence must say why this specific buyer should care and what the business implication is.",
    "- First real sentence must contain one concrete buyer evidence clue from the lead or research; do not merely say you saw their website.",
    "- Use at least two concrete buyer clues from the research across the repaired email.",
    "- Convert that evidence into the buyer's likely risk, sourcing task, category need, compliance check, or launch/replenishment context.",
    "- Use exactly one buyer-relevant USP from the private brief.",
    "- Obey the Customer decision brief. If write mode is cautious, remove confident sourcing assumptions and use a careful complementary angle.",
    "- If the buyer may be a manufacturer/OEM or peer, do not pitch as if they are a basic importer. Avoid 'we can supply you flooring' style wording.",
    "- Remove any claim that appears under Claims to avoid.",
    "- End with one low-friction micro-offer: 2-3 matched options, MOQ/lead-time table, spec/certification pack, short comparison, or A/B choices.",
    "- Never end with only 'Would you like details?', 'Are you interested?', or 'Can we have a call?'.",
    "- Never use robotic keyword CTAs like Reply 'SPC table'. Ask as a human salesperson would.",
    "- Remove generic supplier phrases, translated English, and company-first bragging.",
    "- Do not invent proof, pricing, certifications, cases, delivery promises, or fake familiarity.",
    "",
    "--- Failed draft ---",
    `Subject: ${input.subject}`,
    input.body,
    "",
    "--- QA failures ---",
    input.review.issues.length ? input.review.issues.join("\n") : input.review.summary,
    input.review.rewriteHints.length ? input.review.rewriteHints.join("\n") : "",
    "",
    formatOutreachGenerationBrief(input.brief),
    "",
    "--- Lead ---",
    [
      `Company: ${input.lead.companyName}`,
      input.lead.website ? `Website: ${input.lead.website}` : "",
      input.lead.email ? `Email: ${input.lead.email}` : "",
      input.lead.industry ? `Industry: ${input.lead.industry}` : "",
      input.lead.need ? `Need: ${input.lead.need}` : "",
      input.lead.notes ? `Notes: ${input.lead.notes}` : ""
    ].filter(Boolean).join("\n"),
    "",
    input.research ? formatCustomerResearchContext(input.research) : "--- Customer website research ---\nNo website research was available.",
    "",
    input.goldenExamplesContext ?? "",
    "",
    "--- Required sender signature ---",
    input.signatureBlock || "Best regards,",
    "",
    "--- Company knowledge ---",
    input.companyKnowledgeContext || "No company knowledge has been added yet; stay conservative."
  ].filter(Boolean).join("\n");
}

function fallbackOutreachDraftFromBrief(lead: OutreachLead, brief: OutreachGenerationBrief): { subject: string; body: string } {
  const company = lead.companyName || "your team";
  const subjectBase = cleanFallbackSubject(brief.selectedUsp.headline, brief);
  const reason = stripLeadingCompanyName(brief.buyerReason, company);
  const openingReason = buyerReasonForSentence(reason);
  const implication = fallbackBuyerImplication(brief);
  const offer = fallbackMicroOfferPhrase(brief);
  const uspHeadline = brief.selectedUsp.headline || "A small proof-backed comparison";
  const valueBridge = brief.selectedUsp.buyerAngle || brief.selectedUsp.proof || "it gives your team a clearer comparison before sampling";
  return {
    subject: truncatePlain(subjectBase || `Backup options for ${company}`, 50),
    body: [
      `I noticed ${company} ${openingReason}, so ${implication}.`,
      `${uspHeadline} may be relevant because ${lowercaseFirstBusinessPhrase(valueBridge)}.`,
      `Would a short ${offer} with 2-3 matched options be useful for a first check?`
    ].join("\n")
  };
}

function cleanFallbackSubject(value: string, brief: OutreachGenerationBrief): string {
  const clean = value
    .replace(/\bfit check\b/gi, "backup options")
    .replace(/\bproof pack\b/gi, "proof")
    .replace(/\s+/g, " ")
    .trim();
  if (clean && !/\b(this product category|matched backup options)\b/i.test(clean)) return clean;
  const reason = `${brief.buyerReason} ${brief.procurementTrigger}`;
  const productMatch = reason.match(/\b(?:Fortika\s+)?(?:SPC|LVT|luxury vinyl|vinyl plank|rigid core)(?:\s+\d+(?:\.\d+)?mm)?\b/i)?.[0];
  return productMatch ? `${productMatch} backup options` : clean;
}

function fallbackBuyerImplication(brief: OutreachGenerationBrief): string {
  const source = normalizeQualityText(`${brief.likelyPain} ${brief.procurementTrigger}`);
  if (/\blead time|delivery|quick-ship|quick ship|inventory|stock|replenish|container|truckload\b/.test(source)) {
    return "lead time and matched specs likely matter before adding another supplier";
  }
  if (/\bcertification|proof|compliance|testing|warranty\b/.test(source)) {
    return "proof and spec clarity likely matter before sampling";
  }
  if (/\bcategory|sku|range|collection|catalog|assortment\b/.test(source)) {
    return "a narrow option list is probably easier to judge than a broad catalog";
  }
  return "a small proof-backed comparison is safer than a generic supplier pitch";
}

function fallbackMicroOfferPhrase(brief: OutreachGenerationBrief): string {
  const subject = cleanFallbackSubject(brief.selectedUsp.headline, brief).replace(/\bbackup options\b/i, "backup option sheet");
  const micro = brief.microOffer.replace(/^a\s+/i, "").replace(/\s+/g, " ").trim();
  if (/moq|lead time|lead-time|spec|proof|certification/i.test(micro)) return `${subject} with ${micro}`;
  return `${subject} with MOQ, lead time, and proof notes`;
}

function stripLeadingCompanyName(value: string, companyName: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  const company = companyName.replace(/\s+/g, " ").trim();
  if (!company) return clean;
  const lower = clean.toLowerCase();
  const companyLower = company.toLowerCase();
  if (!lower.startsWith(companyLower)) return clean;
  return clean.slice(company.length).replace(/^\s*[-:|–—,，]\s*/, "").trim() || clean;
}

function lowercaseFirstBusinessPhrase(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim().replace(/[.。]+$/, "");
  if (!clean) return "may be reviewing this category";
  return `${clean[0]?.toLowerCase() ?? ""}${clean.slice(1)}`;
}

function buyerReasonForSentence(value: string): string {
  const phrase = lowercaseFirstBusinessPhrase(value);
  if (/^works around\b/.test(phrase)) return phrase.replace(/^works around\b/, "appears to handle");
  if (/^(handles|imports|distributes|sources|sells|serves|stocks|offers|manufactures|reviews|focuses|prepares)\b/.test(phrase)) {
    return phrase;
  }
  if (/^(runs|features|lists|carries|supports|promotes|uses|builds)\b/.test(phrase)) return phrase;
  if (/^(appears|seems|looks)\b/.test(phrase)) return phrase;
  if (/\b(program|quick-ship|quick ship|truckload|container|direct)\b/i.test(phrase)) return `runs ${phrase}`;
  if (/\b(range|collection|series|line|catalog|sku|spc|lvt|flooring|vinyl)\b/i.test(phrase)) return `features ${phrase}`;
  return `appears to handle ${phrase}`;
}

function buyerAngleSentence(value: string): string {
  const phrase = lowercaseFirstBusinessPhrase(value);
  if (/^helps\b/.test(phrase)) return `It ${phrase}.`;
  if (/^(keeps|reduces|gives|lets|supports|makes|cuts|saves|allows|improves)\b/.test(phrase)) {
    return `It ${phrase}.`;
  }
  return `That can help with ${phrase}.`;
}

function polishWorkflowFollowUps(input: {
  followUps: OutreachWorkflow["followUps"];
  lead: OutreachLead;
  brief: OutreachGenerationBrief;
  language: string;
  tone: string;
  signatureBlock?: string;
}): OutreachWorkflow["followUps"] {
  void input.language;
  void input.tone;
  return defaultFollowUpStrategies.map((strategy, index) => {
    const candidate = input.followUps[index];
    const normalized = candidate ? {
      ...candidate,
      id: candidate.id || `follow-up-${index + 1}`,
      step: index + 1,
      delayDays: numberField(candidate.delayDays, strategy.delayDays),
      strategy: candidate.strategy || strategy.strategy,
      subject: truncatePlain(candidate.subject || `${strategy.strategy} for ${input.lead.companyName}`, 240),
      body: truncateForContext(candidate.body || "", 20_000),
      status: "draft" as const
    } : fallbackFollowUpFromBrief(input.lead, input.brief, index, strategy);
    const copyReady = {
      ...normalized,
      ...finalizeCopyReadyOutreachEmail({
        subject: normalized.subject,
        body: normalized.body,
        lead: input.lead,
        signatureBlock: input.signatureBlock
      })
    };
    const review = reviewOutreachEmail({ subject: copyReady.subject, body: copyReady.body, lead: input.lead });
    const hasTemplatePhrase = outreachTemplatePhrases.some((phrase) => normalizeQualityText(`${copyReady.subject}\n${copyReady.body}`).includes(phrase));
    if (review.level === "blocked" || hasTemplatePhrase || countWords(copyReady.body) > 170) {
      const fallbackBase = fallbackFollowUpFromBrief(input.lead, input.brief, index, strategy);
      const fallback = {
        ...fallbackBase,
        ...finalizeCopyReadyOutreachEmail({
          subject: fallbackBase.subject,
          body: fallbackBase.body,
          lead: input.lead,
          signatureBlock: input.signatureBlock
        })
      };
      return {
        ...fallback,
        qualityReview: reviewOutreachEmail({ subject: fallback.subject, body: fallback.body, lead: input.lead })
      };
    }
    return { ...copyReady, qualityReview: review };
  });
}

function fallbackFollowUpFromBrief(
  lead: OutreachLead,
  brief: OutreachGenerationBrief,
  index: number,
  strategy: { delayDays: number; strategy: string }
): OutreachWorkflow["followUps"][number] {
  const company = lead.companyName || "your team";
  const subject = index === 7 ? `Close the loop on ${truncatePlain(company, 28)}` : truncatePlain(`${strategy.strategy}: ${brief.selectedUsp.headline}`, 58);
  const lines = [
    `A quick note on ${company} and ${lowercaseFirstBusinessPhrase(brief.procurementTrigger)}.`,
    `${brief.selectedUsp.headline} may be worth a quick look because ${lowercaseFirstBusinessPhrase(brief.likelyPain)}.`,
    index === 2
      ? `Should I send a short option pack with ${brief.microOffer}, or is someone else better for this?`
      : `Would a short option pack with ${brief.microOffer} be worth a look?`
  ];
  if (index === 7) {
    lines[2] = "If this is not relevant, I can close the loop here.";
  }
  return EmailSequenceDraftSchema.parse({
    id: `follow-up-${index + 1}`,
    step: index + 1,
    delayDays: strategy.delayDays,
    strategy: strategy.strategy,
    subject,
    body: lines.join("\n"),
    status: "draft"
  });
}

async function skipOutreachCampaignRecipient(
  campaignId: string,
  recipientId: string,
  campaigns: OutreachCampaignRepository,
  drafts: OutreachDraftRepository
): Promise<OutreachCampaignWithRecipients> {
  const detail = await campaigns.requireWithRecipients(campaignId, drafts);
  const recipient = detail.recipients.find((item) => item.id === recipientId);
  if (!recipient) throw new ClientInputError(`Campaign recipient not found: ${recipientId}`);
  if (recipient.status === "sent") throw new ClientInputError("Sent recipients cannot be skipped.");
  await campaigns.updateRecipient(recipient.id, { status: "skipped", skippedAt: new Date().toISOString(), sendError: undefined });
  const refreshed = await campaigns.requireWithRecipients(campaignId, drafts);
  await campaigns.updateCampaign(campaignId, { status: nextCampaignStatus(refreshed) });
  return campaigns.requireWithRecipients(campaignId, drafts);
}

async function sendOutreachCampaignBatch(input: {
  campaignId: string;
  senderAccountId: string;
  leads: OutreachLeadRepository;
  drafts: OutreachDraftRepository;
  senders: OutreachSenderRepository;
  campaigns: OutreachCampaignRepository;
  companyProfile: CompanyProfileRepository;
  materials: MaterialRepository;
  assets: OutreachAssetRepository;
  emailSignature: OutreachEmailSignatureRepository;
}): Promise<OutreachCampaignWithRecipients> {
  const campaign = await input.campaigns.require(input.campaignId);
  if (campaign.status === "stopped") throw new ClientInputError("Stopped campaigns cannot be sent.");
  const sender = await input.senders.require(input.senderAccountId);
  if (sender.profileId !== campaign.profileId) throw new ClientInputError("Sender account belongs to another profile.");
  if (!sender.deliveryConfirmedAt) throw new ClientInputError("Confirm the sender mailbox before sending outreach.");
  const detail = await input.campaigns.requireWithRecipients(campaign.id, input.drafts);
  const candidates = detail.recipients.filter((recipient) => ["approved", "queued"].includes(recipient.status));
  if (!candidates.length) throw new ClientInputError("Approve at least one generated campaign draft before sending.");
  const now = new Date().toISOString();
  const [companyKnowledgeContext, ctaAssets] = await Promise.all([
    buildCompanyKnowledgeContext(input.companyProfile, input.materials),
    input.assets.listCtaAssets(campaign.profileId)
  ]);
  await input.campaigns.updateCampaign(campaign.id, {
    senderAccountId: sender.id,
    status: "sending",
    startedAt: campaign.startedAt ?? now
  });
  const limit = campaign.rateLimit.maxPerHour;
  for (const recipient of candidates.slice(0, limit)) {
    const freshCampaign = await input.campaigns.require(campaign.id);
    if (freshCampaign.status === "paused" || freshCampaign.status === "stopped") break;
    if (!recipient.initialDraftId) {
      await input.campaigns.updateRecipient(recipient.id, { status: "failed", sendError: "Recipient has no approved first email draft." });
      await input.campaigns.updateCampaign(campaign.id, { status: "failed" });
      return input.campaigns.requireWithRecipients(campaign.id, input.drafts);
    }
    await input.campaigns.updateRecipient(recipient.id, { status: "sending", queuedAt: recipient.queuedAt ?? now, sendError: undefined });
    try {
      const draft = await input.drafts.require(recipient.initialDraftId);
      const lead = await input.leads.get(recipient.leadId);
      const sent = await sendOutreachDraft({
        draft,
        sender,
        lead,
        to: recipient.email,
        senders: input.senders,
        drafts: input.drafts,
        emailSignature: input.emailSignature,
        ctaAssets,
        companyKnowledgeContext
      });
      await input.campaigns.updateRecipient(recipient.id, {
        status: "sent",
        sentAt: sent.sentAt ?? new Date().toISOString(),
        sendOutcome: sent.sendOutcome,
        learningSignal: sent.learningSignal,
        sendError: undefined
      });
    } catch (error) {
      await input.campaigns.updateRecipient(recipient.id, {
        status: "failed",
        sendOutcome: buildOutreachSendOutcome({
          status: "failed",
          sender,
          notes: redactSecrets(error instanceof Error ? error.message : String(error))
        }),
        sendError: redactSecrets(error instanceof Error ? error.message : String(error))
      });
      await input.campaigns.updateCampaign(campaign.id, { status: "failed" });
      return input.campaigns.requireWithRecipients(campaign.id, input.drafts);
    }
  }
  const refreshed = await input.campaigns.requireWithRecipients(campaign.id, input.drafts);
  await input.campaigns.updateCampaign(campaign.id, { status: nextCampaignStatus(refreshed) });
  return input.campaigns.requireWithRecipients(campaign.id, input.drafts);
}

async function scheduleOutreachFollowUps(input: {
  campaignId: string;
  senderAccountId: string;
  mode: "confirm" | "auto";
  drafts: OutreachDraftRepository;
  workflows: OutreachWorkflowRepository;
  followUps: OutreachFollowUpRepository;
  campaigns: OutreachCampaignRepository;
}): Promise<{ created: number; jobs: OutreachFollowUpJob[]; stats: Awaited<ReturnType<OutreachFollowUpRepository["stats"]>> }> {
  const campaign = await input.campaigns.require(input.campaignId);
  if (campaign.status === "stopped") throw new ClientInputError("Stopped campaigns cannot schedule follow-ups.");
  const detail = await input.campaigns.requireWithRecipients(input.campaignId, input.drafts);
  const now = new Date().toISOString();
  const jobs: OutreachFollowUpJob[] = [];
  for (const recipient of detail.recipients) {
    if (recipient.status !== "sent" || !recipient.workflowId || !recipient.sentAt) continue;
    const workflow = await input.workflows.get(recipient.workflowId);
    if (!workflow) continue;
    let cumulativeDelay = 0;
    for (const email of workflow.followUps) {
      if (!email.draftId) continue;
      cumulativeDelay += Math.max(1, email.delayDays || defaultFollowUpStrategies[email.step - 1]?.delayDays || 1);
      const sendAt = new Date(new Date(recipient.sentAt).getTime() + cumulativeDelay * 24 * 60 * 60 * 1000).toISOString();
      jobs.push(OutreachFollowUpJobSchema.parse({
        id: randomUUID(),
        profileId: campaign.profileId,
        campaignId: campaign.id,
        recipientId: recipient.id,
        leadId: recipient.leadId,
        workflowId: workflow.id,
        draftId: email.draftId,
        senderAccountId: input.senderAccountId,
        step: email.step,
        mode: input.mode,
        status: "scheduled",
        email: recipient.email,
        companyName: recipient.companyName,
        subject: email.subject,
        body: email.body,
        sendAt,
        createdAt: now,
        updatedAt: now
      }));
    }
  }
  const created = await input.followUps.createMany(jobs);
  return { created: created.length, jobs: await input.followUps.list({ campaignId: input.campaignId }), stats: await input.followUps.stats({ campaignId: input.campaignId }) };
}

async function tickOutreachFollowUps(input: {
  now: string;
  limit: number;
  senders: OutreachSenderRepository;
  drafts: OutreachDraftRepository;
  leads: OutreachLeadRepository;
  campaigns: OutreachCampaignRepository;
  followUps: OutreachFollowUpRepository;
  companyProfile: CompanyProfileRepository;
  materials: MaterialRepository;
  assets: OutreachAssetRepository;
  emailSignature: OutreachEmailSignatureRepository;
}): Promise<{ processed: number; sent: number; ready: number; failed: number; stopped: number }> {
  const due = await input.followUps.due(input.now, input.limit);
  const result = { processed: 0, sent: 0, ready: 0, failed: 0, stopped: 0 };
  const companyKnowledgeContext = await buildCompanyKnowledgeContext(input.companyProfile, input.materials);
  for (const job of due) {
    result.processed += 1;
    const campaign = await input.campaigns.requireWithRecipients(job.campaignId, input.drafts);
    const recipient = campaign.recipients.find((item) => item.id === job.recipientId);
    if (!recipient || ["replied", "bounced", "unsubscribed", "stopped", "skipped", "failed"].includes(recipient.status)) {
      await input.followUps.update(job.id, { status: "stopped", stoppedAt: input.now, stopReason: "Customer is no longer active for follow-up." });
      result.stopped += 1;
      continue;
    }
    if (job.mode === "confirm") {
      await input.followUps.update(job.id, { status: "ready", readyAt: input.now });
      result.ready += 1;
      continue;
    }
    await input.followUps.update(job.id, { status: "sending" });
    try {
      const sender = await input.senders.require(job.senderAccountId);
      const draft = await input.drafts.require(job.draftId);
      const lead = await input.leads.get(job.leadId);
      const sent = await sendOutreachDraft({
        draft,
        sender,
        lead,
        to: job.email,
        senders: input.senders,
        drafts: input.drafts,
        emailSignature: input.emailSignature,
        ctaAssets: await input.assets.listCtaAssets(job.profileId),
        companyKnowledgeContext
      });
      await input.followUps.update(job.id, { status: "sent", sentAt: sent.sentAt ?? new Date().toISOString(), sendError: undefined });
      result.sent += 1;
    } catch (error) {
      const message = redactSecrets(error instanceof Error ? error.message : String(error));
      await input.followUps.update(job.id, { status: "failed", sendError: message });
      result.failed += 1;
    }
  }
  return result;
}

type InferredImapSettings = {
  host?: string;
  port?: number;
  secure?: boolean;
};

type OutreachSmtpDefaults = {
  host: string;
  port: number;
  secure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
};

const OUTREACH_SMTP_DEFAULTS: Record<"tencent" | "aliyun", OutreachSmtpDefaults> = {
  tencent: {
    host: "smtp.exmail.qq.com",
    port: 465,
    secure: true,
    imapHost: "imap.exmail.qq.com",
    imapPort: 993,
    imapSecure: true
  },
  aliyun: {
    host: "smtp.mxhichina.com",
    port: 465,
    secure: true,
    imapHost: "imap.mxhichina.com",
    imapPort: 993,
    imapSecure: true
  }
};

const OUTREACH_SERVICE_API_DEFAULTS: Record<string, { apiBaseUrl?: string; label: string }> = {
  tencent: { label: "Tencent Cloud Email service" },
  aliyun: { label: "Alibaba Cloud DirectMail" },
  custom: { label: "Custom HTTP mail API" },
  "custom-service-api": { label: "Custom HTTP mail API" },
  "custom-http": { label: "Custom HTTP mail API" }
};

type CreateOutreachSenderInput = z.infer<typeof CreateOutreachSenderBody> & { profileId: string };
type UpdateOutreachSenderInput = z.infer<typeof UpdateOutreachSenderBody>;
type OutreachSenderApiCredentialInput = z.infer<typeof OutreachSenderApiCredentialBody>;

function normalizeOutreachSenderCreateInput(input: CreateOutreachSenderInput): CreateOutreachSenderInput & {
  provider: string;
  sendChannel: OutreachSenderAccount["sendChannel"];
  port: number;
  secure: boolean;
} {
  const sendChannel = input.sendChannel ?? "smtp";
  const provider = canonicalOutreachSenderProvider(input.provider ?? inferOutreachSenderProvider(input, sendChannel));
  const smtpDefaults = inferOutreachSmtpDefaults({ provider, email: input.email, host: input.host });
  const host = input.host ?? (sendChannel === "smtp" ? smtpDefaults?.host : undefined);
  return {
    ...input,
    provider,
    sendChannel,
    host,
    port: input.port ?? (sendChannel === "smtp" ? smtpDefaults?.port ?? 587 : 587),
    secure: input.secure ?? (sendChannel === "smtp" ? smtpDefaults?.secure ?? false : false),
    serviceApi: normalizeServiceApiCredentialInput(provider, sendChannel, input.serviceApi)
  };
}

function normalizeOutreachSenderUpdateInput(current: OutreachSenderAccount, input: UpdateOutreachSenderInput): Omit<OutreachSenderAccount, "id" | "profileId" | "passwordRef" | "passwordPreview" | "oauthApi" | "serviceApi" | "createdAt" | "updatedAt"> & {
  oauthApi?: OutreachSenderApiCredentialInput | null;
  serviceApi?: OutreachSenderApiCredentialInput | null;
} {
  const sendChannel = input.sendChannel ?? current.sendChannel ?? "smtp";
  const provider = canonicalOutreachSenderProvider(input.provider === null ? "custom" : input.provider ?? current.provider ?? inferOutreachSenderProvider({ ...current, ...input }, sendChannel));
  const requestedHost = input.host === null ? undefined : input.host ?? current.host;
  const smtpDefaults = inferOutreachSmtpDefaults({ provider, email: input.email ?? current.email, host: requestedHost });
  const host = requestedHost ?? (sendChannel === "smtp" ? smtpDefaults?.host : undefined);
  const shouldApplyProviderDefaults = sendChannel === "smtp" && Boolean(smtpDefaults) && (!current.host?.trim() || input.host === null || input.provider !== undefined);
  const port = input.port ?? (shouldApplyProviderDefaults ? smtpDefaults?.port : current.port) ?? 587;
  const secure = input.secure ?? (shouldApplyProviderDefaults ? smtpDefaults?.secure : current.secure) ?? false;
  const imap = inferImapSettings({ ...current, ...input, host, port, secure, email: input.email ?? current.email });
  return {
    label: input.label ?? current.label,
    provider,
    sendChannel,
    fromName: input.fromName === null ? undefined : input.fromName ?? current.fromName,
    email: input.email ?? current.email,
    host,
    port,
    secure,
    imapHost: input.imapHost === null ? undefined : input.imapHost ?? current.imapHost ?? imap.host,
    imapPort: input.imapPort === null ? undefined : input.imapPort ?? current.imapPort ?? imap.port,
    imapSecure: input.imapSecure === null ? undefined : input.imapSecure ?? current.imapSecure ?? imap.secure,
    imapUsername: input.imapUsername === null ? undefined : input.imapUsername ?? current.imapUsername ?? input.username ?? current.username ?? input.email ?? current.email,
    username: input.username === null ? undefined : input.username ?? current.username,
    oauthApi: input.oauthApi,
    serviceApi: input.serviceApi === null ? null : normalizeServiceApiCredentialInput(provider, sendChannel, input.serviceApi),
    enabled: input.enabled ?? current.enabled
  };
}

function normalizeServiceApiCredentialInput(
  provider: string,
  sendChannel: OutreachSenderAccount["sendChannel"],
  input: OutreachSenderApiCredentialInput | undefined
): OutreachSenderApiCredentialInput | undefined {
  if (sendChannel !== "service-api") return input;
  const defaults = OUTREACH_SERVICE_API_DEFAULTS[canonicalOutreachSenderProvider(provider)];
  if (!input) return undefined;
  return {
    ...input,
    apiBaseUrl: input.apiBaseUrl ?? defaults?.apiBaseUrl
  };
}

function inferOutreachSmtpDefaults(input: { provider?: string | null; email?: string | null; host?: string | null }): OutreachSmtpDefaults | undefined {
  const provider = canonicalOutreachSenderProvider(input.provider);
  if (provider === "tencent" || provider === "aliyun") return OUTREACH_SMTP_DEFAULTS[provider];
  const emailDomain = input.email?.split("@")[1]?.trim().toLowerCase() ?? "";
  const host = input.host?.trim().toLowerCase() ?? "";
  const target = `${emailDomain} ${host}`;
  if (/(^|\.)exmail\.qq\.com\b|smtp\.exmail\.qq\.com/.test(target)) return OUTREACH_SMTP_DEFAULTS.tencent;
  if (/aliyun|mxhichina/.test(target)) return OUTREACH_SMTP_DEFAULTS.aliyun;
  return undefined;
}

function canonicalOutreachSenderProvider(value?: string | null): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "custom";
  if (["tencent", "tencent-exmail", "qq-exmail", "exmail", "tencent-cloud", "tencent-cloud-ses", "qq"].includes(normalized)) return "tencent";
  if (["aliyun", "ali", "alibaba", "alibaba-mail", "alimail", "aliyun-mail", "aliyun-directmail", "mxhichina"].includes(normalized)) return "aliyun";
  if (["custom-http", "http-api", "custom-service-api", "service-api"].includes(normalized)) return "custom";
  return normalized;
}

function inferOutreachSenderProvider(input: {
  provider?: string | null;
  sendChannel?: OutreachSenderAccount["sendChannel"] | null;
  email?: string | null;
  host?: string | null;
}, sendChannel: OutreachSenderAccount["sendChannel"] = input.sendChannel ?? "smtp"): string {
  const explicit = input.provider?.trim();
  if (explicit) return canonicalOutreachSenderProvider(explicit);
  const emailDomain = input.email?.split("@")[1]?.trim().toLowerCase() ?? "";
  const host = input.host?.trim().toLowerCase() ?? "";
  const target = `${emailDomain} ${host}`;
  if (/(^|\.)gmail\.com\b|smtp\.gmail\.com/.test(target)) return "gmail";
  if (/(^|\.)outlook\.com\b|(^|\.)hotmail\.com\b|office365|microsoft/.test(target)) return "outlook";
  if (/(^|\.)qq\.com\b|exmail\.qq\.com/.test(target)) return "tencent";
  if (/aliyun|mxhichina/.test(target)) return "aliyun";
  if (/zoho/.test(target)) return "zoho";
  if (sendChannel === "oauth-api") return "custom-oauth-api";
  if (sendChannel === "service-api") return "custom";
  return "custom";
}

function assertSenderTransportBasics(input: { provider?: string; sendChannel: OutreachSenderAccount["sendChannel"]; host?: string | null }): void {
  if (!input.provider?.trim()) throw new ClientInputError("Sender provider is required.");
  if (input.sendChannel === "smtp" && !input.host?.trim()) throw new ClientInputError("SMTP host is required for SMTP sender accounts.");
}

function transportReadyMessage(selection: OutreachSenderTransportSelection): string {
  if (selection.sendChannel === "smtp") return "SMTP connection is ready.";
  if (selection.sendChannel === "oauth-api") return `${selection.provider} OAuth API transport is ready.`;
  return `${selection.provider} service API transport is ready.`;
}

type InboxHeader = {
  raw: string;
  from?: string;
  fromEmail?: string;
  subject?: string;
  date?: string;
};

type OutreachInboxMatch = {
  campaignId: string;
  recipientId: string;
  leadId: string;
  email: string;
  companyName: string;
  type: "replied" | "bounced" | "unsubscribed";
  subject?: string;
  from?: string;
  at: string;
  reason: string;
};

async function checkOutreachInbox(input: {
  sender: OutreachSenderAccount;
  campaignId?: string;
  senders: OutreachSenderRepository;
  drafts: OutreachDraftRepository;
  campaigns: OutreachCampaignRepository;
  followUps: OutreachFollowUpRepository;
}): Promise<{ ok: boolean; status: "ready" | "unsupported" | "failed"; message: string; sender: PublicOutreachSenderAccount; matched: OutreachInboxMatch[]; stopped: number }> {
  const password = await input.senders.readPassword(input.sender);
  if (!input.sender.imapHost || !password) {
    const next = await input.senders.updateInboxState(input.sender.id, {
      status: "unsupported",
      message: "This mailbox needs IMAP host and password before replies can be checked."
    });
    return { ok: false, status: "unsupported", message: next.lastInboxCheckMessage ?? "", sender: publicOutreachSender(next), matched: [], stopped: 0 };
  }
  const campaigns = input.campaignId
    ? [await input.campaigns.requireWithRecipients(input.campaignId, input.drafts)]
    : await input.campaigns.listWithRecipients({ profileId: input.sender.profileId }, input.drafts);
  const candidates = campaigns.flatMap((campaign) => campaign.recipients
    .filter((recipient) => recipient.status === "sent")
    .map((recipient) => ({
      campaignId: campaign.id,
      recipientId: recipient.id,
      leadId: recipient.leadId,
      email: recipient.email,
      companyName: recipient.companyName,
      initialDraftId: recipient.initialDraftId,
      sentAt: recipient.sentAt,
      sendOutcome: recipient.sendOutcome,
      learningSignal: recipient.learningSignal
    })));
  if (!candidates.length) {
    const next = await input.senders.updateInboxState(input.sender.id, {
      status: "ready",
      message: "No sent customers need reply checking yet."
    });
    return { ok: true, status: "ready", message: next.lastInboxCheckMessage ?? "", sender: publicOutreachSender(next), matched: [], stopped: 0 };
  }
  try {
    const headers = await scanImapTargetedReplyHeaders(input.sender, password, candidates);
    const matched = matchOutreachInboxHeaders(headers, candidates);
    let stopped = 0;
    const seenRecipients = new Set<string>();
    for (const match of matched) {
      if (seenRecipients.has(match.recipientId)) continue;
      seenRecipients.add(match.recipientId);
      const timestamp = match.at;
      const candidate = candidates.find((item) => item.recipientId === match.recipientId);
      const replyOutcome = match.type === "replied" ? "positive" : match.type === "bounced" ? "bounce" : "unsubscribe";
      const sendOutcome = buildOutreachSendOutcome({
        status: match.type,
        sender: input.sender,
        sentAt: candidate?.sentAt,
        repliedAt: match.type === "replied" ? timestamp : undefined,
        bouncedAt: match.type === "bounced" ? timestamp : undefined,
        unsubscribedAt: match.type === "unsubscribed" ? timestamp : undefined,
        notes: match.reason
      });
      const learningSignal = OutreachLearningSignalSchema.parse({
        ...(candidate?.learningSignal ?? {}),
        replyOutcome,
        replyContent: truncatePlain([match.subject, match.from].filter(Boolean).join(" | "), 8000),
        recordedAt: timestamp
      });
      await input.campaigns.updateRecipient(match.recipientId, {
        status: match.type,
        repliedAt: match.type === "replied" ? timestamp : undefined,
        bouncedAt: match.type === "bounced" ? timestamp : undefined,
        unsubscribedAt: match.type === "unsubscribed" ? timestamp : undefined,
        lastInboxEventAt: timestamp,
        stopReason: match.reason,
        sendOutcome,
        learningSignal,
        sendError: undefined
      });
      if (candidate?.initialDraftId) {
        await input.drafts.update(candidate.initialDraftId, {
          sendOutcome,
          learningSignal
        }).catch(() => undefined);
      }
      stopped += await input.followUps.stopByRecipient(match.recipientId, match.reason);
    }
    const message = matched.length
      ? `Checked inbox and stopped follow-ups for ${seenRecipients.size} customer${seenRecipients.size === 1 ? "" : "s"}.`
      : "Checked the sent-customer mailboxes. No customer replies were found.";
    const next = await input.senders.updateInboxState(input.sender.id, { status: "ready", message });
    return { ok: true, status: "ready", message, sender: publicOutreachSender(next), matched, stopped };
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    const next = await input.senders.updateInboxState(input.sender.id, { status: "failed", message });
    return { ok: false, status: "failed", message, sender: publicOutreachSender(next), matched: [], stopped: 0 };
  }
}

function inferImapSettings(input: {
  email?: string | null;
  provider?: string | null;
  sendChannel?: OutreachSenderAccount["sendChannel"] | null;
  host?: string | null;
  port?: number | null;
  secure?: boolean | null;
  imapHost?: string | null;
  imapPort?: number | null;
  imapSecure?: boolean | null;
}): InferredImapSettings {
  if (input.imapHost) return { host: input.imapHost, port: input.imapPort ?? 993, secure: input.imapSecure ?? true };
  const emailDomain = input.email?.split("@")[1]?.trim().toLowerCase() ?? "";
  const smtpHost = input.host?.trim().toLowerCase() ?? "";
  const providerNeedles: Array<{ match: RegExp; host: string }> = [
    { match: /(^|\.)gmail\.com$/, host: "imap.gmail.com" },
    { match: /(^|\.)googlemail\.com$/, host: "imap.gmail.com" },
    { match: /(^|\.)outlook\.com$|(^|\.)hotmail\.com$|(^|\.)office365\.com$|(^|\.)microsoft\.com$/, host: "outlook.office365.com" },
    { match: /(^|\.)exmail\.qq\.com$/, host: "imap.exmail.qq.com" },
    { match: /(^|\.)qq\.com$/, host: "imap.qq.com" },
    { match: /(^|\.)aliyun\.com$|(^|\.)aliyun-inc\.com$|(^|\.)mxhichina\.com$/, host: "imap.mxhichina.com" },
    { match: /(^|\.)zoho\.com$|(^|\.)zohomail\.com$/, host: "imap.zoho.com" }
  ];
  const matchTarget = `${emailDomain} ${smtpHost}`;
  const preset = providerNeedles.find((provider) => provider.match.test(emailDomain) || provider.match.test(smtpHost) || provider.match.test(matchTarget));
  if (preset) return { host: preset.host, port: 993, secure: true };
  if (smtpHost.startsWith("smtp.")) return { host: `imap.${smtpHost.slice(5)}`, port: 993, secure: true };
  if (smtpHost.includes(".smtp.")) return { host: smtpHost.replace(".smtp.", ".imap."), port: 993, secure: true };
  return { host: input.imapHost ?? undefined, port: input.imapPort ?? 993, secure: input.imapSecure ?? true };
}

function followUpJobKey(job: Pick<OutreachFollowUpJob, "campaignId" | "recipientId" | "draftId" | "step">): string {
  return `${job.campaignId}:${job.recipientId}:${job.step}:${job.draftId}`;
}

async function scanImapTargetedReplyHeaders(
  sender: OutreachSenderAccount,
  password: string,
  candidates: Array<{ email: string; sentAt?: string }>
): Promise<InboxHeader[]> {
  const socket = await connectImapSocket(sender);
  try {
    await readImapGreeting(socket);
    await imapCommand(socket, "A1", `LOGIN ${imapQuote(sender.imapUsername ?? sender.username ?? sender.email)} ${imapQuote(password)}`);
    await imapCommand(socket, "A2", "SELECT INBOX");
    const headers: InboxHeader[] = [];
    const seenUids = new Set<string>();
    const targets = uniqueInboxReplyTargets(candidates);
    let tag = 3;
    for (const target of targets) {
      const from = target.email.trim().toLowerCase();
      if (!from) continue;
      const since = imapSinceDateForSentAt(target.sentAt);
      const search = await imapCommand(socket, `A${tag++}`, `UID SEARCH FROM ${imapQuote(from)} SINCE ${since}`);
      const uids = parseImapSearchUids(search)
        .filter((uid) => !seenUids.has(uid))
        .slice(-20);
      for (const uid of uids) seenUids.add(uid);
      if (!uids.length) continue;
      const fetch = await imapCommand(socket, `A${tag++}`, `UID FETCH ${uids.join(",")} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`);
      headers.push(...parseImapHeaders(fetch));
    }
    return headers;
  } finally {
    try {
      await imapCommand(socket, "A9", "LOGOUT");
    } catch {
      // Ignore logout failures; the inbox check result already came from earlier commands.
    }
    socket.end();
    socket.destroy();
  }
}

function uniqueInboxReplyTargets(candidates: Array<{ email: string; sentAt?: string }>): Array<{ email: string; sentAt?: string }> {
  const byEmail = new Map<string, { email: string; sentAt?: string }>();
  for (const candidate of candidates) {
    const email = candidate.email.trim().toLowerCase();
    if (!email) continue;
    const existing = byEmail.get(email);
    if (!existing || earlierIso(candidate.sentAt, existing.sentAt)) {
      byEmail.set(email, { email, sentAt: candidate.sentAt });
    }
  }
  return Array.from(byEmail.values());
}

function earlierIso(left?: string, right?: string): boolean {
  const leftTime = left ? Date.parse(left) : Number.NaN;
  const rightTime = right ? Date.parse(right) : Number.NaN;
  if (!Number.isFinite(leftTime)) return false;
  if (!Number.isFinite(rightTime)) return true;
  return leftTime < rightTime;
}

function connectImapSocket(sender: OutreachSenderAccount): Promise<net.Socket | tls.TLSSocket> {
  const host = sender.imapHost;
  if (!host) throw new ClientInputError("IMAP host is missing.");
  const port = sender.imapPort ?? 993;
  const secure = sender.imapSecure ?? true;
  return new Promise((resolve, reject) => {
    let socket: net.Socket | tls.TLSSocket | undefined;
    const timeout = setTimeout(() => {
      socket?.destroy();
      reject(new Error("IMAP connection timed out."));
    }, 10_000);
    const onReady = () => {
      clearTimeout(timeout);
      if (!socket) {
        reject(new Error("IMAP socket was not created."));
        return;
      }
      socket.setEncoding("utf8");
      resolve(socket);
    };
    socket = secure
      ? tls.connect({ host, port, servername: host }, onReady)
      : net.connect({ host, port }, onReady);
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function readImapGreeting(socket: net.Socket | tls.TLSSocket): Promise<string> {
  return readImapUntil(socket, /\* OK/i, 10_000);
}

function imapCommand(socket: net.Socket | tls.TLSSocket, tag: string, command: string): Promise<string> {
  socket.write(`${tag} ${command}\r\n`);
  return readImapUntil(socket, new RegExp(`(?:^|\\r?\\n)${tag} (OK|NO|BAD)`, "i"), 15_000).then((response) => {
    if (new RegExp(`(?:^|\\r?\\n)${tag} (NO|BAD)`, "i").test(response)) {
      throw new Error(redactSecrets(response.split(/\r?\n/).find((line) => line.startsWith(tag)) ?? "IMAP command failed."));
    }
    return response;
  });
}

function readImapUntil(socket: net.Socket | tls.TLSSocket, pattern: RegExp, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => finish(undefined, new Error("IMAP server did not respond in time.")), timeoutMs);
    const onData = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (pattern.test(output)) finish(output);
    };
    const onError = (error: Error) => finish(undefined, error);
    const finish = (value?: string, error?: Error) => {
      clearTimeout(timeout);
      socket.off("data", onData);
      socket.off("error", onError);
      if (error) reject(error);
      else resolve(value ?? output);
    };
    socket.on("data", onData);
    socket.once("error", onError);
  });
}

function imapQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function imapSinceDate(daysBack: number): string {
  return formatImapDate(new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000));
}

function imapSinceDateForSentAt(sentAt?: string): string {
  const fallback = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const sentTime = sentAt ? Date.parse(sentAt) : Number.NaN;
  if (!Number.isFinite(sentTime)) return formatImapDate(fallback);
  const dayBeforeSent = new Date(sentTime - 24 * 60 * 60 * 1000);
  const notBeforeSentOrWindow = dayBeforeSent.getTime() < fallback.getTime() ? fallback : dayBeforeSent;
  return formatImapDate(notBeforeSentOrWindow);
}

function formatImapDate(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getUTCDate()}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

function parseImapSearchUids(response: string): string[] {
  const line = response.split(/\r?\n/).find((item) => /^\* SEARCH/i.test(item)) ?? "";
  return line.replace(/^\* SEARCH\s*/i, "").trim().split(/\s+/).filter((uid) => /^\d+$/.test(uid));
}

function parseImapHeaders(response: string): InboxHeader[] {
  const chunks = response
    .split(/\r?\n\* \d+ FETCH/gi)
    .map((chunk) => chunk.replace(/\r?\n[ \t]+/g, " ").trim())
    .filter((chunk) => /^from:/im.test(chunk) || /^subject:/im.test(chunk));
  return chunks.map((raw) => {
    const from = raw.match(/^from:\s*(.+)$/im)?.[1]?.trim();
    const subject = raw.match(/^subject:\s*(.+)$/im)?.[1]?.trim();
    const date = raw.match(/^date:\s*(.+)$/im)?.[1]?.trim();
    return {
      raw,
      from,
      fromEmail: extractEmailAddress(from ?? ""),
      subject,
      date
    };
  });
}

function matchOutreachInboxHeaders(
  headers: InboxHeader[],
  candidates: Array<{ campaignId: string; recipientId: string; leadId: string; email: string; companyName: string }>
): OutreachInboxMatch[] {
  const matches: OutreachInboxMatch[] = [];
  for (const header of headers) {
    const lower = `${header.raw} ${header.from ?? ""} ${header.subject ?? ""}`.toLowerCase();
    const type = classifyInboxHeader(header, lower);
    const candidate = candidates.find((item) => {
      const email = item.email.toLowerCase();
      return header.fromEmail?.toLowerCase() === email || lower.includes(email);
    });
    if (!candidate || !type) continue;
    matches.push({
      ...candidate,
      type,
      subject: header.subject,
      from: header.from,
      at: parseInboxHeaderDate(header.date),
      reason: inboxStopReason(type, header.subject)
    });
  }
  return matches.sort((a, b) => b.at.localeCompare(a.at));
}

function classifyInboxHeader(header: InboxHeader, lower: string): OutreachInboxMatch["type"] | undefined {
  if (/(mailer-daemon|postmaster|delivery status|undeliverable|returned mail|failure notice|delivery failed|无法送达|退信)/i.test(lower)) return "bounced";
  if (/(unsubscribe|unsubscribed|退订|取消订阅)/i.test(lower)) return "unsubscribed";
  return header.fromEmail ? "replied" : undefined;
}

function extractEmailAddress(value: string): string | undefined {
  return value.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] ?? value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function parseInboxHeaderDate(value?: string): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function inboxStopReason(type: OutreachInboxMatch["type"], subject?: string): string {
  const suffix = subject ? ` Subject: ${truncatePlain(subject, 120)}` : "";
  if (type === "bounced") return `Mailbox reported a bounce.${suffix}`;
  if (type === "unsubscribed") return `Customer requested unsubscribe.${suffix}`;
  return `Customer replied.${suffix}`;
}

async function stopOutreachCampaign(
  campaignId: string,
  campaigns: OutreachCampaignRepository,
  drafts: OutreachDraftRepository
): Promise<void> {
  const detail = await campaigns.requireWithRecipients(campaignId, drafts);
  const now = new Date().toISOString();
  for (const recipient of detail.recipients) {
    if (!["sent", "skipped"].includes(recipient.status)) {
      await campaigns.updateRecipient(recipient.id, { status: "skipped", skippedAt: now, sendError: undefined });
    }
  }
  await campaigns.updateCampaign(campaignId, { status: "stopped", stoppedAt: now });
}

function nextCampaignStatus(campaign: OutreachCampaignWithRecipients): OutreachCampaign["status"] {
  const recipients = campaign.recipients;
  if (!recipients.length) return "draft";
  if (recipients.some((recipient) => recipient.status === "sending")) return "sending";
  if (recipients.some((recipient) => recipient.status === "failed") && !recipients.some((recipient) => ["pending", "researching", "generated", "approved", "queued"].includes(recipient.status))) return "failed";
  if (recipients.every((recipient) => isTerminalCampaignRecipientStatus(recipient.status))) return "completed";
  if (recipients.some((recipient) => ["generated", "approved", "queued", "sent"].includes(recipient.status))) return "ready";
  if (recipients.some((recipient) => recipient.status === "researching")) return "generating";
  return "draft";
}

function isTerminalCampaignRecipientStatus(status: OutreachCampaignRecipient["status"]): boolean {
  return ["sent", "skipped", "failed", "replied", "bounced", "unsubscribed", "stopped"].includes(status);
}

async function resolveGenerationProvider(providerId: string | undefined, providers: ProviderRepository): Promise<ProviderCredential | undefined> {
  if (providerId) {
    const provider = await providers.get(providerId);
    if (!provider) throw new ClientInputError(`Provider not found: ${providerId}`);
    return provider;
  }
  return (await providers.list()).find((provider) => provider.enabled && (provider.kind === "local" || Boolean(provider.credentialRef)));
}

function resolveOutreachModel(requestedModel: string | undefined, provider?: ProviderCredential): string | undefined {
  const explicit = requestedModel?.trim();
  if (explicit) return explicit;
  const defaultModel = provider?.defaultModel?.trim();
  if (provider?.kind === "openai" && (!defaultModel || isWeakOutreachModel(defaultModel))) return "gpt-5.5";
  return defaultModel || "hermes-agent";
}

function isWeakOutreachModel(model: string): boolean {
  return /\b(mini|nano|flash|lite)\b/i.test(model) || /^gpt-4o-mini$/i.test(model.trim()) || /^gpt-4\.1-mini$/i.test(model.trim());
}

function buildOutreachHarnessContext(input: {
  model?: string;
  goldenExamples: OutreachGoldenExample[];
  lead: OutreachLead;
  research?: CustomerResearchResult;
  outreachOs: OutreachOsContext;
  strategicBrief: OutreachGenerationBrief;
}): OutreachHarnessContext {
  const selectedExamples = selectOutreachGoldenExamples(input.goldenExamples, {
    lead: input.lead,
    research: input.research,
    brief: input.strategicBrief,
    strategy: input.outreachOs.strategyMatch
  });
  return {
    model: input.model,
    goldenExamples: selectedExamples,
    goldenExamplesContext: formatOutreachGoldenExamplesContext(selectedExamples),
    evidenceUsed: selectEvidenceUsed(input.outreachOs)
  };
}

function selectOutreachGoldenExamples(
  examples: OutreachGoldenExample[],
  input: {
    lead: OutreachLead;
    research?: CustomerResearchResult;
    brief: OutreachGenerationBrief;
    strategy: OutreachStrategyMatch;
  },
  limit = 3
): OutreachGoldenExample[] {
  const target = normalizeQualityText([
    input.lead.companyName,
    input.lead.industry,
    input.lead.need,
    input.research?.industry,
    input.research?.buyerType,
    input.research?.inferredNeed,
    input.research?.recommendedAngle,
    input.brief.buyerSegment,
    input.brief.buyerReason,
    input.brief.likelyPain,
    input.strategy.selectedUsp,
    input.strategy.microOffer
  ].filter(Boolean).join(" "));
  return examples
    .filter((example) => example.enabled)
    .map((example) => {
      const haystack = normalizeQualityText([
        example.title,
        example.industry,
        example.buyerType,
        example.productLine,
        example.market,
        example.subject,
        example.tags.join(" ")
      ].join(" "));
      const tokens = Array.from(new Set(haystack.split(/\s+/).filter((token) => token.length >= 4 && !commonQualityTokens.has(token))));
      const overlap = tokens.filter((token) => target.includes(token)).length;
      const qualityBonus = Math.round((example.qualityScore ?? 75) / 20);
      return { example, score: overlap * 10 + qualityBonus + (haystack.includes("spc") && target.includes("spc") ? 20 : 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.example);
}

function formatOutreachGoldenExamplesContext(examples: OutreachGoldenExample[]): string {
  if (!examples.length) return "--- Golden email examples ---\nNo approved golden examples are saved yet.";
  return [
    "--- Golden email examples ---",
    "Use these as style and quality references. Do not copy names, facts, or claims unless they also appear in the current buyer/company evidence.",
    ...examples.map((example, index) => [
      `Example ${index + 1}: ${example.title}`,
      example.industry ? `Industry: ${example.industry}` : "",
      example.buyerType ? `Buyer type: ${example.buyerType}` : "",
      example.productLine ? `Product line: ${example.productLine}` : "",
      example.market ? `Market: ${example.market}` : "",
      `Subject: ${example.subject}`,
      truncateForContext(example.body, 1800)
    ].filter(Boolean).join("\n"))
  ].join("\n\n");
}

function selectEvidenceUsed(outreachOs: OutreachOsContext): OutreachEvidenceItem[] {
  const wanted = new Set(outreachOs.strategyMatch.evidenceIds);
  const all = [
    ...outreachOs.evidenceMap.verifiedFacts,
    ...outreachOs.evidenceMap.inferredInsights,
    ...outreachOs.evidenceMap.genericContext
  ];
  const selected = all.filter((item) => wanted.has(item.id)).slice(0, 8);
  return (selected.length ? selected : all.slice(0, 6)).map((item) => ({ ...item, usedInEmail: wanted.has(item.id) || item.usedInEmail }));
}

function summarizeHarnessGeneration(input: {
  research?: CustomerResearchResult;
  strategy: OutreachStrategyMatch;
  matchedExamples: OutreachGoldenExample[];
  qualityReview: OutreachEmailQualityReview;
  repairAttempts: number;
}): string {
  const evidenceSource = input.research?.depth ? `${input.research.depth} research` : "lead notes";
  const examples = input.matchedExamples.length ? `${input.matchedExamples.length} golden example(s)` : "no saved golden examples";
  const brief = input.research?.brief;
  const fit = brief ? ` Customer fit: ${brief.fitVerdict}, write mode: ${brief.shouldWrite}.` : "";
  return [
    `Used ${evidenceSource}, matched angle "${truncatePlain(input.strategy.selectedUsp || input.strategy.buyerPain || "buyer-specific angle", 90)}", referenced ${examples}.${fit}`,
    `QA score ${input.qualityReview.score}/100 after ${input.repairAttempts} rewrite attempt(s).`
  ].join(" ");
}

function outreachInstructions(): string {
  return [
    "You are Hermills Outreach, a senior B2B export sales strategist writing warm emails, not generic cold blasts.",
    "Write concise, specific, reply-worthy emails for international sales. The buyer should feel the note is about their business, not the sender's factory.",
    "Privately follow this chain before writing: buyer website evidence -> buyer role/scene -> buyer risk, KPI tension, or procurement trigger -> one matching supplier USP -> one low-friction micro-offer.",
    "Write like a real export sales rep: English only, complete business email, 45-110 words, 2-5 compact paragraphs, no visible framework wording.",
    "Every customer-facing body must include greeting, customer-first opening, value bridge, low-friction CTA, Best regards, and sender signature.",
    "Do not merely decide whether the buyer is suitable. Convert the research into how to successfully develop this account with the safest angle.",
    "The first real sentence must contain a concrete buyer clue such as their product category, channel, market, project, certification, supplier-risk signal, or procurement trigger, then explain why that clue matters.",
    "Use at least two concrete clues from buyer research across the email; one must appear in the first real sentence.",
    "Never treat the buyer company name or the fact that a website exists as enough personalization.",
    "Obey the Customer decision brief when present. If write mode is cautious, do not write a normal supplier pitch; use a conservative complementary angle.",
    "If the buyer looks like a manufacturer/OEM or peer, never assume they are a basic importer. Use partnership, backup capacity, proof pack, sample-ready options, or category comparison only if supported by evidence.",
    "Never say the buyer is purchasing, sourcing, expanding, or facing a problem unless the evidence explicitly supports it; otherwise say it as a possible evaluation task.",
    "Never end with a vague ask like 'Would you like details?' or 'Are you interested?'. Offer a small next step: 2-3 options, an MOQ/lead-time table, a spec/certification pack, a short comparison, or A/B choices.",
    "Do not use robotic keyword CTAs like Reply 'SPC table'. Ask naturally, as a real salesperson would.",
    "Do not invent company strengths, certifications, prices, cases, or shipping terms.",
    "Avoid fixed skeletons such as 'I noticed [company]..., so...', 'Instead of sending a full catalog...', or 'Would A) ... or B) ... be more useful first?'. Vary the opening and CTA like a human.",
    "If evidence is missing, write conservatively and focus on a low-friction next step.",
    "Return only valid JSON with keys subject and body."
  ].join("\n");
}

function outreachFastInstructions(): string {
  return [
    "You are Hermills Outreach Fast Draft.",
    "Write one concise English B2B cold email from the supplied buyer clues and seller profile.",
    "Prioritize speed, clear buyer relevance, and a low-friction next step.",
    "Do not expose reasoning. Do not invent facts.",
    "Return only valid JSON with keys subject and body."
  ].join("\n");
}

function outreachWorkflowInstructions(): string {
  return [
    "You are Hermills Letter App, a senior B2B export sales strategist building Snov-style outreach workflows.",
    "Internally act as a coordinated agent queue: Website Reader -> Buyer Psychology Analyst -> ICP/USP Matcher -> Email Writer -> QA Reviewer.",
    "Your job is to research the buyer, model ICP buyer psychology, identify procurement triggers, match differentiated supplier USPs, and write warm outreach.",
    "Treat the output as an operational drip workflow: customer research -> successful development angle -> ICP -> USP -> initial warm email -> 9 follow-ups, with stop/handoff discipline reflected inside the existing fields.",
    "All customer-facing emails must be English, complete business emails with greeting, low-friction CTA, Best regards, and sender signature.",
    "For every initial email, privately follow this chain: buyer website evidence -> buyer role/scene -> buyer risk, KPI tension, or procurement trigger -> one matching supplier USP -> one low-friction micro-offer.",
    "Obey the Customer decision brief. If fit is cautious, turn it into the safest successful development angle, not a generic supplier pitch. If the buyer appears to be a manufacturer/OEM or peer, avoid importer assumptions.",
    "Never turn inferred purchase intent into a stated fact.",
    "Use at least two concrete buyer clues in the initial email and keep the CTA conversational, not keyword-based.",
    "Use only supplied customer research and company knowledge. Do not invent company strengths, certifications, prices, cases, shipping terms, or fake relationship context.",
    "Do not write generic supplier copy, empty benefits, cold-email cliches, filler, vague CTAs, or claims without buyer logic and proof.",
    "Return only valid JSON that matches the requested schema. Do not add fields, markdown, or commentary."
  ].join("\n");
}

function buildFastOutreachPrompt(input: {
  lead: OutreachLead;
  research?: CustomerResearchResult;
  generationBrief: OutreachGenerationBrief;
  companyKnowledgeContext: string;
  language: string;
  tone: string;
  signatureBlock?: string;
}): string {
  const evidence = [
    ...(input.research?.evidence ?? []).slice(0, 5).map((item) => `${item.label}: ${item.value}`),
    ...(input.research?.productSignals ?? []).slice(0, 5).map((item) => `Product signal: ${item}`),
    ...(input.research?.buyingSignals ?? []).slice(0, 3).map((item) => `Buying signal: ${item}`),
    input.research?.recommendedAngle ? `Recommended angle: ${input.research.recommendedAngle}` : "",
    input.research?.brief?.bestOutreachPath ? `Best outreach path: ${input.research.brief.bestOutreachPath}` : "",
    input.research?.brief?.bestAngle ? `Best angle: ${input.research.brief.bestAngle}` : ""
  ].filter(Boolean).join("\n");
  const leadLines = [
    `Company: ${input.lead.companyName}`,
    input.lead.website ? `Website: ${input.lead.website}` : "",
    input.lead.email ? `Email: ${input.lead.email}` : "",
    input.lead.industry ? `Industry: ${input.lead.industry}` : "",
    input.lead.need ? `Need: ${input.lead.need}` : "",
    input.lead.notes ? `Notes: ${truncateForContext(input.lead.notes, 1200)}` : ""
  ].filter(Boolean).join("\n");
  return [
    "Write one first cold outreach email draft.",
    `Target language: ${input.language}. Customer-facing email must be English.`,
    `Tone: ${input.tone}.`,
    "Return JSON only: {\"subject\":\"...\",\"body\":\"...\"}.",
    "",
    "Rules:",
    "- Subject under 55 characters.",
    "- Body 55-115 words, with greeting and Best regards signature.",
    "- First sentence must mention one concrete buyer clue from the evidence below.",
    "- Use one seller value point only; do not list all products.",
    "- If buyer intent is uncertain, use a cautious comparison/benchmark angle.",
    "- CTA must be specific and easy: 2-3 options, side-by-side table, MOQ/lead-time reference, or samples.",
    "- Avoid: hope you are well, reaching out, best price, high quality, one-stop solution, win-win, please kindly.",
    "- Do not claim the buyer is sourcing or has a problem unless the evidence says so.",
    "",
    "--- Buyer ---",
    leadLines,
    "",
    "--- Buyer evidence ---",
    evidence || "No strong evidence. Keep the email conservative and ask whether a small comparison would help.",
    "",
    "--- Strategy brief ---",
    truncateForContext(formatOutreachGenerationBrief(input.generationBrief), 2500),
    "",
    "--- Seller/company knowledge ---",
    truncateForContext(input.companyKnowledgeContext || "Seller company details are limited. Stay conservative.", 2500),
    "",
    "--- Required signature ---",
    input.signatureBlock || "Best regards,"
  ].join("\n");
}

function buildOutreachPrompt(
  lead: OutreachLead,
  language: string,
  tone: string,
  companyKnowledgeContext: string,
  generationBrief: OutreachGenerationBrief,
  customerResearchContext = "",
  signatureBlock = ""
): string {
  const leadLines = [
    `Company: ${lead.companyName}`,
    lead.website ? `Website: ${lead.website}` : "",
    lead.country ? `Country/market: ${lead.country}` : "",
    lead.industry ? `Industry: ${lead.industry}` : "",
    lead.contactName ? `Contact name: ${lead.contactName}` : "",
    lead.contactTitle ? `Contact title: ${lead.contactTitle}` : "",
    lead.email ? `Email: ${lead.email}` : "",
    lead.need ? `Need/pain point: ${lead.need}` : "",
    lead.notes ? `Notes: ${lead.notes}` : "",
    lead.tags.length ? `Tags: ${lead.tags.join(", ")}` : ""
  ].filter(Boolean).join("\n");
  return [
    "Write one B2B cold outreach email draft.",
    `Target language: ${language}.`,
    `Tone: ${tone}.`,
    "Requirements:",
    "- Use a short subject line.",
    "- Write the customer-facing email in English only, even if the app UI or internal notes are Chinese.",
    "- Keep the body 45-110 words in 2-5 compact paragraphs including greeting and signature.",
    "- The body must start with a normal greeting: Hi [Name], Hi [Company] team, or Hi team,.",
    "- The body must end with Best regards and the sender signature shown below.",
    "- Build the email with these 8 modules: Subject, Greeting, Customer-first opening, Reality check when needed, Value bridge, Soft proof, Low-friction CTA, Signature.",
    "- Privately use this sequence: specific buyer clue plus why it matters -> one relevant supplier USP tied to that buyer's risk, KPI, sourcing task, or channel -> one low-friction micro-offer.",
    "- Before writing, choose one concrete buyer evidence item from the lead or website research. The evidence must be visible in the first real sentence.",
    "- Use at least two concrete buyer clues from the research across the email. These should be real product, channel, collection, market, certification, spec, or procurement clues, not only the buyer's name.",
    "- Convert that evidence into a buyer implication: what they may be trying to protect, improve, source, compare, certify, stock, or launch.",
    "- Do not stop at whether the buyer is a fit. Choose the safest way to successfully develop this account: standard supply, product/spec comparison, complementary material/process, backup capacity, channel cooperation, proof pack, or cautious benchmark.",
    "- Obey the Customer decision brief. If write mode is cautious, write as a careful hypothesis and safer success angle, not as a confident supplier pitch.",
    "- If the buyer looks like a manufacturer/OEM or peer, do not call them an importer or imply they need another finished-goods supplier. Use a complementary angle only.",
    "- Follow every 'Claims to avoid' item from the research brief.",
    "- Use the private outreach brief as the locked strategy. Do not switch to a different USP or generic company introduction.",
    "- Use only one USP in the email. Do not list all company strengths.",
    "- The first real sentence must not introduce our company credentials first. It must tell the buyer why this email is about them.",
    "- Do not write only 'I saw your website' or only mention the company name. Use a product/category/channel/market/project/certification/procurement clue.",
    "- Ask for a simple next step, such as sending 2-3 matched options, a small comparison, MOQ/lead-time table, certification/spec pack, or A/B choices.",
    "- Never use a vague CTA like 'Would you like details?', 'Are you interested?', 'Can we talk?', or 'Please send your requirements'.",
    "- Never use robotic keyword CTAs like Reply 'SPC table'. Write a natural question or A/B choice.",
    "- Never use the fixed skeleton 'I noticed [company]..., so...', 'Instead of sending a full catalog...', or 'Would A) ... or B) ... be more useful first?'.",
    "- Sound like a human business note, not translated English or a mass template.",
    "- Never use reaching out, just following up, hope you are doing well, Dear Sir/Madam, esteemed company, sincerely hope to establish cooperation, leading manufacturer, high quality and competitive price, best price, one-stop solution, factory direct, win-win cooperation, or please kindly.",
    "- Avoid hype, fake familiarity, guaranteed results, and unsupported claims.",
    "- Before finalizing, silently check: would this exact email make sense if the buyer is not currently purchasing? If not, rewrite it more cautiously.",
    "- Return JSON only: {\"subject\":\"...\",\"body\":\"...\"}.",
    "",
    formatOutreachGenerationBrief(generationBrief),
    "",
    "--- Lead ---",
    leadLines,
    "",
    customerResearchContext || "--- Customer website research ---\nNo website research was available.",
    "",
    "--- Required sender signature ---",
    signatureBlock || "Best regards,",
    "",
    "--- Company knowledge ---",
    companyKnowledgeContext || "No company knowledge has been added yet. Keep the message general and ask the user to add company details for a stronger draft."
  ].join("\n");
}

function buildOutreachWorkflowPrompt(input: {
  lead: OutreachLead;
  research: CustomerResearchResult;
  generationBrief: OutreachGenerationBrief;
  outreachOsContext?: string;
  companyKnowledgeContext: string;
  language: string;
  tone: string;
  signatureBlock?: string;
}): string {
  return [
    "Build a complete Letter App style B2B outreach workflow for a China-based export/trading company.",
    `Target language: ${input.language}.`,
    `Tone: ${input.tone}.`,
    `Research depth: ${input.research.depth}. ${researchDepthPromptGuidance(input.research.depth)}`,
    "",
    "Return JSON only with this shape:",
    "{",
    "  \"icps\": [{\"name\":\"...\",\"industrySegment\":\"...\",\"companyCharacteristics\":[\"...\"],\"buyerRoles\":[\"...\"],\"buyingBehavior\":[\"...\"],\"painPoints\":[\"...\"],\"triggerEvents\":[\"...\"],\"salesAngles\":[\"...\"]}],",
    "  \"usps\": [{\"category\":\"Product-level|Operational|Trust-building|Strategic value\",\"headline\":\"...\",\"buyerAngle\":\"...\",\"proof\":\"...\"}],",
    "  \"initialEmail\": {\"subject\":\"...\",\"body\":\"...\"},",
    "  \"followUps\": [{\"step\":1,\"delayDays\":2,\"strategy\":\"Friendly reminder\",\"subject\":\"...\",\"body\":\"...\"}]",
    "}",
    "Do not add, remove, rename, or nest fields outside this schema.",
    "",
    "Private operating mode:",
    "- The user only supplied a customer website and email. You must do the strategic work silently in the output fields.",
    "- Treat the private outreach brief below as the locked angle for the first email.",
    input.outreachOsContext ?? "",
    "- Treat the Customer decision brief as higher priority than generic sales instincts.",
    "- Do not stop at 'fit / no fit'. Turn the verdict into the safest way to successfully develop this account.",
    "- If the brief says cautious, write as a careful hypothesis and low-friction offer. Do not assert that the buyer is actively sourcing.",
    "- If the buyer appears to manufacture/OEM similar products, do not pitch them as a simple importer. Use complementary product, backup option, proof pack, or category comparison only when supported.",
    "- Do not include any claim listed under Claims to avoid.",
    "- For the initial email, choose exactly one concrete website evidence item and turn it into a buyer implication before mentioning our USP.",
    "- Use at least two concrete buyer clues across the initial email. Good clues include named programs, collections, specs, SKUs, channels, markets, certifications, warehouse/quick-ship/container/truckload signals, or procurement signals.",
    "- Do not treat the buyer company name or 'I saw your website' as personalization.",
    "- Do not expose research steps, agent names, or internal reasoning in any email.",
    "- If evidence is thin, write a low-risk micro-offer instead of a broad supplier pitch.",
    "- A passing initial email must include a real reply trigger: A/B options, a small comparison, an MOQ/lead-time table, a spec/certification pack, or 2-3 matched options. 'Would you like details?' is a failing CTA.",
    "",
    "ICP rules:",
    "- Generate 2-3 ICPs likely to buy in the next 3-6 months.",
    "- For each ICP, model buyer psychology: what the buyer is paid to protect, personal risk, success metrics, objections, urgency, and emotional blockers.",
    "- Fill the existing arrays with concrete evidence-backed details: companyCharacteristics, buyerRoles, buyingBehavior, painPoints, triggerEvents, and salesAngles.",
    "- Trigger events must be procurement triggers, such as category expansion, seasonal stock planning, supplier replacement, compliance review, tender/RFQ, new channel launch, failed delivery, or margin pressure.",
    "- Prioritize purchase-intent signals over generic industry fit.",
    "",
    "USP rules:",
    "- Generate 4-6 buyer-relevant USPs.",
    "- Use the categories Product-level, Operational, Trust-building, or Strategic value.",
    "- Make each USP differentiated: explain why this buyer would see less risk, faster evaluation, easier reorder, clearer compliance, better channel fit, or stronger market advantage.",
    "- Use proof only from company knowledge. If proof is missing, write a conservative proof note such as Proof needed: add certification/sample/MOQ/lead-time evidence.",
    "- Avoid generic claims like best quality, competitive price, professional supplier, one-stop solution, factory direct, superior service, or trusted partner.",
    "- Tie each USP to buyer pain, risk reduction, speed, compliance, reorder ease, or market advantage.",
    "",
    "Initial warm email rules:",
    "- Subject under 50 characters.",
    "- Body 45-110 words in 2-5 compact paragraphs including greeting and signature.",
    "- Body must start with a greeting: Hi [Name], Hi [Company] team, or Hi team,.",
    "- Body must end with Best regards and the required sender signature below.",
    "- Follow the 8 modules: Subject, Greeting, Customer-first opening, Reality check when needed, Value bridge, Soft proof, Low-friction CTA, Signature.",
    "- Peer-to-peer, helpful, warm, concise.",
    "- Privately shape it as buyer-specific context hook plus why it matters -> one relevant USP tied to their sourcing risk, KPI, channel, or procurement task -> low-friction micro-offer.",
    "- The first real sentence must be about the buyer, not our credentials.",
    "- The first real sentence must include a concrete evidence clue: product category, channel, market, project, certification/compliance signal, sourcing/procurement signal, or pain/risk signal.",
    "- Translate the evidence into a buyer implication instead of simply naming the evidence.",
    "- Mention one buyer pain point and one matching USP. Do not include a catalog dump.",
    "- Use a concrete micro-offer or A/B choice, such as a small comparison, sample-ready option list, MOQ/lead-time table, certification pack, or category fit check.",
    "- Do not write vague CTAs like 'Would you like details?', 'Are you interested?', or 'Can we schedule a call?'.",
    "- Do not ask the buyer to reply with a keyword such as Reply 'SPC table'. That sounds automated. Use a natural question or A/B choice.",
    "- Do not use the same visible skeleton each time. Avoid 'I noticed [company]..., so...', 'Instead of sending a full catalog...', and 'Would A) ... or B) ... be more useful first?'.",
    "- Sound like a warm human business note, not translated English or a mass blast. Do not fake prior familiarity.",
    "",
    "Never use these phrases:",
    "reaching out, just following up, touching base, hope you are doing well, leading manufacturer, high quality and competitive price, one-stop solution, factory direct, superior service, trusted partner, any update, kind reminder, gentle reminder, circling back, can you share your requirements, do you have any need, Dear Sir/Madam, best price, win-win cooperation, please kindly.",
    "",
    "No-empty-talk quality bar:",
    "- Every important sentence must answer at least one of: why this buyer, why now, why us, what proof, or what next step.",
    "- If a sentence could be sent unchanged to any importer, replace it with buyer context, a procurement trigger, a role-specific pain, a differentiated USP, or a concrete offer.",
    "- If evidence is not available, stay conservative instead of filling the gap with hype.",
    "",
    "Follow-up sequence rules:",
    "- Generate exactly 9 follow-up emails.",
    "- Use Snov-style drip discipline: each follow-up should add a new reason to reply, not repeat the first email.",
    "- Use these strategies in order with matching intent: Friendly reminder (delayDays 2, restate the micro-offer), Additional value (delayDays 4, add a checklist/comparison/market note), Quick yes/no (delayDays 7, route to the right person or confirm fit), Social proof (delayDays 7, use only provided proof or a non-fabricated process example), Limited incentive (delayDays 10, small sample/review slot without fake scarcity), Feedback request (delayDays 10, ask what blocked fit), Prior interaction (delayDays 14, reference only this email thread), Breakup email (delayDays 21, ask permission to close the loop), New angle (delayDays 28, try a different ICP/use case/category angle).",
    "- Keep every follow-up concise, useful, and permission-based. Do not pressure the buyer.",
    "- Any positive reply, unsubscribe, refusal, bounce, or out-of-office handoff should stop automation; reflect this by avoiding language that assumes continued automated sending.",
    "",
    formatOutreachGenerationBrief(input.generationBrief),
    "",
    "--- Lead ---",
    `Company: ${input.lead.companyName}`,
    `Website: ${input.lead.website || input.research.website}`,
    `Email: ${input.lead.email || ""}`,
    input.lead.industry ? `Industry: ${input.lead.industry}` : "",
    input.lead.need ? `Need: ${input.lead.need}` : "",
    "",
    "--- Customer website research ---",
    formatCustomerResearchContext(input.research),
    "",
    "--- Required sender signature ---",
    input.signatureBlock || "Best regards,",
    "",
    "--- Our company knowledge ---",
    input.companyKnowledgeContext || "No company knowledge has been added yet. Use conservative wording and suggest adding company docs for stronger emails."
  ].filter(Boolean).join("\n");
}

function parseGeneratedOutreachDraft(value: string): { subject: string; body: string } {
  const cleaned = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  for (const candidate of [cleaned, cleaned.match(/\{[\s\S]*\}/)?.[0]].filter(Boolean)) {
    try {
      const parsed = JSON.parse(candidate!) as { subject?: unknown; body?: unknown };
      const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
      const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
      if (subject && body) return { subject: truncatePlain(subject, 240), body: truncateForContext(body, 20_000) };
    } catch {
      // Fall back to text parsing below.
    }
  }
  const subjectMatch = cleaned.match(/(?:^|\n)\s*(?:subject|主题)\s*[:：]\s*(.+)/i);
  const bodyMatch = cleaned.match(/(?:^|\n)\s*(?:body|正文)\s*[:：]\s*([\s\S]+)/i);
  const subject = subjectMatch?.[1]?.trim() || cleaned.split(/\r?\n/).find((line) => line.trim())?.replace(/^subject\s*[:：]\s*/i, "").trim() || "Quick question";
  const body = bodyMatch?.[1]?.trim() || cleaned.replace(subjectMatch?.[0] ?? "", "").trim();
  return {
    subject: truncatePlain(subject || "Quick question", 240),
    body: truncateForContext(body || cleaned || "Hello, I would like to learn whether your team handles this product category.", 20_000)
  };
}

function parseGeneratedOutreachWorkflow(value: string, lead: OutreachLead, language: string, tone: string): {
  icps: OutreachWorkflow["icps"];
  usps: OutreachWorkflow["usps"];
  initialEmail: OutreachWorkflow["initialEmail"];
  followUps: OutreachWorkflow["followUps"];
} {
  const fallback = fallbackOutreachWorkflow(lead, language, tone);
  const cleaned = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const candidates = [cleaned, cleaned.match(/\{[\s\S]*\}/)?.[0]].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate!) as Record<string, unknown>;
      if (!parsed.initialEmail && typeof parsed.subject === "string" && typeof parsed.body === "string") {
        const draft = parseGeneratedOutreachDraft(candidate!);
        return {
          ...fallback,
          initialEmail: { ...fallback.initialEmail, subject: draft.subject, body: draft.body }
        };
      }
      const icps = Array.isArray(parsed.icps) ? parsed.icps.map((item, index) => normalizeGeneratedIcp(item, index)).filter(isGeneratedIcp) : [];
      const usps = Array.isArray(parsed.usps) ? parsed.usps.map((item, index) => normalizeGeneratedUsp(item, index)).filter(isGeneratedUsp) : [];
      const initialEmail = normalizeSequenceEmail(parsed.initialEmail, 0, 0, "Initial warm email") ?? fallback.initialEmail;
      const followUps = Array.isArray(parsed.followUps)
        ? parsed.followUps.map((item, index) => normalizeSequenceEmail(item, index + 1, defaultFollowUpStrategies[index]?.delayDays ?? index + 1, defaultFollowUpStrategies[index]?.strategy ?? `Follow-up ${index + 1}`)).filter(isEmailSequenceDraft).slice(0, 9)
        : [];
      return {
        icps: icps.length ? icps.slice(0, 3) : fallback.icps,
        usps: usps.length ? usps.slice(0, 6) : fallback.usps,
        initialEmail,
        followUps: followUps.length === 9 ? followUps : fallback.followUps
      };
    } catch {
      // Try the next candidate, then fallback.
    }
  }
  const draft = parseGeneratedOutreachDraft(value);
  return {
    ...fallback,
    initialEmail: { ...fallback.initialEmail, subject: draft.subject, body: draft.body }
  };
}

function isGeneratedIcp(value: OutreachWorkflow["icps"][number] | undefined): value is OutreachWorkflow["icps"][number] {
  return Boolean(value);
}

function isGeneratedUsp(value: OutreachWorkflow["usps"][number] | undefined): value is OutreachWorkflow["usps"][number] {
  return Boolean(value);
}

function isEmailSequenceDraft(value: OutreachWorkflow["followUps"][number] | undefined): value is OutreachWorkflow["followUps"][number] {
  return Boolean(value);
}

function normalizeGeneratedIcp(value: unknown, index: number): OutreachWorkflow["icps"][number] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const name = stringField(record.name) || `ICP ${index + 1}`;
  return {
    id: `icp-${index + 1}`,
    name: truncatePlain(name, 160),
    industrySegment: truncatePlain(stringField(record.industrySegment) || stringField(record.description), 500),
    companyCharacteristics: stringArrayField(record.companyCharacteristics),
    buyerRoles: stringArrayField(record.buyerRoles),
    buyingBehavior: stringArrayField(record.buyingBehavior),
    painPoints: stringArrayField(record.painPoints),
    triggerEvents: stringArrayField(record.triggerEvents),
    salesAngles: stringArrayField(record.salesAngles)
  };
}

function normalizeGeneratedUsp(value: unknown, index: number): OutreachWorkflow["usps"][number] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const headline = stringField(record.headline) || stringField(record.title);
  if (!headline) return undefined;
  return {
    id: `usp-${index + 1}`,
    category: truncatePlain(stringField(record.category) || "Strategic value", 80),
    headline: truncatePlain(headline, 180),
    buyerAngle: truncatePlain(stringField(record.buyerAngle) || stringField(record.value), 800),
    proof: truncatePlain(stringField(record.proof) || stringField(record.proofPoints), 800)
  };
}

function normalizeSequenceEmail(value: unknown, step: number, delayDays: number, strategy: string): OutreachWorkflow["followUps"][number] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const subject = stringField(record.subject);
  const body = stringField(record.body);
  if (!subject || !body) return undefined;
  return EmailSequenceDraftSchema.parse({
    id: step === 0 ? "initial-email" : `follow-up-${step}`,
    step,
    delayDays: numberField(record.delayDays, delayDays),
    strategy: truncatePlain(stringField(record.strategy) || strategy, 180),
    subject: truncatePlain(subject, 240),
    body: truncateForContext(body, 20_000),
    status: "draft"
  });
}

const defaultFollowUpStrategies = [
  { delayDays: 2, strategy: "Friendly reminder" },
  { delayDays: 4, strategy: "Additional value" },
  { delayDays: 7, strategy: "Quick yes/no" },
  { delayDays: 7, strategy: "Social proof" },
  { delayDays: 10, strategy: "Limited incentive" },
  { delayDays: 10, strategy: "Feedback request" },
  { delayDays: 14, strategy: "Prior interaction" },
  { delayDays: 21, strategy: "Breakup email" },
  { delayDays: 28, strategy: "New angle" }
];

function fallbackOutreachWorkflow(lead: OutreachLead, language: string, tone: string): {
  icps: OutreachWorkflow["icps"];
  usps: OutreachWorkflow["usps"];
  initialEmail: OutreachWorkflow["initialEmail"];
  followUps: OutreachWorkflow["followUps"];
} {
  const productHint = lead.need || "reliable supply for this product category";
  const icps: OutreachWorkflow["icps"] = [{
    id: "icp-1",
    name: `${lead.industry || "B2B"} buyer with repeat sourcing needs`,
    industrySegment: lead.industry || "Import, distribution, or retail teams with recurring procurement needs.",
    companyCharacteristics: ["Buys in batches or repeats orders when supply is stable.", "Needs suppliers who reduce sourcing risk and back-and-forth."],
    buyerRoles: ["Sourcing or procurement manager focused on supplier reliability.", "Category or sales owner who cares about product-market fit."],
    buyingBehavior: ["Compares suppliers on delivery, MOQ, proof, and communication quality."],
    painPoints: ["Supplier uncertainty creates delays, missed launches, or extra inspection work."],
    triggerEvents: ["Website category expansion, seasonal purchasing, new supplier search, or supplier replacement."],
    salesAngles: ["Lead with one useful option or comparison, not a generic catalog pitch."]
  }];
  const usps: OutreachWorkflow["usps"] = [{
    id: "usp-1",
    category: "Strategic value",
    headline: "A lower-friction way to evaluate supply fit",
    buyerAngle: `Helps ${lead.companyName} compare whether the supplier fits their buying process before committing time.`,
    proof: "Share concise specs, options, and next-step material instead of broad claims."
  }];
  const initialEmail: OutreachWorkflow["initialEmail"] = EmailSequenceDraftSchema.parse({
    id: "initial-email",
    step: 0,
    delayDays: 0,
    strategy: "Initial warm email",
    subject: truncatePlain(`${lead.companyName} sourcing idea`, 50),
    body: [
      `Hi ${lead.companyName} team,`,
      "",
      `${lead.companyName} appears connected to ${productHint}, so a small proof-backed comparison is safer than a broad supplier pitch.`,
      "",
      "We can prepare 2-3 matched options with MOQ, lead time, and proof notes so your team can judge fit quickly.",
      "",
      "Would that be worth a quick look?"
    ].join("\n"),
    status: "draft"
  });
  const followUps: OutreachWorkflow["followUps"] = defaultFollowUpStrategies.map((item, index) => EmailSequenceDraftSchema.parse({
    id: `follow-up-${index + 1}`,
    step: index + 1,
    delayDays: item.delayDays,
    strategy: item.strategy,
    subject: truncatePlain(index === 7 ? "Should I close this?" : `${item.strategy} for ${lead.companyName}`, 50),
    body: followUpFallbackBody(lead, item.strategy),
    status: "draft"
  }));
  void language;
  void tone;
  return { icps, usps, initialEmail, followUps };
}

function followUpFallbackBody(lead: OutreachLead, strategy: string): string {
  const productHint = lead.need || "this product category";
  return [
    `Hi ${lead.companyName} team,`,
    "",
    `${strategy}: a small comparison around ${productHint} may help your team review sample-ready options, lead time, and proof without opening a broad supplier search.`,
    "",
    "Would a 2-3 option comparison be worth a quick look?"
  ].join("\n");
}

function stringField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean).join("; ");
  return "";
}

function stringArrayField(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => stringField(item)).filter(Boolean).slice(0, 8);
  const text = stringField(value);
  return text ? [text] : [];
}

function numberField(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(60, Math.round(number))) : fallback;
}

function truncatePlain(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength - 1).trimEnd();
}

async function sendOutreachDraft(input: {
  draft: OutreachDraft;
  sender: OutreachSenderAccount;
  lead?: OutreachLead;
  to?: string;
  senders: OutreachSenderRepository;
  drafts: OutreachDraftRepository;
  emailSignature: OutreachEmailSignatureRepository;
  ctaAssets?: OutreachCtaAsset[];
  companyKnowledgeContext?: string;
}): Promise<OutreachDraft> {
  if (!input.sender.enabled) throw new ClientInputError("Sender account is disabled.");
  if (!input.sender.deliveryConfirmedAt) throw new ClientInputError("Confirm the sender mailbox before sending outreach.");
  if (input.draft.status === "sent") throw new ClientInputError("Outreach draft has already been sent.");
  const to = input.to ?? input.lead?.email;
  if (!to) throw new ClientInputError("Lead email is missing.");
  const qualityReview = reviewOutreachEmail({ subject: input.draft.subject, body: input.draft.body, lead: input.lead });
  const sendRiskReview = reviewOutreachSendRisk({
    subject: input.draft.subject,
    body: input.draft.body,
    qualityReview,
    sender: input.sender,
    lead: input.lead,
    evidenceLock: input.draft.evidenceLock,
    ctaAssets: input.ctaAssets,
    companyKnowledgeContext: input.companyKnowledgeContext
  });
  await input.drafts.update(input.draft.id, {
    qualityReview,
    sendRiskReview
  });
  assertOutreachQualityPassed(qualityReview);
  assertOutreachSendRiskPassed(sendRiskReview);
  try {
    const signedMessage = await buildSignedOutreachMailMessage({
      draft: input.draft,
      signature: await input.emailSignature.get(),
      logo: await input.emailSignature.readLogo(),
      sender: input.sender
    });
    await input.senders.sendMail(input.sender, {
      from: formatEmailAddress(input.sender.fromName, input.sender.email),
      to,
      subject: input.draft.subject,
      ...signedMessage
    });
    const sentAt = new Date().toISOString();
    return input.drafts.update(input.draft.id, {
      status: "sent",
      sentAt,
      sendError: undefined,
      sendOutcome: buildOutreachSendOutcome({
        status: "sent",
        sender: input.sender,
        sentAt,
        notes: `Sent to ${to}.`
      }),
      learningSignal: OutreachLearningSignalSchema.parse({
        ...input.draft.learningSignal,
        sentAt,
        replyOutcome: input.draft.learningSignal.replyOutcome === "unknown" ? "unknown" : input.draft.learningSignal.replyOutcome,
        recordedAt: sentAt
      })
    });
  } catch (error) {
    const message = formatMailError(error, input.sender);
    await input.drafts.update(input.draft.id, {
      status: "failed",
      sendError: message,
      sendOutcome: buildOutreachSendOutcome({
        status: "failed",
        sender: input.sender,
        notes: message
      })
    });
    throw new ClientInputError(`Email could not be sent: ${message}`);
  }
}

async function buildSignedOutreachMailMessage(input: {
  draft: OutreachDraft;
  signature: OutreachEmailSignature;
  logo?: { buffer: Buffer; fileName: string; mimeType: string };
  sender: OutreachSenderAccount;
}): Promise<Pick<SendMailOptions, "text" | "html" | "attachments">> {
  const bodyText = input.draft.body.trim();
  const signature = input.signature.enabled ? normalizeEmailSignature(input.signature) : undefined;
  const bodyAlreadySigned = hasEmailSignoff(bodyText);
  const text = [bodyText, bodyAlreadySigned ? "" : signature?.text].filter(Boolean).join("\n\n");
  const bodyHtml = plainTextToEmailHtml(bodyText);
  const includeLogo = Boolean(signature?.logoHtml && input.logo && signatureProviderSupportsInlineLogo(input.sender));
  const html = signature
    ? bodyAlreadySigned
      ? [
        bodyHtml,
        includeLogo ? `<div class="hermills-signature-logo" style="margin-top:12px;">${signature.logoHtml}</div>` : ""
      ].join("")
      : [
        bodyHtml,
        `<div class="hermills-signature" style="margin-top:18px;padding-top:12px;border-top:1px solid #e5e7eb;color:#374151;font-family:Arial,sans-serif;font-size:13px;line-height:1.45;">`,
        includeLogo ? signature.logoHtml : "",
        signature.html,
        `</div>`
      ].join("")
    : bodyHtml;
  const attachments = includeLogo && input.logo
    ? [{
        filename: input.logo.fileName,
        content: input.logo.buffer,
        contentType: input.logo.mimeType,
        cid: SIGNATURE_LOGO_CID,
        contentDisposition: "inline" as const
      }]
    : undefined;
  return { text, html, attachments };
}

function normalizeEmailSignature(signature: OutreachEmailSignature): { text: string; html: string; logoHtml: string } {
  const text = signature.text.trim() || htmlToPlainText(signature.html || "");
  const htmlSource = signature.html.trim() || plainTextToEmailHtml(text);
  const html = sanitizeSignatureHtml(htmlSource);
  const logoHtml = signature.logoEnabled && signature.logo
    ? `<div style="margin-bottom:8px;"><img src="cid:${SIGNATURE_LOGO_CID}" alt="${escapeHtml(signature.logoAlt || "Company logo")}" width="${signature.logoWidth}" style="display:block;max-width:${signature.logoWidth}px;height:auto;border:0;" /></div>`
    : "";
  return { text, html, logoHtml };
}

function signatureProviderSupportsInlineLogo(sender: OutreachSenderAccount): boolean {
  return (sender.sendChannel ?? "smtp") !== "oauth-api" || !/zoho/i.test(sender.provider);
}

function plainTextToEmailHtml(value: string): string {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 12px;">${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function sanitizeSignatureHtml(value: string): string {
  return value
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|meta|link)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|meta|link)[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "")
    .replace(/\s+style\s*=\s*(["'])([\s\S]*?)\1/gi, (_match, quote: string, style: string) => {
      const cleaned = String(style)
        .replace(/expression\s*\([^)]*\)/gi, "")
        .replace(/url\s*\(\s*javascript:[^)]*\)/gi, "");
      return ` style=${quote}${cleaned}${quote}`;
    });
}

function htmlToPlainText(value: string): string {
  return decodeHtmlEntities(value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMailError(error: unknown, sender?: OutreachSenderAccount): string {
  if (error instanceof MailTransportError) {
    const details = [
      error.message,
      error.detail.provider ? `provider=${error.detail.provider}` : undefined,
      error.detail.channel ? `channel=${error.detail.channel}` : undefined,
      error.detail.code ? `code=${error.detail.code}` : undefined,
      error.detail.statusCode ? `http=${error.detail.statusCode}` : undefined,
      error.detail.requestId ? `requestId=${error.detail.requestId}` : undefined,
      error.detail.responseMessage,
      sender ? senderMailHint(sender, error.message, error.detail.code) : undefined
    ].filter((part): part is string => Boolean(part));
    return redactSecrets([...new Set(details)].join(" · "));
  }
  const mailError = error as Error & { code?: string; command?: string; response?: string; responseCode?: number };
  const message = error instanceof Error ? error.message : String(error);
  const details = [
    message,
    mailError.code ? `code=${mailError.code}` : undefined,
    mailError.command ? `command=${mailError.command}` : undefined,
    mailError.responseCode ? `smtp=${mailError.responseCode}` : undefined,
    mailError.response && mailError.response !== message ? mailError.response : undefined,
    sender ? senderMailHint(sender, `${message} ${mailError.response ?? ""}`, mailError.code) : undefined
  ].filter((part): part is string => Boolean(part));
  return redactSecrets([...new Set(details)].join(" · "));
}

function senderMailHint(sender: OutreachSenderAccount, message: string, code?: string): string | undefined {
  const provider = canonicalOutreachSenderProvider(sender.provider);
  const text = `${message} ${code ?? ""}`.toLowerCase();
  if ((sender.sendChannel ?? "smtp") === "service-api") {
    if (/missing|credential|token|secret/.test(text)) return `${serviceApiLabel(provider)} requires saved API credentials before Hermills can test or send through serviceApi.`;
    if (/not implemented|unsupported/.test(text)) return `${serviceApiLabel(provider)} is configured as a serviceApi channel, but this build does not include a provider-specific API sender; keep SMTP as the fallback until credentials and an adapter are configured.`;
  }
  if ((sender.sendChannel ?? "smtp") === "smtp" && /(eauth|auth|login|535|534|credential|password)/i.test(text)) {
    if (provider === "tencent") return "Tencent Exmail SMTP usually requires the mailbox authorization code, not the normal account password.";
    if (provider === "aliyun") return "Alibaba/Aliyun Mail SMTP usually requires the mailbox authorization code, not the normal account password.";
  }
  return undefined;
}

function serviceApiLabel(provider: string): string {
  return OUTREACH_SERVICE_API_DEFAULTS[canonicalOutreachSenderProvider(provider)]?.label ?? "Service API";
}

function formatEmailAddress(name: string | undefined, email: string): string {
  const cleanName = name?.trim().replace(/["\r\n]/g, "") ?? "";
  return cleanName ? `"${cleanName}" <${email}>` : email;
}

async function discoverProviderModels(provider: ProviderCredential, apiKey: string | undefined, fetchImpl: typeof fetch): Promise<{ models: string[]; status: "connected" | "missing-key" | "failed"; message?: string }> {
  const baseUrl = provider.baseUrl?.trim();
  if (!baseUrl) return { models: provider.defaultModel ? [provider.defaultModel] : ["hermes-agent"], status: "connected" };
  if (provider.kind !== "local" && !apiKey) return { models: provider.defaultModel ? [provider.defaultModel] : [], status: "missing-key", message: "Provider key is missing." };
  try {
    const response = await fetchImpl(modelsUrl(baseUrl), {
      headers: providerModelHeaders(provider, apiKey),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) return { models: provider.defaultModel ? [provider.defaultModel] : [], status: "failed", message: `${response.status} ${response.statusText}` };
    const payload = await response.json() as { data?: Array<{ id?: string }> };
    const models = [...new Set((payload.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id)))];
    return { models: models.length ? models : provider.defaultModel ? [provider.defaultModel] : [], status: "connected" };
  } catch (error) {
    return { models: provider.defaultModel ? [provider.defaultModel] : [], status: "failed", message: error instanceof Error ? error.message : String(error) };
  }
}

function providerModelHeaders(provider: ProviderCredential, apiKey: string | undefined): HeadersInit | undefined {
  if (!apiKey) return undefined;
  if (provider.kind === "anthropic") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    };
  }
  return { Authorization: `Bearer ${apiKey}` };
}

async function readMaterialUpload(request: FastifyRequest): Promise<MaterialUpload> {
  const body = Buffer.isBuffer(request.body) ? request.body : undefined;
  if (!body) throw new ClientInputError("No material file was uploaded.");
  const boundary = multipartBoundary(request.headers["content-type"]);
  const file = parseSingleMultipartFile(body, boundary);
  assertAllowedMaterial({ filename: file.name, mimetype: file.mimeType });
  if (file.buffer.byteLength > MAX_MATERIAL_FILE_BYTES) throw new ClientInputError(`Material file exceeds ${formatLimit(MAX_MATERIAL_FILE_BYTES)}.`);
  return file;
}

async function readSignatureLogoUpload(request: FastifyRequest): Promise<MaterialUpload> {
  const body = Buffer.isBuffer(request.body) ? request.body : undefined;
  if (!body) throw new ClientInputError("No logo file was uploaded.");
  const boundary = multipartBoundary(request.headers["content-type"]);
  const file = parseSingleMultipartFile(body, boundary);
  assertAllowedSignatureLogo(file);
  return file;
}

function isMultipartRequest(request: FastifyRequest): boolean {
  return String(request.headers["content-type"] ?? "").toLowerCase().includes("multipart/form-data");
}

function multipartBoundary(contentType: unknown): string {
  const match = String(contentType ?? "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = match?.[1] ?? match?.[2];
  if (!boundary) throw new ClientInputError("Multipart upload is missing a boundary.");
  return boundary;
}

function parseSingleMultipartFile(body: Buffer, boundary: string): MaterialUpload {
  const marker = `--${boundary}`;
  const raw = body.toString("binary");
  const parts = raw.split(marker).slice(1, -1);
  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, "");
    const headerEnd = trimmed.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headerText = trimmed.slice(0, headerEnd);
    const disposition = headerText.match(/content-disposition:[^\r\n]*/i)?.[0] ?? "";
    if (!/name="file"/i.test(disposition)) continue;
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || "upload";
    const mimeType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "application/octet-stream";
    const contentStart = Buffer.byteLength(raw.slice(0, raw.indexOf(trimmed) + headerEnd + 4), "binary");
    let contentEnd = contentStart + Buffer.byteLength(trimmed.slice(headerEnd + 4), "binary");
    if (body.subarray(contentEnd - 2, contentEnd).toString("binary") === "\r\n") contentEnd -= 2;
    return {
      name: filename,
      mimeType,
      buffer: body.subarray(contentStart, contentEnd)
    };
  }
  throw new ClientInputError("Multipart upload must include one file field named file.");
}

function assertAllowedMaterial(file: MultipartCandidate): void {
  const name = file.filename || "upload";
  const extension = path.extname(name).toLowerCase();
  const mimeType = file.mimetype || "application/octet-stream";
  const allowedExtensions = new Set([
    ".txt", ".md", ".markdown", ".csv", ".json", ".yaml", ".yml", ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".css", ".html", ".xml",
    ".pdf", ".doc", ".docx", ".rtf", ".png", ".jpg", ".jpeg", ".webp", ".gif"
  ]);
  const allowedMime =
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/pdf" ||
    mimeType === "application/rtf" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    mimeType.startsWith("image/");
  if (!allowedExtensions.has(extension) && !allowedMime) {
    throw new ClientInputError(`Unsupported material type: ${mimeType || extension || "unknown"}.`);
  }
}

function assertAllowedSignatureLogo(file: MaterialUpload): void {
  const mimeType = file.mimeType || "application/octet-stream";
  if (!SIGNATURE_LOGO_MIME_TYPES.has(mimeType)) {
    throw new ClientInputError("Logo must be a PNG, JPG, WebP, or GIF image.");
  }
  if (file.buffer.byteLength > MAX_SIGNATURE_LOGO_BYTES) {
    throw new ClientInputError(`Logo file exceeds ${formatLimit(MAX_SIGNATURE_LOGO_BYTES)}.`);
  }
}

class MaterialRepository {
  private readonly filePath: string;
  private readonly uploadDir: string;

  constructor(baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "materials.json");
    this.uploadDir = path.join(getDataHome(baseDir), "materials");
  }

  async list(): Promise<MaterialRecord[]> {
    return (await this.read()).materials;
  }

  async listPersonal(): Promise<MaterialRecord[]> {
    return (await this.list()).filter((material) => material.scope !== "company");
  }

  async listCompany(): Promise<MaterialRecord[]> {
    return (await this.list()).filter((material) => material.scope === "company");
  }

  async getMany(ids: string[]): Promise<MaterialRecord[]> {
    const byId = new Map((await this.list()).map((material) => [material.id, material]));
    return ids.flatMap((id) => {
      const material = byId.get(id);
      return material ? [material] : [];
    });
  }

  async createFromJson(input: z.infer<typeof UploadMaterialBody> & MaterialMetadataInput): Promise<MaterialRecord> {
    const buffer = input.contentText ? Buffer.from(input.contentText, "utf8") : Buffer.alloc(0);
    return this.createRecord({
      name: input.name,
      folder: input.folder === null ? undefined : input.folder,
      scope: input.scope,
      category: input.category === null ? undefined : input.category,
      tags: input.tags,
      description: input.description === null ? undefined : input.description,
      mimeType: input.mimeType || "application/octet-stream",
      buffer,
      declaredSize: input.size,
      extraction: input.contentText ? { extractionState: "indexed", textPreview: truncateForContext(input.contentText, 20_000) } : { extractionState: "stored" }
    });
  }

  async createFromMultipart(input: MaterialUpload, metadata: MaterialMetadataInput = {}): Promise<MaterialRecord> {
    return this.createRecord({
      name: input.name,
      folder: metadata.folder === null ? undefined : metadata.folder,
      scope: metadata.scope,
      category: metadata.category === null ? undefined : metadata.category,
      tags: metadata.tags,
      description: metadata.description === null ? undefined : metadata.description,
      mimeType: input.mimeType,
      buffer: input.buffer,
      extraction: extractMaterialText(input.name, input.mimeType, input.buffer)
    });
  }

  async preview(id: string): Promise<PublicMaterialRecord & { contentText?: string }> {
    const material = await this.requireMaterial(id);
    let contentText = material.textPreview;
    if (!contentText && material.path) {
      const filePath = await this.resolveStoredFile(material);
      const buffer = await readFile(filePath);
      if (isTextMaterial(material.name, material.mimeType, buffer)) contentText = truncateForContext(buffer.toString("utf8"), 40_000);
    }
    return {
      ...publicMaterial(material),
      contentText
    };
  }

  async download(id: string): Promise<{ fileName: string; mimeType: string; buffer: Buffer }> {
    const material = await this.requireMaterial(id);
    if (!material.path) throw new ClientInputError("Material file is unavailable.");
    const buffer = await readFile(await this.resolveStoredFile(material));
    return { fileName: material.name, mimeType: material.mimeType, buffer };
  }

  async update(id: string, input: z.infer<typeof UpdateMaterialBody>): Promise<MaterialRecord> {
    const document = await this.read();
    const index = document.materials.findIndex((item) => item.id === id);
    if (index === -1) throw new Error(`Material not found: ${id}`);
    const current = document.materials[index];
    const next = MaterialRecordSchema.parse({
      ...current,
      name: input.name ?? current.name,
      folder: input.folder === null ? undefined : input.folder ?? current.folder,
      category: input.category === null ? undefined : input.category ?? current.category,
      tags: input.tags ?? current.tags,
      description: input.description === null ? undefined : input.description ?? current.description,
      updatedAt: new Date().toISOString()
    });
    document.materials[index] = next;
    await this.write(document);
    return next;
  }

  async copy(id: string, input: z.infer<typeof CopyMaterialBody> & MaterialMetadataInput): Promise<MaterialRecord> {
    const material = await this.requireMaterial(id);
    if (!material.path) throw new ClientInputError("Material file is unavailable.");
    const buffer = await readFile(await this.resolveStoredFile(material));
    return this.createRecord({
      name: input.name ?? copyName(material.name),
      folder: input.folder === null ? undefined : input.folder ?? material.folder,
      scope: input.scope ?? material.scope,
      category: input.category === null ? undefined : input.category ?? material.category,
      tags: input.tags ?? material.tags,
      description: input.description === null ? undefined : input.description ?? material.description,
      mimeType: material.mimeType,
      buffer,
      declaredSize: material.size,
      extraction: {
        extractionState: material.extractionState,
        textPreview: material.textPreview,
        extractionError: material.extractionError
      }
    });
  }

  private async createRecord(input: { name: string; folder?: string; scope?: MaterialRecord["scope"]; category?: MaterialRecord["category"]; tags?: string[]; description?: string; mimeType: string; buffer: Buffer; declaredSize?: number; extraction: MaterialExtractionResult }): Promise<MaterialRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const document = await this.read();
    const size = input.declaredSize ?? input.buffer.byteLength;
    this.assertQuota(document, size);
    const record = MaterialRecordSchema.parse({
      id,
      name: input.name,
      folder: input.folder,
      scope: input.scope ?? "personal",
      category: input.category,
      tags: input.tags ?? [],
      description: input.description,
      mimeType: input.mimeType,
      size,
      sha256: input.buffer.byteLength ? createHash("sha256").update(input.buffer).digest("hex") : undefined,
      extractionState: input.extraction.extractionState,
      textPreview: input.extraction.textPreview,
      extractionError: input.extraction.extractionError,
      createdAt: now,
      updatedAt: now
    });

    if (input.buffer.byteLength) {
      await ensurePrivateDirectory(this.uploadDir);
      const filePath = path.join(this.uploadDir, `${id}-${safeFileName(input.name) || "upload"}`);
      await writePrivateFile(filePath, input.buffer);
      record.path = filePath;
    }

    document.materials.unshift(record);
    await this.write(document);
    return record;
  }

  private assertQuota(document: MaterialStoreDocument, nextSize: number): void {
    if (document.materials.length >= MAX_MATERIAL_COUNT) throw new ClientInputError(`Material limit reached. Keep at most ${MAX_MATERIAL_COUNT} files.`);
    const total = document.materials.reduce((sum, material) => sum + material.size, 0);
    if (total + nextSize > MAX_TOTAL_MATERIAL_BYTES) throw new ClientInputError(`Material storage exceeds ${formatLimit(MAX_TOTAL_MATERIAL_BYTES)}.`);
  }

  async remove(id: string): Promise<void> {
    const document = await this.read();
    const material = document.materials.find((item) => item.id === id);
    if (!material) throw new Error(`Material not found: ${id}`);
    const storedFile = material.path ? await this.resolveStoredFile(material) : undefined;
    await this.write({ materials: document.materials.filter((item) => item.id !== id) });
    if (storedFile) await unlink(storedFile).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  async assertCompanyMaterial(id: string): Promise<void> {
    const material = await this.requireMaterial(id);
    if (material.scope !== "company") throw new ClientInputError("Company material not found.");
  }

  private async requireMaterial(id: string): Promise<MaterialRecord> {
    const material = (await this.list()).find((item) => item.id === id);
    if (!material) throw new Error(`Material not found: ${id}`);
    return material;
  }

  private async resolveStoredFile(material: MaterialRecord): Promise<string> {
    if (!material.path) throw new ClientInputError("Material file is unavailable.");
    const root = path.resolve(this.uploadDir);
    const resolved = path.resolve(material.path);
    const relative = path.relative(root, resolved);
    const basename = path.basename(resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative) || !basename.startsWith(`${material.id}-`)) {
      throw new ClientInputError("Material file is unavailable.");
    }
    const stats = await lstat(resolved).catch(() => undefined);
    if (!stats?.isFile() || stats.isSymbolicLink()) throw new ClientInputError("Material file is unavailable.");
    return resolved;
  }

  private async read(): Promise<MaterialStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as MaterialStoreDocument;
      return { materials: Array.isArray(parsed.materials) ? parsed.materials.map((material) => MaterialRecordSchema.parse(material)) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { materials: [] };
      throw error;
    }
  }

  private async write(document: MaterialStoreDocument): Promise<void> {
    await writePrivateJson(this.filePath, document);
  }
}

function withAttachedMaterials(content: string, materials: MaterialRecord[]): string {
  if (!materials.length) return content;
  const context = materials.map((material) => {
    if (material.textPreview) {
      return `## ${material.name}\nMIME: ${material.mimeType}\n${material.textPreview}`;
    }
    if (material.extractionState === "failed") {
      return `## ${material.name}\nMIME: ${material.mimeType}\nText extraction failed: ${material.extractionError ?? "No text could be extracted."}`;
    }
    return `## ${material.name}\nMIME: ${material.mimeType}\nThis file was uploaded to Hermills but no text was extracted yet.`;
  });
  return `${content}\n\n--- Attached materials ---\n${context.join("\n\n")}`;
}

function withRuntimeAttachedMaterials(messages: ChatMessage[], materials: MaterialRecord[]): ChatMessage[] {
  if (!materials.length) return messages;
  const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  if (lastUserIndex === -1) return messages;
  return messages.map((message, index) => index === lastUserIndex ? { ...message, content: withAttachedMaterials(message.content, materials) } : message);
}

function withRuntimeCompanyKnowledge(messages: ChatMessage[], companyKnowledgeContext: string): ChatMessage[] {
  if (!companyKnowledgeContext.trim()) return messages;
  const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  if (lastUserIndex === -1) return messages;
  return messages.map((message, index) => index === lastUserIndex
    ? { ...message, content: `${message.content}\n\n--- Company knowledge ---\n${companyKnowledgeContext}` }
    : message);
}

async function buildCompanyKnowledgeContext(companyProfile: CompanyProfileRepository, materials: MaterialRepository): Promise<string> {
  const profile = await companyProfile.get();
  const companyMaterials = await materials.listCompany();
  const blocks = [
    companyProfileContext(profile),
    ...companyMaterials.slice(0, 12).map(companyMaterialContext)
  ].filter(Boolean);
  return blocks.length ? truncateForContext(blocks.join("\n\n"), 30_000) : "";
}

async function assertCompanyProfileReady(companyProfile: CompanyProfileRepository): Promise<void> {
  const profile = await companyProfile.get();
  if (!profile.name.trim() || !profile.website?.trim() || !profile.mainProducts.some((item) => item.trim())) {
    throw new ClientInputError("Company profile is required before generating outreach. Add company name, website, and main products first.");
  }
}

function companyProfileContext(profile: CompanyProfile): string {
  const lines = [
    profile.name ? `Company name: ${profile.name}` : "",
    profile.legalName ? `Legal name: ${profile.legalName}` : "",
    profile.website ? `Website: ${profile.website}` : "",
    profile.markets.length ? `Markets: ${profile.markets.join(", ")}` : "",
    profile.mainProducts.length ? `Main products: ${profile.mainProducts.join(", ")}` : "",
    profile.certifications.length ? `Certifications: ${profile.certifications.join(", ")}` : "",
    profile.paymentTerms.length ? `Payment terms: ${profile.paymentTerms.join(", ")}` : "",
    profile.shippingTerms.length ? `Shipping terms: ${profile.shippingTerms.join(", ")}` : "",
    profile.brandVoice ? `Brand voice: ${profile.brandVoice}` : "",
    profile.notes ? `Notes: ${profile.notes}` : ""
  ].filter(Boolean);
  return lines.length ? `## Company profile\n${lines.join("\n")}` : "";
}

function companyMaterialContext(material: MaterialRecord): string {
  if (material.textPreview) {
    return `## ${material.name}\nMIME: ${material.mimeType}\nCategory: ${material.category ?? "other"}\n${material.description ? `Description: ${material.description}\n` : ""}${material.textPreview}`;
  }
  if (material.extractionState === "failed") {
    return `## ${material.name}\nMIME: ${material.mimeType}\nCategory: ${material.category ?? "other"}\nText extraction failed: ${material.extractionError ?? "No text could be extracted."}`;
  }
  return `## ${material.name}\nMIME: ${material.mimeType}\nCategory: ${material.category ?? "other"}\nThis company file is saved in Hermills but does not have readable text yet.`;
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

function safeDownloadName(value: string): string {
  return safeFileName(value.replace(/[\\/\r\n\0"]+/g, "-")) || "material";
}

function copyName(value: string): string {
  const extension = path.extname(value);
  const stem = extension ? value.slice(0, -extension.length) : value;
  return `${stem} copy${extension}`;
}

function isTextMaterial(name: string, mimeType: string, buffer: Buffer): boolean {
  const extension = path.extname(name).toLowerCase();
  const textExtension = /\.(md|markdown|txt|csv|json|yaml|yml|ts|tsx|js|jsx|py|go|rs|java|css|html|xml)$/i.test(extension);
  if (!mimeType.startsWith("text/") && mimeType !== "application/json" && !textExtension) return false;
  return buffer.byteLength <= MAX_MATERIAL_TEXT_BYTES && !buffer.includes(0);
}

interface MaterialExtractionResult {
  extractionState: MaterialRecord["extractionState"];
  textPreview?: string;
  extractionError?: string;
}

function extractMaterialText(name: string, mimeType: string, buffer: Buffer): MaterialExtractionResult {
  if (!buffer.byteLength) return { extractionState: "stored" };
  if (isTextMaterial(name, mimeType, buffer)) {
    return { extractionState: "indexed", textPreview: truncateForContext(buffer.toString("utf8"), 20_000) };
  }
  if (isPdfMaterial(name, mimeType)) {
    const text = extractPdfText(buffer);
    if (text) return { extractionState: "indexed", textPreview: truncateForContext(text, 20_000) };
    return { extractionState: "failed", extractionError: "No extractable PDF text was found." };
  }
  return { extractionState: "stored" };
}

function isPdfMaterial(name: string, mimeType: string): boolean {
  return mimeType === "application/pdf" || path.extname(name).toLowerCase() === ".pdf";
}

function extractPdfText(buffer: Buffer): string {
  const source = buffer.toString("latin1");
  const chunks: string[] = [];
  const streamPattern = /<<[\s\S]{0,2000}?>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of source.matchAll(streamPattern)) {
    const streamStart = match.index ?? 0;
    const dictionary = source.slice(streamStart, streamStart + match[0].indexOf("stream"));
    let streamBody = Buffer.from(match[1], "latin1");
    if (/\/FlateDecode\b/.test(dictionary)) {
      try {
        streamBody = inflateSync(streamBody);
      } catch {
        continue;
      }
    }
    chunks.push(...extractPdfTextStrings(streamBody.toString("latin1")));
  }
  if (!chunks.length) chunks.push(...extractPdfTextStrings(source));
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function extractPdfTextStrings(content: string): string[] {
  const values: string[] = [];
  for (const match of content.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
    values.push(...decodePdfStringTokens(match[1]));
  }
  for (const match of content.matchAll(/(\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]+>)\s*(?:Tj|'|")/g)) {
    values.push(decodePdfStringToken(match[1]));
  }
  return values.map((value) => value.replace(/\0/g, "").trim()).filter(Boolean);
}

function decodePdfStringTokens(value: string): string[] {
  return [...value.matchAll(/\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]+>/g)].map((match) => decodePdfStringToken(match[0]));
}

function decodePdfStringToken(value: string): string {
  if (value.startsWith("<")) return decodePdfHex(value);
  return decodePdfLiteral(value);
}

function decodePdfHex(value: string): string {
  const hex = value.slice(1, -1).replace(/\s+/g, "");
  const normalized = hex.length % 2 === 0 ? hex : `${hex}0`;
  if (normalized.toLowerCase().startsWith("feff")) {
    const chars: string[] = [];
    for (let index = 4; index < normalized.length; index += 4) {
      chars.push(String.fromCharCode(Number.parseInt(normalized.slice(index, index + 4), 16)));
    }
    return chars.join("");
  }
  return Buffer.from(normalized, "hex").toString("utf8");
}

function decodePdfLiteral(value: string): string {
  const body = value.slice(1, -1);
  let output = "";
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char !== "\\") {
      output += char;
      continue;
    }
    const next = body[index + 1];
    if (!next) break;
    if (next === "\r" || next === "\n") {
      if (next === "\r" && body[index + 2] === "\n") index += 1;
      index += 1;
      continue;
    }
    const escapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
    if (next in escapes) {
      output += escapes[next];
      index += 1;
      continue;
    }
    const octal = body.slice(index + 1).match(/^[0-7]{1,3}/)?.[0];
    if (octal) {
      output += String.fromCharCode(Number.parseInt(octal, 8));
      index += octal.length;
      continue;
    }
    output += next;
    index += 1;
  }
  return output;
}

function truncateForContext(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const head = value.slice(0, Math.floor(maxLength * 0.65));
  const tail = value.slice(-Math.floor(maxLength * 0.25));
  return `${head}\n\n[...truncated for context...]\n\n${tail}`;
}

function estimateMessageUsage(promptText: string, replyText: string): NonNullable<ChatMessage["usage"]> {
  const inputTokens = estimateTokens(promptText);
  const outputTokens = estimateTokens(replyText);
  const totalTokens = inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens, estimatedCostUsd: Number((totalTokens * 0.0000005).toFixed(6)) };
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.trim().length / 4));
}

function usageSummary(sessions: ChatSession[], materials: MaterialRecord[], providers: ProviderCredential[], agents: Awaited<ReturnType<AgentRepository["list"]>>) {
  const messages = sessions.flatMap((session) => session.messages);
  const usage = messages.reduce((sum, message) => ({
    inputTokens: sum.inputTokens + (message.usage?.inputTokens ?? 0),
    outputTokens: sum.outputTokens + (message.usage?.outputTokens ?? 0),
    totalTokens: sum.totalTokens + (message.usage?.totalTokens ?? 0),
    estimatedCostUsd: sum.estimatedCostUsd + (message.usage?.estimatedCostUsd ?? 0)
  }), { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 });
  return {
    conversations: sessions.length,
    messages: messages.length,
    files: materials.length,
    fileBytes: materials.reduce((sum, material) => sum + material.size, 0),
    providers: providers.length,
    connectedProviders: providers.filter((provider) => provider.enabled).length,
    agents: agents.length,
    usage: {
      ...usage,
      estimatedCostUsd: Number(usage.estimatedCostUsd.toFixed(6))
    }
  };
}

async function runJobNow(
  id: string,
  jobs: JobRepository,
  logs: LogRepository,
  runtime: RuntimeAdapter,
  agents: AgentRepository,
  providers: ProviderRepository,
  materials: MaterialRepository,
  companyProfile: CompanyProfileRepository
): Promise<JobRunRecord> {
  const job = await jobs.get(id);
  if (!job || job.deletedAt) throw new ClientInputError(`Job not found: ${id}`);
  const startedAt = new Date().toISOString();
  if (job.status === "paused") {
    return jobs.recordRun(JobRunRecordSchema.parse({
      id: randomUUID(),
      profileId: job.profileId,
      jobId: job.id,
      trigger: "manual",
      status: "skipped",
      startedAt,
      finishedAt: new Date().toISOString(),
      input: job.task.prompt,
      error: "Job is paused.",
      model: job.task.model,
      providerId: job.task.providerId
    }));
  }

  try {
    const agent = job.task.agentId ? await agents.get(job.task.agentId).catch(() => undefined) : undefined;
    const providerId = job.task.providerId ?? agent?.providerId;
    const providerRecord = providerId ? await providers.get(providerId).catch(() => undefined) : undefined;
    const apiKey = providerRecord ? await providers.readApiKey(providerRecord).catch(() => undefined) : undefined;
    const attachedMaterials = job.task.materialIds.length ? await materials.getMany(job.task.materialIds) : [];
    const companyKnowledgeContext = await buildCompanyKnowledgeContext(companyProfile, materials);
    const content = withRuntimeCompanyKnowledge(
      [{ id: randomUUID(), role: "user", content: withAttachedMaterials(job.task.prompt, attachedMaterials), createdAt: startedAt }],
      companyKnowledgeContext
    )[0].content;
    const replyText = await runtime.createHermesReply({
      messages: [{ id: randomUUID(), role: "user", content, createdAt: startedAt }],
      model: job.task.model ?? agent?.model,
      instructions: agent?.instructions,
      provider: providerRecord ? {
        kind: providerRecord.kind,
        baseUrl: providerRecord.baseUrl,
        apiKey,
        defaultModel: providerRecord.defaultModel
      } : undefined
    });
    const run = JobRunRecordSchema.parse({
      id: randomUUID(),
      profileId: job.profileId,
      jobId: job.id,
      trigger: "manual",
      status: "succeeded",
      startedAt,
      finishedAt: new Date().toISOString(),
      input: job.task.prompt,
      outputPreview: truncateForContext(replyText, 2000),
      usage: estimateMessageUsage(content, replyText),
      model: job.task.model ?? agent?.model ?? providerRecord?.defaultModel,
      providerId
    });
    await logs.create({ source: "job", level: "done", message: `Job "${job.name}" completed.` });
    return jobs.recordRun(run);
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    await logs.create({ source: "job", level: "error", message: `Job "${job.name}" failed: ${message}` });
    return jobs.recordRun(JobRunRecordSchema.parse({
      id: randomUUID(),
      profileId: job.profileId,
      jobId: job.id,
      trigger: "manual",
      status: "failed",
      startedAt,
      finishedAt: new Date().toISOString(),
      input: job.task.prompt,
      error: message,
      model: job.task.model,
      providerId: job.task.providerId
    }));
  }
}

function analyticsSummary(
  summary: ReturnType<typeof usageSummary>,
  jobs: JobRecord[],
  runs: JobRunRecord[],
  channels: ChannelRecord[],
  logs: LogEntry[]
) {
  return {
    ...summary,
    jobs: jobs.filter((job) => !job.deletedAt).length,
    activeJobs: jobs.filter((job) => !job.deletedAt && job.status === "active").length,
    jobRuns: runs.length,
    failedJobRuns: runs.filter((run) => run.status === "failed").length,
    channels: channels.length,
    connectedChannels: channels.filter((channel) => channel.status === "connected").length,
    logs: logs.length,
    errorLogs: logs.filter((entry) => entry.level === "error").length
  };
}

type UsageEvent = {
  source: "chat" | "job-run";
  providerId?: string;
  model?: string;
  usage: NonNullable<ChatMessage["usage"]>;
  createdAt: string;
};

function analyticsUsage(sessions: ChatSession[], runs: JobRunRecord[], source?: UsageEvent["source"], bucket: "day" | "week" | "month" = "day") {
  const chatEvents: UsageEvent[] = sessions.flatMap((session) => session.messages.flatMap((message) => message.usage ? [{
    source: "chat" as const,
    providerId: session.providerId,
    model: session.model,
    usage: message.usage,
    createdAt: message.createdAt
  }] : []));
  const jobEvents: UsageEvent[] = runs.flatMap((run) => run.usage ? [{
    source: "job-run" as const,
    providerId: run.providerId,
    model: run.model,
    usage: run.usage,
    createdAt: run.finishedAt ?? run.startedAt
  }] : []);
  const events = [...chatEvents, ...jobEvents].filter((event) => !source || event.source === source);
  const totals = aggregateUsage(events.map((event) => event.usage));
  return {
    totals,
    buckets: aggregateBy(events, (event) => bucketKey(event.createdAt, bucket)),
    models: aggregateBy(events, (event) => event.model ?? "unknown"),
    providers: aggregateBy(events, (event) => event.providerId ?? "local"),
    sources: aggregateBy(events, (event) => event.source)
  };
}

function aggregateBy(events: UsageEvent[], keyFn: (event: UsageEvent) => string) {
  const grouped = new Map<string, UsageEvent[]>();
  for (const event of events) {
    const key = keyFn(event);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }
  return [...grouped.entries()].map(([key, items]) => ({
    key,
    messages: items.filter((item) => item.source === "chat").length,
    runs: items.filter((item) => item.source === "job-run").length,
    ...aggregateUsage(items.map((item) => item.usage))
  }));
}

function aggregateUsage(usages: Array<NonNullable<ChatMessage["usage"]>>) {
  const usage = usages.reduce<{ inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number }>((sum, item) => ({
    inputTokens: sum.inputTokens + item.inputTokens,
    outputTokens: sum.outputTokens + item.outputTokens,
    totalTokens: sum.totalTokens + item.totalTokens,
    estimatedCostUsd: sum.estimatedCostUsd + (item.estimatedCostUsd ?? 0)
  }), { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 });
  return { ...usage, estimatedCostUsd: Number(usage.estimatedCostUsd.toFixed(6)) };
}

function bucketKey(value: string, bucket: "day" | "week" | "month"): string {
  if (bucket === "month") return value.slice(0, 7);
  if (bucket === "week") {
    const date = new Date(value);
    const start = new Date(date);
    start.setUTCDate(date.getUTCDate() - date.getUTCDay());
    return start.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function estimateNextRunAt(value: string): string {
  return new Date(new Date(value).getTime() + 60 * 60 * 1000).toISOString();
}

function channelStatus(enabled: boolean, hasSecret: boolean, endpoint?: string): ChannelRecord["status"] {
  if (!enabled) return "disabled";
  return hasSecret || endpoint ? "connected" : "needs-setup";
}

function createChatControlBindingCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
}

function createChatControlRelaySecret(): string {
  return `${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
}

function chatControlRelayUrl(): string | undefined {
  return normalizeChatControlRelayUrl(process.env.HERMILLS_CHAT_RELAY_URL);
}

function normalizeChatControlRelayUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) return undefined;
  const lowered = normalized.toLowerCase();
  if (lowered === "undefined" || lowered === "null") return undefined;
  if (lowered.includes("your-chat-relay.example.com")) return undefined;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function isOfficialChatControlPlatform(platform: ChannelRecord["kind"]): boolean {
  return platform === "feishu" || platform === "dingtalk" || platform === "wecom" || platform === "wechat" || platform === "qq";
}

function chatControlPlatformLabel(platform: ChannelRecord["kind"]): string {
  if (platform === "feishu") return "飞书";
  if (platform === "dingtalk") return "钉钉";
  if (platform === "wecom") return "企业微信";
  if (platform === "wechat") return "微信官方入口";
  if (platform === "qq") return "QQ";
  return platform;
}

type UnknownRecord = Record<string, unknown>;

function verifyChatWebhookSecret(secret: string, headers: FastifyRequest["headers"], token?: string): boolean {
  const authorization = headerString(headers.authorization);
  const candidates = [
    token,
    headerString(headers["x-hermills-channel-secret"]),
    headerString(headers["x-chat-control-secret"]),
    authorization?.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : undefined
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.some((candidate) => safeEqual(candidate, secret));
}

function headerString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function extractChatWebhookChallenge(body: UnknownRecord): string | undefined {
  return stringFromUnknown(body.challenge) ?? stringFromUnknown(valueAt(body, ["event", "challenge"]));
}

function extractChatWebhookText(_platform: ChannelRecord["kind"], body: UnknownRecord): string | undefined {
  return normalizeChatWebhookText(firstNestedValue(body, [
    ["rawText"],
    ["command"],
    ["text"],
    ["content"],
    ["message"],
    ["text", "content"],
    ["event", "message", "content"],
    ["event", "message", "text"],
    ["message", "text", "content"],
    ["message", "content"],
    ["conversation", "message", "text"]
  ]));
}

function extractChatWebhookConversationId(_platform: ChannelRecord["kind"], body: UnknownRecord): string {
  return stringFromUnknown(firstNestedValue(body, [
    ["conversationId"],
    ["conversation_id"],
    ["chatId"],
    ["chat_id"],
    ["event", "message", "chat_id"],
    ["conversation", "id"]
  ])) ?? "chat-webhook";
}

function extractChatWebhookSenderId(_platform: ChannelRecord["kind"], body: UnknownRecord): string {
  return stringFromUnknown(firstNestedValue(body, [
    ["senderId"],
    ["sender_id"],
    ["userId"],
    ["user_id"],
    ["senderStaffId"],
    ["event", "sender", "sender_id", "user_id"],
    ["event", "sender", "sender_id", "open_id"],
    ["sender", "id"]
  ])) ?? "chat-user";
}

function extractChatWebhookSenderName(_platform: ChannelRecord["kind"], body: UnknownRecord): string {
  return stringFromUnknown(firstNestedValue(body, [
    ["senderDisplayName"],
    ["senderName"],
    ["senderNick"],
    ["userNick"],
    ["userName"],
    ["event", "sender", "sender_id", "union_id"],
    ["event", "sender", "sender_name"],
    ["sender", "name"]
  ])) ?? "";
}

function firstNestedValue(body: UnknownRecord, paths: string[][]): unknown {
  for (const pathParts of paths) {
    const value = valueAt(body, pathParts);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function valueAt(value: unknown, pathParts: string[]): unknown {
  let current = value;
  for (const part of pathParts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function normalizeChatWebhookText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return normalizeChatWebhookText(parsed) ?? trimmed;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (isRecord(value)) {
    return normalizeChatWebhookText(firstNestedValue(value, [
      ["text"],
      ["content"],
      ["message"],
      ["plain_text"]
    ]));
  }
  return undefined;
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ChatControlIntent {
  action: ChatControlCommand["action"];
  payload: Record<string, unknown>;
}

function parseChatControlIntent(rawText: string): ChatControlIntent {
  const text = rawText.trim();
  const approvalCode = text.match(/(?:确认发送|confirm\s+send|send\s+confirm)\s*([0-9]{4,8})/i)?.[1];
  if (approvalCode) return { action: "send-draft", payload: { approvalCode } };
  if (/^(help|帮助|菜单|可以做什么)\b/i.test(text)) return { action: "help", payload: {} };
  if (/(状态|概览|今日|dashboard|status|summary)/i.test(text)) return { action: "status", payload: {} };
  if (/(查回复|检查回复|收件箱|inbox|reply|replies)/i.test(text)) return { action: "check-inbox", payload: {} };
  if (/(查看草稿|列出草稿|草稿列表|list\s+drafts|drafts)/i.test(text)) return { action: "list-drafts", payload: {} };
  if (/(评分|审核|review)/i.test(text) && /(草稿|draft)/i.test(text)) return { action: "review-draft", payload: { draftId: extractChatControlId(text) } };
  if (/(重写|rewrite|改写)/i.test(text) && /(草稿|draft|邮件|email)/i.test(text)) return { action: "rewrite-draft", payload: { draftId: extractChatControlId(text) } };
  if (/(发送|send)/i.test(text) && /(草稿|draft|邮件|email)/i.test(text)) return { action: "send-draft", payload: { draftId: extractChatControlId(text) } };
  if (/(写|生成|开发信|cold email|outreach|email)/i.test(text)) {
    const website = extractChatControlWebsite(text);
    const email = extractEmail(text);
    if (website || email) return { action: "generate-outreach-draft", payload: { website, email } };
  }
  return { action: "unknown", payload: {} };
}

function extractEmail(text: string): string | undefined {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function extractChatControlWebsite(text: string): string | undefined {
  const explicit = text.match(/https?:\/\/[^\s，。；,;]+/i)?.[0];
  if (explicit) return explicit.replace(/[)\]}]+$/, "");
  const domain = text.match(/\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/i)?.[0];
  if (!domain || domain.includes("@")) return undefined;
  return `https://${domain}`;
}

function extractChatControlId(text: string): string | undefined {
  return text.match(/\b[0-9a-f]{6,8}(?:-[0-9a-f-]{8,})?\b/i)?.[0];
}

function stringPayload(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function createApprovalCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function chatControlHelpText(): string {
  return [
    "Hermills 聊天控制可以这样用：",
    "1. 今日状态",
    "2. 给 buyer@company.com https://company.com 写开发信",
    "3. 查看草稿",
    "4. 审核草稿 草稿ID",
    "5. 重写草稿 草稿ID",
    "6. 检查回复",
    "7. 发送草稿 草稿ID（会先给确认码，不会直接发送）"
  ].join("\n");
}

function chatControlDraftSummary(draft: OutreachDraft): string {
  const score = draft.qualityReview?.score;
  const scoreLine = typeof score === "number" ? `质量分：${score} 分。` : "";
  return [
    `已生成开发信草稿 ${draft.id.slice(0, 8)}。${scoreLine}`,
    `主题：${draft.subject}`,
    truncatePlain(draft.body, 900),
    `要发送请回复：发送草稿 ${draft.id.slice(0, 8)}`
  ].filter(Boolean).join("\n\n");
}

async function resolveChatControlDraft(payload: Record<string, unknown>, profileId: string, drafts: OutreachDraftRepository): Promise<OutreachDraft> {
  const draftId = stringPayload(payload, "draftId");
  const all = await drafts.list({ profileId });
  const draft = draftId
    ? all.find((item) => item.id === draftId || item.id.startsWith(draftId))
    : all[0];
  if (!draft) throw new ClientInputError("找不到草稿。请先发送：查看草稿，然后带上草稿ID。");
  return draft;
}

async function resolveChatControlSender(profileId: string, senders: OutreachSenderRepository): Promise<OutreachSenderAccount> {
  const sender = (await senders.list({ profileId })).find((item) => item.enabled && item.deliveryConfirmedAt);
  if (!sender) throw new ClientInputError("还没有已确认的发件邮箱。请先在 Hermills 邮箱页保存并测试邮箱。");
  return sender;
}

function inferLogLevel(value: string): LogEntry["level"] {
  if (/\b(error|failed|exception|fatal)\b/i.test(value)) return "error";
  if (/\b(warn|warning)\b/i.test(value)) return "warn";
  if (/\b(done|completed|ready|success)\b/i.test(value)) return "done";
  if (/\b(debug|trace)\b/i.test(value)) return "debug";
  return "info";
}

function inferLogCreatedAt(value: string): string | undefined {
  const match = value.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
  return match?.[0];
}

async function ensurePrivateDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
  await chmod(dirPath, 0o700).catch(() => undefined);
}

async function writePrivateFile(filePath: string, body: Buffer | string): Promise<void> {
  await ensurePrivateDirectory(path.dirname(filePath));
  await writeFile(filePath, body, { mode: 0o600 });
  await chmod(filePath, 0o600).catch(() => undefined);
}

async function writePrivateJson(filePath: string, value: unknown): Promise<void> {
  await ensurePrivateDirectory(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(tmpPath, filePath);
  await chmod(filePath, 0o600).catch(() => undefined);
}

function formatLimit(value: number): string {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round(value / 1024 / 1024)} MB`;
}

function parseBooleanQuery(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function errorBody(code: string, message: string, detail?: unknown) {
  return { error: { code, message, detail } };
}

class ClientInputError extends Error {}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.env.HERMILLS_PORT ?? "47321");
  const host = process.env.HERMILLS_HOST ?? "127.0.0.1";
  const server = await createServer({ host, port, baseDir: process.env.HERMILLS_HOME, desktopToken: process.env.HERMILLS_DESKTOP_TOKEN });
  await server.listen({ host, port });
}
