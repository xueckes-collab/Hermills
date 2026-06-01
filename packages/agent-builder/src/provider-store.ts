import { randomUUID } from "node:crypto";
import path from "node:path";
import { getDataHome, previewSecret, ProviderApiKeyInputSchema, ProviderCredentialSchema, type ProviderCredential } from "@hermills/core";
import { JsonFileStore } from "./json-store.js";
import { LocalCredentialVault } from "./vault.js";

interface ProviderStoreDocument {
  providers: ProviderCredential[];
}

export interface UpsertProviderInput {
  kind: ProviderCredential["kind"];
  displayName: string;
  baseUrl?: string;
  defaultModel?: string;
  apiKey?: string;
  enabled?: boolean;
}

export class ProviderRepository {
  private readonly store: JsonFileStore<ProviderStoreDocument>;
  private readonly vault: LocalCredentialVault;

  constructor(private readonly baseDir?: string) {
    this.store = new JsonFileStore(path.join(getDataHome(baseDir), "providers.json"), { providers: [] });
    this.vault = new LocalCredentialVault(baseDir);
  }

  async list(): Promise<ProviderCredential[]> {
    return (await this.store.read()).providers;
  }

  async get(id: string): Promise<ProviderCredential | undefined> {
    return (await this.list()).find((provider) => provider.id === id);
  }

  async create(input: UpsertProviderInput): Promise<ProviderCredential> {
    if (input.apiKey) ProviderApiKeyInputSchema.parse({ apiKey: input.apiKey });
    const now = new Date().toISOString();
    const id = randomUUID();
    const credentialRef = input.apiKey ? await this.vault.saveSecret(id, input.apiKey) : undefined;
    const provider = ProviderCredentialSchema.parse({
      id,
      kind: input.kind,
      displayName: input.displayName,
      baseUrl: input.baseUrl,
      defaultModel: input.defaultModel,
      credentialRef,
      keyPreview: input.apiKey ? previewSecret(input.apiKey) : undefined,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now
    });
    const document = await this.store.read();
    document.providers.unshift(provider);
    await this.store.write(document);
    return provider;
  }

  async update(id: string, input: Partial<UpsertProviderInput>): Promise<ProviderCredential> {
    if (input.apiKey) ProviderApiKeyInputSchema.parse({ providerId: id, apiKey: input.apiKey });
    const document = await this.store.read();
    const index = document.providers.findIndex((provider) => provider.id === id);
    if (index === -1) throw new Error(`Provider not found: ${id}`);
    const current = document.providers[index];
    const credentialRef = input.apiKey ? await this.vault.saveSecret(id, input.apiKey) : current.credentialRef;
    const { apiKey, ...metadata } = input;
    const next = ProviderCredentialSchema.parse({
      ...current,
      ...metadata,
      credentialRef,
      keyPreview: apiKey ? previewSecret(apiKey) : current.keyPreview,
      updatedAt: new Date().toISOString()
    });
    document.providers[index] = next;
    await this.store.write(document);
    return next;
  }

  async remove(id: string): Promise<void> {
    const document = await this.store.read();
    const provider = document.providers.find((provider) => provider.id === id);
    if (!provider) throw new Error(`Provider not found: ${id}`);
    const providers = document.providers.filter((provider) => provider.id !== id);
    await this.store.write({ providers });
    if (provider.credentialRef) await this.vault.deleteSecret(provider.credentialRef);
  }

  async readApiKey(provider: ProviderCredential): Promise<string | undefined> {
    if (!provider.credentialRef) return undefined;
    return this.vault.readSecret(provider.credentialRef);
  }
}
