import { z } from "zod";
export declare const CapabilitySchema: z.ZodObject<{
    memory: z.ZodDefault<z.ZodBoolean>;
    files: z.ZodDefault<z.ZodBoolean>;
    tools: z.ZodDefault<z.ZodBoolean>;
    approvals: z.ZodDefault<z.ZodEnum<["never", "on-demand", "always"]>>;
}, "strict", z.ZodTypeAny, {
    memory: boolean;
    files: boolean;
    tools: boolean;
    approvals: "never" | "on-demand" | "always";
}, {
    memory?: boolean | undefined;
    files?: boolean | undefined;
    tools?: boolean | undefined;
    approvals?: "never" | "on-demand" | "always" | undefined;
}>;
export declare const KnowledgeFileSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    path: z.ZodString;
    size: z.ZodNumber;
    mimeType: z.ZodDefault<z.ZodString>;
    sha256: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["upload", "local-file", "generated"]>>;
    addedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    path: string;
    id: string;
    name: string;
    size: number;
    mimeType: string;
    source: "upload" | "local-file" | "generated";
    addedAt: string;
    sha256?: string | undefined;
}, {
    path: string;
    id: string;
    name: string;
    size: number;
    addedAt: string;
    mimeType?: string | undefined;
    sha256?: string | undefined;
    source?: "upload" | "local-file" | "generated" | undefined;
}>;
export declare const AgentDefinitionSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodLiteral<1>>;
    id: z.ZodString;
    slug: z.ZodString;
    displayName: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    instructions: z.ZodString;
    starters: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    providerId: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    capabilities: z.ZodDefault<z.ZodObject<{
        memory: z.ZodDefault<z.ZodBoolean>;
        files: z.ZodDefault<z.ZodBoolean>;
        tools: z.ZodDefault<z.ZodBoolean>;
        approvals: z.ZodDefault<z.ZodEnum<["never", "on-demand", "always"]>>;
    }, "strict", z.ZodTypeAny, {
        memory: boolean;
        files: boolean;
        tools: boolean;
        approvals: "never" | "on-demand" | "always";
    }, {
        memory?: boolean | undefined;
        files?: boolean | undefined;
        tools?: boolean | undefined;
        approvals?: "never" | "on-demand" | "always" | undefined;
    }>>;
    knowledge: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        path: z.ZodString;
        size: z.ZodNumber;
        mimeType: z.ZodDefault<z.ZodString>;
        sha256: z.ZodOptional<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<["upload", "local-file", "generated"]>>;
        addedAt: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        path: string;
        id: string;
        name: string;
        size: number;
        mimeType: string;
        source: "upload" | "local-file" | "generated";
        addedAt: string;
        sha256?: string | undefined;
    }, {
        path: string;
        id: string;
        name: string;
        size: number;
        addedAt: string;
        mimeType?: string | undefined;
        sha256?: string | undefined;
        source?: "upload" | "local-file" | "generated" | undefined;
    }>, "many">>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    version: 1;
    slug: string;
    displayName: string;
    description: string;
    instructions: string;
    starters: string[];
    capabilities: {
        memory: boolean;
        files: boolean;
        tools: boolean;
        approvals: "never" | "on-demand" | "always";
    };
    knowledge: {
        path: string;
        id: string;
        name: string;
        size: number;
        mimeType: string;
        source: "upload" | "local-file" | "generated";
        addedAt: string;
        sha256?: string | undefined;
    }[];
    createdAt: string;
    updatedAt: string;
    providerId?: string | undefined;
    model?: string | undefined;
}, {
    id: string;
    slug: string;
    displayName: string;
    instructions: string;
    createdAt: string;
    updatedAt: string;
    version?: 1 | undefined;
    description?: string | undefined;
    starters?: string[] | undefined;
    providerId?: string | undefined;
    model?: string | undefined;
    capabilities?: {
        memory?: boolean | undefined;
        files?: boolean | undefined;
        tools?: boolean | undefined;
        approvals?: "never" | "on-demand" | "always" | undefined;
    } | undefined;
    knowledge?: {
        path: string;
        id: string;
        name: string;
        size: number;
        addedAt: string;
        mimeType?: string | undefined;
        sha256?: string | undefined;
        source?: "upload" | "local-file" | "generated" | undefined;
    }[] | undefined;
}>;
export declare const ProviderApiKeyInputSchema: z.ZodObject<{
    providerId: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodString;
}, "strict", z.ZodTypeAny, {
    apiKey: string;
    providerId?: string | undefined;
}, {
    apiKey: string;
    providerId?: string | undefined;
}>;
export declare const ProviderCredentialSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["openai-compatible", "openai", "anthropic", "local"]>;
    displayName: z.ZodString;
    baseUrl: z.ZodOptional<z.ZodString>;
    defaultModel: z.ZodOptional<z.ZodString>;
    credentialRef: z.ZodOptional<z.ZodString>;
    keyPreview: z.ZodOptional<z.ZodString>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    displayName: string;
    createdAt: string;
    updatedAt: string;
    kind: "openai-compatible" | "openai" | "anthropic" | "local";
    enabled: boolean;
    baseUrl?: string | undefined;
    defaultModel?: string | undefined;
    credentialRef?: string | undefined;
    keyPreview?: string | undefined;
}, {
    id: string;
    displayName: string;
    createdAt: string;
    updatedAt: string;
    kind: "openai-compatible" | "openai" | "anthropic" | "local";
    baseUrl?: string | undefined;
    defaultModel?: string | undefined;
    credentialRef?: string | undefined;
    keyPreview?: string | undefined;
    enabled?: boolean | undefined;
}>;
export declare const RuntimeStatusSchema: z.ZodObject<{
    platform: z.ZodString;
    arch: z.ZodString;
    installed: z.ZodBoolean;
    version: z.ZodOptional<z.ZodString>;
    executablePath: z.ZodOptional<z.ZodString>;
    runtimeHome: z.ZodString;
    checks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        ok: z.ZodBoolean;
        detail: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        label: string;
        id: string;
        ok: boolean;
        detail?: string | undefined;
    }, {
        label: string;
        id: string;
        ok: boolean;
        detail?: string | undefined;
    }>, "many">;
    activeInstallJob: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    platform: string;
    arch: string;
    installed: boolean;
    runtimeHome: string;
    checks: {
        label: string;
        id: string;
        ok: boolean;
        detail?: string | undefined;
    }[];
    version?: string | undefined;
    executablePath?: string | undefined;
    activeInstallJob?: string | undefined;
}, {
    platform: string;
    arch: string;
    installed: boolean;
    runtimeHome: string;
    checks: {
        label: string;
        id: string;
        ok: boolean;
        detail?: string | undefined;
    }[];
    version?: string | undefined;
    executablePath?: string | undefined;
    activeInstallJob?: string | undefined;
}>;
export declare const InstallRequestSchema: z.ZodObject<{
    dryRun: z.ZodDefault<z.ZodBoolean>;
    installerUrl: z.ZodOptional<z.ZodString>;
    licenseUrl: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    dryRun: boolean;
    installerUrl?: string | undefined;
    licenseUrl?: string | undefined;
}, {
    dryRun?: boolean | undefined;
    installerUrl?: string | undefined;
    licenseUrl?: string | undefined;
}>;
export declare const ChatMessageSchema: z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<["system", "user", "assistant"]>;
    content: z.ZodString;
    createdAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    role: "system" | "user" | "assistant";
    content: string;
}, {
    id: string;
    createdAt: string;
    role: "system" | "user" | "assistant";
    content: string;
}>;
export declare const ChatSessionSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    agentId: z.ZodOptional<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    messages: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        role: z.ZodEnum<["system", "user", "assistant"]>;
        content: z.ZodString;
        createdAt: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        role: "system" | "user" | "assistant";
        content: string;
    }, {
        id: string;
        createdAt: string;
        role: "system" | "user" | "assistant";
        content: string;
    }>, "many">>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    messages: {
        id: string;
        createdAt: string;
        role: "system" | "user" | "assistant";
        content: string;
    }[];
    providerId?: string | undefined;
    model?: string | undefined;
    agentId?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    providerId?: string | undefined;
    model?: string | undefined;
    agentId?: string | undefined;
    messages?: {
        id: string;
        createdAt: string;
        role: "system" | "user" | "assistant";
        content: string;
    }[] | undefined;
}>;
export type InstallRequest = z.infer<typeof InstallRequestSchema>;
//# sourceMappingURL=schemas.d.ts.map