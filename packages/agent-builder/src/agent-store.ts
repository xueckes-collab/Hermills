import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import {
  AgentDefinitionSchema,
  findPlaintextSecretField,
  getDataHome,
  KnowledgeFileSchema,
  type AgentDefinition
} from "@hermills/core";
import { JsonFileStore } from "./json-store.js";
import { slugifyAgentName } from "./slug.js";
import { builtinAgentSeeds, type BuiltinAgentSeed } from "./builtin-agents.js";

interface AgentStoreDocument {
  agents: AgentDefinition[];
}

export interface UpsertAgentInput {
  displayName: string;
  description?: string;
  instructions: string;
  starters?: string[];
  providerId?: string;
  model?: string;
  capabilities?: Partial<AgentDefinition["capabilities"]>;
}

export interface AgentRepositoryOptions {
  seedBuiltinAgents?: boolean;
}

export class AgentRepository {
  private readonly store: JsonFileStore<AgentStoreDocument>;
  private readonly builtinSeeds: BuiltinAgentSeed[];
  private seeded = false;

  constructor(baseDir?: string, options: AgentRepositoryOptions = {}) {
    this.store = new JsonFileStore(path.join(getDataHome(baseDir), "agents.json"), { agents: [] });
    this.builtinSeeds = options.seedBuiltinAgents ? builtinAgentSeeds : [];
  }

  async list(): Promise<AgentDefinition[]> {
    await this.ensureBuiltinAgents();
    return (await this.store.read()).agents;
  }

  async get(id: string): Promise<AgentDefinition | undefined> {
    return (await this.list()).find((agent) => agent.id === id);
  }

  async create(input: UpsertAgentInput): Promise<AgentDefinition> {
    assertNoAgentPlaintextSecrets(input);
    await this.ensureBuiltinAgents();
    const now = new Date().toISOString();
    const document = await this.store.read();
    const slug = this.uniqueSlug(slugifyAgentName(input.displayName), document.agents);
    const agent = AgentDefinitionSchema.parse({
      id: randomUUID(),
      slug,
      displayName: input.displayName,
      description: input.description ?? "",
      instructions: input.instructions,
      starters: input.starters ?? [],
      providerId: input.providerId,
      model: input.model,
      capabilities: {
        memory: input.capabilities?.memory ?? false,
        files: input.capabilities?.files ?? true,
        tools: input.capabilities?.tools ?? false,
        approvals: input.capabilities?.approvals ?? "on-demand"
      },
      knowledge: [],
      createdAt: now,
      updatedAt: now
    });
    document.agents.unshift(agent);
    await this.store.write(document);
    return agent;
  }

  async update(id: string, input: Partial<UpsertAgentInput>): Promise<AgentDefinition> {
    assertNoAgentPlaintextSecrets(input);
    await this.ensureBuiltinAgents();
    const document = await this.store.read();
    const index = document.agents.findIndex((agent) => agent.id === id);
    if (index === -1) throw new Error(`Agent not found: ${id}`);
    const current = document.agents[index];
    const next = AgentDefinitionSchema.parse({
      ...current,
      ...input,
      description: input.description ?? current.description,
      starters: input.starters ?? current.starters,
      capabilities: { ...current.capabilities, ...input.capabilities },
      updatedAt: new Date().toISOString()
    });
    document.agents[index] = next;
    await this.store.write(document);
    return next;
  }

  async remove(id: string): Promise<void> {
    await this.ensureBuiltinAgents();
    const document = await this.store.read();
    const agents = document.agents.filter((agent) => agent.id !== id);
    if (agents.length === document.agents.length) throw new Error(`Agent not found: ${id}`);
    await this.store.write({ agents });
  }

  async addKnowledge(agentId: string, knowledge: Omit<z.input<typeof KnowledgeFileSchema>, "id" | "addedAt">): Promise<z.infer<typeof KnowledgeFileSchema>> {
    assertNoAgentPlaintextSecrets(knowledge);
    await this.ensureBuiltinAgents();
    const document = await this.store.read();
    const index = document.agents.findIndex((agent) => agent.id === agentId);
    if (index === -1) throw new Error(`Agent not found: ${agentId}`);
    const item = KnowledgeFileSchema.parse({ ...knowledge, id: randomUUID(), addedAt: new Date().toISOString() });
    document.agents[index] = AgentDefinitionSchema.parse({
      ...document.agents[index],
      knowledge: [...document.agents[index].knowledge, item],
      updatedAt: new Date().toISOString()
    });
    await this.store.write(document);
    return item;
  }

  private uniqueSlug(base: string, agents: AgentDefinition[]): string {
    const existing = new Set(agents.map((agent) => agent.slug));
    if (!existing.has(base)) return base;
    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${base}-${index}`;
      if (!existing.has(candidate)) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  private async ensureBuiltinAgents(): Promise<void> {
    if (this.seeded || this.builtinSeeds.length === 0) return;
    const document = await this.store.read();
    const existingIds = new Set(document.agents.map((agent) => agent.id));
    const existingSlugs = new Set(document.agents.map((agent) => agent.slug));
    const now = new Date().toISOString();
    const missing = this.builtinSeeds
      .filter((seed) => !existingIds.has(seed.id) && !existingSlugs.has(seed.slug))
      .map((seed) => AgentDefinitionSchema.parse({
        ...seed,
        version: 1,
        providerId: undefined,
        model: undefined,
        knowledge: [],
        createdAt: now,
        updatedAt: now
      }));
    if (missing.length > 0) {
      await this.store.write({ agents: [...missing, ...document.agents] });
    }
    this.seeded = true;
  }
}

function assertNoAgentPlaintextSecrets(value: unknown): void {
  const secretPath = findPlaintextSecretField(value);
  if (secretPath) throw new Error(`Plaintext secret field is not allowed in agent configuration: ${secretPath}`);
}
