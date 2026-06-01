import type { z } from "zod";
import type { AgentDefinitionSchema, CapabilitySchema, ChatMessageSchema, ChatSessionSchema, KnowledgeFileSchema, ProviderCredentialSchema, RuntimeStatusSchema } from "./schemas.js";
export type AgentCapabilities = z.infer<typeof CapabilitySchema>;
export type KnowledgeFile = z.infer<typeof KnowledgeFileSchema>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export type ProviderCredential = z.infer<typeof ProviderCredentialSchema>;
export type RuntimeStatus = z.infer<typeof RuntimeStatusSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatSession = z.infer<typeof ChatSessionSchema>;
export interface InstallEvent {
    jobId: string;
    level: "info" | "warn" | "error" | "done";
    message: string;
    createdAt: string;
}
//# sourceMappingURL=types.d.ts.map