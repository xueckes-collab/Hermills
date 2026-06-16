import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { anthropicMessagesUrl, buildAnthropicMessages, chatCompletionsUrl, modelsUrl, responsesUrl, RuntimeService } from "@hermills/runtime";

describe("RuntimeService", () => {
  it("resolves the official installer and latest release metadata", async () => {
    const service = new RuntimeService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-latest-")),
      fetchImpl: async (url) => {
        const value = String(url);
        if (value.includes("api.github.com")) return Response.json({ tag_name: "v0.14.0", name: "Hermes Agent v0.14.0" });
        return new Response(`Install with https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh`);
      }
    });
    const latest = await service.getLatest();
    expect(latest.installerUrl).toContain(process.platform === "win32" ? "scripts/install.ps1" : "scripts/install.sh");
    expect(latest.latestReleaseTag).toBe("v0.14.0");
    expect(latest.installerSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("stages installer in dry-run mode after MIT license verification", async () => {
    const service = new RuntimeService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-")),
      allowCustomInstaller: true,
      fetchImpl: async (url) => new Response(String(url).endsWith("LICENSE") ? "MIT License" : fakeInstallerScript())
    });
    const { jobId } = await service.startInstall({ dryRun: true, installerUrl: fakeInstallerUrl(), licenseUrl: "https://example.com/LICENSE" });
    await waitFor(() => service.getEvents(jobId).some((event) => event.level === "done"));
    expect(service.getEvents(jobId).map((event) => event.message).join("\n")).toContain("Dry-run complete");
    expect(service.getEvents(jobId).some((event) => event.step === "downloading" && typeof event.progress === "number")).toBe(true);
    expect(await service.getAppState()).toMatchObject({ firstDeployHidden: false });
    expect((await service.getAppState()).localDeployCompletedAt).toBeUndefined();
  });

  it("refuses custom installer URLs unless explicitly enabled", async () => {
    const service = new RuntimeService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-untrusted-")),
      fetchImpl: async (url) => new Response(String(url).endsWith("LICENSE") ? "MIT License" : fakeInstallerScript())
    });
    const { jobId } = await service.startInstall({ dryRun: true, installerUrl: fakeInstallerUrl(), licenseUrl: "https://example.com/LICENSE" });
    await waitFor(() => service.getEvents(jobId).some((event) => event.level === "error"));
    expect(service.getEvents(jobId).at(-1)?.message).toContain("Refusing untrusted Hermes Agent installer URL");
  });

  it("blocks install when upstream license is not recognized as MIT", async () => {
    const service = new RuntimeService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-license-")),
      fetchImpl: async () => new Response("Business Source License")
    });
    const { jobId } = await service.startInstall({ dryRun: true });
    await waitFor(() => service.getEvents(jobId).some((event) => event.level === "error"));
    expect(service.getEvents(jobId).at(-1)?.message).toContain("not recognized as MIT");
    expect(await service.getAppState()).toMatchObject({ firstDeployHidden: false });
    expect((await service.getAppState()).localDeployCompletedAt).toBeUndefined();
  });

  it("returns the existing active install job for concurrent requests", async () => {
    const service = new RuntimeService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-concurrent-")),
      allowCustomInstaller: true,
      fetchImpl: async (url) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return new Response(String(url).endsWith("LICENSE") ? "MIT License" : fakeInstallerScript());
      }
    });
    const first = await service.startInstall({ dryRun: true, installerUrl: fakeInstallerUrl(), licenseUrl: "https://example.com/LICENSE" });
    const second = await service.startInstall({ dryRun: true, installerUrl: fakeInstallerUrl(), licenseUrl: "https://example.com/LICENSE" });
    expect(second.jobId).toBe(first.jobId);
    await waitFor(() => service.getEvents(first.jobId).some((event) => event.level === "done"));
  });

  it("recovers from an empty partial runtime directory before install", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-partial-"));
    await mkdir(path.join(baseDir, "runtime", "hermes-agent"), { recursive: true });
    const service = new RuntimeService({
      baseDir,
      allowCustomInstaller: true,
      fetchImpl: async (url) => {
        const value = String(url);
        if (value.includes("api.github.com")) return Response.json({ tag_name: "v0.14.0", name: "Hermes Agent v0.14.0" });
        if (value.endsWith("/v1/models")) return Response.json({ data: [{ id: "hermes-agent" }] });
        return new Response(value.endsWith("LICENSE") ? "MIT License" : fakeOfficialStyleInstallerScript());
      }
    });

    try {
      const { jobId } = await service.startInstall({ installerUrl: fakeInstallerUrl(), licenseUrl: "https://example.com/LICENSE" });
      await waitFor(() => service.getEvents(jobId).some((event) => event.step === "verifying"), 20_000);
      expect(service.getEvents(jobId).map((event) => event.message).join("\n")).toContain("Removed an empty partial Hermes install directory");
      await expect(service.getStatus()).resolves.toMatchObject({ installed: true, state: "ready" });
    } finally {
      await service.dispose();
    }
  }, 25_000);

  it("checks Hermes updates with cache and force refresh", async () => {
    let releaseTag = "v0.14.0";
    let githubCalls = 0;
    const service = new RuntimeService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-update-check-")),
      allowCustomInstaller: true,
      updateCheckCacheMs: 60_000,
      fetchImpl: async (url) => {
        const value = String(url);
        if (value.includes("api.github.com")) {
          githubCalls += 1;
          return Response.json({ tag_name: releaseTag, name: `Hermes Agent ${releaseTag}` });
        }
        if (value.endsWith("/v1/models")) return Response.json({ data: [{ id: "hermes-agent" }] });
        return new Response(value.endsWith("LICENSE") ? "MIT License" : fakeInstallerScript());
      }
    });

    try {
      const { jobId } = await service.startInstall({ installerUrl: fakeInstallerUrl(), licenseUrl: "https://example.com/LICENSE" });
      await waitFor(() => service.getEvents(jobId).some((event) => event.step === "verifying"), 20_000);

      const current = await service.getUpdateCheck(true);
      expect(current).toMatchObject({
        installed: true,
        latestVersion: "v0.14.0",
        updateAvailable: false,
        checkState: "current"
      });

      releaseTag = "v0.15.0";
      const cached = await service.getUpdateCheck();
      expect(cached.latestVersion).toBe("v0.14.0");

      const refreshed = await service.getUpdateCheck(true);
      expect(refreshed).toMatchObject({
        latestVersion: "v0.15.0",
        updateAvailable: true,
        checkState: "available"
      });
      expect(githubCalls).toBeGreaterThanOrEqual(3);
    } finally {
      await service.dispose();
    }
  }, 25_000);

  it("treats an installed date version as current when the release tag has a v prefix", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-update-normalized-"));
    const executablePath = path.join(baseDir, "runtime", "hermes-agent", "bin", "hermes");
    await mkdir(path.dirname(executablePath), { recursive: true });
    await writeFile(executablePath, "#!/usr/bin/env bash\necho 'Hermes Agent v0.14.0 (2026.5.16)'\n", "utf8");
    await chmod(executablePath, 0o755);
    const service = new RuntimeService({
      baseDir,
      fetchImpl: async (url) => {
        const value = String(url);
        if (value.includes("api.github.com")) return Response.json({ tag_name: "v2026.5.16", name: "Hermes Agent v0.14.0" });
        return new Response("https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh");
      }
    });

    await expect(service.getUpdateCheck(true)).resolves.toMatchObject({
      installed: true,
      latestVersion: "v2026.5.16",
      updateAvailable: false,
      checkState: "current"
    });
  });

  it("runs built-in computer control through fixed Hermes chat arguments", async () => {
    if (process.platform !== "darwin") return;
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-computer-chat-"));
    const executablePath = path.join(baseDir, "runtime", "hermes-agent", "bin", "hermes");
    const logPath = path.join(baseDir, "hermes-args.log");
    await mkdir(path.dirname(executablePath), { recursive: true });
    await writeFile(executablePath, `#!/usr/bin/env bash
log=${JSON.stringify(logPath)}
printf '%s\\n' "$*" >> "$log"
if [[ "$1" == "--version" ]]; then
  echo "Hermes Agent test"
elif [[ "$1" == "computer-use" && "$2" == "status" ]]; then
  echo "cua-driver: installed"
elif [[ "$1" == "tools" && "$2" == "--summary" && "$3" == "list" ]]; then
  echo "enabled terminal"
  echo "enabled file"
  echo "enabled browser"
  echo "enabled computer_use"
elif [[ "$1" == "chat" ]]; then
  echo "computer run ok"
else
  echo "ok"
fi
`, "utf8");
    await chmod(executablePath, 0o755);
    const permissionHelperPath = await writeFakePermissionHelper(baseDir, {
      screenRecording: "granted",
      accessibility: "granted"
    });
    const previousPermissionHelper = process.env.HERMILLS_PERMISSION_HELPER;
    process.env.HERMILLS_PERMISSION_HELPER = permissionHelperPath;
    const service = new RuntimeService({ baseDir });

    try {
      await expect(service.runComputerControlPrompt("控制这台 Mac 打开浏览器; echo bad")).resolves.toMatchObject({
        ok: true,
        output: "computer run ok"
      });
      const calls = await readFile(logPath, "utf8");
      expect(calls).toContain("chat --query 控制这台 Mac 打开浏览器; echo bad --quiet --source hermills-computer-control --toolsets browser,computer_use,file,terminal,vision");
    } finally {
      restoreEnv("HERMILLS_PERMISSION_HELPER", previousPermissionHelper);
      await service.dispose();
    }
  });

  it("normalizes OpenAI-compatible endpoint URLs", () => {
    expect(chatCompletionsUrl("http://127.0.0.1:8642")).toBe("http://127.0.0.1:8642/v1/chat/completions");
    expect(chatCompletionsUrl("https://api.openai.com/v1")).toBe("https://api.openai.com/v1/chat/completions");
    expect(chatCompletionsUrl("https://provider.example")).toBe("https://provider.example/v1/chat/completions");
    expect(chatCompletionsUrl("https://provider.example/v1/chat/completions")).toBe("https://provider.example/v1/chat/completions");
    expect(chatCompletionsUrl("https://generativelanguage.googleapis.com/v1beta/openai")).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(chatCompletionsUrl("https://open.bigmodel.cn/api/paas/v4")).toBe("https://open.bigmodel.cn/api/paas/v4/chat/completions");
    expect(responsesUrl("https://api.openai.com/v1")).toBe("https://api.openai.com/v1/responses");
    expect(responsesUrl("https://api.openai.com/v1/chat/completions")).toBe("https://api.openai.com/v1/responses");
    expect(responsesUrl("https://api.openai.com/v1/responses")).toBe("https://api.openai.com/v1/responses");
    expect(modelsUrl("https://provider.example/v1/chat/completions")).toBe("https://provider.example/v1/models");
    expect(modelsUrl("https://generativelanguage.googleapis.com/v1beta/openai")).toBe("https://generativelanguage.googleapis.com/v1beta/openai/models");
    expect(anthropicMessagesUrl("https://api.anthropic.com/v1")).toBe("https://api.anthropic.com/v1/messages");
    expect(anthropicMessagesUrl("https://api.anthropic.com")).toBe("https://api.anthropic.com/v1/messages");
  });

  it("sends official OpenAI providers through the Responses API", async () => {
    let requestUrl = "";
    let requestBody: { model?: string; input?: unknown; instructions?: string; store?: boolean; stream?: boolean; reasoning?: { effort?: string } } | undefined;
    const service = new RuntimeService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-openai-responses-")),
      fetchImpl: async (url, init) => {
        requestUrl = String(url);
        requestBody = JSON.parse(String(init?.body));
        return Response.json({ output_text: "responses reply" });
      }
    });

    await expect(service.createHermesReply({
      messages: [
        { id: "m1", role: "system", content: "Hidden context", createdAt: new Date().toISOString() },
        { id: "m2", role: "user", content: "Write email", createdAt: new Date().toISOString() }
      ],
      model: "gpt-5.5",
      instructions: "Answer as Hermills.",
      provider: {
        kind: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test"
      }
    })).resolves.toBe("responses reply");

    expect(requestUrl).toBe("https://api.openai.com/v1/responses");
    expect(requestBody?.model).toBe("gpt-5.5");
    expect(requestBody?.instructions).toBe("Answer as Hermills.\n\nHidden context");
    expect(requestBody?.input).toEqual([{ role: "user", content: "Write email" }]);
    expect(requestBody?.store).toBe(false);
    expect(requestBody?.stream).toBe(false);
    expect(requestBody?.reasoning?.effort).toBe("medium");
  });

  it("keeps OpenAI-compatible providers on chat completions", async () => {
    let requestUrl = "";
    let requestBody: {
      model?: string;
      max_tokens?: number;
      response_format?: { type?: string };
      thinking?: { type?: string };
      reasoning_effort?: string;
    } | undefined;
    const service = new RuntimeService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-openai-compatible-")),
      fetchImpl: async (url, init) => {
        requestUrl = String(url);
        requestBody = JSON.parse(String(init?.body));
        return Response.json({ choices: [{ message: { content: "chat reply" } }] });
      }
    });

    await expect(service.createHermesReply({
      messages: [{ id: "m1", role: "user", content: "hello", createdAt: new Date().toISOString() }],
      model: "deepseek-v4-pro",
      maxOutputTokens: 4096,
      responseFormat: "json_object",
      provider: {
        kind: "openai-compatible",
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test"
      }
    })).resolves.toBe("chat reply");

    expect(requestUrl).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(requestBody?.model).toBe("deepseek-v4-pro");
    expect(requestBody?.max_tokens).toBe(4096);
    expect(requestBody?.response_format).toEqual({ type: "json_object" });
    expect(requestBody?.thinking).toEqual({ type: "enabled" });
    expect(requestBody?.reasoning_effort).toBe("max");
  });

  it("syncs a DeepSeek provider into the managed Hermes home", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-provider-sync-"));
    const service = new RuntimeService({ baseDir });

    await service.configureInferenceProvider({
      kind: "openai-compatible",
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-test-deepseek",
      defaultModel: "deepseek-v4-pro"
    });

    const envText = await readFile(path.join(baseDir, "hermes-home", ".env"), "utf8");
    const configText = await readFile(path.join(baseDir, "hermes-home", "config.yaml"), "utf8");
    expect(envText).toContain("API_SERVER_ENABLED=true");
    expect(envText).toContain("DEEPSEEK_API_KEY=sk-test-deepseek");
    expect(envText).toContain("DEEPSEEK_BASE_URL=https://api.deepseek.com");
    expect(configText).toContain('default: "deepseek-v4-pro"');
    expect(configText).toContain('provider: "deepseek"');
    expect(configText).toContain('base_url: "https://api.deepseek.com"');
  });

  it("sends Anthropic providers through the Messages API", async () => {
    let requestUrl = "";
    let requestBody: { model?: string; system?: string; messages?: Array<{ role: string; content: string }> } | undefined;
    let requestHeaders: HeadersInit | undefined;
    const service = new RuntimeService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-anthropic-")),
      fetchImpl: async (url, init) => {
        requestUrl = String(url);
        requestHeaders = init?.headers;
        requestBody = JSON.parse(String(init?.body));
        return Response.json({ content: [{ type: "text", text: "claude reply" }] });
      }
    });

    await expect(service.createHermesReply({
      messages: [
        { id: "m1", role: "system", content: "Use the company knowledge.", createdAt: new Date().toISOString() },
        { id: "m2", role: "user", content: "hello", createdAt: new Date().toISOString() }
      ],
      model: "claude-sonnet-4-20250514",
      instructions: "Answer as Hermes.",
      provider: {
        kind: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: "sk-ant-test"
      }
    })).resolves.toBe("claude reply");

    expect(requestUrl).toBe("https://api.anthropic.com/v1/messages");
    expect(requestBody?.model).toBe("claude-sonnet-4-20250514");
    expect(requestBody?.system).toBe("Answer as Hermes.\n\nUse the company knowledge.");
    expect(requestBody?.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(requestHeaders).toMatchObject({
      "x-api-key": "sk-ant-test",
      "anthropic-version": "2023-06-01"
    });
  });

  it("converts Hermills messages into Anthropic message shape", () => {
    expect(buildAnthropicMessages({
      instructions: "System guide",
      messages: [
        { id: "m1", role: "system", content: "Hidden note", createdAt: new Date().toISOString() },
        { id: "m2", role: "user", content: "Question", createdAt: new Date().toISOString() },
        { id: "m3", role: "assistant", content: "Answer", createdAt: new Date().toISOString() }
      ]
    })).toEqual({
      system: "System guide\n\nHidden note",
      messages: [
        { role: "user", content: "Question" },
        { role: "assistant", content: "Answer" }
      ]
    });
  });

  it("installs a fake runtime, starts the gateway, and returns chat replies", async () => {
    let completionBody: { model?: string; messages?: Array<{ role: string; content: string }> } | undefined;
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-e2e-"));
    const service = new RuntimeService({
      baseDir,
      allowCustomInstaller: true,
      fetchImpl: async (url, init) => {
        const value = String(url);
        if (value.includes("api.github.com")) return Response.json({ tag_name: "v0.14.0", name: "Hermes Agent v0.14.0" });
        if (value.endsWith("/v1/models")) return Response.json({ data: [{ id: "hermes-agent" }] });
        if (value.endsWith("/v1/chat/completions")) {
          completionBody = JSON.parse(String(init?.body));
          return Response.json({ choices: [{ message: { content: "fake Hermes reply" } }] });
        }
        return new Response(value.endsWith("LICENSE") ? "MIT License" : fakeInstallerScript());
      }
    });

    try {
      const { jobId } = await service.startInstall({ installerUrl: fakeInstallerUrl(), licenseUrl: "https://example.com/LICENSE" });
      await waitFor(() => service.getEvents(jobId).some((event) => event.step === "verifying"), 20_000);

      const status = await service.getStatus();
      expect(status.installed).toBe(true);
      expect(status.state).toBe("ready");
      expect(status.gateway?.state).toBe("running");
      expect(status.version).toContain("fake-v1");
      expect(status.installMetadata?.latestReleaseTag).toBe("v0.14.0");
      expect(status.installMetadata?.version).toContain("fake-v1");
      const appState = await service.getAppState();
      expect(appState.firstDeployHidden).toBe(true);
      expect(appState.localDeployCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(appState.lastSuccessfulRuntimeVersion).toContain("fake-v1");
      expect(appState.lastSuccessfulGatewayAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      await expect(new RuntimeService({ baseDir }).getAppState()).resolves.toMatchObject({
        firstDeployHidden: true,
        localDeployCompletedAt: appState.localDeployCompletedAt
      });
      if (process.platform === "darwin") {
        await expect(service.getComputerControlStatus()).resolves.toMatchObject({
          driver: { installed: true },
          toolsets: { computerUseEnabled: true }
        });
        const commandLog = await readFile(path.join(baseDir, "runtime", "hermes-agent", "command-log.txt"), "utf8");
        expect(commandLog).toContain("tools enable --platform cli");
        expect(commandLog).toContain("computer_use");
        expect(commandLog).toContain("computer-use install");
        expect(service.getEvents(jobId).map((event) => event.message).join("\n")).not.toMatch(/computer-use|computer_use|driver|tools enable/i);
      }

      await expect(service.createHermesReply({
        messages: [
          { id: "m1", role: "user", content: "hello", createdAt: new Date().toISOString() }
        ],
        model: "custom-agent-model",
        instructions: "Answer as the selected Hermills agent."
      })).resolves.toBe("fake Hermes reply");
      expect(completionBody?.model).toBe("custom-agent-model");
      expect(completionBody?.messages?.[0]).toEqual({ role: "system", content: "Answer as the selected Hermills agent." });
      expect(completionBody?.messages?.[1]).toEqual({ role: "user", content: "hello" });
    } finally {
      await service.dispose();
    }
  }, 25_000);

  it("auto-starts the gateway after a completed local deploy", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-auto-start-"));
    const fetchImpl: typeof fetch = async (url) => {
      const value = String(url);
      if (value.includes("api.github.com")) return Response.json({ tag_name: "v0.14.0", name: "Hermes Agent v0.14.0" });
      if (value.endsWith("/v1/models")) return Response.json({ data: [{ id: "hermes-agent" }] });
      return new Response(value.endsWith("LICENSE") ? "MIT License" : fakeInstallerScript());
    };
    const service = new RuntimeService({ baseDir, allowCustomInstaller: true, fetchImpl });

    try {
      const { jobId } = await service.startInstall({ installerUrl: fakeInstallerUrl(), licenseUrl: "https://example.com/LICENSE" });
      await waitFor(() => service.getEvents(jobId).some((event) => event.step === "verifying"), 20_000);
    } finally {
      await service.dispose();
    }

    const restarted = new RuntimeService({ baseDir, allowCustomInstaller: true, fetchImpl });
    try {
      await expect(restarted.getStatus()).resolves.toMatchObject({
        installed: true,
        state: "ready",
        gateway: { state: "running" }
      });
    } finally {
      await restarted.dispose();
    }
  }, 25_000);

  it("reports the gateway as running when the local API is reachable", async () => {
    const service = new RuntimeService({
      baseDir: await mkdtemp(path.join(os.tmpdir(), "hermills-runtime-gateway-status-")),
      apiPort: 8765,
      fetchImpl: async (url) => {
        const value = String(url);
        if (value === "http://127.0.0.1:8765/v1/models") return Response.json({ data: [{ id: "hermes-agent" }] });
        return Response.json({});
      }
    });

    await expect(service.getGatewayStatus()).resolves.toMatchObject({
      state: "running",
      apiBaseUrl: "http://127.0.0.1:8765"
    });
  });
});

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("Timed out waiting for runtime job");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function writeFakePermissionHelper(baseDir: string, payload: { screenRecording: string; accessibility: string }): Promise<string> {
  const helperPath = path.join(baseDir, "permission-helper");
  await writeFile(helperPath, `#!/usr/bin/env bash
echo ${JSON.stringify(JSON.stringify({
  screenRecording: payload.screenRecording,
  accessibility: payload.accessibility,
  automation: "unknown",
  files: "workspace-only"
}))}
`, "utf8");
  await chmod(helperPath, 0o755);
  return helperPath;
}

function restoreEnv(name: string, previous: string | undefined): void {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

function fakeInstallerScript(): string {
  if (process.platform === "win32") return fakeWindowsInstallerScript(false);
  return `#!/usr/bin/env bash
set -euo pipefail
RUNTIME_DIR=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dir)
      RUNTIME_DIR="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
mkdir -p "$RUNTIME_DIR/bin"
cat > "$RUNTIME_DIR/bin/hermes" <<'NODE'
${fakeHermesNodeScript()}
NODE
chmod +x "$RUNTIME_DIR/bin/hermes"
`;
}

function fakeOfficialStyleInstallerScript(): string {
  if (process.platform === "win32") return fakeWindowsInstallerScript(true);
  return `#!/usr/bin/env bash
set -euo pipefail
RUNTIME_DIR=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dir)
      RUNTIME_DIR="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
if [ -e "$RUNTIME_DIR" ] && [ ! -d "$RUNTIME_DIR/.git" ]; then
  echo "Directory exists but is not a git repository: $RUNTIME_DIR" >&2
  exit 31
fi
mkdir -p "$RUNTIME_DIR/.git" "$RUNTIME_DIR/bin"
cat > "$RUNTIME_DIR/bin/hermes" <<'NODE'
${fakeHermesNodeScript()}
NODE
chmod +x "$RUNTIME_DIR/bin/hermes"
`;
}

function fakeHermesNodeScript(): string {
  return `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const runtimeHome = process.env.HERMES_AGENT_HOME || path.dirname(path.dirname(process.argv[1]));
const args = process.argv.slice(2);
const command = args.join(" ");
try {
  fs.appendFileSync(path.join(runtimeHome, "command-log.txt"), command + "\\n");
} catch {}

if (args.includes("--version")) {
  console.log("hermes-agent fake-v1");
  process.exit(0);
}

if (args[0] === "tools" && args[1] === "--summary" && args[2] === "list") {
  if (fs.existsSync(path.join(runtimeHome, ".tools-enabled"))) {
    console.log("enabled terminal");
    console.log("enabled file");
    console.log("enabled browser");
    console.log("enabled computer_use");
  } else {
    console.log("enabled terminal");
    console.log("enabled file");
    console.log("enabled browser");
  }
  process.exit(0);
}

if (args[0] === "tools" && args[1] === "enable") {
  fs.writeFileSync(path.join(runtimeHome, ".tools-enabled"), "1");
  console.log("tools enabled");
  process.exit(0);
}

if (args[0] === "computer-use" && args[1] === "status") {
  console.log(fs.existsSync(path.join(runtimeHome, ".computer-use-installed")) ? "cua-driver: installed" : "cua-driver: not installed");
  process.exit(0);
}

if (args[0] === "computer-use" && args[1] === "install") {
  fs.writeFileSync(path.join(runtimeHome, ".computer-use-installed"), "1");
  console.log("cua-driver: installed");
  process.exit(0);
}

if (args[0] === "chat") {
  console.log("computer run ok");
  process.exit(0);
}

if (args[0] !== "gateway" || args[1] !== "run") {
  console.error("unsupported fake hermes command");
  process.exit(2);
}

process.on("SIGTERM", () => process.exit(0));
setInterval(() => undefined, 1000);
`;
}

function fakeInstallerUrl(): string {
  return process.platform === "win32" ? "https://example.com/install.ps1" : "https://example.com/install.sh";
}

function fakeWindowsInstallerScript(requiresGitRepo: boolean): string {
  return `
param(
  [switch]$Manifest,
  [string]$Stage = "",
  [switch]$NonInteractive,
  [switch]$Json,
  [switch]$SkipSetup,
  [string]$InstallDir = "",
  [string]$HermesHome = ""
)
$stages = @(
  @{ name = "repository"; title = "Cloning Hermes repository"; category = "install"; needs_user_input = $false },
  @{ name = "venv"; title = "Creating Python virtual environment"; category = "install"; needs_user_input = $false },
  @{ name = "configure"; title = "Configuring API keys and models"; category = "post-install"; needs_user_input = $true },
  @{ name = "gateway"; title = "Starting messaging gateway"; category = "post-install"; needs_user_input = $true }
)
if ($Manifest) {
  @{ protocol_version = 1; stages = $stages } | ConvertTo-Json -Depth 5 -Compress
  exit 0
}
if ($Stage -eq "repository") {
  if (${requiresGitRepo ? "$true" : "$false"} -and (Test-Path -LiteralPath $InstallDir) -and !(Test-Path -LiteralPath (Join-Path $InstallDir ".git"))) {
    Write-Error "Directory exists but is not a git repository: $InstallDir"
    @{ stage = $Stage; ok = $false; skipped = $false; reason = "Directory exists but is not a git repository"; duration_ms = 1 } | ConvertTo-Json -Compress
    exit 31
  }
  New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir ".git") | Out-Null
}
if ($Stage -eq "venv") {
  $bin = Join-Path $InstallDir "venv\\Scripts"
  New-Item -ItemType Directory -Force -Path $bin | Out-Null
  $nodeScript = Join-Path $bin "hermes-fake.js"
  Set-Content -LiteralPath $nodeScript -Encoding UTF8 -Value @'
if (process.argv.includes("--version")) {
  console.log("hermes-agent fake-v1");
  process.exit(0);
}
if (process.argv[2] !== "gateway" || process.argv[3] !== "run") {
  console.error("unsupported fake hermes command");
  process.exit(2);
}
process.on("SIGTERM", () => process.exit(0));
setInterval(() => undefined, 1000);
'@
  Set-Content -LiteralPath (Join-Path $bin "hermes.cmd") -Encoding ASCII -Value '@echo off
node "%~dp0hermes-fake.js" %*
'
}
if ($Stage) {
  @{ stage = $Stage; ok = $true; skipped = $false; reason = $null; duration_ms = 1 } | ConvertTo-Json -Compress
  exit 0
}
foreach ($item in $stages) {
  if (-not $item.needs_user_input) {
    & $PSCommandPath -Stage $item.name -NonInteractive -Json -InstallDir $InstallDir -HermesHome $HermesHome
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
}
@{ ok = $true; protocol_version = 1 } | ConvertTo-Json -Compress
`;
}
