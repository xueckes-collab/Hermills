import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import nodemailer from "nodemailer";
import { z } from "zod";
import { AgentRepository, LocalCredentialVault, ProviderRepository } from "@hermills/agent-builder";
import {
  AgentDefinitionSchema,
  CapabilitySchema,
  ChannelKindSchema,
  ChannelRecordSchema,
  ChatMessageSchema,
  ChatSessionSchema,
  getDataHome,
  getLogHome,
  CompanyMaterialCategorySchema,
  CompanyProfileSchema,
  CompanyProfileUpdateSchema,
  InstallRequestSchema,
  JobRecordSchema,
  JobRunRecordSchema,
  JobStatusSchema,
  MaterialRecordSchema,
  LogEntrySchema,
  LogLevelSchema,
  LogSourceSchema,
  previewSecret,
  CustomerResearchSummarySchema,
  CustomerResearchSnapshotSchema,
  OutreachResearchDepthSchema,
  OutreachCampaignRecipientSchema,
  OutreachCampaignSchema,
  OutreachDraftSchema,
  OutreachEmailQualityReviewSchema,
  OutreachFeedbackSchema,
  OutreachFollowUpJobSchema,
  OutreachLeadSchema,
  OutreachSenderAccountSchema,
  OutreachWorkflowSchema,
  ProviderCredentialSchema,
  RuntimeStatusSchema,
  redactSecrets,
  type AppState,
  type ChannelRecord,
  type ChatMessage,
  type ChatSession,
  type CompanyProfile,
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
  type OutreachCampaign,
  type OutreachCampaignRecipient,
  type OutreachDraft,
  type OutreachEmailQualityReview,
  type OutreachFeedback,
  type OutreachFollowUpJob,
  type OutreachLead,
  type OutreachResearchDepth,
  type OutreachSenderAccount,
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

export interface ServerOptions {
  host?: string;
  port?: number;
  baseDir?: string;
  desktopToken?: string;
  allowInsecureDev?: boolean;
  runtimeService?: RuntimeAdapter;
  fetchImpl?: typeof fetch;
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
  dispose?(): Promise<void>;
}

const MAX_MATERIAL_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MATERIAL_TEXT_BYTES = 1_000_000;
const MAX_MATERIAL_COUNT = 200;
const MAX_TOTAL_MATERIAL_BYTES = 250 * 1024 * 1024;

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
  notes: z.string().trim().max(4000).default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(24).default([])
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

const GenerateOutreachDraftBody = z.object({
  profileId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
  lead: OutreachLeadInputBody.optional(),
  language: z.string().trim().min(1).max(80).default("English"),
  tone: z.string().trim().min(1).max(120).default("professional, warm, concise"),
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

const CreateOutreachSenderBody = z.object({
  profileId: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(120),
  fromName: OptionalOnboardingString(160),
  email: z.string().trim().min(3).max(320),
  host: z.string().trim().min(1).max(240),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  imapHost: OptionalOnboardingString(240),
  imapPort: z.coerce.number().int().min(1).max(65535).optional(),
  imapSecure: z.boolean().optional(),
  imapUsername: OptionalOnboardingString(320),
  username: OptionalOnboardingString(320),
  password: OptionalOnboardingString(4000),
  enabled: z.boolean().default(true)
}).strict();

const UpdateOutreachSenderBody = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  fromName: OptionalOnboardingString(160).nullable().optional(),
  email: z.string().trim().min(3).max(320).optional(),
  host: z.string().trim().min(1).max(240).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  imapHost: OptionalOnboardingString(240).nullable().optional(),
  imapPort: z.coerce.number().int().min(1).max(65535).nullable().optional(),
  imapSecure: z.boolean().nullable().optional(),
  imapUsername: OptionalOnboardingString(320).nullable().optional(),
  username: OptionalOnboardingString(320).nullable().optional(),
  password: OptionalOnboardingString(4000),
  clearPassword: z.boolean().optional(),
  enabled: z.boolean().optional()
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
  researchDepth: OutreachResearchDepthSchema.default("standard"),
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
      if (request.headers["x-hermills-token"] !== options.desktopToken) {
        await reply.code(401).send(errorBody("UNAUTHORIZED", "Invalid Hermills desktop token."));
      }
    });
  }

  const agents = new AgentRepository(options.baseDir, { seedBuiltinAgents: true });
  const providers = new ProviderRepository(options.baseDir);
  const runtime: RuntimeAdapter = options.runtimeService ?? new RuntimeService({ baseDir: options.baseDir });
  const chats = new ChatRepository(options.baseDir);
  const materials = new MaterialRepository(options.baseDir);
  const appState = new AppStateRepository(options.baseDir);
  const onboarding = new OnboardingRepository(options.baseDir);
  const companyProfile = new CompanyProfileRepository(options.baseDir);
  const outreachLeads = new OutreachLeadRepository(options.baseDir);
  const outreachDrafts = new OutreachDraftRepository(options.baseDir);
  const outreachSenders = new OutreachSenderRepository(options.baseDir);
  const outreachWorkflows = new OutreachWorkflowRepository(options.baseDir);
  const outreachCampaigns = new OutreachCampaignRepository(options.baseDir);
  const outreachFollowUps = new OutreachFollowUpRepository(options.baseDir);
  const outreachFeedback = new OutreachFeedbackRepository(options.baseDir);
  const profiles = new ProfileRepository(options.baseDir);
  const jobs = new JobRepository(options.baseDir);
  const channels = new ChannelRepository(options.baseDir);
  const logs = new LogRepository(options.baseDir);
  const fetchImpl = options.fetchImpl ?? fetch;
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

  server.get("/api/health", async () => ({ ok: true, product: "Hermills" }));
  server.get("/api/app-state", async () => appState.response(await runtime.getStatus()));
  server.get("/api/onboarding", async () => onboarding.get());
  server.put("/api/onboarding", async (request) => onboarding.update(OnboardingUpdateSchema.parse(request.body ?? {})));
  server.post("/api/onboarding/complete", async (request) => {
    const body = OnboardingUpdateSchema.parse(request.body ?? {});
    return completeOnboarding(body, onboarding, profiles, agents, providers);
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
  server.post("/api/settings/providers", async (request) => publicProvider(await providers.create(UpsertProviderBody.parse(request.body))));
  server.put("/api/settings/providers/:id", async (request) => {
    const { id } = request.params as { id: string };
    return publicProvider(await providers.update(id, UpsertProviderBody.partial().parse(request.body)));
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
  server.post("/api/outreach/leads", async (request) => {
    const body = CreateOutreachLeadBody.parse(request.body ?? {});
    return outreachLeads.create({ ...body, profileId: await resolveProfileId(body.profileId) });
  });
  server.post("/api/outreach/leads/import", async (request) => {
    const body = ImportOutreachLeadsBody.parse(request.body ?? {});
    return outreachLeads.importCsv(body.csvText, await resolveProfileId(body.profileId));
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
    return generateOutreachDraft({
      lead,
      body,
      profileId,
      runtime,
      providers,
      companyProfile,
      materials,
      drafts: outreachDrafts
    });
  });
  server.post("/api/outreach/drafts/auto", async (request) => {
    const body = AutoOutreachDraftBody.parse(request.body ?? {});
    const workflow = await generateOutreachWorkflow({
      body,
      runtime,
      providers,
      companyProfile,
      materials,
      leads: outreachLeads,
      drafts: outreachDrafts,
      workflows: outreachWorkflows,
      profileId: await resolveProfileId(body.profileId)
    });
    return outreachDrafts.require(workflow.draftId);
  });
  server.post("/api/outreach/workflows/auto", async (request) => {
    const body = AutoOutreachDraftBody.parse(request.body ?? {});
    return generateOutreachWorkflow({
      body,
      runtime,
      providers,
      companyProfile,
      materials,
      leads: outreachLeads,
      drafts: outreachDrafts,
      workflows: outreachWorkflows,
      profileId: await resolveProfileId(body.profileId)
    });
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
      language: body.language,
      tone: body.tone,
      providerId: body.providerId,
      model: body.model,
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
      leads: outreachLeads,
      drafts: outreachDrafts,
      workflows: outreachWorkflows,
      campaigns: outreachCampaigns
    });
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
      campaigns: outreachCampaigns
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
      followUps: outreachFollowUps
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
    await outreachDrafts.update(id, { qualityReview: review });
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
      drafts: outreachDrafts
    });
  });
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
    return sendOutreachDraft({ draft, sender, lead, to: body.to, senders: outreachSenders, drafts: outreachDrafts });
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

  server.setErrorHandler(async (error, _request, reply) => {
    const code = error instanceof z.ZodError || error instanceof ClientInputError ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
    const status = error instanceof z.ZodError || error instanceof ClientInputError ? 400 : 500;
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    const stack = error instanceof Error ? error.stack : undefined;
    server.log.error(redactSecrets(stack ?? message));
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
        ? `我已经按你的要求操作这台 Mac。\n\n${output}`
        : "我已经按你的要求操作这台 Mac。";
    } else {
      replyText = output
        ? `这次没有完成电脑操作。\n\n${output}`
        : `这次没有完成电脑操作。${redactSecrets(result.message)}`;
    }
  } catch (error) {
    const detail = redactSecrets(error instanceof Error ? error.message : String(error));
    replyText = [
      "我已经把电脑操作作为内置能力处理，但这次还没有完成。",
      "如果 macOS 弹出“屏幕录制、辅助功能、自动化、文件夹权限”的请求，请允许 Hermills/Hermes。",
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
  providers: ProviderRepository
): Promise<OnboardingState> {
  const draft = await onboarding.update(input);
  const providerInput = input.provider === undefined ? draft.provider : input.provider;
  const provider = providerInput ? await upsertOnboardingProvider(providerInput, providers) : undefined;
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

async function upsertDefaultOnboardingAgent(input: {
  state: OnboardingState;
  defaultAgentId?: string;
  providerId?: string;
  agents: AgentRepository;
}) {
  const displayName = displayNameOrDefault(input.state.agentName, "Hermes");
  const agentInput = {
    displayName,
    description: "Default assistant created during onboarding.",
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
  const origins = new Set(["http://127.0.0.1:5177", "http://localhost:5177"]);
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

interface OutreachDraftStoreDocument {
  drafts: OutreachDraft[];
}

interface OutreachSenderStoreDocument {
  senders: OutreachSenderAccount[];
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

  async create(input: Omit<OutreachDraft, "id" | "status" | "createdAt" | "updatedAt"> & Partial<Pick<OutreachDraft, "status">>): Promise<OutreachDraft> {
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

  async update(id: string, input: z.infer<typeof UpdateOutreachDraftBody> & Partial<Pick<OutreachDraft, "status" | "sentAt" | "sendError" | "qualityReview">>): Promise<OutreachDraft> {
    return this.withWriteLock(async () => {
      const document = await this.read();
      const index = document.drafts.findIndex((draft) => draft.id === id);
      if (index === -1) throw new ClientInputError(`Outreach draft not found: ${id}`);
      const clearsReview = (input.subject !== undefined || input.body !== undefined) && input.qualityReview === undefined;
      const next = OutreachDraftSchema.parse({
        ...document.drafts[index],
        ...input,
        qualityReview: clearsReview ? undefined : input.qualityReview ?? document.drafts[index].qualityReview,
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
        researchDepth: input.researchDepth ?? "standard",
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
      stats: campaignStats(document.recipients.filter((recipient) => recipient.campaignId === campaign.id))
    }));
    const recipients = document.recipients.map((recipient) => OutreachCampaignRecipientSchema.parse(recipient));
    await writePrivateJson(this.filePath, { campaigns, recipients });
    return { campaigns, recipients };
  }
}

class OutreachSenderRepository {
  private readonly filePath: string;
  private readonly vault: LocalCredentialVault;

  constructor(private readonly baseDir?: string) {
    this.filePath = path.join(getDataHome(baseDir), "outreach-senders.json");
    this.vault = new LocalCredentialVault(baseDir);
  }

  async list(options: Pick<OutreachListOptions, "profileId"> = {}): Promise<OutreachSenderAccount[]> {
    return (await this.read()).senders.filter((sender) => !options.profileId || sender.profileId === options.profileId);
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
    const passwordRef = input.password ? await this.vault.saveSecret(`outreach-sender-${id}`, input.password) : undefined;
    const imap = inferImapSettings(input);
    const sender = OutreachSenderAccountSchema.parse({
      id,
      profileId: input.profileId,
      label: input.label,
      fromName: input.fromName,
      email: input.email,
      host: input.host,
      port: input.port,
      secure: input.secure,
      imapHost: input.imapHost ?? imap.host,
      imapPort: input.imapPort ?? imap.port,
      imapSecure: input.imapSecure ?? imap.secure,
      imapUsername: input.imapUsername ?? input.username ?? input.email,
      username: input.username,
      passwordRef,
      passwordPreview: input.password ? previewSecret(input.password) : undefined,
      enabled: input.enabled,
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
    const next = OutreachSenderAccountSchema.parse({
      ...current,
      label: input.label ?? current.label,
      fromName: input.fromName === null ? undefined : input.fromName ?? current.fromName,
      email: input.email ?? current.email,
      host: input.host ?? current.host,
      port: input.port ?? current.port,
      secure: input.secure ?? current.secure,
      imapHost: input.imapHost === null ? undefined : input.imapHost ?? current.imapHost ?? inferImapSettings({ ...current, ...input }).host,
      imapPort: input.imapPort === null ? undefined : input.imapPort ?? current.imapPort ?? inferImapSettings({ ...current, ...input }).port,
      imapSecure: input.imapSecure === null ? undefined : input.imapSecure ?? current.imapSecure ?? inferImapSettings({ ...current, ...input }).secure,
      imapUsername: input.imapUsername === null ? undefined : input.imapUsername ?? current.imapUsername ?? input.username ?? current.username ?? input.email ?? current.email,
      username: input.username === null ? undefined : input.username ?? current.username,
      passwordRef,
      passwordPreview,
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

  async test(id: string): Promise<{ ok: boolean; message: string; sender: Omit<OutreachSenderAccount, "passwordRef"> }> {
    const sender = await this.require(id);
    try {
      await (await this.createTransporter(sender)).verify();
      const next = await this.updateTestState(id, { lastError: undefined, markLoginTested: true });
      return { ok: true, message: "SMTP connection is ready.", sender: publicOutreachSender(next) };
    } catch (error) {
      const message = redactSecrets(error instanceof Error ? error.message : String(error));
      const next = await this.updateTestState(id, { lastError: message, markLoginTested: true });
      return { ok: false, message, sender: publicOutreachSender(next) };
    }
  }

  async sendTestEmail(id: string, to?: string): Promise<{ ok: boolean; message: string; sender: Omit<OutreachSenderAccount, "passwordRef"> }> {
    const sender = await this.require(id);
    const target = to?.trim() || sender.email;
    if (!target) throw new ClientInputError("Test email recipient is missing.");
    try {
      const transporter = await this.createTransporter(sender);
      await transporter.verify();
      await transporter.sendMail({
        from: formatEmailAddress(sender.fromName, sender.email),
        to: target,
        subject: "Hermills mailbox test",
        text: [
          "Hermills sent this test email to confirm your mailbox can send real outreach messages.",
          "",
          "If you received it, go back to Hermills and click \"I received it\"."
        ].join("\n")
      });
      const next = await this.updateTestState(id, { lastError: undefined, markLoginTested: true, markTestEmailSent: true });
      return { ok: true, message: `Test email sent to ${target}.`, sender: publicOutreachSender(next) };
    } catch (error) {
      const message = redactSecrets(error instanceof Error ? error.message : String(error));
      const next = await this.updateTestState(id, { lastError: message, markLoginTested: true });
      return { ok: false, message, sender: publicOutreachSender(next) };
    }
  }

  async confirmDelivery(id: string): Promise<OutreachSenderAccount> {
    return this.updateTestState(id, { lastError: undefined, markDeliveryConfirmed: true });
  }

  async createTransporter(sender: OutreachSenderAccount) {
    const password = sender.passwordRef ? await this.vault.readSecret(sender.passwordRef) : undefined;
    const user = sender.username ?? sender.email;
    return nodemailer.createTransport({
      host: sender.host,
      port: sender.port,
      secure: sender.secure,
      auth: password ? { user, pass: password } : undefined
    });
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

  async create(input: Omit<OutreachFeedback, "id" | "createdAt" | "updatedAt" | "status"> & Partial<Pick<OutreachFeedback, "status">>): Promise<OutreachFeedback> {
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
type PublicOutreachSenderAccount = Omit<OutreachSenderAccount, "passwordRef">;
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
  const { passwordRef: _passwordRef, ...safeSender } = sender;
  return safeSender;
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
  textPreview: string;
  error?: string;
}

interface WebsitePageResult {
  url: string;
  html?: string;
  error?: string;
}

async function researchCustomerWebsite(rawWebsite: string, depth: OutreachResearchDepth = "standard"): Promise<CustomerResearchResult> {
  const website = normalizeWebsiteUrl(rawWebsite);
  const limits = researchDepthLimits(depth);
  const initial = await fetchWebsitePage(website);
  if (!initial.html) {
    return {
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
      textPreview: "",
      error: initial.error || "Could not fetch customer website."
    };
  }

  const urls = [website, ...pickResearchLinks(website, initial.html, depth)].slice(0, limits.pages);
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
  return {
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
    textPreview
  };
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
  if (depth === "deep") return { pages: 8, textChars: 12_000 };
  return { pages: 4, textChars: 8_000 };
}

function researchConcurrency(depth: OutreachResearchDepth): number {
  if (depth === "quick") return 6;
  if (depth === "deep") return 2;
  return 4;
}

function pickResearchLinks(baseUrl: string, html: string, depth: OutreachResearchDepth): string[] {
  const base = new URL(baseUrl);
  const researchPattern = depth === "deep"
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
    .replace(/&#39;/gi, "'");
}

function inferCompanyName(title: string, description: string, website: string): string {
  const fromTitle = title.split(/\s[-|–—]\s/)[0]?.trim();
  const candidate = fromTitle || description.split(/[.。]/)[0]?.trim();
  if (candidate && candidate.length <= 80) return candidate;
  return companyNameFromWebsite(website);
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
  return [
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
    research.fetchedUrls.length ? `Checked pages: ${research.fetchedUrls.join(", ")}` : "",
    research.error ? `Research note: ${research.error}` : ""
  ].filter(Boolean).join("\n");
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
    research.fetchedUrls.length ? `Checked pages: ${research.fetchedUrls.join(", ")}` : "",
    research.textPreview ? `Website text preview:\n${research.textPreview}` : "",
    research.error ? `Research limitation: ${research.error}` : ""
  ].filter(Boolean).join("\n");
}

function summarizeCustomerResearch(research: CustomerResearchResult) {
  return CustomerResearchSummarySchema.parse({
    depth: research.depth,
    confidenceScore: research.confidenceScore,
    buyerType: research.buyerType,
    likelyNeed: research.inferredNeed,
    primaryAngle: research.recommendedAngle,
    riskNotes: research.painSignals,
    checkedPages: research.fetchedUrls.length
  });
}

const outreachTemplatePhrases = [
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
  "do you have any need",
  "can you share your requirements",
  "we are a manufacturing service",
  "we are manufacturer",
  "we are a manufacturer"
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

type OutreachQualityResearchContext = {
  companyName?: string;
  website?: string;
  industry?: string;
  buyerType?: string;
  inferredNeed?: string;
  recommendedAngle?: string;
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
  const templateHits = outreachTemplatePhrases.filter((phrase) => normalized.includes(phrase));
  const startsWithSupplierIntro = /^(we|our company|i am|this is)\b/.test(opening) && !/\b(saw|noticed|looking at|checked|read|your)\b/.test(opening);
  const buyerReasonPassed = Boolean(opening) && !startsWithSupplierIntro && (
    containsAny(opening, tokens) ||
    /\b(saw|noticed|looking at|checked|read|your website|your product|your category|your range|your store|your catalog)\b/.test(opening)
  );
  const humanTonePassed = templateHits.length === 0 && !/\bcooperation with us\b/.test(normalized) && !/\bkindly\s+\w+/.test(normalized);
  const personalizedPassed = containsAny(normalized, tokens) && !looksLikeMassTemplate(normalized);
  const nextStepPassed = normalized.includes("?") || outreachNextStepPhrases.some((phrase) => normalized.includes(phrase));
  const words = countWords(body);
  const paragraphCount = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).length || 1;
  const twoSecondPassed = words <= 130 && countWords(opening) <= 32 && subject.length <= 60 && paragraphCount <= 5;

  const checks = [
    qualityCheck("buyerReason", "Buyer-specific first line", buyerReasonPassed, buyerReasonPassed ? 20 : 0, buyerReasonPassed ? "The opening explains why this buyer is being contacted." : "The first line does not clearly say why this buyer should care."),
    qualityCheck("humanTone", "Human English", humanTonePassed, humanTonePassed ? 20 : Math.max(0, 12 - templateHits.length * 4), humanTonePassed ? "The wording avoids obvious translated-template phrases." : `Template phrase found: ${templateHits[0] ?? "translated sales wording"}.`),
    qualityCheck("personalized", "Personalized context", personalizedPassed, personalizedPassed ? 20 : 6, personalizedPassed ? "The message uses customer-specific context." : "The message could still be sent unchanged to many buyers."),
    qualityCheck("nextStep", "Clear next step", nextStepPassed, nextStepPassed ? 20 : 0, nextStepPassed ? "The buyer can answer with a simple next step." : "The message does not make the next action clear."),
    qualityCheck("twoSecondRead", "2-second scan", twoSecondPassed, twoSecondPassed ? 20 : Math.max(0, 20 - Math.ceil(Math.max(0, words - 130) / 10) * 3), twoSecondPassed ? "The email is short enough to scan quickly." : "The email is too long or the opening is too slow.")
  ];
  const score = Math.max(0, Math.min(100, checks.reduce((sum, check) => sum + check.score, 0)));
  const hardFailed = !buyerReasonPassed || !humanTonePassed || !nextStepPassed;
  const passed = score >= 80 && !hardFailed;
  const issues = checks.filter((check) => !check.passed).map((check) => check.message).filter(Boolean);
  const rewriteHints = [
    buyerReasonPassed ? "" : "Start with one specific reason from the buyer website, not your company credentials.",
    humanTonePassed ? "" : "Remove translated-template phrases and write like a short human business note.",
    personalizedPassed ? "" : "Add one customer-specific product/category/channel detail.",
    nextStepPassed ? "" : "End with one low-friction ask, such as sending 2-3 matched options.",
    twoSecondPassed ? "" : "Shorten to about 3 short lines: why this buyer, why relevant, what next."
  ].filter(Boolean);
  return OutreachEmailQualityReviewSchema.parse({
    score,
    passed,
    level: passed ? "pass" : hardFailed ? "blocked" : "needs-work",
    summary: passed ? "Ready: this reads like a buyer-specific human note." : "Needs rewrite before sending.",
    checks,
    issues,
    rewriteHints,
    reviewedAt: new Date().toISOString()
  });
}

function qualityCheck(id: OutreachEmailQualityReview["checks"][number]["id"], label: string, passed: boolean, score: number, message: string): OutreachEmailQualityReview["checks"][number] {
  return { id, label, passed, score: Math.max(0, Math.min(20, Math.round(score))), message };
}

function normalizeQualityText(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

function firstBusinessLine(body: string): string {
  return body.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !/^hi\b|^hello\b|^dear\b/i.test(line.replace(/[,，].*$/, ""))) ?? body.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

function normalizeOpeningLine(line: string): string {
  return normalizeQualityText(line.replace(/^(hi|hello|dear)\b[^,，.!?]*[,，]?\s*/i, ""));
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
    research?.inferredNeed,
    research?.recommendedAngle,
    ...(research?.productSignals ?? []),
    ...(research?.buyingSignals ?? []),
    ...(research?.painSignals ?? [])
  ].filter(Boolean).flatMap((value) => String(value).split(/[^a-zA-Z0-9]+/));
  return Array.from(new Set(raw.map((token) => token.toLowerCase()).filter((token) => token.length >= 4 && !commonQualityTokens.has(token)))).slice(0, 24);
}

const commonQualityTokens = new Set(["http", "https", "www", "com", "company", "email", "buyer", "sales", "supply", "product", "products", "service", "services", "import", "export"]);

function containsAny(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
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

function researchDepthPromptGuidance(depth: OutreachResearchDepth): string {
  if (depth === "quick") return "Keep analysis conservative and compact; use only the strongest website clues.";
  if (depth === "deep") return "Use the full buyer-risk, procurement-trigger, and objection model, but still avoid unsupported claims.";
  return "Use a balanced buyer profile and practical procurement-trigger reasoning.";
}

async function generateOutreachDraft(input: {
  lead: OutreachLead;
  body: {
    language: string;
    tone: string;
    providerId?: string;
    model?: string;
  };
  profileId: string;
  runtime: RuntimeAdapter;
  providers: ProviderRepository;
  companyProfile: CompanyProfileRepository;
  materials: MaterialRepository;
  drafts: OutreachDraftRepository;
  customerResearchContext?: string;
}): Promise<OutreachDraft> {
  await assertCompanyProfileReady(input.companyProfile);
  const providerRecord = await resolveGenerationProvider(input.body.providerId, input.providers);
  const apiKey = providerRecord ? await input.providers.readApiKey(providerRecord).catch(() => undefined) : undefined;
  const provider = providerRecord ? {
    kind: providerRecord.kind,
    baseUrl: providerRecord.baseUrl,
    apiKey,
    defaultModel: providerRecord.defaultModel
  } : undefined;
  const companyKnowledgeContext = await buildCompanyKnowledgeContext(input.companyProfile, input.materials);
  const prompt = buildOutreachPrompt(input.lead, input.body.language, input.body.tone, companyKnowledgeContext, input.customerResearchContext);
  const replyText = await input.runtime.createHermesReply({
    messages: [{ id: randomUUID(), role: "user", content: prompt, createdAt: new Date().toISOString() }],
    model: input.body.model ?? providerRecord?.defaultModel,
    instructions: outreachInstructions(),
    provider
  });
  const parsed = parseGeneratedOutreachDraft(replyText);
  const qualityReview = reviewOutreachEmail({ subject: parsed.subject, body: parsed.body, lead: input.lead });
  return input.drafts.create({
    profileId: input.profileId,
    leadId: input.lead.id,
    subject: parsed.subject,
    body: parsed.body,
    language: input.body.language,
    tone: input.body.tone,
    promptSnapshot: truncateForContext(prompt, 30_000),
    providerId: providerRecord?.id,
    model: input.body.model ?? providerRecord?.defaultModel,
    usage: estimateMessageUsage(prompt, `${parsed.subject}\n${parsed.body}`),
    qualityReview
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
  leads: OutreachLeadRepository;
  drafts: OutreachDraftRepository;
  workflows: OutreachWorkflowRepository;
  research?: CustomerResearchResult;
  researchDepth?: OutreachResearchDepth;
}): Promise<OutreachWorkflow> {
  await assertCompanyProfileReady(input.companyProfile);
  const research = input.research ?? await researchCustomerWebsite(input.body.website, input.researchDepth ?? "standard");
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
  const companyKnowledgeContext = await buildCompanyKnowledgeContext(input.companyProfile, input.materials);
  const customerResearchContext = formatCustomerResearchContext(research);
  const prompt = buildOutreachWorkflowPrompt({
    lead,
    research,
    companyKnowledgeContext,
    language: input.body.language,
    tone: input.body.tone
  });
  const replyText = await input.runtime.createHermesReply({
    messages: [{ id: randomUUID(), role: "user", content: prompt, createdAt: new Date().toISOString() }],
    model: input.body.model ?? providerRecord?.defaultModel,
    instructions: outreachWorkflowInstructions(),
    provider
  });
  const generated = parseGeneratedOutreachWorkflow(replyText, lead, input.body.language, input.body.tone);
  const initialQualityReview = reviewOutreachEmail({
    subject: generated.initialEmail.subject,
    body: generated.initialEmail.body,
    lead,
    research
  });
  const initialDraft = await input.drafts.create({
    profileId: input.profileId,
    leadId: lead.id,
    subject: generated.initialEmail.subject,
    body: generated.initialEmail.body,
    language: input.body.language,
    tone: input.body.tone,
    promptSnapshot: truncateForContext(prompt, 30_000),
    providerId: providerRecord?.id,
    model: input.body.model ?? providerRecord?.defaultModel,
    usage: estimateMessageUsage(prompt, `${generated.initialEmail.subject}\n${generated.initialEmail.body}`),
    qualityReview: initialQualityReview
  });
  const followUps = [];
  for (const email of generated.followUps.slice(0, 9)) {
    const draft = await input.drafts.create({
      profileId: input.profileId,
      leadId: lead.id,
      subject: email.subject,
      body: email.body,
      language: input.body.language,
      tone: input.body.tone,
      promptSnapshot: truncateForContext(prompt, 30_000),
      providerId: providerRecord?.id,
      model: input.body.model ?? providerRecord?.defaultModel,
      usage: estimateMessageUsage(prompt, `${email.subject}\n${email.body}`)
    });
    followUps.push({ ...email, draftId: draft.id });
  }
  const now = new Date().toISOString();
  return input.workflows.create({
    profileId: input.profileId,
    leadId: lead.id,
    draftId: initialDraft.id,
    website: research.website,
    email: input.body.email,
    language: input.body.language,
    tone: input.body.tone,
    research: CustomerResearchSnapshotSchema.parse({ ...research, createdAt: now }),
    icps: generated.icps,
    usps: generated.usps,
    initialEmail: { ...generated.initialEmail, draftId: initialDraft.id, qualityReview: initialQualityReview },
    followUps,
    promptSnapshot: truncateForContext(`${prompt}\n\n--- Customer context ---\n${customerResearchContext}`, 30_000),
    providerId: providerRecord?.id,
    model: input.body.model ?? providerRecord?.defaultModel,
    usage: estimateMessageUsage(prompt, replyText)
  });
}

async function generateOutreachCampaignWorkflows(input: {
  campaignId: string;
  runtime: RuntimeAdapter;
  providers: ProviderRepository;
  companyProfile: CompanyProfileRepository;
  materials: MaterialRepository;
  leads: OutreachLeadRepository;
  drafts: OutreachDraftRepository;
  workflows: OutreachWorkflowRepository;
  campaigns: OutreachCampaignRepository;
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
    const next = researchCustomerWebsite(normalized, campaign.researchDepth);
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
          providerId: campaign.providerId,
          model: campaign.model
        },
        profileId: campaign.profileId,
        lead,
        runtime: input.runtime,
        providers: input.providers,
        companyProfile: input.companyProfile,
        materials: input.materials,
        leads: input.leads,
        drafts: input.drafts,
        workflows: input.workflows,
        research,
        researchDepth: campaign.researchDepth
      });
      await input.campaigns.updateRecipient(recipient.id, {
        status: "generated",
        workflowId: workflow.id,
        initialDraftId: workflow.draftId,
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
  await input.drafts.update(draft.id, { qualityReview: review });
  await input.workflows.update(workflow.id, {
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
  assertOutreachQualityPassed(review);
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
      qualityReview: review
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
  const companyKnowledgeContext = await buildCompanyKnowledgeContext(input.companyProfile, input.materials);
  const prompt = buildOutreachRewritePrompt({
    draft: input.draft,
    lead: input.lead,
    workflow: input.workflow,
    currentReview,
    companyKnowledgeContext
  });
  const replyText = await input.runtime.createHermesReply({
    messages: [{ id: randomUUID(), role: "user", content: prompt, createdAt: new Date().toISOString() }],
    model: input.body.model ?? input.draft.model ?? providerRecord?.defaultModel,
    instructions: outreachInstructions(),
    provider
  });
  const parsed = parseGeneratedOutreachDraft(replyText);
  const review = reviewOutreachEmail({
    subject: parsed.subject,
    body: parsed.body,
    lead: input.lead,
    research: input.workflow?.research
  });
  return input.drafts.update(input.draft.id, {
    subject: parsed.subject,
    body: parsed.body,
    qualityReview: review
  });
}

function buildOutreachRewritePrompt(input: {
  draft: OutreachDraft;
  lead?: OutreachLead;
  workflow?: OutreachWorkflow;
  currentReview: OutreachEmailQualityReview;
  companyKnowledgeContext: string;
}): string {
  return [
    "Rewrite this B2B cold email so it passes the buyer 2-second quality gate.",
    "Return JSON only: {\"subject\":\"...\",\"body\":\"...\"}.",
    "",
    "Hard rules:",
    "- Use around 3 short lines and under 130 words.",
    "- Line 1 must tell this buyer the specific reason they are being contacted.",
    "- Line 2 must say what we do and why it is relevant to this buyer.",
    "- Line 3 must ask one low-friction next step, such as sending 2-3 matched options, a small comparison, or an MOQ/lead-time table.",
    "- Do not start with our company credentials.",
    "- Do not use translated-template phrases, Dear Sir/Madam, esteemed company, long-term cooperation, high quality and competitive price, one-stop solution, win-win cooperation, or please kindly.",
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
      input.workflow.research.buyingSignals.length ? `Buying signals: ${input.workflow.research.buyingSignals.join("; ")}` : ""
    ].filter(Boolean).join("\n") : "No workflow research available.",
    "",
    "--- Our company knowledge ---",
    input.companyKnowledgeContext || "No company knowledge has been added yet; stay conservative and offer a low-friction next step."
  ].join("\n");
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
        drafts: input.drafts
      });
      await input.campaigns.updateRecipient(recipient.id, {
        status: "sent",
        sentAt: sent.sentAt ?? new Date().toISOString(),
        sendError: undefined
      });
    } catch (error) {
      await input.campaigns.updateRecipient(recipient.id, {
        status: "failed",
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
}): Promise<{ processed: number; sent: number; ready: number; failed: number; stopped: number }> {
  const due = await input.followUps.due(input.now, input.limit);
  const result = { processed: 0, sent: 0, ready: 0, failed: 0, stopped: 0 };
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
      const sent = await sendOutreachDraft({ draft, sender, lead, to: job.email, senders: input.senders, drafts: input.drafts });
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
      companyName: recipient.companyName
    })));
  if (!candidates.length) {
    const next = await input.senders.updateInboxState(input.sender.id, {
      status: "ready",
      message: "No sent customers need reply checking yet."
    });
    return { ok: true, status: "ready", message: next.lastInboxCheckMessage ?? "", sender: publicOutreachSender(next), matched: [], stopped: 0 };
  }
  try {
    const headers = await scanImapRecentHeaders(input.sender, password);
    const matched = matchOutreachInboxHeaders(headers, candidates);
    let stopped = 0;
    const seenRecipients = new Set<string>();
    for (const match of matched) {
      if (seenRecipients.has(match.recipientId)) continue;
      seenRecipients.add(match.recipientId);
      const timestamp = match.at;
      await input.campaigns.updateRecipient(match.recipientId, {
        status: match.type,
        repliedAt: match.type === "replied" ? timestamp : undefined,
        bouncedAt: match.type === "bounced" ? timestamp : undefined,
        unsubscribedAt: match.type === "unsubscribed" ? timestamp : undefined,
        lastInboxEventAt: timestamp,
        stopReason: match.reason,
        sendError: undefined
      });
      stopped += await input.followUps.stopByRecipient(match.recipientId, match.reason);
    }
    const message = matched.length
      ? `Checked inbox and stopped follow-ups for ${seenRecipients.size} customer${seenRecipients.size === 1 ? "" : "s"}.`
      : "Checked inbox. No customer replies or bounces were found.";
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
  host?: string | null;
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
    { match: /(^|\.)qq\.com$/, host: "imap.qq.com" },
    { match: /(^|\.)exmail\.qq\.com$/, host: "imap.exmail.qq.com" },
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

async function scanImapRecentHeaders(sender: OutreachSenderAccount, password: string): Promise<InboxHeader[]> {
  const socket = await connectImapSocket(sender);
  try {
    await readImapGreeting(socket);
    await imapCommand(socket, "A1", `LOGIN ${imapQuote(sender.imapUsername ?? sender.username ?? sender.email)} ${imapQuote(password)}`);
    await imapCommand(socket, "A2", "SELECT INBOX");
    const search = await imapCommand(socket, "A3", `UID SEARCH SINCE ${imapSinceDate(45)}`);
    const uids = parseImapSearchUids(search).slice(-200);
    if (!uids.length) return [];
    const fetch = await imapCommand(socket, "A4", `UID FETCH ${uids.join(",")} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`);
    return parseImapHeaders(fetch);
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
  const date = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
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

function outreachInstructions(): string {
  return [
    "You are Hermills Outreach, a practical B2B foreign-trade cold email writer.",
    "Write concise, specific, reply-worthy emails for international sales.",
    "Do not invent company strengths, certifications, prices, cases, or shipping terms.",
    "If evidence is missing, write conservatively and focus on a low-friction next step.",
    "Return only valid JSON with keys subject and body."
  ].join("\n");
}

function outreachWorkflowInstructions(): string {
  return [
    "You are Hermills Letter App, a senior B2B export sales strategist building Snov-style outreach workflows.",
    "Internally act as a coordinated agent queue: Website Reader -> Buyer Psychology Analyst -> ICP/USP Matcher -> Email Writer -> QA Reviewer.",
    "Your job is to research the buyer, model ICP buyer psychology, identify procurement triggers, match differentiated supplier USPs, and write warm outreach.",
    "Treat the output as an operational drip workflow: ICP -> USP -> initial warm email -> 9 follow-ups, with stop/handoff discipline reflected inside the existing fields.",
    "Use only supplied customer research and company knowledge. Do not invent company strengths, certifications, prices, cases, shipping terms, or fake relationship context.",
    "Do not write generic supplier copy, empty benefits, cold-email cliches, filler, or vague claims without buyer logic and proof.",
    "Return only valid JSON that matches the requested schema. Do not add fields, markdown, or commentary."
  ].join("\n");
}

function buildOutreachPrompt(lead: OutreachLead, language: string, tone: string, companyKnowledgeContext: string, customerResearchContext = ""): string {
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
    "- Keep the body around 3 short lines and under 130 words.",
    "- Use this exact thinking structure: line 1 = the specific buyer reason why you are contacting them; line 2 = what we do and why it is relevant to that buyer; line 3 = one low-friction ask.",
    "- The first business line must not introduce our company credentials first. It must tell the buyer why this email is about them.",
    "- Ask for a simple next step, such as sending 2-3 matched options, a small comparison, MOQ/lead-time table, or certification/spec pack.",
    "- Sound like a human business note, not translated English or a mass template.",
    "- Never use Dear Sir/Madam, esteemed company, sincerely hope to establish cooperation, leading manufacturer, high quality and competitive price, one-stop solution, factory direct, win-win cooperation, or please kindly.",
    "- Avoid hype, fake familiarity, guaranteed results, and unsupported claims.",
    "- Return JSON only: {\"subject\":\"...\",\"body\":\"...\"}.",
    "",
    "--- Lead ---",
    leadLines,
    "",
    customerResearchContext || "--- Customer website research ---\nNo website research was available.",
    "",
    "--- Company knowledge ---",
    companyKnowledgeContext || "No company knowledge has been added yet. Keep the message general and ask the user to add company details for a stronger draft."
  ].join("\n");
}

function buildOutreachWorkflowPrompt(input: {
  lead: OutreachLead;
  research: CustomerResearchResult;
  companyKnowledgeContext: string;
  language: string;
  tone: string;
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
    "- Body under 130 words.",
    "- Peer-to-peer, helpful, warm, concise.",
    "- Use this three-line formula: one line with the specific buyer reason for contacting them -> one line on what we do and why it is relevant -> one line with a low-friction ask.",
    "- The first business line must be about the buyer, not our credentials.",
    "- Mention one buyer pain point and one matching USP. Do not include a catalog dump.",
    "- Use a concrete micro-offer or A/B choice, such as a small comparison, sample-ready option list, MOQ/lead-time table, certification pack, or category fit check.",
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
  return {
    id: step === 0 ? "initial-email" : `follow-up-${step}`,
    step,
    delayDays: numberField(record.delayDays, delayDays),
    strategy: truncatePlain(stringField(record.strategy) || strategy, 180),
    subject: truncatePlain(subject, 240),
    body: truncateForContext(body, 20_000),
    status: "draft"
  };
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
  const initialEmail: OutreachWorkflow["initialEmail"] = {
    id: "initial-email",
    step: 0,
    delayDays: 0,
    strategy: "Initial warm email",
    subject: truncatePlain(`${lead.companyName} sourcing idea`, 50),
    body: [
      `Hi, I was looking at ${lead.companyName} and noticed this may connect to ${productHint}.`,
      "",
      `Instead of sending a broad catalog, I can share 2-3 options that fit your likely buying priorities, with notes on MOQ, lead time, and where each option works best.`,
      "",
      "If helpful, I can send option A focused on fast sampling or option B focused on lower-risk repeat supply. Which would be more useful?"
    ].join("\n"),
    status: "draft"
  };
  const followUps: OutreachWorkflow["followUps"] = defaultFollowUpStrategies.map((item, index) => ({
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
  return [
    `Hi, quick note on ${lead.companyName}.`,
    "",
    `${strategy}: I can share a small, practical option list instead of a full catalog, so your team can quickly see whether this category is worth reviewing.`,
    "",
    "If useful, reply with A for specs or B for a short comparison."
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
}): Promise<OutreachDraft> {
  if (!input.sender.enabled) throw new ClientInputError("Sender account is disabled.");
  if (!input.sender.deliveryConfirmedAt) throw new ClientInputError("Confirm the sender mailbox before sending outreach.");
  if (input.draft.status === "sent") throw new ClientInputError("Outreach draft has already been sent.");
  const to = input.to ?? input.lead?.email;
  if (!to) throw new ClientInputError("Lead email is missing.");
  const qualityReview = input.draft.qualityReview ?? reviewOutreachEmail({ subject: input.draft.subject, body: input.draft.body, lead: input.lead });
  if (!input.draft.qualityReview) await input.drafts.update(input.draft.id, { qualityReview });
  assertOutreachQualityPassed(qualityReview);
  try {
    const transporter = await input.senders.createTransporter(input.sender);
    await transporter.sendMail({
      from: formatEmailAddress(input.sender.fromName, input.sender.email),
      to,
      subject: input.draft.subject,
      text: input.draft.body
    });
    return input.drafts.update(input.draft.id, { status: "sent", sentAt: new Date().toISOString(), sendError: undefined });
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    await input.drafts.update(input.draft.id, { status: "failed", sendError: message });
    throw new ClientInputError(`Email could not be sent: ${message}`);
  }
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
