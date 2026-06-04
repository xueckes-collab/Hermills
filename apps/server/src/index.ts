import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
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
  type ProviderCredential,
  type RuntimeStatus
} from "@hermills/core";
import { RuntimeService, modelsUrl, type HermesReplyRequest } from "@hermills/runtime";

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

type PublicProviderCredential = Omit<ProviderCredential, "credentialRef">;
type PublicMaterialRecord = Omit<MaterialRecord, "path">;
type PublicChannelRecord = Omit<ChannelRecord, "secretRef">;
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

async function discoverProviderModels(provider: ProviderCredential, apiKey: string | undefined, fetchImpl: typeof fetch): Promise<{ models: string[]; status: "connected" | "missing-key" | "failed"; message?: string }> {
  const baseUrl = provider.baseUrl?.trim();
  if (!baseUrl) return { models: provider.defaultModel ? [provider.defaultModel] : ["hermes-agent"], status: "connected" };
  if (provider.kind !== "local" && !apiKey) return { models: provider.defaultModel ? [provider.defaultModel] : [], status: "missing-key", message: "Provider key is missing." };
  try {
    const response = await fetchImpl(modelsUrl(baseUrl), {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
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
