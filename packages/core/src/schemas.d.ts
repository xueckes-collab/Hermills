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
export declare const MaterialExtractionStateSchema: z.ZodEnum<["stored", "extracting", "indexed", "failed"]>;
export declare const MaterialScopeSchema: z.ZodEnum<["personal", "company"]>;
export declare const CompanyMaterialCategorySchema: z.ZodEnum<["company-profile", "product-catalog", "price-list", "certification", "shipping-logistics", "payment-terms", "faq", "case-study", "other"]>;
export declare const MaterialRecordSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    folder: z.ZodOptional<z.ZodString>;
    scope: z.ZodDefault<z.ZodEnum<["personal", "company"]>>;
    category: z.ZodOptional<z.ZodEnum<["company-profile", "product-catalog", "price-list", "certification", "shipping-logistics", "payment-terms", "faq", "case-study", "other"]>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    description: z.ZodOptional<z.ZodString>;
    path: z.ZodOptional<z.ZodString>;
    mimeType: z.ZodDefault<z.ZodString>;
    size: z.ZodNumber;
    sha256: z.ZodOptional<z.ZodString>;
    extractionState: z.ZodDefault<z.ZodEnum<["stored", "extracting", "indexed", "failed"]>>;
    textPreview: z.ZodOptional<z.ZodString>;
    extractionError: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    scope: "personal" | "company";
    tags: string[];
    extractionState: "stored" | "extracting" | "indexed" | "failed";
    createdAt: string;
    path?: string | undefined;
    sha256?: string | undefined;
    folder?: string | undefined;
    category?: "company-profile" | "product-catalog" | "price-list" | "certification" | "shipping-logistics" | "payment-terms" | "faq" | "case-study" | "other" | undefined;
    description?: string | undefined;
    textPreview?: string | undefined;
    extractionError?: string | undefined;
    updatedAt?: string | undefined;
}, {
    id: string;
    name: string;
    size: number;
    createdAt: string;
    path?: string | undefined;
    mimeType?: string | undefined;
    sha256?: string | undefined;
    folder?: string | undefined;
    scope?: "personal" | "company" | undefined;
    category?: "company-profile" | "product-catalog" | "price-list" | "certification" | "shipping-logistics" | "payment-terms" | "faq" | "case-study" | "other" | undefined;
    tags?: string[] | undefined;
    description?: string | undefined;
    extractionState?: "stored" | "extracting" | "indexed" | "failed" | undefined;
    textPreview?: string | undefined;
    extractionError?: string | undefined;
    updatedAt?: string | undefined;
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
    description: string;
    createdAt: string;
    updatedAt: string;
    version: 1;
    slug: string;
    displayName: string;
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
    providerId?: string | undefined;
    model?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    slug: string;
    displayName: string;
    instructions: string;
    description?: string | undefined;
    version?: 1 | undefined;
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
    createdAt: string;
    updatedAt: string;
    displayName: string;
    kind: "openai-compatible" | "openai" | "anthropic" | "local";
    enabled: boolean;
    baseUrl?: string | undefined;
    defaultModel?: string | undefined;
    credentialRef?: string | undefined;
    keyPreview?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    displayName: string;
    kind: "openai-compatible" | "openai" | "anthropic" | "local";
    baseUrl?: string | undefined;
    defaultModel?: string | undefined;
    credentialRef?: string | undefined;
    keyPreview?: string | undefined;
    enabled?: boolean | undefined;
}>;
export declare const CompanyProfileSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodLiteral<1>>;
    name: z.ZodDefault<z.ZodString>;
    legalName: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    website: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    markets: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    mainProducts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    certifications: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    paymentTerms: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    shippingTerms: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    brandVoice: z.ZodDefault<z.ZodString>;
    notes: z.ZodDefault<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    name: string;
    version: 1;
    markets: string[];
    mainProducts: string[];
    certifications: string[];
    paymentTerms: string[];
    shippingTerms: string[];
    brandVoice: string;
    notes: string;
    updatedAt?: string | undefined;
    legalName?: string | undefined;
    website?: string | undefined;
}, {
    name?: string | undefined;
    updatedAt?: string | undefined;
    version?: 1 | undefined;
    legalName?: unknown;
    website?: unknown;
    markets?: string[] | undefined;
    mainProducts?: string[] | undefined;
    certifications?: string[] | undefined;
    paymentTerms?: string[] | undefined;
    shippingTerms?: string[] | undefined;
    brandVoice?: string | undefined;
    notes?: string | undefined;
}>;
export declare const CompanyProfileUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    legalName: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>>;
    website: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>>;
    markets: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    mainProducts: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    certifications: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    paymentTerms: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    shippingTerms: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    brandVoice: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    notes: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    name?: string | undefined;
    legalName?: string | undefined;
    website?: string | undefined;
    markets?: string[] | undefined;
    mainProducts?: string[] | undefined;
    certifications?: string[] | undefined;
    paymentTerms?: string[] | undefined;
    shippingTerms?: string[] | undefined;
    brandVoice?: string | undefined;
    notes?: string | undefined;
}, {
    name?: string | undefined;
    legalName?: unknown;
    website?: unknown;
    markets?: string[] | undefined;
    mainProducts?: string[] | undefined;
    certifications?: string[] | undefined;
    paymentTerms?: string[] | undefined;
    shippingTerms?: string[] | undefined;
    brandVoice?: string | undefined;
    notes?: string | undefined;
}>;
export declare const OnboardingLanguageSchema: z.ZodEnum<["zh-CN", "zh-TW", "ja", "ko", "en"]>;
export declare const OnboardingThemeSchema: z.ZodEnum<["warm", "night", "plain", "system"]>;
export declare const OnboardingProviderInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    kind: z.ZodDefault<z.ZodEnum<["openai-compatible", "openai", "anthropic", "local"]>>;
    displayName: z.ZodString;
    baseUrl: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>, z.ZodOptional<z.ZodString>>;
    defaultModel: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    apiKey: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    displayName: string;
    kind: "openai-compatible" | "openai" | "anthropic" | "local";
    enabled: boolean;
    id?: string | undefined;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    defaultModel?: string | undefined;
}, {
    displayName: string;
    id?: string | undefined;
    apiKey?: unknown;
    kind?: "openai-compatible" | "openai" | "anthropic" | "local" | undefined;
    baseUrl?: unknown;
    defaultModel?: unknown;
    enabled?: boolean | undefined;
}>;
export declare const OnboardingProviderStateSchema: z.ZodObject<Omit<{
    id: z.ZodOptional<z.ZodString>;
    kind: z.ZodDefault<z.ZodEnum<["openai-compatible", "openai", "anthropic", "local"]>>;
    displayName: z.ZodString;
    baseUrl: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>, z.ZodOptional<z.ZodString>>;
    defaultModel: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    apiKey: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, "apiKey"> & {
    keyPreview: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    displayName: string;
    kind: "openai-compatible" | "openai" | "anthropic" | "local";
    enabled: boolean;
    id?: string | undefined;
    baseUrl?: string | undefined;
    defaultModel?: string | undefined;
    keyPreview?: string | undefined;
}, {
    displayName: string;
    id?: string | undefined;
    kind?: "openai-compatible" | "openai" | "anthropic" | "local" | undefined;
    baseUrl?: unknown;
    defaultModel?: unknown;
    keyPreview?: string | undefined;
    enabled?: boolean | undefined;
}>;
export declare const OnboardingStateSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodLiteral<1>>;
    language: z.ZodDefault<z.ZodEnum<["zh-CN", "zh-TW", "ja", "ko", "en"]>>;
    userDisplayName: z.ZodDefault<z.ZodString>;
    agentName: z.ZodDefault<z.ZodString>;
    memoryEnabled: z.ZodDefault<z.ZodBoolean>;
    theme: z.ZodDefault<z.ZodEnum<["warm", "night", "plain", "system"]>>;
    workspacePath: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    provider: z.ZodOptional<z.ZodObject<Omit<{
        id: z.ZodOptional<z.ZodString>;
        kind: z.ZodDefault<z.ZodEnum<["openai-compatible", "openai", "anthropic", "local"]>>;
        displayName: z.ZodString;
        baseUrl: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>, z.ZodOptional<z.ZodString>>;
        defaultModel: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
        apiKey: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "apiKey"> & {
        keyPreview: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        displayName: string;
        kind: "openai-compatible" | "openai" | "anthropic" | "local";
        enabled: boolean;
        id?: string | undefined;
        baseUrl?: string | undefined;
        defaultModel?: string | undefined;
        keyPreview?: string | undefined;
    }, {
        displayName: string;
        id?: string | undefined;
        kind?: "openai-compatible" | "openai" | "anthropic" | "local" | undefined;
        baseUrl?: unknown;
        defaultModel?: unknown;
        keyPreview?: string | undefined;
        enabled?: boolean | undefined;
    }>>;
    onboardingCompletedAt: z.ZodOptional<z.ZodString>;
    defaultAgentId: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    version: 1;
    language: "zh-CN" | "zh-TW" | "ja" | "ko" | "en";
    userDisplayName: string;
    agentName: string;
    memoryEnabled: boolean;
    theme: "warm" | "night" | "plain" | "system";
    workspacePath?: string | undefined;
    provider?: {
        displayName: string;
        kind: "openai-compatible" | "openai" | "anthropic" | "local";
        enabled: boolean;
        id?: string | undefined;
        baseUrl?: string | undefined;
        defaultModel?: string | undefined;
        keyPreview?: string | undefined;
    } | undefined;
    onboardingCompletedAt?: string | undefined;
    defaultAgentId?: string | undefined;
}, {
    version?: 1 | undefined;
    language?: "zh-CN" | "zh-TW" | "ja" | "ko" | "en" | undefined;
    userDisplayName?: string | undefined;
    agentName?: string | undefined;
    memoryEnabled?: boolean | undefined;
    theme?: "warm" | "night" | "plain" | "system" | undefined;
    workspacePath?: unknown;
    provider?: {
        displayName: string;
        id?: string | undefined;
        kind?: "openai-compatible" | "openai" | "anthropic" | "local" | undefined;
        baseUrl?: unknown;
        defaultModel?: unknown;
        keyPreview?: string | undefined;
        enabled?: boolean | undefined;
    } | undefined;
    onboardingCompletedAt?: string | undefined;
    defaultAgentId?: string | undefined;
}>;
export declare const OnboardingUpdateSchema: z.ZodObject<{
    language: z.ZodOptional<z.ZodDefault<z.ZodEnum<["zh-CN", "zh-TW", "ja", "ko", "en"]>>>;
    userDisplayName: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    agentName: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    memoryEnabled: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    theme: z.ZodOptional<z.ZodDefault<z.ZodEnum<["warm", "night", "plain", "system"]>>>;
    workspacePath: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>>;
    defaultAgentId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
} & {
    onboardingCompletedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    provider: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        kind: z.ZodDefault<z.ZodEnum<["openai-compatible", "openai", "anthropic", "local"]>>;
        displayName: z.ZodString;
        baseUrl: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>, z.ZodOptional<z.ZodString>>;
        defaultModel: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
        apiKey: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        displayName: string;
        kind: "openai-compatible" | "openai" | "anthropic" | "local";
        enabled: boolean;
        id?: string | undefined;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
        defaultModel?: string | undefined;
    }, {
        displayName: string;
        id?: string | undefined;
        apiKey?: unknown;
        kind?: "openai-compatible" | "openai" | "anthropic" | "local" | undefined;
        baseUrl?: unknown;
        defaultModel?: unknown;
        enabled?: boolean | undefined;
    }>>>;
}, "strict", z.ZodTypeAny, {
    language?: "zh-CN" | "zh-TW" | "ja" | "ko" | "en" | undefined;
    userDisplayName?: string | undefined;
    agentName?: string | undefined;
    memoryEnabled?: boolean | undefined;
    theme?: "warm" | "night" | "plain" | "system" | undefined;
    workspacePath?: string | undefined;
    provider?: {
        displayName: string;
        kind: "openai-compatible" | "openai" | "anthropic" | "local";
        enabled: boolean;
        id?: string | undefined;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
        defaultModel?: string | undefined;
    } | null | undefined;
    onboardingCompletedAt?: string | null | undefined;
    defaultAgentId?: string | undefined;
}, {
    language?: "zh-CN" | "zh-TW" | "ja" | "ko" | "en" | undefined;
    userDisplayName?: string | undefined;
    agentName?: string | undefined;
    memoryEnabled?: boolean | undefined;
    theme?: "warm" | "night" | "plain" | "system" | undefined;
    workspacePath?: unknown;
    provider?: {
        displayName: string;
        id?: string | undefined;
        apiKey?: unknown;
        kind?: "openai-compatible" | "openai" | "anthropic" | "local" | undefined;
        baseUrl?: unknown;
        defaultModel?: unknown;
        enabled?: boolean | undefined;
    } | null | undefined;
    onboardingCompletedAt?: string | null | undefined;
    defaultAgentId?: string | undefined;
}>;
export declare const RuntimeStatusSchema: z.ZodObject<{
    platform: z.ZodString;
    arch: z.ZodString;
    installed: z.ZodBoolean;
    state: z.ZodOptional<z.ZodEnum<["not-installed", "checking", "downloading", "installing", "configuring", "starting", "verifying", "ready", "needs-user-action", "failed"]>>;
    version: z.ZodOptional<z.ZodString>;
    latestVersion: z.ZodOptional<z.ZodString>;
    updateAvailable: z.ZodOptional<z.ZodBoolean>;
    executablePath: z.ZodOptional<z.ZodString>;
    runtimeHome: z.ZodString;
    hermesHome: z.ZodOptional<z.ZodString>;
    installerUrl: z.ZodOptional<z.ZodString>;
    installMetadata: z.ZodOptional<z.ZodObject<{
        installedAt: z.ZodString;
        sourceUrl: z.ZodString;
        installerUrl: z.ZodString;
        licenseUrl: z.ZodString;
        latestReleaseTag: z.ZodOptional<z.ZodString>;
        latestReleaseName: z.ZodOptional<z.ZodString>;
        executablePath: z.ZodOptional<z.ZodString>;
        version: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        installerUrl: string;
        installedAt: string;
        sourceUrl: string;
        licenseUrl: string;
        version?: string | undefined;
        executablePath?: string | undefined;
        latestReleaseTag?: string | undefined;
        latestReleaseName?: string | undefined;
    }, {
        installerUrl: string;
        installedAt: string;
        sourceUrl: string;
        licenseUrl: string;
        version?: string | undefined;
        executablePath?: string | undefined;
        latestReleaseTag?: string | undefined;
        latestReleaseName?: string | undefined;
    }>>;
    gateway: z.ZodOptional<z.ZodObject<{
        state: z.ZodEnum<["stopped", "starting", "running", "failed"]>;
        pid: z.ZodOptional<z.ZodNumber>;
        apiBaseUrl: z.ZodOptional<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        state: "failed" | "starting" | "stopped" | "running";
        message?: string | undefined;
        pid?: number | undefined;
        apiBaseUrl?: string | undefined;
    }, {
        state: "failed" | "starting" | "stopped" | "running";
        message?: string | undefined;
        pid?: number | undefined;
        apiBaseUrl?: string | undefined;
    }>>;
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
    state?: "failed" | "not-installed" | "checking" | "downloading" | "installing" | "configuring" | "starting" | "verifying" | "ready" | "needs-user-action" | undefined;
    latestVersion?: string | undefined;
    updateAvailable?: boolean | undefined;
    executablePath?: string | undefined;
    hermesHome?: string | undefined;
    installerUrl?: string | undefined;
    installMetadata?: {
        installerUrl: string;
        installedAt: string;
        sourceUrl: string;
        licenseUrl: string;
        version?: string | undefined;
        executablePath?: string | undefined;
        latestReleaseTag?: string | undefined;
        latestReleaseName?: string | undefined;
    } | undefined;
    gateway?: {
        state: "failed" | "starting" | "stopped" | "running";
        message?: string | undefined;
        pid?: number | undefined;
        apiBaseUrl?: string | undefined;
    } | undefined;
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
    state?: "failed" | "not-installed" | "checking" | "downloading" | "installing" | "configuring" | "starting" | "verifying" | "ready" | "needs-user-action" | undefined;
    latestVersion?: string | undefined;
    updateAvailable?: boolean | undefined;
    executablePath?: string | undefined;
    hermesHome?: string | undefined;
    installerUrl?: string | undefined;
    installMetadata?: {
        installerUrl: string;
        installedAt: string;
        sourceUrl: string;
        licenseUrl: string;
        version?: string | undefined;
        executablePath?: string | undefined;
        latestReleaseTag?: string | undefined;
        latestReleaseName?: string | undefined;
    } | undefined;
    gateway?: {
        state: "failed" | "starting" | "stopped" | "running";
        message?: string | undefined;
        pid?: number | undefined;
        apiBaseUrl?: string | undefined;
    } | undefined;
    activeInstallJob?: string | undefined;
}>;
export declare const AppStateSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodLiteral<1>>;
    firstDeployHidden: z.ZodDefault<z.ZodBoolean>;
    localDeployCompletedAt: z.ZodOptional<z.ZodString>;
    lastSuccessfulRuntimeVersion: z.ZodOptional<z.ZodString>;
    lastSuccessfulGatewayAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    version: 1;
    firstDeployHidden: boolean;
    localDeployCompletedAt?: string | undefined;
    lastSuccessfulRuntimeVersion?: string | undefined;
    lastSuccessfulGatewayAt?: string | undefined;
}, {
    version?: 1 | undefined;
    firstDeployHidden?: boolean | undefined;
    localDeployCompletedAt?: string | undefined;
    lastSuccessfulRuntimeVersion?: string | undefined;
    lastSuccessfulGatewayAt?: string | undefined;
}>;
export declare const InstallRequestSchema: z.ZodObject<{
    channel: z.ZodDefault<z.ZodEnum<["official-docs-latest"]>>;
    dryRun: z.ZodDefault<z.ZodBoolean>;
    force: z.ZodDefault<z.ZodBoolean>;
    skipBrowser: z.ZodDefault<z.ZodBoolean>;
    installerUrl: z.ZodOptional<z.ZodString>;
    licenseUrl: z.ZodOptional<z.ZodString>;
    installerSha256: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    channel: "official-docs-latest";
    dryRun: boolean;
    force: boolean;
    skipBrowser: boolean;
    installerUrl?: string | undefined;
    licenseUrl?: string | undefined;
    installerSha256?: string | undefined;
}, {
    installerUrl?: string | undefined;
    licenseUrl?: string | undefined;
    channel?: "official-docs-latest" | undefined;
    dryRun?: boolean | undefined;
    force?: boolean | undefined;
    skipBrowser?: boolean | undefined;
    installerSha256?: string | undefined;
}>;
export declare const ChatMessageSchema: z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<["system", "user", "assistant"]>;
    content: z.ZodString;
    usage: z.ZodOptional<z.ZodObject<{
        inputTokens: z.ZodDefault<z.ZodNumber>;
        outputTokens: z.ZodDefault<z.ZodNumber>;
        totalTokens: z.ZodDefault<z.ZodNumber>;
        estimatedCostUsd: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCostUsd?: number | undefined;
    }, {
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
        totalTokens?: number | undefined;
        estimatedCostUsd?: number | undefined;
    }>>;
    createdAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    role: "system" | "user" | "assistant";
    content: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCostUsd?: number | undefined;
    } | undefined;
}, {
    id: string;
    createdAt: string;
    role: "system" | "user" | "assistant";
    content: string;
    usage?: {
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
        totalTokens?: number | undefined;
        estimatedCostUsd?: number | undefined;
    } | undefined;
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
        usage: z.ZodOptional<z.ZodObject<{
            inputTokens: z.ZodDefault<z.ZodNumber>;
            outputTokens: z.ZodDefault<z.ZodNumber>;
            totalTokens: z.ZodDefault<z.ZodNumber>;
            estimatedCostUsd: z.ZodOptional<z.ZodNumber>;
        }, "strict", z.ZodTypeAny, {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            estimatedCostUsd?: number | undefined;
        }, {
            inputTokens?: number | undefined;
            outputTokens?: number | undefined;
            totalTokens?: number | undefined;
            estimatedCostUsd?: number | undefined;
        }>>;
        createdAt: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        role: "system" | "user" | "assistant";
        content: string;
        usage?: {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            estimatedCostUsd?: number | undefined;
        } | undefined;
    }, {
        id: string;
        createdAt: string;
        role: "system" | "user" | "assistant";
        content: string;
        usage?: {
            inputTokens?: number | undefined;
            outputTokens?: number | undefined;
            totalTokens?: number | undefined;
            estimatedCostUsd?: number | undefined;
        } | undefined;
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
        usage?: {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            estimatedCostUsd?: number | undefined;
        } | undefined;
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
        usage?: {
            inputTokens?: number | undefined;
            outputTokens?: number | undefined;
            totalTokens?: number | undefined;
            estimatedCostUsd?: number | undefined;
        } | undefined;
    }[] | undefined;
}>;
export declare const UsageEstimateSchema: z.ZodObject<{
    inputTokens: z.ZodDefault<z.ZodNumber>;
    outputTokens: z.ZodDefault<z.ZodNumber>;
    totalTokens: z.ZodDefault<z.ZodNumber>;
    estimatedCostUsd: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number | undefined;
}, {
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    totalTokens?: number | undefined;
    estimatedCostUsd?: number | undefined;
}>;
export declare const OutreachLeadSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    companyName: z.ZodString;
    website: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    country: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    industry: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    contactName: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    contactTitle: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    email: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    need: z.ZodDefault<z.ZodString>;
    notes: z.ZodDefault<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    source: z.ZodDefault<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["new", "email_drafted", "followup_drafted", "email_sent", "contacted", "reply_received", "followup_due"]>>;
    currentState: z.ZodDefault<z.ZodEnum<["input_ready", "waiting_user_send", "waiting_user_send_followup", "waiting_response_status", "drafting_reply_email"]>>;
    replyStatus: z.ZodDefault<z.ZodEnum<["not_checked", "checking", "no_reply", "reply_received", "bounced", "unsubscribed"]>>;
    statusColor: z.ZodDefault<z.ZodEnum<["slate", "blue", "amber", "green", "rose", "violet"]>>;
    currentRound: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    status: "new" | "email_drafted" | "followup_drafted" | "email_sent" | "contacted" | "reply_received" | "followup_due";
    id: string;
    source: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    notes: string;
    companyName: string;
    need: string;
    currentState: "input_ready" | "waiting_user_send" | "waiting_user_send_followup" | "waiting_response_status" | "drafting_reply_email";
    replyStatus: "checking" | "reply_received" | "not_checked" | "no_reply" | "bounced" | "unsubscribed";
    statusColor: "slate" | "blue" | "amber" | "green" | "rose" | "violet";
    currentRound: number;
    website?: string | undefined;
    profileId?: string | undefined;
    country?: string | undefined;
    industry?: string | undefined;
    contactName?: string | undefined;
    contactTitle?: string | undefined;
    email?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    companyName: string;
    status?: "new" | "email_drafted" | "followup_drafted" | "email_sent" | "contacted" | "reply_received" | "followup_due" | undefined;
    source?: string | undefined;
    tags?: string[] | undefined;
    website?: unknown;
    notes?: string | undefined;
    profileId?: string | undefined;
    country?: unknown;
    industry?: unknown;
    contactName?: unknown;
    contactTitle?: unknown;
    email?: unknown;
    need?: string | undefined;
    currentState?: "input_ready" | "waiting_user_send" | "waiting_user_send_followup" | "waiting_response_status" | "drafting_reply_email" | undefined;
    replyStatus?: "checking" | "reply_received" | "not_checked" | "no_reply" | "bounced" | "unsubscribed" | undefined;
    statusColor?: "slate" | "blue" | "amber" | "green" | "rose" | "violet" | undefined;
    currentRound?: number | undefined;
}>;
export declare const OutreachDraftStatusSchema: z.ZodEnum<["draft", "sent", "failed"]>;
export declare const OutreachGenerationModeSchema: z.ZodEnum<["lite", "deep"]>;
export declare const OutreachEvidenceLevelSchema: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
export declare const OutreachEvidenceItemSchema: z.ZodObject<{
    id: z.ZodString;
    level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
    label: z.ZodString;
    value: z.ZodString;
    source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
    sourceUrl: z.ZodOptional<z.ZodString>;
    snippet: z.ZodDefault<z.ZodString>;
    usedInEmail: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    label: string;
    value: string;
    id: string;
    source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
    level: "verified" | "inferred" | "generic" | "prohibited";
    snippet: string;
    usedInEmail: boolean;
    sourceUrl?: string | undefined;
}, {
    label: string;
    value: string;
    id: string;
    level: "verified" | "inferred" | "generic" | "prohibited";
    source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
    sourceUrl?: string | undefined;
    snippet?: string | undefined;
    usedInEmail?: boolean | undefined;
}>;
export declare const OutreachEvidenceMapSchema: z.ZodObject<{
    status: z.ZodDefault<z.ZodEnum<["success", "need_more_data"]>>;
    minimumDataAvailable: z.ZodDefault<z.ZodBoolean>;
    verifiedFacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
        label: z.ZodString;
        value: z.ZodString;
        source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        snippet: z.ZodDefault<z.ZodString>;
        usedInEmail: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        label: string;
        value: string;
        id: string;
        source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
        level: "verified" | "inferred" | "generic" | "prohibited";
        snippet: string;
        usedInEmail: boolean;
        sourceUrl?: string | undefined;
    }, {
        label: string;
        value: string;
        id: string;
        level: "verified" | "inferred" | "generic" | "prohibited";
        source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
        sourceUrl?: string | undefined;
        snippet?: string | undefined;
        usedInEmail?: boolean | undefined;
    }>, "many">>;
    inferredInsights: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
        label: z.ZodString;
        value: z.ZodString;
        source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        snippet: z.ZodDefault<z.ZodString>;
        usedInEmail: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        label: string;
        value: string;
        id: string;
        source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
        level: "verified" | "inferred" | "generic" | "prohibited";
        snippet: string;
        usedInEmail: boolean;
        sourceUrl?: string | undefined;
    }, {
        label: string;
        value: string;
        id: string;
        level: "verified" | "inferred" | "generic" | "prohibited";
        source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
        sourceUrl?: string | undefined;
        snippet?: string | undefined;
        usedInEmail?: boolean | undefined;
    }>, "many">>;
    genericContext: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
        label: z.ZodString;
        value: z.ZodString;
        source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        snippet: z.ZodDefault<z.ZodString>;
        usedInEmail: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        label: string;
        value: string;
        id: string;
        source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
        level: "verified" | "inferred" | "generic" | "prohibited";
        snippet: string;
        usedInEmail: boolean;
        sourceUrl?: string | undefined;
    }, {
        label: string;
        value: string;
        id: string;
        level: "verified" | "inferred" | "generic" | "prohibited";
        source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
        sourceUrl?: string | undefined;
        snippet?: string | undefined;
        usedInEmail?: boolean | undefined;
    }>, "many">>;
    prohibitedClaims: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
        label: z.ZodString;
        value: z.ZodString;
        source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        snippet: z.ZodDefault<z.ZodString>;
        usedInEmail: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        label: string;
        value: string;
        id: string;
        source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
        level: "verified" | "inferred" | "generic" | "prohibited";
        snippet: string;
        usedInEmail: boolean;
        sourceUrl?: string | undefined;
    }, {
        label: string;
        value: string;
        id: string;
        level: "verified" | "inferred" | "generic" | "prohibited";
        source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
        sourceUrl?: string | undefined;
        snippet?: string | undefined;
        usedInEmail?: boolean | undefined;
    }>, "many">>;
    missingFields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    status: "success" | "need_more_data";
    minimumDataAvailable: boolean;
    verifiedFacts: {
        label: string;
        value: string;
        id: string;
        source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
        level: "verified" | "inferred" | "generic" | "prohibited";
        snippet: string;
        usedInEmail: boolean;
        sourceUrl?: string | undefined;
    }[];
    inferredInsights: {
        label: string;
        value: string;
        id: string;
        source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
        level: "verified" | "inferred" | "generic" | "prohibited";
        snippet: string;
        usedInEmail: boolean;
        sourceUrl?: string | undefined;
    }[];
    genericContext: {
        label: string;
        value: string;
        id: string;
        source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
        level: "verified" | "inferred" | "generic" | "prohibited";
        snippet: string;
        usedInEmail: boolean;
        sourceUrl?: string | undefined;
    }[];
    prohibitedClaims: {
        label: string;
        value: string;
        id: string;
        source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
        level: "verified" | "inferred" | "generic" | "prohibited";
        snippet: string;
        usedInEmail: boolean;
        sourceUrl?: string | undefined;
    }[];
    missingFields: string[];
    createdAt?: string | undefined;
}, {
    status?: "success" | "need_more_data" | undefined;
    createdAt?: string | undefined;
    minimumDataAvailable?: boolean | undefined;
    verifiedFacts?: {
        label: string;
        value: string;
        id: string;
        level: "verified" | "inferred" | "generic" | "prohibited";
        source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
        sourceUrl?: string | undefined;
        snippet?: string | undefined;
        usedInEmail?: boolean | undefined;
    }[] | undefined;
    inferredInsights?: {
        label: string;
        value: string;
        id: string;
        level: "verified" | "inferred" | "generic" | "prohibited";
        source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
        sourceUrl?: string | undefined;
        snippet?: string | undefined;
        usedInEmail?: boolean | undefined;
    }[] | undefined;
    genericContext?: {
        label: string;
        value: string;
        id: string;
        level: "verified" | "inferred" | "generic" | "prohibited";
        source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
        sourceUrl?: string | undefined;
        snippet?: string | undefined;
        usedInEmail?: boolean | undefined;
    }[] | undefined;
    prohibitedClaims?: {
        label: string;
        value: string;
        id: string;
        level: "verified" | "inferred" | "generic" | "prohibited";
        source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
        sourceUrl?: string | undefined;
        snippet?: string | undefined;
        usedInEmail?: boolean | undefined;
    }[] | undefined;
    missingFields?: string[] | undefined;
}>;
export declare const OutreachCtaAssetTypeSchema: z.ZodEnum<["catalog", "sample_options", "spec_comparison", "moq_leadtime_sheet", "case_study", "certification_pack", "packaging_options", "quote_range", "custom"]>;
export declare const OutreachCtaAssetSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<["catalog", "sample_options", "spec_comparison", "moq_leadtime_sheet", "case_study", "certification_pack", "packaging_options", "quote_range", "custom"]>>;
    description: z.ZodDefault<z.ZodString>;
    assetText: z.ZodDefault<z.ZodString>;
    materialId: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "custom" | "catalog" | "sample_options" | "spec_comparison" | "moq_leadtime_sheet" | "case_study" | "certification_pack" | "packaging_options" | "quote_range";
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    enabled: boolean;
    assetText: string;
    profileId?: string | undefined;
    materialId?: string | undefined;
    url?: string | undefined;
}, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    type?: "custom" | "catalog" | "sample_options" | "spec_comparison" | "moq_leadtime_sheet" | "case_study" | "certification_pack" | "packaging_options" | "quote_range" | undefined;
    description?: string | undefined;
    enabled?: boolean | undefined;
    profileId?: string | undefined;
    assetText?: string | undefined;
    materialId?: string | undefined;
    url?: string | undefined;
}>;
export declare const OutreachBuyerPersonaSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    companyType: z.ZodDefault<z.ZodString>;
    buyerRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    painPoints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    successMetrics: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    objections: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    triggerEvents: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    evidenceNotes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    enabled: boolean;
    companyType: string;
    buyerRoles: string[];
    painPoints: string[];
    successMetrics: string[];
    objections: string[];
    triggerEvents: string[];
    evidenceNotes: string[];
    profileId?: string | undefined;
}, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    enabled?: boolean | undefined;
    profileId?: string | undefined;
    companyType?: string | undefined;
    buyerRoles?: string[] | undefined;
    painPoints?: string[] | undefined;
    successMetrics?: string[] | undefined;
    objections?: string[] | undefined;
    triggerEvents?: string[] | undefined;
    evidenceNotes?: string[] | undefined;
}>;
export declare const OutreachUspCandidateSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    category: z.ZodDefault<z.ZodString>;
    headline: z.ZodString;
    buyerAngle: z.ZodDefault<z.ZodString>;
    proof: z.ZodDefault<z.ZodString>;
    proofLevel: z.ZodDefault<z.ZodEnum<["verified", "profile-derived", "needs-proof"]>>;
    assetIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    category: string;
    createdAt: string;
    updatedAt: string;
    enabled: boolean;
    headline: string;
    buyerAngle: string;
    proof: string;
    proofLevel: "verified" | "profile-derived" | "needs-proof";
    assetIds: string[];
    profileId?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    headline: string;
    category?: string | undefined;
    enabled?: boolean | undefined;
    profileId?: string | undefined;
    buyerAngle?: string | undefined;
    proof?: string | undefined;
    proofLevel?: "verified" | "profile-derived" | "needs-proof" | undefined;
    assetIds?: string[] | undefined;
}>;
export declare const OutreachGoldenExampleSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    industry: z.ZodDefault<z.ZodString>;
    buyerType: z.ZodDefault<z.ZodString>;
    productLine: z.ZodDefault<z.ZodString>;
    market: z.ZodDefault<z.ZodString>;
    subject: z.ZodString;
    body: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sourceDraftId: z.ZodOptional<z.ZodString>;
    qualityScore: z.ZodOptional<z.ZodNumber>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    enabled: boolean;
    title: string;
    industry: string;
    buyerType: string;
    productLine: string;
    market: string;
    subject: string;
    body: string;
    profileId?: string | undefined;
    sourceDraftId?: string | undefined;
    qualityScore?: number | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    subject: string;
    body: string;
    tags?: string[] | undefined;
    enabled?: boolean | undefined;
    profileId?: string | undefined;
    industry?: string | undefined;
    buyerType?: string | undefined;
    productLine?: string | undefined;
    market?: string | undefined;
    sourceDraftId?: string | undefined;
    qualityScore?: number | undefined;
}>;
export declare const OutreachStrategyMatchSchema: z.ZodObject<{
    personaId: z.ZodOptional<z.ZodString>;
    uspId: z.ZodOptional<z.ZodString>;
    ctaAssetId: z.ZodOptional<z.ZodString>;
    buyerPain: z.ZodDefault<z.ZodString>;
    buyerImplication: z.ZodDefault<z.ZodString>;
    selectedUsp: z.ZodDefault<z.ZodString>;
    microOffer: z.ZodDefault<z.ZodString>;
    rationale: z.ZodDefault<z.ZodString>;
    confidenceScore: z.ZodDefault<z.ZodNumber>;
    evidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    warnings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    buyerPain: string;
    buyerImplication: string;
    selectedUsp: string;
    microOffer: string;
    rationale: string;
    confidenceScore: number;
    evidenceIds: string[];
    warnings: string[];
    personaId?: string | undefined;
    uspId?: string | undefined;
    ctaAssetId?: string | undefined;
}, {
    personaId?: string | undefined;
    uspId?: string | undefined;
    ctaAssetId?: string | undefined;
    buyerPain?: string | undefined;
    buyerImplication?: string | undefined;
    selectedUsp?: string | undefined;
    microOffer?: string | undefined;
    rationale?: string | undefined;
    confidenceScore?: number | undefined;
    evidenceIds?: string[] | undefined;
    warnings?: string[] | undefined;
}>;
export declare const OutreachSendRiskIssueSchema: z.ZodObject<{
    id: z.ZodString;
    severity: z.ZodEnum<["info", "warning", "block"]>;
    message: z.ZodString;
    blocking: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    message: string;
    id: string;
    severity: "info" | "warning" | "block";
    blocking: boolean;
}, {
    message: string;
    id: string;
    severity: "info" | "warning" | "block";
    blocking?: boolean | undefined;
}>;
export declare const OutreachSendRiskReviewSchema: z.ZodObject<{
    score: z.ZodNumber;
    passed: z.ZodBoolean;
    level: z.ZodEnum<["pass", "warning", "blocked"]>;
    issues: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        severity: z.ZodEnum<["info", "warning", "block"]>;
        message: z.ZodString;
        blocking: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        message: string;
        id: string;
        severity: "info" | "warning" | "block";
        blocking: boolean;
    }, {
        message: string;
        id: string;
        severity: "info" | "warning" | "block";
        blocking?: boolean | undefined;
    }>, "many">>;
    checkedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    issues: {
        message: string;
        id: string;
        severity: "info" | "warning" | "block";
        blocking: boolean;
    }[];
    level: "warning" | "pass" | "blocked";
    score: number;
    passed: boolean;
    checkedAt: string;
}, {
    level: "warning" | "pass" | "blocked";
    score: number;
    passed: boolean;
    checkedAt: string;
    issues?: {
        message: string;
        id: string;
        severity: "info" | "warning" | "block";
        blocking?: boolean | undefined;
    }[] | undefined;
}>;
export declare const OutreachEmailQualityCheckSchema: z.ZodObject<{
    id: z.ZodEnum<["buyerReason", "humanTone", "personalized", "nextStep", "twoSecondRead"]>;
    label: z.ZodString;
    passed: z.ZodBoolean;
    score: z.ZodNumber;
    message: z.ZodDefault<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    label: string;
    message: string;
    id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
    score: number;
    passed: boolean;
}, {
    label: string;
    id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
    score: number;
    passed: boolean;
    message?: string | undefined;
}>;
export declare const OutreachEmailQualityReviewSchema: z.ZodObject<{
    score: z.ZodNumber;
    passed: z.ZodBoolean;
    level: z.ZodEnum<["pass", "needs-work", "blocked"]>;
    summary: z.ZodDefault<z.ZodString>;
    checks: z.ZodArray<z.ZodObject<{
        id: z.ZodEnum<["buyerReason", "humanTone", "personalized", "nextStep", "twoSecondRead"]>;
        label: z.ZodString;
        passed: z.ZodBoolean;
        score: z.ZodNumber;
        message: z.ZodDefault<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        label: string;
        message: string;
        id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
        score: number;
        passed: boolean;
    }, {
        label: string;
        id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
        score: number;
        passed: boolean;
        message?: string | undefined;
    }>, "many">;
    issues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    rewriteHints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    reviewedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    issues: string[];
    checks: {
        label: string;
        message: string;
        id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
        score: number;
        passed: boolean;
    }[];
    level: "pass" | "blocked" | "needs-work";
    score: number;
    passed: boolean;
    summary: string;
    rewriteHints: string[];
    reviewedAt: string;
}, {
    checks: {
        label: string;
        id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
        score: number;
        passed: boolean;
        message?: string | undefined;
    }[];
    level: "pass" | "blocked" | "needs-work";
    score: number;
    passed: boolean;
    reviewedAt: string;
    issues?: string[] | undefined;
    summary?: string | undefined;
    rewriteHints?: string[] | undefined;
}>;
export declare const CustomerResearchAngleSchema: z.ZodObject<{
    name: z.ZodString;
    whyItFits: z.ZodDefault<z.ZodString>;
    buyerConcern: z.ZodDefault<z.ZodString>;
    evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    riskLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
}, "strict", z.ZodTypeAny, {
    name: string;
    whyItFits: string;
    buyerConcern: string;
    evidence: string[];
    claimsToAvoid: string[];
    riskLevel: "low" | "medium" | "high";
}, {
    name: string;
    whyItFits?: string | undefined;
    buyerConcern?: string | undefined;
    evidence?: string[] | undefined;
    claimsToAvoid?: string[] | undefined;
    riskLevel?: "low" | "medium" | "high" | undefined;
}>;
export declare const CustomerResearchBriefSchema: z.ZodObject<{
    fitVerdict: z.ZodDefault<z.ZodEnum<["good-fit", "cautious", "poor-fit", "unknown"]>>;
    shouldWrite: z.ZodDefault<z.ZodEnum<["yes", "cautious", "no"]>>;
    buyerTypeDetail: z.ZodDefault<z.ZodString>;
    purchaseIntentSignal: z.ZodDefault<z.ZodString>;
    bestOutreachPath: z.ZodDefault<z.ZodString>;
    mainRisk: z.ZodDefault<z.ZodString>;
    recommendedContactRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    outreachAngles: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        whyItFits: z.ZodDefault<z.ZodString>;
        buyerConcern: z.ZodDefault<z.ZodString>;
        evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        riskLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    }, "strict", z.ZodTypeAny, {
        name: string;
        whyItFits: string;
        buyerConcern: string;
        evidence: string[];
        claimsToAvoid: string[];
        riskLevel: "low" | "medium" | "high";
    }, {
        name: string;
        whyItFits?: string | undefined;
        buyerConcern?: string | undefined;
        evidence?: string[] | undefined;
        claimsToAvoid?: string[] | undefined;
        riskLevel?: "low" | "medium" | "high" | undefined;
    }>, "many">>;
    bestAngle: z.ZodDefault<z.ZodString>;
    handoffBrief: z.ZodDefault<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    claimsToAvoid: string[];
    fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
    shouldWrite: "cautious" | "yes" | "no";
    buyerTypeDetail: string;
    purchaseIntentSignal: string;
    bestOutreachPath: string;
    mainRisk: string;
    recommendedContactRoles: string[];
    outreachAngles: {
        name: string;
        whyItFits: string;
        buyerConcern: string;
        evidence: string[];
        claimsToAvoid: string[];
        riskLevel: "low" | "medium" | "high";
    }[];
    bestAngle: string;
    handoffBrief: string;
}, {
    claimsToAvoid?: string[] | undefined;
    fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
    shouldWrite?: "cautious" | "yes" | "no" | undefined;
    buyerTypeDetail?: string | undefined;
    purchaseIntentSignal?: string | undefined;
    bestOutreachPath?: string | undefined;
    mainRisk?: string | undefined;
    recommendedContactRoles?: string[] | undefined;
    outreachAngles?: {
        name: string;
        whyItFits?: string | undefined;
        buyerConcern?: string | undefined;
        evidence?: string[] | undefined;
        claimsToAvoid?: string[] | undefined;
        riskLevel?: "low" | "medium" | "high" | undefined;
    }[] | undefined;
    bestAngle?: string | undefined;
    handoffBrief?: string | undefined;
}>;
export declare const OutreachDraftSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    leadId: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["draft", "sent", "failed"]>>;
    subject: z.ZodString;
    body: z.ZodString;
    language: z.ZodDefault<z.ZodString>;
    tone: z.ZodDefault<z.ZodString>;
    generationMode: z.ZodDefault<z.ZodEnum<["lite", "deep"]>>;
    promptSnapshot: z.ZodDefault<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    usage: z.ZodOptional<z.ZodObject<{
        inputTokens: z.ZodDefault<z.ZodNumber>;
        outputTokens: z.ZodDefault<z.ZodNumber>;
        totalTokens: z.ZodDefault<z.ZodNumber>;
        estimatedCostUsd: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCostUsd?: number | undefined;
    }, {
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
        totalTokens?: number | undefined;
        estimatedCostUsd?: number | undefined;
    }>>;
    qualityReview: z.ZodOptional<z.ZodObject<{
        score: z.ZodNumber;
        passed: z.ZodBoolean;
        level: z.ZodEnum<["pass", "needs-work", "blocked"]>;
        summary: z.ZodDefault<z.ZodString>;
        checks: z.ZodArray<z.ZodObject<{
            id: z.ZodEnum<["buyerReason", "humanTone", "personalized", "nextStep", "twoSecondRead"]>;
            label: z.ZodString;
            passed: z.ZodBoolean;
            score: z.ZodNumber;
            message: z.ZodDefault<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            message: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
        }, {
            label: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
            message?: string | undefined;
        }>, "many">;
        issues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        rewriteHints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        reviewedAt: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        issues: string[];
        checks: {
            label: string;
            message: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
        }[];
        level: "pass" | "blocked" | "needs-work";
        score: number;
        passed: boolean;
        summary: string;
        rewriteHints: string[];
        reviewedAt: string;
    }, {
        checks: {
            label: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
            message?: string | undefined;
        }[];
        level: "pass" | "blocked" | "needs-work";
        score: number;
        passed: boolean;
        reviewedAt: string;
        issues?: string[] | undefined;
        summary?: string | undefined;
        rewriteHints?: string[] | undefined;
    }>>;
    evidenceMap: z.ZodOptional<z.ZodObject<{
        status: z.ZodDefault<z.ZodEnum<["success", "need_more_data"]>>;
        minimumDataAvailable: z.ZodDefault<z.ZodBoolean>;
        verifiedFacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
            label: z.ZodString;
            value: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            snippet: z.ZodDefault<z.ZodString>;
            usedInEmail: z.ZodDefault<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }, {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }>, "many">>;
        inferredInsights: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
            label: z.ZodString;
            value: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            snippet: z.ZodDefault<z.ZodString>;
            usedInEmail: z.ZodDefault<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }, {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }>, "many">>;
        genericContext: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
            label: z.ZodString;
            value: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            snippet: z.ZodDefault<z.ZodString>;
            usedInEmail: z.ZodDefault<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }, {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }>, "many">>;
        prohibitedClaims: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
            label: z.ZodString;
            value: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            snippet: z.ZodDefault<z.ZodString>;
            usedInEmail: z.ZodDefault<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }, {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }>, "many">>;
        missingFields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        createdAt: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        status: "success" | "need_more_data";
        minimumDataAvailable: boolean;
        verifiedFacts: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        inferredInsights: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        genericContext: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        prohibitedClaims: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        missingFields: string[];
        createdAt?: string | undefined;
    }, {
        status?: "success" | "need_more_data" | undefined;
        createdAt?: string | undefined;
        minimumDataAvailable?: boolean | undefined;
        verifiedFacts?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        inferredInsights?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        genericContext?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        prohibitedClaims?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        missingFields?: string[] | undefined;
    }>>;
    strategyMatch: z.ZodOptional<z.ZodObject<{
        personaId: z.ZodOptional<z.ZodString>;
        uspId: z.ZodOptional<z.ZodString>;
        ctaAssetId: z.ZodOptional<z.ZodString>;
        buyerPain: z.ZodDefault<z.ZodString>;
        buyerImplication: z.ZodDefault<z.ZodString>;
        selectedUsp: z.ZodDefault<z.ZodString>;
        microOffer: z.ZodDefault<z.ZodString>;
        rationale: z.ZodDefault<z.ZodString>;
        confidenceScore: z.ZodDefault<z.ZodNumber>;
        evidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        warnings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        buyerPain: string;
        buyerImplication: string;
        selectedUsp: string;
        microOffer: string;
        rationale: string;
        confidenceScore: number;
        evidenceIds: string[];
        warnings: string[];
        personaId?: string | undefined;
        uspId?: string | undefined;
        ctaAssetId?: string | undefined;
    }, {
        personaId?: string | undefined;
        uspId?: string | undefined;
        ctaAssetId?: string | undefined;
        buyerPain?: string | undefined;
        buyerImplication?: string | undefined;
        selectedUsp?: string | undefined;
        microOffer?: string | undefined;
        rationale?: string | undefined;
        confidenceScore?: number | undefined;
        evidenceIds?: string[] | undefined;
        warnings?: string[] | undefined;
    }>>;
    sendRiskReview: z.ZodOptional<z.ZodObject<{
        score: z.ZodNumber;
        passed: z.ZodBoolean;
        level: z.ZodEnum<["pass", "warning", "blocked"]>;
        issues: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            severity: z.ZodEnum<["info", "warning", "block"]>;
            message: z.ZodString;
            blocking: z.ZodDefault<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking: boolean;
        }, {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking?: boolean | undefined;
        }>, "many">>;
        checkedAt: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        issues: {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking: boolean;
        }[];
        level: "warning" | "pass" | "blocked";
        score: number;
        passed: boolean;
        checkedAt: string;
    }, {
        level: "warning" | "pass" | "blocked";
        score: number;
        passed: boolean;
        checkedAt: string;
        issues?: {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking?: boolean | undefined;
        }[] | undefined;
    }>>;
    writingEngine: z.ZodDefault<z.ZodEnum<["legacy-chat", "harness-v2"]>>;
    modelUsed: z.ZodOptional<z.ZodString>;
    rewriteAttempts: z.ZodDefault<z.ZodNumber>;
    evidenceUsed: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
        label: z.ZodString;
        value: z.ZodString;
        source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        snippet: z.ZodDefault<z.ZodString>;
        usedInEmail: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        label: string;
        value: string;
        id: string;
        source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
        level: "verified" | "inferred" | "generic" | "prohibited";
        snippet: string;
        usedInEmail: boolean;
        sourceUrl?: string | undefined;
    }, {
        label: string;
        value: string;
        id: string;
        level: "verified" | "inferred" | "generic" | "prohibited";
        source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
        sourceUrl?: string | undefined;
        snippet?: string | undefined;
        usedInEmail?: boolean | undefined;
    }>, "many">>;
    matchedExampleIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    researchBrief: z.ZodOptional<z.ZodObject<{
        fitVerdict: z.ZodDefault<z.ZodEnum<["good-fit", "cautious", "poor-fit", "unknown"]>>;
        shouldWrite: z.ZodDefault<z.ZodEnum<["yes", "cautious", "no"]>>;
        buyerTypeDetail: z.ZodDefault<z.ZodString>;
        purchaseIntentSignal: z.ZodDefault<z.ZodString>;
        bestOutreachPath: z.ZodDefault<z.ZodString>;
        mainRisk: z.ZodDefault<z.ZodString>;
        recommendedContactRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        outreachAngles: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            whyItFits: z.ZodDefault<z.ZodString>;
            buyerConcern: z.ZodDefault<z.ZodString>;
            evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            riskLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
        }, "strict", z.ZodTypeAny, {
            name: string;
            whyItFits: string;
            buyerConcern: string;
            evidence: string[];
            claimsToAvoid: string[];
            riskLevel: "low" | "medium" | "high";
        }, {
            name: string;
            whyItFits?: string | undefined;
            buyerConcern?: string | undefined;
            evidence?: string[] | undefined;
            claimsToAvoid?: string[] | undefined;
            riskLevel?: "low" | "medium" | "high" | undefined;
        }>, "many">>;
        bestAngle: z.ZodDefault<z.ZodString>;
        handoffBrief: z.ZodDefault<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        claimsToAvoid: string[];
        fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
        shouldWrite: "cautious" | "yes" | "no";
        buyerTypeDetail: string;
        purchaseIntentSignal: string;
        bestOutreachPath: string;
        mainRisk: string;
        recommendedContactRoles: string[];
        outreachAngles: {
            name: string;
            whyItFits: string;
            buyerConcern: string;
            evidence: string[];
            claimsToAvoid: string[];
            riskLevel: "low" | "medium" | "high";
        }[];
        bestAngle: string;
        handoffBrief: string;
    }, {
        claimsToAvoid?: string[] | undefined;
        fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
        shouldWrite?: "cautious" | "yes" | "no" | undefined;
        buyerTypeDetail?: string | undefined;
        purchaseIntentSignal?: string | undefined;
        bestOutreachPath?: string | undefined;
        mainRisk?: string | undefined;
        recommendedContactRoles?: string[] | undefined;
        outreachAngles?: {
            name: string;
            whyItFits?: string | undefined;
            buyerConcern?: string | undefined;
            evidence?: string[] | undefined;
            claimsToAvoid?: string[] | undefined;
            riskLevel?: "low" | "medium" | "high" | undefined;
        }[] | undefined;
        bestAngle?: string | undefined;
        handoffBrief?: string | undefined;
    }>>;
    generationSummary: z.ZodDefault<z.ZodString>;
    sentAt: z.ZodOptional<z.ZodString>;
    sendError: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    status: "failed" | "draft" | "sent";
    id: string;
    createdAt: string;
    updatedAt: string;
    language: string;
    subject: string;
    body: string;
    tone: string;
    generationMode: "lite" | "deep";
    promptSnapshot: string;
    writingEngine: "legacy-chat" | "harness-v2";
    rewriteAttempts: number;
    evidenceUsed: {
        label: string;
        value: string;
        id: string;
        source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
        level: "verified" | "inferred" | "generic" | "prohibited";
        snippet: string;
        usedInEmail: boolean;
        sourceUrl?: string | undefined;
    }[];
    matchedExampleIds: string[];
    generationSummary: string;
    providerId?: string | undefined;
    model?: string | undefined;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCostUsd?: number | undefined;
    } | undefined;
    profileId?: string | undefined;
    leadId?: string | undefined;
    qualityReview?: {
        issues: string[];
        checks: {
            label: string;
            message: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
        }[];
        level: "pass" | "blocked" | "needs-work";
        score: number;
        passed: boolean;
        summary: string;
        rewriteHints: string[];
        reviewedAt: string;
    } | undefined;
    evidenceMap?: {
        status: "success" | "need_more_data";
        minimumDataAvailable: boolean;
        verifiedFacts: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        inferredInsights: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        genericContext: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        prohibitedClaims: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        missingFields: string[];
        createdAt?: string | undefined;
    } | undefined;
    strategyMatch?: {
        buyerPain: string;
        buyerImplication: string;
        selectedUsp: string;
        microOffer: string;
        rationale: string;
        confidenceScore: number;
        evidenceIds: string[];
        warnings: string[];
        personaId?: string | undefined;
        uspId?: string | undefined;
        ctaAssetId?: string | undefined;
    } | undefined;
    sendRiskReview?: {
        issues: {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking: boolean;
        }[];
        level: "warning" | "pass" | "blocked";
        score: number;
        passed: boolean;
        checkedAt: string;
    } | undefined;
    modelUsed?: string | undefined;
    researchBrief?: {
        claimsToAvoid: string[];
        fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
        shouldWrite: "cautious" | "yes" | "no";
        buyerTypeDetail: string;
        purchaseIntentSignal: string;
        bestOutreachPath: string;
        mainRisk: string;
        recommendedContactRoles: string[];
        outreachAngles: {
            name: string;
            whyItFits: string;
            buyerConcern: string;
            evidence: string[];
            claimsToAvoid: string[];
            riskLevel: "low" | "medium" | "high";
        }[];
        bestAngle: string;
        handoffBrief: string;
    } | undefined;
    sentAt?: string | undefined;
    sendError?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    subject: string;
    body: string;
    status?: "failed" | "draft" | "sent" | undefined;
    providerId?: string | undefined;
    model?: string | undefined;
    language?: string | undefined;
    usage?: {
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
        totalTokens?: number | undefined;
        estimatedCostUsd?: number | undefined;
    } | undefined;
    profileId?: string | undefined;
    leadId?: string | undefined;
    tone?: string | undefined;
    generationMode?: "lite" | "deep" | undefined;
    promptSnapshot?: string | undefined;
    qualityReview?: {
        checks: {
            label: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
            message?: string | undefined;
        }[];
        level: "pass" | "blocked" | "needs-work";
        score: number;
        passed: boolean;
        reviewedAt: string;
        issues?: string[] | undefined;
        summary?: string | undefined;
        rewriteHints?: string[] | undefined;
    } | undefined;
    evidenceMap?: {
        status?: "success" | "need_more_data" | undefined;
        createdAt?: string | undefined;
        minimumDataAvailable?: boolean | undefined;
        verifiedFacts?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        inferredInsights?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        genericContext?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        prohibitedClaims?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        missingFields?: string[] | undefined;
    } | undefined;
    strategyMatch?: {
        personaId?: string | undefined;
        uspId?: string | undefined;
        ctaAssetId?: string | undefined;
        buyerPain?: string | undefined;
        buyerImplication?: string | undefined;
        selectedUsp?: string | undefined;
        microOffer?: string | undefined;
        rationale?: string | undefined;
        confidenceScore?: number | undefined;
        evidenceIds?: string[] | undefined;
        warnings?: string[] | undefined;
    } | undefined;
    sendRiskReview?: {
        level: "warning" | "pass" | "blocked";
        score: number;
        passed: boolean;
        checkedAt: string;
        issues?: {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking?: boolean | undefined;
        }[] | undefined;
    } | undefined;
    writingEngine?: "legacy-chat" | "harness-v2" | undefined;
    modelUsed?: string | undefined;
    rewriteAttempts?: number | undefined;
    evidenceUsed?: {
        label: string;
        value: string;
        id: string;
        level: "verified" | "inferred" | "generic" | "prohibited";
        source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
        sourceUrl?: string | undefined;
        snippet?: string | undefined;
        usedInEmail?: boolean | undefined;
    }[] | undefined;
    matchedExampleIds?: string[] | undefined;
    researchBrief?: {
        claimsToAvoid?: string[] | undefined;
        fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
        shouldWrite?: "cautious" | "yes" | "no" | undefined;
        buyerTypeDetail?: string | undefined;
        purchaseIntentSignal?: string | undefined;
        bestOutreachPath?: string | undefined;
        mainRisk?: string | undefined;
        recommendedContactRoles?: string[] | undefined;
        outreachAngles?: {
            name: string;
            whyItFits?: string | undefined;
            buyerConcern?: string | undefined;
            evidence?: string[] | undefined;
            claimsToAvoid?: string[] | undefined;
            riskLevel?: "low" | "medium" | "high" | undefined;
        }[] | undefined;
        bestAngle?: string | undefined;
        handoffBrief?: string | undefined;
    } | undefined;
    generationSummary?: string | undefined;
    sentAt?: string | undefined;
    sendError?: string | undefined;
}>;
export declare const OutreachSendChannelSchema: z.ZodEnum<["smtp", "oauth-api", "service-api"]>;
export declare const OutreachSenderApiCredentialSchema: z.ZodObject<{
    credentialRef: z.ZodOptional<z.ZodString>;
    credentialPreview: z.ZodOptional<z.ZodString>;
    accountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    apiBaseUrl: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    scopes: string[];
    credentialRef?: string | undefined;
    apiBaseUrl?: string | undefined;
    credentialPreview?: string | undefined;
    accountId?: string | undefined;
    expiresAt?: string | undefined;
}, {
    credentialRef?: string | undefined;
    apiBaseUrl?: unknown;
    credentialPreview?: string | undefined;
    accountId?: unknown;
    scopes?: string[] | undefined;
    expiresAt?: string | undefined;
}>;
export declare const OutreachSenderAccountSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    label: z.ZodString;
    provider: z.ZodDefault<z.ZodString>;
    sendChannel: z.ZodDefault<z.ZodEnum<["smtp", "oauth-api", "service-api"]>>;
    fromName: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    email: z.ZodString;
    host: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    port: z.ZodDefault<z.ZodNumber>;
    secure: z.ZodDefault<z.ZodBoolean>;
    imapHost: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    imapPort: z.ZodOptional<z.ZodNumber>;
    imapSecure: z.ZodOptional<z.ZodBoolean>;
    imapUsername: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    username: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    passwordRef: z.ZodOptional<z.ZodString>;
    passwordPreview: z.ZodOptional<z.ZodString>;
    oauthApi: z.ZodOptional<z.ZodObject<{
        credentialRef: z.ZodOptional<z.ZodString>;
        credentialPreview: z.ZodOptional<z.ZodString>;
        accountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
        apiBaseUrl: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
        scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        expiresAt: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        scopes: string[];
        credentialRef?: string | undefined;
        apiBaseUrl?: string | undefined;
        credentialPreview?: string | undefined;
        accountId?: string | undefined;
        expiresAt?: string | undefined;
    }, {
        credentialRef?: string | undefined;
        apiBaseUrl?: unknown;
        credentialPreview?: string | undefined;
        accountId?: unknown;
        scopes?: string[] | undefined;
        expiresAt?: string | undefined;
    }>>;
    serviceApi: z.ZodOptional<z.ZodObject<{
        credentialRef: z.ZodOptional<z.ZodString>;
        credentialPreview: z.ZodOptional<z.ZodString>;
        accountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
        apiBaseUrl: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
        scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        expiresAt: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        scopes: string[];
        credentialRef?: string | undefined;
        apiBaseUrl?: string | undefined;
        credentialPreview?: string | undefined;
        accountId?: string | undefined;
        expiresAt?: string | undefined;
    }, {
        credentialRef?: string | undefined;
        apiBaseUrl?: unknown;
        credentialPreview?: string | undefined;
        accountId?: unknown;
        scopes?: string[] | undefined;
        expiresAt?: string | undefined;
    }>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    lastTestedAt: z.ZodOptional<z.ZodString>;
    lastTestEmailAt: z.ZodOptional<z.ZodString>;
    deliveryConfirmedAt: z.ZodOptional<z.ZodString>;
    lastInboxCheckedAt: z.ZodOptional<z.ZodString>;
    lastInboxCheckStatus: z.ZodOptional<z.ZodEnum<["ready", "unsupported", "failed"]>>;
    lastInboxCheckMessage: z.ZodOptional<z.ZodString>;
    lastError: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    label: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    enabled: boolean;
    provider: string;
    email: string;
    sendChannel: "smtp" | "oauth-api" | "service-api";
    port: number;
    secure: boolean;
    profileId?: string | undefined;
    fromName?: string | undefined;
    host?: string | undefined;
    imapHost?: string | undefined;
    imapPort?: number | undefined;
    imapSecure?: boolean | undefined;
    imapUsername?: string | undefined;
    username?: string | undefined;
    passwordRef?: string | undefined;
    passwordPreview?: string | undefined;
    oauthApi?: {
        scopes: string[];
        credentialRef?: string | undefined;
        apiBaseUrl?: string | undefined;
        credentialPreview?: string | undefined;
        accountId?: string | undefined;
        expiresAt?: string | undefined;
    } | undefined;
    serviceApi?: {
        scopes: string[];
        credentialRef?: string | undefined;
        apiBaseUrl?: string | undefined;
        credentialPreview?: string | undefined;
        accountId?: string | undefined;
        expiresAt?: string | undefined;
    } | undefined;
    lastTestedAt?: string | undefined;
    lastTestEmailAt?: string | undefined;
    deliveryConfirmedAt?: string | undefined;
    lastInboxCheckedAt?: string | undefined;
    lastInboxCheckStatus?: "failed" | "ready" | "unsupported" | undefined;
    lastInboxCheckMessage?: string | undefined;
    lastError?: string | undefined;
}, {
    label: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    enabled?: boolean | undefined;
    provider?: string | undefined;
    profileId?: string | undefined;
    sendChannel?: "smtp" | "oauth-api" | "service-api" | undefined;
    fromName?: unknown;
    host?: unknown;
    port?: number | undefined;
    secure?: boolean | undefined;
    imapHost?: unknown;
    imapPort?: number | undefined;
    imapSecure?: boolean | undefined;
    imapUsername?: unknown;
    username?: unknown;
    passwordRef?: string | undefined;
    passwordPreview?: string | undefined;
    oauthApi?: {
        credentialRef?: string | undefined;
        apiBaseUrl?: unknown;
        credentialPreview?: string | undefined;
        accountId?: unknown;
        scopes?: string[] | undefined;
        expiresAt?: string | undefined;
    } | undefined;
    serviceApi?: {
        credentialRef?: string | undefined;
        apiBaseUrl?: unknown;
        credentialPreview?: string | undefined;
        accountId?: unknown;
        scopes?: string[] | undefined;
        expiresAt?: string | undefined;
    } | undefined;
    lastTestedAt?: string | undefined;
    lastTestEmailAt?: string | undefined;
    deliveryConfirmedAt?: string | undefined;
    lastInboxCheckedAt?: string | undefined;
    lastInboxCheckStatus?: "failed" | "ready" | "unsupported" | undefined;
    lastInboxCheckMessage?: string | undefined;
    lastError?: string | undefined;
}>;
export declare const OutreachEmailSignatureLogoSchema: z.ZodObject<{
    id: z.ZodString;
    fileName: z.ZodString;
    mimeType: z.ZodEnum<["image/png", "image/jpeg", "image/webp", "image/gif"]>;
    size: z.ZodNumber;
    sha256: z.ZodString;
    uploadedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    size: number;
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    sha256: string;
    fileName: string;
    uploadedAt: string;
}, {
    id: string;
    size: number;
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    sha256: string;
    fileName: string;
    uploadedAt: string;
}>;
export declare const OutreachEmailSignatureSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodLiteral<1>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    text: z.ZodDefault<z.ZodString>;
    html: z.ZodDefault<z.ZodString>;
    logoEnabled: z.ZodDefault<z.ZodBoolean>;
    logoAlt: z.ZodDefault<z.ZodString>;
    logoWidth: z.ZodDefault<z.ZodNumber>;
    logo: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        fileName: z.ZodString;
        mimeType: z.ZodEnum<["image/png", "image/jpeg", "image/webp", "image/gif"]>;
        size: z.ZodNumber;
        sha256: z.ZodString;
        uploadedAt: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        id: string;
        size: number;
        mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
        sha256: string;
        fileName: string;
        uploadedAt: string;
    }, {
        id: string;
        size: number;
        mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
        sha256: string;
        fileName: string;
        uploadedAt: string;
    }>>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    version: 1;
    enabled: boolean;
    text: string;
    html: string;
    logoEnabled: boolean;
    logoAlt: string;
    logoWidth: number;
    updatedAt?: string | undefined;
    logo?: {
        id: string;
        size: number;
        mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
        sha256: string;
        fileName: string;
        uploadedAt: string;
    } | undefined;
}, {
    updatedAt?: string | undefined;
    version?: 1 | undefined;
    enabled?: boolean | undefined;
    text?: string | undefined;
    html?: string | undefined;
    logoEnabled?: boolean | undefined;
    logoAlt?: string | undefined;
    logoWidth?: number | undefined;
    logo?: {
        id: string;
        size: number;
        mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
        sha256: string;
        fileName: string;
        uploadedAt: string;
    } | undefined;
}>;
export declare const OutreachResearchDepthSchema: z.ZodEnum<["adaptive", "quick", "standard", "deep"]>;
export declare const DeepResearchSidecarConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    url: z.ZodOptional<z.ZodString>;
    timeoutMs: z.ZodDefault<z.ZodNumber>;
    maxPages: z.ZodDefault<z.ZodNumber>;
    apiKey: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    enabled: boolean;
    timeoutMs: number;
    maxPages: number;
    apiKey?: string | undefined;
    url?: string | undefined;
}, {
    apiKey?: string | undefined;
    enabled?: boolean | undefined;
    url?: string | undefined;
    timeoutMs?: number | undefined;
    maxPages?: number | undefined;
}>;
export declare const CustomerResearchSummarySchema: z.ZodObject<{
    depth: z.ZodDefault<z.ZodEnum<["adaptive", "quick", "standard", "deep"]>>;
    confidenceScore: z.ZodDefault<z.ZodNumber>;
    buyerType: z.ZodDefault<z.ZodString>;
    likelyNeed: z.ZodDefault<z.ZodString>;
    primaryAngle: z.ZodDefault<z.ZodString>;
    riskNotes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    checkedPages: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    buyerType: string;
    confidenceScore: number;
    depth: "deep" | "adaptive" | "quick" | "standard";
    likelyNeed: string;
    primaryAngle: string;
    riskNotes: string[];
    checkedPages: number;
}, {
    buyerType?: string | undefined;
    confidenceScore?: number | undefined;
    depth?: "deep" | "adaptive" | "quick" | "standard" | undefined;
    likelyNeed?: string | undefined;
    primaryAngle?: string | undefined;
    riskNotes?: string[] | undefined;
    checkedPages?: number | undefined;
}>;
export declare const CustomerResearchEvidenceSchema: z.ZodObject<{
    label: z.ZodString;
    value: z.ZodString;
    sourceUrl: z.ZodString;
    snippet: z.ZodDefault<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    label: string;
    value: string;
    sourceUrl: string;
    snippet: string;
}, {
    label: string;
    value: string;
    sourceUrl: string;
    snippet?: string | undefined;
}>;
export declare const CustomerResearchSnapshotSchema: z.ZodObject<{
    website: z.ZodString;
    companyName: z.ZodString;
    depth: z.ZodDefault<z.ZodEnum<["adaptive", "quick", "standard", "deep"]>>;
    confidenceScore: z.ZodDefault<z.ZodNumber>;
    buyerType: z.ZodDefault<z.ZodString>;
    productSignals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    buyingSignals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    painSignals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    recommendedAngle: z.ZodDefault<z.ZodString>;
    industry: z.ZodDefault<z.ZodString>;
    inferredNeed: z.ZodDefault<z.ZodString>;
    title: z.ZodDefault<z.ZodString>;
    description: z.ZodDefault<z.ZodString>;
    fetchedUrls: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    evidence: z.ZodDefault<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        value: z.ZodString;
        sourceUrl: z.ZodString;
        snippet: z.ZodDefault<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        label: string;
        value: string;
        sourceUrl: string;
        snippet: string;
    }, {
        label: string;
        value: string;
        sourceUrl: string;
        snippet?: string | undefined;
    }>, "many">>;
    brief: z.ZodOptional<z.ZodObject<{
        fitVerdict: z.ZodDefault<z.ZodEnum<["good-fit", "cautious", "poor-fit", "unknown"]>>;
        shouldWrite: z.ZodDefault<z.ZodEnum<["yes", "cautious", "no"]>>;
        buyerTypeDetail: z.ZodDefault<z.ZodString>;
        purchaseIntentSignal: z.ZodDefault<z.ZodString>;
        bestOutreachPath: z.ZodDefault<z.ZodString>;
        mainRisk: z.ZodDefault<z.ZodString>;
        recommendedContactRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        outreachAngles: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            whyItFits: z.ZodDefault<z.ZodString>;
            buyerConcern: z.ZodDefault<z.ZodString>;
            evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            riskLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
        }, "strict", z.ZodTypeAny, {
            name: string;
            whyItFits: string;
            buyerConcern: string;
            evidence: string[];
            claimsToAvoid: string[];
            riskLevel: "low" | "medium" | "high";
        }, {
            name: string;
            whyItFits?: string | undefined;
            buyerConcern?: string | undefined;
            evidence?: string[] | undefined;
            claimsToAvoid?: string[] | undefined;
            riskLevel?: "low" | "medium" | "high" | undefined;
        }>, "many">>;
        bestAngle: z.ZodDefault<z.ZodString>;
        handoffBrief: z.ZodDefault<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        claimsToAvoid: string[];
        fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
        shouldWrite: "cautious" | "yes" | "no";
        buyerTypeDetail: string;
        purchaseIntentSignal: string;
        bestOutreachPath: string;
        mainRisk: string;
        recommendedContactRoles: string[];
        outreachAngles: {
            name: string;
            whyItFits: string;
            buyerConcern: string;
            evidence: string[];
            claimsToAvoid: string[];
            riskLevel: "low" | "medium" | "high";
        }[];
        bestAngle: string;
        handoffBrief: string;
    }, {
        claimsToAvoid?: string[] | undefined;
        fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
        shouldWrite?: "cautious" | "yes" | "no" | undefined;
        buyerTypeDetail?: string | undefined;
        purchaseIntentSignal?: string | undefined;
        bestOutreachPath?: string | undefined;
        mainRisk?: string | undefined;
        recommendedContactRoles?: string[] | undefined;
        outreachAngles?: {
            name: string;
            whyItFits?: string | undefined;
            buyerConcern?: string | undefined;
            evidence?: string[] | undefined;
            claimsToAvoid?: string[] | undefined;
            riskLevel?: "low" | "medium" | "high" | undefined;
        }[] | undefined;
        bestAngle?: string | undefined;
        handoffBrief?: string | undefined;
    }>>;
    textPreview: z.ZodDefault<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    description: string;
    textPreview: string;
    createdAt: string;
    website: string;
    title: string;
    companyName: string;
    industry: string;
    buyerType: string;
    confidenceScore: number;
    evidence: {
        label: string;
        value: string;
        sourceUrl: string;
        snippet: string;
    }[];
    depth: "deep" | "adaptive" | "quick" | "standard";
    productSignals: string[];
    buyingSignals: string[];
    painSignals: string[];
    recommendedAngle: string;
    inferredNeed: string;
    fetchedUrls: string[];
    brief?: {
        claimsToAvoid: string[];
        fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
        shouldWrite: "cautious" | "yes" | "no";
        buyerTypeDetail: string;
        purchaseIntentSignal: string;
        bestOutreachPath: string;
        mainRisk: string;
        recommendedContactRoles: string[];
        outreachAngles: {
            name: string;
            whyItFits: string;
            buyerConcern: string;
            evidence: string[];
            claimsToAvoid: string[];
            riskLevel: "low" | "medium" | "high";
        }[];
        bestAngle: string;
        handoffBrief: string;
    } | undefined;
    error?: string | undefined;
}, {
    createdAt: string;
    website: string;
    companyName: string;
    description?: string | undefined;
    textPreview?: string | undefined;
    title?: string | undefined;
    industry?: string | undefined;
    buyerType?: string | undefined;
    confidenceScore?: number | undefined;
    evidence?: {
        label: string;
        value: string;
        sourceUrl: string;
        snippet?: string | undefined;
    }[] | undefined;
    depth?: "deep" | "adaptive" | "quick" | "standard" | undefined;
    productSignals?: string[] | undefined;
    buyingSignals?: string[] | undefined;
    painSignals?: string[] | undefined;
    recommendedAngle?: string | undefined;
    inferredNeed?: string | undefined;
    fetchedUrls?: string[] | undefined;
    brief?: {
        claimsToAvoid?: string[] | undefined;
        fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
        shouldWrite?: "cautious" | "yes" | "no" | undefined;
        buyerTypeDetail?: string | undefined;
        purchaseIntentSignal?: string | undefined;
        bestOutreachPath?: string | undefined;
        mainRisk?: string | undefined;
        recommendedContactRoles?: string[] | undefined;
        outreachAngles?: {
            name: string;
            whyItFits?: string | undefined;
            buyerConcern?: string | undefined;
            evidence?: string[] | undefined;
            claimsToAvoid?: string[] | undefined;
            riskLevel?: "low" | "medium" | "high" | undefined;
        }[] | undefined;
        bestAngle?: string | undefined;
        handoffBrief?: string | undefined;
    } | undefined;
    error?: string | undefined;
}>;
export declare const GeneratedIcpSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    industrySegment: z.ZodDefault<z.ZodString>;
    companyCharacteristics: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    buyerRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    buyingBehavior: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    painPoints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    triggerEvents: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    salesAngles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    id: string;
    name: string;
    buyerRoles: string[];
    painPoints: string[];
    triggerEvents: string[];
    industrySegment: string;
    companyCharacteristics: string[];
    buyingBehavior: string[];
    salesAngles: string[];
}, {
    id: string;
    name: string;
    buyerRoles?: string[] | undefined;
    painPoints?: string[] | undefined;
    triggerEvents?: string[] | undefined;
    industrySegment?: string | undefined;
    companyCharacteristics?: string[] | undefined;
    buyingBehavior?: string[] | undefined;
    salesAngles?: string[] | undefined;
}>;
export declare const GeneratedUspSchema: z.ZodObject<{
    id: z.ZodString;
    category: z.ZodDefault<z.ZodString>;
    headline: z.ZodString;
    buyerAngle: z.ZodDefault<z.ZodString>;
    proof: z.ZodDefault<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    id: string;
    category: string;
    headline: string;
    buyerAngle: string;
    proof: string;
}, {
    id: string;
    headline: string;
    category?: string | undefined;
    buyerAngle?: string | undefined;
    proof?: string | undefined;
}>;
export declare const EmailSequenceDraftStatusSchema: z.ZodEnum<["draft", "sent", "failed"]>;
export declare const EmailSequenceDraftSchema: z.ZodObject<{
    id: z.ZodString;
    draftId: z.ZodOptional<z.ZodString>;
    step: z.ZodNumber;
    delayDays: z.ZodDefault<z.ZodNumber>;
    strategy: z.ZodString;
    subject: z.ZodString;
    body: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["draft", "sent", "failed"]>>;
    qualityReview: z.ZodOptional<z.ZodObject<{
        score: z.ZodNumber;
        passed: z.ZodBoolean;
        level: z.ZodEnum<["pass", "needs-work", "blocked"]>;
        summary: z.ZodDefault<z.ZodString>;
        checks: z.ZodArray<z.ZodObject<{
            id: z.ZodEnum<["buyerReason", "humanTone", "personalized", "nextStep", "twoSecondRead"]>;
            label: z.ZodString;
            passed: z.ZodBoolean;
            score: z.ZodNumber;
            message: z.ZodDefault<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            message: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
        }, {
            label: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
            message?: string | undefined;
        }>, "many">;
        issues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        rewriteHints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        reviewedAt: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        issues: string[];
        checks: {
            label: string;
            message: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
        }[];
        level: "pass" | "blocked" | "needs-work";
        score: number;
        passed: boolean;
        summary: string;
        rewriteHints: string[];
        reviewedAt: string;
    }, {
        checks: {
            label: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
            message?: string | undefined;
        }[];
        level: "pass" | "blocked" | "needs-work";
        score: number;
        passed: boolean;
        reviewedAt: string;
        issues?: string[] | undefined;
        summary?: string | undefined;
        rewriteHints?: string[] | undefined;
    }>>;
    evidenceMap: z.ZodOptional<z.ZodObject<{
        status: z.ZodDefault<z.ZodEnum<["success", "need_more_data"]>>;
        minimumDataAvailable: z.ZodDefault<z.ZodBoolean>;
        verifiedFacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
            label: z.ZodString;
            value: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            snippet: z.ZodDefault<z.ZodString>;
            usedInEmail: z.ZodDefault<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }, {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }>, "many">>;
        inferredInsights: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
            label: z.ZodString;
            value: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            snippet: z.ZodDefault<z.ZodString>;
            usedInEmail: z.ZodDefault<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }, {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }>, "many">>;
        genericContext: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
            label: z.ZodString;
            value: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            snippet: z.ZodDefault<z.ZodString>;
            usedInEmail: z.ZodDefault<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }, {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }>, "many">>;
        prohibitedClaims: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
            label: z.ZodString;
            value: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
            sourceUrl: z.ZodOptional<z.ZodString>;
            snippet: z.ZodDefault<z.ZodString>;
            usedInEmail: z.ZodDefault<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }, {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }>, "many">>;
        missingFields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        createdAt: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        status: "success" | "need_more_data";
        minimumDataAvailable: boolean;
        verifiedFacts: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        inferredInsights: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        genericContext: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        prohibitedClaims: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        missingFields: string[];
        createdAt?: string | undefined;
    }, {
        status?: "success" | "need_more_data" | undefined;
        createdAt?: string | undefined;
        minimumDataAvailable?: boolean | undefined;
        verifiedFacts?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        inferredInsights?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        genericContext?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        prohibitedClaims?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        missingFields?: string[] | undefined;
    }>>;
    strategyMatch: z.ZodOptional<z.ZodObject<{
        personaId: z.ZodOptional<z.ZodString>;
        uspId: z.ZodOptional<z.ZodString>;
        ctaAssetId: z.ZodOptional<z.ZodString>;
        buyerPain: z.ZodDefault<z.ZodString>;
        buyerImplication: z.ZodDefault<z.ZodString>;
        selectedUsp: z.ZodDefault<z.ZodString>;
        microOffer: z.ZodDefault<z.ZodString>;
        rationale: z.ZodDefault<z.ZodString>;
        confidenceScore: z.ZodDefault<z.ZodNumber>;
        evidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        warnings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        buyerPain: string;
        buyerImplication: string;
        selectedUsp: string;
        microOffer: string;
        rationale: string;
        confidenceScore: number;
        evidenceIds: string[];
        warnings: string[];
        personaId?: string | undefined;
        uspId?: string | undefined;
        ctaAssetId?: string | undefined;
    }, {
        personaId?: string | undefined;
        uspId?: string | undefined;
        ctaAssetId?: string | undefined;
        buyerPain?: string | undefined;
        buyerImplication?: string | undefined;
        selectedUsp?: string | undefined;
        microOffer?: string | undefined;
        rationale?: string | undefined;
        confidenceScore?: number | undefined;
        evidenceIds?: string[] | undefined;
        warnings?: string[] | undefined;
    }>>;
    sendRiskReview: z.ZodOptional<z.ZodObject<{
        score: z.ZodNumber;
        passed: z.ZodBoolean;
        level: z.ZodEnum<["pass", "warning", "blocked"]>;
        issues: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            severity: z.ZodEnum<["info", "warning", "block"]>;
            message: z.ZodString;
            blocking: z.ZodDefault<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking: boolean;
        }, {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking?: boolean | undefined;
        }>, "many">>;
        checkedAt: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        issues: {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking: boolean;
        }[];
        level: "warning" | "pass" | "blocked";
        score: number;
        passed: boolean;
        checkedAt: string;
    }, {
        level: "warning" | "pass" | "blocked";
        score: number;
        passed: boolean;
        checkedAt: string;
        issues?: {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking?: boolean | undefined;
        }[] | undefined;
    }>>;
    researchBrief: z.ZodOptional<z.ZodObject<{
        fitVerdict: z.ZodDefault<z.ZodEnum<["good-fit", "cautious", "poor-fit", "unknown"]>>;
        shouldWrite: z.ZodDefault<z.ZodEnum<["yes", "cautious", "no"]>>;
        buyerTypeDetail: z.ZodDefault<z.ZodString>;
        purchaseIntentSignal: z.ZodDefault<z.ZodString>;
        bestOutreachPath: z.ZodDefault<z.ZodString>;
        mainRisk: z.ZodDefault<z.ZodString>;
        recommendedContactRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        outreachAngles: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            whyItFits: z.ZodDefault<z.ZodString>;
            buyerConcern: z.ZodDefault<z.ZodString>;
            evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            riskLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
        }, "strict", z.ZodTypeAny, {
            name: string;
            whyItFits: string;
            buyerConcern: string;
            evidence: string[];
            claimsToAvoid: string[];
            riskLevel: "low" | "medium" | "high";
        }, {
            name: string;
            whyItFits?: string | undefined;
            buyerConcern?: string | undefined;
            evidence?: string[] | undefined;
            claimsToAvoid?: string[] | undefined;
            riskLevel?: "low" | "medium" | "high" | undefined;
        }>, "many">>;
        bestAngle: z.ZodDefault<z.ZodString>;
        handoffBrief: z.ZodDefault<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        claimsToAvoid: string[];
        fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
        shouldWrite: "cautious" | "yes" | "no";
        buyerTypeDetail: string;
        purchaseIntentSignal: string;
        bestOutreachPath: string;
        mainRisk: string;
        recommendedContactRoles: string[];
        outreachAngles: {
            name: string;
            whyItFits: string;
            buyerConcern: string;
            evidence: string[];
            claimsToAvoid: string[];
            riskLevel: "low" | "medium" | "high";
        }[];
        bestAngle: string;
        handoffBrief: string;
    }, {
        claimsToAvoid?: string[] | undefined;
        fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
        shouldWrite?: "cautious" | "yes" | "no" | undefined;
        buyerTypeDetail?: string | undefined;
        purchaseIntentSignal?: string | undefined;
        bestOutreachPath?: string | undefined;
        mainRisk?: string | undefined;
        recommendedContactRoles?: string[] | undefined;
        outreachAngles?: {
            name: string;
            whyItFits?: string | undefined;
            buyerConcern?: string | undefined;
            evidence?: string[] | undefined;
            claimsToAvoid?: string[] | undefined;
            riskLevel?: "low" | "medium" | "high" | undefined;
        }[] | undefined;
        bestAngle?: string | undefined;
        handoffBrief?: string | undefined;
    }>>;
    sentAt: z.ZodOptional<z.ZodString>;
    sendError: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    status: "failed" | "draft" | "sent";
    id: string;
    subject: string;
    body: string;
    step: number;
    delayDays: number;
    strategy: string;
    qualityReview?: {
        issues: string[];
        checks: {
            label: string;
            message: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
        }[];
        level: "pass" | "blocked" | "needs-work";
        score: number;
        passed: boolean;
        summary: string;
        rewriteHints: string[];
        reviewedAt: string;
    } | undefined;
    evidenceMap?: {
        status: "success" | "need_more_data";
        minimumDataAvailable: boolean;
        verifiedFacts: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        inferredInsights: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        genericContext: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        prohibitedClaims: {
            label: string;
            value: string;
            id: string;
            source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
            level: "verified" | "inferred" | "generic" | "prohibited";
            snippet: string;
            usedInEmail: boolean;
            sourceUrl?: string | undefined;
        }[];
        missingFields: string[];
        createdAt?: string | undefined;
    } | undefined;
    strategyMatch?: {
        buyerPain: string;
        buyerImplication: string;
        selectedUsp: string;
        microOffer: string;
        rationale: string;
        confidenceScore: number;
        evidenceIds: string[];
        warnings: string[];
        personaId?: string | undefined;
        uspId?: string | undefined;
        ctaAssetId?: string | undefined;
    } | undefined;
    sendRiskReview?: {
        issues: {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking: boolean;
        }[];
        level: "warning" | "pass" | "blocked";
        score: number;
        passed: boolean;
        checkedAt: string;
    } | undefined;
    researchBrief?: {
        claimsToAvoid: string[];
        fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
        shouldWrite: "cautious" | "yes" | "no";
        buyerTypeDetail: string;
        purchaseIntentSignal: string;
        bestOutreachPath: string;
        mainRisk: string;
        recommendedContactRoles: string[];
        outreachAngles: {
            name: string;
            whyItFits: string;
            buyerConcern: string;
            evidence: string[];
            claimsToAvoid: string[];
            riskLevel: "low" | "medium" | "high";
        }[];
        bestAngle: string;
        handoffBrief: string;
    } | undefined;
    sentAt?: string | undefined;
    sendError?: string | undefined;
    draftId?: string | undefined;
}, {
    id: string;
    subject: string;
    body: string;
    step: number;
    strategy: string;
    status?: "failed" | "draft" | "sent" | undefined;
    qualityReview?: {
        checks: {
            label: string;
            id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
            score: number;
            passed: boolean;
            message?: string | undefined;
        }[];
        level: "pass" | "blocked" | "needs-work";
        score: number;
        passed: boolean;
        reviewedAt: string;
        issues?: string[] | undefined;
        summary?: string | undefined;
        rewriteHints?: string[] | undefined;
    } | undefined;
    evidenceMap?: {
        status?: "success" | "need_more_data" | undefined;
        createdAt?: string | undefined;
        minimumDataAvailable?: boolean | undefined;
        verifiedFacts?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        inferredInsights?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        genericContext?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        prohibitedClaims?: {
            label: string;
            value: string;
            id: string;
            level: "verified" | "inferred" | "generic" | "prohibited";
            source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
            sourceUrl?: string | undefined;
            snippet?: string | undefined;
            usedInEmail?: boolean | undefined;
        }[] | undefined;
        missingFields?: string[] | undefined;
    } | undefined;
    strategyMatch?: {
        personaId?: string | undefined;
        uspId?: string | undefined;
        ctaAssetId?: string | undefined;
        buyerPain?: string | undefined;
        buyerImplication?: string | undefined;
        selectedUsp?: string | undefined;
        microOffer?: string | undefined;
        rationale?: string | undefined;
        confidenceScore?: number | undefined;
        evidenceIds?: string[] | undefined;
        warnings?: string[] | undefined;
    } | undefined;
    sendRiskReview?: {
        level: "warning" | "pass" | "blocked";
        score: number;
        passed: boolean;
        checkedAt: string;
        issues?: {
            message: string;
            id: string;
            severity: "info" | "warning" | "block";
            blocking?: boolean | undefined;
        }[] | undefined;
    } | undefined;
    researchBrief?: {
        claimsToAvoid?: string[] | undefined;
        fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
        shouldWrite?: "cautious" | "yes" | "no" | undefined;
        buyerTypeDetail?: string | undefined;
        purchaseIntentSignal?: string | undefined;
        bestOutreachPath?: string | undefined;
        mainRisk?: string | undefined;
        recommendedContactRoles?: string[] | undefined;
        outreachAngles?: {
            name: string;
            whyItFits?: string | undefined;
            buyerConcern?: string | undefined;
            evidence?: string[] | undefined;
            claimsToAvoid?: string[] | undefined;
            riskLevel?: "low" | "medium" | "high" | undefined;
        }[] | undefined;
        bestAngle?: string | undefined;
        handoffBrief?: string | undefined;
    } | undefined;
    sentAt?: string | undefined;
    sendError?: string | undefined;
    draftId?: string | undefined;
    delayDays?: number | undefined;
}>;
export declare const OutreachWorkflowSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    leadId: z.ZodString;
    draftId: z.ZodString;
    website: z.ZodString;
    email: z.ZodString;
    language: z.ZodDefault<z.ZodString>;
    tone: z.ZodDefault<z.ZodString>;
    generationMode: z.ZodDefault<z.ZodEnum<["lite", "deep"]>>;
    research: z.ZodObject<{
        website: z.ZodString;
        companyName: z.ZodString;
        depth: z.ZodDefault<z.ZodEnum<["adaptive", "quick", "standard", "deep"]>>;
        confidenceScore: z.ZodDefault<z.ZodNumber>;
        buyerType: z.ZodDefault<z.ZodString>;
        productSignals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        buyingSignals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        painSignals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        recommendedAngle: z.ZodDefault<z.ZodString>;
        industry: z.ZodDefault<z.ZodString>;
        inferredNeed: z.ZodDefault<z.ZodString>;
        title: z.ZodDefault<z.ZodString>;
        description: z.ZodDefault<z.ZodString>;
        fetchedUrls: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        evidence: z.ZodDefault<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            sourceUrl: z.ZodString;
            snippet: z.ZodDefault<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            value: string;
            sourceUrl: string;
            snippet: string;
        }, {
            label: string;
            value: string;
            sourceUrl: string;
            snippet?: string | undefined;
        }>, "many">>;
        brief: z.ZodOptional<z.ZodObject<{
            fitVerdict: z.ZodDefault<z.ZodEnum<["good-fit", "cautious", "poor-fit", "unknown"]>>;
            shouldWrite: z.ZodDefault<z.ZodEnum<["yes", "cautious", "no"]>>;
            buyerTypeDetail: z.ZodDefault<z.ZodString>;
            purchaseIntentSignal: z.ZodDefault<z.ZodString>;
            bestOutreachPath: z.ZodDefault<z.ZodString>;
            mainRisk: z.ZodDefault<z.ZodString>;
            recommendedContactRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            outreachAngles: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                whyItFits: z.ZodDefault<z.ZodString>;
                buyerConcern: z.ZodDefault<z.ZodString>;
                evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                riskLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
            }, "strict", z.ZodTypeAny, {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }, {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }>, "many">>;
            bestAngle: z.ZodDefault<z.ZodString>;
            handoffBrief: z.ZodDefault<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            claimsToAvoid: string[];
            fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
            shouldWrite: "cautious" | "yes" | "no";
            buyerTypeDetail: string;
            purchaseIntentSignal: string;
            bestOutreachPath: string;
            mainRisk: string;
            recommendedContactRoles: string[];
            outreachAngles: {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }[];
            bestAngle: string;
            handoffBrief: string;
        }, {
            claimsToAvoid?: string[] | undefined;
            fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
            shouldWrite?: "cautious" | "yes" | "no" | undefined;
            buyerTypeDetail?: string | undefined;
            purchaseIntentSignal?: string | undefined;
            bestOutreachPath?: string | undefined;
            mainRisk?: string | undefined;
            recommendedContactRoles?: string[] | undefined;
            outreachAngles?: {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }[] | undefined;
            bestAngle?: string | undefined;
            handoffBrief?: string | undefined;
        }>>;
        textPreview: z.ZodDefault<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        description: string;
        textPreview: string;
        createdAt: string;
        website: string;
        title: string;
        companyName: string;
        industry: string;
        buyerType: string;
        confidenceScore: number;
        evidence: {
            label: string;
            value: string;
            sourceUrl: string;
            snippet: string;
        }[];
        depth: "deep" | "adaptive" | "quick" | "standard";
        productSignals: string[];
        buyingSignals: string[];
        painSignals: string[];
        recommendedAngle: string;
        inferredNeed: string;
        fetchedUrls: string[];
        brief?: {
            claimsToAvoid: string[];
            fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
            shouldWrite: "cautious" | "yes" | "no";
            buyerTypeDetail: string;
            purchaseIntentSignal: string;
            bestOutreachPath: string;
            mainRisk: string;
            recommendedContactRoles: string[];
            outreachAngles: {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }[];
            bestAngle: string;
            handoffBrief: string;
        } | undefined;
        error?: string | undefined;
    }, {
        createdAt: string;
        website: string;
        companyName: string;
        description?: string | undefined;
        textPreview?: string | undefined;
        title?: string | undefined;
        industry?: string | undefined;
        buyerType?: string | undefined;
        confidenceScore?: number | undefined;
        evidence?: {
            label: string;
            value: string;
            sourceUrl: string;
            snippet?: string | undefined;
        }[] | undefined;
        depth?: "deep" | "adaptive" | "quick" | "standard" | undefined;
        productSignals?: string[] | undefined;
        buyingSignals?: string[] | undefined;
        painSignals?: string[] | undefined;
        recommendedAngle?: string | undefined;
        inferredNeed?: string | undefined;
        fetchedUrls?: string[] | undefined;
        brief?: {
            claimsToAvoid?: string[] | undefined;
            fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
            shouldWrite?: "cautious" | "yes" | "no" | undefined;
            buyerTypeDetail?: string | undefined;
            purchaseIntentSignal?: string | undefined;
            bestOutreachPath?: string | undefined;
            mainRisk?: string | undefined;
            recommendedContactRoles?: string[] | undefined;
            outreachAngles?: {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }[] | undefined;
            bestAngle?: string | undefined;
            handoffBrief?: string | undefined;
        } | undefined;
        error?: string | undefined;
    }>;
    icps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        industrySegment: z.ZodDefault<z.ZodString>;
        companyCharacteristics: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        buyerRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        buyingBehavior: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        painPoints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        triggerEvents: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        salesAngles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        name: string;
        buyerRoles: string[];
        painPoints: string[];
        triggerEvents: string[];
        industrySegment: string;
        companyCharacteristics: string[];
        buyingBehavior: string[];
        salesAngles: string[];
    }, {
        id: string;
        name: string;
        buyerRoles?: string[] | undefined;
        painPoints?: string[] | undefined;
        triggerEvents?: string[] | undefined;
        industrySegment?: string | undefined;
        companyCharacteristics?: string[] | undefined;
        buyingBehavior?: string[] | undefined;
        salesAngles?: string[] | undefined;
    }>, "many">>;
    usps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        category: z.ZodDefault<z.ZodString>;
        headline: z.ZodString;
        buyerAngle: z.ZodDefault<z.ZodString>;
        proof: z.ZodDefault<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        category: string;
        headline: string;
        buyerAngle: string;
        proof: string;
    }, {
        id: string;
        headline: string;
        category?: string | undefined;
        buyerAngle?: string | undefined;
        proof?: string | undefined;
    }>, "many">>;
    initialEmail: z.ZodObject<{
        id: z.ZodString;
        draftId: z.ZodOptional<z.ZodString>;
        step: z.ZodNumber;
        delayDays: z.ZodDefault<z.ZodNumber>;
        strategy: z.ZodString;
        subject: z.ZodString;
        body: z.ZodString;
        status: z.ZodDefault<z.ZodEnum<["draft", "sent", "failed"]>>;
        qualityReview: z.ZodOptional<z.ZodObject<{
            score: z.ZodNumber;
            passed: z.ZodBoolean;
            level: z.ZodEnum<["pass", "needs-work", "blocked"]>;
            summary: z.ZodDefault<z.ZodString>;
            checks: z.ZodArray<z.ZodObject<{
                id: z.ZodEnum<["buyerReason", "humanTone", "personalized", "nextStep", "twoSecondRead"]>;
                label: z.ZodString;
                passed: z.ZodBoolean;
                score: z.ZodNumber;
                message: z.ZodDefault<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                message: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
            }, {
                label: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
                message?: string | undefined;
            }>, "many">;
            issues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            rewriteHints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            reviewedAt: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            issues: string[];
            checks: {
                label: string;
                message: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            summary: string;
            rewriteHints: string[];
            reviewedAt: string;
        }, {
            checks: {
                label: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
                message?: string | undefined;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            reviewedAt: string;
            issues?: string[] | undefined;
            summary?: string | undefined;
            rewriteHints?: string[] | undefined;
        }>>;
        evidenceMap: z.ZodOptional<z.ZodObject<{
            status: z.ZodDefault<z.ZodEnum<["success", "need_more_data"]>>;
            minimumDataAvailable: z.ZodDefault<z.ZodBoolean>;
            verifiedFacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
                label: z.ZodString;
                value: z.ZodString;
                source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
                sourceUrl: z.ZodOptional<z.ZodString>;
                snippet: z.ZodDefault<z.ZodString>;
                usedInEmail: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }, {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }>, "many">>;
            inferredInsights: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
                label: z.ZodString;
                value: z.ZodString;
                source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
                sourceUrl: z.ZodOptional<z.ZodString>;
                snippet: z.ZodDefault<z.ZodString>;
                usedInEmail: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }, {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }>, "many">>;
            genericContext: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
                label: z.ZodString;
                value: z.ZodString;
                source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
                sourceUrl: z.ZodOptional<z.ZodString>;
                snippet: z.ZodDefault<z.ZodString>;
                usedInEmail: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }, {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }>, "many">>;
            prohibitedClaims: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
                label: z.ZodString;
                value: z.ZodString;
                source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
                sourceUrl: z.ZodOptional<z.ZodString>;
                snippet: z.ZodDefault<z.ZodString>;
                usedInEmail: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }, {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }>, "many">>;
            missingFields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            createdAt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "success" | "need_more_data";
            minimumDataAvailable: boolean;
            verifiedFacts: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            inferredInsights: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            genericContext: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            prohibitedClaims: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            missingFields: string[];
            createdAt?: string | undefined;
        }, {
            status?: "success" | "need_more_data" | undefined;
            createdAt?: string | undefined;
            minimumDataAvailable?: boolean | undefined;
            verifiedFacts?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            inferredInsights?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            genericContext?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            prohibitedClaims?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            missingFields?: string[] | undefined;
        }>>;
        strategyMatch: z.ZodOptional<z.ZodObject<{
            personaId: z.ZodOptional<z.ZodString>;
            uspId: z.ZodOptional<z.ZodString>;
            ctaAssetId: z.ZodOptional<z.ZodString>;
            buyerPain: z.ZodDefault<z.ZodString>;
            buyerImplication: z.ZodDefault<z.ZodString>;
            selectedUsp: z.ZodDefault<z.ZodString>;
            microOffer: z.ZodDefault<z.ZodString>;
            rationale: z.ZodDefault<z.ZodString>;
            confidenceScore: z.ZodDefault<z.ZodNumber>;
            evidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            warnings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strict", z.ZodTypeAny, {
            buyerPain: string;
            buyerImplication: string;
            selectedUsp: string;
            microOffer: string;
            rationale: string;
            confidenceScore: number;
            evidenceIds: string[];
            warnings: string[];
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
        }, {
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
            buyerPain?: string | undefined;
            buyerImplication?: string | undefined;
            selectedUsp?: string | undefined;
            microOffer?: string | undefined;
            rationale?: string | undefined;
            confidenceScore?: number | undefined;
            evidenceIds?: string[] | undefined;
            warnings?: string[] | undefined;
        }>>;
        sendRiskReview: z.ZodOptional<z.ZodObject<{
            score: z.ZodNumber;
            passed: z.ZodBoolean;
            level: z.ZodEnum<["pass", "warning", "blocked"]>;
            issues: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                severity: z.ZodEnum<["info", "warning", "block"]>;
                message: z.ZodString;
                blocking: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking: boolean;
            }, {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking?: boolean | undefined;
            }>, "many">>;
            checkedAt: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            issues: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking: boolean;
            }[];
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
        }, {
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
            issues?: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking?: boolean | undefined;
            }[] | undefined;
        }>>;
        researchBrief: z.ZodOptional<z.ZodObject<{
            fitVerdict: z.ZodDefault<z.ZodEnum<["good-fit", "cautious", "poor-fit", "unknown"]>>;
            shouldWrite: z.ZodDefault<z.ZodEnum<["yes", "cautious", "no"]>>;
            buyerTypeDetail: z.ZodDefault<z.ZodString>;
            purchaseIntentSignal: z.ZodDefault<z.ZodString>;
            bestOutreachPath: z.ZodDefault<z.ZodString>;
            mainRisk: z.ZodDefault<z.ZodString>;
            recommendedContactRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            outreachAngles: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                whyItFits: z.ZodDefault<z.ZodString>;
                buyerConcern: z.ZodDefault<z.ZodString>;
                evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                riskLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
            }, "strict", z.ZodTypeAny, {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }, {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }>, "many">>;
            bestAngle: z.ZodDefault<z.ZodString>;
            handoffBrief: z.ZodDefault<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            claimsToAvoid: string[];
            fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
            shouldWrite: "cautious" | "yes" | "no";
            buyerTypeDetail: string;
            purchaseIntentSignal: string;
            bestOutreachPath: string;
            mainRisk: string;
            recommendedContactRoles: string[];
            outreachAngles: {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }[];
            bestAngle: string;
            handoffBrief: string;
        }, {
            claimsToAvoid?: string[] | undefined;
            fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
            shouldWrite?: "cautious" | "yes" | "no" | undefined;
            buyerTypeDetail?: string | undefined;
            purchaseIntentSignal?: string | undefined;
            bestOutreachPath?: string | undefined;
            mainRisk?: string | undefined;
            recommendedContactRoles?: string[] | undefined;
            outreachAngles?: {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }[] | undefined;
            bestAngle?: string | undefined;
            handoffBrief?: string | undefined;
        }>>;
        sentAt: z.ZodOptional<z.ZodString>;
        sendError: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        status: "failed" | "draft" | "sent";
        id: string;
        subject: string;
        body: string;
        step: number;
        delayDays: number;
        strategy: string;
        qualityReview?: {
            issues: string[];
            checks: {
                label: string;
                message: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            summary: string;
            rewriteHints: string[];
            reviewedAt: string;
        } | undefined;
        evidenceMap?: {
            status: "success" | "need_more_data";
            minimumDataAvailable: boolean;
            verifiedFacts: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            inferredInsights: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            genericContext: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            prohibitedClaims: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            missingFields: string[];
            createdAt?: string | undefined;
        } | undefined;
        strategyMatch?: {
            buyerPain: string;
            buyerImplication: string;
            selectedUsp: string;
            microOffer: string;
            rationale: string;
            confidenceScore: number;
            evidenceIds: string[];
            warnings: string[];
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
        } | undefined;
        sendRiskReview?: {
            issues: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking: boolean;
            }[];
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
        } | undefined;
        researchBrief?: {
            claimsToAvoid: string[];
            fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
            shouldWrite: "cautious" | "yes" | "no";
            buyerTypeDetail: string;
            purchaseIntentSignal: string;
            bestOutreachPath: string;
            mainRisk: string;
            recommendedContactRoles: string[];
            outreachAngles: {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }[];
            bestAngle: string;
            handoffBrief: string;
        } | undefined;
        sentAt?: string | undefined;
        sendError?: string | undefined;
        draftId?: string | undefined;
    }, {
        id: string;
        subject: string;
        body: string;
        step: number;
        strategy: string;
        status?: "failed" | "draft" | "sent" | undefined;
        qualityReview?: {
            checks: {
                label: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
                message?: string | undefined;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            reviewedAt: string;
            issues?: string[] | undefined;
            summary?: string | undefined;
            rewriteHints?: string[] | undefined;
        } | undefined;
        evidenceMap?: {
            status?: "success" | "need_more_data" | undefined;
            createdAt?: string | undefined;
            minimumDataAvailable?: boolean | undefined;
            verifiedFacts?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            inferredInsights?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            genericContext?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            prohibitedClaims?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            missingFields?: string[] | undefined;
        } | undefined;
        strategyMatch?: {
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
            buyerPain?: string | undefined;
            buyerImplication?: string | undefined;
            selectedUsp?: string | undefined;
            microOffer?: string | undefined;
            rationale?: string | undefined;
            confidenceScore?: number | undefined;
            evidenceIds?: string[] | undefined;
            warnings?: string[] | undefined;
        } | undefined;
        sendRiskReview?: {
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
            issues?: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking?: boolean | undefined;
            }[] | undefined;
        } | undefined;
        researchBrief?: {
            claimsToAvoid?: string[] | undefined;
            fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
            shouldWrite?: "cautious" | "yes" | "no" | undefined;
            buyerTypeDetail?: string | undefined;
            purchaseIntentSignal?: string | undefined;
            bestOutreachPath?: string | undefined;
            mainRisk?: string | undefined;
            recommendedContactRoles?: string[] | undefined;
            outreachAngles?: {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }[] | undefined;
            bestAngle?: string | undefined;
            handoffBrief?: string | undefined;
        } | undefined;
        sentAt?: string | undefined;
        sendError?: string | undefined;
        draftId?: string | undefined;
        delayDays?: number | undefined;
    }>;
    followUps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        draftId: z.ZodOptional<z.ZodString>;
        step: z.ZodNumber;
        delayDays: z.ZodDefault<z.ZodNumber>;
        strategy: z.ZodString;
        subject: z.ZodString;
        body: z.ZodString;
        status: z.ZodDefault<z.ZodEnum<["draft", "sent", "failed"]>>;
        qualityReview: z.ZodOptional<z.ZodObject<{
            score: z.ZodNumber;
            passed: z.ZodBoolean;
            level: z.ZodEnum<["pass", "needs-work", "blocked"]>;
            summary: z.ZodDefault<z.ZodString>;
            checks: z.ZodArray<z.ZodObject<{
                id: z.ZodEnum<["buyerReason", "humanTone", "personalized", "nextStep", "twoSecondRead"]>;
                label: z.ZodString;
                passed: z.ZodBoolean;
                score: z.ZodNumber;
                message: z.ZodDefault<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                message: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
            }, {
                label: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
                message?: string | undefined;
            }>, "many">;
            issues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            rewriteHints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            reviewedAt: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            issues: string[];
            checks: {
                label: string;
                message: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            summary: string;
            rewriteHints: string[];
            reviewedAt: string;
        }, {
            checks: {
                label: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
                message?: string | undefined;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            reviewedAt: string;
            issues?: string[] | undefined;
            summary?: string | undefined;
            rewriteHints?: string[] | undefined;
        }>>;
        evidenceMap: z.ZodOptional<z.ZodObject<{
            status: z.ZodDefault<z.ZodEnum<["success", "need_more_data"]>>;
            minimumDataAvailable: z.ZodDefault<z.ZodBoolean>;
            verifiedFacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
                label: z.ZodString;
                value: z.ZodString;
                source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
                sourceUrl: z.ZodOptional<z.ZodString>;
                snippet: z.ZodDefault<z.ZodString>;
                usedInEmail: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }, {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }>, "many">>;
            inferredInsights: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
                label: z.ZodString;
                value: z.ZodString;
                source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
                sourceUrl: z.ZodOptional<z.ZodString>;
                snippet: z.ZodDefault<z.ZodString>;
                usedInEmail: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }, {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }>, "many">>;
            genericContext: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
                label: z.ZodString;
                value: z.ZodString;
                source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
                sourceUrl: z.ZodOptional<z.ZodString>;
                snippet: z.ZodDefault<z.ZodString>;
                usedInEmail: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }, {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }>, "many">>;
            prohibitedClaims: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                level: z.ZodEnum<["verified", "inferred", "generic", "prohibited"]>;
                label: z.ZodString;
                value: z.ZodString;
                source: z.ZodDefault<z.ZodEnum<["lead", "website", "company-profile", "material", "model", "user"]>>;
                sourceUrl: z.ZodOptional<z.ZodString>;
                snippet: z.ZodDefault<z.ZodString>;
                usedInEmail: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }, {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }>, "many">>;
            missingFields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            createdAt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            status: "success" | "need_more_data";
            minimumDataAvailable: boolean;
            verifiedFacts: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            inferredInsights: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            genericContext: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            prohibitedClaims: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            missingFields: string[];
            createdAt?: string | undefined;
        }, {
            status?: "success" | "need_more_data" | undefined;
            createdAt?: string | undefined;
            minimumDataAvailable?: boolean | undefined;
            verifiedFacts?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            inferredInsights?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            genericContext?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            prohibitedClaims?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            missingFields?: string[] | undefined;
        }>>;
        strategyMatch: z.ZodOptional<z.ZodObject<{
            personaId: z.ZodOptional<z.ZodString>;
            uspId: z.ZodOptional<z.ZodString>;
            ctaAssetId: z.ZodOptional<z.ZodString>;
            buyerPain: z.ZodDefault<z.ZodString>;
            buyerImplication: z.ZodDefault<z.ZodString>;
            selectedUsp: z.ZodDefault<z.ZodString>;
            microOffer: z.ZodDefault<z.ZodString>;
            rationale: z.ZodDefault<z.ZodString>;
            confidenceScore: z.ZodDefault<z.ZodNumber>;
            evidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            warnings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strict", z.ZodTypeAny, {
            buyerPain: string;
            buyerImplication: string;
            selectedUsp: string;
            microOffer: string;
            rationale: string;
            confidenceScore: number;
            evidenceIds: string[];
            warnings: string[];
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
        }, {
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
            buyerPain?: string | undefined;
            buyerImplication?: string | undefined;
            selectedUsp?: string | undefined;
            microOffer?: string | undefined;
            rationale?: string | undefined;
            confidenceScore?: number | undefined;
            evidenceIds?: string[] | undefined;
            warnings?: string[] | undefined;
        }>>;
        sendRiskReview: z.ZodOptional<z.ZodObject<{
            score: z.ZodNumber;
            passed: z.ZodBoolean;
            level: z.ZodEnum<["pass", "warning", "blocked"]>;
            issues: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                severity: z.ZodEnum<["info", "warning", "block"]>;
                message: z.ZodString;
                blocking: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking: boolean;
            }, {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking?: boolean | undefined;
            }>, "many">>;
            checkedAt: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            issues: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking: boolean;
            }[];
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
        }, {
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
            issues?: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking?: boolean | undefined;
            }[] | undefined;
        }>>;
        researchBrief: z.ZodOptional<z.ZodObject<{
            fitVerdict: z.ZodDefault<z.ZodEnum<["good-fit", "cautious", "poor-fit", "unknown"]>>;
            shouldWrite: z.ZodDefault<z.ZodEnum<["yes", "cautious", "no"]>>;
            buyerTypeDetail: z.ZodDefault<z.ZodString>;
            purchaseIntentSignal: z.ZodDefault<z.ZodString>;
            bestOutreachPath: z.ZodDefault<z.ZodString>;
            mainRisk: z.ZodDefault<z.ZodString>;
            recommendedContactRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            outreachAngles: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                whyItFits: z.ZodDefault<z.ZodString>;
                buyerConcern: z.ZodDefault<z.ZodString>;
                evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                claimsToAvoid: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                riskLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
            }, "strict", z.ZodTypeAny, {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }, {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }>, "many">>;
            bestAngle: z.ZodDefault<z.ZodString>;
            handoffBrief: z.ZodDefault<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            claimsToAvoid: string[];
            fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
            shouldWrite: "cautious" | "yes" | "no";
            buyerTypeDetail: string;
            purchaseIntentSignal: string;
            bestOutreachPath: string;
            mainRisk: string;
            recommendedContactRoles: string[];
            outreachAngles: {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }[];
            bestAngle: string;
            handoffBrief: string;
        }, {
            claimsToAvoid?: string[] | undefined;
            fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
            shouldWrite?: "cautious" | "yes" | "no" | undefined;
            buyerTypeDetail?: string | undefined;
            purchaseIntentSignal?: string | undefined;
            bestOutreachPath?: string | undefined;
            mainRisk?: string | undefined;
            recommendedContactRoles?: string[] | undefined;
            outreachAngles?: {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }[] | undefined;
            bestAngle?: string | undefined;
            handoffBrief?: string | undefined;
        }>>;
        sentAt: z.ZodOptional<z.ZodString>;
        sendError: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        status: "failed" | "draft" | "sent";
        id: string;
        subject: string;
        body: string;
        step: number;
        delayDays: number;
        strategy: string;
        qualityReview?: {
            issues: string[];
            checks: {
                label: string;
                message: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            summary: string;
            rewriteHints: string[];
            reviewedAt: string;
        } | undefined;
        evidenceMap?: {
            status: "success" | "need_more_data";
            minimumDataAvailable: boolean;
            verifiedFacts: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            inferredInsights: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            genericContext: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            prohibitedClaims: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            missingFields: string[];
            createdAt?: string | undefined;
        } | undefined;
        strategyMatch?: {
            buyerPain: string;
            buyerImplication: string;
            selectedUsp: string;
            microOffer: string;
            rationale: string;
            confidenceScore: number;
            evidenceIds: string[];
            warnings: string[];
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
        } | undefined;
        sendRiskReview?: {
            issues: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking: boolean;
            }[];
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
        } | undefined;
        researchBrief?: {
            claimsToAvoid: string[];
            fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
            shouldWrite: "cautious" | "yes" | "no";
            buyerTypeDetail: string;
            purchaseIntentSignal: string;
            bestOutreachPath: string;
            mainRisk: string;
            recommendedContactRoles: string[];
            outreachAngles: {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }[];
            bestAngle: string;
            handoffBrief: string;
        } | undefined;
        sentAt?: string | undefined;
        sendError?: string | undefined;
        draftId?: string | undefined;
    }, {
        id: string;
        subject: string;
        body: string;
        step: number;
        strategy: string;
        status?: "failed" | "draft" | "sent" | undefined;
        qualityReview?: {
            checks: {
                label: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
                message?: string | undefined;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            reviewedAt: string;
            issues?: string[] | undefined;
            summary?: string | undefined;
            rewriteHints?: string[] | undefined;
        } | undefined;
        evidenceMap?: {
            status?: "success" | "need_more_data" | undefined;
            createdAt?: string | undefined;
            minimumDataAvailable?: boolean | undefined;
            verifiedFacts?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            inferredInsights?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            genericContext?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            prohibitedClaims?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            missingFields?: string[] | undefined;
        } | undefined;
        strategyMatch?: {
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
            buyerPain?: string | undefined;
            buyerImplication?: string | undefined;
            selectedUsp?: string | undefined;
            microOffer?: string | undefined;
            rationale?: string | undefined;
            confidenceScore?: number | undefined;
            evidenceIds?: string[] | undefined;
            warnings?: string[] | undefined;
        } | undefined;
        sendRiskReview?: {
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
            issues?: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking?: boolean | undefined;
            }[] | undefined;
        } | undefined;
        researchBrief?: {
            claimsToAvoid?: string[] | undefined;
            fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
            shouldWrite?: "cautious" | "yes" | "no" | undefined;
            buyerTypeDetail?: string | undefined;
            purchaseIntentSignal?: string | undefined;
            bestOutreachPath?: string | undefined;
            mainRisk?: string | undefined;
            recommendedContactRoles?: string[] | undefined;
            outreachAngles?: {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }[] | undefined;
            bestAngle?: string | undefined;
            handoffBrief?: string | undefined;
        } | undefined;
        sentAt?: string | undefined;
        sendError?: string | undefined;
        draftId?: string | undefined;
        delayDays?: number | undefined;
    }>, "many">>;
    promptSnapshot: z.ZodDefault<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    usage: z.ZodOptional<z.ZodObject<{
        inputTokens: z.ZodDefault<z.ZodNumber>;
        outputTokens: z.ZodDefault<z.ZodNumber>;
        totalTokens: z.ZodDefault<z.ZodNumber>;
        estimatedCostUsd: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCostUsd?: number | undefined;
    }, {
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
        totalTokens?: number | undefined;
        estimatedCostUsd?: number | undefined;
    }>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    website: string;
    language: string;
    email: string;
    leadId: string;
    tone: string;
    generationMode: "lite" | "deep";
    promptSnapshot: string;
    draftId: string;
    research: {
        description: string;
        textPreview: string;
        createdAt: string;
        website: string;
        title: string;
        companyName: string;
        industry: string;
        buyerType: string;
        confidenceScore: number;
        evidence: {
            label: string;
            value: string;
            sourceUrl: string;
            snippet: string;
        }[];
        depth: "deep" | "adaptive" | "quick" | "standard";
        productSignals: string[];
        buyingSignals: string[];
        painSignals: string[];
        recommendedAngle: string;
        inferredNeed: string;
        fetchedUrls: string[];
        brief?: {
            claimsToAvoid: string[];
            fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
            shouldWrite: "cautious" | "yes" | "no";
            buyerTypeDetail: string;
            purchaseIntentSignal: string;
            bestOutreachPath: string;
            mainRisk: string;
            recommendedContactRoles: string[];
            outreachAngles: {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }[];
            bestAngle: string;
            handoffBrief: string;
        } | undefined;
        error?: string | undefined;
    };
    icps: {
        id: string;
        name: string;
        buyerRoles: string[];
        painPoints: string[];
        triggerEvents: string[];
        industrySegment: string;
        companyCharacteristics: string[];
        buyingBehavior: string[];
        salesAngles: string[];
    }[];
    usps: {
        id: string;
        category: string;
        headline: string;
        buyerAngle: string;
        proof: string;
    }[];
    initialEmail: {
        status: "failed" | "draft" | "sent";
        id: string;
        subject: string;
        body: string;
        step: number;
        delayDays: number;
        strategy: string;
        qualityReview?: {
            issues: string[];
            checks: {
                label: string;
                message: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            summary: string;
            rewriteHints: string[];
            reviewedAt: string;
        } | undefined;
        evidenceMap?: {
            status: "success" | "need_more_data";
            minimumDataAvailable: boolean;
            verifiedFacts: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            inferredInsights: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            genericContext: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            prohibitedClaims: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            missingFields: string[];
            createdAt?: string | undefined;
        } | undefined;
        strategyMatch?: {
            buyerPain: string;
            buyerImplication: string;
            selectedUsp: string;
            microOffer: string;
            rationale: string;
            confidenceScore: number;
            evidenceIds: string[];
            warnings: string[];
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
        } | undefined;
        sendRiskReview?: {
            issues: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking: boolean;
            }[];
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
        } | undefined;
        researchBrief?: {
            claimsToAvoid: string[];
            fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
            shouldWrite: "cautious" | "yes" | "no";
            buyerTypeDetail: string;
            purchaseIntentSignal: string;
            bestOutreachPath: string;
            mainRisk: string;
            recommendedContactRoles: string[];
            outreachAngles: {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }[];
            bestAngle: string;
            handoffBrief: string;
        } | undefined;
        sentAt?: string | undefined;
        sendError?: string | undefined;
        draftId?: string | undefined;
    };
    followUps: {
        status: "failed" | "draft" | "sent";
        id: string;
        subject: string;
        body: string;
        step: number;
        delayDays: number;
        strategy: string;
        qualityReview?: {
            issues: string[];
            checks: {
                label: string;
                message: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            summary: string;
            rewriteHints: string[];
            reviewedAt: string;
        } | undefined;
        evidenceMap?: {
            status: "success" | "need_more_data";
            minimumDataAvailable: boolean;
            verifiedFacts: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            inferredInsights: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            genericContext: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            prohibitedClaims: {
                label: string;
                value: string;
                id: string;
                source: "company-profile" | "model" | "website" | "user" | "lead" | "material";
                level: "verified" | "inferred" | "generic" | "prohibited";
                snippet: string;
                usedInEmail: boolean;
                sourceUrl?: string | undefined;
            }[];
            missingFields: string[];
            createdAt?: string | undefined;
        } | undefined;
        strategyMatch?: {
            buyerPain: string;
            buyerImplication: string;
            selectedUsp: string;
            microOffer: string;
            rationale: string;
            confidenceScore: number;
            evidenceIds: string[];
            warnings: string[];
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
        } | undefined;
        sendRiskReview?: {
            issues: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking: boolean;
            }[];
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
        } | undefined;
        researchBrief?: {
            claimsToAvoid: string[];
            fitVerdict: "unknown" | "good-fit" | "cautious" | "poor-fit";
            shouldWrite: "cautious" | "yes" | "no";
            buyerTypeDetail: string;
            purchaseIntentSignal: string;
            bestOutreachPath: string;
            mainRisk: string;
            recommendedContactRoles: string[];
            outreachAngles: {
                name: string;
                whyItFits: string;
                buyerConcern: string;
                evidence: string[];
                claimsToAvoid: string[];
                riskLevel: "low" | "medium" | "high";
            }[];
            bestAngle: string;
            handoffBrief: string;
        } | undefined;
        sentAt?: string | undefined;
        sendError?: string | undefined;
        draftId?: string | undefined;
    }[];
    providerId?: string | undefined;
    model?: string | undefined;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCostUsd?: number | undefined;
    } | undefined;
    profileId?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    website: string;
    email: string;
    leadId: string;
    draftId: string;
    research: {
        createdAt: string;
        website: string;
        companyName: string;
        description?: string | undefined;
        textPreview?: string | undefined;
        title?: string | undefined;
        industry?: string | undefined;
        buyerType?: string | undefined;
        confidenceScore?: number | undefined;
        evidence?: {
            label: string;
            value: string;
            sourceUrl: string;
            snippet?: string | undefined;
        }[] | undefined;
        depth?: "deep" | "adaptive" | "quick" | "standard" | undefined;
        productSignals?: string[] | undefined;
        buyingSignals?: string[] | undefined;
        painSignals?: string[] | undefined;
        recommendedAngle?: string | undefined;
        inferredNeed?: string | undefined;
        fetchedUrls?: string[] | undefined;
        brief?: {
            claimsToAvoid?: string[] | undefined;
            fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
            shouldWrite?: "cautious" | "yes" | "no" | undefined;
            buyerTypeDetail?: string | undefined;
            purchaseIntentSignal?: string | undefined;
            bestOutreachPath?: string | undefined;
            mainRisk?: string | undefined;
            recommendedContactRoles?: string[] | undefined;
            outreachAngles?: {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }[] | undefined;
            bestAngle?: string | undefined;
            handoffBrief?: string | undefined;
        } | undefined;
        error?: string | undefined;
    };
    initialEmail: {
        id: string;
        subject: string;
        body: string;
        step: number;
        strategy: string;
        status?: "failed" | "draft" | "sent" | undefined;
        qualityReview?: {
            checks: {
                label: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
                message?: string | undefined;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            reviewedAt: string;
            issues?: string[] | undefined;
            summary?: string | undefined;
            rewriteHints?: string[] | undefined;
        } | undefined;
        evidenceMap?: {
            status?: "success" | "need_more_data" | undefined;
            createdAt?: string | undefined;
            minimumDataAvailable?: boolean | undefined;
            verifiedFacts?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            inferredInsights?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            genericContext?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            prohibitedClaims?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            missingFields?: string[] | undefined;
        } | undefined;
        strategyMatch?: {
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
            buyerPain?: string | undefined;
            buyerImplication?: string | undefined;
            selectedUsp?: string | undefined;
            microOffer?: string | undefined;
            rationale?: string | undefined;
            confidenceScore?: number | undefined;
            evidenceIds?: string[] | undefined;
            warnings?: string[] | undefined;
        } | undefined;
        sendRiskReview?: {
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
            issues?: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking?: boolean | undefined;
            }[] | undefined;
        } | undefined;
        researchBrief?: {
            claimsToAvoid?: string[] | undefined;
            fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
            shouldWrite?: "cautious" | "yes" | "no" | undefined;
            buyerTypeDetail?: string | undefined;
            purchaseIntentSignal?: string | undefined;
            bestOutreachPath?: string | undefined;
            mainRisk?: string | undefined;
            recommendedContactRoles?: string[] | undefined;
            outreachAngles?: {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }[] | undefined;
            bestAngle?: string | undefined;
            handoffBrief?: string | undefined;
        } | undefined;
        sentAt?: string | undefined;
        sendError?: string | undefined;
        draftId?: string | undefined;
        delayDays?: number | undefined;
    };
    providerId?: string | undefined;
    model?: string | undefined;
    language?: string | undefined;
    usage?: {
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
        totalTokens?: number | undefined;
        estimatedCostUsd?: number | undefined;
    } | undefined;
    profileId?: string | undefined;
    tone?: string | undefined;
    generationMode?: "lite" | "deep" | undefined;
    promptSnapshot?: string | undefined;
    icps?: {
        id: string;
        name: string;
        buyerRoles?: string[] | undefined;
        painPoints?: string[] | undefined;
        triggerEvents?: string[] | undefined;
        industrySegment?: string | undefined;
        companyCharacteristics?: string[] | undefined;
        buyingBehavior?: string[] | undefined;
        salesAngles?: string[] | undefined;
    }[] | undefined;
    usps?: {
        id: string;
        headline: string;
        category?: string | undefined;
        buyerAngle?: string | undefined;
        proof?: string | undefined;
    }[] | undefined;
    followUps?: {
        id: string;
        subject: string;
        body: string;
        step: number;
        strategy: string;
        status?: "failed" | "draft" | "sent" | undefined;
        qualityReview?: {
            checks: {
                label: string;
                id: "buyerReason" | "humanTone" | "personalized" | "nextStep" | "twoSecondRead";
                score: number;
                passed: boolean;
                message?: string | undefined;
            }[];
            level: "pass" | "blocked" | "needs-work";
            score: number;
            passed: boolean;
            reviewedAt: string;
            issues?: string[] | undefined;
            summary?: string | undefined;
            rewriteHints?: string[] | undefined;
        } | undefined;
        evidenceMap?: {
            status?: "success" | "need_more_data" | undefined;
            createdAt?: string | undefined;
            minimumDataAvailable?: boolean | undefined;
            verifiedFacts?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            inferredInsights?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            genericContext?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            prohibitedClaims?: {
                label: string;
                value: string;
                id: string;
                level: "verified" | "inferred" | "generic" | "prohibited";
                source?: "company-profile" | "model" | "website" | "user" | "lead" | "material" | undefined;
                sourceUrl?: string | undefined;
                snippet?: string | undefined;
                usedInEmail?: boolean | undefined;
            }[] | undefined;
            missingFields?: string[] | undefined;
        } | undefined;
        strategyMatch?: {
            personaId?: string | undefined;
            uspId?: string | undefined;
            ctaAssetId?: string | undefined;
            buyerPain?: string | undefined;
            buyerImplication?: string | undefined;
            selectedUsp?: string | undefined;
            microOffer?: string | undefined;
            rationale?: string | undefined;
            confidenceScore?: number | undefined;
            evidenceIds?: string[] | undefined;
            warnings?: string[] | undefined;
        } | undefined;
        sendRiskReview?: {
            level: "warning" | "pass" | "blocked";
            score: number;
            passed: boolean;
            checkedAt: string;
            issues?: {
                message: string;
                id: string;
                severity: "info" | "warning" | "block";
                blocking?: boolean | undefined;
            }[] | undefined;
        } | undefined;
        researchBrief?: {
            claimsToAvoid?: string[] | undefined;
            fitVerdict?: "unknown" | "good-fit" | "cautious" | "poor-fit" | undefined;
            shouldWrite?: "cautious" | "yes" | "no" | undefined;
            buyerTypeDetail?: string | undefined;
            purchaseIntentSignal?: string | undefined;
            bestOutreachPath?: string | undefined;
            mainRisk?: string | undefined;
            recommendedContactRoles?: string[] | undefined;
            outreachAngles?: {
                name: string;
                whyItFits?: string | undefined;
                buyerConcern?: string | undefined;
                evidence?: string[] | undefined;
                claimsToAvoid?: string[] | undefined;
                riskLevel?: "low" | "medium" | "high" | undefined;
            }[] | undefined;
            bestAngle?: string | undefined;
            handoffBrief?: string | undefined;
        } | undefined;
        sentAt?: string | undefined;
        sendError?: string | undefined;
        draftId?: string | undefined;
        delayDays?: number | undefined;
    }[] | undefined;
}>;
export declare const OutreachCampaignStatusSchema: z.ZodEnum<["draft", "generating", "ready", "sending", "paused", "completed", "failed", "stopped"]>;
export declare const OutreachCampaignRecipientStatusSchema: z.ZodEnum<["pending", "researching", "generated", "approved", "queued", "sending", "sent", "replied", "bounced", "unsubscribed", "stopped", "failed", "skipped"]>;
export declare const OutreachCampaignRateLimitSchema: z.ZodObject<{
    maxPerHour: z.ZodDefault<z.ZodNumber>;
    minDelayMinutes: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    maxPerHour: number;
    minDelayMinutes: number;
}, {
    maxPerHour?: number | undefined;
    minDelayMinutes?: number | undefined;
}>;
export declare const OutreachCampaignStatsSchema: z.ZodObject<{
    total: z.ZodDefault<z.ZodNumber>;
    pending: z.ZodDefault<z.ZodNumber>;
    researching: z.ZodDefault<z.ZodNumber>;
    generated: z.ZodDefault<z.ZodNumber>;
    approved: z.ZodDefault<z.ZodNumber>;
    queued: z.ZodDefault<z.ZodNumber>;
    sending: z.ZodDefault<z.ZodNumber>;
    sent: z.ZodDefault<z.ZodNumber>;
    replied: z.ZodDefault<z.ZodNumber>;
    bounced: z.ZodDefault<z.ZodNumber>;
    unsubscribed: z.ZodDefault<z.ZodNumber>;
    stopped: z.ZodDefault<z.ZodNumber>;
    failed: z.ZodDefault<z.ZodNumber>;
    skipped: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    generated: number;
    failed: number;
    stopped: number;
    bounced: number;
    unsubscribed: number;
    sent: number;
    sending: number;
    pending: number;
    researching: number;
    approved: number;
    queued: number;
    replied: number;
    skipped: number;
    total: number;
}, {
    generated?: number | undefined;
    failed?: number | undefined;
    stopped?: number | undefined;
    bounced?: number | undefined;
    unsubscribed?: number | undefined;
    sent?: number | undefined;
    sending?: number | undefined;
    pending?: number | undefined;
    researching?: number | undefined;
    approved?: number | undefined;
    queued?: number | undefined;
    replied?: number | undefined;
    skipped?: number | undefined;
    total?: number | undefined;
}>;
export declare const OutreachCampaignSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodString;
    name: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    senderAccountId: z.ZodOptional<z.ZodString>;
    mode: z.ZodDefault<z.ZodLiteral<"first-email-only">>;
    status: z.ZodDefault<z.ZodEnum<["draft", "generating", "ready", "sending", "paused", "completed", "failed", "stopped"]>>;
    language: z.ZodDefault<z.ZodString>;
    tone: z.ZodDefault<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    generationMode: z.ZodDefault<z.ZodEnum<["lite", "deep"]>>;
    researchDepth: z.ZodDefault<z.ZodEnum<["adaptive", "quick", "standard", "deep"]>>;
    rateLimit: z.ZodDefault<z.ZodObject<{
        maxPerHour: z.ZodDefault<z.ZodNumber>;
        minDelayMinutes: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        maxPerHour: number;
        minDelayMinutes: number;
    }, {
        maxPerHour?: number | undefined;
        minDelayMinutes?: number | undefined;
    }>>;
    stats: z.ZodDefault<z.ZodObject<{
        total: z.ZodDefault<z.ZodNumber>;
        pending: z.ZodDefault<z.ZodNumber>;
        researching: z.ZodDefault<z.ZodNumber>;
        generated: z.ZodDefault<z.ZodNumber>;
        approved: z.ZodDefault<z.ZodNumber>;
        queued: z.ZodDefault<z.ZodNumber>;
        sending: z.ZodDefault<z.ZodNumber>;
        sent: z.ZodDefault<z.ZodNumber>;
        replied: z.ZodDefault<z.ZodNumber>;
        bounced: z.ZodDefault<z.ZodNumber>;
        unsubscribed: z.ZodDefault<z.ZodNumber>;
        stopped: z.ZodDefault<z.ZodNumber>;
        failed: z.ZodDefault<z.ZodNumber>;
        skipped: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        generated: number;
        failed: number;
        stopped: number;
        bounced: number;
        unsubscribed: number;
        sent: number;
        sending: number;
        pending: number;
        researching: number;
        approved: number;
        queued: number;
        replied: number;
        skipped: number;
        total: number;
    }, {
        generated?: number | undefined;
        failed?: number | undefined;
        stopped?: number | undefined;
        bounced?: number | undefined;
        unsubscribed?: number | undefined;
        sent?: number | undefined;
        sending?: number | undefined;
        pending?: number | undefined;
        researching?: number | undefined;
        approved?: number | undefined;
        queued?: number | undefined;
        replied?: number | undefined;
        skipped?: number | undefined;
        total?: number | undefined;
    }>>;
    startedAt: z.ZodOptional<z.ZodString>;
    pausedAt: z.ZodOptional<z.ZodString>;
    completedAt: z.ZodOptional<z.ZodString>;
    stoppedAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    status: "failed" | "ready" | "stopped" | "draft" | "generating" | "sending" | "paused" | "completed";
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    language: string;
    profileId: string;
    tone: string;
    generationMode: "lite" | "deep";
    mode: "first-email-only";
    researchDepth: "deep" | "adaptive" | "quick" | "standard";
    rateLimit: {
        maxPerHour: number;
        minDelayMinutes: number;
    };
    stats: {
        generated: number;
        failed: number;
        stopped: number;
        bounced: number;
        unsubscribed: number;
        sent: number;
        sending: number;
        pending: number;
        researching: number;
        approved: number;
        queued: number;
        replied: number;
        skipped: number;
        total: number;
    };
    providerId?: string | undefined;
    model?: string | undefined;
    senderAccountId?: string | undefined;
    startedAt?: string | undefined;
    pausedAt?: string | undefined;
    completedAt?: string | undefined;
    stoppedAt?: string | undefined;
}, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    profileId: string;
    status?: "failed" | "ready" | "stopped" | "draft" | "generating" | "sending" | "paused" | "completed" | undefined;
    description?: string | undefined;
    providerId?: string | undefined;
    model?: string | undefined;
    language?: string | undefined;
    tone?: string | undefined;
    generationMode?: "lite" | "deep" | undefined;
    senderAccountId?: string | undefined;
    mode?: "first-email-only" | undefined;
    researchDepth?: "deep" | "adaptive" | "quick" | "standard" | undefined;
    rateLimit?: {
        maxPerHour?: number | undefined;
        minDelayMinutes?: number | undefined;
    } | undefined;
    stats?: {
        generated?: number | undefined;
        failed?: number | undefined;
        stopped?: number | undefined;
        bounced?: number | undefined;
        unsubscribed?: number | undefined;
        sent?: number | undefined;
        sending?: number | undefined;
        pending?: number | undefined;
        researching?: number | undefined;
        approved?: number | undefined;
        queued?: number | undefined;
        replied?: number | undefined;
        skipped?: number | undefined;
        total?: number | undefined;
    } | undefined;
    startedAt?: string | undefined;
    pausedAt?: string | undefined;
    completedAt?: string | undefined;
    stoppedAt?: string | undefined;
}>;
export declare const OutreachCampaignRecipientSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodString;
    campaignId: z.ZodString;
    leadId: z.ZodString;
    workflowId: z.ZodOptional<z.ZodString>;
    initialDraftId: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    companyName: z.ZodString;
    website: z.ZodString;
    contactName: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    contactTitle: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    status: z.ZodDefault<z.ZodEnum<["pending", "researching", "generated", "approved", "queued", "sending", "sent", "replied", "bounced", "unsubscribed", "stopped", "failed", "skipped"]>>;
    researchSummary: z.ZodOptional<z.ZodObject<{
        depth: z.ZodDefault<z.ZodEnum<["adaptive", "quick", "standard", "deep"]>>;
        confidenceScore: z.ZodDefault<z.ZodNumber>;
        buyerType: z.ZodDefault<z.ZodString>;
        likelyNeed: z.ZodDefault<z.ZodString>;
        primaryAngle: z.ZodDefault<z.ZodString>;
        riskNotes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        checkedPages: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        buyerType: string;
        confidenceScore: number;
        depth: "deep" | "adaptive" | "quick" | "standard";
        likelyNeed: string;
        primaryAngle: string;
        riskNotes: string[];
        checkedPages: number;
    }, {
        buyerType?: string | undefined;
        confidenceScore?: number | undefined;
        depth?: "deep" | "adaptive" | "quick" | "standard" | undefined;
        likelyNeed?: string | undefined;
        primaryAngle?: string | undefined;
        riskNotes?: string[] | undefined;
        checkedPages?: number | undefined;
    }>>;
    approvedAt: z.ZodOptional<z.ZodString>;
    queuedAt: z.ZodOptional<z.ZodString>;
    sentAt: z.ZodOptional<z.ZodString>;
    repliedAt: z.ZodOptional<z.ZodString>;
    bouncedAt: z.ZodOptional<z.ZodString>;
    unsubscribedAt: z.ZodOptional<z.ZodString>;
    stoppedAt: z.ZodOptional<z.ZodString>;
    lastInboxEventAt: z.ZodOptional<z.ZodString>;
    stopReason: z.ZodOptional<z.ZodString>;
    skippedAt: z.ZodOptional<z.ZodString>;
    sendError: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    status: "generated" | "failed" | "stopped" | "bounced" | "unsubscribed" | "sent" | "sending" | "pending" | "researching" | "approved" | "queued" | "replied" | "skipped";
    id: string;
    createdAt: string;
    updatedAt: string;
    website: string;
    profileId: string;
    companyName: string;
    email: string;
    leadId: string;
    campaignId: string;
    contactName?: string | undefined;
    contactTitle?: string | undefined;
    sentAt?: string | undefined;
    sendError?: string | undefined;
    stoppedAt?: string | undefined;
    workflowId?: string | undefined;
    initialDraftId?: string | undefined;
    researchSummary?: {
        buyerType: string;
        confidenceScore: number;
        depth: "deep" | "adaptive" | "quick" | "standard";
        likelyNeed: string;
        primaryAngle: string;
        riskNotes: string[];
        checkedPages: number;
    } | undefined;
    approvedAt?: string | undefined;
    queuedAt?: string | undefined;
    repliedAt?: string | undefined;
    bouncedAt?: string | undefined;
    unsubscribedAt?: string | undefined;
    lastInboxEventAt?: string | undefined;
    stopReason?: string | undefined;
    skippedAt?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    website: string;
    profileId: string;
    companyName: string;
    email: string;
    leadId: string;
    campaignId: string;
    status?: "generated" | "failed" | "stopped" | "bounced" | "unsubscribed" | "sent" | "sending" | "pending" | "researching" | "approved" | "queued" | "replied" | "skipped" | undefined;
    contactName?: unknown;
    contactTitle?: unknown;
    sentAt?: string | undefined;
    sendError?: string | undefined;
    stoppedAt?: string | undefined;
    workflowId?: string | undefined;
    initialDraftId?: string | undefined;
    researchSummary?: {
        buyerType?: string | undefined;
        confidenceScore?: number | undefined;
        depth?: "deep" | "adaptive" | "quick" | "standard" | undefined;
        likelyNeed?: string | undefined;
        primaryAngle?: string | undefined;
        riskNotes?: string[] | undefined;
        checkedPages?: number | undefined;
    } | undefined;
    approvedAt?: string | undefined;
    queuedAt?: string | undefined;
    repliedAt?: string | undefined;
    bouncedAt?: string | undefined;
    unsubscribedAt?: string | undefined;
    lastInboxEventAt?: string | undefined;
    stopReason?: string | undefined;
    skippedAt?: string | undefined;
}>;
export declare const OutreachFollowUpStatusSchema: z.ZodEnum<["scheduled", "ready", "sending", "sent", "failed", "stopped"]>;
export declare const OutreachFollowUpModeSchema: z.ZodEnum<["confirm", "auto"]>;
export declare const OutreachFollowUpJobSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodString;
    campaignId: z.ZodString;
    recipientId: z.ZodString;
    leadId: z.ZodString;
    workflowId: z.ZodString;
    draftId: z.ZodString;
    senderAccountId: z.ZodString;
    step: z.ZodNumber;
    mode: z.ZodDefault<z.ZodEnum<["confirm", "auto"]>>;
    status: z.ZodDefault<z.ZodEnum<["scheduled", "ready", "sending", "sent", "failed", "stopped"]>>;
    email: z.ZodString;
    companyName: z.ZodString;
    subject: z.ZodString;
    body: z.ZodString;
    sendAt: z.ZodString;
    readyAt: z.ZodOptional<z.ZodString>;
    sentAt: z.ZodOptional<z.ZodString>;
    stoppedAt: z.ZodOptional<z.ZodString>;
    stopReason: z.ZodOptional<z.ZodString>;
    sendError: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    status: "failed" | "ready" | "stopped" | "sent" | "sending" | "scheduled";
    id: string;
    createdAt: string;
    updatedAt: string;
    profileId: string;
    companyName: string;
    email: string;
    subject: string;
    body: string;
    leadId: string;
    draftId: string;
    step: number;
    senderAccountId: string;
    mode: "confirm" | "auto";
    campaignId: string;
    workflowId: string;
    recipientId: string;
    sendAt: string;
    sentAt?: string | undefined;
    sendError?: string | undefined;
    stoppedAt?: string | undefined;
    stopReason?: string | undefined;
    readyAt?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    profileId: string;
    companyName: string;
    email: string;
    subject: string;
    body: string;
    leadId: string;
    draftId: string;
    step: number;
    senderAccountId: string;
    campaignId: string;
    workflowId: string;
    recipientId: string;
    sendAt: string;
    status?: "failed" | "ready" | "stopped" | "sent" | "sending" | "scheduled" | undefined;
    sentAt?: string | undefined;
    sendError?: string | undefined;
    mode?: "confirm" | "auto" | undefined;
    stoppedAt?: string | undefined;
    stopReason?: string | undefined;
    readyAt?: string | undefined;
}>;
export declare const OutreachFeedbackSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    targetType: z.ZodDefault<z.ZodEnum<["draft", "workflow", "campaign", "recipient", "general"]>>;
    targetId: z.ZodOptional<z.ZodString>;
    rating: z.ZodNumber;
    category: z.ZodDefault<z.ZodEnum<["good", "too-generic", "wrong-context", "too-long", "not-my-company", "other"]>>;
    comment: z.ZodDefault<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["new", "valuable", "archived"]>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    status: "new" | "valuable" | "archived";
    id: string;
    category: "other" | "good" | "too-generic" | "wrong-context" | "too-long" | "not-my-company";
    createdAt: string;
    updatedAt: string;
    targetType: "draft" | "workflow" | "campaign" | "recipient" | "general";
    rating: number;
    comment: string;
    profileId?: string | undefined;
    targetId?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    rating: number;
    status?: "new" | "valuable" | "archived" | undefined;
    category?: "other" | "good" | "too-generic" | "wrong-context" | "too-long" | "not-my-company" | undefined;
    profileId?: string | undefined;
    targetType?: "draft" | "workflow" | "campaign" | "recipient" | "general" | undefined;
    targetId?: string | undefined;
    comment?: string | undefined;
}>;
export declare const JobStatusSchema: z.ZodEnum<["active", "paused"]>;
export declare const JobRunStatusSchema: z.ZodEnum<["queued", "running", "succeeded", "failed", "skipped"]>;
export declare const JobRunTriggerSchema: z.ZodEnum<["manual", "schedule"]>;
export declare const JobScheduleSchema: z.ZodObject<{
    expression: z.ZodString;
    timezone: z.ZodDefault<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    expression: string;
    timezone: string;
}, {
    expression: string;
    timezone?: string | undefined;
}>;
export declare const JobTaskSchema: z.ZodObject<{
    type: z.ZodDefault<z.ZodLiteral<"chat-prompt">>;
    prompt: z.ZodString;
    agentId: z.ZodOptional<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    materialIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    type: "chat-prompt";
    prompt: string;
    materialIds: string[];
    providerId?: string | undefined;
    model?: string | undefined;
    agentId?: string | undefined;
}, {
    prompt: string;
    type?: "chat-prompt" | undefined;
    providerId?: string | undefined;
    model?: string | undefined;
    agentId?: string | undefined;
    materialIds?: string[] | undefined;
}>;
export declare const JobRecordSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    schedule: z.ZodObject<{
        expression: z.ZodString;
        timezone: z.ZodDefault<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        expression: string;
        timezone: string;
    }, {
        expression: string;
        timezone?: string | undefined;
    }>;
    status: z.ZodDefault<z.ZodEnum<["active", "paused"]>>;
    task: z.ZodObject<{
        type: z.ZodDefault<z.ZodLiteral<"chat-prompt">>;
        prompt: z.ZodString;
        agentId: z.ZodOptional<z.ZodString>;
        providerId: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        materialIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        type: "chat-prompt";
        prompt: string;
        materialIds: string[];
        providerId?: string | undefined;
        model?: string | undefined;
        agentId?: string | undefined;
    }, {
        prompt: string;
        type?: "chat-prompt" | undefined;
        providerId?: string | undefined;
        model?: string | undefined;
        agentId?: string | undefined;
        materialIds?: string[] | undefined;
    }>;
    nextRunAt: z.ZodOptional<z.ZodString>;
    lastRunAt: z.ZodOptional<z.ZodString>;
    deletedAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    status: "paused" | "active";
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    schedule: {
        expression: string;
        timezone: string;
    };
    task: {
        type: "chat-prompt";
        prompt: string;
        materialIds: string[];
        providerId?: string | undefined;
        model?: string | undefined;
        agentId?: string | undefined;
    };
    profileId?: string | undefined;
    nextRunAt?: string | undefined;
    lastRunAt?: string | undefined;
    deletedAt?: string | undefined;
}, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    schedule: {
        expression: string;
        timezone?: string | undefined;
    };
    task: {
        prompt: string;
        type?: "chat-prompt" | undefined;
        providerId?: string | undefined;
        model?: string | undefined;
        agentId?: string | undefined;
        materialIds?: string[] | undefined;
    };
    status?: "paused" | "active" | undefined;
    description?: string | undefined;
    profileId?: string | undefined;
    nextRunAt?: string | undefined;
    lastRunAt?: string | undefined;
    deletedAt?: string | undefined;
}>;
export declare const JobRunRecordSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    jobId: z.ZodString;
    trigger: z.ZodEnum<["manual", "schedule"]>;
    status: z.ZodEnum<["queued", "running", "succeeded", "failed", "skipped"]>;
    startedAt: z.ZodString;
    finishedAt: z.ZodOptional<z.ZodString>;
    input: z.ZodOptional<z.ZodString>;
    outputPreview: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    usage: z.ZodOptional<z.ZodObject<{
        inputTokens: z.ZodDefault<z.ZodNumber>;
        outputTokens: z.ZodDefault<z.ZodNumber>;
        totalTokens: z.ZodDefault<z.ZodNumber>;
        estimatedCostUsd: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCostUsd?: number | undefined;
    }, {
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
        totalTokens?: number | undefined;
        estimatedCostUsd?: number | undefined;
    }>>;
    model: z.ZodOptional<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    status: "failed" | "running" | "queued" | "skipped" | "succeeded";
    id: string;
    startedAt: string;
    jobId: string;
    trigger: "manual" | "schedule";
    providerId?: string | undefined;
    model?: string | undefined;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCostUsd?: number | undefined;
    } | undefined;
    profileId?: string | undefined;
    error?: string | undefined;
    finishedAt?: string | undefined;
    input?: string | undefined;
    outputPreview?: string | undefined;
}, {
    status: "failed" | "running" | "queued" | "skipped" | "succeeded";
    id: string;
    startedAt: string;
    jobId: string;
    trigger: "manual" | "schedule";
    providerId?: string | undefined;
    model?: string | undefined;
    usage?: {
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
        totalTokens?: number | undefined;
        estimatedCostUsd?: number | undefined;
    } | undefined;
    profileId?: string | undefined;
    error?: string | undefined;
    finishedAt?: string | undefined;
    input?: string | undefined;
    outputPreview?: string | undefined;
}>;
export declare const ChannelKindSchema: z.ZodEnum<["telegram", "discord", "slack", "whatsapp", "matrix", "feishu", "wechat", "wecom"]>;
export declare const ChannelStatusSchema: z.ZodEnum<["disabled", "needs-setup", "connected", "failed"]>;
export declare const ChannelRecordSchema: z.ZodObject<{
    id: z.ZodString;
    profileId: z.ZodOptional<z.ZodString>;
    kind: z.ZodEnum<["telegram", "discord", "slack", "whatsapp", "matrix", "feishu", "wechat", "wecom"]>;
    label: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
    status: z.ZodDefault<z.ZodEnum<["disabled", "needs-setup", "connected", "failed"]>>;
    endpoint: z.ZodOptional<z.ZodString>;
    secretRef: z.ZodOptional<z.ZodString>;
    secretPreview: z.ZodOptional<z.ZodString>;
    config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    lastTestedAt: z.ZodOptional<z.ZodString>;
    lastError: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    label: string;
    status: "failed" | "disabled" | "needs-setup" | "connected";
    id: string;
    createdAt: string;
    updatedAt: string;
    kind: "telegram" | "discord" | "slack" | "whatsapp" | "matrix" | "feishu" | "wechat" | "wecom";
    enabled: boolean;
    config: Record<string, unknown>;
    profileId?: string | undefined;
    lastTestedAt?: string | undefined;
    lastError?: string | undefined;
    endpoint?: string | undefined;
    secretRef?: string | undefined;
    secretPreview?: string | undefined;
}, {
    label: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    kind: "telegram" | "discord" | "slack" | "whatsapp" | "matrix" | "feishu" | "wechat" | "wecom";
    status?: "failed" | "disabled" | "needs-setup" | "connected" | undefined;
    enabled?: boolean | undefined;
    profileId?: string | undefined;
    lastTestedAt?: string | undefined;
    lastError?: string | undefined;
    endpoint?: string | undefined;
    secretRef?: string | undefined;
    secretPreview?: string | undefined;
    config?: Record<string, unknown> | undefined;
}>;
export declare const LogLevelSchema: z.ZodEnum<["debug", "info", "warn", "error", "done"]>;
export declare const LogSourceSchema: z.ZodEnum<["server", "job", "channel", "gateway", "install"]>;
export declare const LogEntrySchema: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodEnum<["server", "job", "channel", "gateway", "install"]>;
    fileId: z.ZodOptional<z.ZodString>;
    line: z.ZodOptional<z.ZodNumber>;
    level: z.ZodEnum<["debug", "info", "warn", "error", "done"]>;
    message: z.ZodString;
    createdAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    message: string;
    id: string;
    source: "gateway" | "channel" | "server" | "job" | "install";
    level: "info" | "error" | "debug" | "warn" | "done";
    createdAt?: string | undefined;
    fileId?: string | undefined;
    line?: number | undefined;
}, {
    message: string;
    id: string;
    source: "gateway" | "channel" | "server" | "job" | "install";
    level: "info" | "error" | "debug" | "warn" | "done";
    createdAt?: string | undefined;
    fileId?: string | undefined;
    line?: number | undefined;
}>;
export type InstallRequest = z.infer<typeof InstallRequestSchema>;
export type OnboardingProviderInput = z.infer<typeof OnboardingProviderInputSchema>;
export type OnboardingProviderState = z.infer<typeof OnboardingProviderStateSchema>;
export type OnboardingState = z.infer<typeof OnboardingStateSchema>;
export type OnboardingUpdate = z.infer<typeof OnboardingUpdateSchema>;
//# sourceMappingURL=schemas.d.ts.map