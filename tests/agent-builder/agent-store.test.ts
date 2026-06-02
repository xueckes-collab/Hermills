import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AgentRepository, builtinAgentSeeds, LocalCredentialVault, ProviderRepository, slugifyAgentName } from "@hermills/agent-builder";

function secretFilePath(baseDir: string, ref: string): string {
  return path.join(baseDir, "secure", `${ref.replace(/[^a-zA-Z0-9:_-]/g, "_")}.json`);
}

function requireCredentialRef(provider: { credentialRef?: string }): string {
  if (!provider.credentialRef) throw new Error("Expected provider to have a credentialRef");
  return provider.credentialRef;
}

async function fileMode(filePath: string): Promise<number> {
  return (await stat(filePath)).mode & 0o777;
}

describe("Agent Builder stores", () => {
  it("creates custom agents and slugs", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-agent-"));
    const agents = new AgentRepository(baseDir);
    const agent = await agents.create({ displayName: "Research Operator", instructions: "Answer precisely." });
    expect(agent.slug).toBe("research-operator");
    expect(await agents.list()).toHaveLength(1);
  });

  it("adds imported GPT built-in agents once", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-agent-builtin-"));
    const agents = new AgentRepository(baseDir, { seedBuiltinAgents: true });

    const firstList = await agents.list();
    const secondList = await agents.list();

    expect(firstList).toHaveLength(builtinAgentSeeds.length);
    expect(secondList).toHaveLength(builtinAgentSeeds.length);
    expect(firstList.map((agent) => agent.id)).toEqual(builtinAgentSeeds.map((agent) => agent.id));
    expect(firstList.map((agent) => agent.displayName)).toEqual([
      "SEO Blog写手",
      "专业社交热点选题写作系统",
      "Eckes智能开发信定制官"
    ]);
    expect(firstList.every((agent) => agent.capabilities.tools)).toBe(true);
  });

  it("removes deprecated built-in agents without deleting custom agents", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-agent-deprecated-"));
    const now = new Date().toISOString();
    await mkdir(path.join(baseDir, "data"), { recursive: true });
    await writeFile(path.join(baseDir, "data", "agents.json"), JSON.stringify({
      agents: [
        {
          version: 1,
          id: "builtin:eckes-blog-deep-custom",
          slug: "eckes-blog-deep-custom",
          displayName: "Eckes · Blog深度定制",
          description: "Deprecated built-in agent.",
          instructions: "Deprecated instructions.",
          starters: [],
          capabilities: { memory: true, files: true, tools: true, approvals: "on-demand" },
          knowledge: [],
          createdAt: now,
          updatedAt: now
        },
        {
          version: 1,
          id: "custom-agent",
          slug: "custom-agent",
          displayName: "Custom Agent",
          description: "User-created agent.",
          instructions: "Keep this custom agent.",
          starters: [],
          capabilities: { memory: false, files: true, tools: false, approvals: "on-demand" },
          knowledge: [],
          createdAt: now,
          updatedAt: now
        }
      ]
    }, null, 2));

    const agents = new AgentRepository(baseDir, { seedBuiltinAgents: true });

    expect((await agents.list()).map((agent) => agent.id)).toEqual([
      ...builtinAgentSeeds.map((agent) => agent.id),
      "custom-agent"
    ]);
  });

  it("keeps provider API keys out of provider metadata", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-provider-"));
    const providers = new ProviderRepository(baseDir);
    const provider = await providers.create({
      kind: "openai-compatible",
      displayName: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4.1-mini",
      apiKey: "sk-test-secret-value"
    });
    expect(provider.keyPreview).toBe("sk-t••••alue");
    expect(await providers.readApiKey(provider)).toBe("sk-test-secret-value");
    const raw = await readFile(path.join(baseDir, "data", "providers.json"), "utf8");
    expect(raw).not.toContain("sk-test-secret-value");
  });

  it("stores vault secrets with secure permissions and repairs existing modes on read", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-vault-"));
    const vault = new LocalCredentialVault(baseDir);
    const ref = await vault.saveSecret("provider-id", "sk-repair-secret");
    const secureDir = path.join(baseDir, "secure");
    const keyPath = path.join(secureDir, "vault.key");
    const secretPath = secretFilePath(baseDir, ref);

    expect(await fileMode(secureDir)).toBe(0o700);
    expect(await fileMode(keyPath)).toBe(0o600);
    expect(await fileMode(secretPath)).toBe(0o600);

    await chmod(secureDir, 0o755);
    await chmod(keyPath, 0o000);
    await chmod(secretPath, 0o000);

    expect(await vault.readSecret(ref)).toBe("sk-repair-secret");
    expect(await fileMode(secureDir)).toBe(0o700);
    expect(await fileMode(keyPath)).toBe(0o600);
    expect(await fileMode(secretPath)).toBe(0o600);
  });

  it("deletes provider secret files when providers are removed", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "hermills-provider-delete-"));
    const providers = new ProviderRepository(baseDir);
    const provider = await providers.create({
      kind: "openai-compatible",
      displayName: "OpenAI",
      apiKey: "sk-delete-secret-value"
    });
    const secretPath = secretFilePath(baseDir, requireCredentialRef(provider));

    expect(await providers.readApiKey(provider)).toBe("sk-delete-secret-value");
    expect(await fileMode(secretPath)).toBe(0o600);

    await providers.remove(provider.id);

    await expect(readFile(secretPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(providers.readApiKey(provider)).resolves.toBeUndefined();
  });

  it("slugifies without inheriting external naming rules", () => {
    expect(slugifyAgentName("Ops / QA Agent")).toBe("ops-qa-agent");
  });
});
