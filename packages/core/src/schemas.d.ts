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
    status: "active" | "paused";
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
    status?: "active" | "paused" | undefined;
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
    status: "failed" | "running" | "queued" | "succeeded" | "skipped";
    id: string;
    jobId: string;
    trigger: "manual" | "schedule";
    startedAt: string;
    providerId?: string | undefined;
    model?: string | undefined;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCostUsd?: number | undefined;
    } | undefined;
    profileId?: string | undefined;
    finishedAt?: string | undefined;
    input?: string | undefined;
    outputPreview?: string | undefined;
    error?: string | undefined;
}, {
    status: "failed" | "running" | "queued" | "succeeded" | "skipped";
    id: string;
    jobId: string;
    trigger: "manual" | "schedule";
    startedAt: string;
    providerId?: string | undefined;
    model?: string | undefined;
    usage?: {
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
        totalTokens?: number | undefined;
        estimatedCostUsd?: number | undefined;
    } | undefined;
    profileId?: string | undefined;
    finishedAt?: string | undefined;
    input?: string | undefined;
    outputPreview?: string | undefined;
    error?: string | undefined;
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
    endpoint?: string | undefined;
    secretRef?: string | undefined;
    secretPreview?: string | undefined;
    lastTestedAt?: string | undefined;
    lastError?: string | undefined;
}, {
    label: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    kind: "telegram" | "discord" | "slack" | "whatsapp" | "matrix" | "feishu" | "wechat" | "wecom";
    status?: "failed" | "disabled" | "needs-setup" | "connected" | undefined;
    enabled?: boolean | undefined;
    profileId?: string | undefined;
    endpoint?: string | undefined;
    secretRef?: string | undefined;
    secretPreview?: string | undefined;
    config?: Record<string, unknown> | undefined;
    lastTestedAt?: string | undefined;
    lastError?: string | undefined;
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
    level: "error" | "debug" | "info" | "warn" | "done";
    createdAt?: string | undefined;
    fileId?: string | undefined;
    line?: number | undefined;
}, {
    message: string;
    id: string;
    source: "gateway" | "channel" | "server" | "job" | "install";
    level: "error" | "debug" | "info" | "warn" | "done";
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