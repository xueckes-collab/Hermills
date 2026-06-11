import { createHash, randomBytes, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { createWriteStream } from "node:fs";
import { access, chmod, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";
import {
  getDataHome,
  getHermillsHome,
  getLogHome,
  getRuntimeHome,
  redactSecrets,
  type AppState,
  type ChatMessage,
  type InstallEvent,
  type InstallRequest,
  type RuntimeStatus
} from "@hermills/core";

const OFFICIAL_DOCS_URL = "https://hermes-agent.nousresearch.com/docs/";
const GITHUB_RELEASE_URL = "https://api.github.com/repos/NousResearch/hermes-agent/releases/latest";
const DEFAULT_UNIX_INSTALLER_URL = "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh";
const DEFAULT_WINDOWS_INSTALLER_URL = "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1";
const DEFAULT_LICENSE_URL = "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/LICENSE";
const DEFAULT_API_PORT = 8642;

export interface RuntimeServiceOptions {
  baseDir?: string;
  fetchImpl?: typeof fetch;
  allowCustomInstaller?: boolean;
  fetchTimeoutMs?: number;
  updateCheckCacheMs?: number;
  apiPort?: number;
}

export interface RuntimeLatest {
  sourceUrl: string;
  installerUrl: string;
  licenseUrl: string;
  latestReleaseTag?: string;
  latestReleaseName?: string;
  installerSha256?: string;
  installerSize?: number;
  fetchedAt: string;
}

export interface RuntimeUpdateCheck {
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
}

export interface HermesReplyProvider {
  kind?: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
}

export interface HermesReplyRequest {
  messages: ChatMessage[];
  model?: string;
  instructions?: string;
  provider?: HermesReplyProvider;
}

export interface GatewayStatus {
  state: "stopped" | "starting" | "running" | "failed";
  pid?: number;
  apiBaseUrl?: string;
  message?: string;
}

export interface ComputerControlCliStatus {
  found: boolean;
  path?: string;
  version?: string;
  message?: string;
}

export interface ComputerControlDriverStatus {
  installed: boolean;
  statusText: string;
}

export interface ComputerControlToolsetStatus {
  computerUseEnabled: boolean;
  enabled: string[];
  missingRequired: string[];
  output?: string;
}

export interface ComputerControlDashboardStatus {
  state: "stopped" | "starting" | "running" | "failed";
  pid?: number;
  port?: number;
  url?: string;
  message?: string;
  logPath?: string;
}

export type ComputerControlPermissionState = "granted" | "missing" | "required" | "unknown";
export type ComputerControlReadiness = "ready" | "preparing" | "needs-permission" | "failed" | "unsupported";
export type ComputerControlPermissionId = "screen-recording" | "accessibility";

export interface ComputerControlPermissionHint {
  id: "screen-recording" | "accessibility" | "automation" | "files";
  label: string;
  state: ComputerControlPermissionState;
  detail: string;
}

export interface ComputerControlStatus {
  platform: string;
  supported: boolean;
  hermesCli: ComputerControlCliStatus;
  driver: ComputerControlDriverStatus;
  toolsets: ComputerControlToolsetStatus;
  dashboard: ComputerControlDashboardStatus;
  readiness: ComputerControlReadiness;
  permissions: ComputerControlPermissionHint[];
}

export interface ComputerControlRunResult {
  ok: boolean;
  message: string;
  output: string;
  status: ComputerControlStatus;
}

export interface ComputerControlCommandResult {
  ok: boolean;
  message: string;
  output?: string;
  status: ComputerControlStatus;
}

interface InstallJob {
  id: string;
  events: InstallEvent[];
  status: "running" | "done" | "failed";
}

type InstallMetadata = NonNullable<RuntimeStatus["installMetadata"]>;

type PermissionHelperPayload = {
  screenRecording?: "granted" | "missing" | "unknown";
  accessibility?: "granted" | "missing" | "unknown";
  automation?: "unknown";
  files?: "workspace-only" | "missing" | "unknown";
};

export class RuntimeService {
  private readonly baseDir: string;
  private readonly runtimeHome: string;
  private readonly hermesHome: string;
  private readonly logHome: string;
  private readonly fetchImpl: typeof fetch;
  private readonly allowCustomInstaller: boolean;
  private readonly fetchTimeoutMs: number;
  private readonly updateCheckCacheMs: number;
  private readonly apiPort: number;
  private readonly emitter = new EventEmitter();
  private readonly jobs = new Map<string, InstallJob>();
  private updateCheckCache?: { expiresAt: number; value: RuntimeUpdateCheck };
  private updateCheckPromise?: Promise<RuntimeUpdateCheck>;
  private gatewayProcess?: ChildProcess;
  private gatewayMessage = "";
  private gatewayFailed = false;
  private dashboardProcess?: ChildProcess;
  private dashboardPort?: number;
  private dashboardMessage = "";
  private dashboardFailed = false;
  private dashboardLogPath?: string;

  constructor(options: RuntimeServiceOptions = {}) {
    this.baseDir = options.baseDir ?? getHermillsHome();
    this.runtimeHome = getRuntimeHome(this.baseDir);
    this.hermesHome = path.join(this.baseDir, "hermes-home");
    this.logHome = getLogHome(this.baseDir);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.allowCustomInstaller = options.allowCustomInstaller ?? false;
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? 30_000;
    this.updateCheckCacheMs = options.updateCheckCacheMs ?? 24 * 60 * 60 * 1000;
    this.apiPort = resolveApiPort(options.apiPort);
  }

  async getLatest(): Promise<RuntimeLatest> {
    const latest: RuntimeLatest = {
      sourceUrl: OFFICIAL_DOCS_URL,
      installerUrl: defaultInstallerUrl(),
      licenseUrl: DEFAULT_LICENSE_URL,
      fetchedAt: new Date().toISOString()
    };

    const docs = await this.fetchText(OFFICIAL_DOCS_URL).catch(() => "");
    const installerMatch = docs.match(defaultInstallerRegex());
    if (installerMatch) latest.installerUrl = installerMatch[0];

    const release = await this.fetchJson<{ tag_name?: string; name?: string }>(GITHUB_RELEASE_URL).catch(() => undefined);
    latest.latestReleaseTag = release?.tag_name;
    latest.latestReleaseName = release?.name;
    const installerBody = await this.fetchText(latest.installerUrl).catch(() => undefined);
    if (installerBody) {
      latest.installerSha256 = createHash("sha256").update(installerBody).digest("hex");
      latest.installerSize = Buffer.byteLength(installerBody, "utf8");
    }
    return latest;
  }

  async getUpdateCheck(force = false): Promise<RuntimeUpdateCheck> {
    const now = Date.now();
    if (!force && this.updateCheckCache && this.updateCheckCache.expiresAt > now) return this.updateCheckCache.value;
    if (!force && this.updateCheckPromise) return this.updateCheckPromise;

    this.updateCheckPromise = this.computeUpdateCheck()
      .then((value) => {
        this.updateCheckCache = { value, expiresAt: Date.now() + this.updateCheckCacheMs };
        return value;
      })
      .finally(() => {
        this.updateCheckPromise = undefined;
      });

    return this.updateCheckPromise;
  }

  async getStatus(): Promise<RuntimeStatus> {
    const executablePath = await this.findExecutable();
    const installed = Boolean(executablePath);
    const version = executablePath ? await this.readVersion(executablePath) : undefined;
    const updateCheck = await this.getUpdateCheck().catch(() => undefined);
    const installMetadata = await this.readInstallMetadata().catch(() => undefined);
    const activeInstallJob = [...this.jobs.values()].find((job) => job.status === "running")?.id;
    let gateway = await this.getGatewayStatus();
    if (installed && gateway.state === "stopped" && await this.shouldAutoStartGateway()) {
      gateway = await this.startGateway().catch((error) => ({
        state: "failed" as const,
        apiBaseUrl: this.apiBaseUrl(),
        message: error instanceof Error ? error.message : String(error)
      }));
      if (gateway.state === "running") await this.markLocalDeployCompleted(version);
    }
    const ready = installed && gateway.state === "running";

    return {
      platform: process.platform,
      arch: process.arch,
      installed,
      state: activeInstallJob ? "installing" : ready ? "ready" : installed ? "needs-user-action" : "not-installed",
      version,
      latestVersion: updateCheck?.latestVersion,
      updateAvailable: updateCheck?.updateAvailable,
      executablePath,
      runtimeHome: this.runtimeHome,
      hermesHome: this.hermesHome,
      installerUrl: updateCheck?.installerUrl,
      installMetadata,
      gateway,
      checks: [
        { id: "platform", label: "Supported desktop platform", ok: isSupportedDesktopPlatform(), detail: `${process.platform}/${process.arch}` },
        { id: "runtime-home", label: "Managed install directory", ok: await pathExists(this.runtimeHome), detail: this.runtimeHome },
        { id: "hermes-home", label: "Managed Hermes home", ok: await pathExists(this.hermesHome), detail: this.hermesHome },
        { id: "executable", label: "Hermes command", ok: installed, detail: executablePath },
        { id: "gateway", label: "Hermes API gateway", ok: gateway.state === "running", detail: gateway.message ?? gateway.apiBaseUrl }
      ],
      activeInstallJob
    };
  }

  async getAppState(): Promise<AppState> {
    return this.readAppState();
  }

  async startInstall(request: Partial<InstallRequest> = {}): Promise<{ jobId: string }> {
    const activeJob = this.activeInstallJob();
    if (activeJob) return { jobId: activeJob.id };

    const installRequest: InstallRequest = {
      channel: "official-docs-latest",
      dryRun: false,
      force: false,
      skipBrowser: true,
      ...request
    };
    const job: InstallJob = { id: randomUUID(), events: [], status: "running" };
    this.jobs.set(job.id, job);
    void this.runInstall(job, installRequest).catch((error) => {
      job.status = "failed";
      this.pushEvent(job, "error", "failed", 100, explainInstallError(error));
    });
    return { jobId: job.id };
  }

  getEvents(jobId: string): InstallEvent[] {
    return this.jobs.get(jobId)?.events ?? [];
  }

  onEvent(jobId: string, listener: (event: InstallEvent) => void): () => void {
    const eventName = `job:${jobId}`;
    this.emitter.on(eventName, listener);
    return () => this.emitter.off(eventName, listener);
  }

  async getGatewayStatus(): Promise<GatewayStatus> {
    const healthy = await this.verifyApiServer();
    if (!this.gatewayProcess) {
      return healthy
        ? { state: "running", apiBaseUrl: this.apiBaseUrl(), message: "Hermes API server is reachable." }
        : { state: this.gatewayFailed ? "failed" : "stopped", apiBaseUrl: this.apiBaseUrl(), message: this.gatewayMessage || "Gateway is not running." };
    }
    if (this.gatewayProcess.exitCode !== null) {
      if (healthy) {
        this.gatewayProcess = undefined;
        this.gatewayFailed = false;
        this.gatewayMessage = "Hermes API server is reachable.";
        return { state: "running", apiBaseUrl: this.apiBaseUrl(), message: this.gatewayMessage };
      }
      return { state: "failed", apiBaseUrl: this.apiBaseUrl(), message: this.gatewayMessage || `Gateway exited with code ${this.gatewayProcess.exitCode}.` };
    }
    return { state: healthy ? "running" : "starting", pid: this.gatewayProcess.pid, apiBaseUrl: this.apiBaseUrl(), message: healthy ? "Hermes API server is reachable." : "Gateway process is starting." };
  }

  async startGateway(): Promise<GatewayStatus> {
    if (await this.verifyApiServer()) return { state: "running", apiBaseUrl: this.apiBaseUrl(), message: "Hermes API server is reachable." };
    const executablePath = await this.findExecutable();
    if (!executablePath) throw new Error("Hermes is not installed yet.");
    if (this.gatewayProcess?.exitCode === null) return this.getGatewayStatus();

    await mkdir(this.hermesHome, { recursive: true });
    await mkdir(this.logHome, { recursive: true });
    const apiKey = await this.ensureApiKey();
    await this.writeApiServerEnv(apiKey);

    const logPath = path.join(this.logHome, `gateway-${Date.now()}.log`);
    const logStream = createWriteStream(logPath, { flags: "a" });
    this.gatewayFailed = false;
    this.gatewayMessage = `Starting gateway. Log: ${logPath}`;
    const child = spawnHermes(executablePath, ["gateway", "run", "--replace"], {
      cwd: this.hermesHome,
      env: {
        ...process.env,
        HERMES_HOME: this.hermesHome,
        API_SERVER_ENABLED: "true",
        API_SERVER_HOST: "127.0.0.1",
        API_SERVER_PORT: String(this.apiPort),
        API_SERVER_KEY: apiKey
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.gatewayProcess = child;

    const onChunk = (chunk: Buffer) => {
      const line = redactSecrets(chunk.toString("utf8"));
      logStream.write(line);
      const trimmed = line.trim();
      if (trimmed) this.gatewayMessage = trimmed;
    };
    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.on("error", (error) => {
      this.gatewayFailed = true;
      this.gatewayMessage = error.message;
      logStream.end();
    });
    child.on("close", (code) => {
      this.gatewayFailed = true;
      this.gatewayMessage = `Gateway exited with code ${code ?? "unknown"}. Log: ${logPath}`;
      logStream.end();
    });

    await waitFor(async () => this.verifyApiServer(), 15000).catch(() => undefined);
    return this.getGatewayStatus();
  }

  async stopGateway(): Promise<GatewayStatus> {
    if (this.gatewayProcess?.exitCode === null) {
      this.gatewayProcess.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (this.gatewayProcess.exitCode === null) this.gatewayProcess.kill("SIGKILL");
    }
    this.gatewayProcess = undefined;
    this.gatewayFailed = false;
    this.gatewayMessage = "Gateway stopped.";
    return this.getGatewayStatus();
  }

  async restartGateway(): Promise<GatewayStatus> {
    await this.stopGateway();
    return this.startGateway();
  }

  async getComputerControlStatus(): Promise<ComputerControlStatus> {
    const hermesCli = await this.getComputerControlCliStatus();
    const commandStatus = hermesCli.path ? await this.runHermesCommand(["computer-use", "status"], 15_000).catch((error) => commandError(error)) : undefined;
    const toolsStatus = hermesCli.path ? await this.runHermesCommand(["tools", "--summary", "list"], 15_000).catch((error) => commandError(error)) : undefined;
    const driver = parseComputerUseDriverStatus(commandStatus?.output ?? "");
    const toolsets = parseToolsetStatus(toolsStatus?.output ?? "");
    const permissions = await this.getComputerControlPermissionHints();
    return {
      platform: process.platform,
      supported: process.platform === "darwin",
      hermesCli,
      driver,
      toolsets,
      dashboard: this.getComputerControlDashboardStatus(),
      readiness: computerControlReadiness({
        supported: process.platform === "darwin",
        hermesCli,
        driver,
        toolsets,
        permissions
      }),
      permissions
    };
  }

  async prepareComputerControl(): Promise<ComputerControlCommandResult> {
    if (process.platform !== "darwin") {
      return {
        ok: false,
        message: "Hermes computer control is currently macOS-only.",
        status: await this.getComputerControlStatus()
      };
    }
    let status = await this.getComputerControlStatus();
    if (!status.hermesCli.found) {
      return {
        ok: false,
        message: "Hermes CLI is not available. Install Hermes before using computer control.",
        status
      };
    }
    if (!status.toolsets.computerUseEnabled) status = (await this.enableComputerControlTools()).status;
    if (!status.driver.installed) status = (await this.installComputerControlDriver()).status;
    return {
      ok: status.readiness === "ready" || status.readiness === "needs-permission",
      message: status.readiness === "needs-permission" ? "Hermes needs macOS permission before computer control." : "Hermes computer control is prepared.",
      status
    };
  }

  async requestComputerControlPermission(permission: ComputerControlPermissionId): Promise<ComputerControlCommandResult> {
    if (process.platform !== "darwin") {
      return {
        ok: false,
        message: "Hermes computer control is currently macOS-only.",
        status: await this.getComputerControlStatus()
      };
    }
    const action = permission === "screen-recording" ? "request-screen-recording" : "request-accessibility";
    const result = await this.runPermissionHelper(action).catch(() => undefined);
    return {
      ok: Boolean(result),
      message: result ? "macOS permission request was opened." : "macOS permission helper is not available yet.",
      status: await this.getComputerControlStatus()
    };
  }

  async installComputerControlDriver(): Promise<ComputerControlCommandResult> {
    if (process.platform !== "darwin") throw new Error("Hermes computer use is currently macOS-only.");
    const result = await this.runHermesCommand(["computer-use", "install"], 5 * 60_000);
    return {
      ok: result.ok,
      message: result.ok ? "Hermes computer-use driver install finished." : "Hermes computer-use driver install failed.",
      output: result.output,
      status: await this.getComputerControlStatus()
    };
  }

  async enableComputerControlTools(): Promise<ComputerControlCommandResult> {
    const toolsets = ["web", "browser", "terminal", "file", "code_execution", "vision", "skills", "memory", "computer_use"];
    const result = await this.runHermesCommand(["tools", "enable", "--platform", "cli", ...toolsets], 60_000);
    return {
      ok: result.ok,
      message: result.ok ? "Hermes computer control tools are enabled." : "Hermes tools could not be enabled.",
      output: result.output,
      status: await this.getComputerControlStatus()
    };
  }

  async startComputerControlDashboard(): Promise<ComputerControlCommandResult> {
    if (this.dashboardProcess?.exitCode === null) {
      return {
        ok: true,
        message: "Hermes computer console is already running.",
        status: await this.getComputerControlStatus()
      };
    }
    const executablePath = await this.findComputerControlExecutable();
    if (!executablePath) throw new Error("Hermes CLI is not available. Install Hermes before starting computer control.");

    await mkdir(this.hermesHome, { recursive: true });
    await mkdir(this.logHome, { recursive: true });
    const port = await findOpenPort(9119);
    const logPath = path.join(this.logHome, `computer-control-${Date.now()}.log`);
    const logStream = createWriteStream(logPath, { flags: "a" });
    this.dashboardPort = port;
    this.dashboardLogPath = logPath;
    this.dashboardFailed = false;
    this.dashboardMessage = "Starting Hermes computer console.";

    const child = spawn(executablePath, ["dashboard", "--tui", "--host", "127.0.0.1", "--port", String(port), "--no-open"], {
      cwd: this.hermesHome,
      env: this.hermesCommandEnv(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.dashboardProcess = child;

    const onChunk = (chunk: Buffer) => {
      const line = redactSecrets(chunk.toString("utf8"));
      logStream.write(line);
      const trimmed = line.trim();
      if (trimmed) this.dashboardMessage = trimmed;
    };
    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.on("error", (error) => {
      this.dashboardFailed = true;
      this.dashboardMessage = error.message;
      logStream.end();
    });
    child.on("close", (code) => {
      this.dashboardFailed = code !== 0;
      this.dashboardMessage = `Hermes computer console exited with code ${code ?? "unknown"}. Log: ${logPath}`;
      logStream.end();
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));
    if (this.dashboardProcess.exitCode === null && this.dashboardMessage === "Starting Hermes computer console.") {
      this.dashboardMessage = "Hermes computer console is running.";
    }
    return {
      ok: this.dashboardProcess.exitCode === null,
      message: this.dashboardProcess.exitCode === null ? "Hermes computer console is running." : this.dashboardMessage,
      status: await this.getComputerControlStatus()
    };
  }

  async stopComputerControlDashboard(): Promise<ComputerControlCommandResult> {
    await this.stopComputerControlDashboardProcess();
    return {
      ok: true,
      message: "Hermes computer console stopped.",
      status: await this.getComputerControlStatus()
    };
  }

  async runComputerControlPrompt(prompt: string): Promise<ComputerControlRunResult> {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) throw new Error("Computer control prompt cannot be empty.");
    if (process.platform !== "darwin") throw new Error("Hermes computer control is currently macOS-only.");

    let status = await this.getComputerControlStatus();
    if (!status.hermesCli.found) throw new Error("Hermes CLI is not available. Install Hermes before using computer control.");
    if (!status.toolsets.computerUseEnabled) status = (await this.enableComputerControlTools()).status;
    if (!status.driver.installed) status = (await this.installComputerControlDriver()).status;
    if (!status.toolsets.computerUseEnabled) throw new Error("Hermes computer-use toolset could not be enabled.");
    if (!status.driver.installed) throw new Error("Hermes computer-use driver is not installed yet.");
    status = await this.getComputerControlStatus();
    if (status.readiness === "needs-permission") {
      throw new Error("Hermes needs macOS permission before computer control.");
    }

    const result = await this.runHermesCommand([
      "chat",
      "--query",
      normalizedPrompt,
      "--quiet",
      "--source",
      "hermills-computer-control",
      "--toolsets",
      "browser,computer_use,file,terminal,vision"
    ], 3 * 60_000);

    return {
      ok: result.ok,
      message: result.ok ? "Hermes finished the computer operation." : "Hermes could not finish the computer operation.",
      output: result.output,
      status: await this.getComputerControlStatus()
    };
  }

  async dispose(): Promise<void> {
    await this.stopComputerControlDashboardProcess();
    await this.stopGateway();
    this.emitter.removeAllListeners();
  }

  async createHermesReply(request: HermesReplyRequest | ChatMessage[]): Promise<string> {
    const replyRequest = Array.isArray(request) ? { messages: request } : request;
    const target = await this.resolveCompletionTarget(replyRequest.provider);
    if (isAnthropicProvider(replyRequest.provider)) {
      return this.createAnthropicReply(replyRequest, target);
    }

    const response = await this.fetchImpl(chatCompletionsUrl(target.baseUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${target.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: resolveCompletionModel(replyRequest),
        messages: buildCompletionMessages(replyRequest),
        stream: false
      })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Hermes API returned ${response.status}: ${redactSecrets(text)}`);
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content ?? "Hermes returned an empty response.";
  }

  private async createAnthropicReply(replyRequest: HermesReplyRequest, target: { baseUrl: string; apiKey: string }): Promise<string> {
    const { system, messages } = buildAnthropicMessages(replyRequest);
    const response = await this.fetchImpl(anthropicMessagesUrl(target.baseUrl), {
      method: "POST",
      headers: {
        "x-api-key": target.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: resolveCompletionModel(replyRequest),
        max_tokens: 2048,
        ...(system ? { system } : {}),
        messages
      })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Hermes API returned ${response.status}: ${redactSecrets(text)}`);
    }
    const payload = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (payload.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("\n")
      .trim();
    return text || "Hermes returned an empty response.";
  }

  private async runInstall(job: InstallJob, request: InstallRequest): Promise<void> {
    await mkdir(this.hermesHome, { recursive: true });
    await mkdir(this.logHome, { recursive: true });

    this.pushEvent(job, "info", "checking", 8, "Checking the official Hermes Agent installer.");
    const latest: RuntimeLatest = await this.getLatest().catch(() => ({
      sourceUrl: OFFICIAL_DOCS_URL,
      installerUrl: request.installerUrl ?? defaultInstallerUrl(),
      licenseUrl: request.licenseUrl ?? DEFAULT_LICENSE_URL,
      fetchedAt: new Date().toISOString()
    }));
    const installerUrl = request.installerUrl ?? latest.installerUrl;
    const licenseUrl = request.licenseUrl ?? latest.licenseUrl;
    this.assertTrustedInstallSource(installerUrl, "installer");
    this.assertTrustedInstallSource(licenseUrl, "license");

    this.pushEvent(job, "info", "checking", 15, "Checking upstream Hermes Agent license.");
    const license = await this.fetchText(licenseUrl);
    if (!/MIT License/i.test(license)) {
      throw new Error("Hermes Agent upstream license was not recognized as MIT. Installation stopped.");
    }

    this.pushEvent(job, "info", "downloading", 28, "Downloading the official Hermes Agent installer.");
    const installerBody = await this.fetchText(installerUrl);
    const installerSha256 = createHash("sha256").update(installerBody).digest("hex");
    if (request.installerSha256 && request.installerSha256 !== installerSha256) {
      throw new Error(`Hermes Agent installer hash mismatch. Expected ${request.installerSha256}, got ${installerSha256}.`);
    }
    this.pushEvent(job, "info", "downloading", 34, `Installer SHA256 verified: ${installerSha256}.`);
    const stagingDir = path.join(this.baseDir, "runtime", "staging");
    await mkdir(stagingDir, { recursive: true });
    const installerPath = path.join(stagingDir, installerFileName(installerUrl));
    await writeFile(installerPath, installerBody, "utf8");
    await makeExecutableIfSupported(installerPath);

    if (request.dryRun) {
      job.status = "done";
      this.pushEvent(job, "done", "verifying", 100, `Dry-run complete. Installer staged at ${installerPath}.`);
      return;
    }

    await this.prepareRuntimeDirectoryForInstaller(job);
    this.pushEvent(job, "info", "installing", 40, "Installing Hermes Agent into the Hermills-managed local folder.");
    const installerArgs = process.platform === "win32"
      ? ["-SkipSetup", "-NonInteractive", "-Json", "-InstallDir", this.runtimeHome, "-HermesHome", this.hermesHome]
      : ["--skip-setup", "--dir", this.runtimeHome, "--hermes-home", this.hermesHome];
    if (request.skipBrowser && process.platform !== "win32") installerArgs.push("--skip-browser");
    await this.runInstaller(installerPath, installerArgs, path.join(this.logHome, `install-${Date.now()}.log`), job);

    const executablePath = await this.findExecutable();
    const version = executablePath ? await this.readVersion(executablePath) : undefined;
    await this.writeInstallMetadata({
      installedAt: new Date().toISOString(),
      sourceUrl: latest.sourceUrl,
      installerUrl,
      licenseUrl,
      latestReleaseTag: latest.latestReleaseTag,
      latestReleaseName: latest.latestReleaseName,
      executablePath,
      version
    });

    this.pushEvent(job, "info", "configuring", 72, "Configuring the local Hermes API server.");
    const apiKey = await this.ensureApiKey();
    await this.writeApiServerEnv(apiKey);

    this.pushEvent(job, "info", "starting", 84, "Starting Hermes gateway.");
    const gateway = await this.startGateway();

    await this.prepareComputerControlForLocalInstall();

    if (gateway.state === "running") await this.markLocalDeployCompleted(version);
    this.updateCheckCache = undefined;

    this.pushEvent(job, gateway.state === "running" ? "done" : "warn", "verifying", gateway.state === "running" ? 100 : 92, gateway.message ?? "Gateway start requested.");
    job.status = "done";
  }

  private async prepareComputerControlForLocalInstall(): Promise<void> {
    if (process.platform !== "darwin") return;
    try {
      await this.prepareComputerControl();
    } catch {
      // Computer control is retried from chat on first use, so a setup hiccup must not block local Hermes installation.
    }
  }

  private async computeUpdateCheck(): Promise<RuntimeUpdateCheck> {
    const checkedAt = new Date().toISOString();
    const executablePath = await this.findExecutable();
    const installed = Boolean(executablePath);
    const installedVersion = executablePath ? await this.readVersion(executablePath) : undefined;
    const installMetadata = await this.readInstallMetadata().catch(() => undefined);

    try {
      const latest = await this.getLatest();
      const updateAvailable = isHermesUpdateAvailable(latest.latestReleaseTag, installMetadata, installedVersion);
      return {
        installed,
        installedVersion,
        installedReleaseTag: installMetadata?.latestReleaseTag,
        latestVersion: latest.latestReleaseTag,
        latestReleaseName: latest.latestReleaseName,
        updateAvailable,
        checkState: !installed ? "not-installed" : !latest.latestReleaseTag ? "unknown" : updateAvailable ? "available" : "current",
        checkedAt,
        sourceUrl: latest.sourceUrl,
        installerUrl: latest.installerUrl,
        installerSha256: latest.installerSha256
      };
    } catch (error) {
      return {
        installed,
        installedVersion,
        installedReleaseTag: installMetadata?.latestReleaseTag,
        updateAvailable: false,
        checkState: installed ? "unknown" : "not-installed",
        checkedAt,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async fetchText(url: string): Promise<string> {
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.fetchTimeoutMs) });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    return response.text();
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(this.fetchTimeoutMs) });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    return response.json() as Promise<T>;
  }

  private runInstaller(installerPath: string, installerArgs: string[], logPath: string, job: InstallJob): Promise<void> {
    if (process.platform === "win32") return this.runWindowsInstaller(installerPath, logPath, job);

    return new Promise((resolve, reject) => {
      const logStream = createWriteStream(logPath, { flags: "a" });
      const child = spawn("bash", [installerPath, ...installerArgs], {
        cwd: this.baseDir,
        env: { ...process.env, HERMILLS_HOME: this.baseDir, HERMES_HOME: this.hermesHome, HERMES_AGENT_HOME: this.runtimeHome },
        stdio: ["ignore", "pipe", "pipe"]
      });
      const onChunk = (chunk: Buffer) => {
        const line = redactSecrets(chunk.toString("utf8"));
        logStream.write(line);
        const trimmed = line.trim();
        if (trimmed) this.pushEvent(job, "info", "installing", 55, trimmed);
      };
      child.stdout.on("data", onChunk);
      child.stderr.on("data", onChunk);
      child.on("error", (error) => {
        logStream.end();
        reject(error);
      });
      child.on("close", (code) => {
        logStream.end();
        code === 0 ? resolve() : reject(new Error(`Installer exited with code ${code ?? "unknown"}. Log: ${logPath}`));
      });
    });
  }

  private async runWindowsInstaller(installerPath: string, logPath: string, job: InstallJob): Promise<void> {
    const baseArgs = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      installerPath,
      "-InstallDir",
      this.runtimeHome,
      "-HermesHome",
      this.hermesHome
    ];
    const manifest = await this.runWindowsInstallerCommand([...baseArgs, "-Manifest"], logPath, job, 42);
    const parsedManifest = parseJsonLine<{ stages?: Array<{ name?: string; title?: string; needs_user_input?: boolean }> }>(manifest.stdout);
    const stages = (parsedManifest?.stages ?? []).filter((stage) => stage.name && !stage.needs_user_input);

    if (stages.length === 0) {
      await this.runWindowsInstallerCommand([...baseArgs, "-SkipSetup", "-NonInteractive", "-Json"], logPath, job, 55);
      return;
    }

    for (const [index, stage] of stages.entries()) {
      const progress = 42 + Math.floor((index / Math.max(stages.length, 1)) * 26);
      this.pushEvent(job, "info", "installing", progress, stage.title ?? `Running installer stage ${stage.name}.`);
      const result = await this.runWindowsInstallerCommand([...baseArgs, "-Stage", String(stage.name), "-NonInteractive", "-Json"], logPath, job, progress);
      const stageResult = parseJsonLine<{ ok?: boolean; skipped?: boolean; reason?: string }>(result.stdout);
      if (stageResult?.ok === false) throw new Error(stageResult.reason ?? `Installer stage failed: ${stage.name}`);
      if (stageResult?.skipped) this.pushEvent(job, "warn", "installing", progress, stageResult.reason ?? `Installer stage skipped: ${stage.name}.`);
    }
  }

  private runWindowsInstallerCommand(args: string[], logPath: string, job: InstallJob, progress: number): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const logStream = createWriteStream(logPath, { flags: "a" });
      const child = spawn(windowsPowerShellCommand(), args, {
        cwd: this.baseDir,
        env: { ...process.env, HERMILLS_HOME: this.baseDir, HERMES_HOME: this.hermesHome, HERMES_AGENT_HOME: this.runtimeHome },
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      const onChunk = (chunk: Buffer, stream: "stdout" | "stderr") => {
        const line = redactSecrets(chunk.toString("utf8"));
        logStream.write(line);
        if (stream === "stdout") stdout += line;
        else stderr += line;
        const trimmed = line.trim();
        if (trimmed && !looksLikeJson(trimmed)) this.pushEvent(job, "info", "installing", progress, trimmed);
      };
      child.stdout?.on("data", (chunk) => onChunk(chunk, "stdout"));
      child.stderr?.on("data", (chunk) => onChunk(chunk, "stderr"));
      child.on("error", (error) => {
        logStream.end();
        reject(error);
      });
      child.on("close", (code) => {
        logStream.end();
        code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`Installer exited with code ${code ?? "unknown"}. Log: ${logPath}`));
      });
    });
  }

  private async prepareRuntimeDirectoryForInstaller(job: InstallJob): Promise<void> {
    if (!(await pathExists(this.runtimeHome))) return;
    if (await pathExists(path.join(this.runtimeHome, ".git"))) return;

    const entries = await readdir(this.runtimeHome).catch(() => undefined);
    if (entries?.length === 0) {
      await rm(this.runtimeHome, { recursive: true, force: true });
      this.pushEvent(job, "info", "installing", 39, "Removed an empty partial Hermes install directory before retrying.");
      return;
    }

    const backupPath = `${this.runtimeHome}.partial-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
    await rename(this.runtimeHome, backupPath);
    this.pushEvent(job, "warn", "installing", 39, `Moved incomplete Hermes install aside before retrying: ${backupPath}.`);
  }

  private async getComputerControlCliStatus(): Promise<ComputerControlCliStatus> {
    const executablePath = await this.findComputerControlExecutable();
    if (!executablePath) return { found: false, message: "Hermes CLI was not found." };
    return {
      found: true,
      path: executablePath,
      version: await this.readVersion(executablePath)
    };
  }

  private async getComputerControlPermissionHints(): Promise<ComputerControlPermissionHint[]> {
    if (process.platform !== "darwin") return computerControlPermissionHints();
    const payload = await this.runPermissionHelper("status").catch(() => undefined);
    if (!payload) return computerControlPermissionHints();
    return [
      {
        id: "screen-recording",
        label: "Screen Recording",
        state: permissionState(payload.screenRecording),
        detail: "macOS asks for this when Hermes needs to see the screen."
      },
      {
        id: "accessibility",
        label: "Accessibility",
        state: permissionState(payload.accessibility),
        detail: "macOS asks for this when Hermes needs to click, type, or control apps."
      },
      {
        id: "automation",
        label: "Automation",
        state: "unknown",
        detail: "macOS asks per app when Hermes needs to control another app."
      },
      {
        id: "files",
        label: "Files and folders",
        state: payload.files === "workspace-only" ? "required" : permissionState(payload.files),
        detail: "Only choose folders you want Hermes to read or write."
      }
    ];
  }

  private async runPermissionHelper(action: string): Promise<PermissionHelperPayload | undefined> {
    if (process.platform !== "darwin") return undefined;
    const executablePath = await this.findPermissionHelperExecutable();
    if (!executablePath) return undefined;
    await mkdir(this.hermesHome, { recursive: true });
    const result = await runCommand(executablePath, [action], {
      cwd: this.hermesHome,
      env: this.hermesCommandEnv(),
      timeoutMs: 15_000
    });
    return JSON.parse(result.output) as PermissionHelperPayload;
  }

  private async findPermissionHelperExecutable(): Promise<string | undefined> {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
    const candidates = [
      process.env.HERMILLS_PERMISSION_HELPER,
      path.join(moduleDir, "helpers", "hermills-permission-helper"),
      path.join(process.cwd(), "packages", "runtime", "dist", "helpers", "hermills-permission-helper"),
      resourcesPath ? path.join(resourcesPath, "bin", "hermills-permission-helper") : undefined,
      resourcesPath ? path.join(resourcesPath, "app.asar.unpacked", "packages", "runtime", "dist", "helpers", "hermills-permission-helper") : undefined
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      if (await pathExists(candidate)) return candidate;
    }
    return undefined;
  }

  private async stopComputerControlDashboardProcess(): Promise<void> {
    if (this.dashboardProcess?.exitCode === null) {
      this.dashboardProcess.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (this.dashboardProcess.exitCode === null) this.dashboardProcess.kill("SIGKILL");
    }
    this.dashboardProcess = undefined;
    this.dashboardFailed = false;
    this.dashboardMessage = "Hermes computer console stopped.";
  }

  private getComputerControlDashboardStatus(): ComputerControlDashboardStatus {
    if (!this.dashboardProcess) {
      return {
        state: this.dashboardFailed ? "failed" : "stopped",
        message: this.dashboardMessage || "Hermes computer console is stopped.",
        logPath: this.dashboardLogPath
      };
    }
    if (this.dashboardProcess.exitCode !== null) {
      return {
        state: this.dashboardFailed ? "failed" : "stopped",
        port: this.dashboardPort,
        url: this.dashboardPort ? `http://127.0.0.1:${this.dashboardPort}` : undefined,
        message: this.dashboardMessage || `Hermes computer console exited with code ${this.dashboardProcess.exitCode}.`,
        logPath: this.dashboardLogPath
      };
    }
    return {
      state: this.dashboardMessage === "Starting Hermes computer console." ? "starting" : "running",
      pid: this.dashboardProcess.pid,
      port: this.dashboardPort,
      url: this.dashboardPort ? `http://127.0.0.1:${this.dashboardPort}` : undefined,
      message: this.dashboardMessage || "Hermes computer console is running.",
      logPath: this.dashboardLogPath
    };
  }

  private async findComputerControlExecutable(): Promise<string | undefined> {
    const managed = await this.findExecutable();
    if (managed) return managed;
    const candidates = [
      process.env.HERMILLS_HERMES_CLI,
      path.join(homedir(), ".local", "bin", "hermes"),
      "/opt/homebrew/bin/hermes",
      "/usr/local/bin/hermes",
      "hermes"
    ].filter((candidate): candidate is string => Boolean(candidate));
    for (const candidate of candidates) {
      if (path.isAbsolute(candidate) && !(await pathExists(candidate))) continue;
      if (await this.commandWorks(candidate, ["--version"])) return candidate;
    }
    return undefined;
  }

  private commandWorks(command: string, args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { env: this.hermesCommandEnv(), stdio: ["ignore", "ignore", "ignore"] });
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve(false);
      }, 5000);
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve(code === 0);
      });
      child.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  private async runHermesCommand(args: string[], timeoutMs: number): Promise<{ ok: boolean; output: string }> {
    const executablePath = await this.findComputerControlExecutable();
    if (!executablePath) throw new Error("Hermes CLI is not available.");
    await mkdir(this.hermesHome, { recursive: true });
    return runCommand(executablePath, args, {
      cwd: this.hermesHome,
      env: this.hermesCommandEnv(),
      timeoutMs
    });
  }

  private hermesCommandEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PATH: prependPathEntries(process.env.PATH, [
        path.join(this.runtimeHome, "venv", "bin"),
        path.join(this.runtimeHome, ".venv", "bin"),
        path.join(this.runtimeHome, "bin"),
        path.join(homedir(), ".local", "bin"),
        "/opt/homebrew/bin",
        "/usr/local/bin"
      ]),
      HERMILLS_HOME: this.baseDir,
      HERMES_HOME: this.hermesHome,
      HERMES_AGENT_HOME: this.runtimeHome
    };
  }

  private async findExecutable(): Promise<string | undefined> {
    for (const candidate of executableCandidates(this.runtimeHome)) {
      if (await pathExists(candidate)) return candidate;
    }
    return undefined;
  }

  private readVersion(executablePath: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const child = spawnHermes(executablePath, ["--version"], { env: { ...process.env, HERMES_HOME: this.hermesHome }, stdio: ["ignore", "pipe", "ignore"] });
      let output = "";
      child.stdout?.on("data", (chunk) => {
        output += chunk.toString("utf8");
      });
      child.on("close", () => resolve(output.trim() || undefined));
      child.on("error", () => resolve(undefined));
    });
  }

  private async verifyApiServer(): Promise<boolean> {
    const apiKey = await this.ensureApiKey().catch(() => undefined);
    if (!apiKey) return false;
    try {
      const response = await this.fetchImpl(modelsUrl(this.apiBaseUrl()), {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async writeApiServerEnv(apiKey: string): Promise<void> {
    await ensurePrivateDirectory(this.hermesHome);
    const envPath = path.join(this.hermesHome, ".env");
    const current = await readFile(envPath, "utf8").catch(() => "");
    const next = upsertEnv(current, {
      API_SERVER_ENABLED: "true",
      API_SERVER_HOST: "127.0.0.1",
      API_SERVER_PORT: String(this.apiPort),
      API_SERVER_KEY: apiKey
    });
    await writeAtomic(envPath, next, 0o600);
  }

  private apiBaseUrl(): string {
    return `http://127.0.0.1:${this.apiPort}`;
  }

  private async resolveCompletionTarget(provider?: HermesReplyProvider): Promise<{ baseUrl: string; apiKey: string }> {
    const baseUrl = provider?.baseUrl?.trim();
    if (baseUrl) {
      const apiKey = provider?.apiKey?.trim();
      if (!apiKey) throw new Error("The selected provider is missing an API key.");
      return { baseUrl, apiKey };
    }

    const executablePath = await this.findExecutable();
    if (!executablePath) throw new Error("Hermes is not installed. Install Hermes Agent before chatting.");
    let gateway = await this.getGatewayStatus();
    if (gateway.state !== "running") gateway = await this.startGateway();
    if (gateway.state !== "running") throw new Error(gateway.message ?? "Hermes gateway is not ready.");
    return { baseUrl: this.apiBaseUrl(), apiKey: await this.ensureApiKey() };
  }

  private async ensureApiKey(): Promise<string> {
    const keyPath = path.join(this.baseDir, "secure", "hermes-api.key");
    try {
      await chmodPrivateFile(keyPath, 0o600);
      return (await readFile(keyPath, "utf8")).trim();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const key = `hm_${randomBytes(24).toString("hex")}`;
      await ensurePrivateDirectory(path.dirname(keyPath));
      await writeFile(keyPath, `${key}\n`, { encoding: "utf8", mode: 0o600 });
      await chmodPrivateFile(keyPath, 0o600);
      return key;
    }
  }

  private assertTrustedInstallSource(url: string, kind: "installer" | "license"): void {
    if (this.allowCustomInstaller) return;
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const repoOk = parsed.protocol === "https:" && parsed.hostname === "raw.githubusercontent.com" && parts[0] === "NousResearch" && parts[1] === "hermes-agent";
    const filePath = parts.slice(3).join("/");
    const expectedPath = kind === "installer" ? defaultInstallerScriptPath() : "LICENSE";
    if (!repoOk || filePath !== expectedPath) {
      throw new Error(`Refusing untrusted Hermes Agent ${kind} URL. Expected official NousResearch/hermes-agent ${expectedPath}.`);
    }
  }

  private pushEvent(job: InstallJob, level: InstallEvent["level"], step: string, progress: number, message: string): void {
    if (!message) return;
    const event = { jobId: job.id, level, step, progress, message: redactSecrets(message), createdAt: new Date().toISOString() };
    job.events.push(event);
    this.emitter.emit(`job:${job.id}`, event);
  }

  private metadataPath(): string {
    return path.join(this.runtimeHome, "hermills-install.json");
  }

  private appStatePath(): string {
    return path.join(getDataHome(this.baseDir), "app-state.json");
  }

  private activeInstallJob(): InstallJob | undefined {
    return [...this.jobs.values()].find((job) => job.status === "running");
  }

  private async readInstallMetadata(): Promise<InstallMetadata | undefined> {
    try {
      return JSON.parse(await readFile(this.metadataPath(), "utf8")) as InstallMetadata;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  private async writeInstallMetadata(metadata: InstallMetadata): Promise<void> {
    await writeAtomic(this.metadataPath(), `${JSON.stringify(metadata, null, 2)}\n`, 0o600);
  }

  private async readAppState(): Promise<AppState> {
    try {
      return appStateFromUnknown(JSON.parse(await readFile(this.appStatePath(), "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return appStateFromUnknown({});
      throw error;
    }
  }

  private async writeAppState(appState: AppState): Promise<AppState> {
    const next = appStateFromUnknown(appState);
    await writeAtomic(this.appStatePath(), `${JSON.stringify(next, null, 2)}\n`, 0o600);
    return next;
  }

  private async markLocalDeployCompleted(version?: string): Promise<AppState> {
    const current = await this.readAppState();
    const now = new Date().toISOString();
    return this.writeAppState({
      ...current,
      firstDeployHidden: true,
      localDeployCompletedAt: current.localDeployCompletedAt ?? now,
      lastSuccessfulRuntimeVersion: version ?? current.lastSuccessfulRuntimeVersion,
      lastSuccessfulGatewayAt: now
    });
  }

  private async shouldAutoStartGateway(): Promise<boolean> {
    return (await this.readAppState()).firstDeployHidden === true;
  }
}

function appStateFromUnknown(value: unknown): AppState {
  const source = isRecord(value) ? value : {};
  return {
    version: 1,
    firstDeployHidden: source.firstDeployHidden === true,
    ...optionalDate("localDeployCompletedAt", source.localDeployCompletedAt),
    ...optionalString("lastSuccessfulRuntimeVersion", source.lastSuccessfulRuntimeVersion),
    ...optionalDate("lastSuccessfulGatewayAt", source.lastSuccessfulGatewayAt)
  };
}

function optionalString<Key extends string>(key: Key, value: unknown): Partial<Record<Key, string>> {
  return typeof value === "string" && value.length > 0 ? { [key]: value } as Record<Key, string> : {};
}

function optionalDate<Key extends string>(key: Key, value: unknown): Partial<Record<Key, string>> {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? { [key]: value } as Record<Key, string> : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function defaultInstallerUrl(): string {
  return process.platform === "win32" ? DEFAULT_WINDOWS_INSTALLER_URL : DEFAULT_UNIX_INSTALLER_URL;
}

function defaultInstallerScriptPath(): string {
  return process.platform === "win32" ? "scripts/install.ps1" : "scripts/install.sh";
}

function defaultInstallerRegex(): RegExp {
  return process.platform === "win32"
    ? /https:\/\/raw\.githubusercontent\.com\/NousResearch\/hermes-agent\/[^"'\s)]+\/scripts\/install\.ps1/
    : /https:\/\/raw\.githubusercontent\.com\/NousResearch\/hermes-agent\/[^"'\s)]+\/scripts\/install\.sh/;
}

function installerFileName(installerUrl: string): string {
  return /\.ps1(?:$|[?#])/i.test(installerUrl) ? "install-hermes-agent.ps1" : "install-hermes-agent.sh";
}

async function makeExecutableIfSupported(filePath: string): Promise<void> {
  if (process.platform === "win32") return;
  await chmod(filePath, 0o700);
}

function isSupportedDesktopPlatform(): boolean {
  return process.platform === "darwin" || process.platform === "win32";
}

function executableCandidates(runtimeHome: string): string[] {
  const windowsCandidates = [
    path.join(runtimeHome, "venv", "Scripts", "hermes.exe"),
    path.join(runtimeHome, ".venv", "Scripts", "hermes.exe"),
    path.join(runtimeHome, "Scripts", "hermes.exe"),
    path.join(runtimeHome, "hermes.exe"),
    path.join(runtimeHome, "venv", "Scripts", "hermes.cmd"),
    path.join(runtimeHome, ".venv", "Scripts", "hermes.cmd"),
    path.join(runtimeHome, "Scripts", "hermes.cmd"),
    path.join(runtimeHome, "hermes.cmd")
  ];
  const unixCandidates = [
    path.join(runtimeHome, "venv", "bin", "hermes"),
    path.join(runtimeHome, ".venv", "bin", "hermes"),
    path.join(runtimeHome, "bin", "hermes"),
    path.join(runtimeHome, "bin", "hermes-agent"),
    path.join(runtimeHome, "hermes"),
    path.join(runtimeHome, "hermes-agent")
  ];
  return process.platform === "win32" ? [...windowsCandidates, ...unixCandidates] : unixCandidates;
}

function spawnHermes(executablePath: string, args: string[], options: Parameters<typeof spawn>[2]): ChildProcess {
  if (process.platform === "win32" && /\.(?:cmd|bat)$/i.test(executablePath)) {
    return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/c", "call", executablePath, ...args], options);
  }
  return spawn(executablePath, args, options);
}

function windowsPowerShellCommand(): string {
  const systemRoot = process.env.SystemRoot;
  return systemRoot ? path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "powershell.exe";
}

function looksLikeJson(value: string): boolean {
  return value.startsWith("{") && value.endsWith("}");
}

function parseJsonLine<T>(value: string): T | undefined {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!looksLikeJson(lines[index])) continue;
    try {
      return JSON.parse(lines[index]) as T;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isHermesUpdateAvailable(latestReleaseTag: string | undefined, installMetadata: InstallMetadata | undefined, installedVersion: string | undefined): boolean {
  if (!latestReleaseTag) return false;
  if (installMetadata?.latestReleaseTag) return normalizeHermesReleaseTag(installMetadata.latestReleaseTag) !== normalizeHermesReleaseTag(latestReleaseTag);
  return installedVersion ? !installedVersionMatchesReleaseTag(installedVersion, latestReleaseTag) : false;
}

function installedVersionMatchesReleaseTag(installedVersion: string, latestReleaseTag: string): boolean {
  if (installedVersion.includes(latestReleaseTag)) return true;
  const normalizedLatest = normalizeHermesReleaseTag(latestReleaseTag);
  if (!normalizedLatest) return false;
  return installedVersion.replace(/\bv(?=\d)/gi, "").includes(normalizedLatest);
}

function normalizeHermesReleaseTag(tag: string): string {
  return tag.trim().replace(/^refs\/tags\//i, "").replace(/^v(?=\d)/i, "");
}

export function resolveCompletionModel(request: HermesReplyRequest): string {
  return request.model?.trim() || request.provider?.defaultModel?.trim() || "hermes-agent";
}

export function buildCompletionMessages(request: HermesReplyRequest): Array<{ role: ChatMessage["role"]; content: string }> {
  const messages = request.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }));
  const instructions = request.instructions?.trim();
  return instructions ? [{ role: "system", content: instructions }, ...messages] : messages;
}

export function buildAnthropicMessages(request: HermesReplyRequest): { system?: string; messages: Array<{ role: "user" | "assistant"; content: string }> } {
  const systemParts = [
    request.instructions?.trim(),
    ...request.messages.filter((message) => message.role === "system").map((message) => message.content.trim())
  ].filter((part): part is string => Boolean(part));
  const messages = request.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role === "assistant" ? "assistant" as const : "user" as const, content: message.content }));
  return {
    ...(systemParts.length ? { system: systemParts.join("\n\n") } : {}),
    messages: messages.length ? messages : [{ role: "user", content: "" }]
  };
}

function isAnthropicProvider(provider?: HermesReplyProvider): boolean {
  return provider?.kind === "anthropic";
}

export function chatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (/\/v1\/chat\/completions$/i.test(normalized)) return normalized;
  if (/\/chat\/completions$/i.test(normalized)) return normalized;
  if (/\/v1$/i.test(normalized)) return `${normalized}/chat/completions`;
  if (baseUrlHasPath(normalized)) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

export function anthropicMessagesUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (/\/v1\/messages$/i.test(normalized)) return normalized;
  if (/\/v1$/i.test(normalized)) return `${normalized}/messages`;
  return `${normalized}/v1/messages`;
}

export function modelsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (/\/v1\/models$/i.test(normalized)) return normalized;
  if (/\/models$/i.test(normalized)) return normalized;
  if (/\/v1\/chat\/completions$/i.test(normalized)) return normalized.replace(/\/chat\/completions$/i, "/models");
  if (/\/chat\/completions$/i.test(normalized)) return normalized.replace(/\/chat\/completions$/i, "/models");
  if (/\/v1$/i.test(normalized)) return `${normalized}/models`;
  if (baseUrlHasPath(normalized)) return `${normalized}/models`;
  return `${normalized}/v1/models`;
}

function baseUrlHasPath(normalizedBaseUrl: string): boolean {
  try {
    return new URL(normalizedBaseUrl).pathname.replace(/\/+$/, "") !== "";
  } catch {
    return false;
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function commandError(error: unknown): { ok: false; output: string; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, output: message, message };
}

function parseComputerUseDriverStatus(output: string): ComputerControlDriverStatus {
  const text = output.trim();
  const installed = /cua-driver:\s*installed|computer use.*ready|installed/i.test(text) && !/not installed/i.test(text);
  return {
    installed,
    statusText: text || "Computer-use driver status has not been checked."
  };
}

function parseToolsetStatus(output: string): ComputerControlToolsetStatus {
  const enabled = new Set<string>();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/\benabled\s+([a-z0-9_:-]+)\b/i)
      ?? line.match(/^\s*[-*]?\s*([a-z0-9_:-]+)\s+(?:enabled|on|true)\b/i);
    if (match?.[1]) enabled.add(match[1]);
  }
  for (const name of ["web", "browser", "terminal", "file", "code_execution", "vision", "skills", "memory", "computer_use"]) {
    if (new RegExp(`\\b${escapeRegex(name)}\\b[\\s\\S]{0,80}\\benabled\\b`, "i").test(output)) enabled.add(name);
  }
  const required = ["terminal", "file", "browser", "computer_use"];
  const missingRequired = required.filter((name) => !enabled.has(name));
  return {
    computerUseEnabled: enabled.has("computer_use"),
    enabled: [...enabled].sort(),
    missingRequired,
    output: output.trim() || undefined
  };
}

function computerControlPermissionHints(): ComputerControlPermissionHint[] {
  return [
    {
      id: "screen-recording",
      label: "Screen Recording",
      state: "unknown",
      detail: "macOS may ask for this when Hermes needs to see the screen."
    },
    {
      id: "accessibility",
      label: "Accessibility",
      state: "unknown",
      detail: "macOS may ask for this when Hermes needs to click, type, or control apps."
    },
    {
      id: "automation",
      label: "Automation",
      state: "unknown",
      detail: "macOS may ask for this when Hermes needs to control another app."
    },
    {
      id: "files",
      label: "Files and folders",
      state: "required",
      detail: "Only choose folders you want Hermes to read or write."
    }
  ];
}

function permissionState(input?: string): ComputerControlPermissionState {
  if (input === "granted" || input === "missing" || input === "required" || input === "unknown") return input;
  return "unknown";
}

function computerControlReadiness(input: {
  supported: boolean;
  hermesCli: ComputerControlCliStatus;
  driver: ComputerControlDriverStatus;
  toolsets: ComputerControlToolsetStatus;
  permissions: ComputerControlPermissionHint[];
}): ComputerControlReadiness {
  if (!input.supported) return "unsupported";
  if (!input.hermesCli.found) return "failed";
  if (!input.toolsets.computerUseEnabled || !input.driver.installed) return "preparing";
  const missingInteractivePermission = input.permissions.some((permission) => (
    (permission.id === "screen-recording" || permission.id === "accessibility") && permission.state === "missing"
  ));
  return missingInteractivePermission ? "needs-permission" : "ready";
}

function runCommand(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number }): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const append = (chunk: Buffer) => {
      output = `${output}${chunk.toString("utf8")}`.slice(-64_000);
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Hermes command timed out: ${args.join(" ")}`));
    }, options.timeoutMs);
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const sanitized = redactSecrets(output.trim());
      if (code === 0) resolve({ ok: true, output: sanitized });
      else reject(new Error(sanitized || `Hermes command failed with code ${code ?? "unknown"}.`));
    });
  });
}

function prependPathEntries(currentPath: string | undefined, entries: string[]): string {
  const existing = currentPath ? currentPath.split(path.delimiter) : [];
  return [...entries, ...existing].filter(Boolean).join(path.delimiter);
}

function findOpenPort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      const server = createNetServer();
      server.once("error", () => {
        server.close();
        if (port >= 65535) reject(new Error("No open local port is available for Hermes computer console."));
        else tryPort(port + 1);
      });
      server.once("listening", () => {
        server.close(() => resolve(port));
      });
      server.listen(port, "127.0.0.1");
    };
    tryPort(startPort);
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function ensurePrivateDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
  await chmod(dirPath, 0o700).catch(() => undefined);
}

async function chmodPrivateFile(filePath: string, mode: number): Promise<void> {
  await chmod(filePath, mode).catch(() => undefined);
}

async function writeAtomic(filePath: string, body: string, mode = 0o600): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, body, { encoding: "utf8", mode });
  await rename(tmpPath, filePath);
  await chmodPrivateFile(filePath, mode);
}

function upsertEnv(current: string, values: Record<string, string>): string {
  const lines = current.split(/\r?\n/).filter((line) => line.length > 0);
  const seen = new Set<string>();
  const next = lines.map((line) => {
    const key = line.match(/^([A-Z0-9_]+)=/)?.[1];
    if (key && key in values) {
      seen.add(key);
      return `${key}=${values[key]}`;
    }
    return line;
  });
  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }
  return `${next.join("\n")}\n`;
}

function resolveApiPort(port?: number): number {
  const candidate = port ?? Number(process.env.HERMILLS_HERMES_API_PORT || DEFAULT_API_PORT);
  return Number.isInteger(candidate) && candidate > 0 && candidate < 65536 ? candidate : DEFAULT_API_PORT;
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("Timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function explainInstallError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch|network|ENOTFOUND|ECONNRESET|TLS|Failed to fetch/i.test(message)) {
    return `Network problem while installing Hermes Agent. Check your connection and retry. Detail: ${message}`;
  }
  if (/license/i.test(message)) return message;
  if (/exited with code/i.test(message)) return `Hermes installer failed. Use "Copy diagnostics" and retry after fixing the listed issue. Detail: ${message}`;
  return message;
}
