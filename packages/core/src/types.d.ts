import type { z } from "zod";
import type { AgentDefinitionSchema, AppStateSchema, CapabilitySchema, ChatMessageSchema, ChatSessionSchema, ChannelRecordSchema, CompanyMaterialCategorySchema, CompanyProfileSchema, JobRecordSchema, JobRunRecordSchema, KnowledgeFileSchema, LogEntrySchema, MaterialRecordSchema, MaterialScopeSchema, CustomerResearchSnapshotSchema, EmailSequenceDraftSchema, GeneratedIcpSchema, GeneratedUspSchema, OutreachCampaignRecipientSchema, OutreachCampaignSchema, OutreachDraftSchema, OutreachLeadSchema, OutreachSenderAccountSchema, OutreachWorkflowSchema, ProviderCredentialSchema, RuntimeStatusSchema } from "./schemas.js";
export type AgentCapabilities = z.infer<typeof CapabilitySchema>;
export type KnowledgeFile = z.infer<typeof KnowledgeFileSchema>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export type AppState = z.infer<typeof AppStateSchema>;
export type ProviderCredential = z.infer<typeof ProviderCredentialSchema>;
export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;
export type CompanyMaterialCategory = z.infer<typeof CompanyMaterialCategorySchema>;
export type MaterialScope = z.infer<typeof MaterialScopeSchema>;
export type MaterialRecord = z.infer<typeof MaterialRecordSchema>;
export type RuntimeStatus = z.infer<typeof RuntimeStatusSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatSession = z.infer<typeof ChatSessionSchema>;
export type JobRecord = z.infer<typeof JobRecordSchema>;
export type JobRunRecord = z.infer<typeof JobRunRecordSchema>;
export type ChannelRecord = z.infer<typeof ChannelRecordSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
export type OutreachLead = z.infer<typeof OutreachLeadSchema>;
export type OutreachDraft = z.infer<typeof OutreachDraftSchema>;
export type OutreachSenderAccount = z.infer<typeof OutreachSenderAccountSchema>;
export type CustomerResearchSnapshot = z.infer<typeof CustomerResearchSnapshotSchema>;
export type GeneratedIcp = z.infer<typeof GeneratedIcpSchema>;
export type GeneratedUsp = z.infer<typeof GeneratedUspSchema>;
export type EmailSequenceDraft = z.infer<typeof EmailSequenceDraftSchema>;
export type OutreachWorkflow = z.infer<typeof OutreachWorkflowSchema>;
export type OutreachCampaign = z.infer<typeof OutreachCampaignSchema>;
export type OutreachCampaignRecipient = z.infer<typeof OutreachCampaignRecipientSchema>;
export interface InstallEvent {
    jobId: string;
    level: "info" | "warn" | "error" | "done";
    step?: string;
    progress?: number;
    message: string;
    createdAt: string;
}
//# sourceMappingURL=types.d.ts.map