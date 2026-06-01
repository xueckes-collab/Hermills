import { createHash, randomBytes, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { createWriteStream } from "node:fs";
import { access, chmod, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
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
const DEFAULT_INSTALLER_URL = "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh";
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

interface InstallJob {
  id: string;
  events: InstallEvent[];
  status: "running" | "done" | "failed";
}

type InstallMetadata = NonNullable<RuntimeStatus["installMetadata"]>;

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
      installerUrl: DEFAULT_INSTALLER_URL,
      licenseUrl: DEFAULT_LICENSE_URL,
      fetchedAt: new Date().toISOString()
    };

    const docs = await this.fetchText(OFFICIAL_DOCS_URL).catch(() => "");
    const installerMatch = docs.match(/https:\/\/raw\.githubusercontent\.com\/NousResearch\/hermes-agent\/[^"'\s)]+\/scripts\/install\.sh/);
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
        { id: "platform", label: "macOS first-release target", ok: process.platform === "darwin", detail: `${process.platform}/${process.arch}` },
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
    const child = spawn(executablePath, ["gateway", "run", "--replace"], {
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

  async dispose(): Promise<void> {
    await this.stopGateway();
    this.emitter.removeAllListeners();
  }

  async createHermesReply(request: HermesReplyRequest | ChatMessage[]): Promise<string> {
    const replyRequest = Array.isArray(request) ? { messages: request } : request;
    const target = await this.resolveCompletionTarget(replyRequest.provider);
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

  private async runInstall(job: InstallJob, request: InstallRequest): Promise<void> {
    await mkdir(this.hermesHome, { recursive: true });
    await mkdir(this.logHome, { recursive: true });

    this.pushEvent(job, "info", "checking", 8, "Checking the official Hermes Agent installer.");
    const latest: RuntimeLatest = await this.getLatest().catch(() => ({
      sourceUrl: OFFICIAL_DOCS_URL,
      installerUrl: request.installerUrl ?? DEFAULT_INSTALLER_URL,
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
    const installerPath = path.join(stagingDir, "install-hermes-agent.sh");
    await writeFile(installerPath, installerBody, "utf8");
    await chmod(installerPath, 0o700);

    if (request.dryRun) {
      job.status = "done";
      this.pushEvent(job, "done", "verifying", 100, `Dry-run complete. Installer staged at ${installerPath}.`);
      return;
    }

    await this.prepareRuntimeDirectoryForInstaller(job);
    this.pushEvent(job, "info", "installing", 40, "Installing Hermes Agent into the Hermills-managed local folder.");
    const installerArgs = ["--skip-setup", "--dir", this.runtimeHome, "--hermes-home", this.hermesHome];
    if (request.skipBrowser) installerArgs.push("--skip-browser");
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

    if (gateway.state === "running") await this.markLocalDeployCompleted(version);
    this.updateCheckCache = undefined;

    this.pushEvent(job, gateway.state === "running" ? "done" : "warn", "verifying", gateway.state === "running" ? 100 : 92, gateway.message ?? "Gateway start requested.");
    job.status = "done";
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

  private async findExecutable(): Promise<string | undefined> {
    for (const candidate of [
      path.join(this.runtimeHome, "venv", "bin", "hermes"),
      path.join(this.runtimeHome, ".venv", "bin", "hermes"),
      path.join(this.runtimeHome, "bin", "hermes"),
      path.join(this.runtimeHome, "bin", "hermes-agent"),
      path.join(this.runtimeHome, "hermes"),
      path.join(this.runtimeHome, "hermes-agent")
    ]) {
      if (await pathExists(candidate)) return candidate;
    }
    return undefined;
  }

  private readVersion(executablePath: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const child = spawn(executablePath, ["--version"], { env: { ...process.env, HERMES_HOME: this.hermesHome }, stdio: ["ignore", "pipe", "ignore"] });
      let output = "";
      child.stdout.on("data", (chunk) => {
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
    const expectedPath = kind === "installer" ? "scripts/install.sh" : "LICENSE";
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

export function chatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (/\/v1\/chat\/completions$/i.test(normalized)) return normalized;
  if (/\/v1$/i.test(normalized)) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

export function modelsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (/\/v1\/models$/i.test(normalized)) return normalized;
  if (/\/v1\/chat\/completions$/i.test(normalized)) return normalized.replace(/\/chat\/completions$/i, "/models");
  if (/\/v1$/i.test(normalized)) return `${normalized}/models`;
  return `${normalized}/v1/models`;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
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
