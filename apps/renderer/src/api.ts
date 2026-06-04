export type RuntimeState =
  | "not-installed"
  | "checking"
  | "downloading"
  | "installing"
  | "configuring"
  | "starting"
  | "verifying"
  | "ready"
  | "needs-user-action"
  | "failed";

export type GatewayStatus = {
  state: "stopped" | "starting" | "running" | "failed";
  pid?: number;
  apiBaseUrl?: string;
  message?: string;
};

export type RuntimeStatus = {
  state: RuntimeState;
  installed: boolean;
  localDeploymentComplete?: boolean;
  version?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  path?: string;
  hermesHome?: string;
  installerUrl?: string;
  activeInstallJob?: string;
  progress?: number;
  message?: string;
  gateway?: GatewayStatus;
  checks?: Array<{ id: string; label: string; ok: boolean; detail?: string }>;
  installMetadata?: InstallMetadata;
};

type RawAppState = {
  localDeploymentComplete?: boolean;
  localDeployComplete?: boolean;
  deploymentComplete?: boolean;
  firstRunComplete?: boolean;
  initialDeploymentComplete?: boolean;
};

export type InstallMetadata = {
  installedAt: string;
  sourceUrl: string;
  installerUrl: string;
  licenseUrl: string;
  latestReleaseTag?: string;
  latestReleaseName?: string;
  executablePath?: string;
  version?: string;
};

export type RuntimeLatest = {
  sourceUrl: string;
  installerUrl: string;
  licenseUrl: string;
  latestReleaseTag?: string;
  latestReleaseName?: string;
  installerSha256?: string;
  installerSize?: number;
  fetchedAt: string;
};

export type RuntimeUpdateCheck = {
  installed: boolean;
  installedVersion?: string;
  installedReleaseTag?: string;
  latestVersion?: string;
  latestReleaseName?: string;
  updateAvailable: boolean;
  checkState: "not-installed" | "current" | "available" | "unknown";
  checkedAt: string;
  sourceUrl?: string;
  installerUrl?: string;
  installerSha256?: string;
  error?: string;
};

export type AppState = {
  version: 1;
  firstDeployHidden: boolean;
  localDeployCompletedAt?: string;
  lastSuccessfulRuntimeVersion?: string;
  lastSuccessfulGatewayAt?: string;
  shouldShowFirstDeploy: boolean;
  runtimeRecoverable: boolean;
};

export type InstallEvent = {
  jobId: string;
  level: "info" | "warn" | "error" | "done";
  step?: string;
  progress?: number;
  message: string;
  createdAt: string;
};

export type Agent = {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  model?: string;
  providerId?: string;
  status?: "draft" | "ready" | "running";
  tools?: string[];
  starters?: string[];
  capabilities?: {
    memory: boolean;
    files: boolean;
    tools: boolean;
    approvals: "never" | "on-demand" | "always";
  };
  updatedAt?: string;
};

export type Provider = {
  id: string;
  name: string;
  status: "connected" | "missing" | "invalid";
  baseUrl?: string;
  defaultModel?: string;
  models?: string[];
  maskedKey?: string;
};

export type Profile = {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string;
};

export type ProfileState = {
  profiles: Profile[];
  activeProfileId: string;
};

export type OnboardingProviderInput = {
  id?: string;
  kind?: "openai-compatible" | "openai" | "anthropic" | "local";
  displayName: string;
  baseUrl?: string;
  defaultModel?: string;
  apiKey?: string;
  enabled?: boolean;
};

export type OnboardingProviderState = Omit<OnboardingProviderInput, "apiKey" | "kind" | "enabled"> & {
  kind: NonNullable<OnboardingProviderInput["kind"]>;
  enabled: boolean;
  keyPreview?: string;
};

export type OnboardingState = {
  version: 1;
  language: "zh-CN" | "zh-TW" | "ja" | "ko" | "en";
  userDisplayName: string;
  agentName: string;
  memoryEnabled: boolean;
  theme: "warm" | "night" | "plain" | "system";
  workspacePath?: string;
  provider?: OnboardingProviderState;
  onboardingCompletedAt?: string;
  defaultAgentId?: string;
  completed: boolean;
};

export type OnboardingUpdate = Partial<Omit<OnboardingState, "version" | "provider" | "onboardingCompletedAt" | "completed">> & {
  onboardingCompletedAt?: string | null;
  provider?: OnboardingProviderInput | null;
};

type RawOnboardingState = Omit<OnboardingState, "completed"> & {
  completed?: boolean;
};

type OnboardingClientUpdate = OnboardingUpdate & {
  completed?: boolean;
  userName?: string;
  providerSkipped?: boolean;
  currentStep?: string;
  features?: string[];
};

export type UsageSummary = {
  conversations: number;
  messages: number;
  files: number;
  fileBytes: number;
  providers: number;
  connectedProviders: number;
  agents: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
};

export type JobRecord = {
  id: string;
  profileId?: string;
  name: string;
  description?: string;
  schedule: { expression: string; timezone: string };
  status: "active" | "paused";
  task: {
    type: "chat-prompt";
    prompt: string;
    agentId?: string;
    providerId?: string;
    model?: string;
    materialIds: string[];
  };
  nextRunAt?: string;
  lastRunAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type JobRunRecord = {
  id: string;
  profileId?: string;
  jobId: string;
  trigger: "manual" | "schedule";
  status: "queued" | "running" | "succeeded" | "failed" | "skipped";
  startedAt: string;
  finishedAt?: string;
  input?: string;
  outputPreview?: string;
  error?: string;
  usage?: ChatMessage["usage"];
  model?: string;
  providerId?: string;
};

export type ChannelRecord = {
  id: string;
  profileId?: string;
  kind: "telegram" | "discord" | "slack" | "whatsapp" | "matrix" | "feishu" | "wechat" | "wecom";
  label: string;
  enabled: boolean;
  status: "disabled" | "needs-setup" | "connected" | "failed";
  endpoint?: string;
  secretPreview?: string;
  config: Record<string, unknown>;
  lastTestedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type LogEntry = {
  id: string;
  source: "server" | "job" | "channel" | "gateway" | "install";
  fileId?: string;
  line?: number;
  level: "debug" | "info" | "warn" | "error" | "done";
  message: string;
  createdAt?: string;
};

export type AnalyticsSummary = UsageSummary & {
  jobs: number;
  activeJobs: number;
  jobRuns: number;
  failedJobRuns: number;
  channels: number;
  connectedChannels: number;
  logs: number;
  errorLogs: number;
};

export type AnalyticsUsage = {
  totals: NonNullable<ChatMessage["usage"]>;
  buckets: Array<{ key: string; messages: number; runs: number } & NonNullable<ChatMessage["usage"]>>;
  models: Array<{ key: string; messages: number; runs: number } & NonNullable<ChatMessage["usage"]>>;
  providers: Array<{ key: string; messages: number; runs: number } & NonNullable<ChatMessage["usage"]>>;
  sources: Array<{ key: string; messages: number; runs: number } & NonNullable<ChatMessage["usage"]>>;
};

export type AgentInput = {
  displayName: string;
  description: string;
  instructions: string;
  model?: string;
  providerId?: string;
  starters?: string[];
  capabilities?: Partial<NonNullable<Agent["capabilities"]>>;
};

export type ProviderModels = {
  models: string[];
  status: "connected" | "missing-key" | "failed";
  message?: string;
};

export type ChatMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number;
  };
  createdAt: string;
};

export type ChatSession = {
  id: string;
  title: string;
  agentId?: string;
  providerId?: string;
  agent?: string;
  model?: string;
  updatedAt?: string;
  messageCount?: number;
  messages: ChatMessage[];
};

export type Material = {
  id: string;
  name: string;
  folder?: string;
  scope?: "personal" | "company";
  category?: CompanyMaterialCategory;
  tags?: string[];
  description?: string;
  mimeType: string;
  size: number;
  sha256?: string;
  extractionState?: "indexed" | "stored" | "extracting" | "failed";
  textPreview?: string;
  extractionError?: string;
  createdAt: string;
  updatedAt?: string;
};

export type MaterialPreview = Material & {
  contentText?: string;
};

export type CompanyMaterialCategory =
  | "company-profile"
  | "product-catalog"
  | "price-list"
  | "certification"
  | "shipping-logistics"
  | "payment-terms"
  | "faq"
  | "case-study"
  | "other";

export type CompanyProfile = {
  version: 1;
  name: string;
  legalName?: string;
  website?: string;
  markets: string[];
  mainProducts: string[];
  certifications: string[];
  paymentTerms: string[];
  shippingTerms: string[];
  brandVoice: string;
  notes: string;
  updatedAt?: string;
};

export type OutreachLead = {
  id: string;
  profileId?: string;
  companyName: string;
  website?: string;
  country?: string;
  industry?: string;
  contactName?: string;
  contactTitle?: string;
  email?: string;
  need: string;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type OutreachLeadInput = {
  companyName: string;
  website?: string;
  country?: string;
  industry?: string;
  contactName?: string;
  contactTitle?: string;
  email?: string;
  need?: string;
  notes?: string;
  tags?: string[];
};

export type OutreachDraft = {
  id: string;
  profileId?: string;
  leadId?: string;
  status: "draft" | "sent" | "failed";
  subject: string;
  body: string;
  language: string;
  tone: string;
  promptSnapshot: string;
  providerId?: string;
  model?: string;
  usage?: ChatMessage["usage"];
  sentAt?: string;
  sendError?: string;
  createdAt: string;
  updatedAt: string;
};

export type OutreachSenderAccount = {
  id: string;
  profileId?: string;
  label: string;
  fromName?: string;
  email: string;
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  passwordPreview?: string;
  enabled: boolean;
  lastTestedAt?: string;
  lastTestEmailAt?: string;
  deliveryConfirmedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerResearchSnapshot = {
  website: string;
  companyName: string;
  industry: string;
  inferredNeed: string;
  title: string;
  description: string;
  fetchedUrls: string[];
  textPreview: string;
  error?: string;
  createdAt: string;
};

export type GeneratedIcp = {
  id: string;
  name: string;
  industrySegment: string;
  companyCharacteristics: string[];
  buyerRoles: string[];
  buyingBehavior: string[];
  painPoints: string[];
  triggerEvents: string[];
  salesAngles: string[];
};

export type GeneratedUsp = {
  id: string;
  category: string;
  headline: string;
  buyerAngle: string;
  proof: string;
};

export type EmailSequenceDraft = {
  id: string;
  draftId?: string;
  step: number;
  delayDays: number;
  strategy: string;
  subject: string;
  body: string;
  status: "draft" | "sent" | "failed";
  sentAt?: string;
  sendError?: string;
};

export type OutreachWorkflow = {
  id: string;
  profileId?: string;
  leadId: string;
  draftId: string;
  website: string;
  email: string;
  language: string;
  tone: string;
  research: CustomerResearchSnapshot;
  icps: GeneratedIcp[];
  usps: GeneratedUsp[];
  initialEmail: EmailSequenceDraft;
  followUps: EmailSequenceDraft[];
  promptSnapshot: string;
  providerId?: string;
  model?: string;
  usage?: ChatMessage["usage"];
  createdAt: string;
  updatedAt: string;
};

type RawRuntimeStatus = {
  installed: boolean;
  localDeploymentComplete?: boolean;
  localDeployComplete?: boolean;
  deploymentComplete?: boolean;
  firstRunComplete?: boolean;
  initialDeploymentComplete?: boolean;
  appState?: RawAppState;
  "app-state"?: RawAppState;
  state?: RuntimeState;
  version?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  executablePath?: string;
  runtimeHome: string;
  hermesHome?: string;
  installerUrl?: string;
  activeInstallJob?: string;
  installMetadata?: InstallMetadata;
  gateway?: GatewayStatus;
  checks?: Array<{ id: string; label: string; ok: boolean; detail?: string }>;
};

type RawAgent = {
  id: string;
  displayName: string;
  description?: string;
  instructions?: string;
  providerId?: string;
  model?: string;
  starters?: string[];
  capabilities?: Agent["capabilities"];
  updatedAt: string;
};

type RawProvider = {
  id: string;
  displayName: string;
  baseUrl?: string;
  defaultModel?: string;
  keyPreview?: string;
  enabled: boolean;
};

type RawChatSession = {
  id: string;
  title: string;
  agentId?: string;
  providerId?: string;
  model?: string;
  messages: ChatMessage[];
  updatedAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const desktopConfig = await window.hermillsDesktop?.getConfig?.();
  const baseUrl = desktopConfig?.apiBaseUrl || import.meta.env.VITE_HERMILLS_API_BASE_URL || "http://127.0.0.1:47321";
  const token = desktopConfig?.desktopToken || import.meta.env.VITE_HERMILLS_DESKTOP_TOKEN;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const hasBody = init?.body !== undefined && init.body !== null;
  const headers = new Headers(init?.headers);
  if (hasBody && !isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("x-hermills-token", token);
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(parseErrorMessage(text) || `${res.status} ${res.statusText}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function parseErrorMessage(text: string): string {
  if (!text) return "";
  try {
    const payload = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return payload.error?.message || payload.message || text;
  } catch {
    return text;
  }
}

function mapRuntime(runtime: RawRuntimeStatus): RuntimeStatus {
  const state = runtime.state ?? (runtime.activeInstallJob ? "installing" : runtime.installed ? "needs-user-action" : "not-installed");
  const localDeploymentComplete = resolveLocalDeploymentComplete(runtime);
  return {
    state,
    installed: runtime.installed,
    localDeploymentComplete,
    version: runtime.version || (runtime.installed ? "Installed" : "Not installed"),
    latestVersion: runtime.latestVersion,
    updateAvailable: runtime.updateAvailable,
    path: runtime.executablePath || runtime.runtimeHome,
    hermesHome: runtime.hermesHome,
    installerUrl: runtime.installerUrl,
    activeInstallJob: runtime.activeInstallJob,
    installMetadata: runtime.installMetadata,
    gateway: runtime.gateway,
    checks: runtime.checks,
    progress: state === "ready" ? 100 : runtime.activeInstallJob ? 52 : 0,
    message: runtime.installed ? "Hermes is installed. Start Hermes to chat." : "Set up Hermes to enable local chat."
  };
}

function resolveLocalDeploymentComplete(runtime: RawRuntimeStatus): boolean {
  const appState = runtime.appState ?? runtime["app-state"];
  return appState?.localDeploymentComplete
    ?? appState?.localDeployComplete
    ?? appState?.deploymentComplete
    ?? appState?.firstRunComplete
    ?? appState?.initialDeploymentComplete
    ?? runtime.localDeploymentComplete
    ?? runtime.localDeployComplete
    ?? runtime.deploymentComplete
    ?? runtime.firstRunComplete
    ?? runtime.initialDeploymentComplete
    ?? runtime.installed
    ?? runtime.state === "ready";
}

function mapSession(session: RawChatSession): ChatSession {
  return {
    id: session.id,
    title: session.title,
    agentId: session.agentId,
    providerId: session.providerId,
    model: session.model,
    messages: session.messages,
    messageCount: session.messages.length,
    updatedAt: new Date(session.updatedAt).toLocaleString()
  };
}

function mapProvider(provider: RawProvider): Provider {
  const hasKey = Boolean(provider.keyPreview);
  return {
    id: provider.id,
    name: provider.displayName,
    status: provider.enabled && hasKey ? "connected" : "missing",
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel,
    models: provider.defaultModel ? [provider.defaultModel] : [],
    maskedKey: provider.keyPreview || "No key saved"
  };
}

function mapOnboarding(state: RawOnboardingState): OnboardingState {
  return {
    ...state,
    completed: Boolean(state.completed || state.onboardingCompletedAt)
  };
}

function onboardingPayload(input: OnboardingClientUpdate): Record<string, unknown> {
  const { completed: _completed, currentStep: _currentStep, features: _features, providerSkipped, userName, provider, ...rest } = input;
  const payload: Record<string, unknown> = {
    ...rest,
    userDisplayName: rest.userDisplayName ?? userName
  };
  const normalizedProvider = onboardingProviderPayload(provider, providerSkipped);
  if (normalizedProvider !== undefined) payload.provider = normalizedProvider;
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function onboardingProviderPayload(provider: OnboardingClientUpdate["provider"], providerSkipped?: boolean): OnboardingProviderInput | null | undefined {
  if (providerSkipped) return null;
  if (provider === null) return null;
  if (!provider) return undefined;
  const { providerId: _providerId, kind, ...rest } = provider as OnboardingProviderInput & { providerId?: string };
  return {
    kind: kind ?? "openai-compatible",
    ...rest
  };
}

export const api = {
  async appState(): Promise<AppState> {
    return request<AppState>("/api/app-state");
  },
  async onboarding(): Promise<OnboardingState> {
    return mapOnboarding(await request<RawOnboardingState>("/api/onboarding"));
  },
  async updateOnboarding(input: OnboardingUpdate): Promise<OnboardingState> {
    return mapOnboarding(await request<RawOnboardingState>("/api/onboarding", {
      method: "PUT",
      body: JSON.stringify(onboardingPayload(input))
    }));
  },
  async completeOnboarding(input: OnboardingUpdate = {}): Promise<OnboardingState> {
    return mapOnboarding(await request<RawOnboardingState>("/api/onboarding/complete", {
      method: "POST",
      body: JSON.stringify(onboardingPayload(input))
    }));
  },
  async runtimeLatest(): Promise<RuntimeLatest> {
    return request<RuntimeLatest>("/api/runtime/latest");
  },
  async runtimeUpdateCheck(force = false): Promise<RuntimeUpdateCheck> {
    return request<RuntimeUpdateCheck>(`/api/runtime/update-check${force ? "?force=1" : ""}`);
  },
  async runtimeStatus(): Promise<RuntimeStatus> {
    return mapRuntime(await request<RawRuntimeStatus>("/api/runtime/status"));
  },
  async startRuntimeInstall(installerSha256?: string): Promise<{ jobId: string }> {
    return request<{ jobId: string }>("/api/runtime/install", {
      method: "POST",
      body: JSON.stringify({ channel: "official-docs-latest", skipBrowser: true, installerSha256 })
    });
  },
  async startRuntimeUpdate(installerSha256?: string): Promise<{ jobId: string }> {
    return request<{ jobId: string }>("/api/runtime/update", {
      method: "POST",
      body: JSON.stringify({ installerSha256 })
    });
  },
  async reinitializeRuntime(mode: "repair" | "reset-runtime" | "reset-first-run" = "repair"): Promise<{ jobId: string } | AppState> {
    return request<{ jobId: string } | AppState>("/api/runtime/reinitialize", {
      method: "POST",
      body: JSON.stringify({ mode })
    });
  },
  async runtimeInstallEvents(jobId: string): Promise<InstallEvent[]> {
    return request<InstallEvent[]>(`/api/runtime/install/${jobId}/events.json`);
  },
  async startGateway(): Promise<GatewayStatus> {
    return request<GatewayStatus>("/api/gateway/start", { method: "POST", body: "{}" });
  },
  async restartGateway(): Promise<GatewayStatus> {
    return request<GatewayStatus>("/api/gateway/restart", { method: "POST", body: "{}" });
  },
  async agents(): Promise<Agent[]> {
    const agents = await request<RawAgent[]>("/api/agents");
    return agents.map((agent) => ({
      id: agent.id,
      name: agent.displayName,
      description: agent.description,
      instructions: agent.instructions,
      providerId: agent.providerId,
      model: agent.model,
      status: "ready",
      tools: ["files", "tools"],
      starters: agent.starters ?? [],
      capabilities: agent.capabilities,
      updatedAt: new Date(agent.updatedAt).toLocaleString()
    }));
  },
  async saveAgent(input: AgentInput): Promise<Agent> {
    const agent = await request<RawAgent>("/api/agents", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return {
      id: agent.id,
      name: agent.displayName,
      description: agent.description,
      instructions: agent.instructions,
      providerId: agent.providerId,
      model: agent.model,
      status: "ready",
      starters: agent.starters ?? [],
      capabilities: agent.capabilities
    };
  },
  async updateAgent(id: string, input: Partial<AgentInput>): Promise<Agent> {
    const agent = await request<RawAgent>(`/api/agents/${id}`, {
      method: "PUT",
      body: JSON.stringify(input)
    });
    return {
      id: agent.id,
      name: agent.displayName,
      description: agent.description,
      instructions: agent.instructions,
      providerId: agent.providerId,
      model: agent.model,
      status: "ready",
      starters: agent.starters ?? [],
      capabilities: agent.capabilities,
      updatedAt: new Date(agent.updatedAt).toLocaleString()
    };
  },
  async deleteAgent(id: string): Promise<void> {
    await request<void>(`/api/agents/${id}`, { method: "DELETE" });
  },
  async providers(): Promise<Provider[]> {
    const providers = await request<RawProvider[]>("/api/settings/providers");
    return providers.map(mapProvider);
  },
  async saveProvider(input: { displayName: string; baseUrl: string; defaultModel: string; apiKey: string }): Promise<Provider> {
    const provider = await request<RawProvider>("/api/settings/providers", {
      method: "POST",
      body: JSON.stringify({ kind: "openai-compatible", ...input, apiKey: input.apiKey.trim() || undefined })
    });
    return mapProvider(provider);
  },
  async providerModels(id: string): Promise<ProviderModels> {
    return request<ProviderModels>(`/api/settings/providers/${id}/models`);
  },
  async testProvider(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/settings/providers/${id}/test`, { method: "POST", body: "{}" });
  },
  async profiles(): Promise<ProfileState> {
    return request<ProfileState>("/api/profiles");
  },
  async createProfile(name: string): Promise<ProfileState> {
    return request<ProfileState>("/api/profiles", { method: "POST", body: JSON.stringify({ name }) });
  },
  async updateProfile(id: string, input: { name?: string; active?: boolean }): Promise<ProfileState> {
    return request<ProfileState>(`/api/profiles/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },
  async deleteProfile(id: string): Promise<void> {
    await request<void>(`/api/profiles/${id}`, { method: "DELETE" });
  },
  async usageSummary(): Promise<UsageSummary> {
    return request<UsageSummary>("/api/usage/summary");
  },
  async analyticsSummary(): Promise<AnalyticsSummary> {
    return request<AnalyticsSummary>("/api/analytics/summary");
  },
  async analyticsUsage(source?: "chat" | "job-run"): Promise<AnalyticsUsage> {
    return request<AnalyticsUsage>(`/api/analytics/usage${source ? `?source=${encodeURIComponent(source)}` : ""}`);
  },
  async jobs(): Promise<JobRecord[]> {
    return request<JobRecord[]>("/api/jobs");
  },
  async createJob(input: {
    name: string;
    description?: string;
    schedule: { expression: string; timezone?: string };
    status?: "active" | "paused";
    task: {
      prompt: string;
      agentId?: string;
      providerId?: string;
      model?: string;
      materialIds?: string[];
    };
  }): Promise<JobRecord> {
    return request<JobRecord>("/api/jobs", { method: "POST", body: JSON.stringify(input) });
  },
  async updateJob(id: string, input: Partial<Pick<JobRecord, "name" | "description" | "schedule" | "status" | "task">>): Promise<JobRecord> {
    return request<JobRecord>(`/api/jobs/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },
  async pauseJob(id: string): Promise<JobRecord> {
    return request<JobRecord>(`/api/jobs/${id}/pause`, { method: "POST", body: "{}" });
  },
  async resumeJob(id: string): Promise<JobRecord> {
    return request<JobRecord>(`/api/jobs/${id}/resume`, { method: "POST", body: "{}" });
  },
  async runJob(id: string): Promise<JobRunRecord> {
    return request<JobRunRecord>(`/api/jobs/${id}/run`, { method: "POST", body: "{}" });
  },
  async jobRuns(id: string): Promise<JobRunRecord[]> {
    return request<JobRunRecord[]>(`/api/jobs/${id}/history`);
  },
  async deleteJob(id: string): Promise<void> {
    await request<void>(`/api/jobs/${id}`, { method: "DELETE" });
  },
  async channels(): Promise<ChannelRecord[]> {
    return request<ChannelRecord[]>("/api/channels");
  },
  async createChannel(input: {
    kind: ChannelRecord["kind"];
    label: string;
    enabled?: boolean;
    endpoint?: string;
    secret?: string;
    config?: Record<string, unknown>;
  }): Promise<ChannelRecord> {
    return request<ChannelRecord>("/api/channels", { method: "POST", body: JSON.stringify(input) });
  },
  async updateChannel(id: string, input: Partial<Pick<ChannelRecord, "label" | "enabled" | "endpoint" | "config">> & { secret?: string; clearSecret?: boolean }): Promise<ChannelRecord> {
    return request<ChannelRecord>(`/api/channels/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },
  async testChannel(id: string): Promise<{ ok: boolean; status: ChannelRecord["status"]; message?: string }> {
    return request<{ ok: boolean; status: ChannelRecord["status"]; message?: string }>(`/api/channels/${id}/test`, { method: "POST", body: "{}" });
  },
  async deleteChannel(id: string): Promise<void> {
    await request<void>(`/api/channels/${id}`, { method: "DELETE" });
  },
  async logs(query: { source?: LogEntry["source"]; level?: LogEntry["level"]; q?: string; limit?: number } = {}): Promise<LogEntry[]> {
    const params = new URLSearchParams();
    if (query.source) params.set("source", query.source);
    if (query.level) params.set("level", query.level);
    if (query.q) params.set("q", query.q);
    if (query.limit) params.set("limit", String(query.limit));
    return request<LogEntry[]>(`/api/logs${params.size ? `?${params.toString()}` : ""}`);
  },
  async createLog(input: { source?: LogEntry["source"]; level?: LogEntry["level"]; message: string }): Promise<LogEntry> {
    return request<LogEntry>("/api/logs", { method: "POST", body: JSON.stringify(input) });
  },
  async chatSessions(query = ""): Promise<ChatSession[]> {
    const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    const sessions = await request<RawChatSession[]>(`/api/chat/sessions${suffix}`);
    return sessions.map(mapSession);
  },
  async createChatSession(title = "New conversation", input: { agentId?: string; providerId?: string; model?: string } = {}): Promise<ChatSession> {
    return mapSession(await request<RawChatSession>("/api/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ title, model: input.model, agentId: input.agentId, providerId: input.providerId })
    }));
  },
  async updateChatSession(id: string, input: { title?: string; agentId?: string | null; providerId?: string | null; model?: string | null }): Promise<ChatSession> {
    return mapSession(await request<RawChatSession>(`/api/chat/sessions/${id}`, {
      method: "PUT",
      body: JSON.stringify(input)
    }));
  },
  async deleteChatSession(id: string): Promise<void> {
    await request<void>(`/api/chat/sessions/${id}`, { method: "DELETE" });
  },
  async sendChatMessage(sessionId: string, content: string, materialIds: string[] = []): Promise<ChatSession> {
    return mapSession(await request<RawChatSession>(`/api/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, materialIds })
    }));
  },
  async companyProfile(): Promise<CompanyProfile> {
    return request<CompanyProfile>("/api/company/profile");
  },
  async saveCompanyProfile(input: Partial<Omit<CompanyProfile, "version" | "updatedAt">>): Promise<CompanyProfile> {
    return request<CompanyProfile>("/api/company/profile", {
      method: "PUT",
      body: JSON.stringify(input)
    });
  },
  async companyMaterials(): Promise<Material[]> {
    return request<Material[]>("/api/company/materials");
  },
  async saveCompanyMaterial(input: File | { name: string; mimeType: string; size: number; contentText?: string; category?: CompanyMaterialCategory; tags?: string[]; description?: string }): Promise<Material> {
    if (typeof File !== "undefined" && input instanceof File) {
      const body = new FormData();
      body.append("file", input, input.name);
      return request<Material>("/api/company/materials", {
        method: "POST",
        body
      });
    }
    return request<Material>("/api/company/materials", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async companyMaterialPreview(id: string): Promise<MaterialPreview> {
    return request<MaterialPreview>(`/api/company/materials/${id}/preview`);
  },
  async updateCompanyMaterial(id: string, input: { name?: string; category?: CompanyMaterialCategory | null; tags?: string[]; description?: string | null }): Promise<Material> {
    return request<Material>(`/api/company/materials/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },
  async copyCompanyMaterial(id: string, input: { name?: string; category?: CompanyMaterialCategory | null; tags?: string[]; description?: string | null } = {}): Promise<Material> {
    return request<Material>(`/api/company/materials/${id}/copy`, { method: "POST", body: JSON.stringify(input) });
  },
  async deleteCompanyMaterial(id: string): Promise<void> {
    await request<void>(`/api/company/materials/${id}`, { method: "DELETE" });
  },
  async outreachLeads(query = ""): Promise<OutreachLead[]> {
    const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    return request<OutreachLead[]>(`/api/outreach/leads${suffix}`);
  },
  async createOutreachLead(input: OutreachLeadInput): Promise<OutreachLead> {
    return request<OutreachLead>("/api/outreach/leads", { method: "POST", body: JSON.stringify(input) });
  },
  async updateOutreachLead(id: string, input: Partial<Pick<OutreachLead, "companyName" | "website" | "country" | "industry" | "contactName" | "contactTitle" | "email" | "need" | "notes" | "tags">>): Promise<OutreachLead> {
    return request<OutreachLead>(`/api/outreach/leads/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },
  async importOutreachLeads(csvText: string): Promise<{ imported: OutreachLead[]; skipped: Array<{ row: number; reason: string }> }> {
    return request<{ imported: OutreachLead[]; skipped: Array<{ row: number; reason: string }> }>("/api/outreach/leads/import", {
      method: "POST",
      body: JSON.stringify({ csvText })
    });
  },
  async generateOutreachDraft(input: {
    leadId?: string;
    lead?: OutreachLeadInput;
    language?: string;
    tone?: string;
    providerId?: string;
    model?: string;
  }): Promise<OutreachDraft> {
    return request<OutreachDraft>("/api/outreach/drafts/generate", { method: "POST", body: JSON.stringify(input) });
  },
  async autoGenerateOutreachDraft(input: {
    website: string;
    email: string;
    language?: string;
    tone?: string;
    providerId?: string;
    model?: string;
  }): Promise<OutreachDraft> {
    return request<OutreachDraft>("/api/outreach/drafts/auto", { method: "POST", body: JSON.stringify(input) });
  },
  async autoGenerateOutreachWorkflow(input: {
    website: string;
    email: string;
    language?: string;
    tone?: string;
    providerId?: string;
    model?: string;
  }): Promise<OutreachWorkflow> {
    return request<OutreachWorkflow>("/api/outreach/workflows/auto", { method: "POST", body: JSON.stringify(input) });
  },
  async outreachWorkflows(q?: string): Promise<OutreachWorkflow[]> {
    return request<OutreachWorkflow[]>(`/api/outreach/workflows${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  },
  async outreachWorkflow(id: string): Promise<OutreachWorkflow> {
    return request<OutreachWorkflow>(`/api/outreach/workflows/${id}`);
  },
  async updateOutreachDraft(id: string, input: Partial<Pick<OutreachDraft, "subject" | "body" | "language" | "tone">>): Promise<OutreachDraft> {
    return request<OutreachDraft>(`/api/outreach/drafts/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },
  async outreachSenderAccounts(): Promise<OutreachSenderAccount[]> {
    return request<OutreachSenderAccount[]>("/api/outreach/sender-accounts");
  },
  async saveOutreachSenderAccount(input: {
    id?: string;
    label: string;
    fromName?: string;
    email: string;
    host: string;
    port: number;
    secure: boolean;
    username?: string;
    password?: string;
    enabled?: boolean;
  }): Promise<OutreachSenderAccount> {
    const { id, ...payload } = input;
    return request<OutreachSenderAccount>(id ? `/api/outreach/sender-accounts/${id}` : "/api/outreach/sender-accounts", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
  },
  async testOutreachSenderAccount(id: string): Promise<{ ok: boolean; message: string; sender: OutreachSenderAccount }> {
    return request<{ ok: boolean; message: string; sender: OutreachSenderAccount }>(`/api/outreach/sender-accounts/${id}/test`, { method: "POST", body: "{}" });
  },
  async sendOutreachSenderTestEmail(id: string, to?: string): Promise<{ ok: boolean; message: string; sender: OutreachSenderAccount }> {
    return request<{ ok: boolean; message: string; sender: OutreachSenderAccount }>(`/api/outreach/sender-accounts/${id}/test-email`, {
      method: "POST",
      body: JSON.stringify({ to })
    });
  },
  async confirmOutreachSenderDelivery(id: string): Promise<{ ok: boolean; message: string; sender: OutreachSenderAccount }> {
    return request<{ ok: boolean; message: string; sender: OutreachSenderAccount }>(`/api/outreach/sender-accounts/${id}/confirm-delivery`, { method: "POST", body: "{}" });
  },
  async sendOutreachDraft(id: string, input: { senderAccountId: string; to?: string }): Promise<OutreachDraft> {
    return request<OutreachDraft>(`/api/outreach/drafts/${id}/send`, {
      method: "POST",
      body: JSON.stringify({ ...input, confirm: true })
    });
  },
  async materials(): Promise<Material[]> {
    return request<Material[]>("/api/materials");
  },
  async saveMaterial(input: File | { name: string; mimeType: string; size: number; contentText?: string; folder?: string }): Promise<Material> {
    if (typeof File !== "undefined" && input instanceof File) {
      const body = new FormData();
      body.append("file", input, input.name);
      return request<Material>("/api/materials", {
        method: "POST",
        body
      });
    }
    return request<Material>("/api/materials", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async materialPreview(id: string): Promise<MaterialPreview> {
    return request<MaterialPreview>(`/api/materials/${id}/preview`);
  },
  async updateMaterial(id: string, input: { name?: string; folder?: string | null }): Promise<Material> {
    return request<Material>(`/api/materials/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },
  async copyMaterial(id: string, input: { name?: string; folder?: string | null } = {}): Promise<Material> {
    return request<Material>(`/api/materials/${id}/copy`, { method: "POST", body: JSON.stringify(input) });
  },
  async downloadMaterial(id: string): Promise<Blob> {
    const desktopConfig = await window.hermillsDesktop?.getConfig?.();
    const baseUrl = desktopConfig?.apiBaseUrl || "http://127.0.0.1:47321";
    const token = desktopConfig?.desktopToken;
    const headers = new Headers();
    if (token) headers.set("x-hermills-token", token);
    const res = await fetch(`${baseUrl}/api/materials/${id}/download`, { headers });
    if (!res.ok) throw new Error(await res.text().catch(() => `${res.status} ${res.statusText}`));
    return res.blob();
  },
  async deleteMaterial(id: string): Promise<void> {
    await request<void>(`/api/materials/${id}`, { method: "DELETE" });
  }
};

export const fallback = {
  runtime: {
    state: "not-installed",
    installed: false,
    localDeploymentComplete: false,
    version: "Not installed",
    path: "/usr/local/bin/hermills-runtime",
    progress: 0,
    message: "Set up Hermes to enable private local chat."
  } satisfies RuntimeStatus,
  appState: {
    version: 1,
    firstDeployHidden: false,
    shouldShowFirstDeploy: true,
    runtimeRecoverable: false
  } satisfies AppState,
  companyProfile: {
    version: 1,
    name: "",
    markets: [],
    mainProducts: [],
    certifications: [],
    paymentTerms: [],
    shippingTerms: [],
    brandVoice: "",
    notes: ""
  } satisfies CompanyProfile,
  onboarding: {
    version: 1,
    language: "en",
    userDisplayName: "",
    agentName: "Hermes",
    memoryEnabled: false,
    theme: "system",
    completed: false
  } satisfies OnboardingState,
  agents: [] satisfies Agent[],
  providers: [] satisfies Provider[],
  profiles: { profiles: [], activeProfileId: "" } satisfies ProfileState,
  usage: {
    conversations: 0,
    messages: 0,
    files: 0,
    fileBytes: 0,
    providers: 0,
    connectedProviders: 0,
    agents: 0,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }
  } satisfies UsageSummary,
  analytics: {
    conversations: 0,
    messages: 0,
    files: 0,
    fileBytes: 0,
    providers: 0,
    connectedProviders: 0,
    agents: 0,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    jobs: 0,
    activeJobs: 0,
    jobRuns: 0,
    failedJobRuns: 0,
    channels: 0,
    connectedChannels: 0,
    logs: 0,
    errorLogs: 0
  } satisfies AnalyticsSummary,
  jobs: [] satisfies JobRecord[],
  jobRuns: [] satisfies JobRunRecord[],
  channels: [] satisfies ChannelRecord[],
  logs: [] satisfies LogEntry[],
  sessions: [] satisfies ChatSession[],
  materials: [] satisfies Material[],
  companyMaterials: [] satisfies Material[],
  outreachLeads: [] satisfies OutreachLead[],
  outreachSenderAccounts: [] satisfies OutreachSenderAccount[]
};
