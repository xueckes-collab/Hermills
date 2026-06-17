import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, Dispatch, FormEvent, KeyboardEvent, ReactNode, SetStateAction } from 'react'
import { motion } from 'motion/react'
import {
  AlertCircle,
  Bot,
  Brain,
  Building2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  Globe2,
  ImageIcon,
  KeyRound,
  Languages,
  ListChecks,
  Mail,
  Menu,
  MessageCircle,
  PanelRightOpen,
  Paperclip,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  UserRound,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { api, fallback } from './api.js'
import type { Agent, AgentInput, AnalyticsSummary, ChatMessage, ChatSession, CloudStatus, CompanyMaterialCategory, CompanyProfile, ComputerControlStatus, CustomerResearchBrief, EmailSequenceDraft, InstallEvent, Material, MaterialPreview, OutreachBuyerPersona, OutreachCampaign, OutreachCampaignRecipient, OutreachCtaAsset, OutreachDraft, OutreachEmailQualityReview, OutreachEmailSignature, OutreachEvidenceItem, OutreachEvidenceLock, OutreachFollowUpJob, OutreachGoldenExample, OutreachLead, OutreachLeadFitScore, OutreachLeadInput, OutreachLearningSignal, OutreachResearchDepth, OutreachSendRiskReview, OutreachSenderAccount, OutreachStrategyMatch, OutreachUspCandidate, OutreachValueMatch, OutreachWorkflow, ProfileState, Provider, RuntimeStatus, RuntimeUpdateCheck, UsageSummary } from './api.js'
import { getUiCopy, normalizeUiLanguage } from './i18n.js'
import type { AssistantRoleCardId, ChatEmptyEntryId, FileActionId, UiCopy, UiLanguage, UiModeId } from './i18n.js'

type AdvancedPanel = 'setup' | 'personalize' | 'company' | 'agents' | 'profiles' | 'keys' | 'diagnostics'
type WorkspaceView = 'chat' | 'outreach'

const advancedItems: Array<{ id: AdvancedPanel; icon: LucideIcon }> = [
  { id: 'setup', icon: Cpu },
  { id: 'personalize', icon: Languages },
  { id: 'company', icon: Building2 },
  { id: 'agents', icon: Bot },
  { id: 'profiles', icon: ShieldCheck },
  { id: 'keys', icon: KeyRound },
  { id: 'diagnostics', icon: Wrench },
]

const simpleAdvancedPanels: AdvancedPanel[] = ['setup', 'personalize', 'company', 'agents', 'keys']

const chatEmptyActions: Array<{ id: ChatEmptyEntryId; icon: LucideIcon }> = [
  { id: 'quickChat', icon: MessageCircle },
  { id: 'companyKnowledge', icon: Building2 },
  { id: 'addFiles', icon: Paperclip },
  { id: 'createAssistant', icon: Bot },
]

const fileActionItems: Array<{ id: FileActionId; icon: LucideIcon }> = [
  { id: 'summarize', icon: FileText },
  { id: 'keyPoints', icon: Search },
  { id: 'askFile', icon: MessageCircle },
  { id: 'actionPlan', icon: ListChecks },
]

const assistantRoleItems: Array<{ id: AssistantRoleCardId; icon: LucideIcon }> = [
  { id: 'study', icon: Brain },
  { id: 'writing', icon: Pencil },
  { id: 'code', icon: Cpu },
  { id: 'files', icon: FileText },
]

const providerPresets = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.5',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai-compatible',
    displayName: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    keyPlaceholder: 'sk-or-...',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai-compatible',
    displayName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-pro',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'claude',
    label: 'Claude',
    kind: 'anthropic',
    displayName: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    keyPlaceholder: 'sk-ant-...',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    kind: 'openai-compatible',
    displayName: 'Alibaba Qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    kind: 'openai-compatible',
    displayName: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2.6',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    kind: 'openai-compatible',
    displayName: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-3.5-flash',
    keyPlaceholder: 'AIza...',
  },
  {
    id: 'zhipu',
    label: 'GLM',
    kind: 'openai-compatible',
    displayName: 'Zhipu GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    keyPlaceholder: 'zhipu key',
  },
  {
    id: 'xiaomi',
    label: 'Xiaomi',
    kind: 'openai-compatible',
    displayName: 'Xiaomi MiMo',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    defaultModel: 'mimo-v2-flash',
    keyPlaceholder: 'xiaomi key',
  },
  {
    id: 'agnes',
    label: 'Agnes',
    kind: 'openai-compatible',
    displayName: 'Agnes AI',
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    defaultModel: 'agnes-2.0-flash',
    keyPlaceholder: 'agnes key',
  },
  {
    id: 'custom',
    label: 'Custom',
    kind: 'openai-compatible',
    displayName: 'Custom provider',
    baseUrl: 'https://provider.example/v1',
    defaultModel: 'model-name',
    keyPlaceholder: 'API key',
  },
] as const

type ProviderKind = 'openai-compatible' | 'openai' | 'anthropic' | 'local'
type ProviderPresetId = (typeof providerPresets)[number]['id']
type SenderProviderId = 'gmail' | 'outlook' | 'tencent' | 'aliyun' | 'zoho' | 'custom'
type SenderChannelId = 'gmailApi' | 'microsoftGraph' | 'zohoApi' | 'smtp' | 'enterpriseApi' | 'customHttpApi'
type ProviderForm = {
  kind: ProviderKind
  displayName: string
  baseUrl: string
  defaultModel: string
  apiKey: string
}

const senderProviderPresets: Array<{ id: SenderProviderId; label: string; host: string; port: string; secure: boolean; imapHost: string; imapPort: string; imapSecure: boolean }> = [
  { id: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: '587', secure: false, imapHost: 'imap.gmail.com', imapPort: '993', imapSecure: true },
  { id: 'outlook', label: 'Outlook', host: 'smtp.office365.com', port: '587', secure: false, imapHost: 'outlook.office365.com', imapPort: '993', imapSecure: true },
  { id: 'tencent', label: 'Tencent', host: 'smtp.exmail.qq.com', port: '465', secure: true, imapHost: 'imap.exmail.qq.com', imapPort: '993', imapSecure: true },
  { id: 'aliyun', label: 'Aliyun', host: 'smtp.mxhichina.com', port: '465', secure: true, imapHost: 'imap.mxhichina.com', imapPort: '993', imapSecure: true },
  { id: 'zoho', label: 'Zoho', host: 'smtp.zoho.com', port: '465', secure: true, imapHost: 'imap.zoho.com', imapPort: '993', imapSecure: true },
  { id: 'custom', label: 'Custom', host: '', port: '587', secure: false, imapHost: '', imapPort: '993', imapSecure: true },
]

const senderChannelOptions: Array<{ id: SenderChannelId; label: string; status: string; detail: string; icon: LucideIcon; smtpPresetId?: SenderProviderId }> = [
  { id: 'gmailApi', label: 'Gmail API', status: '推荐 Gmail', detail: 'OAuth / API 通道，适合 SMTP 授权码失败时切换。', icon: KeyRound, smtpPresetId: 'gmail' },
  { id: 'microsoftGraph', label: 'Microsoft Graph', status: '推荐 Microsoft 365', detail: 'Graph API 通道，适合 Outlook 和企业租户。', icon: Building2, smtpPresetId: 'outlook' },
  { id: 'zohoApi', label: 'Zoho API', status: '推荐 Zoho Mail', detail: 'Zoho API 通道，适合 Zoho SMTP 登录被拦截时切换。', icon: Globe2, smtpPresetId: 'zoho' },
  { id: 'smtp', label: 'SMTP', status: '当前可保存测试', detail: '使用 SMTP / IMAP 主机、端口和授权码。', icon: Mail },
  { id: 'enterpriseApi', label: '企业/云邮件 API', status: '适合企业邮箱', detail: '用于腾讯、阿里、SES、SendGrid 等云邮件 API。', icon: Building2, smtpPresetId: 'custom' },
  { id: 'customHttpApi', label: '自定义 HTTP API', status: '适合自建网关', detail: '用于自有 HTTP 发送接口或邮件网关。', icon: Globe2, smtpPresetId: 'custom' },
]

const senderAuthGuides: Record<SenderProviderId, { url?: string; smtpLabel: string }> = {
  gmail: { url: 'https://myaccount.google.com/apppasswords', smtpLabel: 'smtp.gmail.com:587' },
  outlook: { url: 'https://support.microsoft.com/account-billing/create-app-passwords-from-the-security-info-preview-page-d2bc744a-f33d-483c-923d-9715699958cc', smtpLabel: 'smtp.office365.com:587' },
  tencent: { url: 'https://exmail.qq.com/', smtpLabel: 'smtp.exmail.qq.com:465' },
  aliyun: { url: 'https://qiye.aliyun.com/alimail/', smtpLabel: 'smtp.mxhichina.com:465' },
  zoho: { url: 'https://accounts.zoho.com/userdetails#security/app_password', smtpLabel: 'smtp.zoho.com:465' },
  custom: { smtpLabel: 'SMTP' },
}

type OnboardingStepId = 'language' | 'identity' | 'companyBasics' | 'companyProducts' | 'companyMarket' | 'companyTrust' | 'companyTrade' | 'companyFiles' | 'companyReview' | 'provider' | 'theme' | 'workspace' | 'features'
type OnboardingLanguage = UiLanguage
type OnboardingProviderChoice = ProviderPresetId | 'skip'
type OnboardingTheme = 'night' | 'plain'
type OnboardingFeatureId = 'chat' | 'files' | 'memory' | 'assistants' | 'diagnostics'

type OnboardingProviderInput = {
  id?: string
  kind?: ProviderKind
  displayName: string
  baseUrl?: string
  defaultModel?: string
  apiKey?: string
  enabled?: boolean
}

type OnboardingInput = {
  language: OnboardingLanguage
  userDisplayName: string
  agentName: string
  memoryEnabled: boolean
  provider: OnboardingProviderInput | null
  theme: OnboardingTheme
  workspacePath: string
}

type OnboardingState = Partial<OnboardingInput> & {
  completed: boolean
  onboardingCompletedAt?: string
  defaultAgentId?: string
  features?: OnboardingFeatureId[]
}

type OnboardingApiClient = {
  onboarding: () => Promise<OnboardingState>
  updateOnboarding: (input: Partial<OnboardingInput> & { onboardingCompletedAt?: string | null }) => Promise<OnboardingState>
  completeOnboarding: (input: Partial<OnboardingInput>) => Promise<OnboardingState | void>
}

type OnboardingDraft = Omit<OnboardingInput, 'provider' | 'providerSkipped'> & {
  providerChoice: OnboardingProviderChoice
  provider: ProviderForm
  features: OnboardingFeatureId[]
  company: ReturnType<typeof companyDraftFromProfile>
}

const onboardingSteps: Array<{ id: OnboardingStepId; icon: LucideIcon }> = [
  { id: 'language', icon: Languages },
  { id: 'identity', icon: UserRound },
  { id: 'companyBasics', icon: Building2 },
  { id: 'companyProducts', icon: ListChecks },
  { id: 'companyMarket', icon: Globe2 },
  { id: 'companyTrust', icon: ShieldCheck },
  { id: 'companyTrade', icon: Mail },
  { id: 'companyFiles', icon: Upload },
  { id: 'workspace', icon: FolderOpen },
  { id: 'companyReview', icon: CheckCircle2 },
]

const companyOnboardingSteps: Array<{ id: OnboardingStepId; icon: LucideIcon }> = [
  { id: 'companyBasics', icon: Building2 },
  { id: 'companyProducts', icon: ListChecks },
  { id: 'companyMarket', icon: Globe2 },
  { id: 'companyTrust', icon: ShieldCheck },
  { id: 'companyTrade', icon: Mail },
  { id: 'companyFiles', icon: Upload },
  { id: 'companyReview', icon: CheckCircle2 },
]

function isCompanyOnboardingStep(id: OnboardingStepId): boolean {
  return companyOnboardingSteps.some((item) => item.id === id)
}

const languageOptions: Array<{ id: OnboardingLanguage; label: string }> = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
]

const themeOptions: Array<{ id: OnboardingTheme }> = [
  { id: 'night' },
  { id: 'plain' },
]

const featureOptions: Array<{ id: OnboardingFeatureId; icon: LucideIcon }> = [
  { id: 'chat', icon: MessageCircle },
  { id: 'files', icon: FileText },
  { id: 'memory', icon: Brain },
  { id: 'assistants', icon: Bot },
  { id: 'diagnostics', icon: Wrench },
]

const defaultOnboardingFeatures: OnboardingFeatureId[] = ['chat', 'files', 'memory', 'assistants']

const fallbackOnboarding: OnboardingState = {
  completed: false,
  language: 'zh-CN',
  userDisplayName: '',
  agentName: 'Hermes',
  memoryEnabled: true,
  provider: null,
  theme: 'night',
  workspacePath: '~/Desktop/Hermills-Workspace',
  features: defaultOnboardingFeatures,
}

type AgentForm = {
  name: string
  model: string
  providerId: string
  description: string
  instructions: string
  starters: string
  memory: boolean
  files: boolean
  tools: boolean
  approvals: boolean
}

function createDefaultBuilder(copy: UiCopy): AgentForm {
  return {
    name: copy.assistant.defaultForm.name,
    model: 'hermes-agent',
    providerId: '',
    description: copy.assistant.defaultForm.description,
    instructions: copy.assistant.defaultForm.instructions,
    starters: copy.assistant.defaultForm.starters,
    memory: false,
    files: true,
    tools: false,
    approvals: true,
  }
}

export function getDefaultChatProvider(providers: Provider[]): Provider | undefined {
  return providers.find((provider) => provider.status === 'connected')
}

export function getChatSessionDefaults(agent: Agent | undefined, provider: Provider | undefined): { agentId?: string; providerId?: string; model?: string } {
  if (agent?.providerId) return { agentId: agent.id, providerId: agent.providerId, model: agent.model }
  if (provider) return { agentId: agent?.id, providerId: provider.id, model: provider.defaultModel }
  return { agentId: agent?.id, model: agent?.model }
}

function sessionHasReadyProvider(session: ChatSession | undefined, providers: Provider[]): boolean {
  return Boolean(session?.providerId && providers.some((provider) => provider.id === session.providerId && provider.status === 'connected'))
}

function createAgentTemplates(copy: UiCopy): Array<{ id: string; label: string; description: string; form: AgentForm }> {
  const defaultBuilder = createDefaultBuilder(copy)
  return copy.assistant.templates.map((template) => ({
    id: template.id,
    label: template.label,
    description: template.description,
    form: {
      ...defaultBuilder,
      name: template.form.name,
      description: template.form.description,
      instructions: template.form.instructions,
      starters: template.form.starters,
      tools: template.form.tools ?? defaultBuilder.tools,
      files: template.form.files ?? defaultBuilder.files,
    },
  }))
}

function useEndpoint<T>(loader: () => Promise<T>, fallbackValue: T, enabled = true) {
  const [data, setData] = useState<T>(fallbackValue)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    if (!enabled) {
      setLoading(false)
      setError('')
      return () => {
        alive = false
      }
    }
    setLoading(true)
    loader()
      .then((next) => {
        if (alive) {
          setData(next)
          setError('')
        }
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [enabled, loader])

  return { data, setData, loading, error }
}

function onboardingApi(): Partial<OnboardingApiClient> {
  return api as typeof api & Partial<OnboardingApiClient>
}

async function loadOnboardingState(): Promise<OnboardingState> {
  const client = onboardingApi()
  if (!client.onboarding) return fallbackOnboarding
  return normalizeOnboardingState(await client.onboarding())
}

async function updateOnboardingState(input: Partial<OnboardingInput> & { onboardingCompletedAt?: string | null }): Promise<OnboardingState> {
  const client = onboardingApi()
  if (!client.updateOnboarding) {
    const { onboardingCompletedAt, ...rest } = input
    return normalizeOnboardingState({ ...rest, onboardingCompletedAt: onboardingCompletedAt ?? undefined, completed: false })
  }
  return normalizeOnboardingState(await client.updateOnboarding(input))
}

async function completeOnboardingState(input: Partial<OnboardingInput>): Promise<OnboardingState> {
  const client = onboardingApi()
  if (!client.completeOnboarding) return normalizeOnboardingState({ ...input, completed: true })
  const next = await client.completeOnboarding(input)
  return normalizeOnboardingState({ ...input, ...(next ?? {}), completed: true })
}

function normalizeOnboardingState(state?: Partial<OnboardingState>): OnboardingState {
  return {
    ...fallbackOnboarding,
    ...state,
    language: normalizeUiLanguage(state?.language),
    theme: state?.theme === 'plain' ? 'plain' : 'night',
    completed: Boolean(state?.completed || state?.onboardingCompletedAt),
    features: state?.features?.length ? state.features : defaultOnboardingFeatures,
  }
}

function isProviderPresetId(value: string | undefined): value is ProviderPresetId {
  return providerPresets.some((preset) => preset.id === value)
}

function providerFormFromPreset(id: ProviderPresetId): ProviderForm {
  const preset = providerPresets.find((item) => item.id === id) ?? providerPresets[0]
  return {
    kind: preset.kind,
    displayName: preset.displayName,
    baseUrl: preset.baseUrl,
    defaultModel: preset.defaultModel,
    apiKey: '',
  }
}

function draftFromOnboarding(state: OnboardingState, companyProfile: CompanyProfile = fallback.companyProfile): OnboardingDraft {
  const normalized = normalizeOnboardingState(state)
  const providerPreset = providerPresets.find((preset) => normalized.provider?.baseUrl === preset.baseUrl)?.id
  const providerChoice: OnboardingProviderChoice = normalized.provider ? (providerPreset ?? 'custom') : 'skip'
  const providerDefaults = providerChoice === 'skip' ? providerFormFromPreset('openai') : providerFormFromPreset(providerChoice)

  return {
    language: normalized.language ?? 'zh-CN',
    userDisplayName: normalized.userDisplayName ?? '',
    agentName: normalized.agentName ?? 'Hermes',
    memoryEnabled: normalized.memoryEnabled ?? true,
    providerChoice,
    provider: normalized.provider
      ? {
          kind: normalized.provider.kind ?? providerDefaults.kind,
          displayName: normalized.provider.displayName || providerDefaults.displayName,
          baseUrl: normalized.provider.baseUrl || providerDefaults.baseUrl,
          defaultModel: normalized.provider.defaultModel || providerDefaults.defaultModel,
          apiKey: normalized.provider.apiKey ?? '',
        }
      : providerDefaults,
    theme: normalized.theme ?? 'night',
    workspacePath: normalized.workspacePath ?? '~/Desktop/Hermills-Workspace',
    features: normalized.features?.length ? normalized.features : defaultOnboardingFeatures,
    company: companyDraftFromProfile(companyProfile),
  }
}

function onboardingInputFromDraft(draft: OnboardingDraft): OnboardingInput {
  const provider: OnboardingProviderInput | null = draft.providerChoice === 'skip'
    ? null
    : {
        kind: draft.provider.kind,
        displayName: draft.provider.displayName.trim(),
        baseUrl: draft.provider.baseUrl.trim(),
        defaultModel: draft.provider.defaultModel.trim(),
        apiKey: draft.provider.apiKey.trim() || undefined,
        enabled: true,
      }

  return {
    language: draft.language,
    userDisplayName: draft.userDisplayName.trim(),
    agentName: draft.agentName.trim(),
    memoryEnabled: draft.memoryEnabled,
    provider,
    theme: draft.theme,
    workspacePath: draft.workspacePath.trim(),
  }
}

export default function App() {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [assistantsOpen, setAssistantsOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advancedPanel, setAdvancedPanel] = useState<AdvancedPanel>('setup')
  const [uiMode, setUiMode] = useState<UiModeId>(() => (['simple', 'expert'] as UiModeId[])[0])
  const cloudAutoSyncedRef = useRef(false)
  const appState = useEndpoint(api.appState, fallback.appState)
  const runtime = useEndpoint(api.runtimeStatus, fallback.runtime)
  const localDeploymentComplete = !appState.data.shouldShowFirstDeploy
  const workspaceEnabled = !appState.loading && localDeploymentComplete
  const cloudStatus = useEndpoint(api.cloudStatus, fallback.cloudStatus, workspaceEnabled)
  const onboarding = useEndpoint(loadOnboardingState, fallbackOnboarding, workspaceEnabled)
  const companyProfile = useEndpoint(api.companyProfile, fallback.companyProfile, workspaceEnabled)
  const companyMaterials = useEndpoint(api.companyMaterials, fallback.companyMaterials, workspaceEnabled)
  const companyReady = isCompanyProfileReady(companyProfile.data)
  const setupCompleted = onboarding.data.completed && companyReady
  const chatEnabled = workspaceEnabled && setupCompleted
  const agents = useEndpoint(api.agents, fallback.agents, chatEnabled)
  const providers = useEndpoint(api.providers, fallback.providers, chatEnabled)
  const profiles = useEndpoint(api.profiles, fallback.profiles, chatEnabled)
  const usage = useEndpoint(api.usageSummary, fallback.usage, chatEnabled)
  const analytics = useEndpoint(api.analyticsSummary, fallback.analytics, chatEnabled)
  const sessions = useEndpoint(api.chatSessions, fallback.sessions, chatEnabled)
  const materials = useEndpoint(api.materials, fallback.materials, chatEnabled)
  const outreachLeads = useEndpoint(api.outreachLeads, fallback.outreachLeads, chatEnabled)
  const outreachCampaigns = useEndpoint(api.outreachCampaigns, fallback.outreachCampaigns, chatEnabled)
  const outreachSenders = useEndpoint(api.outreachSenderAccounts, fallback.outreachSenderAccounts, chatEnabled)

  const readyProviders = providers.data.filter((provider) => provider.status === 'connected').length
  const readyAgents = agents.data.filter((agent) => agent.status !== 'draft').length
  const cloudLoginRequired = workspaceEnabled && cloudStatus.data.configured && cloudStatus.data.required && !cloudStatus.data.authenticated
  const serviceWarning = appState.error || runtime.error || cloudStatus.error || onboarding.error || agents.error || providers.error || profiles.error || usage.error || analytics.error || sessions.error || materials.error || companyProfile.error || companyMaterials.error || outreachLeads.error || outreachCampaigns.error || outreachSenders.error
  const copy = getUiCopy(onboarding.data.language ?? fallbackOnboarding.language)
  const serviceWarningMessage = serviceWarning ? copy.topbar.serviceWarning(humanizeErrorMessage(serviceWarning, copy)) : ''

  useEffect(() => {
    document.documentElement.lang = normalizeUiLanguage(onboarding.data.language ?? fallbackOnboarding.language)
  }, [onboarding.data.language])

  useEffect(() => {
    if (!chatEnabled || !cloudStatus.data.authenticated) {
      cloudAutoSyncedRef.current = false
      return
    }
    if (cloudAutoSyncedRef.current) return
    cloudAutoSyncedRef.current = true
    void api.cloudSync().then(cloudStatus.setData).catch((error) => {
      cloudStatus.setData({
        ...cloudStatus.data,
        lastSyncError: humanizeErrorMessage(error, copy, 'message'),
      })
    })
  }, [chatEnabled, cloudStatus.data.authenticated])

  async function refreshAfterDeploy() {
    runtime.setData(await api.runtimeStatus())
    appState.setData(await api.appState())
  }

  useEffect(() => {
    if (!workspaceEnabled || !runtimeNeedsRecovery(runtime.data)) return
    let cancelled = false

    async function refreshRuntimeRecovery() {
      try {
        const nextRuntime = await api.runtimeStatus()
        if (cancelled) return
        runtime.setData(nextRuntime)
        if (!runtimeNeedsRecovery(nextRuntime)) appState.setData(await api.appState())
      } catch {
        // The explicit Try again button remains available if automatic recovery cannot refresh.
      }
    }

    void refreshRuntimeRecovery()
    const timer = window.setInterval(refreshRuntimeRecovery, 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [workspaceEnabled, runtime.data.state, runtime.data.gateway?.state])

  function openAdvanced(panel: AdvancedPanel) {
    setAdvancedPanel(panel)
    setSourcesOpen(false)
    setSessionsOpen(false)
    setAssistantsOpen(false)
    setAdvancedOpen(true)
  }

  function setFilesDrawer(open: boolean) {
    if (open) {
      setAdvancedOpen(false)
      setSessionsOpen(false)
      setAssistantsOpen(false)
    }
    setSourcesOpen(open)
  }

  function setAssistantsDrawer(open: boolean) {
    if (open) {
      setAdvancedOpen(false)
      setSessionsOpen(false)
      setSourcesOpen(false)
    }
    setAssistantsOpen(open)
  }

  if (appState.loading || runtime.loading || !localDeploymentComplete) {
    return (
      <FirstRunDeployPage
        runtime={runtime.data}
        setRuntime={runtime.setData}
        loading={appState.loading || runtime.loading}
        serviceError={serviceWarning}
        onComplete={refreshAfterDeploy}
        copy={copy}
      />
    )
  }

  if (cloudStatus.loading || onboarding.loading || companyProfile.loading || companyMaterials.loading) {
    return (
      <OnboardingLoadingPage serviceError={serviceWarning} copy={copy} />
    )
  }

  if (cloudLoginRequired) {
    return (
      <CloudLoginPage
        status={cloudStatus.data}
        serviceError={serviceWarning}
        setStatus={cloudStatus.setData}
      />
    )
  }

  if (!onboarding.data.completed || !companyReady) {
    return (
      <OnboardingWizard
        initialState={onboarding.data}
        initialCompanyProfile={companyProfile.data}
        companyMaterials={companyMaterials.data}
        setCompanyProfile={companyProfile.setData}
        setCompanyMaterials={companyMaterials.setData}
        companyOnly={onboarding.data.completed}
        serviceError={serviceWarning}
        onFinished={(next) => onboarding.setData(next)}
      />
    )
  }

  return (
    <div className="client-shell hermills-crm-shell">
      <ClientWorkspace
        runtime={runtime.data}
        sessions={sessions.data}
        setSessions={sessions.setData}
        materials={materials.data}
        setMaterials={materials.setData}
        companyProfile={companyProfile.data}
        companyMaterials={companyMaterials.data}
        outreachLeads={outreachLeads.data}
        setOutreachLeads={outreachLeads.setData}
        outreachCampaigns={outreachCampaigns.data}
        setOutreachCampaigns={outreachCampaigns.setData}
        outreachSenders={outreachSenders.data}
        setOutreachSenders={outreachSenders.setData}
        cloudStatus={cloudStatus.data}
        setCloudStatus={cloudStatus.setData}
        setRuntime={runtime.setData}
        agents={agents.data}
        setAgents={agents.setData}
        providers={providers.data}
        setProviders={providers.setData}
        profiles={profiles.data}
        sourcesOpen={sourcesOpen}
        setSourcesOpen={setFilesDrawer}
        sessionsOpen={sessionsOpen}
        setSessionsOpen={setSessionsOpen}
        assistantsOpen={assistantsOpen}
        setAssistantsOpen={setAssistantsDrawer}
        openAdvanced={openAdvanced}
        defaultAgentId={onboarding.data.defaultAgentId}
        copy={copy}
        serviceWarning={serviceWarningMessage}
        openCompanyKnowledge={() => openAdvanced('company')}
      />

      {advancedOpen ? (
        <AdvancedOverlay
          activePanel={advancedPanel}
          setActivePanel={setAdvancedPanel}
          onClose={() => setAdvancedOpen(false)}
          runtime={runtime.data}
          setRuntime={runtime.setData}
          agents={agents.data}
          setAgents={agents.setData}
          providers={providers.data}
          profiles={profiles.data}
          setProfiles={profiles.setData}
          usage={usage.data}
          analytics={analytics.data}
          readyProviders={readyProviders}
          readyAgents={readyAgents}
          setProviders={providers.setData}
          onboardingState={onboarding.data}
          setOnboardingState={onboarding.setData}
          sessions={sessions.data}
          materials={materials.data}
          companyProfile={companyProfile.data}
          setCompanyProfile={companyProfile.setData}
          companyMaterials={companyMaterials.data}
          setCompanyMaterials={companyMaterials.setData}
          uiMode={uiMode}
          setUiMode={setUiMode}
          copy={copy}
        />
      ) : null}
    </div>
  )
}

function CloudLoginPage({
  status,
  serviceError,
  setStatus,
}: {
  status: CloudStatus
  serviceError?: string
  setStatus: (status: CloudStatus) => void
}) {
  const copy = getUiCopy('zh-CN')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [signupPendingEmail, setSignupPendingEmail] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (mode === 'signup') {
      if (password.length < 8) {
        setError('注册密码至少需要 8 位。')
        return
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一样。')
        return
      }
      if (!termsAccepted) {
        setError('请先同意服务条款和隐私政策。')
        return
      }
    }
    setBusy(mode)
    try {
      const next = mode === 'signup'
        ? await api.cloudSignup({
          email: email.trim(),
          password,
          fullName: fullName.trim() || undefined,
          nickname: fullName.trim() || undefined,
          termsAccepted
        })
        : await api.cloudLogin({ email: email.trim(), password })
      setStatus(next)
      if (!next.authenticated && mode === 'signup') {
        setSignupPendingEmail(email.trim())
        setMode('login')
        setNotice('账号已创建，但还不能进入。请先打开邮箱里的验证邮件，点完成验证后，再回来点击登录。')
      }
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function resendSignupConfirmation() {
    const targetEmail = signupPendingEmail || email.trim()
    if (!targetEmail) {
      setError('先填写邮箱，再重发验证邮件。')
      return
    }
    setBusy('resendSignup')
    setError('')
    try {
      await api.cloudResendSignupConfirmation(targetEmail)
      setSignupPendingEmail(targetEmail)
      setNotice('验证邮件已重新发送。请打开邮箱点验证链接，然后回来登录。')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError('先填写邮箱，再发送重置邮件。')
      return
    }
    setBusy('reset')
    setError('')
    setNotice('')
    try {
      await api.cloudPasswordReset(email)
      setNotice('重置邮件已发送，请打开邮箱继续。')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="cloud-auth-page">
      <div className="cloud-auth-brand">
        <div className="letter-logo"><Mail size={18} /></div>
        <div>
          <strong>Outbound Mail OS</strong>
          <span>Hermills 云端大脑</span>
        </div>
      </div>
      <form className="cloud-auth-card" onSubmit={submit}>
        <div className="cloud-auth-icon"><KeyRound size={22} /></div>
        <div>
          <p className="cloud-auth-eyebrow">账号登录</p>
          <h1>{mode === 'signup' ? '创建 Hermills 账号' : '登录 Hermills'}</h1>
          <p>登录后会同步客户记录、邮件草稿和匿名学习数据。真实邮箱密码和 API Key 仍然只保存在本机。</p>
        </div>
        {serviceError ? <div className="letter-alert error"><AlertCircle size={16} /><span>{serviceError}</span></div> : null}
        {notice ? <div className="letter-alert success"><CheckCircle2 size={16} /><span>{notice}</span></div> : null}
        {error ? <div className="letter-alert error"><AlertCircle size={16} /><span>{error}</span></div> : null}
        {mode === 'signup' ? (
          <label>
            <span>姓名</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="你的名字" />
          </label>
        ) : null}
        <label>
          <span>邮箱</span>
          <input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required />
        </label>
        <label>
          <span>密码</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? '至少 8 位密码' : '输入密码'} minLength={mode === 'signup' ? 8 : 6} required />
        </label>
        {mode === 'signup' ? (
          <>
            <label>
              <span>确认密码</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再输入一次密码" minLength={8} required />
            </label>
            <label className="cloud-auth-check">
              <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required />
              <span>我同意服务条款和隐私政策。Hermills 可以同步账号资料、客户记录和匿名学习数据；邮箱密码和 API Key 仍只保存在本机。</span>
            </label>
          </>
        ) : null}
        <button className="letter-primary" type="submit" disabled={Boolean(busy)}>
          {busy === mode ? '处理中...' : mode === 'signup' ? '创建账号' : '登录'}
          <ChevronRight size={16} />
        </button>
        <div className="cloud-auth-actions">
          <button type="button" onClick={() => {
            setMode(mode === 'signup' ? 'login' : 'signup')
            setNotice('')
            setError('')
            setConfirmPassword('')
          }}>
            {mode === 'signup' ? '已有账号，去登录' : '没有账号，去注册'}
          </button>
          {signupPendingEmail ? (
            <button type="button" onClick={resendSignupConfirmation} disabled={busy === 'resendSignup'}>
              {busy === 'resendSignup' ? '重发中...' : '重发验证邮件'}
            </button>
          ) : null}
          <button type="button" onClick={resetPassword} disabled={busy === 'reset'}>
            {busy === 'reset' ? '发送中...' : '忘记密码'}
          </button>
        </div>
        {!status.configured ? (
          <p className="cloud-auth-footnote">当前安装包还没有配置 Supabase URL 和匿名 Key。</p>
        ) : null}
      </form>
    </div>
  )
}

function ClientWorkspace({
  runtime,
  sessions,
  setSessions,
  materials,
  setMaterials,
  companyProfile,
  companyMaterials,
  outreachLeads,
  setOutreachLeads,
  outreachCampaigns,
  setOutreachCampaigns,
  outreachSenders,
  setOutreachSenders,
  cloudStatus,
  setCloudStatus,
  setRuntime,
  agents,
  setAgents,
  providers,
  setProviders,
  profiles,
  sourcesOpen,
  setSourcesOpen,
  sessionsOpen,
  setSessionsOpen,
  assistantsOpen,
  setAssistantsOpen,
  openAdvanced,
  defaultAgentId,
  copy,
  serviceWarning,
  openCompanyKnowledge,
}: {
  runtime: RuntimeStatus
  sessions: ChatSession[]
  setSessions: (sessions: ChatSession[]) => void
  materials: Material[]
  setMaterials: (materials: Material[]) => void
  companyProfile: CompanyProfile
  companyMaterials: Material[]
  outreachLeads: OutreachLead[]
  setOutreachLeads: (leads: OutreachLead[]) => void
  outreachCampaigns: OutreachCampaign[]
  setOutreachCampaigns: Dispatch<SetStateAction<OutreachCampaign[]>>
  outreachSenders: OutreachSenderAccount[]
  setOutreachSenders: (senders: OutreachSenderAccount[]) => void
  cloudStatus: CloudStatus
  setCloudStatus: (status: CloudStatus) => void
  setRuntime: (runtime: RuntimeStatus) => void
  agents: Agent[]
  setAgents: (agents: Agent[]) => void
  providers: Provider[]
  setProviders: (providers: Provider[]) => void
  profiles: ProfileState
  sourcesOpen: boolean
  setSourcesOpen: (open: boolean) => void
  sessionsOpen: boolean
  setSessionsOpen: (open: boolean) => void
  assistantsOpen: boolean
  setAssistantsOpen: (open: boolean) => void
  openAdvanced: (panel: AdvancedPanel) => void
  defaultAgentId?: string
  copy: UiCopy
  serviceWarning?: string
  openCompanyKnowledge: () => void
}) {
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('outreach')
  const [activeSessionId, setActiveSessionId] = useState('')
  const [preferredAgentId, setPreferredAgentId] = useState('')
  const [sessionQuery, setSessionQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([])
  const [materialPreview, setMaterialPreview] = useState<MaterialPreview>()
  const [previewLoadingId, setPreviewLoadingId] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sendError, setSendError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [computerStatus, setComputerStatus] = useState<ComputerControlStatus>()
  const [computerPermissionBusy, setComputerPermissionBusy] = useState(false)
  const streamRef = useRef<HTMLDivElement>(null)
  const streamBottomRef = useRef<HTMLDivElement>(null)
  const composerInputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottomRef = useRef(true)
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0]
  const chatReady = runtime.state === 'ready'
  const selectedAgentId = activeSession?.agentId ?? preferredAgentId
  const activeAgent = selectedAgentId ? agents.find((agent) => agent.id === selectedAgentId) : undefined
  const visibleSessions = filterSessions(sessions, sessionQuery)
  const defaultChatProvider = useMemo(() => getDefaultChatProvider(providers), [providers])
  const hasReadyProvider = providers.some((provider) => provider.status === 'connected')
  const selectedMaterials = useMemo(
    () => materials.filter((material) => selectedMaterialIds.includes(material.id)),
    [materials, selectedMaterialIds],
  )

  useEffect(() => {
    if (!activeSessionId && sessions[0]) setActiveSessionId(sessions[0].id)
  }, [activeSessionId, sessions])

  useEffect(() => {
    if (!preferredAgentId && defaultAgentId && agents.some((agent) => agent.id === defaultAgentId)) {
      setPreferredAgentId(defaultAgentId)
    }
  }, [agents, defaultAgentId, preferredAgentId])

  useEffect(() => {
    if (stickToBottomRef.current) streamBottomRef.current?.scrollIntoView({ block: 'end' })
  }, [activeSession?.id, activeSession?.messages.length, sending])

  useEffect(() => {
    if (!chatReady) {
      setComputerStatus(undefined)
      return
    }
    let cancelled = false
    api.prepareComputerControl()
      .then((result) => {
        if (!cancelled) setComputerStatus(result.status)
      })
      .catch(() => {
        api.computerControlStatus()
          .then((status) => {
            if (!cancelled) setComputerStatus(status)
          })
          .catch(() => undefined)
      })
    return () => {
      cancelled = true
    }
  }, [chatReady])

  function updateScrollPreference() {
    const stream = streamRef.current
    if (!stream) return
    stickToBottomRef.current = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 160
  }

  function focusComposer() {
    window.setTimeout(() => composerInputRef.current?.focus(), 0)
  }

  async function refreshComputerControlStatus() {
    try {
      setComputerStatus(await api.computerControlStatus())
    } catch {
      // Computer control status is a convenience nudge; chat should stay usable if status polling fails.
    }
  }

  async function requestComputerControlPermission() {
    const permission = computerStatus?.permissions.find((item) => (
      (item.id === 'screen-recording' || item.id === 'accessibility') && item.state === 'missing'
    ))?.id
    if (permission !== 'screen-recording' && permission !== 'accessibility') {
      await refreshComputerControlStatus()
      return
    }
    setComputerPermissionBusy(true)
    try {
      const result = await api.requestComputerControlPermission(permission)
      setComputerStatus(result.status)
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500))
        const next = await api.computerControlStatus()
        setComputerStatus(next)
        if (next.readiness !== 'needs-permission') break
      }
    } catch (err) {
      setSendError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setComputerPermissionBusy(false)
    }
  }

  function handleEmptyChatAction(actionId: ChatEmptyEntryId) {
    setSendError('')
    if (actionId === 'addFiles') {
      setSourcesOpen(true)
      return
    }
    if (actionId === 'createAssistant') {
      setAssistantsOpen(true)
      return
    }
    if (actionId === 'companyKnowledge') {
      openCompanyKnowledge()
      return
    }
    setDraft(copy.chat.emptyActions[actionId].prompt)
    focusComposer()
  }

  function applyFileAction(actionId: FileActionId) {
    setUploadError('')
    const action = copy.files.actions[actionId]
    if (!selectedMaterials.length) {
      setSourcesOpen(true)
      return
    }
    const fileList = selectedMaterials.map((material) => `- ${material.name}`).join('\n')
    setDraft(`${action.prompt}\n\n${fileList}`)
    setSourcesOpen(false)
    focusComposer()
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!draft.trim() || sending || !chatReady) return
    event.currentTarget.form?.requestSubmit()
  }

  async function newSession() {
    setSendError('')
    const agent = preferredAgentId ? agents.find((item) => item.id === preferredAgentId) : undefined
    const session = await api.createChatSession(agent ? copy.chat.newAssistantConversation(agent.name) : copy.chat.newConversation, getChatSessionDefaults(agent, defaultChatProvider))
    setSessions([session, ...sessions])
    setActiveSessionId(session.id)
    setWorkspaceView('chat')
    setSessionsOpen(false)
  }

  async function useAssistant(agentId: string) {
    setSendError('')
    setPreferredAgentId(agentId)
    setAssistantsOpen(false)
    if (!activeSession) return
    const agent = agents.find((item) => item.id === agentId)
    try {
      const defaults = getChatSessionDefaults(agent, defaultChatProvider)
      const next = await api.updateChatSession(activeSession.id, {
        agentId: defaults.agentId ?? null,
        providerId: defaults.providerId ?? null,
        model: defaults.model ?? null
      })
      setSessions(replaceSession(sessions, next))
      setActiveSessionId(next.id)
    } catch (err) {
      setSendError(humanizeErrorMessage(err, copy, 'message'))
    }
  }

  async function startChatWithAssistant(agentId: string) {
    setSendError('')
    const agent = agents.find((item) => item.id === agentId)
    if (!agent) return
    setPreferredAgentId(agent.id)
    try {
      const session = await api.createChatSession(copy.chat.newAssistantConversation(agent.name), getChatSessionDefaults(agent, defaultChatProvider))
      setSessions([session, ...sessions])
      setActiveSessionId(session.id)
      setWorkspaceView('chat')
      setAssistantsOpen(false)
    } catch (err) {
      setSendError(humanizeErrorMessage(err, copy, 'message'))
    }
  }

  function selectSession(id: string) {
    setSendError('')
    setActiveSessionId(id)
    setWorkspaceView('chat')
    setSessionsOpen(false)
  }

  async function renameSession(id: string, title: string) {
    setSendError('')
    try {
      setSessions(replaceSession(sessions, await api.updateChatSession(id, { title })))
    } catch (err) {
      setSendError(humanizeErrorMessage(err, copy, 'message'))
    }
  }

  async function deleteSession(id: string) {
    setSendError('')
    try {
      await api.deleteChatSession(id)
      const nextSessions = sessions.filter((session) => session.id !== id)
      setSessions(nextSessions)
      if (activeSessionId === id) setActiveSessionId(nextSessions[0]?.id ?? '')
    } catch (err) {
      setSendError(humanizeErrorMessage(err, copy, 'message'))
    }
  }

  async function connectSavedProvider(provider: Provider) {
    const nextProviders = await api.providers()
    setProviders(nextProviders)
    const connectedProvider = nextProviders.find((item) => item.id === provider.id) ?? provider
    if (!activeSession || connectedProvider.status !== 'connected' || sessionHasReadyProvider(activeSession, providers)) return
    const nextSession = await api.updateChatSession(activeSession.id, {
      providerId: connectedProvider.id,
      model: connectedProvider.defaultModel ?? null,
    })
    setSessions(replaceSession(sessions, nextSession))
    setActiveSessionId(nextSession.id)
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    if (!chatReady) {
      setSendError(copy.chat.startBeforeSend)
      return
    }
    setSendError('')
    setSending(true)
    try {
      let session = activeSession
      let nextSessionList = sessions
      if (!session) {
        const agent = preferredAgentId ? agents.find((item) => item.id === preferredAgentId) : undefined
        session = await api.createChatSession(agent ? copy.chat.newAssistantConversation(agent.name) : copy.chat.newConversation, getChatSessionDefaults(agent, defaultChatProvider))
        nextSessionList = [session, ...sessions]
        setSessions(nextSessionList)
        setActiveSessionId(session.id)
      } else if (!sessionHasReadyProvider(session, providers) && defaultChatProvider) {
        session = await api.updateChatSession(session.id, {
          providerId: defaultChatProvider.id,
          model: defaultChatProvider.defaultModel ?? null
        })
        nextSessionList = replaceSession(nextSessionList, session)
        setSessions(nextSessionList)
      }
      stickToBottomRef.current = true
      const sentAt = new Date().toISOString()
      const optimisticUserMessage: ChatMessage = {
        id: `optimistic-user-${sentAt}`,
        role: 'user',
        content,
        createdAt: sentAt
      }
      const optimisticSession: ChatSession = {
        ...session,
        messages: [...session.messages, optimisticUserMessage],
        messageCount: (session.messageCount ?? session.messages.filter((message) => message.role !== 'system').length) + 1,
        updatedAt: sentAt
      }
      nextSessionList = replaceSession(nextSessionList, optimisticSession)
      setSessions(nextSessionList)
      setActiveSessionId(optimisticSession.id)
      setDraft('')
      const next = await api.sendChatMessage(session.id, content, selectedMaterialIds)
      setSessions(replaceSession(nextSessionList, next))
      setActiveSessionId(next.id)
    } catch (err) {
      setSendError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setSending(false)
    }
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    if (!files.length) return
    setUploadError('')
    setUploading(true)
    try {
      const saved: Material[] = []
      for (const file of files) {
        saved.push(await api.saveMaterial(file))
      }
      setMaterials([...saved, ...materials])
      setSelectedMaterialIds([...saved.map((item) => item.id), ...selectedMaterialIds])
      setSourcesOpen(true)
    } catch (err) {
      setUploadError(humanizeErrorMessage(err, copy, 'fileUpload'))
    } finally {
      setUploading(false)
      event.currentTarget.value = ''
    }
  }

  async function deleteMaterial(id: string) {
    setUploadError('')
    try {
      await api.deleteMaterial(id)
      setMaterials(materials.filter((material) => material.id !== id))
      setSelectedMaterialIds(selectedMaterialIds.filter((materialId) => materialId !== id))
      if (materialPreview?.id === id) setMaterialPreview(undefined)
    } catch (err) {
      setUploadError(humanizeErrorMessage(err, copy, 'fileUpload'))
    }
  }

  async function previewMaterial(id: string) {
    setUploadError('')
    setPreviewLoadingId(id)
    try {
      const preview = await api.materialPreview(id)
      setMaterialPreview(preview)
      setSourcesOpen(true)
    } catch (err) {
      setUploadError(humanizeErrorMessage(err, copy, 'fileUpload'))
    } finally {
      setPreviewLoadingId('')
    }
  }

  async function renameMaterial(id: string, name: string) {
    setUploadError('')
    try {
      const next = await api.updateMaterial(id, { name })
      setMaterials(materials.map((material) => material.id === id ? next : material))
      if (materialPreview?.id === id) setMaterialPreview({ ...materialPreview, ...next })
    } catch (err) {
      setUploadError(humanizeErrorMessage(err, copy, 'fileUpload'))
    }
  }

  async function copyMaterial(id: string) {
    setUploadError('')
    try {
      const next = await api.copyMaterial(id)
      setMaterials([next, ...materials])
    } catch (err) {
      setUploadError(humanizeErrorMessage(err, copy, 'fileUpload'))
    }
  }

  async function downloadMaterial(id: string) {
    setUploadError('')
    try {
      const material = materials.find((item) => item.id === id)
      const blob = await api.downloadMaterial(id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = material?.name || 'material'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setUploadError(humanizeErrorMessage(err, copy, 'fileUpload'))
    }
  }

  const activeProvider = activeSession?.providerId
    ? providers.find((provider) => provider.id === activeSession.providerId)
    : defaultChatProvider
  const activeModel = activeSession?.model || activeAgent?.model || activeProvider?.defaultModel || copy.assistant.localHermes
  const connectedProviders = providers.filter((provider) => provider.status === 'connected')
  const selectedFileCount = selectedMaterialIds.length

  return (
    <TooltipProvider>
      <main className={`hermills-app-shell hermills-crm-workbench ${workspaceView === 'outreach' ? 'outreach-home' : ''} ${sourcesOpen ? 'sources-visible' : ''}`}>
        <AppMenuSidebar
          runtime={runtime}
          sessions={visibleSessions}
          totalSessions={sessions.length}
          activeSession={activeSession}
          query={sessionQuery}
          setQuery={setSessionQuery}
          onSelect={selectSession}
          onNew={newSession}
          onRename={renameSession}
          onDelete={deleteSession}
          onOpenAssistants={() => setAssistantsOpen(true)}
          onOpenFiles={() => setSourcesOpen(true)}
          onOpenOutreach={() => setWorkspaceView('outreach')}
          activeWorkspaceView={workspaceView}
          onOpenProviders={() => openAdvanced('keys')}
          onOpenSettings={() => openAdvanced('setup')}
          onOpenUpdate={() => openAdvanced('setup')}
          copy={copy}
        />

        <Sheet open={sessionsOpen} onOpenChange={setSessionsOpen}>
          <SheetContent side="left" className="hermills-mobile-sheet" showCloseButton={false}>
            <SheetTitle className="sr-only">{copy.topbar.chats}</SheetTitle>
            <AppMenuSidebar
            runtime={runtime}
            sessions={visibleSessions}
            totalSessions={sessions.length}
            activeSession={activeSession}
            query={sessionQuery}
            setQuery={setSessionQuery}
            onSelect={selectSession}
            onNew={newSession}
            onRename={renameSession}
            onDelete={deleteSession}
            onClose={() => setSessionsOpen(false)}
            onOpenAssistants={() => setAssistantsOpen(true)}
            onOpenFiles={() => setSourcesOpen(true)}
            onOpenOutreach={() => setWorkspaceView('outreach')}
            activeWorkspaceView={workspaceView}
            onOpenProviders={() => openAdvanced('keys')}
            onOpenSettings={() => openAdvanced('setup')}
            onOpenUpdate={() => openAdvanced('setup')}
            className="mobile-session-panel hermills-mobile-sidebar"
            copy={copy}
          />
          </SheetContent>
        </Sheet>

        <section className={`hermills-chat-panel ${workspaceView === 'outreach' ? 'outreach-active' : ''}`}>
          <div className="mobile-workspace-toolbar">
            <Button variant="ghost" size="icon-sm" aria-label={copy.topbar.chats} onClick={() => setSessionsOpen(true)}>
              <Menu />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={copy.devLetter.navAria} onClick={() => setWorkspaceView('outreach')}>
              <Mail />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={copy.topbar.files} onClick={() => setSourcesOpen(true)}>
              <PanelRightOpen />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={copy.topbar.settingsAria} onClick={() => openAdvanced('setup')}>
              <Settings />
            </Button>
          </div>
          {serviceWarning ? <div className="service-warning hermills-inline-service-warning">{serviceWarning}</div> : null}
        {workspaceView === 'outreach' ? (
          <DevelopmentLetterPage
            companyProfile={companyProfile}
            companyMaterials={companyMaterials}
            leads={outreachLeads}
            setLeads={setOutreachLeads}
            campaigns={outreachCampaigns}
            setCampaigns={setOutreachCampaigns}
            senderAccounts={outreachSenders}
            setSenderAccounts={setOutreachSenders}
            cloudStatus={cloudStatus}
            setCloudStatus={setCloudStatus}
            providers={providers}
            onOpenCompanyKnowledge={openCompanyKnowledge}
            onOpenChat={() => setWorkspaceView('chat')}
            onOpenSettings={() => openAdvanced('setup')}
            copy={copy}
          />
        ) : (
          <>
            {!chatReady ? <GatewayBanner runtime={runtime} setRuntime={setRuntime} openAdvanced={openAdvanced} copy={copy} /> : null}

            <header className="hermills-chat-header">
              <div className="hermills-chat-title">
                <Button className="mobile-session-trigger" variant="ghost" size="icon-sm" aria-label={copy.topbar.chats} onClick={() => setSessionsOpen(true)}>
                  <Menu />
                </Button>
                <div>
                  <span>{copy.chat.sectionLabel}</span>
                  <h1>{activeSession?.title || copy.chat.defaultTitle}</h1>
                </div>
              </div>
              <div className="hermills-chat-context">
                <Button variant="outline" size="sm" onClick={() => setAssistantsOpen(true)}>
                  <Bot data-icon="inline-start" />
                  {activeAgent?.name || copy.chat.defaultAssistant}
                </Button>
                <Badge variant={activeProvider?.status === 'connected' ? 'default' : 'outline'}>
                  {activeModel}
                </Badge>
                <Button variant="secondary" size="sm" onClick={() => setSourcesOpen(true)}>
                  <Paperclip data-icon="inline-start" />
                  {selectedFileCount ? copy.chat.selectedFiles(selectedFileCount) : copy.chat.addFile}
                </Button>
              </div>
            </header>

            <motion.div
              className="hermills-message-stream"
              ref={streamRef}
              onScroll={updateScrollPreference}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              {activeSession?.messages.length || sending ? (
                <>
                  {activeSession?.messages.filter((message) => message.role !== 'system').map((message) => {
                    const computerPayload = message.role === 'assistant' ? parseComputerControlMessage(message.content) : undefined
                    return (
                      <motion.div
                        className={`message ${message.role === 'assistant' ? 'agent' : message.role} ${computerPayload ? 'computer-control-message' : ''}`}
                        key={message.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <span className="message-role">{message.role === 'assistant' ? 'Hermes' : copy.chat.you}</span>
                        {computerPayload ? (
                          <ComputerControlInlinePanel payload={computerPayload} copy={copy} />
                        ) : (
                          <MessageContent content={message.content} />
                        )}
                      </motion.div>
                    )
                  })}
                  {sending ? (
                    <motion.div className="message agent pending" aria-live="polite" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <span className="message-role">Hermes</span>
                      <MessageContent content={copy.chat.thinking} />
                    </motion.div>
                  ) : null}
                </>
              ) : (
                <Card className="empty-chat hermills-empty-chat">
                  <CardHeader>
                    <div className="hermills-empty-icon">
                      <MessageCircle />
                    </div>
                    <CardTitle>{copy.chat.emptyTitle}</CardTitle>
                    <CardDescription>{copy.chat.emptyDescription}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="empty-chat-actions">
                      {chatEmptyActions.map((action) => {
                        const Icon = action.icon
                        const entry = copy.chat.emptyActions[action.id]
                        return (
                          <Button className="empty-chat-entry" variant="outline" type="button" key={action.id} onClick={() => handleEmptyChatAction(action.id)}>
                            <Icon data-icon="inline-start" />
                            <span>
                              <strong>{entry.title}</strong>
                              <span>{entry.description}</span>
                            </span>
                          </Button>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
              <div ref={streamBottomRef} />
            </motion.div>

            {selectedFileCount ? (
              <div className="file-action-bar hermills-file-action-bar">
                <span className="state-hint">{copy.files.attached(selectedFileCount)}</span>
                {fileActionItems.map((action) => {
                  const Icon = action.icon
                  return (
                    <Button variant="ghost" size="sm" type="button" key={action.id} onClick={() => applyFileAction(action.id)}>
                      <Icon data-icon="inline-start" />
                      {copy.files.actions[action.id].label}
                    </Button>
                  )
                })}
              </div>
            ) : null}

            {sendError ? (
              <div className="inline-alert composer-alert">
                <span>{sendError}</span>
                {!chatReady ? <Button variant="link" onClick={() => openAdvanced('setup')}>{copy.chat.openSetup}</Button> : null}
                {chatReady && !hasReadyProvider ? <Button variant="link" onClick={() => openAdvanced('keys')}>{copy.chat.addApiKey}</Button> : null}
              </div>
            ) : null}

            {chatReady && computerStatus?.readiness === 'needs-permission' ? (
              <ComputerPermissionNudge busy={computerPermissionBusy} onAllow={requestComputerControlPermission} copy={copy} />
            ) : null}

            {chatReady && !hasReadyProvider ? <KeySetupNudge onOpen={() => openAdvanced('keys')} onSaved={connectSavedProvider} copy={copy} /> : null}

            <form className="composer hermills-composer" onSubmit={sendMessage}>
              <Button variant="ghost" size="icon-sm" type="button" aria-label={copy.chat.openSourcesAria} onClick={() => setSourcesOpen(true)}>
                <Paperclip />
              </Button>
              <Textarea
                className="composer-input"
                ref={composerInputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                aria-label={copy.chat.messageAria}
                placeholder={chatReady ? copy.chat.placeholderReady : copy.chat.placeholderNotReady}
                rows={1}
                disabled={!chatReady || sending}
              />
              <Button className="send-button" type="submit" disabled={!chatReady || sending || !draft.trim()}>
                <Send data-icon="inline-start" />
                {sending ? copy.common.sending : copy.common.send}
              </Button>
            </form>
          </>
        )}
        </section>

        <InspectorPanel
          activeWorkspaceView={workspaceView}
          activeAgent={activeAgent}
          activeProvider={activeProvider}
          activeModel={activeModel}
          connectedProviders={connectedProviders}
          providers={providers}
          companyProfile={companyProfile}
          companyMaterials={companyMaterials}
          outreachLeads={outreachLeads}
          outreachCampaigns={outreachCampaigns}
          senderAccounts={outreachSenders}
          materials={materials}
          selectedMaterials={selectedMaterials}
          computerStatus={computerStatus}
          chatReady={chatReady}
          onOpenAssistants={() => setAssistantsOpen(true)}
          onOpenFiles={() => setSourcesOpen(true)}
          onOpenProviders={() => openAdvanced('keys')}
          onOpenOutreach={() => setWorkspaceView('outreach')}
          onOpenCompanyKnowledge={openCompanyKnowledge}
          onRequestComputerPermission={requestComputerControlPermission}
          computerPermissionBusy={computerPermissionBusy}
          copy={copy}
        />

        <SourcesDrawer
          open={sourcesOpen}
          materials={materials}
          selectedMaterialIds={selectedMaterialIds}
          setSelectedMaterialIds={setSelectedMaterialIds}
          uploading={uploading}
          uploadError={uploadError}
          uploadFiles={uploadFiles}
          deleteMaterial={deleteMaterial}
          previewMaterial={previewMaterial}
          renameMaterial={renameMaterial}
          copyMaterial={copyMaterial}
          downloadMaterial={downloadMaterial}
          materialPreview={materialPreview}
          clearMaterialPreview={() => setMaterialPreview(undefined)}
          previewLoadingId={previewLoadingId}
          onFileAction={applyFileAction}
          onClose={() => setSourcesOpen(false)}
          copy={copy}
        />

        <AssistantDrawer
          open={assistantsOpen}
          agents={agents}
          providers={providers}
          selectedAgentId={selectedAgentId}
          refresh={setAgents}
          onUse={useAssistant}
          onStartChat={startChatWithAssistant}
          onClose={() => setAssistantsOpen(false)}
          copy={copy}
        />
      </main>
    </TooltipProvider>
  )
}

function AppMenuSidebar({
  runtime,
  sessions,
  totalSessions = sessions.length,
  activeSession,
  query,
  setQuery,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onClose,
  onOpenAssistants,
  onOpenFiles,
  onOpenOutreach,
  activeWorkspaceView,
  onOpenProviders,
  onOpenSettings,
  onOpenUpdate,
  className = '',
  copy,
}: {
  runtime: RuntimeStatus
  sessions: ChatSession[]
  totalSessions?: number
  activeSession?: ChatSession
  query: string
  setQuery: (query: string) => void
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onClose?: () => void
  onOpenAssistants: () => void
  onOpenFiles: () => void
  onOpenOutreach: () => void
  activeWorkspaceView: WorkspaceView
  onOpenProviders: () => void
  onOpenSettings: () => void
  onOpenUpdate: () => void
  className?: string
  copy: UiCopy
}) {
  const [editingId, setEditingId] = useState('')
  const [editingTitle, setEditingTitle] = useState('')

  const navItems: Array<{ label: string; icon: LucideIcon; active?: boolean; action: () => void }> = [
    { label: copy.devLetter.sectionLabel, icon: Mail, active: activeWorkspaceView === 'outreach', action: onOpenOutreach },
    { label: copy.common.chat, icon: MessageCircle, active: activeWorkspaceView === 'chat', action: () => onSelect(activeSession?.id ?? '') },
    { label: copy.common.assistants, icon: Bot, action: onOpenAssistants },
    { label: copy.common.files, icon: FileText, action: onOpenFiles },
    { label: copy.common.provider, icon: KeyRound, action: onOpenProviders },
    { label: copy.common.settings, icon: Settings, action: onOpenSettings },
  ]

  function beginRename(session: ChatSession) {
    setEditingId(session.id)
    setEditingTitle(session.title)
  }

  async function submitRename(event: FormEvent, id: string) {
    event.preventDefault()
    const title = editingTitle.trim()
    if (!title) return
    await onRename(id, title)
    setEditingId('')
  }

  return (
    <aside className={`hermills-menu-sidebar ${className}`} onClick={(event) => event.stopPropagation()}>
      <div className="window-drag-zone" aria-hidden="true" />
      <div className="hermills-menu-brand">
        <div className="brand-mark">H</div>
        <div>
          <strong>Hermills</strong>
          <span>{copy.common.brandSubtitle}</span>
        </div>
        {onClose ? (
          <Button className="hermills-sidebar-close" variant="ghost" size="icon-sm" aria-label={copy.session.closeAria} onClick={onClose}>
            <X />
          </Button>
        ) : null}
      </div>

      <Button className="hermills-new-chat" type="button" onClick={onNew}>
        <Plus data-icon="inline-start" />
        {copy.session.newConversation}
      </Button>

      <nav className="hermills-nav-list" aria-label={copy.advanced.navAria}>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <Button
                  className="hermills-nav-button"
                  variant={item.active ? 'secondary' : 'ghost'}
                  data-active={item.active ? 'true' : undefined}
                  type="button"
                  onClick={item.action}
                >
                  <Icon data-icon="inline-start" />
                  {item.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      <Separator className="hermills-sidebar-separator" />

      <div className="hermills-sidebar-status">
        <span className={`status-dot ${runtime.state}`} />
        <span className="hermills-sidebar-status-label">{runtimeStatusLabel(runtime, copy)}</span>
        {runtime.updateAvailable ? (
          <Button variant="ghost" size="xs" onClick={onOpenUpdate}>
            <RefreshCw data-icon="inline-start" />
            {copy.common.update}
          </Button>
        ) : null}
      </div>

      <div className="hermills-recents">
        <div className="hermills-recents-header">
          <span>{copy.session.count(totalSessions)}</span>
          <Button variant="ghost" size="icon-xs" aria-label={copy.devLetter.navAria} onClick={onOpenOutreach}>
            <Mail />
          </Button>
        </div>
        <label className="hermills-search-field">
          <Search />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={copy.session.searchAria} placeholder={copy.session.searchPlaceholder} />
        </label>
        <div className="hermills-session-list">
          {sessions.length ? (
            sessions.map((session) => (
              <article className={`hermills-session-row ${activeSession?.id === session.id ? 'active' : ''}`} key={session.id}>
                {editingId === session.id ? (
                  <form className="session-edit" onSubmit={(event) => submitRename(event, session.id)}>
                    <Input value={editingTitle} autoFocus onChange={(event) => setEditingTitle(event.target.value)} aria-label={copy.session.titleAria} />
                    <Button variant="ghost" size="icon-sm" type="submit" aria-label={copy.session.saveTitleAria}>
                      <CheckCircle2 />
                    </Button>
                  </form>
                ) : (
                  <>
                    <button className="session-main" onClick={() => onSelect(session.id)}>
                      <strong>{session.title}</strong>
                      <span>{copy.session.messages(session.messageCount || session.messages.length || 0)}</span>
                    </button>
                    <div className="row-actions">
                      <Button variant="ghost" size="icon-xs" aria-label={copy.session.renameAria(session.title)} onClick={() => beginRename(session)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label={copy.session.deleteAria(session.title)} onClick={() => onDelete(session.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </>
                )}
              </article>
            ))
          ) : (
            <button className="hermills-session-row empty-session-row active" onClick={onNew}>
              <strong>{query ? copy.session.noMatch : copy.session.newConversation}</strong>
              <span>{query ? copy.session.tryAnother : copy.session.startWithHermes}</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

function InspectorPanel({
  activeWorkspaceView,
  activeAgent,
  activeProvider,
  activeModel,
  connectedProviders,
  providers,
  companyProfile,
  companyMaterials,
  outreachLeads,
  outreachCampaigns,
  senderAccounts,
  materials,
  selectedMaterials,
  computerStatus,
  chatReady,
  onOpenAssistants,
  onOpenFiles,
  onOpenProviders,
  onOpenOutreach,
  onOpenCompanyKnowledge,
  onRequestComputerPermission,
  computerPermissionBusy,
  copy,
}: {
  activeWorkspaceView: WorkspaceView
  activeAgent?: Agent
  activeProvider?: Provider
  activeModel: string
  connectedProviders: Provider[]
  providers: Provider[]
  companyProfile: CompanyProfile
  companyMaterials: Material[]
  outreachLeads: OutreachLead[]
  outreachCampaigns: OutreachCampaign[]
  senderAccounts: OutreachSenderAccount[]
  materials: Material[]
  selectedMaterials: Material[]
  computerStatus?: ComputerControlStatus
  chatReady: boolean
  onOpenAssistants: () => void
  onOpenFiles: () => void
  onOpenProviders: () => void
  onOpenOutreach: () => void
  onOpenCompanyKnowledge: () => void
  onRequestComputerPermission: () => void
  computerPermissionBusy: boolean
  copy: UiCopy
}) {
  const providerStatus = activeProvider?.status ?? (connectedProviders.length ? 'connected' : 'missing')
  const toolsReady = computerStatus?.readiness === 'ready'
  const needsPermission = computerStatus?.readiness === 'needs-permission'
  const providerStatusSummary = connectedProviders.length
    ? `${connectedProviders.length}/${providers.length} ${copy.providerStatus.connected}`
    : copy.keys.noProviders
  const outreachPipelineCount = outreachCampaigns.filter((campaign) => (
    campaign.status === 'draft' ||
    campaign.status === 'generating' ||
    campaign.status === 'ready' ||
    campaign.status === 'sending' ||
    campaign.status === 'paused'
  )).length
  const approvedRecipients = outreachCampaigns.reduce((total, campaign) => total + (campaign.stats.approved ?? 0), 0)
  const sentRecipients = outreachCampaigns.reduce((total, campaign) => total + (campaign.stats.sent ?? 0), 0)
  const readySender = senderAccounts.find((account) => account.deliveryConfirmedAt) ?? senderAccounts[0]

  if (activeWorkspaceView === 'outreach') {
    return (
      <aside className="hermills-inspector crm-assistant-panel">
        <Card className="hermills-inspector-card crm-assistant-hero">
          <CardHeader>
            <CardTitle>{copy.devLetter.sectionLabel}助手</CardTitle>
            <CardDescription>{copy.devLetter.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hermills-agent-avatar">
              <Bot />
            </div>
            <p>使用 {activeModel} 串起客户背调、草稿质量检查和发件前确认。</p>
            <div className="hermills-mini-stack">
              <Badge variant={companyProfile.name ? 'default' : 'outline'}>
                {companyProfile.name ? copy.devLetter.status.companyReady(companyProfile.name, companyMaterials.length) : copy.devLetter.status.companyMissing}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenCompanyKnowledge}>
              <Building2 data-icon="inline-start" />
              {copy.devLetter.actions.openCompany}
            </Button>
          </CardContent>
        </Card>

        <Card className="hermills-inspector-card">
          <CardHeader>
            <CardTitle>今日外联概览</CardTitle>
            <CardDescription>客户、队列和邮箱状态集中在这里。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="crm-assistant-metric">
              <span>{copy.devLetter.batch.customerList}</span>
              <strong>{formatNumber(outreachLeads.length)}</strong>
            </div>
            <div className="crm-assistant-metric">
              <span>进行中的批量写信</span>
              <strong>{formatNumber(outreachPipelineCount)}</strong>
            </div>
            <div className="crm-assistant-metric">
              <span>已通过 / 已发送</span>
              <strong>{formatNumber(approvedRecipients)} / {formatNumber(sentRecipients)}</strong>
            </div>
          </CardContent>
        </Card>

        <Card className="hermills-inspector-card">
          <CardHeader>
            <CardTitle>{copy.devLetter.mailSetup.title}</CardTitle>
            <CardDescription>{readySender?.email || copy.devLetter.warnings.senderRequired}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hermills-provider-row">
              <span>{readySender?.label || copy.devLetter.mailSetup.defaultSenderLabel}</span>
              <Badge variant={readySender?.deliveryConfirmedAt ? 'default' : 'outline'}>
                {readySender?.deliveryConfirmedAt ? copy.devLetter.mailSetup.ready : copy.devLetter.mailSetup.confirmInbox}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenOutreach}>
              <Mail data-icon="inline-start" />
              {copy.common.details}
            </Button>
          </CardContent>
        </Card>

        <Card className="hermills-inspector-card">
          <CardHeader>
            <CardTitle>{copy.common.provider}</CardTitle>
            <CardDescription>{providerStatusSummary}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hermills-provider-row">
              <span>{activeProvider?.name || copy.assistant.localHermes}</span>
              <Badge variant={providerStatus === 'connected' ? 'default' : 'outline'}>{providerStatusLabel(providerStatus, copy)}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenProviders}>
              <KeyRound data-icon="inline-start" />
              {copy.common.provider}
            </Button>
          </CardContent>
        </Card>
      </aside>
    )
  }

  return (
    <aside className="hermills-inspector">
      <Card className="hermills-inspector-card">
        <CardHeader>
          <CardTitle>{copy.assistant.drawerTitle}</CardTitle>
          <CardDescription>{activeAgent?.name || copy.chat.defaultAssistant}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hermills-agent-avatar">
            <Bot />
          </div>
          <p>{localizedAgentDescription(activeAgent?.description, copy)}</p>
          <div className="hermills-mini-stack">
            <Badge variant="outline">{activeModel}</Badge>
            <Badge variant={chatReady ? 'default' : 'outline'}>{chatReady ? copy.runtime.meta.ready : copy.runtime.meta.notStarted}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenAssistants}>
            <Bot data-icon="inline-start" />
            {copy.common.assistants}
          </Button>
        </CardContent>
      </Card>

      <Card className="hermills-inspector-card">
        <CardHeader>
          <CardTitle>{copy.files.title}</CardTitle>
          <CardDescription>{selectedMaterials.length ? copy.files.attached(selectedMaterials.length) : copy.diagnostics.localFiles(materials.length)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hermills-file-stack">
            {(selectedMaterials.length ? selectedMaterials : materials.slice(0, 3)).map((material) => (
              <div className="hermills-file-pill" key={material.id}>
                <FileText />
                <span>{material.name}</span>
              </div>
            ))}
            {!materials.length ? <span className="hermills-muted-line">{copy.files.attachLocalFiles}</span> : null}
          </div>
          <Button variant="outline" size="sm" onClick={onOpenFiles}>
            <Paperclip data-icon="inline-start" />
            {copy.files.title}
          </Button>
        </CardContent>
      </Card>

      <Card className="hermills-inspector-card">
        <CardHeader>
          <CardTitle>{copy.computerControl.cards.tools}</CardTitle>
          <CardDescription>{computerReadinessDescription(computerStatus, copy)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hermills-tool-list">
            <span className="hermills-tool-label"><Cpu /> <span>{copy.topbar.computer}</span></span>
            <Badge variant={toolsReady ? 'default' : 'outline'}>{computerReadinessLabel(computerStatus, copy)}</Badge>
          </div>
          <div className="hermills-tool-list">
            <span className="hermills-tool-label"><Mail /> <span>{copy.devLetter.sectionLabel}</span></span>
            <Button variant="ghost" size="xs" onClick={onOpenOutreach}>{copy.common.details}</Button>
          </div>
          {needsPermission ? (
            <Button variant="secondary" size="sm" onClick={onRequestComputerPermission} disabled={computerPermissionBusy}>
              <ShieldCheck data-icon="inline-start" />
              {computerPermissionBusy ? copy.computerControl.permissionNudgeChecking : copy.computerControl.permissionNudgeAction}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="hermills-inspector-card">
        <CardHeader>
          <CardTitle>{copy.common.provider}</CardTitle>
          <CardDescription>{providerStatusSummary}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hermills-provider-row">
            <span>{activeProvider?.name || copy.assistant.localHermes}</span>
            <Badge variant={providerStatus === 'connected' ? 'default' : 'outline'}>{providerStatusLabel(providerStatus, copy)}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenProviders}>
            <KeyRound data-icon="inline-start" />
            {copy.common.provider}
          </Button>
        </CardContent>
      </Card>
    </aside>
  )
}

type ComputerControlChatState = 'ready' | 'needs-tools' | 'needs-driver' | 'not-installed' | 'unsupported' | 'failed'
type ComputerControlPayload = {
  state: ComputerControlChatState
  message: string
  createdAt?: string
}

function ComputerPermissionNudge({ busy, onAllow, copy }: { busy: boolean; onAllow: () => void; copy: UiCopy }) {
  return (
    <div className="computer-permission-nudge">
      <ShieldCheck size={16} />
      <span>
        <strong>{copy.computerControl.permissionNudgeTitle}</strong>
        <span>{copy.computerControl.permissionNudgeDetail}</span>
      </span>
      <button className="soft-button compact" type="button" onClick={onAllow} disabled={busy}>
        {busy ? copy.computerControl.permissionNudgeChecking : copy.computerControl.permissionNudgeAction}
      </button>
    </div>
  )
}

function ComputerControlInlinePanel({ payload, copy }: { payload: ComputerControlPayload; copy: UiCopy }) {
  return (
    <div className={`computer-inline-note ${payload.state}`}>
      <Cpu size={15} />
      <div>
        <strong>{copy.computerControl.inlineTitle}</strong>
        <span>{copy.computerControl.inlineSubtitle}</span>
      </div>
    </div>
  )
}

type LeadFormDraft = Required<Pick<OutreachLeadInput, 'companyName' | 'website' | 'country' | 'industry' | 'contactName' | 'contactTitle' | 'email' | 'need' | 'notes'>> & {
  tags: string
}

type SenderFormDraft = {
  id?: string
  label: string
  fromName: string
  email: string
  host: string
  port: string
  secure: boolean
  imapHost: string
  imapPort: string
  imapSecure: boolean
  imapUsername: string
  username: string
  password: string
  apiCredential: string
  apiAccountId: string
  apiBaseUrl: string
}

type SignatureFormDraft = {
  enabled: boolean
  text: string
  html: string
  logoEnabled: boolean
  logoAlt: string
  logoWidth: string
}

type OutreachMode = 'single' | 'campaign'
type LetterOutreachView = 'dashboard' | 'leads' | 'compose' | 'automation' | 'assets' | 'mail' | 'signature' | 'profile'
type LetterLeadFilter = 'all' | 'new' | 'drafted' | 'sent' | 'replied'
type LetterGenerationMode = 'single' | 'quick' | 'campaign'

const letterLeadFilters: Array<{ id: LetterLeadFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'new', label: '新客户' },
  { id: 'drafted', label: '待发送' },
  { id: 'sent', label: '已发送' },
  { id: 'replied', label: '已回复' },
]

const letterStateLabels: Record<string, string> = {
  input_ready: '待处理',
  waiting_user_send: '待发送',
  waiting_user_send_followup: '待发送跟进',
  waiting_response_status: '等待回复',
  drafting_reply_email: '回复草稿',
}

function leadMatchesLetterFilter(lead: OutreachLead, filter: LetterLeadFilter) {
  if (filter === 'all') return true
  if (filter === 'new') return lead.status === 'new' || lead.currentState === 'input_ready'
  if (filter === 'drafted') return lead.status === 'email_drafted' || lead.status === 'followup_drafted' || lead.currentState === 'waiting_user_send' || lead.currentState === 'waiting_user_send_followup'
  if (filter === 'sent') return lead.status === 'email_sent' || lead.status === 'contacted' || lead.currentState === 'waiting_response_status'
  return lead.status === 'reply_received' || lead.replyStatus === 'reply_received'
}

function letterLeadStatusLabel(lead: OutreachLead) {
  if (lead.status === 'email_drafted') return '邮件已生成'
  if (lead.status === 'followup_drafted') return '跟进已生成'
  if (lead.status === 'email_sent' || lead.status === 'contacted') return '已发送'
  if (lead.status === 'reply_received' || lead.replyStatus === 'reply_received') return '已回复'
  if (lead.status === 'followup_due') return '需跟进'
  return '新客户'
}

function domainCompanyName(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Imported customer'
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  const host = withoutProtocol.split(/[/?#]/)[0] || withoutProtocol
  const domain = host.split('@').pop() || host
  const name = domain.split('.')[0] || domain
  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Imported customer'
}

function csvEscape(value: string) {
  const normalized = value.replace(/\r?\n/g, ' ').trim()
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized
}

function letterRowsToCsv(input: string) {
  const raw = input.trim()
  if (!raw) return ''
  const firstLine = raw.split(/\r?\n/)[0]?.toLowerCase() ?? ''
  if (/company|公司|email|邮箱|website|网站/.test(firstLine)) return raw
  const rows = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const converted = rows.map((line) => {
    const cells = line.split(/[\t,，]+/).map((item) => item.trim()).filter(Boolean)
    const email = cells.find((item) => /@/.test(item)) ?? ''
    const website = cells.find((item) => /^https?:\/\//i.test(item) || /\.[a-z]{2,}(\/|$)/i.test(item)) ?? ''
    const contactName = cells.find((item) => item !== email && item !== website) ?? ''
    const companyName = domainCompanyName(website || email)
    return [companyName, email, website, contactName].map(csvEscape).join(',')
  })
  return ['company,email,website,contactName', ...converted].join('\n')
}

function letterGenerationSteps(mode: LetterGenerationMode) {
  if (mode === 'campaign') {
    return [
      { title: '锁定客户名单', detail: '读取本批客户的网站、邮箱、联系人和备注，跳过资料不完整的客户。' },
      { title: '逐个整理客户背景', detail: '提取客户网站里的业务线索、可能需求和风险点。' },
      { title: '匹配公司资料', detail: '把你的产品、认证、物流、付款条款和客户需求对齐。' },
      { title: '批量生成主题和正文', detail: '每个客户单独生成，不共用一封泛泛的群发邮件。' },
      { title: '等待人工审核', detail: '生成后逐封展示，必须由用户检查通过后才会进入发送队列。' },
    ]
  }
  return [
    { title: '整理客户资料', detail: '读取客户邮箱、网站、联系人、需求和备注。' },
    { title: '对照公司资料', detail: '匹配产品、认证、服务、物流和付款条款等可用卖点。' },
    { title: '选择切入角度', detail: '找一个买家可能在意的理由，避免只写空泛介绍。' },
    { title: '生成主题和正文', detail: '写出可编辑草稿，保持简洁、具体、像真人。' },
    { title: '准备质量检查', detail: '后续可检查找他理由、个性化、下一步和 2 秒可读性。' },
  ]
}

function LetterGenerationTrace({
  mode,
  running,
  completedAt,
  open,
  onToggle,
}: {
  mode: LetterGenerationMode
  running: boolean
  completedAt: string
  open: boolean
  onToggle: (open: boolean) => void
}) {
  const steps = letterGenerationSteps(mode)
  const status = running ? '正在生成' : completedAt ? '已完成' : '准备中'
  const statusText = completedAt && !running ? `${status} · ${new Date(completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : status
  return (
    <details className="letter-thinking-panel" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>
        <span><Brain size={16} /> 生成过程</span>
        <em>{statusText}</em>
      </summary>
      <div className="letter-thinking-note">这里显示的是可审核的生成步骤和依据，不展示模型内部私密推理链。</div>
      <ol className="letter-thinking-steps">
        {steps.map((step, index) => (
          <li className={running && index === steps.length - 1 ? 'active' : ''} key={step.title}>
            <span className="letter-thinking-dot">{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  )
}

function customerFitLabel(value: CustomerResearchBrief['fitVerdict']) {
  if (value === 'good-fit') return '适合开发'
  if (value === 'cautious') return '谨慎开发'
  if (value === 'poor-fit') return '不建议开发'
  return '证据不足'
}

function customerWriteModeLabel(value: CustomerResearchBrief['shouldWrite']) {
  if (value === 'yes') return '可以写'
  if (value === 'no') return '先别写'
  return '谨慎写'
}

function loopFitLabel(value?: OutreachLeadFitScore['fit']) {
  if (value === 'high') return '高机会'
  if (value === 'medium') return '中等机会'
  if (value === 'cautious') return '谨慎开发'
  if (value === 'low') return '低机会'
  return '未判断'
}

function loopAngleLabel(value?: NonNullable<OutreachLeadFitScore['primaryAngle']>) {
  const labels: Record<NonNullable<OutreachLeadFitScore['primaryAngle']>, string> = {
    'general-supply': '常规供应',
    'product-line-extension': '产品线补充',
    'new-product-development': '新品开发',
    'private-label-oem': '贴牌 / OEM',
    'project-specification': '项目规格',
    'certification-compliance': '认证证明',
    'material-complement': '互补材料',
    'backup-capacity': '备用产能',
    'channel-partnership': '渠道合作',
    other: '其他角度',
  }
  return value ? labels[value] : '未选择'
}

function LetterQualitySummary({
  review,
  strategy,
  riskReview,
  researchBrief,
  leadFitScore,
  evidenceLock,
  valueMatch,
  learningSignal,
  evidenceUsed,
  generationSummary,
  matchedExampleCount,
  modelUsed,
  stale,
  copy,
}: {
  review?: OutreachEmailQualityReview
  strategy?: OutreachStrategyMatch
  riskReview?: OutreachSendRiskReview
  researchBrief?: CustomerResearchBrief
  leadFitScore?: OutreachLeadFitScore
  evidenceLock?: OutreachEvidenceLock
  valueMatch?: OutreachValueMatch
  learningSignal?: OutreachLearningSignal
  evidenceUsed?: OutreachEvidenceItem[]
  generationSummary?: string
  matchedExampleCount?: number
  modelUsed?: string
  stale?: boolean
  copy: UiCopy
}) {
  if (!review) {
    return (
      <div className="quality-review-card empty">
        <div className="quality-review-top">
          <strong>{copy.devLetter.quality.title}</strong>
          <span>{copy.devLetter.quality.notReviewed}</span>
        </div>
        <p>发送或通过前建议先检查一次，系统会看找他理由、个性化和下一步是否清楚。</p>
      </div>
    )
  }
  const className = `quality-review-card ${review.level}${stale ? ' stale' : ''}`
  return (
    <div className={className}>
      <div className="quality-review-top">
        <strong>{stale ? copy.devLetter.quality.stale : copy.devLetter.quality.title}</strong>
        <span>{copy.devLetter.quality.score(review.score)}</span>
      </div>
      <div className="quality-review-checks">
        {review.checks.map((check) => (
          <span className={check.passed ? 'passed' : 'failed'} key={check.id}>
            {check.passed ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            {copy.devLetter.quality.checks[check.id]}
          </span>
        ))}
      </div>
      {review.summary ? <p>{review.summary}</p> : null}
      {researchBrief ? (
        <details className={`letter-research-brief ${researchBrief.fitVerdict}`} open>
          <summary>
            <span>客户判断简报</span>
            <em>{customerFitLabel(researchBrief.fitVerdict)} · {customerWriteModeLabel(researchBrief.shouldWrite)}</em>
          </summary>
          <div className="letter-research-brief-grid">
            <span><strong>客户类型</strong>{researchBrief.buyerTypeDetail || '暂未判断'}</span>
            <span><strong>最佳切入点</strong>{researchBrief.bestAngle || researchBrief.bestOutreachPath || '暂未判断'}</span>
            <span><strong>采购信号</strong>{researchBrief.purchaseIntentSignal || '暂未找到明确采购信号'}</span>
            <span><strong>主要风险</strong>{researchBrief.mainRisk || '暂未发现明显风险'}</span>
          </div>
          {researchBrief.bestOutreachPath ? <p>{researchBrief.bestOutreachPath}</p> : null}
          {researchBrief.claimsToAvoid.length ? (
            <div className="letter-claims-avoid">
              <strong>不能这样写</strong>
              <ul>
                {researchBrief.claimsToAvoid.slice(0, 4).map((claim) => <li key={claim}>{claim}</li>)}
              </ul>
            </div>
          ) : null}
        </details>
      ) : null}
      {leadFitScore || valueMatch || evidenceLock ? (
        <details className="letter-loop-summary" open>
          <summary>开发 Loop 摘要</summary>
          <div className="letter-loop-grid">
            <span><strong>开发评分</strong>{leadFitScore ? `${leadFitScore.score}/100 · ${loopFitLabel(leadFitScore.fit)}` : '未记录'}</span>
            <span><strong>推荐角度</strong>{loopAngleLabel(leadFitScore?.primaryAngle)}</span>
            <span><strong>预计回复率</strong>{leadFitScore?.expectedReplyRate ? `${leadFitScore.expectedReplyRate.minPercent}-${leadFitScore.expectedReplyRate.maxPercent}%` : '未估算'}</span>
            <span><strong>证据锁</strong>{evidenceLock ? `${evidenceLock.usableFacts.length} 条可用 · ${evidenceLock.mustNotSay.length} 条禁说` : '未锁定'}</span>
          </div>
          {leadFitScore?.recommendedApproach ? <p>{leadFitScore.recommendedApproach}</p> : null}
          {valueMatch ? (
            <div className="letter-value-match">
              <span><strong>只用这个卖点</strong>{valueMatch.specificValue || '未记录'}</span>
              <span><strong>客户问题</strong>{valueMatch.customerConcern || '未记录'}</span>
              <span><strong>CTA</strong>{valueMatch.cta || '未记录'}</span>
            </div>
          ) : null}
          {evidenceLock?.mustNotSay?.length ? (
            <ul className="letter-loop-risks">
              {evidenceLock.mustNotSay.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
          {learningSignal?.recordedAt ? <em className="letter-loop-learning">已记录学习信号：{learningSignal.replyOutcome}</em> : null}
        </details>
      ) : null}
      {strategy ? (
        <div className="letter-strategy-summary">
          <span><strong>切入点</strong>{strategy.buyerPain || '未记录'}</span>
          <span><strong>匹配 USP</strong>{strategy.selectedUsp || '未记录'}</span>
          <span><strong>CTA 资产</strong>{strategy.microOffer || '未记录'}</span>
        </div>
      ) : null}
      {generationSummary || matchedExampleCount || modelUsed ? (
        <details className="letter-harness-summary">
          <summary>为什么这样写</summary>
          {generationSummary ? <p>{generationSummary}</p> : null}
          <div className="letter-harness-meta">
            {modelUsed ? <span>模型：{modelUsed}</span> : null}
            {matchedExampleCount ? <span>参考好样例：{matchedExampleCount} 个</span> : <span>还没有参考好样例</span>}
          </div>
        </details>
      ) : null}
      {evidenceUsed?.length ? (
        <details className="letter-evidence-summary">
          <summary>证据来源</summary>
          <div className="letter-evidence-list">
            {evidenceUsed.slice(0, 8).map((item) => (
              <article className="letter-evidence-item" key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
                <em>{item.source}{item.sourceUrl ? ` · ${item.sourceUrl}` : ''}</em>
                {item.snippet ? <p>{item.snippet}</p> : null}
              </article>
            ))}
          </div>
        </details>
      ) : null}
      {riskReview ? (
        <div className={`letter-risk-summary ${riskReview.level}`}>
          <div>
            <ShieldCheck size={14} />
            <strong>发送风控 {riskReview.score}/100</strong>
            <em>{riskReview.level === 'blocked' ? '阻断' : riskReview.level === 'warning' ? '警告' : '通过'}</em>
          </div>
          {riskReview.issues.length ? (
            <ul>
              {riskReview.issues.slice(0, 4).map((issue) => <li key={`${issue.id}-${issue.message}`}>{issue.message}</li>)}
            </ul>
          ) : <p>没有发现发送阻断风险。</p>}
        </div>
      ) : null}
    </div>
  )
}

function DevelopmentLetterPage({
  companyProfile,
  companyMaterials,
  leads,
  setLeads,
  campaigns,
  setCampaigns,
  senderAccounts,
  setSenderAccounts,
  cloudStatus,
  setCloudStatus,
  providers,
  onOpenCompanyKnowledge,
  onOpenChat,
  onOpenSettings,
  copy,
}: {
  companyProfile: CompanyProfile
  companyMaterials: Material[]
  leads: OutreachLead[]
  setLeads: (leads: OutreachLead[]) => void
  campaigns: OutreachCampaign[]
  setCampaigns: Dispatch<SetStateAction<OutreachCampaign[]>>
  senderAccounts: OutreachSenderAccount[]
  setSenderAccounts: (accounts: OutreachSenderAccount[]) => void
  cloudStatus: CloudStatus
  setCloudStatus: (status: CloudStatus) => void
  providers: Provider[]
  onOpenCompanyKnowledge: () => void
  onOpenChat: () => void
  onOpenSettings: () => void
  copy: UiCopy
}) {
  const [leadDraft, setLeadDraft] = useState<LeadFormDraft>(() => emptyLeadDraft())
  const [quickWebsite, setQuickWebsite] = useState('')
  const [quickEmail, setQuickEmail] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [outreachMode, setOutreachMode] = useState<OutreachMode>('single')
  const [letterView, setLetterView] = useState<LetterOutreachView>('dashboard')
  const [leadSearch, setLeadSearch] = useState('')
  const [leadFilter, setLeadFilter] = useState<LetterLeadFilter>('all')
  const [selectedLetterLeadIds, setSelectedLetterLeadIds] = useState<string[]>([])
  const [bulkImportText, setBulkImportText] = useState('')
  const [campaignName, setCampaignName] = useState(copy.devLetter.batch.defaultName)
  const [selectedCampaignLeadIds, setSelectedCampaignLeadIds] = useState<string[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [selectedCampaignRecipientId, setSelectedCampaignRecipientId] = useState('')
  const [campaignDraftSubject, setCampaignDraftSubject] = useState('')
  const [campaignDraftBody, setCampaignDraftBody] = useState('')
  const [followUps, setFollowUps] = useState<OutreachFollowUpJob[]>([])
  const [csvText, setCsvText] = useState('')
  const [csvOpen, setCsvOpen] = useState(false)
  const [draft, setDraft] = useState<OutreachDraft>()
  const [workflow, setWorkflow] = useState<OutreachWorkflow>()
  const [selectedEmailId, setSelectedEmailId] = useState('')
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [generationMode, setGenerationMode] = useState<LetterGenerationMode>('single')
  const [generationOpen, setGenerationOpen] = useState(true)
  const [generationCompletedAt, setGenerationCompletedAt] = useState('')
  const [language, setLanguage] = useState(copy.devLetter.defaults.language)
  const [tone, setTone] = useState(copy.devLetter.defaults.tone)
  const [senderDraft, setSenderDraft] = useState<SenderFormDraft>(() => emptySenderDraft(companyProfile, copy))
  const [senderProviderId, setSenderProviderId] = useState<SenderProviderId>('gmail')
  const [senderChannelId, setSenderChannelId] = useState<SenderChannelId>('smtp')
  const [selectedSenderId, setSelectedSenderId] = useState('')
  const [senderTestRecipient, setSenderTestRecipient] = useState('')
  const [mailAdvancedOpen, setMailAdvancedOpen] = useState(false)
  const [emailSignature, setEmailSignature] = useState<OutreachEmailSignature>()
  const [signatureDraft, setSignatureDraft] = useState<SignatureFormDraft>(() => emptySignatureDraft(companyProfile))
  const [buyerPersonas, setBuyerPersonas] = useState<OutreachBuyerPersona[]>([])
  const [uspAssets, setUspAssets] = useState<OutreachUspCandidate[]>([])
  const [ctaAssets, setCtaAssets] = useState<OutreachCtaAsset[]>([])
  const [goldenExamples, setGoldenExamples] = useState<OutreachGoldenExample[]>([])
  const [personaDraft, setPersonaDraft] = useState({ name: '', companyType: '', buyerRoles: '', painPoints: '' })
  const [uspDraft, setUspDraft] = useState({ headline: '', buyerAngle: '', proof: '', category: 'Strategic value' })
  const [ctaDraft, setCtaDraft] = useState({ name: '', type: 'sample_options' as OutreachCtaAsset['type'], description: '', assetText: '' })
  const [goldenDraft, setGoldenDraft] = useState({ title: '', industry: '', buyerType: '', productLine: '', market: '', subject: '', body: '', tags: '' })
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const quickWebsiteRef = useRef<HTMLInputElement>(null)
  const draftBodyRef = useRef<HTMLTextAreaElement>(null)
  const senderEmailRef = useRef<HTMLInputElement>(null)
  const campaignNameEditedRef = useRef(false)
  const languageEditedRef = useRef(false)
  const toneEditedRef = useRef(false)
  const selectedLead = selectedLeadId ? leads.find((lead) => lead.id === selectedLeadId) : undefined
  const selectedSender = selectedSenderId ? senderAccounts.find((account) => account.id === selectedSenderId) : undefined
  const selectedCampaign = selectedCampaignId ? campaigns.find((campaign) => campaign.id === selectedCampaignId) : campaigns[0]
  const campaignRecipients = selectedCampaign?.recipients ?? []
  const selectedCampaignFollowUps = useMemo(() => (
    selectedCampaign ? followUps.filter((job) => job.campaignId === selectedCampaign.id) : []
  ), [followUps, selectedCampaign?.id])
  const campaignFollowUpStats = useMemo(() => ({
    scheduled: selectedCampaignFollowUps.filter((job) => job.status === 'scheduled').length,
    ready: selectedCampaignFollowUps.filter((job) => job.status === 'ready').length,
    sent: selectedCampaignFollowUps.filter((job) => job.status === 'sent').length,
    stopped: selectedCampaignFollowUps.filter((job) => job.status === 'stopped').length,
    failed: selectedCampaignFollowUps.filter((job) => job.status === 'failed').length,
  }), [selectedCampaignFollowUps])
  const nextFollowUps = selectedCampaignFollowUps.filter((job) => job.status === 'scheduled' || job.status === 'ready').slice(0, 3)
  const selectedCampaignRecipient = selectedCampaignRecipientId
    ? campaignRecipients.find((recipient) => recipient.id === selectedCampaignRecipientId)
    : campaignRecipients.find((recipient) => recipient.status === 'generated' || recipient.status === 'failed') ?? campaignRecipients[0]
  const defaultProvider = providers.find((provider) => provider.status === 'connected')
  const workflowEmails = useMemo<EmailSequenceDraft[]>(() => workflow ? [workflow.initialEmail, ...workflow.followUps] : [], [workflow])
  const selectedWorkflowEmail = workflowEmails.find((email) => email.id === selectedEmailId) ?? workflowEmails[0]
  const activeDraftId = selectedWorkflowEmail?.draftId ?? draft?.id
  const activeDraftStatus = selectedWorkflowEmail?.status ?? draft?.status
  const senderLoginReady = Boolean(selectedSender?.lastTestedAt && !selectedSender.lastError)
  const senderTestEmailReady = Boolean(selectedSender?.lastTestEmailAt && !selectedSender.lastError)
  const senderDeliveryReady = Boolean(selectedSender?.deliveryConfirmedAt)
  const senderProvider = senderProviderPresets.find((provider) => provider.id === senderProviderId) ?? senderProviderPresets[0]
  const senderAuthGuide = senderAuthGuides[senderProviderId]
  const senderChannel = senderChannelOptions.find((channel) => channel.id === senderChannelId) ?? senderChannelOptions[3]
  const senderApiChannelSelected = senderChannel.id !== 'smtp'
  const senderRecommendedApiChannel = senderChannelOptions.find((channel) => channel.id === recommendedSenderApiChannel(senderProviderId)) ?? senderChannelOptions[4]
  const quickLeadReady = Boolean(quickWebsite.trim() && quickEmail.trim())
  const companyReady = isCompanyProfileReady(companyProfile)
  const campaignSelectedCount = selectedCampaignLeadIds.length || selectedCampaign?.recipients.length || 0
  const campaignReviewCount = selectedCampaign?.stats.generated ?? 0
  const campaignReadyCount = selectedCampaign?.stats.approved ?? 0
  const campaignSentCount = selectedCampaign?.stats.sent ?? 0
  const activeQualityReview = selectedWorkflowEmail?.qualityReview ?? draft?.qualityReview
  const activeStrategyMatch = selectedWorkflowEmail?.strategyMatch ?? draft?.strategyMatch
  const activeRiskReview = selectedWorkflowEmail?.sendRiskReview ?? draft?.sendRiskReview
  const activeResearchBrief = selectedWorkflowEmail?.researchBrief ?? draft?.researchBrief ?? workflow?.research.brief
  const activeLeadFitScore = selectedWorkflowEmail?.leadFitScore ?? draft?.leadFitScore
  const activeEvidenceLock = selectedWorkflowEmail?.evidenceLock ?? draft?.evidenceLock
  const activeValueMatch = selectedWorkflowEmail?.valueMatch ?? draft?.valueMatch
  const activeLearningSignal = selectedWorkflowEmail?.learningSignal ?? draft?.learningSignal
  const activeEvidenceUsed = draft?.evidenceUsed ?? selectedWorkflowEmail?.evidenceMap?.verifiedFacts?.filter((item) => item.usedInEmail) ?? []
  const activeGenerationSummary = draft?.generationSummary
  const activeMatchedExampleCount = draft?.matchedExampleIds?.length ?? 0
  const activeModelUsed = draft?.modelUsed ?? draft?.model
  const singleDraftChanged = selectedWorkflowEmail
    ? selectedWorkflowEmail.subject !== draftSubject || selectedWorkflowEmail.body !== draftBody
    : Boolean(draft && (draft.subject !== draftSubject || draft.body !== draftBody))
  const campaignQualityReview = selectedCampaignRecipient?.draft?.qualityReview
  const campaignStrategyMatch = selectedCampaignRecipient?.draft?.strategyMatch
  const campaignRiskReview = selectedCampaignRecipient?.draft?.sendRiskReview
  const campaignResearchBrief = selectedCampaignRecipient?.draft?.researchBrief
  const campaignLeadFitScore = selectedCampaignRecipient?.draft?.leadFitScore ?? selectedCampaignRecipient?.leadFitScore
  const campaignEvidenceLock = selectedCampaignRecipient?.draft?.evidenceLock ?? selectedCampaignRecipient?.evidenceLock
  const campaignValueMatch = selectedCampaignRecipient?.draft?.valueMatch ?? selectedCampaignRecipient?.valueMatch
  const campaignLearningSignal = selectedCampaignRecipient?.draft?.learningSignal ?? selectedCampaignRecipient?.learningSignal
  const campaignEvidenceUsed = selectedCampaignRecipient?.draft?.evidenceUsed ?? []
  const campaignGenerationSummary = selectedCampaignRecipient?.draft?.generationSummary
  const campaignMatchedExampleCount = selectedCampaignRecipient?.draft?.matchedExampleIds?.length ?? 0
  const campaignModelUsed = selectedCampaignRecipient?.draft?.modelUsed ?? selectedCampaignRecipient?.draft?.model
  const campaignDraftChanged = Boolean(selectedCampaignRecipient?.draft && (
    selectedCampaignRecipient.draft.subject !== campaignDraftSubject ||
    selectedCampaignRecipient.draft.body !== campaignDraftBody
  ))
  const campaignQualityPassed = Boolean(campaignQualityReview?.passed && !campaignDraftChanged)
  const singleGenerationRunning = busy === 'generate' || busy === 'auto'
  const campaignGenerationRunning = busy === 'campaignGenerate' || busy === 'letterImportGenerate' || busy === 'letterFileGenerate'
  const singleGenerationCompletedAt = generationMode === 'campaign' ? '' : generationCompletedAt
  const campaignGenerationCompletedAt = generationMode === 'campaign' ? generationCompletedAt : ''
  const hasVisibleSingleDraft = Boolean(activeDraftId || draftSubject.trim() || draftBody.trim() || workflow || singleGenerationRunning)
  const hasVisibleCampaignDraft = Boolean(selectedCampaign || campaignGenerationRunning)
  const singleSendBlocker = activeDraftStatus === 'sent'
    ? copy.devLetter.results.status.sent
    : !activeDraftId
      ? copy.devLetter.warnings.draftRequired
      : singleDraftChanged
        ? copy.devLetter.quality.saveBeforeReview
        : !activeQualityReview?.passed
          ? copy.devLetter.quality.blockedSend
          : activeRiskReview?.level === 'blocked'
            ? (activeRiskReview.issues.find((issue) => issue.blocking)?.message ?? '发送风控未通过')
            : !senderDeliveryReady
              ? copy.devLetter.warnings.senderNotConfirmed
              : ''
  const canSendSingleDraft = !singleSendBlocker && busy !== 'send'
  const letterStats = useMemo(() => ({
    total: leads.length,
    new: leads.filter((lead) => leadMatchesLetterFilter(lead, 'new')).length,
    drafted: leads.filter((lead) => leadMatchesLetterFilter(lead, 'drafted')).length,
    waiting: leads.filter((lead) => lead.currentState === 'waiting_response_status').length,
    replied: leads.filter((lead) => leadMatchesLetterFilter(lead, 'replied')).length,
  }), [leads])
  const filteredLetterLeads = useMemo(() => {
    const query = leadSearch.trim().toLowerCase()
    return leads.filter((lead) => {
      if (!leadMatchesLetterFilter(lead, leadFilter)) return false
      if (!query) return true
      return [lead.companyName, lead.email, lead.website, lead.contactName, lead.country, lead.industry]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [leads, leadFilter, leadSearch])
  const selectedLetterLeads = useMemo(() => leads.filter((lead) => selectedLetterLeadIds.includes(lead.id)), [leads, selectedLetterLeadIds])

  useEffect(() => {
    if (!languageEditedRef.current) setLanguage(copy.devLetter.defaults.language)
  }, [copy.devLetter.defaults.language])

  useEffect(() => {
    if (!toneEditedRef.current) setTone(copy.devLetter.defaults.tone)
  }, [copy.devLetter.defaults.tone])

  useEffect(() => {
    if (!campaignNameEditedRef.current) setCampaignName(copy.devLetter.batch.defaultName)
  }, [copy.devLetter.batch.defaultName])

  useEffect(() => {
    setSenderDraft((current) => {
      if (current.id) return current
      return {
        ...current,
        label: isDefaultSenderLabel(current.label, copy) ? copy.devLetter.mailSetup.defaultSenderLabel : current.label,
        fromName: isDefaultSenderFromName(current.fromName, companyProfile, copy)
          ? companyProfile.name || copy.devLetter.mailSetup.defaultSenderFromName
          : current.fromName,
      }
    })
  }, [companyProfile.name, copy])

  useEffect(() => {
    if (!selectedLead) return
    setLeadDraft(leadFormFromLead(selectedLead))
  }, [selectedLead?.id])

  useEffect(() => {
    if (!selectedLead?.id) {
      setDraft(undefined)
      setWorkflow(undefined)
      setSelectedEmailId('')
      setDraftSubject('')
      setDraftBody('')
      return
    }
    if (workflow?.leadId === selectedLead.id) return
    let cancelled = false
    api.outreachDrafts()
      .then((drafts) => {
        if (cancelled) return
        const latest = drafts
          .filter((item) => item.leadId === selectedLead.id)
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]
        setWorkflow(undefined)
        setSelectedEmailId('')
        setDraft(latest)
        setDraftSubject(latest?.subject ?? '')
        setDraftBody(latest?.body ?? '')
      })
      .catch(() => {
        if (!cancelled) setDraft(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [selectedLead?.id, workflow?.leadId])

  useEffect(() => {
    if (!selectedSender) return
    setSenderDraft(senderFormFromAccount(selectedSender))
    setSenderProviderId((selectedSender.provider as SenderProviderId | undefined) ?? senderProviderFromHost(selectedSender.host))
    setSenderChannelId(senderChannelFromAccount(selectedSender))
  }, [selectedSender?.id])

  useEffect(() => {
    let cancelled = false
    api.outreachEmailSignature()
      .then((settings) => {
        if (cancelled) return
        setEmailSignature(settings)
        setSignatureDraft(signatureFormFromSettings(settings, companyProfile))
      })
      .catch((err) => {
        if (!cancelled) setError(humanizeErrorMessage(err, copy, 'message'))
      })
    return () => {
      cancelled = true
    }
  }, [companyProfile.name, companyProfile.website])

  useEffect(() => {
    let cancelled = false
    Promise.all([api.outreachBuyerPersonas(), api.outreachUsps(), api.outreachCtaAssets(), api.outreachGoldenExamples()])
      .then(([personas, usps, ctas, examples]) => {
        if (cancelled) return
        setBuyerPersonas(personas)
        setUspAssets(usps)
        setCtaAssets(ctas)
        setGoldenExamples(examples)
      })
      .catch(() => {
        if (cancelled) return
        setBuyerPersonas([])
        setUspAssets([])
        setCtaAssets([])
        setGoldenExamples([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedSenderId && senderAccounts[0]) setSelectedSenderId(senderAccounts[0].id)
  }, [selectedSenderId, senderAccounts])

  useEffect(() => {
    if (!selectedCampaignId && campaigns[0]) setSelectedCampaignId(campaigns[0].id)
  }, [selectedCampaignId, campaigns])

  useEffect(() => {
    if (!selectedCampaign?.id) {
      setFollowUps([])
      return
    }
    let cancelled = false
    api.outreachFollowUps(selectedCampaign.id)
      .then((jobs) => {
        if (!cancelled) setFollowUps(jobs)
      })
      .catch(() => {
        if (!cancelled) setFollowUps([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedCampaign?.id])

  useEffect(() => {
    if (!selectedCampaignRecipient?.draft) {
      setCampaignDraftSubject('')
      setCampaignDraftBody('')
      return
    }
    setCampaignDraftSubject(selectedCampaignRecipient.draft.subject)
    setCampaignDraftBody(selectedCampaignRecipient.draft.body)
  }, [selectedCampaignRecipient?.id, selectedCampaignRecipient?.draft?.updatedAt])

  function selectWorkflowEmail(email: EmailSequenceDraft) {
    setSelectedEmailId(email.id)
    setDraftSubject(email.subject)
    setDraftBody(email.body)
  }

  function updateWorkflowEmail(emailId: string, updates: Partial<EmailSequenceDraft>) {
    setWorkflow((current) => {
      if (!current) return current
      const updatedAt = new Date().toISOString()
      if (current.initialEmail.id === emailId) {
        return { ...current, initialEmail: { ...current.initialEmail, ...updates }, updatedAt }
      }
      return {
        ...current,
        followUps: current.followUps.map((email) => email.id === emailId ? { ...email, ...updates } : email),
        updatedAt
      }
    })
  }

  function updateLead(field: keyof LeadFormDraft, value: string) {
    setLeadDraft((current) => ({ ...current, [field]: value }))
  }

  function updateSender(field: keyof SenderFormDraft, value: string | boolean) {
    setSenderDraft((current) => ({ ...current, [field]: value }))
  }

  function updateSignature(field: keyof SignatureFormDraft, value: string | boolean) {
    setSignatureDraft((current) => ({ ...current, [field]: value }))
  }

  function applySenderProviderToDraft(current: SenderFormDraft, id: SenderProviderId): SenderFormDraft {
    const preset = senderProviderPresets.find((item) => item.id === id)
    if (!preset || id === 'custom') return current
    return {
      ...current,
      label: isDefaultSenderLabel(current.label, copy) ? copy.devLetter.mailSetup.providerSenderLabel(preset.label) : current.label,
      host: preset.host,
      port: preset.port,
      secure: preset.secure,
      imapHost: preset.imapHost,
      imapPort: preset.imapPort,
      imapSecure: preset.imapSecure,
      imapUsername: current.imapUsername || current.username || current.email,
      username: current.username || current.email,
    }
  }

  function chooseSenderProvider(id: SenderProviderId) {
    setSenderProviderId(id)
    setSenderChannelId('smtp')
    setSenderDraft((current) => applySenderProviderToDraft(current, id))
  }

  function chooseSenderChannel(id: SenderChannelId) {
    const channel = senderChannelOptions.find((item) => item.id === id)
    const presetId = channel?.smtpPresetId
    setSenderChannelId(id)
    if (presetId) {
      setSenderProviderId(presetId)
      setSenderDraft((current) => applySenderProviderToDraft(current, presetId))
    }
  }

  function formatSenderDeliveryError(message: string): string {
    const trimmed = message.trim()
    if (!trimmed || trimmed.includes('建议改选')) return trimmed
    if (!/(smtp|imap|mailbox|email|sendmail|connection|socket|greeting|invalid login|eauth|esocket|econnreset|etimedout|5(?:3[45]|50|53|54)|授权|密码|登录|连接|邮件|邮箱)/i.test(trimmed)) return trimmed
    return `${trimmed} 建议改选“${senderRecommendedApiChannel.label}”通道，避开 SMTP 授权或连接限制。`
  }

  function updateSenderEmail(email: string) {
    const detected = senderProviderFromEmail(email)
    if (detected) setSenderProviderId(detected)
    setSenderDraft((current) => {
      const next = {
        ...current,
        email,
        username: current.username && current.username !== current.email ? current.username : email,
        imapUsername: current.imapUsername && current.imapUsername !== current.email ? current.imapUsername : email,
      }
      return detected ? applySenderProviderToDraft(next, detected) : next
    })
  }

  function replaceSenderAccount(sender: OutreachSenderAccount) {
    setSenderAccounts(senderAccounts.some((account) => account.id === sender.id)
      ? senderAccounts.map((account) => account.id === sender.id ? sender : account)
      : [sender, ...senderAccounts])
    setSelectedSenderId(sender.id)
    setSenderDraft(senderFormFromAccount(sender))
    setSenderProviderId((sender.provider as SenderProviderId | undefined) ?? senderProviderFromHost(sender.host))
    setSenderChannelId(senderChannelFromAccount(sender))
  }

  function replaceCampaign(campaign: OutreachCampaign) {
    setCampaigns((current) => current.some((item) => item.id === campaign.id)
      ? current.map((item) => item.id === campaign.id ? campaign : item)
      : [campaign, ...current])
    setSelectedCampaignId(campaign.id)
    const reviewCandidate = campaign.recipients.find((recipient) => recipient.status === 'generated' || recipient.status === 'failed') ?? campaign.recipients[0]
    if (reviewCandidate) setSelectedCampaignRecipientId(reviewCandidate.id)
  }

  async function pollCampaignGeneration(campaignId: string) {
    for (let attempt = 0; attempt < 900; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1200))
      const campaign = await api.outreachCampaign(campaignId)
      replaceCampaign(campaign)
      const stillRunning = campaign.status === 'generating' || campaign.recipients.some((recipient) => recipient.status === 'pending' || recipient.status === 'researching')
      if (!stillRunning) return campaign
    }
    return api.outreachCampaign(campaignId)
  }

  async function refreshCampaignFollowUps(campaignId = selectedCampaign?.id) {
    if (!campaignId) {
      setFollowUps([])
      return
    }
    setFollowUps(await api.outreachFollowUps(campaignId))
  }

  function splitAssetLines(value: string) {
    return value.split(/[\n;；、,，]/).map((item) => item.trim()).filter(Boolean)
  }

  async function saveBuyerPersonaAsset() {
    if (!personaDraft.name.trim()) {
      setError('请先填写画像名称。')
      return
    }
    setBusy('assetPersona')
    setError('')
    setNotice('')
    try {
      const saved = await api.saveOutreachBuyerPersona({
        name: personaDraft.name.trim(),
        companyType: personaDraft.companyType.trim(),
        buyerRoles: splitAssetLines(personaDraft.buyerRoles),
        painPoints: splitAssetLines(personaDraft.painPoints),
        successMetrics: [],
        objections: [],
        triggerEvents: [],
        evidenceNotes: [],
        enabled: true,
      })
      setBuyerPersonas([saved, ...buyerPersonas])
      setPersonaDraft({ name: '', companyType: '', buyerRoles: '', painPoints: '' })
      setNotice('买家画像已保存。')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function saveUspAsset() {
    if (!uspDraft.headline.trim()) {
      setError('请先填写 USP 标题。')
      return
    }
    setBusy('assetUsp')
    setError('')
    setNotice('')
    try {
      const saved = await api.saveOutreachUsp({
        category: uspDraft.category.trim() || 'Strategic value',
        headline: uspDraft.headline.trim(),
        buyerAngle: uspDraft.buyerAngle.trim(),
        proof: uspDraft.proof.trim(),
        proofLevel: uspDraft.proof.trim() ? 'profile-derived' : 'needs-proof',
        assetIds: [],
        enabled: true,
      })
      setUspAssets([saved, ...uspAssets])
      setUspDraft({ headline: '', buyerAngle: '', proof: '', category: 'Strategic value' })
      setNotice('USP 已保存。')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function saveCtaAsset() {
    if (!ctaDraft.name.trim()) {
      setError('请先填写 CTA 资产名称。')
      return
    }
    setBusy('assetCta')
    setError('')
    setNotice('')
    try {
      const saved = await api.saveOutreachCtaAsset({
        name: ctaDraft.name.trim(),
        type: ctaDraft.type,
        description: ctaDraft.description.trim(),
        assetText: ctaDraft.assetText.trim(),
        enabled: true,
      })
      setCtaAssets([saved, ...ctaAssets])
      setCtaDraft({ name: '', type: 'sample_options', description: '', assetText: '' })
      setNotice('CTA 资产已保存。')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function saveGoldenExampleAsset(input?: Partial<Omit<typeof goldenDraft, 'tags'>> & { tags?: string | string[]; sourceDraftId?: string; qualityScore?: number }) {
    const source = { ...goldenDraft, ...input }
    if (!source.subject.trim() || !source.body.trim()) {
      setError('请先填写邮件主题和正文。')
      return
    }
    setBusy(input?.sourceDraftId ? 'assetGoldenFromDraft' : 'assetGolden')
    setError('')
    setNotice('')
    try {
      const saved = await api.saveOutreachGoldenExample({
        title: source.title.trim() || source.subject.trim(),
        industry: source.industry.trim(),
        buyerType: source.buyerType.trim(),
        productLine: source.productLine.trim(),
        market: source.market.trim(),
        subject: source.subject.trim(),
        body: source.body.trim(),
        tags: Array.isArray(source.tags) ? source.tags : splitAssetLines(source.tags),
        sourceDraftId: input?.sourceDraftId,
        qualityScore: input?.qualityScore,
        enabled: true,
      })
      setGoldenExamples([saved, ...goldenExamples])
      if (!input?.sourceDraftId) setGoldenDraft({ title: '', industry: '', buyerType: '', productLine: '', market: '', subject: '', body: '', tags: '' })
      setNotice('黄金邮件样例已保存。以后写信会参考它的质量和表达方式。')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function saveCurrentDraftAsGoldenExample() {
    const sourceDraftId = activeDraftId
    await saveGoldenExampleAsset({
      title: draftSubject.trim() ? `${draftSubject.trim()} 样例` : '开发信好样例',
      industry: selectedLead?.industry || workflow?.research.industry || '',
      buyerType: workflow?.research.buyerType || '',
      productLine: activeStrategyMatch?.selectedUsp || '',
      subject: draftSubject,
      body: draftBody,
      tags: ['golden', 'single'],
      sourceDraftId,
      qualityScore: activeQualityReview?.score,
    })
  }

  async function saveCampaignDraftAsGoldenExample() {
    if (!selectedCampaignRecipient?.draft) return
    await saveGoldenExampleAsset({
      title: campaignDraftSubject.trim() ? `${campaignDraftSubject.trim()} 样例` : `${selectedCampaignRecipient.companyName} 好样例`,
      industry: selectedCampaignRecipient.draft.strategyMatch?.buyerPain || '',
      buyerType: selectedCampaignRecipient.companyName,
      productLine: selectedCampaignRecipient.draft.strategyMatch?.selectedUsp || '',
      subject: campaignDraftSubject,
      body: campaignDraftBody,
      tags: ['golden', 'campaign'],
      sourceDraftId: selectedCampaignRecipient.draft.id,
      qualityScore: selectedCampaignRecipient.draft.qualityReview?.score,
    })
  }

  function toggleCampaignLead(leadId: string) {
    setSelectedCampaignLeadIds((current) => current.includes(leadId)
      ? current.filter((id) => id !== leadId)
      : [...current, leadId])
  }

  function requireCompanyKnowledge() {
    if (companyReady) return true
    setError(copy.devLetter.status.companyMissing)
    onOpenCompanyKnowledge()
    return false
  }

  async function createCampaign() {
    if (!requireCompanyKnowledge()) return
    if (!selectedCampaignLeadIds.length) {
      setError(copy.devLetter.batch.warnings.noCustomers)
      return
    }
    const selectedLeads = leads.filter((lead) => selectedCampaignLeadIds.includes(lead.id))
    const missing = selectedLeads.find((lead) => !lead.website || !lead.email)
    if (missing) {
      setError(copy.devLetter.batch.warnings.missingCustomer(missing.companyName))
      return
    }
    setBusy('campaignCreate')
    setError('')
    setNotice('')
    try {
      const campaign = await api.createOutreachCampaign({
        name: campaignName.trim() || copy.devLetter.batch.defaultName,
        leadIds: selectedCampaignLeadIds,
        senderAccountId: selectedSender?.id,
        language,
        tone,
        providerId: defaultProvider?.id,
        model: defaultProvider?.defaultModel,
        generationMode: 'deep',
        researchDepth: 'adaptive',
        rateLimit: { maxPerHour: 10, minDelayMinutes: 6 }
      })
      replaceCampaign(campaign)
      setSelectedCampaignLeadIds([])
      setNotice(copy.devLetter.batch.status.created(campaign.recipients.length))
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function generateCampaign() {
    if (!selectedCampaign) return
    if (!requireCompanyKnowledge()) return
    setGenerationMode('campaign')
    setGenerationOpen(true)
    setGenerationCompletedAt('')
    setBusy('campaignGenerate')
    setError('')
    setNotice('')
    try {
      const started = await api.startOutreachCampaignGeneration(selectedCampaign.id)
      replaceCampaign(started)
      setNotice('批量生成已开始，写好一封会自动显示一封。')
      const campaign = await pollCampaignGeneration(selectedCampaign.id)
      replaceCampaign(campaign)
      setGenerationCompletedAt(new Date().toISOString())
      setNotice(copy.devLetter.batch.status.generated(campaign.stats.generated + campaign.stats.approved + campaign.stats.sent))
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function approveCampaignRecipient() {
    if (!selectedCampaign || !selectedCampaignRecipient) return
    if (!campaignDraftSubject.trim() || !campaignDraftBody.trim()) {
      setError(copy.devLetter.warnings.draftRequired)
      return
    }
    const review = campaignQualityPassed ? campaignQualityReview : await reviewCampaignRecipient()
    if (!review?.passed) {
      setError(copy.devLetter.quality.blockedApprove)
      return
    }
    setBusy('campaignApprove')
    setError('')
    setNotice('')
    try {
      const campaign = await api.approveOutreachCampaignRecipient(selectedCampaign.id, selectedCampaignRecipient.id, {
        subject: campaignDraftSubject.trim(),
        body: campaignDraftBody.trim()
      })
      replaceCampaign(campaign)
      setNotice(copy.devLetter.batch.status.approved)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function skipCampaignRecipient(recipient: OutreachCampaignRecipient) {
    if (!selectedCampaign) return
    setBusy(`campaignSkip:${recipient.id}`)
    setError('')
    setNotice('')
    try {
      replaceCampaign(await api.skipOutreachCampaignRecipient(selectedCampaign.id, recipient.id))
      setNotice(copy.devLetter.batch.status.skipped)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function startCampaign() {
    if (!selectedCampaign) return
    const sender = selectedSender ?? await saveSender()
    if (!sender) {
      setError(copy.devLetter.warnings.senderRequired)
      return
    }
    if (!sender.deliveryConfirmedAt) {
      setError(copy.devLetter.warnings.senderNotConfirmed)
      return
    }
    const approvedCount = selectedCampaign.recipients.filter((recipient) => recipient.status === 'approved' || recipient.status === 'queued').length
    if (!approvedCount) {
      setError(copy.devLetter.batch.warnings.noApproved)
      return
    }
    if (!window.confirm(copy.devLetter.warnings.confirmBatchSend(approvedCount))) return
    setBusy('campaignSend')
    setError('')
    setNotice('')
    try {
      const campaign = await api.startOutreachCampaign(selectedCampaign.id, { senderAccountId: sender.id })
      replaceCampaign(campaign)
      await refreshCampaignFollowUps(campaign.id)
      setNotice(copy.devLetter.batch.status.sent(campaign.stats.sent))
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function scheduleCampaignFollowUps() {
    if (!selectedCampaign) return
    const sender = selectedSender ?? await saveSender()
    if (!sender) {
      setError(copy.devLetter.warnings.senderRequired)
      return
    }
    setBusy('followUpsSchedule')
    setError('')
    setNotice('')
    try {
      const result = await api.scheduleOutreachFollowUps(selectedCampaign.id, { senderAccountId: sender.id, mode: 'confirm' })
      setFollowUps(result.jobs)
      setNotice(copy.devLetter.batch.status.followUpsScheduled(result.created))
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function runFollowUpTick() {
    setBusy('followUpsTick')
    setError('')
    setNotice('')
    try {
      const result = await api.tickOutreachFollowUps({ limit: 20 })
      await refreshCampaignFollowUps()
      setNotice(copy.devLetter.batch.status.followUpsChecked(result.ready + result.sent, result.stopped))
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function checkCampaignInbox() {
    if (!selectedCampaign) return
    const sender = selectedSender ?? await saveSender()
    if (!sender) {
      setError(copy.devLetter.warnings.senderRequired)
      return
    }
    setBusy('inboxCheck')
    setError('')
    setNotice('')
    try {
      const result = await api.checkOutreachInbox({ senderAccountId: sender.id, campaignId: selectedCampaign.id })
      replaceSenderAccount(result.sender)
      replaceCampaign(await api.outreachCampaign(selectedCampaign.id))
      await refreshCampaignFollowUps(selectedCampaign.id)
      if (result.ok) setNotice(copy.devLetter.batch.status.inboxChecked(result.matched.length, result.stopped))
      else setError(result.message)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function pauseCampaign() {
    if (!selectedCampaign) return
    setBusy('campaignPause')
    setError('')
    setNotice('')
    try {
      replaceCampaign(await api.pauseOutreachCampaign(selectedCampaign.id))
      setNotice(copy.devLetter.batch.status.paused)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function resumeCampaign() {
    if (!selectedCampaign) return
    setBusy('campaignResume')
    setError('')
    setNotice('')
    try {
      replaceCampaign(await api.resumeOutreachCampaign(selectedCampaign.id))
      setNotice(copy.devLetter.batch.status.resumed)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function stopCampaign() {
    if (!selectedCampaign) return
    if (!window.confirm(copy.devLetter.warnings.confirmStopCampaign)) return
    setBusy('campaignStop')
    setError('')
    setNotice('')
    try {
      replaceCampaign(await api.stopOutreachCampaign(selectedCampaign.id))
      setNotice(copy.devLetter.batch.status.stopped)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function saveLead() {
    const input = leadInputFromForm(leadDraft)
    if (!input.companyName) {
      setError(copy.devLetter.warnings.leadRequired)
      return undefined
    }
    setBusy('lead')
    setError('')
    setNotice('')
    try {
      const saved = selectedLead
        ? await api.updateOutreachLead(selectedLead.id, input)
        : await api.createOutreachLead(input)
      setLeads(selectedLead ? leads.map((lead) => lead.id === saved.id ? saved : lead) : [saved, ...leads])
      setSelectedLeadId(saved.id)
      return saved
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
      return undefined
    } finally {
      setBusy('')
    }
  }

  async function importCsv() {
    if (!csvText.trim()) return
    setBusy('csv')
    setError('')
    setNotice('')
    try {
      const result = await api.importOutreachLeads(csvText)
      setLeads([...result.imported, ...leads])
      if (result.imported[0]) setSelectedLeadId(result.imported[0].id)
      setNotice(copy.devLetter.status.imported(result.imported.length, result.skipped.length))
      setCsvText('')
      setCsvOpen(false)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'fileUpload'))
    } finally {
      setBusy('')
    }
  }

  async function importLetterLeads(text = bulkImportText) {
    const csv = letterRowsToCsv(text)
    if (!csv.trim()) {
      setError('请先粘贴客户数据或选择 Excel / CSV 文件。')
      return []
    }
    setBusy('letterImport')
    setError('')
    setNotice('')
    try {
      const result = await api.importOutreachLeads(csv)
      const nextLeads = await api.outreachLeads()
      setLeads(nextLeads)
      if (result.imported[0]) {
        setSelectedLeadId(result.imported[0].id)
        setLetterView('leads')
      }
      setBulkImportText('')
      setNotice(`已导入 ${result.imported.length} 个客户${result.skipped.length ? `，跳过 ${result.skipped.length} 行` : ''}。`)
      return result.imported
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'fileUpload'))
      return []
    } finally {
      setBusy('')
    }
  }

  async function importAndGenerateLetterLeads(text = bulkImportText) {
    if (!requireCompanyKnowledge()) return
    const csv = letterRowsToCsv(text)
    if (!csv.trim()) {
      setError('请先粘贴客户数据或选择 Excel / CSV 文件。')
      return
    }
    setGenerationMode('campaign')
    setGenerationOpen(true)
    setGenerationCompletedAt('')
    setBusy('letterImportGenerate')
    setError('')
    setNotice('')
    try {
      const result = await api.importOutreachLeads(csv)
      const ready = result.imported.filter((lead) => lead.website && lead.email)
      const nextLeads = await api.outreachLeads()
      setLeads(nextLeads)
      if (!ready.length) {
        setLetterView('leads')
        setNotice(`已导入 ${result.imported.length} 个客户，但没有同时包含官网和邮箱的客户可生成开发信。`)
        return
      }
      const created = await api.createOutreachCampaign({
        name: campaignName.trim() || `批量开发信 ${new Date().toLocaleString()}`,
        leadIds: ready.map((lead) => lead.id),
        senderAccountId: selectedSender?.id,
        language,
        tone,
        providerId: defaultProvider?.id,
        model: defaultProvider?.defaultModel,
        generationMode: 'deep',
        researchDepth: 'adaptive',
        rateLimit: { maxPerHour: 10, minDelayMinutes: 6 }
      })
      replaceCampaign(created)
      setSelectedCampaignLeadIds([])
      setBulkImportText('')
      setLetterView('automation')
      const started = await api.startOutreachCampaignGeneration(created.id)
      replaceCampaign(started)
      setNotice(`已导入 ${result.imported.length} 个客户，正在逐封生成，写好一封会自动显示一封。`)
      const generated = await pollCampaignGeneration(created.id)
      replaceCampaign(generated)
      setGenerationCompletedAt(new Date().toISOString())
      setNotice(`已导入 ${result.imported.length} 个客户，并为 ${ready.length} 个客户逐个生成开发信。`)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'fileUpload'))
    } finally {
      setBusy('')
    }
  }

  async function importLetterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy('letterFile')
    setError('')
    setNotice('')
    try {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (extension === 'xlsx' || extension === 'xls') {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const csv = XLSX.utils.sheet_to_csv(firstSheet)
        setBulkImportText(csv)
        await importLetterLeads(csv)
      } else {
        const text = await file.text()
        setBulkImportText(text)
        await importLetterLeads(text)
      }
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'fileUpload'))
    } finally {
      setBusy('')
    }
  }

  async function importLetterFileAndGenerate(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy('letterFileGenerate')
    setError('')
    setNotice('')
    try {
      const text = await readLetterImportFile(file)
      setBulkImportText(text)
      await importAndGenerateLetterLeads(text)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'fileUpload'))
      setBusy('')
    }
  }

  async function readLetterImportFile(file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension === 'xlsx' || extension === 'xls') {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      return XLSX.utils.sheet_to_csv(firstSheet)
    }
    return file.text()
  }

  function toggleLetterLeadSelection(id: string) {
    setSelectedLetterLeadIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function deleteSelectedLetterLeads() {
    if (!selectedLetterLeadIds.length) return
    if (!window.confirm(`确定删除选中的 ${selectedLetterLeadIds.length} 个客户吗？此操作不可撤销。`)) return
    setBusy('deleteLeads')
    setError('')
    setNotice('')
    try {
      const result = await api.deleteOutreachLeads(selectedLetterLeadIds)
      setLeads(leads.filter((lead) => !selectedLetterLeadIds.includes(lead.id)))
      setSelectedLetterLeadIds([])
      if (selectedLeadId && selectedLetterLeadIds.includes(selectedLeadId)) setSelectedLeadId('')
      setNotice(`已删除 ${result.deleted} 个客户。`)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function generateDraft() {
    if (!requireCompanyKnowledge()) return
    let lead = selectedLead
    if (!lead) lead = await saveLead()
    if (!lead) return
    setGenerationMode('single')
    setGenerationOpen(true)
    setGenerationCompletedAt('')
    setBusy('generate')
    setError('')
    setNotice('')
    try {
      const next = await api.generateOutreachDraft({
        leadId: lead.id,
        language,
        tone,
        generationMode: 'deep',
        providerId: defaultProvider?.id,
        model: defaultProvider?.defaultModel
      })
      setWorkflow(undefined)
      setSelectedEmailId('')
      setDraft(next)
      setDraftSubject(next.subject)
      setDraftBody(next.body)
      setLeads(await api.outreachLeads())
      setLetterView('leads')
      setGenerationCompletedAt(new Date().toISOString())
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function autoGenerateDraft() {
    if (!requireCompanyKnowledge()) return
    if (!quickWebsite.trim() || !quickEmail.trim()) {
      setError(copy.devLetter.warnings.quickRequired)
      return
    }
    setGenerationMode('quick')
    setGenerationOpen(true)
    setGenerationCompletedAt('')
    setBusy('auto')
    setError('')
    setNotice('')
    try {
      const next = await api.autoGenerateOutreachWorkflow({
        website: quickWebsite.trim(),
        email: quickEmail.trim(),
        language,
        tone,
        providerId: defaultProvider?.id,
        model: defaultProvider?.defaultModel,
        generationMode: 'deep',
        researchDepth: 'adaptive'
      })
      const nextLeads = await api.outreachLeads()
      setLeads(nextLeads)
      if (next.leadId) {
        setSelectedLeadId(next.leadId)
        const researchedLead = nextLeads.find((lead) => lead.id === next.leadId)
        if (researchedLead) setLeadDraft(leadFormFromLead(researchedLead))
      }
      setDraft(undefined)
      setWorkflow(next)
      setSelectedEmailId(next.initialEmail.id)
      setDraftSubject(next.initialEmail.subject)
      setDraftBody(next.initialEmail.body)
      setNotice(copy.devLetter.status.workflowGenerated)
      setLetterView('leads')
      setGenerationCompletedAt(new Date().toISOString())
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function saveDraftEdits() {
    if (!activeDraftId) {
      setError(copy.devLetter.warnings.draftRequired)
      return undefined
    }
    setBusy('draft')
    setError('')
    setNotice('')
    try {
      const next = await api.updateOutreachDraft(activeDraftId, { subject: draftSubject, body: draftBody, language, tone })
      if (selectedWorkflowEmail) updateWorkflowEmail(selectedWorkflowEmail.id, { subject: next.subject, body: next.body, status: next.status, sentAt: next.sentAt, sendError: next.sendError, qualityReview: next.qualityReview, sendRiskReview: next.sendRiskReview })
      else setDraft(next)
      setNotice(copy.devLetter.status.draftSaved)
      return next
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
      return undefined
    } finally {
      setBusy('')
    }
  }

  function applyActiveQualityReview(review: OutreachEmailQualityReview) {
    if (selectedWorkflowEmail) updateWorkflowEmail(selectedWorkflowEmail.id, { qualityReview: review })
    else setDraft((current) => current ? { ...current, qualityReview: review, updatedAt: new Date().toISOString() } : current)
  }

  async function reviewCurrentDraft() {
    if (!activeDraftId) {
      setError(copy.devLetter.warnings.draftRequired)
      return undefined
    }
    const saved = singleDraftChanged ? await saveDraftEdits() : undefined
    if (singleDraftChanged && !saved) return undefined
    const draftId = saved?.id ?? activeDraftId
    setBusy('reviewDraft')
    setError('')
    setNotice('')
    try {
      const review = await api.reviewOutreachDraft(draftId)
      applyActiveQualityReview(review)
      setNotice(review.passed ? copy.devLetter.quality.passed : copy.devLetter.quality.needsRewrite)
      return review
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
      return undefined
    } finally {
      setBusy('')
    }
  }

  async function rewriteCurrentDraft() {
    if (!activeDraftId) {
      setError(copy.devLetter.warnings.draftRequired)
      return
    }
    const saved = singleDraftChanged ? await saveDraftEdits() : undefined
    if (singleDraftChanged && !saved) return
    const draftId = saved?.id ?? activeDraftId
    setBusy('rewriteDraft')
    setError('')
    setNotice('')
    try {
      const rewritten = await api.rewriteOutreachDraft(draftId, { providerId: defaultProvider?.id, model: defaultProvider?.defaultModel })
      if (selectedWorkflowEmail) updateWorkflowEmail(selectedWorkflowEmail.id, { subject: rewritten.subject, body: rewritten.body, status: rewritten.status, sentAt: rewritten.sentAt, sendError: rewritten.sendError, qualityReview: rewritten.qualityReview, strategyMatch: rewritten.strategyMatch, sendRiskReview: rewritten.sendRiskReview, researchBrief: rewritten.researchBrief })
      else setDraft(rewritten)
      setDraftSubject(rewritten.subject)
      setDraftBody(rewritten.body)
      setNotice(rewritten.qualityReview?.passed ? copy.devLetter.quality.rewrittenPassed : copy.devLetter.quality.rewrittenNeedsReview)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function reviewCampaignRecipient() {
    if (!selectedCampaign || !selectedCampaignRecipient) return undefined
    if (campaignDraftChanged && selectedCampaignRecipient.draft) {
      try {
        await api.updateOutreachDraft(selectedCampaignRecipient.draft.id, {
          subject: campaignDraftSubject.trim(),
          body: campaignDraftBody.trim()
        })
      } catch (err) {
        setError(humanizeErrorMessage(err, copy, 'message'))
        return undefined
      }
    }
    setBusy('campaignReviewQuality')
    setError('')
    setNotice('')
    try {
      const review = await api.reviewOutreachCampaignRecipient(selectedCampaign.id, selectedCampaignRecipient.id)
      const next = await api.outreachCampaign(selectedCampaign.id)
      replaceCampaign(next)
      setSelectedCampaignRecipientId(selectedCampaignRecipient.id)
      setNotice(review.passed ? copy.devLetter.quality.passed : copy.devLetter.quality.needsRewrite)
      return review
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
      return undefined
    } finally {
      setBusy('')
    }
  }

  async function rewriteCampaignRecipient() {
    if (!selectedCampaign || !selectedCampaignRecipient) return
    if (campaignDraftChanged && selectedCampaignRecipient.draft) {
      try {
        await api.updateOutreachDraft(selectedCampaignRecipient.draft.id, {
          subject: campaignDraftSubject.trim(),
          body: campaignDraftBody.trim()
        })
      } catch (err) {
        setError(humanizeErrorMessage(err, copy, 'message'))
        return
      }
    }
    setBusy('campaignRewriteQuality')
    setError('')
    setNotice('')
    try {
      const next = await api.rewriteOutreachCampaignRecipient(selectedCampaign.id, selectedCampaignRecipient.id, { providerId: defaultProvider?.id, model: defaultProvider?.defaultModel })
      replaceCampaign(next)
      setSelectedCampaignRecipientId(selectedCampaignRecipient.id)
      setNotice(copy.devLetter.quality.rewrittenPassed)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function copyEmailDraft(subject: string, body: string) {
    if (!subject.trim() || !body.trim()) {
      setError(copy.devLetter.warnings.draftRequired)
      return false
    }
    await navigator.clipboard?.writeText(`Subject: ${subject.trim()}\n\n${body.trim()}`)
    setNotice(copy.devLetter.status.copied)
    return true
  }

  async function copyDraft() {
    await copyEmailDraft(draftSubject, draftBody)
  }

  async function saveSender() {
    const effectiveSenderChannelId = mailAdvancedOpen ? senderChannelId : 'smtp'
    const effectiveApiChannelSelected = effectiveSenderChannelId !== 'smtp'
    if (!senderDraft.label.trim() || !senderDraft.email.trim() || (!effectiveApiChannelSelected && !senderDraft.host.trim())) {
      setError(copy.devLetter.warnings.senderRequired)
      return undefined
    }
    const sendChannel = sendChannelFromSenderChannel(effectiveSenderChannelId)
    const provider = providerFromSenderChannel(effectiveSenderChannelId, senderProviderId)
    const apiCredential = senderDraft.apiCredential.trim()
    const apiAccountId = senderDraft.apiAccountId.trim()
    const apiBaseUrl = senderDraft.apiBaseUrl.trim()
    setBusy('sender')
    setError('')
    setNotice('')
    try {
      const saved = await api.saveOutreachSenderAccount({
        id: senderDraft.id,
        label: senderDraft.label.trim(),
        provider,
        sendChannel,
        fromName: senderDraft.fromName.trim() || undefined,
        email: senderDraft.email.trim(),
        host: senderDraft.host.trim(),
        port: Number(senderDraft.port || 587),
        secure: senderDraft.secure,
        imapHost: senderDraft.imapHost.trim() || undefined,
        imapPort: Number(senderDraft.imapPort || 993),
        imapSecure: senderDraft.imapSecure,
        imapUsername: senderDraft.imapUsername.trim() || senderDraft.username.trim() || senderDraft.email.trim(),
        username: senderDraft.username.trim() || undefined,
        password: senderDraft.password.trim() || undefined,
        oauthApi: sendChannel === 'oauth-api'
          ? { credential: apiCredential || undefined, accountId: apiAccountId || undefined, apiBaseUrl: apiBaseUrl || undefined, scopes: defaultSenderApiScopes(provider) }
          : undefined,
        serviceApi: sendChannel === 'service-api'
          ? { credential: apiCredential || undefined, accountId: apiAccountId || undefined, apiBaseUrl: apiBaseUrl || undefined, scopes: [] }
          : undefined,
        enabled: true
      })
      replaceSenderAccount(saved)
      setNotice(copy.devLetter.status.senderSaved)
      return saved
    } catch (err) {
      setError(formatSenderDeliveryError(humanizeErrorMessage(err, copy, 'message')))
      return undefined
    } finally {
      setBusy('')
    }
  }

  async function saveSignature() {
    const text = signatureDraft.text.trim()
    const hasLogo = Boolean(emailSignature?.logo)
    setBusy('signature')
    setError('')
    setNotice('')
    try {
      const saved = await api.saveOutreachEmailSignature({
        enabled: Boolean(text || hasLogo),
        text,
        html: '',
        logoEnabled: hasLogo,
        logoAlt: `${companyProfile.name || 'Company'} logo`,
        logoWidth: 120,
      })
      setEmailSignature(saved)
      setSignatureDraft(signatureFormFromSettings(saved, companyProfile))
      setNotice('邮件签名和 Logo 已保存。之后发送开发信会自动带上。')
      return saved
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
      return undefined
    } finally {
      setBusy('')
    }
  }

  async function uploadSignatureLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy('signatureLogo')
    setError('')
    setNotice('')
    try {
      const saved = await api.uploadOutreachEmailSignatureLogo(file)
      setEmailSignature(saved)
      setSignatureDraft(signatureFormFromSettings(saved, companyProfile))
      setNotice('邮件 Logo 已上传，之后发送的开发信会自动使用。')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'fileUpload'))
    } finally {
      setBusy('')
    }
  }

  async function deleteSignatureLogo() {
    setBusy('signatureLogoDelete')
    setError('')
    setNotice('')
    try {
      const saved = await api.deleteOutreachEmailSignatureLogo()
      setEmailSignature(saved)
      setSignatureDraft(signatureFormFromSettings(saved, companyProfile))
      setNotice('邮件 Logo 已删除。')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function testSender() {
    const sender = selectedSender ?? await saveSender()
    if (!sender) return
    setBusy('testSender')
    setError('')
    setNotice('')
    try {
      const result = await api.testOutreachSenderAccount(sender.id)
      replaceSenderAccount(result.sender)
      if (result.ok) setNotice(copy.devLetter.status.senderReady)
      else setError(formatSenderDeliveryError(result.message))
    } catch (err) {
      setError(formatSenderDeliveryError(humanizeErrorMessage(err, copy, 'message')))
    } finally {
      setBusy('')
    }
  }

  async function sendSenderTestEmail() {
    const sender = selectedSender ?? await saveSender()
    if (!sender) return
    setBusy('testEmail')
    setError('')
    setNotice('')
    try {
      const result = await api.sendOutreachSenderTestEmail(sender.id)
      replaceSenderAccount(result.sender)
      if (result.ok) setNotice(copy.devLetter.status.testEmailSent)
      else setError(formatSenderDeliveryError(result.message))
    } catch (err) {
      setError(formatSenderDeliveryError(humanizeErrorMessage(err, copy, 'message')))
    } finally {
      setBusy('')
    }
  }

  function openSenderAuthGuide() {
    const url = senderAuthGuide.url
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
      setNotice(`已打开 ${senderProvider.label} 授权码页面。复制授权码后粘贴到这里，再点击“保存并测试邮箱”。`)
      return
    }
    setMailAdvancedOpen(true)
    setNotice('这个邮箱服务商无法自动打开授权码页面，请在高级设置里填写 SMTP 主机、端口和授权码。')
  }

  async function saveAndTestSender() {
    const sender = await saveSender()
    if (!sender) return
    setBusy('mailSetup')
    setError('')
    setNotice('')
    try {
      const tested = await api.testOutreachSenderAccount(sender.id)
      replaceSenderAccount(tested.sender)
      if (!tested.ok) {
        setError(formatSenderDeliveryError(tested.message))
        return
      }
      const emailed = await api.sendOutreachSenderTestEmail(sender.id)
      replaceSenderAccount(emailed.sender)
      if (emailed.ok) {
        setNotice(`邮箱可用。已发送测试邮件到 ${sender.email}，收到后点击“确认已收到”。`)
      } else {
        setError(formatSenderDeliveryError(emailed.message))
      }
    } catch (err) {
      setError(formatSenderDeliveryError(humanizeErrorMessage(err, copy, 'message')))
    } finally {
      setBusy('')
    }
  }

  async function sendSenderExternalTestEmail() {
    const target = senderTestRecipient.trim()
    if (!target) return
    const sender = selectedSender ?? await saveSender()
    if (!sender) return
    setBusy('externalTestEmail')
    setError('')
    setNotice('')
    try {
      const result = await api.sendOutreachSenderTestEmail(sender.id, target)
      replaceSenderAccount(result.sender)
      if (result.ok) setNotice(result.message)
      else setError(formatSenderDeliveryError(result.message))
    } catch (err) {
      setError(formatSenderDeliveryError(humanizeErrorMessage(err, copy, 'message')))
    } finally {
      setBusy('')
    }
  }

  async function confirmSenderDelivery() {
    const sender = selectedSender ?? await saveSender()
    if (!sender) return
    setBusy('confirmDelivery')
    setError('')
    setNotice('')
    try {
      const result = await api.confirmOutreachSenderDelivery(sender.id)
      replaceSenderAccount(result.sender)
      setNotice(copy.devLetter.status.deliveryConfirmed)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function sendDraft() {
    if (!activeDraftId) {
      setError(copy.devLetter.warnings.draftRequired)
      return
    }
    const hasChanges = selectedWorkflowEmail
      ? selectedWorkflowEmail.subject !== draftSubject || selectedWorkflowEmail.body !== draftBody
      : Boolean(draft && (draft.subject !== draftSubject || draft.body !== draftBody))
    const savedDraft = hasChanges ? await saveDraftEdits() : undefined
    if (hasChanges && !savedDraft) return
    const draftId = savedDraft?.id ?? activeDraftId
    const sender = selectedSender ?? await saveSender()
    const to = selectedLead?.email || leadDraft.email
    if (!sender) {
      setError(copy.devLetter.warnings.senderRequired)
      return
    }
    if (!sender.deliveryConfirmedAt) {
      setError(copy.devLetter.warnings.senderNotConfirmed)
      return
    }
    const review = activeQualityReview?.passed && !singleDraftChanged ? activeQualityReview : await reviewCurrentDraft()
    if (!review?.passed) {
      setError(copy.devLetter.quality.blockedSend)
      return
    }
    if (!window.confirm(copy.devLetter.warnings.confirmSend)) return
    setBusy('send')
    setError('')
    setNotice('')
    try {
      const sent = await api.sendOutreachDraft(draftId, { senderAccountId: sender.id, to })
      if (selectedWorkflowEmail) updateWorkflowEmail(selectedWorkflowEmail.id, { subject: sent.subject, body: sent.body, status: sent.status, sentAt: sent.sentAt, sendError: sent.sendError, sendRiskReview: sent.sendRiskReview })
      else setDraft(sent)
      setLeads(await api.outreachLeads())
      setNotice(copy.devLetter.status.sent)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setBusy('')
    }
  }

  async function syncCloudNow() {
    if (!cloudStatus.authenticated) return
    setBusy('cloudSync')
    setError('')
    setNotice('')
    try {
      const next = await api.cloudSync(true)
      setCloudStatus(next)
      setNotice(next.learningRulesUpdatedAt ? '云端学习数据已同步，写信规则已更新。' : '云端学习数据已同步。')
    } catch (err) {
      const message = humanizeErrorMessage(err, copy, 'message')
      setCloudStatus({ ...cloudStatus, lastSyncError: message })
      setError(message)
    } finally {
      setBusy('')
    }
  }

  const letterNavItems: Array<{ id: LetterOutreachView; label: string; icon: LucideIcon }> = [
    { id: 'dashboard', label: '今日外联', icon: Clock },
    { id: 'leads', label: '客户', icon: Users },
    { id: 'compose', label: '单封写信', icon: Pencil },
    { id: 'automation', label: '批量写信', icon: Zap },
    { id: 'assets', label: '销售资产', icon: ShieldCheck },
    { id: 'mail', label: '邮箱', icon: Settings },
    { id: 'signature', label: '签名Logo', icon: ImageIcon },
    { id: 'profile', label: '公司资料', icon: UserRound },
  ]
  const letterTitle = letterNavItems.find((item) => item.id === letterView)?.label ?? '今日外联'
  const cloudSidebarStatus = cloudStatus.lastSyncError
    ? { className: 'warning', label: '云端同步失败' }
    : cloudStatus.authenticated
      ? { className: 'ready', label: cloudStatus.learningRulesUpdatedAt ? '学习规则已更新' : cloudStatus.lastSyncAt ? '云端数据已同步' : '云端大脑已连接' }
      : cloudStatus.configured
        ? { className: 'warning', label: '云端大脑待登录' }
        : { className: 'muted', label: '云端大脑未启用' }
  const letterSubtitle = letterView === 'dashboard'
    ? '查看今天要处理的客户、草稿、发送和回复'
    : letterView === 'leads'
      ? '查看、筛选和维护所有潜在客户'
      : letterView === 'compose'
        ? '一次只输入一个客户，生成可审核的定制开发信'
        : letterView === 'automation'
          ? '导入客户名单，批量生成开发信、逐封审核和跟进'
          : letterView === 'assets'
            ? '维护买家画像、USP 和 CTA 资产，让每封邮件有证据、有卖点、有下一步'
            : letterView === 'mail'
              ? '填写邮箱和授权码，Hermills 自动配置 SMTP 并测试可用性'
              : letterView === 'signature'
                ? '保存邮件签名和 Logo，之后所有开发信自动使用'
                : '维护 AI 写信时使用的公司资料'

  return (
    <div className="letter-app-shell">
      <aside className="letter-sidebar" aria-label="外联导航">
        <div className="letter-brand">
          <div className="letter-logo"><Mail size={18} /></div>
          <div>
            <strong>Outbound Mail OS</strong>
            <span>Hermills 本地版</span>
          </div>
        </div>
        <nav className="letter-nav">
          {letterNavItems.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} className={letterView === item.id ? 'active' : ''} type="button" onClick={() => setLetterView(item.id)}>
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="letter-sidebar-footer">
          <span className={companyReady ? 'ready' : 'warning'}>{companyReady ? '公司资料已准备' : '公司资料待完善'}</span>
          <span className={cloudSidebarStatus.className}>{cloudSidebarStatus.label}</span>
          {cloudStatus.authenticated ? (
            <button type="button" onClick={syncCloudNow} disabled={busy === 'cloudSync'}>
              <RefreshCw size={15} /> {busy === 'cloudSync' ? '学习同步中' : '同步学习数据'}
            </button>
          ) : null}
          <button type="button" onClick={onOpenCompanyKnowledge}>打开公司资料</button>
          <button type="button" onClick={onOpenChat}><Bot size={15} /> AI 助手</button>
          <button type="button" onClick={onOpenSettings}><Settings size={15} /> 系统设置</button>
        </div>
      </aside>

      <main className="letter-main">
        <header className="letter-page-header">
          <div>
            <h1>{letterTitle}</h1>
            <p>{letterSubtitle}</p>
          </div>
          {letterView === 'dashboard' ? (
            <button className="letter-primary compact" type="button" onClick={() => setLetterView('compose')}>
              写单封开发信 <ChevronRight size={16} />
            </button>
          ) : null}
        </header>

        {error ? (
          <div className="letter-alert error">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button className="letter-alert-copy" type="button" onClick={() => void navigator.clipboard?.writeText(error)} aria-label={copy.errors.copyDetails}>
              <Copy size={14} /> {copy.errors.copyDetails}
            </button>
          </div>
        ) : null}
        {notice ? <div className="letter-alert success"><CheckCircle2 size={16} /><span>{notice}</span></div> : null}

        {letterView === 'dashboard' ? (
          <div className="letter-view">
            <section className="letter-stats-grid" aria-label="客户状态统计">
              {[
                { label: '总客户', value: letterStats.total, icon: Users, tone: 'orange' },
                { label: '待生成', value: letterStats.new, icon: Zap, tone: 'blue' },
                { label: '待发送', value: letterStats.drafted, icon: Send, tone: 'amber' },
                { label: '等待回复', value: letterStats.waiting, icon: Clock, tone: 'violet' },
                { label: '已回复', value: letterStats.replied, icon: CheckCircle2, tone: 'green' },
              ].map((stat) => {
                const Icon = stat.icon
                return (
                  <button className="letter-stat-card" type="button" key={stat.label} onClick={() => setLetterView(stat.label === '总客户' ? 'leads' : 'automation')}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                    <i className={stat.tone}><Icon size={20} /></i>
                  </button>
                )
              })}
            </section>

            <section className="letter-quick-actions" aria-label="今日外联快捷入口">
              <button className="letter-action-card" type="button" onClick={() => setLetterView('compose')}>
                <span><Mail size={18} /></span>
                <strong>写单封开发信</strong>
                <small>输入一个客户网站和邮箱，生成首封邮件和跟进序列。</small>
              </button>
              <button className="letter-action-card" type="button" onClick={() => setLetterView('leads')}>
                <span><Users size={18} /></span>
                <strong>整理客户</strong>
                <small>筛选待生成、待发送、已回复客户并补齐资料。</small>
              </button>
              <button className="letter-action-card" type="button" onClick={() => setLetterView('automation')}>
                <span><Zap size={18} /></span>
                <strong>批量写开发信</strong>
                <small>导入客户名单，逐封审核批量草稿、发送和跟进。</small>
              </button>
              <button className="letter-action-card" type="button" onClick={() => setLetterView('mail')}>
                <span><Settings size={18} /></span>
                <strong>检查邮箱</strong>
                <small>{senderDeliveryReady ? '发件邮箱已确认，可以发送已审核邮件。' : '先保存并测试邮箱，确认收到测试邮件。'}</small>
              </button>
            </section>

            {(letterStats.new > 0 || letterStats.drafted > 0) ? (
              <section className="letter-automation-banner">
                <div>
                  <Zap size={18} />
                  <div>
                    <strong>批量写信中心就绪</strong>
                    <span>{letterStats.new} 个客户待生成邮件 · {letterStats.drafted} 封邮件待发送</span>
                  </div>
                </div>
                <button type="button" onClick={() => setLetterView('automation')}>前往批量写信 <ChevronRight size={16} /></button>
              </section>
            ) : null}
          </div>
        ) : null}

        {letterView === 'compose' ? (
          <div className="letter-view">
            <section className="letter-single-compose">
              <div className="letter-panel">
                <div className="letter-panel-heading">
                  <div>
                    <h2><Globe2 size={18} /> 单个客户</h2>
                    <p>输入一个客户的网站和邮箱，AI 会自动背调官网并生成首封开发信。</p>
                  </div>
                </div>
                <div className="letter-form-grid quick-lead-form" aria-label="新增客户输入">
                  <div className="letter-form-field">
                    <label htmlFor="letter-quick-email">客户邮箱</label>
                    <input
                      id="letter-quick-email"
                      name="quickCustomerEmail"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={quickEmail}
                      onChange={(event) => setQuickEmail(event.currentTarget.value)}
                      placeholder="buyer@company.com"
                    />
                  </div>
                  <div className="letter-form-field">
                    <label htmlFor="letter-quick-website">客户网站</label>
                    <input
                      ref={quickWebsiteRef}
                      id="letter-quick-website"
                      name="quickCustomerWebsite"
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      value={quickWebsite}
                      onChange={(event) => setQuickWebsite(event.currentTarget.value)}
                      placeholder="https://company.com"
                    />
                  </div>
                </div>
                <div className="campaign-depth-picker letter-depth-picker">
                  <div>
                    <strong>自适应深度分析</strong>
                    <small>后台会优先调用 Scrapling 深度抓取官网、产品页和联系页；失败时自动轻量兜底，不需要手动选择模式。</small>
                  </div>
                  <div className="letter-depth-flow" aria-label="自适应深度分析流程">
                    <span>官网结构</span>
                    <span>高价值页面</span>
                    <span>采购线索</span>
                    <span>开发信草稿</span>
                  </div>
                </div>
                <button className="letter-primary full" type="button" disabled={!quickLeadReady || busy === 'auto'} onClick={autoGenerateDraft}>
                  {busy === 'auto' ? '正在分析客户官网并生成开发信...' : '分析客户官网并生成开发信'} <ChevronRight size={16} />
                </button>
              </div>
              <aside className="letter-single-note">
                <strong>批量客户请去“批量写信”</strong>
                <span>单封写信页只处理一个客户，批量导入、逐客户智能体生成、批量审核和跟进都集中在批量写信页。</span>
                <button className="letter-secondary" type="button" onClick={() => setLetterView('automation')}>打开批量写信 <ChevronRight size={16} /></button>
              </aside>
            </section>
          </div>
        ) : null}

        {letterView === 'leads' ? (
          <div className="letter-view">
            <section className="letter-toolbar">
              <label className="letter-search"><Search size={16} /><input value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} placeholder="搜索公司、邮箱、联系人..." /></label>
              <div className="letter-filter-row">
                {letterLeadFilters.map((filter) => (
                  <button key={filter.id} className={leadFilter === filter.id ? 'active' : ''} type="button" onClick={() => setLeadFilter(filter.id)}>
                    {filter.label}
                    <span>{filter.id === 'all' ? leads.length : leads.filter((lead) => leadMatchesLetterFilter(lead, filter.id)).length}</span>
                  </button>
                ))}
              </div>
            </section>

            {selectedLetterLeadIds.length ? (
              <section className="letter-selection-bar">
                <strong>已选择 {selectedLetterLeadIds.length} 个客户</strong>
                <button type="button" onClick={() => setSelectedLetterLeadIds(filteredLetterLeads.map((lead) => lead.id))}>全选当前</button>
                <button type="button" onClick={() => setSelectedLetterLeadIds([])}>取消选择</button>
                <button className="danger" type="button" disabled={busy === 'deleteLeads'} onClick={deleteSelectedLetterLeads}>删除所选</button>
              </section>
            ) : null}

            <section className="letter-leads-layout">
              <div className="letter-lead-list">
                <div className="letter-result-count">{filteredLetterLeads.length} 条结果</div>
                {filteredLetterLeads.length ? filteredLetterLeads.map((lead) => (
                  <article className={`letter-lead-row ${selectedLeadId === lead.id ? 'active' : ''}`} key={lead.id} onClick={() => { setSelectedLeadId(lead.id); setLeadDraft(leadFormFromLead(lead)) }}>
                    <input type="checkbox" checked={selectedLetterLeadIds.includes(lead.id)} onChange={() => toggleLetterLeadSelection(lead.id)} onClick={(event) => event.stopPropagation()} />
                    <div className="letter-lead-avatar"><Building2 size={18} /></div>
                    <div className="letter-lead-main">
                      <strong>{lead.companyName || lead.website || lead.email}</strong>
                      <span>{lead.email || '未填写邮箱'} · {lead.website || '未填写网站'}</span>
                    </div>
                    <div className="letter-lead-status">
                      <span className={`letter-status-dot ${lead.statusColor}`} />
                      <em>{letterLeadStatusLabel(lead)}</em>
                      <small>{letterStateLabels[lead.currentState] ?? lead.currentState}</small>
                    </div>
                  </article>
                )) : (
                  <div className="letter-empty">
                    <Globe2 size={32} />
                    <strong>暂无客户数据</strong>
                    <span>在单封写信页添加客户网站和邮箱开始分析。</span>
                  </div>
                )}
              </div>

              <div className="letter-panel letter-detail-panel">
                <div className="letter-panel-heading">
                  <div>
                    <h2>{selectedLead ? '客户详情' : '新增客户'}</h2>
                    <p>保存后可以生成开发信，也可以加入批量写信。</p>
                  </div>
                  {selectedLead ? <span className="letter-badge">{letterLeadStatusLabel(selectedLead)}</span> : null}
                </div>
                <div className="letter-form-grid">
                  <label>公司名称<input value={leadDraft.companyName} onChange={(event) => updateLead('companyName', event.target.value)} /></label>
                  <label>客户邮箱<input value={leadDraft.email} onChange={(event) => updateLead('email', event.target.value)} /></label>
                  <label>联系人<input value={leadDraft.contactName} onChange={(event) => updateLead('contactName', event.target.value)} /></label>
                  <label>职位<input value={leadDraft.contactTitle} onChange={(event) => updateLead('contactTitle', event.target.value)} /></label>
                  <label>网站<input value={leadDraft.website} onChange={(event) => updateLead('website', event.target.value)} /></label>
                  <label>国家/地区<input value={leadDraft.country} onChange={(event) => updateLead('country', event.target.value)} /></label>
                </div>
                <label className="letter-field">客户需求<textarea value={leadDraft.need} onChange={(event) => updateLead('need', event.target.value)} placeholder="客户可能在找什么？" /></label>
                <label className="letter-field">备注<textarea value={leadDraft.notes} onChange={(event) => updateLead('notes', event.target.value)} /></label>
                <div className="letter-action-row letter-sticky-actions">
                  <button className="letter-secondary" type="button" onClick={() => { setSelectedLeadId(''); setLeadDraft(emptyLeadDraft()) }}>新建</button>
                  <button className="letter-primary" type="button" disabled={busy === 'lead'} onClick={saveLead}>保存客户</button>
                  <button className="letter-secondary" type="button" disabled={!selectedLead || busy === 'generate'} onClick={generateDraft}>生成草稿</button>
                </div>
                {hasVisibleSingleDraft ? (
                  <section className="letter-draft-card" aria-label="生成的开发信草稿">
                    <div className="letter-draft-heading">
                      <div>
                        <h3><Mail size={17} /> 生成的开发信</h3>
                        <p>生成完成后会显示在这里。你可以修改、复制、检查质量，再决定是否发送。</p>
                      </div>
                      {activeDraftStatus ? <span className="letter-badge">{copy.devLetter.results.status[activeDraftStatus]}</span> : null}
                    </div>
                    <LetterGenerationTrace
                      mode={generationMode}
                      running={singleGenerationRunning}
                      completedAt={singleGenerationCompletedAt}
                      open={generationOpen}
                      onToggle={setGenerationOpen}
                    />
                    {workflowEmails.length > 1 ? (
                      <div className="letter-email-sequence-tabs" aria-label="选择邮件序列">
                        {workflowEmails.map((email) => (
                          <button className={selectedWorkflowEmail?.id === email.id ? 'active' : ''} type="button" key={email.id} onClick={() => selectWorkflowEmail(email)}>
                            {email.step === 0 ? copy.devLetter.results.firstEmail : copy.devLetter.results.followUp(email.step)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {draftSubject.trim() || draftBody.trim() ? (
                      <>
                        <label className="letter-field">邮件主题<input value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} /></label>
                        <label className="letter-field">邮件正文<textarea className="letter-draft-body" value={draftBody} onChange={(event) => setDraftBody(event.target.value)} /></label>
                        <LetterQualitySummary
                          review={activeQualityReview}
                          strategy={activeStrategyMatch}
                          riskReview={activeRiskReview}
                          researchBrief={activeResearchBrief}
                          leadFitScore={activeLeadFitScore}
                          evidenceLock={activeEvidenceLock}
                          valueMatch={activeValueMatch}
                          learningSignal={activeLearningSignal}
                          evidenceUsed={activeEvidenceUsed}
                          generationSummary={activeGenerationSummary}
                          matchedExampleCount={activeMatchedExampleCount}
                          modelUsed={activeModelUsed}
                          stale={singleDraftChanged}
                          copy={copy}
                        />
                        <div className="letter-action-row wrap letter-sticky-actions">
                          <button className="letter-primary" type="button" disabled={!activeDraftId || busy === 'draft'} onClick={saveDraftEdits}>保存草稿</button>
                          <button className="letter-secondary" type="button" disabled={!activeDraftId || busy === 'reviewDraft'} onClick={reviewCurrentDraft}>{busy === 'reviewDraft' ? copy.devLetter.quality.reviewing : copy.devLetter.quality.review}</button>
                          <button className="letter-secondary" type="button" disabled={!activeDraftId || busy === 'rewriteDraft'} onClick={rewriteCurrentDraft}>{busy === 'rewriteDraft' ? copy.devLetter.quality.rewriting : copy.devLetter.quality.rewrite}</button>
                          <button className="letter-secondary" type="button" disabled={!activeDraftId || busy === 'assetGoldenFromDraft'} onClick={saveCurrentDraftAsGoldenExample}>保存为好样例</button>
                          <button className="letter-secondary" type="button" disabled={!draftSubject.trim() || !draftBody.trim()} onClick={copyDraft}>复制草稿</button>
                          <button className="letter-secondary" type="button" disabled={!canSendSingleDraft} title={singleSendBlocker} onClick={sendDraft}>确认发送</button>
                        </div>
                      </>
                    ) : (
                      <div className="letter-empty small">生成中会先整理客户和公司资料，完成后主题和正文会出现在这里。</div>
                    )}
                  </section>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {letterView === 'automation' ? (
          <div className="letter-view">
            <section className="letter-stats-grid compact">
              {[
                { label: '待生成', value: letterStats.new, icon: Users, tone: 'blue' },
                { label: '待发送', value: letterStats.drafted, icon: Mail, tone: 'amber' },
                { label: '批量已发送', value: selectedCampaign?.stats.sent ?? 0, icon: Send, tone: 'green' },
                { label: '需跟进', value: campaignFollowUpStats.ready + campaignFollowUpStats.scheduled, icon: Clock, tone: 'rose' },
                { label: '已回复', value: selectedCampaign?.stats.replied ?? letterStats.replied, icon: CheckCircle2, tone: 'violet' },
              ].map((stat) => {
                const Icon = stat.icon
                return <div className="letter-stat-card" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><i className={stat.tone}><Icon size={20} /></i></div>
              })}
            </section>

            <section className="letter-two-column">
              <div className="letter-panel">
                <div className="letter-panel-heading">
                  <div>
                    <h2><Upload size={18} /> 导入批量客户</h2>
                    <p>支持 Excel / CSV，也可以直接粘贴“邮箱、网站、联系人”。</p>
                  </div>
                </div>
                <label className="letter-drop-zone">
                  <FileText size={24} />
                  <span>点击选择 Excel / CSV 文件</span>
                  <small>支持 .xlsx、.xls、.csv、.txt</small>
                  <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={importLetterFile} />
                </label>
                <label className="letter-drop-zone letter-drop-zone-primary">
                  <Zap size={24} />
                  <span>选择文件并生成开发信</span>
                  <small>一个邮箱一个客户，每个客户单独背调和写信</small>
                  <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={importLetterFileAndGenerate} />
                </label>
                <textarea className="letter-import-textarea" value={bulkImportText} onChange={(event) => setBulkImportText(event.target.value)} placeholder="buyer@example.com, https://example.com, John Smith&#10;another@company.com, https://company.com" />
                <button className="letter-primary full" type="button" disabled={busy === 'letterImportGenerate' || busy === 'letterFileGenerate'} onClick={() => importAndGenerateLetterLeads()}>
                  批量导入并生成开发信
                </button>
                <button className="letter-secondary full" type="button" disabled={busy === 'letterImport' || busy === 'letterFile'} onClick={() => importLetterLeads()}>
                  仅导入客户
                </button>
              </div>

              <div className="letter-panel">
                <div className="letter-panel-heading">
                  <div>
                    <h2><Zap size={18} /> 批量智能体队列</h2>
                    <p>选择客户后创建批量写信任务；每个客户都会单独背调并生成一封开发信。</p>
                  </div>
                </div>
                <div className="letter-action-row wrap">
                  <button type="button" className="letter-secondary" onClick={() => setSelectedCampaignLeadIds(leads.filter((lead) => leadMatchesLetterFilter(lead, 'new')).map((lead) => lead.id))}>选择待生成客户 ({letterStats.new})</button>
                  <button type="button" className="letter-secondary" onClick={() => setSelectedCampaignLeadIds(leads.map((lead) => lead.id))}>选择全部客户</button>
                </div>
                <label className="letter-field">Campaign 名称<input value={campaignName} onChange={(event) => { campaignNameEditedRef.current = true; setCampaignName(event.target.value) }} /></label>
                <div className="letter-action-row">
                  <button className="letter-primary" type="button" disabled={!selectedCampaignLeadIds.length || busy === 'campaignCreate'} onClick={createCampaign}>创建批量写信 ({selectedCampaignLeadIds.length})</button>
                  <button className="letter-secondary" type="button" disabled={!selectedCampaign || busy === 'campaignGenerate'} onClick={generateCampaign}>逐客户智能体生成</button>
                </div>
              </div>

              <div className="letter-panel letter-wide-panel">
                <div className="letter-panel-heading">
                  <div>
                    <h2><Send size={18} /> 发送和跟进</h2>
                    <p>发送前会检查发件邮箱、草稿质量和用户确认。</p>
                  </div>
                  {selectedCampaign ? <span className="letter-badge">{selectedCampaign.status}</span> : null}
                </div>
                {selectedCampaign ? (
                  <div className="letter-campaign-summary">
                    <strong>{selectedCampaign.name}</strong>
                    <span>{selectedCampaign.stats.generated} 待审核 · {selectedCampaign.stats.approved} 可发送 · {selectedCampaign.stats.sent} 已发送</span>
                  </div>
                ) : <div className="letter-empty small">还没有批量写信任务。先导入或选择客户，再创建批量写信任务。</div>}
                <div className="letter-action-row wrap">
                  <button className="letter-primary" type="button" disabled={!selectedCampaign || busy === 'campaignSend'} onClick={startCampaign}>一键发送</button>
                  <button className="letter-secondary" type="button" disabled={!selectedCampaign || busy === 'followUpsSchedule'} onClick={scheduleCampaignFollowUps}>安排跟进</button>
                  <button className="letter-secondary" type="button" disabled={busy === 'followUpsTick'} onClick={runFollowUpTick}>检查跟进</button>
                  <button className="letter-secondary" type="button" disabled={!selectedCampaign || busy === 'inboxCheck'} onClick={checkCampaignInbox}>检查回复</button>
                </div>
                {nextFollowUps.length ? (
                  <div className="letter-followup-list">
                    {nextFollowUps.map((job) => <span key={job.id}>{job.companyName} · {job.status} · {new Date(job.sendAt).toLocaleString()}</span>)}
                  </div>
                ) : null}
              </div>
            </section>
            {hasVisibleCampaignDraft ? (
              <section className="letter-panel letter-campaign-review-panel">
                <div className="letter-panel-heading">
                  <div>
                    <h2><Eye size={18} /> 逐封查看生成邮件</h2>
                    <p>批量生成后，每个客户的邮件都会在这里显示。检查通过后才会发送。</p>
                  </div>
                  {selectedCampaign ? <span className="letter-badge">{selectedCampaign.stats.generated} 待审核</span> : null}
                </div>
                <LetterGenerationTrace
                  mode="campaign"
                  running={campaignGenerationRunning}
                  completedAt={campaignGenerationCompletedAt}
                  open={generationOpen}
                  onToggle={setGenerationOpen}
                />
                {selectedCampaign ? (
                  <div className="letter-campaign-review-grid">
                    <div className="letter-recipient-list" aria-label="批量客户邮件列表">
                      {campaignRecipients.length ? campaignRecipients.map((recipient) => (
                        <button
                          className={`letter-recipient-row ${selectedCampaignRecipient?.id === recipient.id ? 'active' : ''}`}
                          type="button"
                          key={recipient.id}
                          onClick={() => setSelectedCampaignRecipientId(recipient.id)}
                        >
                          <strong>{recipient.companyName}</strong>
                          <span>{recipient.email || copy.devLetter.batch.missingEmail}</span>
                          <small>{copy.devLetter.batch.recipientStatus[recipient.status]}</small>
                        </button>
                      )) : <div className="letter-empty small">这批任务里还没有客户。</div>}
                    </div>
                    <div className="letter-campaign-draft-view">
                      {selectedCampaignRecipient?.draft ? (
                        <>
                          <div className="letter-draft-heading compact">
                            <div>
                              <h3>{selectedCampaignRecipient.companyName}</h3>
                              <p>{selectedCampaignRecipient.website} · {selectedCampaignRecipient.email}</p>
                            </div>
                            <span className="letter-badge">{copy.devLetter.batch.recipientStatus[selectedCampaignRecipient.status]}</span>
                          </div>
                          <label className="letter-field">邮件主题<input value={campaignDraftSubject} onChange={(event) => setCampaignDraftSubject(event.target.value)} /></label>
                          <label className="letter-field">邮件正文<textarea className="letter-draft-body" value={campaignDraftBody} onChange={(event) => setCampaignDraftBody(event.target.value)} /></label>
                          <LetterQualitySummary
                            review={campaignQualityReview}
                            strategy={campaignStrategyMatch}
                            riskReview={campaignRiskReview}
                            researchBrief={campaignResearchBrief}
                            leadFitScore={campaignLeadFitScore}
                            evidenceLock={campaignEvidenceLock}
                            valueMatch={campaignValueMatch}
                            learningSignal={campaignLearningSignal}
                            evidenceUsed={campaignEvidenceUsed}
                            generationSummary={campaignGenerationSummary}
                            matchedExampleCount={campaignMatchedExampleCount}
                            modelUsed={campaignModelUsed}
                            stale={campaignDraftChanged}
                            copy={copy}
                          />
                          <div className="letter-action-row wrap">
                            <button className="letter-secondary" type="button" disabled={busy === 'campaignReviewQuality'} onClick={reviewCampaignRecipient}>{busy === 'campaignReviewQuality' ? copy.devLetter.quality.reviewing : copy.devLetter.quality.review}</button>
                            <button className="letter-secondary" type="button" disabled={busy === 'campaignRewriteQuality'} onClick={rewriteCampaignRecipient}>{busy === 'campaignRewriteQuality' ? copy.devLetter.quality.rewriting : copy.devLetter.quality.rewrite}</button>
                            <button className="letter-primary" type="button" disabled={busy === 'campaignApprove'} onClick={approveCampaignRecipient}>{copy.devLetter.batch.actions.approve}</button>
                            <button className="letter-secondary" type="button" disabled={busy === 'assetGoldenFromDraft'} onClick={saveCampaignDraftAsGoldenExample}>保存为好样例</button>
                            <button className="letter-secondary" type="button" disabled={!campaignDraftSubject.trim() || !campaignDraftBody.trim()} onClick={() => copyEmailDraft(campaignDraftSubject, campaignDraftBody)}>复制草稿</button>
                            <button className="letter-secondary" type="button" disabled={busy === `campaignSkip:${selectedCampaignRecipient.id}`} onClick={() => skipCampaignRecipient(selectedCampaignRecipient)}>{copy.devLetter.batch.actions.skip}</button>
                          </div>
                        </>
                      ) : (
                        <div className="letter-empty small">
                          {campaignGenerationRunning ? '正在生成这批客户的邮件，完成后会在这里逐封显示。' : copy.devLetter.batch.emptyReview}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="letter-empty small">先导入或选择客户并创建批量写信，生成后即可逐封查看邮件。</div>
                )}
              </section>
            ) : null}
          </div>
        ) : null}

        {letterView === 'assets' ? (
          <div className="letter-view">
            <section className="letter-stats-grid compact">
              {[
                { label: '买家画像', value: buyerPersonas.length, icon: Users, tone: 'blue' },
                { label: 'USP 库', value: uspAssets.length, icon: ShieldCheck, tone: 'green' },
                { label: 'CTA 资产', value: ctaAssets.length, icon: FileText, tone: 'amber' },
                { label: '黄金样例', value: goldenExamples.length, icon: Star, tone: 'rose' },
                { label: '公司资料', value: companyMaterials.length, icon: FolderOpen, tone: 'violet' },
              ].map((stat) => {
                const Icon = stat.icon
                return <div className="letter-stat-card" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><i className={stat.tone}><Icon size={20} /></i></div>
              })}
            </section>

            <section className="letter-assets-grid">
              <div className="letter-panel">
                <div className="letter-panel-heading">
                  <div>
                    <h2><Users size={18} /> 买家画像库</h2>
                    <p>提前保存常见买家角色，AI 写信时会用它判断买家痛点和采购触发点。</p>
                  </div>
                </div>
                <div className="letter-form-grid">
                  <label>画像名称<input value={personaDraft.name} onChange={(event) => setPersonaDraft({ ...personaDraft, name: event.target.value })} placeholder="Flooring importer / Contractor distributor" /></label>
                  <label>公司类型<input value={personaDraft.companyType} onChange={(event) => setPersonaDraft({ ...personaDraft, companyType: event.target.value })} placeholder="importer, distributor, retailer..." /></label>
                  <label className="letter-form-span">买家角色<input value={personaDraft.buyerRoles} onChange={(event) => setPersonaDraft({ ...personaDraft, buyerRoles: event.target.value })} placeholder="采购经理, category manager, owner" /></label>
                  <label className="letter-form-span">典型痛点<textarea value={personaDraft.painPoints} onChange={(event) => setPersonaDraft({ ...personaDraft, painPoints: event.target.value })} placeholder="lead time risk; certification proof; sample comparison" /></label>
                </div>
                <button className="letter-primary full" type="button" disabled={busy === 'assetPersona'} onClick={saveBuyerPersonaAsset}>保存买家画像</button>
                <div className="letter-asset-list">
                  {buyerPersonas.length ? buyerPersonas.slice(0, 6).map((persona) => (
                    <article className="letter-asset-row" key={persona.id}>
                      <strong>{persona.name}</strong>
                      <span>{persona.companyType || persona.buyerRoles.join(', ') || '未补充类型'}</span>
                    </article>
                  )) : <div className="letter-empty small">还没有买家画像。先保存一个常见客户类型。</div>}
                </div>
              </div>

              <div className="letter-panel">
                <div className="letter-panel-heading">
                  <div>
                    <h2><ShieldCheck size={18} /> USP 库</h2>
                    <p>不要让 AI 瞎编卖点。把真实 USP、证据和适用场景放在这里。</p>
                  </div>
                </div>
                <div className="letter-form-grid">
                  <label className="letter-form-span">USP 标题<input value={uspDraft.headline} onChange={(event) => setUspDraft({ ...uspDraft, headline: event.target.value })} placeholder="Sample-ready SPC flooring options" /></label>
                  <label>分类<input value={uspDraft.category} onChange={(event) => setUspDraft({ ...uspDraft, category: event.target.value })} /></label>
                  <label className="letter-form-span">买家角度<textarea value={uspDraft.buyerAngle} onChange={(event) => setUspDraft({ ...uspDraft, buyerAngle: event.target.value })} placeholder="Why this matters to buyer sourcing risk, KPI or channel..." /></label>
                  <label className="letter-form-span">可证明依据<textarea value={uspDraft.proof} onChange={(event) => setUspDraft({ ...uspDraft, proof: event.target.value })} placeholder="Certification, sample policy, MOQ, lead time, catalog, case..." /></label>
                </div>
                <button className="letter-primary full" type="button" disabled={busy === 'assetUsp'} onClick={saveUspAsset}>保存 USP</button>
                <div className="letter-asset-list">
                  {uspAssets.length ? uspAssets.slice(0, 6).map((usp) => (
                    <article className="letter-asset-row" key={usp.id}>
                      <strong>{usp.headline}</strong>
                      <span>{usp.buyerAngle || usp.proof || usp.category}</span>
                    </article>
                  )) : <div className="letter-empty small">还没有 USP。保存后写信会优先匹配真实卖点。</div>}
                </div>
              </div>

              <div className="letter-panel letter-assets-wide">
                <div className="letter-panel-heading">
                  <div>
                    <h2><FileText size={18} /> CTA 资产库</h2>
                    <p>低摩擦 CTA 必须真的能交付。比如样品选项、MOQ/交期表、认证包、规格对比。</p>
                  </div>
                </div>
                <div className="letter-form-grid">
                  <label>资产名称<input value={ctaDraft.name} onChange={(event) => setCtaDraft({ ...ctaDraft, name: event.target.value })} placeholder="2-3 sample-ready options" /></label>
                  <label>资产类型
                    <select value={ctaDraft.type} onChange={(event) => setCtaDraft({ ...ctaDraft, type: event.target.value as OutreachCtaAsset['type'] })}>
                      <option value="sample_options">样品/选项包</option>
                      <option value="moq_leadtime_sheet">MOQ/交期表</option>
                      <option value="spec_comparison">规格对比</option>
                      <option value="certification_pack">认证/证明包</option>
                      <option value="catalog">产品目录</option>
                      <option value="case_study">案例</option>
                      <option value="packaging_options">包装选项</option>
                      <option value="quote_range">报价范围</option>
                      <option value="custom">自定义</option>
                    </select>
                  </label>
                  <label className="letter-form-span">描述<input value={ctaDraft.description} onChange={(event) => setCtaDraft({ ...ctaDraft, description: event.target.value })} placeholder="What the buyer receives if they reply" /></label>
                  <label className="letter-form-span">资产内容<textarea value={ctaDraft.assetText} onChange={(event) => setCtaDraft({ ...ctaDraft, assetText: event.target.value })} placeholder="可交付内容、包含哪些信息、适合哪些客户..." /></label>
                </div>
                <button className="letter-primary full" type="button" disabled={busy === 'assetCta'} onClick={saveCtaAsset}>保存 CTA 资产</button>
                <div className="letter-asset-list columns">
                  {ctaAssets.length ? ctaAssets.slice(0, 8).map((asset) => (
                    <article className="letter-asset-row" key={asset.id}>
                      <strong>{asset.name}</strong>
                      <span>{asset.type.replace(/_/g, ' ')} · {asset.description || '未补充描述'}</span>
                    </article>
                  )) : <div className="letter-empty small">还没有 CTA 资产。没有资产时，风控会阻止虚假的资料包承诺。</div>}
                </div>
              </div>

              <div className="letter-panel letter-assets-wide">
                <div className="letter-panel-heading">
                  <div>
                    <h2><Star size={18} /> 黄金邮件样例</h2>
                    <p>保存你认可的好邮件。以后 AI 写信会参考它的表达方式，但不会照抄客户信息。</p>
                  </div>
                </div>
                <div className="letter-form-grid">
                  <label>样例标题<input value={goldenDraft.title} onChange={(event) => setGoldenDraft({ ...goldenDraft, title: event.target.value })} placeholder="SPC importer first email" /></label>
                  <label>行业 / 买家类型<input value={goldenDraft.industry} onChange={(event) => setGoldenDraft({ ...goldenDraft, industry: event.target.value })} placeholder="flooring importer / distributor" /></label>
                  <label>产品线<input value={goldenDraft.productLine} onChange={(event) => setGoldenDraft({ ...goldenDraft, productLine: event.target.value })} placeholder="SPC / LVT / vinyl plank" /></label>
                  <label>标签<input value={goldenDraft.tags} onChange={(event) => setGoldenDraft({ ...goldenDraft, tags: event.target.value })} placeholder="warm, sample options, proof pack" /></label>
                  <label className="letter-form-span">邮件主题<input value={goldenDraft.subject} onChange={(event) => setGoldenDraft({ ...goldenDraft, subject: event.target.value })} placeholder="Short subject line" /></label>
                  <label className="letter-form-span">邮件正文<textarea value={goldenDraft.body} onChange={(event) => setGoldenDraft({ ...goldenDraft, body: event.target.value })} placeholder="Paste a strong email example here." /></label>
                </div>
                <button className="letter-primary full" type="button" disabled={busy === 'assetGolden'} onClick={() => saveGoldenExampleAsset()}>保存黄金样例</button>
                <div className="letter-asset-list columns">
                  {goldenExamples.length ? goldenExamples.slice(0, 8).map((example) => (
                    <article className="letter-asset-row" key={example.id}>
                      <strong>{example.title}</strong>
                      <span>{example.subject} · {example.qualityScore ? `${example.qualityScore}/100` : '未评分'}</span>
                    </article>
                  )) : <div className="letter-empty small">还没有黄金样例。可以从生成好的邮件里点击“保存为好样例”。</div>}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {letterView === 'profile' ? (
          <div className="letter-view">
            <section className="letter-panel">
              <div className="letter-panel-heading">
                <div>
                  <h2><UserRound size={18} /> 公司资料</h2>
                  <p>Hermills 会用这些公司资料写开发信、研究客户和回复买家。</p>
                </div>
                <button className="letter-primary compact" type="button" onClick={onOpenCompanyKnowledge}>编辑公司资料</button>
              </div>
              <div className="letter-profile-grid">
                <div><span>公司名称</span><strong>{companyProfile.name || '还没填写'}</strong></div>
                <div><span>公司官网</span><strong>{companyProfile.website || '还没填写'}</strong></div>
                <div><span>主营产品</span><strong>{companyProfile.mainProducts?.join(', ') || '还没填写'}</strong></div>
                <div><span>认证资质</span><strong>{companyProfile.certifications?.join(', ') || '还没填写'}</strong></div>
                <div><span>公司资料</span><strong>{companyMaterials.length} 个文件</strong></div>
                <div><span>状态</span><strong>{companyReady ? '已准备好' : '需要补充资料'}</strong></div>
              </div>
            </section>
          </div>
        ) : null}

        {letterView === 'signature' ? (
          <div className="letter-view">
            <section className="letter-panel signature-settings-panel">
              <div className="letter-panel-heading">
                <div>
                  <h2><ImageIcon size={18} /> 签名与 Logo</h2>
                  <p>填写文字签名，上传公司 Logo。保存后所有开发信都会自动带上。</p>
                </div>
                {emailSignature?.enabled ? <span className="letter-badge success">已保存</span> : <span className="letter-badge">未保存</span>}
              </div>
              <label className="letter-field signature-text-field">
                文字签名
                <textarea value={signatureDraft.text} onChange={(event) => updateSignature('text', event.target.value)} placeholder="Your Name&#10;Sales Manager&#10;Company&#10;Phone / WhatsApp&#10;Website" />
              </label>
              <div className="signature-logo-box">
                <div>
                  <strong>{emailSignature?.logo ? emailSignature.logo.fileName : '还没有上传 Logo'}</strong>
                  <span>{emailSignature?.logo ? `${Math.round(emailSignature.logo.size / 1024)} KB · ${emailSignature.logo.mimeType}` : '支持 PNG / JPG / WebP / GIF，最大 2 MB。'}</span>
                </div>
                <label className="letter-secondary file-button">
                  上传 Logo
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadSignatureLogo} />
                </label>
                <button className="letter-secondary" type="button" disabled={!emailSignature?.logo || busy === 'signatureLogoDelete'} onClick={deleteSignatureLogo}>删除 Logo</button>
              </div>
              <div className="signature-preview">
                <span>发送预览</span>
                <p>Hi buyer, this is where the generated outreach email appears.</p>
                {emailSignature?.logo ? <strong>{emailSignature.logo.fileName}</strong> : null}
                {signatureDraft.text.trim() ? <pre>{signatureDraft.text}</pre> : <em>还没有文字签名</em>}
              </div>
              <div className="letter-action-row wrap">
                <button className="letter-primary" type="button" disabled={busy === 'signature'} onClick={saveSignature}>保存签名和 Logo</button>
              </div>
            </section>
          </div>
        ) : null}

        {letterView === 'mail' ? (
          <div className="letter-view">
            <section className="letter-panel mail-settings-panel">
              <div className="letter-panel-heading">
                <div>
                  <h2><Settings size={18} /> 邮箱</h2>
                  <p>普通用户只需要填写自己的邮箱和邮箱授权码。发送参数会在后台自动匹配。</p>
                </div>
                {senderDeliveryReady ? <span className="letter-badge success">已确认</span> : <span className="letter-badge">待确认</span>}
              </div>
              <div className="mail-simple-panel">
                <div className="mail-simple-status">
                  <div>
                    <strong>自动配置：{senderProvider.label} SMTP</strong>
                    <span>当前将使用 {senderAuthGuide.smtpLabel}。如果识别不正确，可以展开高级设置手动切换。</span>
                  </div>
                  <small>{senderDeliveryReady ? '可发送' : senderLoginReady ? '连接正常' : '待测试'}</small>
                </div>
                <div className="letter-form-grid mail-simple-grid">
                  <div className="letter-form-field">
                    <label htmlFor="sender-simple-email">你的发件邮箱</label>
                    <input
                      ref={senderEmailRef}
                      id="sender-simple-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={senderDraft.email}
                      onChange={(event) => updateSenderEmail(event.currentTarget.value)}
                      placeholder="sales@company.com"
                    />
                  </div>
                  <div className="letter-form-field">
                    <label htmlFor="sender-simple-password">邮箱授权码 / SMTP 密码</label>
                    <input
                      id="sender-simple-password"
                      type="password"
                      autoComplete="new-password"
                      value={senderDraft.password}
                      onChange={(event) => updateSender('password', event.currentTarget.value)}
                      placeholder={senderDraft.id ? selectedSender?.passwordPreview || '粘贴邮箱授权码' : '粘贴邮箱授权码'}
                    />
                  </div>
                  <div className="letter-form-field">
                    <label htmlFor="sender-simple-from-name">显示名称</label>
                    <input
                      id="sender-simple-from-name"
                      value={senderDraft.fromName}
                      onChange={(event) => updateSender('fromName', event.currentTarget.value)}
                      placeholder={companyProfile.name || 'Your company'}
                    />
                  </div>
                </div>
                <div className="mail-helper-card">
                  <KeyRound size={18} />
                  <div>
                    <strong>不知道授权码在哪里？</strong>
                    <span>点击按钮会打开邮箱服务商的授权码页面。生成后复制回来，粘贴到上面的授权码框。</span>
                  </div>
                  <button className="letter-secondary" type="button" onClick={openSenderAuthGuide}>获取 SMTP 授权码</button>
                </div>
                <div className="letter-action-row wrap sender-action-row">
                  <button className="letter-primary" type="button" disabled={busy === 'sender' || busy === 'mailSetup'} onClick={saveAndTestSender}>
                    {busy === 'mailSetup' || busy === 'sender' ? '正在保存并测试...' : '保存并测试邮箱'}
                  </button>
                  <button className="letter-secondary" type="button" disabled={busy === 'confirmDelivery' || !senderTestEmailReady} onClick={confirmSenderDelivery}>确认已收到测试邮件</button>
                </div>
              </div>
              <details className="mail-advanced-settings" open={mailAdvancedOpen} onToggle={(event) => setMailAdvancedOpen(event.currentTarget.open)}>
                <summary>高级设置（一般不用管）</summary>
                <div className="sender-channel-section">
                  <div className="sender-subsection-heading">
                    <span>发送通道</span>
                    <small>当前：{senderChannel.label}</small>
                  </div>
                  <div className="sender-channel-grid" aria-label="选择发送通道">
                    {senderChannelOptions.map((channel) => {
                      const ChannelIcon = channel.icon
                      const active = senderChannel.id === channel.id
                      return (
                        <button key={channel.id} className={active ? 'sender-channel-card active' : 'sender-channel-card'} type="button" aria-pressed={active} onClick={() => chooseSenderChannel(channel.id)}>
                          <span className="sender-channel-top">
                            <span><ChannelIcon size={16} /> {channel.label}</span>
                            <small>{active ? '已选择' : channel.status}</small>
                          </span>
                          <em>{channel.detail}</em>
                        </button>
                      )
                    })}
                  </div>
                  <div className={senderApiChannelSelected ? 'sender-channel-status warning' : 'sender-channel-status ready'}>
                    <div>
                      <strong>{senderApiChannelSelected ? `${senderChannel.label} 已选` : `${senderProvider.label} SMTP 可配置`}</strong>
                      <span>{senderApiChannelSelected ? '此通道会通过 HTTPS API 发信；请填写 API/OAuth 凭据，测试成功后再确认收件。' : `正在使用 ${senderAuthGuide.smtpLabel}。如果 SMTP 被邮箱服务商拦截，可改选 ${senderRecommendedApiChannel.label}。`}</span>
                    </div>
                    <small>{senderApiChannelSelected ? 'HTTPS API' : 'SMTP'}</small>
                  </div>
                </div>
                <div className="sender-subsection-heading smtp-heading">
                  <span>SMTP 邮箱预设</span>
                  <small>{senderAuthGuide.smtpLabel}</small>
                </div>
                <div className="letter-provider-grid">
                  {senderProviderPresets.map((preset) => (
                    <button key={preset.id} className={senderProviderId === preset.id ? 'active' : ''} type="button" onClick={() => chooseSenderProvider(preset.id)}>
                      <Mail size={15} /> {preset.id === 'outlook' ? 'Microsoft 365 SMTP' : preset.id === 'custom' ? '自定义 SMTP' : `${preset.label} SMTP`}
                    </button>
                  ))}
                </div>
                <div className="letter-form-grid">
                  <label>SMTP 主机<input value={senderDraft.host} onChange={(event) => updateSender('host', event.target.value)} /></label>
                  <label>SMTP 端口<input value={senderDraft.port} onChange={(event) => updateSender('port', event.target.value)} /></label>
                  <label>登录用户名<input value={senderDraft.username} onChange={(event) => updateSender('username', event.target.value)} /></label>
                  <label>外部测试收件箱<input value={senderTestRecipient} onChange={(event) => setSenderTestRecipient(event.target.value)} placeholder="建议填你自己的另一个邮箱，验证真正外发" /></label>
                  {senderApiChannelSelected ? (
                    <>
                      <label>API Account ID<input value={senderDraft.apiAccountId} onChange={(event) => updateSender('apiAccountId', event.target.value)} placeholder={senderChannelId === 'zohoApi' ? 'Zoho accountId' : '可选'} /></label>
                      <label>API Base URL<input value={senderDraft.apiBaseUrl} onChange={(event) => updateSender('apiBaseUrl', event.target.value)} placeholder={senderChannelId === 'customHttpApi' || senderChannelId === 'enterpriseApi' ? 'https://mail-gateway.example/send' : '可选'} /></label>
                      <label className="letter-form-span">API / OAuth 凭据<textarea value={senderDraft.apiCredential} onChange={(event) => updateSender('apiCredential', event.target.value)} placeholder="可粘贴 access token，或包含 accessToken / refreshToken / clientId / clientSecret 的 JSON。" /></label>
                    </>
                  ) : null}
                </div>
                <div className="letter-action-row wrap sender-action-row">
                  <button className="letter-secondary" type="button" disabled={busy === 'sender'} onClick={saveSender}>{senderApiChannelSelected ? '保存 API 通道' : '保存 SMTP 设置'}</button>
                  <button className="letter-secondary" type="button" disabled={busy === 'testSender'} onClick={testSender}>{senderApiChannelSelected ? '测试 API 通道' : '测试 SMTP 连接'}</button>
                  <button className="letter-secondary" type="button" disabled={busy === 'testEmail' || !senderLoginReady} onClick={sendSenderTestEmail}>{senderApiChannelSelected ? '发送 API 测试邮件' : '发送 SMTP 测试邮件'}</button>
                  <button className="letter-secondary" type="button" disabled={busy === 'externalTestEmail' || !senderLoginReady || !senderTestRecipient.trim()} onClick={sendSenderExternalTestEmail}>测试外部收件箱</button>
                </div>
              </details>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  )
}


function emptyLeadDraft(): LeadFormDraft {
  return { companyName: '', website: '', country: '', industry: '', contactName: '', contactTitle: '', email: '', need: '', notes: '', tags: '' }
}

function leadFormFromLead(lead: OutreachLead): LeadFormDraft {
  return {
    companyName: lead.companyName,
    website: lead.website ?? '',
    country: lead.country ?? '',
    industry: lead.industry ?? '',
    contactName: lead.contactName ?? '',
    contactTitle: lead.contactTitle ?? '',
    email: lead.email ?? '',
    need: lead.need ?? '',
    notes: lead.notes ?? '',
    tags: lead.tags.join(', '),
  }
}

function leadInputFromForm(form: LeadFormDraft): OutreachLeadInput {
  return {
    companyName: form.companyName.trim(),
    website: optionalText(form.website),
    country: optionalText(form.country),
    industry: optionalText(form.industry),
    contactName: optionalText(form.contactName),
    contactTitle: optionalText(form.contactTitle),
    email: optionalText(form.email),
    need: form.need.trim(),
    notes: form.notes.trim(),
    tags: form.tags.split(/[;,，、]/).map((tag) => tag.trim()).filter(Boolean),
  }
}

function emptySenderDraft(companyProfile: CompanyProfile, copy: UiCopy): SenderFormDraft {
  return {
    label: copy.devLetter.mailSetup.defaultSenderLabel,
    fromName: companyProfile.name || copy.devLetter.mailSetup.defaultSenderFromName,
    email: '',
    host: 'smtp.gmail.com',
    port: '587',
    secure: false,
    imapHost: 'imap.gmail.com',
    imapPort: '993',
    imapSecure: true,
    imapUsername: '',
    username: '',
    password: '',
    apiCredential: '',
    apiAccountId: '',
    apiBaseUrl: '',
  }
}

function emptySignatureDraft(companyProfile: CompanyProfile): SignatureFormDraft {
  const company = companyProfile.name || 'Company'
  const website = companyProfile.website || ''
  return {
    enabled: false,
    text: [
      company,
      website,
    ].filter(Boolean).join('\n'),
    html: '',
    logoEnabled: true,
    logoAlt: `${company} logo`,
    logoWidth: '120',
  }
}

function signatureFormFromSettings(settings: OutreachEmailSignature, companyProfile: CompanyProfile): SignatureFormDraft {
  const fallback = emptySignatureDraft(companyProfile)
  return {
    enabled: settings.enabled,
    text: settings.text || fallback.text,
    html: settings.html || '',
    logoEnabled: settings.logoEnabled,
    logoAlt: settings.logoAlt || fallback.logoAlt,
    logoWidth: String(settings.logoWidth || 120),
  }
}

function isDefaultSenderLabel(label: string, copy: UiCopy): boolean {
  const normalized = label.trim()
  return !normalized
    || normalized === copy.devLetter.mailSetup.defaultSenderLabel
    || normalized === 'Company mailbox'
    || normalized === '公司发件邮箱'
    || senderProviderPresets.some((preset) => (
      normalized === `${preset.label} mailbox` || normalized === `${preset.label} 发件邮箱`
    ))
}

function isDefaultSenderFromName(fromName: string, companyProfile: CompanyProfile, copy: UiCopy): boolean {
  const normalized = fromName.trim()
  return !normalized
    || normalized === companyProfile.name
    || normalized === copy.devLetter.mailSetup.defaultSenderFromName
    || normalized === 'Sales team'
    || normalized === '销售团队'
}

function senderFormFromAccount(account: OutreachSenderAccount): SenderFormDraft {
  return {
    id: account.id,
    label: account.label,
    fromName: account.fromName ?? '',
    email: account.email,
    host: account.host ?? '',
    port: String(account.port),
    secure: account.secure,
    imapHost: account.imapHost ?? '',
    imapPort: String(account.imapPort ?? 993),
    imapSecure: account.imapSecure ?? true,
    imapUsername: account.imapUsername ?? '',
    username: account.username ?? '',
    password: '',
    apiCredential: '',
    apiAccountId: account.oauthApi?.accountId ?? account.serviceApi?.accountId ?? '',
    apiBaseUrl: account.oauthApi?.apiBaseUrl ?? account.serviceApi?.apiBaseUrl ?? '',
  }
}

function senderProviderFromHost(host: string | undefined): SenderProviderId {
  const normalized = host?.trim().toLowerCase() ?? ''
  return senderProviderPresets.find((provider) => provider.id !== 'custom' && provider.host === normalized)?.id ?? 'custom'
}

function senderChannelFromAccount(account: OutreachSenderAccount): SenderChannelId {
  if (account.sendChannel === 'oauth-api') {
    if (account.provider === 'gmail') return 'gmailApi'
    if (account.provider === 'outlook') return 'microsoftGraph'
    if (account.provider === 'zoho') return 'zohoApi'
  }
  if (account.sendChannel === 'service-api') {
    return account.provider === 'custom' ? 'customHttpApi' : 'enterpriseApi'
  }
  return 'smtp'
}

function sendChannelFromSenderChannel(id: SenderChannelId): 'smtp' | 'oauth-api' | 'service-api' {
  if (id === 'gmailApi' || id === 'microsoftGraph' || id === 'zohoApi') return 'oauth-api'
  if (id === 'enterpriseApi' || id === 'customHttpApi') return 'service-api'
  return 'smtp'
}

function providerFromSenderChannel(id: SenderChannelId, fallback: SenderProviderId): string {
  if (id === 'gmailApi') return 'gmail'
  if (id === 'microsoftGraph') return 'outlook'
  if (id === 'zohoApi') return 'zoho'
  if (id === 'customHttpApi') return 'custom'
  return fallback
}

function recommendedSenderApiChannel(provider: SenderProviderId): SenderChannelId {
  if (provider === 'gmail') return 'gmailApi'
  if (provider === 'outlook') return 'microsoftGraph'
  if (provider === 'zoho') return 'zohoApi'
  if (provider === 'tencent' || provider === 'aliyun') return 'enterpriseApi'
  return 'customHttpApi'
}

function defaultSenderApiScopes(provider: string): string[] {
  if (provider === 'gmail') return ['https://www.googleapis.com/auth/gmail.send']
  if (provider === 'outlook') return ['offline_access', 'Mail.Send']
  if (provider === 'zoho') return ['ZohoMail.messages.CREATE']
  return []
}

function senderProviderFromEmail(email: string): SenderProviderId | undefined {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  if (!domain) return undefined
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'gmail'
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain) || domain.endsWith('.onmicrosoft.com')) return 'outlook'
  if (domain === 'zoho.com' || domain === 'zohomail.com' || domain.endsWith('.zoho.com')) return 'zoho'
  return undefined
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function FirstRunDeployPage({
  runtime,
  setRuntime,
  loading,
  serviceError,
  onComplete,
  copy,
}: {
  runtime: RuntimeStatus
  setRuntime: (runtime: RuntimeStatus) => void
  loading: boolean
  serviceError: string
  onComplete: () => void | Promise<void>
  copy: UiCopy
}) {
  return (
    <main className="first-run-shell">
      <div className="first-run-brand">
        <div className="brand-mark">H</div>
        <strong>Hermes</strong>
      </div>
      {loading ? (
        <section className="first-run-card">
          <div className="setup-hero">
            <div className="runtime-symbol">
              <RefreshCw size={24} />
            </div>
            <div>
              <span>{copy.firstRun.setupEyebrow}</span>
              <h2>{copy.firstRun.checkingTitle}</h2>
              <p>{copy.firstRun.checkingDescription}</p>
            </div>
          </div>
          <div className="progress-rail">
            <span style={{ width: '18%' }} />
          </div>
          {serviceError ? <div className="inline-alert compact">{serviceError}</div> : null}
        </section>
      ) : (
        <RuntimeInstaller runtime={runtime} setRuntime={setRuntime} variant="first-run" serviceError={serviceError} onComplete={onComplete} copy={copy} />
      )}
    </main>
  )
}

function OnboardingLoadingPage({ serviceError, copy }: { serviceError: string; copy: UiCopy }) {
  return (
    <main className="onboarding-shell hermills-onboarding-shell">
      <header className="onboarding-brand">
        <div className="brand-mark">H</div>
        <div>
          <strong>Hermes</strong>
          <span>{copy.common.brandSubtitle}</span>
        </div>
      </header>
      <section className="onboarding-card loading">
        <div className="onboarding-loading">
          <div className="runtime-symbol">
            <RefreshCw size={24} />
          </div>
          <div>
            <span>{copy.onboarding.loadingEyebrow}</span>
            <h1>{copy.onboarding.loadingTitle}</h1>
            <p>{copy.onboarding.loadingDescription}</p>
          </div>
        </div>
        <div className="progress-rail">
          <span style={{ width: '34%' }} />
        </div>
        {serviceError ? <div className="inline-alert compact">{serviceError}</div> : null}
      </section>
    </main>
  )
}

function OnboardingWizard({
  initialState,
  initialCompanyProfile,
  companyMaterials,
  setCompanyProfile,
  setCompanyMaterials,
  companyOnly = false,
  serviceError,
  onFinished,
}: {
  initialState: OnboardingState
  initialCompanyProfile: CompanyProfile
  companyMaterials: Material[]
  setCompanyProfile: (profile: CompanyProfile) => void
  setCompanyMaterials: (materials: Material[]) => void
  companyOnly?: boolean
  serviceError: string
  onFinished: (state: OnboardingState) => void
}) {
  const steps = companyOnly ? companyOnboardingSteps : onboardingSteps
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<OnboardingDraft>(() => draftFromOnboarding(initialState, initialCompanyProfile))
  const [busy, setBusy] = useState(false)
  const [pickingWorkspace, setPickingWorkspace] = useState(false)
  const [uploadingCompanyFiles, setUploadingCompanyFiles] = useState(false)
  const [error, setError] = useState('')
  const step = steps[stepIndex] ?? steps[0]
  const copy = getUiCopy(draft.language)
  const stepCopy = copy.onboarding.steps[step.id]
  const StepIcon = step.icon
  const isLastStep = stepIndex === steps.length - 1
  const progress = `${((stepIndex + 1) / steps.length) * 100}%`

  function updateDraft(patch: Partial<OnboardingDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function updateProvider(patch: Partial<ProviderForm>) {
    setDraft((current) => ({ ...current, provider: { ...current.provider, ...patch } }))
  }

  function updateCompany(patch: Partial<ReturnType<typeof companyDraftFromProfile>>) {
    setDraft((current) => ({ ...current, company: { ...current.company, ...patch } }))
  }

  function setProviderChoice(providerChoice: OnboardingProviderChoice) {
    setDraft((current) => ({
      ...current,
      providerChoice,
      provider: providerChoice === 'skip' ? current.provider : providerFormFromPreset(providerChoice),
    }))
  }

  function setMemoryEnabled(memoryEnabled: boolean) {
    setDraft((current) => ({
      ...current,
      memoryEnabled,
      features: memoryEnabled
        ? Array.from(new Set([...current.features, 'memory']))
        : current.features.filter((feature) => feature !== 'memory'),
    }))
  }

  function toggleFeature(id: OnboardingFeatureId) {
    setDraft((current) => {
      const selected = current.features.includes(id)
      const features = selected ? current.features.filter((feature) => feature !== id) : [...current.features, id]
      return {
        ...current,
        memoryEnabled: id === 'memory' ? !selected : current.memoryEnabled,
        features,
      }
    })
  }

  async function saveCompanyDraft() {
    const saved = await api.saveCompanyProfile(companyProfileFromDraft(draft.company))
    setCompanyProfile(saved)
    return saved
  }

  async function uploadCompanyFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    if (!files.length) return
    setUploadingCompanyFiles(true)
    setError('')
    try {
      const saved: Material[] = []
      for (const file of files) {
        const material = await api.saveCompanyMaterial(file)
        saved.push(await api.updateCompanyMaterial(material.id, { category: 'product-catalog' }))
      }
      setCompanyMaterials([...saved, ...companyMaterials])
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'fileUpload'))
    } finally {
      setUploadingCompanyFiles(false)
      event.currentTarget.value = ''
    }
  }

  async function chooseWorkspaceDirectory() {
    setPickingWorkspace(true)
    setError('')
    try {
      const selection = await window.hermillsDesktop?.selectWorkspaceDirectory?.()
      if (!selection) {
        setError(copy.onboarding.validation.noDirectoryPicker)
        return
      }
      if (!selection.canceled && selection.path) updateDraft({ workspacePath: selection.path })
    } catch (err) {
      setError(humanizeErrorMessage(err, copy))
    } finally {
      setPickingWorkspace(false)
    }
  }

  function validateStep(): string {
    if (step.id === 'identity' && (!draft.userDisplayName.trim() || !draft.agentName.trim())) {
      return copy.onboarding.validation.missingNames
    }
    if (step.id === 'companyBasics' && (!draft.company.name.trim() || !draft.company.website.trim())) {
      return copy.onboarding.validation.missingCompanyBasics
    }
    if (step.id === 'companyProducts' && splitLines(draft.company.mainProducts).length === 0) {
      return copy.onboarding.validation.missingCompanyProducts
    }
    if (step.id === 'companyReview' && !isCompanyDraftReady(draft.company)) {
      return !draft.company.name.trim() || !draft.company.website.trim()
        ? copy.onboarding.validation.missingCompanyBasics
        : copy.onboarding.validation.missingCompanyProducts
    }
    if (step.id === 'provider' && draft.providerChoice !== 'skip') {
      if (!draft.provider.displayName.trim() || !draft.provider.baseUrl.trim() || !draft.provider.defaultModel.trim()) {
        return copy.onboarding.validation.missingProvider
      }
    }
    if (step.id === 'workspace' && !draft.workspacePath.trim()) return copy.onboarding.validation.missingWorkspace
    if (step.id === 'features' && draft.features.length === 0) return copy.onboarding.validation.missingFeature
    return ''
  }

  async function submitStep(event: FormEvent) {
    event.preventDefault()
    const validationError = validateStep()
    if (validationError) {
      setError(validationError)
      return
    }

    setBusy(true)
    setError('')
    const input = onboardingInputFromDraft(draft)
    try {
      if (isCompanyOnboardingStep(step.id)) await saveCompanyDraft()
      if (isLastStep) {
        onFinished(companyOnly ? normalizeOnboardingState(initialState) : await completeOnboardingState(input))
      } else {
        if (!companyOnly) await updateOnboardingState(input)
        setStepIndex((current) => Math.min(current + 1, steps.length - 1))
      }
    } catch (err) {
      setError(humanizeErrorMessage(err, copy))
    } finally {
      setBusy(false)
    }
  }

  function goBack() {
    setError('')
    setStepIndex((current) => Math.max(current - 1, 0))
  }

  return (
    <main className={`onboarding-shell hermills-onboarding-shell onboarding-theme-${draft.theme}`}>
      <header className="onboarding-brand">
        <div className="brand-mark">H</div>
        <div>
          <strong>Hermes</strong>
          <span>{copy.common.brandSubtitle}</span>
        </div>
      </header>

      <section className="onboarding-card">
        <aside className="onboarding-steps" aria-label={copy.onboarding.stepsAria}>
          {steps.map((item, index) => {
            const Icon = item.icon
            const state = index < stepIndex ? 'complete' : index === stepIndex ? 'active' : ''
            const itemCopy = copy.onboarding.steps[item.id]
            return (
              <button className={`onboarding-step-pill ${state}`} disabled={index > stepIndex} key={item.id} type="button" onClick={() => setStepIndex(index)}>
                <Icon size={16} />
                <span>{itemCopy.label}</span>
                {index < stepIndex ? <CheckCircle2 size={14} /> : null}
              </button>
            )
          })}
        </aside>

        <form className="onboarding-panel" onSubmit={submitStep}>
          <div className="onboarding-progress">
            <span style={{ width: progress }} />
          </div>

          <div className="onboarding-heading">
            <div className="onboarding-icon">
              <StepIcon size={22} />
            </div>
            <div>
              <span>{copy.onboarding.stepProgress(stepIndex + 1, steps.length)}</span>
              <h1>{stepCopy.title}</h1>
              <p>{stepCopy.description}</p>
            </div>
          </div>

          <div className="onboarding-content">
            {step.id === 'language' ? (
              <div className="onboarding-option-grid">
                {languageOptions.map((item) => (
                  <OnboardingOptionButton
                    active={draft.language === item.id}
                    detail={copy.onboarding.languageDetails[item.id]}
                    icon={Globe2}
                    key={item.id}
                    label={item.label}
                    onClick={() => updateDraft({ language: item.id })}
                  />
                ))}
              </div>
            ) : null}

            {step.id === 'identity' ? (
              <div className="onboarding-form-grid">
                <label>
                  <span>{copy.onboarding.identity.userName}</span>
                  <input value={draft.userDisplayName} onChange={(event) => updateDraft({ userDisplayName: event.target.value })} placeholder="Alex" />
                </label>
                <label>
                  <span>{copy.onboarding.identity.agentName}</span>
                  <input value={draft.agentName} onChange={(event) => updateDraft({ agentName: event.target.value })} placeholder="Hermes" />
                </label>
                <label className="onboarding-switch">
                  <input type="checkbox" checked={draft.memoryEnabled} onChange={(event) => setMemoryEnabled(event.target.checked)} />
                  <span>
                    <strong>{copy.onboarding.identity.memoryTitle}</strong>
                    <small>{copy.onboarding.identity.memoryDescription}</small>
                  </span>
                </label>
              </div>
            ) : null}

            {step.id === 'companyBasics' ? (
              <div className="onboarding-form-grid">
                <label>
                  <span>{copy.onboarding.company.name}</span>
                  <input value={draft.company.name} onChange={(event) => updateCompany({ name: event.target.value })} placeholder="Acme Trading" />
                </label>
                <label>
                  <span>{copy.onboarding.company.website}</span>
                  <input value={draft.company.website} onChange={(event) => updateCompany({ website: event.target.value })} placeholder="https://example.com" />
                </label>
              </div>
            ) : null}

            {step.id === 'companyProducts' ? (
              <div className="onboarding-form-grid">
                <label className="full-span">
                  <span>{copy.onboarding.company.mainProducts}</span>
                  <textarea value={draft.company.mainProducts} onChange={(event) => updateCompany({ mainProducts: event.target.value })} rows={6} placeholder="LED work lights&#10;Outdoor camping lamps&#10;Custom OEM lighting" />
                </label>
              </div>
            ) : null}

            {step.id === 'companyMarket' ? (
              <div className="onboarding-form-grid">
                <label className="full-span">
                  <span>{copy.onboarding.company.markets}</span>
                  <textarea value={draft.company.markets} onChange={(event) => updateCompany({ markets: event.target.value })} rows={6} placeholder="United States outdoor brands&#10;EU hardware distributors&#10;Amazon sellers" />
                </label>
              </div>
            ) : null}

            {step.id === 'companyTrust' ? (
              <div className="onboarding-form-grid">
                <label>
                  <span>{copy.onboarding.company.certifications}</span>
                  <textarea value={draft.company.certifications} onChange={(event) => updateCompany({ certifications: event.target.value })} rows={5} />
                </label>
                <label>
                  <span>{copy.onboarding.company.brandVoice}</span>
                  <textarea value={draft.company.brandVoice} onChange={(event) => updateCompany({ brandVoice: event.target.value })} rows={5} />
                </label>
              </div>
            ) : null}

            {step.id === 'companyTrade' ? (
              <div className="onboarding-form-grid">
                <label>
                  <span>{copy.onboarding.company.paymentTerms}</span>
                  <textarea value={draft.company.paymentTerms} onChange={(event) => updateCompany({ paymentTerms: event.target.value })} rows={4} />
                </label>
                <label>
                  <span>{copy.onboarding.company.shippingTerms}</span>
                  <textarea value={draft.company.shippingTerms} onChange={(event) => updateCompany({ shippingTerms: event.target.value })} rows={4} />
                </label>
                <label className="full-span">
                  <span>{copy.onboarding.company.notes}</span>
                  <textarea value={draft.company.notes} onChange={(event) => updateCompany({ notes: event.target.value })} rows={4} />
                </label>
              </div>
            ) : null}

            {step.id === 'companyFiles' ? (
              <div className="company-onboarding-files">
                <label className="upload-dropzone company-upload-dropzone">
                  <Upload size={20} />
                  <strong>{uploadingCompanyFiles ? copy.onboarding.company.uploading : copy.onboarding.company.uploadTitle}</strong>
                  <span>{copy.onboarding.company.uploadHint}</span>
                  <input type="file" multiple onChange={uploadCompanyFiles} aria-label={copy.onboarding.company.uploadAction} />
                </label>
                <div className="onboarding-note">{copy.onboarding.company.uploadedCount(companyMaterials.length)}</div>
              </div>
            ) : null}

            {step.id === 'companyReview' ? (
              <div className="company-review-list">
                <CompanyReviewItem label={copy.onboarding.company.name} value={draft.company.name} onEdit={() => setStepIndex(steps.findIndex((item) => item.id === 'companyBasics'))} copy={copy} />
                <CompanyReviewItem label={copy.onboarding.company.website} value={draft.company.website} onEdit={() => setStepIndex(steps.findIndex((item) => item.id === 'companyBasics'))} copy={copy} />
                <CompanyReviewItem label={copy.onboarding.company.mainProducts} value={draft.company.mainProducts} onEdit={() => setStepIndex(steps.findIndex((item) => item.id === 'companyProducts'))} copy={copy} />
                <CompanyReviewItem label={copy.onboarding.company.markets} value={draft.company.markets} onEdit={() => setStepIndex(steps.findIndex((item) => item.id === 'companyMarket'))} copy={copy} />
                <CompanyReviewItem label={copy.onboarding.company.certifications} value={draft.company.certifications} onEdit={() => setStepIndex(steps.findIndex((item) => item.id === 'companyTrust'))} copy={copy} />
                <CompanyReviewItem label={copy.onboarding.company.paymentTerms} value={draft.company.paymentTerms} onEdit={() => setStepIndex(steps.findIndex((item) => item.id === 'companyTrade'))} copy={copy} />
              </div>
            ) : null}

            {step.id === 'provider' ? (
              <div className="onboarding-form-grid">
                <div className="onboarding-option-grid provider-options">
                  {providerPresets.map((preset) => (
                    <OnboardingOptionButton
                      active={draft.providerChoice === preset.id}
                      detail={preset.defaultModel}
                      icon={KeyRound}
                      key={preset.id}
                      label={preset.label}
                      onClick={() => setProviderChoice(preset.id)}
                    />
                  ))}
                  <OnboardingOptionButton
                    active={draft.providerChoice === 'skip'}
                    detail={copy.onboarding.provider.skipDetail}
                    icon={ChevronRight}
                    label={copy.onboarding.provider.skip}
                    onClick={() => setProviderChoice('skip')}
                  />
                </div>

                {draft.providerChoice !== 'skip' ? (
                  <div className="provider-mini-form">
                    <label>
                      <span>{copy.common.providerName}</span>
                      <input value={draft.provider.displayName} onChange={(event) => updateProvider({ displayName: event.target.value })} />
                    </label>
                    <label>
                      <span>{copy.common.baseUrl}</span>
                      <input value={draft.provider.baseUrl} onChange={(event) => updateProvider({ baseUrl: event.target.value })} />
                    </label>
                    <label>
                      <span>{copy.common.defaultModel}</span>
                      <input value={draft.provider.defaultModel} onChange={(event) => updateProvider({ defaultModel: event.target.value })} />
                    </label>
                    <label>
                      <span>{copy.common.apiKey}</span>
                      <input value={draft.provider.apiKey} onChange={(event) => updateProvider({ apiKey: event.target.value })} placeholder={providerPresets.find((item) => item.id === draft.providerChoice)?.keyPlaceholder ?? copy.common.apiKey} type="password" />
                    </label>
                  </div>
                ) : (
                  <div className="onboarding-note">{copy.onboarding.provider.setupLater}</div>
                )}
              </div>
            ) : null}

            {step.id === 'theme' ? (
              <div className="onboarding-option-grid">
                {themeOptions.map((item) => (
                  <button className={`theme-choice ${draft.theme === item.id ? 'active' : ''}`} key={item.id} type="button" onClick={() => updateDraft({ theme: item.id })}>
                    <span className={`theme-swatch ${item.id}`} />
                    <strong>{copy.onboarding.themeOptions[item.id].label}</strong>
                    <small>{copy.onboarding.themeOptions[item.id].detail}</small>
                  </button>
                ))}
              </div>
            ) : null}

            {step.id === 'workspace' ? (
              <div className="onboarding-form-grid">
                <label>
                  <span>{copy.onboarding.workspace.path}</span>
                  <input value={draft.workspacePath} onChange={(event) => updateDraft({ workspacePath: event.target.value })} placeholder="~/Hermills" />
                </label>
                <button className="soft-button workspace-picker" type="button" onClick={chooseWorkspaceDirectory} disabled={pickingWorkspace}>
                  {pickingWorkspace ? <RefreshCw size={16} /> : <FolderOpen size={16} />}
                  {pickingWorkspace ? copy.onboarding.workspace.choosingFolder : copy.onboarding.workspace.chooseFolder}
                </button>
              </div>
            ) : null}

            {step.id === 'features' ? (
              <div className="feature-checklist">
                {featureOptions.map((item) => {
                  const Icon = item.icon
                  const checked = draft.features.includes(item.id)
                  const itemCopy = copy.onboarding.features[item.id]
                  return (
                    <label className={`feature-check ${checked ? 'active' : ''}`} key={item.id}>
                      <input type="checkbox" checked={checked} onChange={() => toggleFeature(item.id)} />
                      <Icon size={18} />
                      <span>
                        <strong>{itemCopy.label}</strong>
                        <small>{itemCopy.detail}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : null}
          </div>

          {serviceError || error ? <div className="inline-alert compact">{error || serviceError}</div> : null}

          <div className="onboarding-actions">
            <button className="soft-button" type="button" onClick={goBack} disabled={stepIndex === 0 || busy}>
              <ChevronLeft size={16} />
              {copy.common.back}
            </button>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? <RefreshCw size={16} /> : isLastStep ? <CheckCircle2 size={16} /> : <ChevronRight size={16} />}
              {isLastStep ? copy.onboarding.startChatting : copy.common.continue}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

function OnboardingOptionButton({
  active,
  detail,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  detail: string
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button className={`onboarding-option ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      <Icon size={18} />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      {active ? <CheckCircle2 size={16} /> : null}
    </button>
  )
}

function CompanyReviewItem({
  label,
  value,
  onEdit,
  copy,
}: {
  label: string
  value: string
  onEdit: () => void
  copy: UiCopy
}) {
  return (
    <article className="company-review-item">
      <div>
        <span>{label}</span>
        <p>{value.trim() || copy.onboarding.company.empty}</p>
      </div>
      <button className="text-button" type="button" onClick={onEdit}>
        <Pencil size={14} />
        {copy.onboarding.company.edit}
      </button>
    </article>
  )
}

function GatewayBanner({
  runtime,
  setRuntime,
  openAdvanced,
  copy,
}: {
  runtime: RuntimeStatus
  setRuntime: (runtime: RuntimeStatus) => void
  openAdvanced: (panel: AdvancedPanel) => void
  copy: UiCopy
}) {
  const [busyAction, setBusyAction] = useState<'start' | 'repair' | ''>('')
  const [error, setError] = useState('')
  const gatewayState = runtime.gateway?.state || 'stopped'

  async function runGatewayAction(action: 'start' | 'repair') {
    setBusyAction(action)
    setError('')
    try {
      if (action === 'repair') await api.restartGateway()
      else await api.startGateway()
      setRuntime(await api.runtimeStatus())
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'runtime'))
    } finally {
      setBusyAction('')
    }
  }

  return (
    <div className="setup-banner gateway-banner">
      <AlertCircle size={17} />
      <div>
        <strong>{gatewayState === 'failed' ? copy.gateway.restartTitle : copy.gateway.notReadyTitle}</strong>
        <span>{error || friendlyHermesMessage(runtime, copy)}</span>
      </div>
      <div className="gateway-actions">
        <button className="soft-button" disabled={Boolean(busyAction)} onClick={() => runGatewayAction('start')}>
          {busyAction === 'start' ? <RefreshCw size={16} /> : <Play size={16} />}
          {copy.gateway.startHermes}
        </button>
        <button className="soft-button" disabled={Boolean(busyAction)} onClick={() => runGatewayAction('repair')}>
          {busyAction === 'repair' ? <RefreshCw size={16} /> : <Wrench size={16} />}
          {copy.gateway.tryAgain}
        </button>
        <button className="text-button" onClick={() => openAdvanced('setup')}>{runtime.installed ? copy.gateway.details : copy.gateway.setup}</button>
      </div>
    </div>
  )
}

function KeySetupNudge({
  onOpen,
  onSaved,
  copy,
}: {
  onOpen: () => void
  onSaved: (provider: Provider) => Promise<void>
  copy: UiCopy
}) {
  const initialPreset = providerPresets[0]
  const [selectedPreset, setSelectedPreset] = useState<ProviderPresetId>(initialPreset.id)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<ProviderForm>({
    kind: initialPreset.kind,
    displayName: initialPreset.displayName,
    baseUrl: initialPreset.baseUrl,
    defaultModel: initialPreset.defaultModel,
    apiKey: '',
  })

  function selectPreset(presetId: ProviderPresetId) {
    const preset = providerPresets.find((item) => item.id === presetId) ?? initialPreset
    setSelectedPreset(preset.id)
    setForm((current) => ({
      kind: preset.kind,
      displayName: preset.displayName,
      baseUrl: preset.baseUrl,
      defaultModel: preset.defaultModel,
      apiKey: current.apiKey,
    }))
  }

  async function saveKey(event: FormEvent) {
    event.preventDefault()
    if (!form.apiKey.trim()) {
      setMessage(copy.keyNudge.pasteKeyFirst)
      return
    }
    setSaving(true)
    setMessage(copy.keyNudge.saving)
    try {
      const saved = await api.saveProvider(form)
      await onSaved(saved)
      setForm((current) => ({ ...current, apiKey: '' }))
      setMessage(copy.keyNudge.savedCanSend)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="key-nudge quick-provider-nudge" onSubmit={saveKey}>
      <div className="quick-provider-copy">
        <KeyRound size={17} />
        <span>{copy.keyNudge.pasteOneKey}</span>
      </div>
      <div className="quick-provider-fields">
        <select value={selectedPreset} onChange={(event) => selectPreset(event.target.value as ProviderPresetId)} aria-label={copy.common.provider}>
          {providerPresets.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}
        </select>
        <input
          type="password"
          value={form.apiKey}
          onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
          aria-label={copy.common.apiKey}
          placeholder={providerPresets.find((item) => item.id === selectedPreset)?.keyPlaceholder ?? copy.common.apiKey}
        />
        <button className="primary-button compact" disabled={saving} type="submit">
          {saving ? copy.common.saving : copy.keyNudge.save}
        </button>
      </div>
      <div className="quick-provider-actions">
        <button className="text-button" type="button" onClick={() => setDetailsOpen(!detailsOpen)}>
          {detailsOpen ? copy.common.hideDetails : copy.common.details}
        </button>
        <button className="text-button" type="button" onClick={onOpen}>{copy.common.openSettings}</button>
        {message ? <span>{message}</span> : null}
      </div>
      {detailsOpen ? (
        <div className="quick-provider-details">
          <input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} aria-label={copy.common.providerName} />
          <input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} aria-label={copy.common.baseUrl} />
          <input value={form.defaultModel} onChange={(event) => setForm({ ...form, defaultModel: event.target.value })} aria-label={copy.common.defaultModel} />
        </div>
      ) : null}
    </form>
  )
}

function SessionSidebar({
  runtime,
  sessions,
  totalSessions = sessions.length,
  activeSession,
  query,
  setQuery,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onClose,
  onOpenAssistants,
  onOpenFiles,
  onOpenOutreach,
  activeWorkspaceView,
  onOpenSettings,
  onOpenUpdate,
  className = '',
  copy,
}: {
  runtime: RuntimeStatus
  sessions: ChatSession[]
  totalSessions?: number
  activeSession?: ChatSession
  query: string
  setQuery: (query: string) => void
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onClose?: () => void
  onOpenAssistants: () => void
  onOpenFiles: () => void
  onOpenOutreach: () => void
  activeWorkspaceView: WorkspaceView
  onOpenSettings: () => void
  onOpenUpdate: () => void
  className?: string
  copy: UiCopy
}) {
  const [editingId, setEditingId] = useState('')
  const [editingTitle, setEditingTitle] = useState('')

  function beginRename(session: ChatSession) {
    setEditingId(session.id)
    setEditingTitle(session.title)
  }

  async function submitRename(event: FormEvent, id: string) {
    event.preventDefault()
    const title = editingTitle.trim()
    if (!title) return
    await onRename(id, title)
    setEditingId('')
  }

  return (
    <aside className={`session-sidebar ${className}`} onClick={(event) => event.stopPropagation()}>
      <div className="window-drag-zone" aria-hidden="true" />
      <div className="sidebar-brand-panel">
        <div className="brand-block sidebar-brand">
          <div className="brand-mark">H</div>
          <div>
            <strong>Hermes</strong>
            <span>{copy.common.brandSubtitle}</span>
          </div>
        </div>
        <div className="sidebar-utility-actions">
          <button className="icon-button" aria-label={copy.topbar.assistants} onClick={onOpenAssistants}>
            <Bot size={16} />
          </button>
          <button className="icon-button" aria-label={copy.topbar.files} onClick={onOpenFiles}>
            <PanelRightOpen size={16} />
          </button>
          <button className={`icon-button ${activeWorkspaceView === 'outreach' ? 'active' : ''}`} aria-label={copy.devLetter.navAria} onClick={onOpenOutreach}>
            <Mail size={16} />
          </button>
          <button className="icon-button" aria-label={copy.topbar.settingsAria} onClick={onOpenSettings}>
            <Settings size={16} />
          </button>
        </div>
      </div>
      <div className="sidebar-status-row">
        <span className={`status-dot ${runtime.state}`} />
        <span>{runtimeStatusLabel(runtime, copy)}</span>
        {runtime.updateAvailable ? (
          <button className="update-chip" onClick={onOpenUpdate}>
            <RefreshCw size={13} />
            {copy.common.update}
          </button>
        ) : null}
      </div>
      <div className="sidebar-header">
        <span>{copy.session.count(totalSessions)}</span>
        <div className="sidebar-actions">
          <button className="icon-button" aria-label={copy.session.newSessionAria} onClick={onNew}>
            <Plus size={16} />
          </button>
          {onClose ? (
            <button className="icon-button" aria-label={copy.session.closeAria} onClick={onClose}>
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>
      <label className="sidebar-search">
        <Search size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={copy.session.searchAria} placeholder={copy.session.searchPlaceholder} />
      </label>
      <div className="session-list">
        {sessions.length ? (
          sessions.map((session) => (
            <article
              className={`session-row ${activeSession?.id === session.id ? 'active' : ''}`}
              key={session.id}
            >
              {editingId === session.id ? (
                <form className="session-edit" onSubmit={(event) => submitRename(event, session.id)}>
                  <input value={editingTitle} autoFocus onChange={(event) => setEditingTitle(event.target.value)} aria-label={copy.session.titleAria} />
                  <button className="icon-button" type="submit" aria-label={copy.session.saveTitleAria}>
                    <CheckCircle2 size={15} />
                  </button>
                </form>
              ) : (
                <>
                  <button className="session-main" onClick={() => onSelect(session.id)}>
                    <strong>{session.title}</strong>
                    <span>{copy.session.messages(session.messageCount || session.messages.length || 0)}</span>
                  </button>
                  <div className="row-actions">
                    <button className="icon-button" aria-label={copy.session.renameAria(session.title)} onClick={() => beginRename(session)}>
                      <Pencil size={14} />
                    </button>
                    <button className="icon-button danger" aria-label={copy.session.deleteAria(session.title)} onClick={() => onDelete(session.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </article>
          ))
        ) : (
          <button className="session-row empty-session-row active" onClick={onNew}>
            <strong>{query ? copy.session.noMatch : copy.session.newConversation}</strong>
            <span>{query ? copy.session.tryAnother : copy.session.startWithHermes}</span>
          </button>
        )}
      </div>
    </aside>
  )
}

function SourcesDrawer({
  open,
  materials,
  selectedMaterialIds,
  setSelectedMaterialIds,
  uploading,
  uploadError,
  uploadFiles,
  deleteMaterial,
  previewMaterial,
  renameMaterial,
  copyMaterial,
  downloadMaterial,
  materialPreview,
  clearMaterialPreview,
  previewLoadingId,
  onFileAction,
  onClose,
  copy,
}: {
  open: boolean
  materials: Material[]
  selectedMaterialIds: string[]
  setSelectedMaterialIds: (ids: string[]) => void
  uploading: boolean
  uploadError: string
  uploadFiles: (event: ChangeEvent<HTMLInputElement>) => void
  deleteMaterial: (id: string) => void
  previewMaterial: (id: string) => void
  renameMaterial: (id: string, name: string) => void
  copyMaterial: (id: string) => void
  downloadMaterial: (id: string) => void
  materialPreview?: MaterialPreview
  clearMaterialPreview: () => void
  previewLoadingId: string
  onFileAction: (actionId: FileActionId) => void
  onClose: () => void
  copy: UiCopy
}) {
  const [editingId, setEditingId] = useState('')
  const [editingName, setEditingName] = useState('')

  function beginRename(material: Material) {
    setEditingId(material.id)
    setEditingName(material.name)
  }

  function submitRename(event: FormEvent, id: string) {
    event.preventDefault()
    const name = editingName.trim()
    if (!name) return
    renameMaterial(id, name)
    setEditingId('')
  }

  return (
    <aside className={`sources-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="sources-header">
        <div>
          <span>{copy.files.title}</span>
          <strong>{selectedMaterialIds.length ? copy.files.attached(selectedMaterialIds.length) : copy.files.attachLocalFiles}</strong>
        </div>
        <button className="icon-button" aria-label={copy.files.closeAria} onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <label className="upload-dropzone">
        <Paperclip size={18} />
        <strong>{uploading ? copy.files.uploading : copy.files.addFiles}</strong>
        <span>{copy.files.supportedTypes}</span>
        <input type="file" multiple onChange={uploadFiles} />
      </label>

      {selectedMaterialIds.length ? (
        <div className="file-action-bar">
          <span className="state-hint">{copy.files.attached(selectedMaterialIds.length)}</span>
          {fileActionItems.map((action) => {
            const Icon = action.icon
            return (
              <button className="file-action-button" type="button" key={action.id} onClick={() => onFileAction(action.id)}>
                <Icon size={15} />
                {copy.files.actions[action.id].label}
              </button>
            )
          })}
        </div>
      ) : null}

      {uploadError ? <div className="inline-alert compact">{uploadError}</div> : null}

      {materialPreview ? (
        <article className="material-preview">
          <div className="material-preview-header">
            <div>
              <span>{copy.files.preview}</span>
              <strong>{materialPreview.name}</strong>
            </div>
            <button className="icon-button" aria-label={copy.files.closePreviewAria} onClick={clearMaterialPreview}>
              <X size={14} />
            </button>
          </div>
          <pre>{materialPreview.contentText || copy.files.noPreview}</pre>
        </article>
      ) : null}

      <div className="material-list">
        {materials.length ? materials.map((material) => {
          const selected = selectedMaterialIds.includes(material.id)
          return (
            <article
              className={`material-row ${selected ? 'selected' : ''}`}
              key={material.id}
            >
              {editingId === material.id ? (
                <form className="material-edit" onSubmit={(event) => submitRename(event, material.id)}>
                  <input value={editingName} autoFocus onChange={(event) => setEditingName(event.target.value)} aria-label={copy.files.fileNameAria} />
                  <button className="icon-button" type="submit" aria-label={copy.files.saveFileNameAria}>
                    <CheckCircle2 size={15} />
                  </button>
                </form>
              ) : (
                <>
                  <button className="material-select" onClick={() => setSelectedMaterialIds(toggleValue(selectedMaterialIds, material.id))}>
                    <FileText size={16} />
                    <span>
                      <strong>{material.name}</strong>
                      <small>{formatBytes(material.size)} · {material.folder ? `${material.folder} · ` : ''}{materialStatusLabel(material, copy)}</small>
                    </span>
                  </button>
                  <div className="material-actions">
                    <button className="icon-button" aria-label={copy.files.previewAria(material.name)} onClick={() => previewMaterial(material.id)}>
                      {previewLoadingId === material.id ? <RefreshCw size={14} /> : <Eye size={14} />}
                    </button>
                    <button className="icon-button" aria-label={copy.files.downloadAria(material.name)} onClick={() => downloadMaterial(material.id)}>
                      <Download size={14} />
                    </button>
                    <button className="icon-button" aria-label={copy.files.copyAria(material.name)} onClick={() => copyMaterial(material.id)}>
                      <Copy size={14} />
                    </button>
                    <button className="icon-button" aria-label={copy.files.renameAria(material.name)} onClick={() => beginRename(material)}>
                      <Pencil size={14} />
                    </button>
                    <button className="icon-button danger" aria-label={copy.files.deleteAria(material.name)} onClick={() => deleteMaterial(material.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </article>
          )
        }) : <div className="empty-state">{copy.files.empty}</div>}
      </div>
    </aside>
  )
}

function AssistantDrawer({
  open,
  agents,
  providers,
  selectedAgentId,
  refresh,
  onUse,
  onStartChat,
  onClose,
  copy,
}: {
  open: boolean
  agents: Agent[]
  providers: Provider[]
  selectedAgentId: string
  refresh: (agents: Agent[]) => void
  onUse: (agentId: string) => void | Promise<void>
  onStartChat: (agentId: string) => void | Promise<void>
  onClose: () => void
  copy: UiCopy
}) {
  return (
    <aside className={`assistant-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="sources-header">
        <div>
          <span>{copy.assistant.drawerTitle}</span>
          <strong>{copy.assistant.drawerSubtitle}</strong>
        </div>
        <button className="icon-button" aria-label={copy.assistant.closeAria} onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <AgentBuilder
        agents={agents}
        providers={providers}
        refresh={refresh}
        selectedAgentId={selectedAgentId}
        onUse={onUse}
        onStartChat={onStartChat}
        compact
        copy={copy}
      />
    </aside>
  )
}

function AdvancedOverlay({
  activePanel,
  setActivePanel,
  onClose,
  runtime,
  setRuntime,
  agents,
  setAgents,
  providers,
  profiles,
  setProfiles,
  usage,
  analytics,
  readyProviders,
  readyAgents,
  setProviders,
  onboardingState,
  setOnboardingState,
  sessions,
  materials,
  companyProfile,
  setCompanyProfile,
  companyMaterials,
  setCompanyMaterials,
  uiMode,
  setUiMode,
  copy,
}: {
  activePanel: AdvancedPanel
  setActivePanel: (panel: AdvancedPanel) => void
  onClose: () => void
  runtime: RuntimeStatus
  setRuntime: (runtime: RuntimeStatus) => void
  agents: Agent[]
  setAgents: (agents: Agent[]) => void
  providers: Provider[]
  profiles: ProfileState
  setProfiles: (profiles: ProfileState) => void
  usage: UsageSummary
  analytics: AnalyticsSummary
  readyProviders: number
  readyAgents: number
  setProviders: (providers: Provider[]) => void
  onboardingState: OnboardingState
  setOnboardingState: (state: OnboardingState) => void
  sessions: ChatSession[]
  materials: Material[]
  companyProfile: CompanyProfile
  setCompanyProfile: (profile: CompanyProfile) => void
  companyMaterials: Material[]
  setCompanyMaterials: (materials: Material[]) => void
  uiMode: UiModeId
  setUiMode: (mode: UiModeId) => void
  copy: UiCopy
}) {
  const visibleAdvancedItems = uiMode === 'simple'
    ? advancedItems.filter((item) => simpleAdvancedPanels.includes(item.id))
    : advancedItems
  const simpleModeLabel = copy.mode.options.simple.label
  const expertModeLabel = copy.mode.options.expert.label

  useEffect(() => {
    if (uiMode === 'simple' && !simpleAdvancedPanels.includes(activePanel)) setActivePanel('setup')
  }, [activePanel, setActivePanel, uiMode])

  return (
    <div className="advanced-backdrop hermills-dark-overlay" role="dialog" aria-modal="true">
      <section className={`advanced-sheet ${uiMode === 'expert' ? 'expert-mode' : ''}`} data-expert-mode={uiMode === 'expert'}>
        <header className="advanced-header">
          <div>
            <span>{copy.advanced.eyebrow}</span>
            <strong>{copy.advanced.title}</strong>
          </div>
          <div className="mode-toggle" role="group" aria-label={copy.mode.ariaLabel}>
            {(['simple', 'expert'] as UiModeId[]).map((mode) => (
              <button
                key={mode}
                className={uiMode === mode ? 'active' : ''}
                type="button"
                aria-pressed={uiMode === mode}
                onClick={() => setUiMode(mode === 'simple' ? 'simple' : 'expert')}
              >
                {mode === 'simple' ? simpleModeLabel : expertModeLabel}
              </button>
            ))}
          </div>
          <button className="icon-button" aria-label={copy.advanced.closeAria} onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        <div className="advanced-body">
          <nav className="advanced-nav" aria-label={copy.advanced.navAria} role="tablist">
            {visibleAdvancedItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={activePanel === item.id ? 'active' : ''}
                  onClick={() => setActivePanel(item.id)}
                  role="tab"
                  aria-selected={activePanel === item.id}
                >
                  <Icon size={16} />
                  {copy.advanced.tabs[item.id]}
                </button>
              )
            })}
          </nav>

          <div className="advanced-content">
            {activePanel === 'setup' && <RuntimeInstaller runtime={runtime} setRuntime={setRuntime} uiMode={uiMode} copy={copy} />}
            {activePanel === 'personalize' && <PersonalizationPanel onboardingState={onboardingState} setOnboardingState={setOnboardingState} copy={copy} />}
            {activePanel === 'company' && <CompanyKnowledgePanel profile={companyProfile} setProfile={setCompanyProfile} materials={companyMaterials} setMaterials={setCompanyMaterials} copy={copy} />}
            {activePanel === 'agents' && <AgentBuilder agents={agents} providers={providers} refresh={setAgents} compact={uiMode === 'simple'} copy={copy} />}
            {activePanel === 'profiles' && <ProfilePanel profileState={profiles} refresh={setProfiles} copy={copy} />}
            {activePanel === 'keys' && (
              <SettingsPanel
                providers={providers}
                readyProviders={readyProviders}
                readyAgents={readyAgents}
                refresh={setProviders}
                uiMode={uiMode}
                copy={copy}
              />
            )}
            {activePanel === 'diagnostics' && (
              <DiagnosticsPanel runtime={runtime} sessions={sessions} materials={materials} companyMaterials={companyMaterials} providers={providers} agents={agents} usage={usage} analytics={analytics} copy={copy} />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function RuntimeInstaller({
  runtime,
  setRuntime,
  variant = 'advanced',
  uiMode = 'expert',
  serviceError = '',
  onComplete,
  copy,
}: {
  runtime: RuntimeStatus
  setRuntime: (runtime: RuntimeStatus) => void
  variant?: 'advanced' | 'first-run'
  uiMode?: UiModeId
  serviceError?: string
  onComplete?: () => void | Promise<void>
  copy: UiCopy
}) {
  const [installing, setInstalling] = useState(false)
  const [events, setEvents] = useState<InstallEvent[]>([])
  const [updateCheck, setUpdateCheck] = useState<RuntimeUpdateCheck>()
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [showRepair, setShowRepair] = useState(false)
  const [error, setError] = useState('')
  const firstRun = variant === 'first-run'

  useEffect(() => {
    void refreshUpdateCheck(false)
  }, [])

  async function refreshUpdateCheck(force: boolean) {
    setCheckingUpdate(true)
    try {
      const nextCheck = await api.runtimeUpdateCheck(force)
      setUpdateCheck(nextCheck)
      if (nextCheck.error) setError(nextCheck.error)
      else setError('')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'runtime'))
    } finally {
      setCheckingUpdate(false)
    }
  }

  async function runInstallJob(mode: 'deploy' | 'update' | 'repair') {
    setInstalling(true)
    setEvents([])
    setError('')
    setRuntime({ ...runtime, state: 'checking', progress: 8, message: mode === 'update' ? copy.runtime.installMessages.checkingUpdate : copy.runtime.installMessages.checkingSetup })
    try {
      const result = mode === 'repair'
        ? await api.reinitializeRuntime('repair')
        : mode === 'update'
          ? await api.startRuntimeUpdate(updateCheck?.installerSha256)
          : await api.startRuntimeInstall(updateCheck?.installerSha256)
      if ('jobId' in result) await pollInstall(result.jobId, setEvents, setRuntime, runtime)
      const nextRuntime = await api.runtimeStatus()
      setRuntime(nextRuntime)
      await refreshUpdateCheck(true)
      const nextState = await api.appState().catch(() => undefined)
      if (nextState && !nextState.shouldShowFirstDeploy) await onComplete?.()
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'runtime'))
      setRuntime({ ...runtime, state: 'failed', progress: 100, message: mode === 'update' ? copy.runtime.installMessages.updateFailed : copy.runtime.installMessages.setupFailed })
    } finally {
      setInstalling(false)
    }
  }

  async function startGateway() {
    setError('')
    try {
      await api.startGateway()
      setRuntime(await api.runtimeStatus())
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'runtime'))
    }
  }

  async function copyDiagnostics() {
    const body = [
      `${copy.diagnostics.runtime}: ${runtimeStatusLabel(runtime, copy)}`,
      `${copy.runtime.meta.installed}: ${runtime.version || copy.common.unknown}`,
      `${copy.runtime.meta.latest}: ${updateCheck?.latestVersion || copy.common.unknown}`,
      `${copy.common.update}: ${String(updateCheck?.updateAvailable ?? runtime.updateAvailable ?? false)}`,
      `Path: ${runtime.path || 'unknown'}`,
      `Hermes home: ${runtime.hermesHome || 'unknown'}`,
      `Gateway: ${runtime.gateway?.state || copy.common.unknown} ${runtime.gateway?.message || ''}`,
      '',
      ...events.map((event) => `[${event.level}] ${labelForStep(event.step || 'ready', copy)} ${event.progress ?? ''} ${event.message}`)
    ].join('\n')
    await navigator.clipboard.writeText(body)
  }

  const progress = events.at(-1)?.progress ?? runtime.progress ?? 0
  const lastMessage = localizeRuntimeMessage(events.at(-1)?.message ?? runtime.message, copy)
  const visibleError = error || serviceError
  const action = getRuntimeActionState(runtime, updateCheck, firstRun, installing, copy)
  const expertMode = firstRun || uiMode === 'expert'

  return (
    <section className={`${firstRun ? 'first-run-card' : 'setup-panel'} ${expertMode ? 'expert-mode' : ''}`} data-expert-mode={expertMode}>
      <div className="setup-hero">
        <div className="runtime-symbol">
          <Cpu size={24} />
        </div>
        <div>
          <span>{firstRun ? copy.firstRun.oneTimeSetup : copy.runtime.setupTitle}</span>
          <h2>{firstRun ? firstRunTitle(runtime, copy) : runtimeUpdateTitle(runtime, updateCheck, copy)}</h2>
          <p>{lastMessage || runtimeUpdateDescription(runtime, updateCheck, checkingUpdate, copy)}</p>
        </div>
      </div>

      <div className="progress-rail">
        <span style={{ width: `${progress}%` }} />
      </div>

      {firstRun ? (
        <div className="first-run-status">
          <strong>{labelForStep(events.at(-1)?.step || runtime.state, copy)}</strong>
          <span>{updateCheck?.latestVersion ? `${copy.runtime.meta.latest} ${updateCheck.latestVersion}` : copy.firstRun.packageCheckFallback}</span>
        </div>
      ) : expertMode ? (
        <>
          <div className={`update-card ${updateCheck?.checkState || (runtime.updateAvailable ? 'available' : 'unknown')}`}>
            {runtime.updateAvailable || updateCheck?.updateAvailable ? <RefreshCw size={17} /> : <CheckCircle2 size={17} />}
            <div>
              <strong>{runtimeUpdateSummary(updateCheck, checkingUpdate, copy)}</strong>
              <span>{runtimeUpdateDetail(runtime, updateCheck, copy)}</span>
            </div>
          </div>
          <div className="deploy-meta">
            <span>{copy.runtime.meta.installed}: {runtime.version || updateCheck?.installedVersion || copy.common.unknown}</span>
            <span>{copy.runtime.meta.latest}: {updateCheck?.latestVersion || runtime.latestVersion || copy.common.notChecked}</span>
            <span>{copy.runtime.meta.lastCheck}: {formatCheckTime(updateCheck?.checkedAt, copy)}</span>
            <span>{copy.runtime.meta.localChat}: {runtime.gateway?.state === 'running' ? copy.runtime.meta.ready : copy.runtime.meta.notStarted}</span>
          </div>
        </>
      ) : (
        <div className="status-hint light-status">
          <CheckCircle2 size={16} />
          <span>{runtimeUpdateSummary(updateCheck, checkingUpdate, copy)}</span>
        </div>
      )}

      {visibleError ? <div className="inline-alert compact">{humanizeErrorMessage(visibleError, copy, 'runtime')}</div> : null}

      <div className="setup-actions">
        {action.kind !== 'none' ? (
          <button className="primary-button" disabled={installing} onClick={() => runInstallJob(action.kind === 'update' ? 'update' : 'deploy')}>
            {installing ? <RefreshCw size={16} /> : action.kind === 'update' ? <RefreshCw size={16} /> : <Play size={16} />}
            {action.label}
          </button>
        ) : (
          <span className="status-pill current">
            <CheckCircle2 size={14} />
            {action.label}
          </span>
        )}
        {expertMode && !firstRun ? (
          <button className="soft-button" disabled={checkingUpdate || installing} onClick={() => refreshUpdateCheck(true)}>
            <RefreshCw size={16} />
            {checkingUpdate ? copy.runtime.buttons.checking : copy.runtime.buttons.checkUpdates}
          </button>
        ) : null}
        {runtime.installed && !firstRun ? (
          <button className="soft-button" onClick={startGateway}>
            <Play size={16} />
            {copy.runtime.buttons.startHermes}
          </button>
        ) : null}
        {expertMode && !firstRun ? <button className="text-button" onClick={copyDiagnostics}>{copy.runtime.buttons.copyReport}</button> : null}
        {expertMode && !firstRun ? <button className="text-button" onClick={() => setShowRepair(!showRepair)}>{copy.runtime.buttons.repairOptions}</button> : null}
      </div>

      {expertMode && showRepair && !firstRun ? (
        <div className="repair-panel">
          <div>
            <strong>{copy.runtime.repair.title}</strong>
            <span>{copy.runtime.repair.description}</span>
          </div>
          <button className="soft-button" disabled={installing} onClick={() => runInstallJob('repair')}>
            <Wrench size={16} />
            {copy.runtime.buttons.repairInstall}
          </button>
        </div>
      ) : null}

      {expertMode && !firstRun ? (
        <div className="install-steps">
          {['checking', 'downloading', 'installing', 'configuring', 'starting', 'verifying'].map((step) => (
            <div className="checklist-row" key={step}>
              <span className={stepComplete(step, runtime.state, events) ? 'complete' : ''} />
              <div>
                <strong>{labelForStep(step, copy)}</strong>
                <small>{localizeRuntimeMessage(latestEventForStep(events, step)?.message, copy) || copy.runtime.waiting}</small>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function PersonalizationPanel({
  onboardingState,
  setOnboardingState,
  copy,
}: {
  onboardingState: OnboardingState
  setOnboardingState: (state: OnboardingState) => void
  copy: UiCopy
}) {
  const [draft, setDraft] = useState({
    language: onboardingState.language ?? 'zh-CN',
    userDisplayName: onboardingState.userDisplayName ?? '',
    agentName: onboardingState.agentName ?? 'Hermes',
    memoryEnabled: onboardingState.memoryEnabled ?? false,
    theme: onboardingState.theme === 'plain' ? 'plain' : 'night',
    workspacePath: onboardingState.workspacePath ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [pickingWorkspace, setPickingWorkspace] = useState(false)
  const [error, setError] = useState('')
  const panelCopy = draft.language === onboardingState.language ? copy : getUiCopy(draft.language)

  useEffect(() => {
    setDraft({
      language: onboardingState.language ?? 'zh-CN',
      userDisplayName: onboardingState.userDisplayName ?? '',
      agentName: onboardingState.agentName ?? 'Hermes',
      memoryEnabled: onboardingState.memoryEnabled ?? false,
      theme: onboardingState.theme === 'plain' ? 'plain' : 'night',
      workspacePath: onboardingState.workspacePath ?? '',
    })
  }, [onboardingState])

  async function savePersonalization(event: FormEvent) {
    event.preventDefault()
    if (!draft.agentName.trim()) {
      setError(panelCopy.personalization.missingAgentName)
      return
    }
    setBusy(true)
    setError('')
    try {
      setOnboardingState(await completeOnboardingState({
        language: draft.language as OnboardingLanguage,
        userDisplayName: draft.userDisplayName.trim(),
        agentName: draft.agentName.trim(),
        memoryEnabled: draft.memoryEnabled,
        theme: draft.theme as OnboardingTheme,
        workspacePath: draft.workspacePath.trim() || undefined,
      }))
    } catch (err) {
      setError(humanizeErrorMessage(err, copy))
    } finally {
      setBusy(false)
    }
  }

  async function chooseWorkspaceDirectory() {
    setPickingWorkspace(true)
    setError('')
    try {
      const selection = await window.hermillsDesktop?.selectWorkspaceDirectory?.()
      if (!selection) {
        setError(panelCopy.personalization.noDirectoryPicker)
        return
      }
      if (!selection.canceled && selection.path) setDraft((current) => ({ ...current, workspacePath: selection.path ?? current.workspacePath }))
    } catch (err) {
      setError(humanizeErrorMessage(err, copy))
    } finally {
      setPickingWorkspace(false)
    }
  }

  async function reopenOnboarding() {
    setBusy(true)
    setError('')
    try {
      setOnboardingState(await updateOnboardingState({ onboardingCompletedAt: null }))
    } catch (err) {
      setError(humanizeErrorMessage(err, copy))
    } finally {
      setBusy(false)
    }
  }

  function setPersonalizationLanguage(language: OnboardingLanguage) {
    setDraft((current) => ({ ...current, language }))
    setOnboardingState({ ...onboardingState, language })
  }

  return (
    <section className="settings-layout personalization-layout">
      <form className="quiet-panel settings-form" onSubmit={savePersonalization}>
        <div className="panel-header">
          <div>
            <span>{panelCopy.personalization.eyebrow}</span>
            <h3>{panelCopy.personalization.title}</h3>
          </div>
          <button className="primary-button icon-label" type="submit" disabled={busy}>
            {busy ? <RefreshCw size={16} /> : <CheckCircle2 size={16} />}
            {busy ? panelCopy.common.saving : panelCopy.common.save}
          </button>
        </div>
        <label>
          {panelCopy.personalization.language}
          <select value={draft.language} onChange={(event) => setPersonalizationLanguage(event.target.value as OnboardingLanguage)}>
            {languageOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>
          {panelCopy.personalization.theme}
          <select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as OnboardingTheme })}>
            {themeOptions.map((item) => <option value={item.id} key={item.id}>{panelCopy.onboarding.themeOptions[item.id].label}</option>)}
          </select>
        </label>
        <label>
          {panelCopy.personalization.userName}
          <input value={draft.userDisplayName} onChange={(event) => setDraft({ ...draft, userDisplayName: event.target.value })} placeholder="Alex" />
        </label>
        <label>
          {panelCopy.personalization.agentName}
          <input value={draft.agentName} onChange={(event) => setDraft({ ...draft, agentName: event.target.value })} placeholder="Hermes" />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={draft.memoryEnabled} onChange={(event) => setDraft({ ...draft, memoryEnabled: event.target.checked })} />
          <span>{panelCopy.personalization.memoryOn}</span>
        </label>
        <label>
          {panelCopy.personalization.workspacePath}
          <input value={draft.workspacePath} onChange={(event) => setDraft({ ...draft, workspacePath: event.target.value })} placeholder="~/Desktop/Hermills-Workspace" />
        </label>
        <div className="personalization-actions">
          <button className="soft-button" type="button" disabled={pickingWorkspace} onClick={chooseWorkspaceDirectory}>
            {pickingWorkspace ? <RefreshCw size={16} /> : <FolderOpen size={16} />}
            {panelCopy.personalization.chooseFolder}
          </button>
          <button className="soft-button" type="button" disabled={busy} onClick={reopenOnboarding}>
            {busy ? <RefreshCw size={16} /> : <Languages size={16} />}
            {panelCopy.personalization.runSetupAgain}
          </button>
        </div>
        {error ? <div className="inline-alert compact">{error}</div> : null}
      </form>
    </section>
  )
}

function AgentBuilder({
  agents,
  providers,
  refresh,
  selectedAgentId = '',
  onUse,
  onStartChat,
  compact = false,
  copy,
}: {
  agents: Agent[]
  providers: Provider[]
  refresh: (agents: Agent[]) => void
  selectedAgentId?: string
  onUse?: (agentId: string) => void | Promise<void>
  onStartChat?: (agentId: string) => void | Promise<void>
  compact?: boolean
  copy: UiCopy
}) {
  const defaultBuilder = useMemo(() => createDefaultBuilder(copy), [copy])
  const agentTemplates = useMemo(() => createAgentTemplates(copy), [copy])
  const [form, setForm] = useState<AgentForm>(() => createDefaultBuilder(copy))
  const [editingId, setEditingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(!compact)
  const modelOptions = useMemo(() => {
    const providerModels = providers.flatMap((provider) => provider.models?.length ? provider.models : provider.defaultModel ? [provider.defaultModel] : [])
    return [...new Set(['hermes-agent', ...providerModels, 'gpt-5.1-pro', 'gpt-5.1-mini', 'claude-sonnet-4.5'])]
  }, [providers])

  useEffect(() => {
    if (!editingId) setForm({ ...defaultBuilder })
  }, [defaultBuilder, editingId])

  useEffect(() => {
    if (!compact) setShowForm(true)
  }, [compact])

  function agentInputFromForm(nextForm = form): AgentInput {
    return {
      displayName: nextForm.name.trim(),
      description: nextForm.description.trim(),
      instructions: nextForm.instructions.trim(),
      model: nextForm.model || undefined,
      providerId: nextForm.providerId || undefined,
      starters: nextForm.starters.split('\n').map((starter) => starter.trim()).filter(Boolean).slice(0, 8),
      capabilities: {
        memory: nextForm.memory,
        files: nextForm.files,
        tools: nextForm.tools,
        approvals: nextForm.approvals ? 'on-demand' : 'never'
      }
    }
  }

  function loadAgent(agent: Agent) {
    setEditingId(agent.id)
    setError('')
    setShowForm(true)
    setForm({
      name: agent.name,
      model: agent.model || 'hermes-agent',
      providerId: agent.providerId || '',
      description: agent.description || '',
      instructions: agent.instructions || '',
      starters: (agent.starters ?? []).join('\n'),
      memory: agent.capabilities?.memory ?? false,
      files: agent.capabilities?.files ?? true,
      tools: agent.capabilities?.tools ?? false,
      approvals: (agent.capabilities?.approvals ?? 'on-demand') !== 'never'
    })
  }

  function startNewAgent() {
    setEditingId('')
    setError('')
    setShowForm(true)
    setForm({ ...defaultBuilder })
  }

  async function saveAgent() {
    const payload = agentInputFromForm()
    if (!payload.displayName || !payload.instructions) {
      setError(copy.assistant.validation)
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editingId) await api.updateAgent(editingId, payload)
      else await api.saveAgent(payload)
      refresh(await api.agents())
      if (!editingId) setForm({ ...defaultBuilder })
      setEditingId('')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'assistant'))
    } finally {
      setSaving(false)
    }
  }

  async function copyAgent(agent: Agent) {
    setSaving(true)
    setError('')
    try {
      await api.saveAgent({
        displayName: copy.assistant.copyName(agent.name),
        description: agent.description || '',
        instructions: agent.instructions || defaultBuilder.instructions,
        model: agent.model,
        providerId: agent.providerId,
        starters: agent.starters ?? [],
        capabilities: agent.capabilities
      })
      refresh(await api.agents())
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'assistant'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteAgent(agent: Agent) {
    if (!window.confirm(copy.assistant.deleteConfirm(agent.name))) return
    setSaving(true)
    setError('')
    try {
      await api.deleteAgent(agent.id)
      if (editingId === agent.id) startNewAgent()
      refresh(await api.agents())
      if (selectedAgentId === agent.id) await onUse?.('')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'assistant'))
    } finally {
      setSaving(false)
    }
  }

  function applyTemplate(template: AgentForm) {
    setEditingId('')
    setError('')
    setShowForm(true)
    setForm({ ...template })
  }

  async function quickCreateRole(roleId: AssistantRoleCardId) {
    const role = copy.assistant.roleCards[roleId]
    setSaving(true)
    setError('')
    try {
      const saved = await api.saveAgent({
        displayName: role.defaultName,
        description: role.description,
        instructions: role.defaultInstructions,
        model: 'hermes-agent',
        starters: [role.starter],
        capabilities: {
          memory: false,
          files: roleId === 'files',
          tools: roleId === 'code',
          approvals: 'on-demand',
        },
      })
      refresh(await api.agents())
      setForm({
        ...defaultBuilder,
        name: saved.name,
        description: saved.description || role.description,
        instructions: saved.instructions || role.defaultInstructions,
        starters: (saved.starters?.length ? saved.starters : [role.starter]).join('\n'),
        files: saved.capabilities?.files ?? roleId === 'files',
        tools: saved.capabilities?.tools ?? roleId === 'code',
      })
      setEditingId(saved.id)
      setShowForm(false)
      if (onStartChat) await onStartChat(saved.id)
      else await onUse?.(saved.id)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'assistant'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={`builder-layout ${compact ? 'compact-builder' : ''}`}>
      {compact ? (
        <div className="quiet-panel assistant-quick-create">
          <div className="panel-header">
            <div>
              <span>{copy.assistant.quickCreate.title}</span>
              <h3>{copy.assistant.quickCreate.action}</h3>
            </div>
            <button className="soft-button compact" type="button" onClick={startNewAgent}>{copy.assistant.new}</button>
          </div>
          <p className="state-hint">{copy.assistant.quickCreate.description}</p>
          <div className="assistant-role-grid">
            {assistantRoleItems.map((item) => {
              const Icon = item.icon
              const role = copy.assistant.roleCards[item.id]
              return (
                <button className="assistant-role-card" type="button" key={item.id} disabled={saving} onClick={() => quickCreateRole(item.id)}>
                  <span className="assistant-role-icon"><Icon size={18} /></span>
                  <span className="assistant-role-card-body">
                    <strong>{role.title}</strong>
                    <span>{role.description}</span>
                  </span>
                  <span className="assistant-role-card-actions">
                    <span className="status-pill current">{saving ? copy.assistant.quickCreate.creating : role.action}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {error ? <div className="inline-alert compact">{error}</div> : null}
        </div>
      ) : null}

      {showForm ? <form className="quiet-panel builder-form">
        <div className="panel-header">
          <div>
            <span>{copy.assistant.sectionEyebrow}</span>
            <h3>{editingId ? copy.assistant.editTitle : copy.assistant.createTitle}</h3>
          </div>
          <div className="panel-actions">
            <button className="soft-button compact" type="button" onClick={startNewAgent}>{copy.assistant.new}</button>
            <button className="primary-button icon-label" type="button" disabled={saving} onClick={saveAgent}>
              <CheckCircle2 size={16} />
              {saving ? copy.assistant.saving : editingId ? copy.assistant.saveChanges : copy.assistant.create}
            </button>
          </div>
        </div>
        <div className="template-grid">
          {agentTemplates.map((template) => (
            <button className="template-card" type="button" key={template.id} onClick={() => applyTemplate(template.form)}>
              <strong>{template.label}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </div>
        <label>
          {copy.assistant.name}
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label>
          {copy.assistant.helpWith}
          <textarea
            className="short-textarea"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>
        <label>
          {copy.assistant.behavior}
          <textarea value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} />
        </label>
        <label>
          {copy.assistant.starters}
          <textarea
            className="short-textarea"
            value={form.starters}
            onChange={(event) => setForm({ ...form, starters: event.target.value })}
          />
        </label>
        <div className="tool-row">
          <label className="check-row">
            <input type="checkbox" checked={form.files} onChange={(event) => setForm({ ...form, files: event.target.checked })} />
            <span>{copy.assistant.useFiles}</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={form.memory} onChange={(event) => setForm({ ...form, memory: event.target.checked })} />
            <span>{copy.assistant.rememberContext}</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={form.tools} onChange={(event) => setForm({ ...form, tools: event.target.checked })} />
            <span>{copy.assistant.useTools}</span>
          </label>
        </div>
        <details className="advanced-agent-options">
          <summary>{copy.assistant.modelOptions}</summary>
          <label>
            {copy.common.model}
            <select value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })}>
              {modelOptions.map((model) => <option key={model}>{model}</option>)}
            </select>
          </label>
          <label>
            {copy.assistant.provider}
            <select value={form.providerId} onChange={(event) => setForm({ ...form, providerId: event.target.value })}>
              <option value="">{copy.assistant.localHermes}</option>
              {providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}
            </select>
          </label>
        </details>
        {error ? <div className="inline-alert compact">{error}</div> : null}
      </form> : null}

      <aside className="quiet-panel preview-pane">
        <h3>{copy.assistant.savedAgents}</h3>
        <div className="agent-preview">
          <div className="agent-avatar">{form.name.slice(0, 2)}</div>
          <strong>{form.name}</strong>
          <span>{form.description}</span>
          <code>{providers.find((provider) => provider.id === form.providerId)?.name || copy.assistant.localHermes} · {form.model}</code>
        </div>
        <div className="saved-list">
          {agents.length ? (
            agents.map((agent) => (
              <div className={`compact-row agent-row ${selectedAgentId === agent.id ? 'active' : ''}`} key={agent.id}>
                <button className="agent-row-main" type="button" onClick={() => loadAgent(agent)}>
                  <strong>{agent.name}</strong>
                  <small>{agent.description || agent.updatedAt || copy.assistant.ready}</small>
                </button>
                <div className="agent-row-actions">
                  {onUse ? <button className="soft-button compact" type="button" onClick={() => onUse(agent.id)}>{copy.assistant.use}</button> : null}
                  {onStartChat ? <button className="soft-button compact" type="button" onClick={() => onStartChat(agent.id)}>{copy.assistant.chat}</button> : null}
                  <button className="icon-button" type="button" aria-label={copy.assistant.copyAria(agent.name)} onClick={() => copyAgent(agent)}>
                    <Copy size={14} />
                  </button>
                  <button className="icon-button danger" type="button" aria-label={copy.assistant.deleteAria(agent.name)} onClick={() => deleteAgent(agent)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">{copy.assistant.noAssistants}</div>
          )}
        </div>
      </aside>
    </section>
  )
}

function ProfilePanel({ profileState, refresh, copy }: { profileState: ProfileState; refresh: (profiles: ProfileState) => void; copy: UiCopy }) {
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState('')

  async function createProfile(event: FormEvent) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) return
    setError('')
    try {
      refresh(await api.createProfile(nextName))
      setName('')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy))
    }
  }

  async function activateProfile(id: string) {
    setError('')
    try {
      refresh(await api.updateProfile(id, { active: true }))
    } catch (err) {
      setError(humanizeErrorMessage(err, copy))
    }
  }

  async function renameProfile(event: FormEvent, id: string) {
    event.preventDefault()
    const nextName = editingName.trim()
    if (!nextName) return
    setError('')
    try {
      refresh(await api.updateProfile(id, { name: nextName }))
      setEditingId('')
    } catch (err) {
      setError(humanizeErrorMessage(err, copy))
    }
  }

  async function removeProfile(id: string) {
    setError('')
    try {
      await api.deleteProfile(id)
      refresh(await api.profiles())
    } catch (err) {
      setError(humanizeErrorMessage(err, copy))
    }
  }

  return (
    <section className="profile-layout">
      <div className="quiet-panel">
        <div className="panel-header">
          <div>
            <span>{copy.profile.eyebrow}</span>
            <h3>{copy.profile.title}</h3>
          </div>
        </div>
        <form className="profile-create" onSubmit={createProfile}>
          <input value={name} onChange={(event) => setName(event.target.value)} aria-label={copy.profile.newNameAria} placeholder={copy.profile.newNamePlaceholder} />
          <button className="primary-button icon-label" type="submit">
            <Plus size={16} />
            {copy.profile.add}
          </button>
        </form>
        {error ? <div className="inline-alert compact">{error}</div> : null}
        <div className="profile-list">
          {profileState.profiles.map((profile) => (
            <article className={`profile-row ${profile.id === profileState.activeProfileId ? 'active' : ''}`} key={profile.id}>
              {editingId === profile.id ? (
                <form className="session-edit" onSubmit={(event) => renameProfile(event, profile.id)}>
                  <input value={editingName} autoFocus onChange={(event) => setEditingName(event.target.value)} aria-label={copy.profile.profileNameAria} />
                  <button className="icon-button" type="submit" aria-label={copy.profile.saveProfileAria}>
                    <CheckCircle2 size={15} />
                  </button>
                </form>
              ) : (
                <>
                  <button className="profile-main" onClick={() => activateProfile(profile.id)}>
                    <strong>{profile.name}</strong>
                    <span>{profile.id === profileState.activeProfileId ? copy.profile.activeNow : copy.profile.clickToUse}</span>
                  </button>
                  <div className="row-actions">
                    <button className="icon-button" aria-label={copy.profile.renameAria(profile.name)} onClick={() => {
                      setEditingId(profile.id)
                      setEditingName(profile.name)
                    }}>
                      <Pencil size={14} />
                    </button>
                    <button className="icon-button danger" aria-label={copy.profile.deleteAria(profile.name)} onClick={() => removeProfile(profile.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      </div>
      <aside className="quiet-panel policy-panel">
        <ShieldCheck size={20} />
        <h3>{copy.profile.rulesTitle}</h3>
        <label className="check-row">
          <input type="checkbox" defaultChecked />
          <span>{copy.profile.keepChatsLocal}</span>
        </label>
        <label className="check-row">
          <input type="checkbox" defaultChecked />
          <span>{copy.profile.keepFilesLocal}</span>
        </label>
        <label className="check-row">
          <input type="checkbox" />
          <span>{copy.profile.shareWithTeam}</span>
        </label>
      </aside>
    </section>
  )
}

const companyCategoryOptions: CompanyMaterialCategory[] = [
  'company-profile',
  'product-catalog',
  'price-list',
  'certification',
  'shipping-logistics',
  'payment-terms',
  'faq',
  'case-study',
  'other',
]

function CompanyKnowledgePanel({
  profile,
  setProfile,
  materials,
  setMaterials,
  copy,
}: {
  profile: CompanyProfile
  setProfile: (profile: CompanyProfile) => void
  materials: Material[]
  setMaterials: (materials: Material[]) => void
  copy: UiCopy
}) {
  const [draft, setDraft] = useState(() => companyDraftFromProfile(profile))
  const [uploadCategory, setUploadCategory] = useState<CompanyMaterialCategory>('product-catalog')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<MaterialPreview>()
  const [previewLoadingId, setPreviewLoadingId] = useState('')

  useEffect(() => {
    setDraft(companyDraftFromProfile(profile))
  }, [profile])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      setProfile(await api.saveCompanyProfile(companyProfileFromDraft(draft)))
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'message'))
    } finally {
      setSaving(false)
    }
  }

  async function uploadCompanyFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    if (!files.length) return
    setUploading(true)
    setError('')
    try {
      const saved: Material[] = []
      for (const file of files) {
        const material = await api.saveCompanyMaterial(file)
        saved.push(await api.updateCompanyMaterial(material.id, { category: uploadCategory }))
      }
      setMaterials([...saved, ...materials])
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'fileUpload'))
    } finally {
      setUploading(false)
      event.currentTarget.value = ''
    }
  }

  async function previewCompanyMaterial(id: string) {
    setPreviewLoadingId(id)
    setError('')
    try {
      setPreview(await api.companyMaterialPreview(id))
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'fileUpload'))
    } finally {
      setPreviewLoadingId('')
    }
  }

  async function updateCompanyMaterialCategory(id: string, category: CompanyMaterialCategory) {
    setError('')
    try {
      const next = await api.updateCompanyMaterial(id, { category })
      setMaterials(materials.map((material) => material.id === id ? next : material))
      if (preview?.id === id) setPreview({ ...preview, ...next })
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'fileUpload'))
    }
  }

  async function deleteCompanyMaterial(id: string) {
    setError('')
    try {
      await api.deleteCompanyMaterial(id)
      setMaterials(materials.filter((material) => material.id !== id))
      if (preview?.id === id) setPreview(undefined)
    } catch (err) {
      setError(humanizeErrorMessage(err, copy, 'fileUpload'))
    }
  }

  return (
    <section className="settings-layout company-layout">
      <form className="quiet-panel settings-form company-profile-form" onSubmit={saveProfile}>
        <div className="panel-header">
          <div>
            <span>{copy.companyKnowledge.eyebrow}</span>
            <h3>{copy.companyKnowledge.profileTitle}</h3>
          </div>
          <button className="primary-button icon-label" type="submit" disabled={saving}>
            {saving ? <RefreshCw size={16} /> : <CheckCircle2 size={16} />}
            {saving ? copy.common.saving : copy.common.save}
          </button>
        </div>
        <div className="company-form-grid">
          <label>
            {copy.companyKnowledge.fields.name}
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Acme Trading" />
          </label>
          <label>
            {copy.companyKnowledge.fields.website}
            <input value={draft.website} onChange={(event) => setDraft({ ...draft, website: event.target.value })} placeholder="https://example.com" />
          </label>
        </div>
        <label>
          {copy.companyKnowledge.fields.mainProducts}
          <textarea value={draft.mainProducts} onChange={(event) => setDraft({ ...draft, mainProducts: event.target.value })} rows={3} />
        </label>
        <label>
          {copy.companyKnowledge.fields.markets}
          <textarea value={draft.markets} onChange={(event) => setDraft({ ...draft, markets: event.target.value })} rows={2} />
        </label>
        <div className="company-form-grid">
          <label>
            {copy.companyKnowledge.fields.paymentTerms}
            <textarea value={draft.paymentTerms} onChange={(event) => setDraft({ ...draft, paymentTerms: event.target.value })} rows={2} />
          </label>
          <label>
            {copy.companyKnowledge.fields.shippingTerms}
            <textarea value={draft.shippingTerms} onChange={(event) => setDraft({ ...draft, shippingTerms: event.target.value })} rows={2} />
          </label>
        </div>
        <label>
          {copy.companyKnowledge.fields.certifications}
          <textarea value={draft.certifications} onChange={(event) => setDraft({ ...draft, certifications: event.target.value })} rows={2} />
        </label>
        <label>
          {copy.companyKnowledge.fields.brandVoice}
          <textarea value={draft.brandVoice} onChange={(event) => setDraft({ ...draft, brandVoice: event.target.value })} rows={3} />
        </label>
        <label>
          {copy.companyKnowledge.fields.notes}
          <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={4} />
        </label>
      </form>

      <aside className="quiet-panel company-materials-panel">
        <div className="panel-header">
          <div>
            <span>{copy.companyKnowledge.subtitle}</span>
            <h3>{copy.companyKnowledge.materialsTitle}</h3>
          </div>
          <label className="company-category-select">
            <span>{copy.companyKnowledge.categoryForNewFiles}</span>
            <select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value as CompanyMaterialCategory)}>
              {companyCategoryOptions.map((category) => <option value={category} key={category}>{copy.companyKnowledge.categories[category]}</option>)}
            </select>
          </label>
        </div>

        <label className="upload-dropzone company-upload-dropzone">
          <Building2 size={20} />
          <strong>{uploading ? copy.companyKnowledge.uploading : copy.companyKnowledge.addFiles}</strong>
          <span>{copy.companyKnowledge.supportedTypes}</span>
          <input type="file" multiple onChange={uploadCompanyFiles} aria-label={copy.companyKnowledge.addFiles} />
        </label>

        {error ? <div className="inline-alert compact">{error}</div> : null}

        {preview ? (
          <article className="material-preview company-preview">
            <div className="material-preview-header">
              <div>
                <span>{copy.files.preview}</span>
                <strong>{preview.name}</strong>
              </div>
              <button className="icon-button" aria-label={copy.files.closePreviewAria} onClick={() => setPreview(undefined)}>
                <X size={14} />
              </button>
            </div>
            <pre>{preview.contentText || copy.companyKnowledge.noPreview}</pre>
          </article>
        ) : null}

        <div className="material-list company-material-list">
          {materials.length ? materials.map((material) => (
            <article className="material-row company-material-row" key={material.id}>
              <button className="material-select" onClick={() => previewCompanyMaterial(material.id)}>
                <FileText size={16} />
                <span>
                  <strong>{material.name}</strong>
                  <small>{copy.companyKnowledge.categories[material.category ?? 'other']} · {formatBytes(material.size)} · {materialStatusLabel(material, copy)}</small>
                </span>
              </button>
              <div className="material-actions company-material-actions">
                <select value={material.category ?? 'other'} onChange={(event) => updateCompanyMaterialCategory(material.id, event.target.value as CompanyMaterialCategory)}>
                  {companyCategoryOptions.map((category) => <option value={category} key={category}>{copy.companyKnowledge.categories[category]}</option>)}
                </select>
                <button className="icon-button" aria-label={copy.files.previewAria(material.name)} onClick={() => previewCompanyMaterial(material.id)}>
                  {previewLoadingId === material.id ? <RefreshCw size={14} /> : <Eye size={14} />}
                </button>
                <button className="icon-button danger" aria-label={copy.files.deleteAria(material.name)} onClick={() => deleteCompanyMaterial(material.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          )) : <div className="empty-state">{copy.companyKnowledge.empty}</div>}
        </div>
      </aside>
    </section>
  )
}

function companyDraftFromProfile(profile: CompanyProfile) {
  return {
    name: profile.name ?? '',
    website: profile.website ?? '',
    markets: joinLines(profile.markets),
    mainProducts: joinLines(profile.mainProducts),
    certifications: joinLines(profile.certifications),
    paymentTerms: joinLines(profile.paymentTerms),
    shippingTerms: joinLines(profile.shippingTerms),
    brandVoice: profile.brandVoice ?? '',
    notes: profile.notes ?? '',
  }
}

function companyProfileFromDraft(draft: ReturnType<typeof companyDraftFromProfile>): Partial<Omit<CompanyProfile, 'version' | 'updatedAt'>> {
  return {
    name: draft.name.trim(),
    website: draft.website.trim() || undefined,
    markets: splitLines(draft.markets),
    mainProducts: splitLines(draft.mainProducts),
    certifications: splitLines(draft.certifications),
    paymentTerms: splitLines(draft.paymentTerms),
    shippingTerms: splitLines(draft.shippingTerms),
    brandVoice: draft.brandVoice.trim(),
    notes: draft.notes.trim(),
  }
}

function isCompanyDraftReady(draft: ReturnType<typeof companyDraftFromProfile>): boolean {
  return Boolean(draft.name.trim() && draft.website.trim() && splitLines(draft.mainProducts).length)
}

function isCompanyProfileReady(profile: CompanyProfile): boolean {
  return Boolean(profile.name.trim() && profile.website?.trim() && profile.mainProducts.some((item) => item.trim()))
}

function joinLines(values: string[] | undefined): string {
  return (values ?? []).join('\n')
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
}

function SettingsPanel({
  providers,
  readyProviders,
  readyAgents,
  refresh,
  uiMode = 'simple',
  copy,
}: {
  providers: Provider[]
  readyProviders: number
  readyAgents: number
  refresh: (providers: Provider[]) => void
  uiMode?: UiModeId
  copy: UiCopy
}) {
  const initialPreset = providerPresets[0]
  const [form, setForm] = useState<ProviderForm>({
    kind: initialPreset.kind,
    displayName: initialPreset.displayName,
    baseUrl: initialPreset.baseUrl,
    defaultModel: initialPreset.defaultModel,
    apiKey: '',
  })
  const [selectedPreset, setSelectedPreset] = useState<ProviderPresetId>(initialPreset.id)
  const [advancedVisible, setAdvancedVisible] = useState(false)
  const [savingProvider, setSavingProvider] = useState(false)
  const [providerResults, setProviderResults] = useState<Record<string, string>>({})

  function selectPreset(presetId: ProviderPresetId) {
    const preset = providerPresets.find((item) => item.id === presetId) ?? initialPreset
    setSelectedPreset(preset.id)
    setForm({
      kind: preset.kind,
      displayName: preset.displayName,
      baseUrl: preset.baseUrl,
      defaultModel: preset.defaultModel,
      apiKey: form.apiKey,
    })
  }

  async function saveProvider() {
    if (!form.apiKey.trim()) {
      setProviderResults((current) => ({ ...current, __form: copy.keys.form.pasteKeyFirst }))
      return
    }
    setSavingProvider(true)
    setProviderResults((current) => ({ ...current, __form: copy.keys.form.saving }))
    try {
      const saved = await api.saveProvider(form)
      setForm({ ...form, apiKey: '' })
      refresh(await api.providers())
      setProviderResults((current) => ({ ...current, __form: copy.keys.form.saved, [saved.id]: copy.common.saved }))
    } catch (err) {
      setProviderResults((current) => ({ ...current, __form: humanizeErrorMessage(err, copy, 'provider') }))
    } finally {
      setSavingProvider(false)
    }
  }

  async function testProvider(providerId: string) {
    setProviderResults({ ...providerResults, [providerId]: copy.keys.form.testing })
    try {
      await api.testProvider(providerId)
      setProviderResults((current) => ({ ...current, [providerId]: copy.keys.form.connected }))
    } catch (err) {
      setProviderResults((current) => ({ ...current, [providerId]: humanizeErrorMessage(err, copy, 'provider') }))
    }
  }

  async function syncModels(providerId: string) {
    setProviderResults({ ...providerResults, [providerId]: copy.keys.form.checkingModels })
    try {
      const result = await api.providerModels(providerId)
      setProviderResults((current) => ({ ...current, [providerId]: result.models.length ? result.models.join(', ') : result.message || result.status }))
    } catch (err) {
      setProviderResults((current) => ({ ...current, [providerId]: humanizeErrorMessage(err, copy, 'provider') }))
    }
  }

  const expertMode = uiMode === 'expert'

  return (
    <section className={`settings-layout ${expertMode ? 'expert-mode' : ''}`} data-expert-mode={expertMode}>
      <div className="quiet-panel">
        <div className="panel-header">
          <div>
            <span>{copy.keys.readySummary(readyProviders, readyAgents)}</span>
            <h3>{copy.keys.title}</h3>
          </div>
          <button className="primary-button icon-label" disabled={savingProvider} onClick={saveProvider}>
            {savingProvider ? <RefreshCw size={16} /> : <Plus size={16} />}
            {savingProvider ? copy.common.saving : copy.keys.saveKey}
          </button>
        </div>
        <div className="quick-key-form">
          <label>
            <span>{copy.common.provider}</span>
            <select value={selectedPreset} onChange={(event) => selectPreset(event.target.value as ProviderPresetId)} aria-label={copy.common.provider}>
              {providerPresets.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}
            </select>
          </label>
          <label>
            <span>{copy.common.apiKey}</span>
            <input
              type="password"
              value={form.apiKey}
              onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
              aria-label={copy.common.apiKey}
              placeholder={providerPresets.find((item) => item.id === selectedPreset)?.keyPlaceholder ?? copy.common.apiKey}
            />
          </label>
          <div className="quick-key-actions">
            {expertMode ? <button className="text-button" onClick={() => setAdvancedVisible(!advancedVisible)}>
              {advancedVisible ? copy.keys.hideDetails : copy.keys.advancedDetails}
            </button> : null}
            {providerResults.__form ? <span>{providerResults.__form}</span> : null}
          </div>
        </div>
        {expertMode && advancedVisible ? (
          <div className="settings-form compact-settings-form">
            <input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} aria-label={copy.common.providerName} />
            <input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} aria-label={copy.common.baseUrl} />
            <input value={form.defaultModel} onChange={(event) => setForm({ ...form, defaultModel: event.target.value })} aria-label={copy.common.defaultModel} />
          </div>
        ) : null}
        <div className="provider-help">
          {copy.keys.savedHelp}
        </div>
        <div className="provider-list">
          {providers.length ? (
            providers.map((provider) => (
              <article className="provider-row" key={provider.id}>
                <div>
                  <strong>{provider.name}</strong>
                  <span>{providerResults[provider.id] || provider.models?.join(', ') || copy.keys.noModels}</span>
                </div>
                <code>{provider.maskedKey || copy.keys.noKeySaved}</code>
                <span className={`status-pill ${provider.status}`}>{providerStatusLabel(provider.status, copy)}</span>
                {expertMode ? <div className="provider-actions">
                  <button className="soft-button compact" onClick={() => testProvider(provider.id)}>{copy.keys.test}</button>
                  <button className="soft-button compact" onClick={() => syncModels(provider.id)}>{copy.keys.models}</button>
                </div> : null}
              </article>
            ))
          ) : (
            <div className="empty-state">{copy.keys.noProviders}</div>
          )}
        </div>
      </div>

      {expertMode ? <aside className="quiet-panel policy-panel">
        <ShieldCheck size={20} />
        <h3>{copy.keys.defaults}</h3>
        <label className="check-row">
          <input type="checkbox" defaultChecked />
          <span>{copy.keys.maskKeys}</span>
        </label>
        <label className="check-row">
          <input type="checkbox" defaultChecked />
          <span>{copy.keys.confirmDestructiveTools}</span>
        </label>
        <label className="check-row">
          <input type="checkbox" />
          <span>{copy.keys.allowExternalTools}</span>
        </label>
      </aside> : null}
    </section>
  )
}

function DiagnosticsPanel({
  runtime,
  sessions,
  materials,
  companyMaterials,
  providers,
  agents,
  usage,
  analytics,
  copy,
}: {
  runtime: RuntimeStatus
  sessions: ChatSession[]
  materials: Material[]
  companyMaterials: Material[]
  providers: Provider[]
  agents: Agent[]
  usage: UsageSummary
  analytics: AnalyticsSummary
  copy: UiCopy
}) {
  return (
    <section className="diagnostics-layout">
      <StatusRow icon={Cpu} label={copy.diagnostics.runtime} value={runtimeStatusLabel(runtime, copy)} detail={runtime.version || runtime.path || copy.runtime.steps['not-installed']} />
      <StatusRow icon={MessageCircle} label={copy.diagnostics.conversations} value={String(sessions.length)} detail={copy.diagnostics.localChatHistory} />
      <StatusRow icon={FileText} label={copy.diagnostics.sources} value={String(materials.length)} detail={copy.diagnostics.uploadedLocalContext} />
      <StatusRow icon={Building2} label={copy.diagnostics.companyKnowledge} value={String(companyMaterials.length)} detail={copy.diagnostics.companyMaterials(companyMaterials.length)} />
      <StatusRow icon={KeyRound} label={copy.diagnostics.keys} value={String(providers.length)} detail={copy.diagnostics.storedProviderEntries} />
      <StatusRow icon={Bot} label={copy.diagnostics.agents} value={String(agents.length)} detail={copy.diagnostics.savedInstructionProfiles} />
      <StatusRow icon={Cpu} label={copy.diagnostics.tokens} value={formatNumber(usage.usage.totalTokens)} detail={copy.diagnostics.tokenDetail(formatNumber(usage.usage.inputTokens), formatNumber(usage.usage.outputTokens))} />
      <StatusRow icon={FileText} label={copy.diagnostics.storage} value={formatBytes(usage.fileBytes)} detail={copy.diagnostics.localFiles(usage.files)} />
      <StatusRow icon={Play} label={copy.diagnostics.jobs} value={String(analytics.activeJobs)} detail={copy.diagnostics.jobDetail(analytics.jobRuns, analytics.failedJobRuns)} />
      <StatusRow icon={PanelRightOpen} label={copy.diagnostics.channels} value={String(analytics.connectedChannels)} detail={copy.diagnostics.channelDetail(analytics.channels)} />
      <StatusRow icon={Wrench} label={copy.diagnostics.logs} value={String(analytics.logs)} detail={copy.diagnostics.logDetail(analytics.errorLogs)} />
    </section>
  )
}

function StatusRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="status-row">
      <Icon size={18} strokeWidth={1.8} />
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <em>{value}</em>
    </div>
  )
}

type MessageBlock = { type: 'text'; body: string } | { type: 'code'; lang: string; body: string }

const COMPUTER_CONTROL_MESSAGE_PREFIX = '[[HERMILLS_COMPUTER_CONTROL:'
const COMPUTER_CONTROL_MESSAGE_SUFFIX = ']]'

function parseComputerControlMessage(content: string): ComputerControlPayload | undefined {
  if (!content.startsWith(COMPUTER_CONTROL_MESSAGE_PREFIX) || !content.endsWith(COMPUTER_CONTROL_MESSAGE_SUFFIX)) return undefined
  try {
    const raw = content.slice(COMPUTER_CONTROL_MESSAGE_PREFIX.length, -COMPUTER_CONTROL_MESSAGE_SUFFIX.length)
    const payload = JSON.parse(raw) as ComputerControlPayload
    if (!payload || typeof payload.message !== 'string') return undefined
    return payload
  } catch {
    return undefined
  }
}

function MessageContent({ content }: { content: string }) {
  return (
    <div className="message-content">
      {parseMessageBlocks(content).map((block, index) => block.type === 'code' ? (
        <pre className="message-code" key={`${block.type}-${index}`}>
          <code>{block.body}</code>
        </pre>
      ) : (
        <div className="message-text" key={`${block.type}-${index}`}>
          {block.body.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex}>{paragraph}</p>
          ))}
        </div>
      ))}
    </div>
  )
}

function parseMessageBlocks(content: string): MessageBlock[] {
  const blocks: MessageBlock[] = []
  const pattern = /```([a-zA-Z0-9_-]*)?\n([\s\S]*?)```/g
  let cursor = 0
  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) blocks.push({ type: 'text', body: content.slice(cursor, index).trim() })
    blocks.push({ type: 'code', lang: match[1] || '', body: match[2].replace(/\n$/, '') })
    cursor = index + match[0].length
  }
  if (cursor < content.length) blocks.push({ type: 'text', body: content.slice(cursor).trim() })
  return blocks.filter((block) => block.body.length > 0)
}

function filterSessions(sessions: ChatSession[], query: string): ChatSession[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return sessions
  return sessions.filter((session) => [
    session.title,
    session.model,
    ...session.messages.map((message) => message.content)
  ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)))
}

function replaceSession(sessions: ChatSession[], next: ChatSession): ChatSession[] {
  const exists = sessions.some((session) => session.id === next.id)
  if (!exists) return [next, ...sessions]
  return sessions.map((session) => session.id === next.id ? next : session)
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [value, ...values]
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function formatUsage(usage: NonNullable<ChatSession['messages'][number]['usage']>, copy: UiCopy = getUiCopy('en')): string {
  return copy.format.usage(formatNumber(usage.inputTokens), formatNumber(usage.outputTokens), formatNumber(usage.totalTokens))
}

function materialStatusLabel(material: Material, copy: UiCopy = getUiCopy('en')): string {
  if (material.extractionState === 'indexed' || material.textPreview) return copy.files.status.ready
  if (material.extractionState === 'failed') return material.extractionError ? `${copy.files.status.needsRetry}: ${material.extractionError}` : copy.files.status.needsRetry
  if (material.extractionState === 'extracting') return copy.files.status.gettingReady
  return copy.files.status.added
}

function providerStatusLabel(status: Provider['status'], copy: UiCopy = getUiCopy('en')): string {
  return copy.providerStatus[status]
}

function localizedAgentDescription(description: string | undefined, copy: UiCopy = getUiCopy('en')): string {
  const normalized = description?.trim()
  if (!normalized || normalized === 'Default assistant created during onboarding.') return copy.assistant.defaultForm.description
  return normalized
}

function computerReadinessLabel(status: ComputerControlStatus | undefined, copy: UiCopy = getUiCopy('en')): string {
  if (!status) return copy.runtime.summary.checking
  if (status.readiness === 'ready') return copy.runtime.meta.ready
  if (status.readiness === 'preparing') return copy.runtime.steps.configuring
  if (status.readiness === 'needs-permission') return copy.computerControl.permissionNudgeTitle
  if (status.readiness === 'failed') return copy.runtime.steps.failed
  return copy.computerControl.notReadyHint
}

function computerReadinessDescription(status: ComputerControlStatus | undefined, copy: UiCopy = getUiCopy('en')): string {
  if (!status) return copy.runtime.summary.checking
  if (status.readiness === 'ready') return copy.computerControl.consoleReady
  if (status.readiness === 'needs-permission') return copy.computerControl.permissionNudgeDetail
  if (status.readiness === 'failed') return copy.gateway.failed
  return copy.computerControl.notReadyHint
}

type RuntimeActionState = {
  kind: 'deploy' | 'update' | 'none'
  label: string
}

export function getRuntimeActionState(
  runtime: RuntimeStatus,
  updateCheck: RuntimeUpdateCheck | undefined,
  firstRun: boolean,
  installing: boolean,
  copy: UiCopy = getUiCopy('en'),
): RuntimeActionState {
  if (firstRun) return { kind: 'deploy', label: installing ? copy.runtime.action.settingUp : copy.runtime.action.setUp }
  if (!runtime.installed) return { kind: 'none', label: copy.runtime.action.needsSetup }
  if ((updateCheck?.updateAvailable ?? runtime.updateAvailable) === true) return { kind: 'update', label: installing ? copy.runtime.action.updating : copy.runtime.action.update }
  return { kind: 'none', label: copy.runtime.action.current }
}

function isLocalDeploymentComplete(runtime: RuntimeStatus): boolean {
  return runtime.localDeploymentComplete ?? (runtime.installed || runtime.state === 'ready')
}

function runtimeStatusLabel(runtime: RuntimeStatus, copy: UiCopy = getUiCopy('en')): string {
  if (!isLocalDeploymentComplete(runtime)) return copy.runtime.status.setupNeeded
  if (runtime.state === 'ready') return copy.runtime.status.ready
  if (runtime.gateway?.state === 'starting' || runtime.state === 'starting') return copy.runtime.status.starting
  if (runtime.gateway?.state === 'failed' || runtime.state === 'failed') return copy.runtime.status.restart
  return copy.runtime.status.paused
}

function runtimeNeedsRecovery(runtime: RuntimeStatus): boolean {
  return isLocalDeploymentComplete(runtime) && (runtime.state !== 'ready' || runtime.gateway?.state !== 'running')
}

function firstRunTitle(runtime: RuntimeStatus, copy: UiCopy = getUiCopy('en')): string {
  if (runtime.state === 'failed') return copy.runtime.title.setupRetry
  if (runtime.activeInstallJob || ['checking', 'downloading', 'installing', 'configuring', 'starting', 'verifying'].includes(runtime.state)) {
    return copy.runtime.title.settingUp
  }
  return copy.runtime.title.setupOnce
}

function runtimeUpdateTitle(runtime: RuntimeStatus, updateCheck?: RuntimeUpdateCheck, copy: UiCopy = getUiCopy('en')): string {
  if ((updateCheck?.updateAvailable ?? runtime.updateAvailable) === true) return copy.runtime.title.hasUpdate
  if (runtime.state === 'ready') return copy.runtime.title.ready
  if (!runtime.installed) return copy.runtime.title.needsRepair
  return copy.runtime.title.installed
}

function runtimeUpdateDescription(runtime: RuntimeStatus, updateCheck?: RuntimeUpdateCheck, checkingUpdate = false, copy: UiCopy = getUiCopy('en')): string {
  if (checkingUpdate) return copy.runtime.description.checking
  if ((updateCheck?.updateAvailable ?? runtime.updateAvailable) === true) return copy.runtime.description.updateAvailable
  if (updateCheck?.checkState === 'unknown') return copy.runtime.description.unknown
  return copy.runtime.description.current
}

function runtimeUpdateSummary(updateCheck: RuntimeUpdateCheck | undefined, checkingUpdate: boolean, copy: UiCopy = getUiCopy('en')): string {
  if (checkingUpdate) return copy.runtime.summary.checking
  if (!updateCheck) return copy.runtime.summary.ready
  if (updateCheck.updateAvailable) return copy.runtime.summary.updateFound
  if (updateCheck.checkState === 'unknown') return copy.runtime.summary.couldNotFinish
  return copy.runtime.summary.current
}

function runtimeUpdateDetail(runtime: RuntimeStatus, updateCheck?: RuntimeUpdateCheck, copy: UiCopy = getUiCopy('en')): string {
  if (updateCheck?.error) return updateCheck.error
  const installed = runtime.version || updateCheck?.installedVersion || copy.common.unknown
  const latest = updateCheck?.latestVersion || runtime.latestVersion || copy.common.unknown
  return copy.runtime.detail(installed, latest)
}

function formatCheckTime(value?: string, copy: UiCopy = getUiCopy('en')): string {
  if (!value) return copy.common.notChecked
  return new Date(value).toLocaleString()
}

function labelForStep(step: string, copy: UiCopy = getUiCopy('en')): string {
  return step in copy.runtime.steps ? copy.runtime.steps[step as keyof UiCopy['runtime']['steps']] : step
}

function friendlyHermesMessage(runtime: RuntimeStatus, copy: UiCopy = getUiCopy('en')): string {
  if (runtime.gateway?.state === 'starting' || runtime.state === 'starting') return copy.gateway.starting
  if (runtime.gateway?.state === 'failed' || runtime.state === 'failed') return copy.gateway.failed
  if (!runtime.installed) return copy.gateway.notInstalled
  return copy.gateway.paused
}

type ErrorContext = 'message' | 'fileUpload' | 'assistant' | 'provider' | 'runtime'

function rawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function humanizeErrorMessage(error: unknown, copy: UiCopy, context: ErrorContext = 'message'): string {
  const raw = rawErrorMessage(error)
  const friendly = copy.errors.friendly
  const visibleDetail = visibleDiagnosticError(raw)

  if (visibleDetail) return `${friendly.messageFailed.title} ${copy.errors.withDetail(visibleDetail)}`

  if (/413|too large|file size|payload/i.test(raw)) return `${friendly.fileTooLarge.message} ${friendly.fileTooLarge.recovery}`
  if (/api key|unauthorized|forbidden|401|403|invalid key|authentication/i.test(raw)) return `${friendly.apiKeyInvalid.message} ${friendly.apiKeyInvalid.recovery}`
  if (/provider|base url|model not found|no model/i.test(raw)) return `${friendly.providerMissing.message} ${friendly.providerMissing.recovery}`
  if (/body cannot be empty|internal_error|application\/json|empty body/i.test(raw)) return `${friendly.messageFailed.message} ${friendly.messageFailed.recovery}`
  if (/runtime|gateway|not ready|not installed|econnrefused|failed to fetch|network/i.test(raw)) return `${friendly.runtimeUnavailable.message} ${friendly.runtimeUnavailable.recovery}`
  if (context === 'fileUpload') return `${friendly.fileUploadFailed.message} ${friendly.fileUploadFailed.recovery}`
  if (context === 'assistant') return `${friendly.assistantCreateFailed.message} ${friendly.assistantCreateFailed.recovery}`
  if (context === 'provider') return `${friendly.providerMissing.message} ${friendly.providerMissing.recovery}`
  if (context === 'runtime') return `${friendly.runtimeUnavailable.message} ${friendly.runtimeUnavailable.recovery}`
  return `${friendly.messageFailed.message} ${friendly.messageFailed.recovery}`
}

function visibleDiagnosticError(raw: string): string {
  const cleaned = raw
    .replace(/^Error:\s*/i, '')
    .replace(/^Request failed:\s*/i, '')
    .replace(/^\d{3}\s+[^:]+:\s*/i, '')
    .trim()
  if (!/(email could not be sent|smtp|mailbox|sender account|sendmail|connection closed|unexpected socket close|greeting never received|invalid login|eauth|esocket|econnreset|etimedout|\b5(?:3[45]|50|53|54)\b)/i.test(cleaned)) return ''
  return cleaned.length > 320 ? `${cleaned.slice(0, 319).trimEnd()}...` : cleaned
}

function localizeRuntimeMessage(message: string | undefined, copy: UiCopy): string {
  if (!message) return ''
  const knownMessages: Record<string, string> = {
    'Checking for a Hermes update...': copy.runtime.installMessages.checkingUpdate,
    'Checking Hermes setup...': copy.runtime.installMessages.checkingSetup,
    'Update failed. Hermes can keep using the current version.': copy.runtime.installMessages.updateFailed,
    'Setup failed. Copy the report and retry.': copy.runtime.installMessages.setupFailed,
    'Hermes is starting. This usually takes a moment.': copy.gateway.starting,
    'Try again. If it still fails, open setup for more options.': copy.gateway.failed,
    'Set up Hermes to enable private local chat.': copy.gateway.notInstalled,
    'Start Hermes to send messages.': copy.gateway.paused,
    'Hermes is installed. Start Hermes to chat.': copy.gateway.paused,
  }
  return knownMessages[message] ?? message
}

function stepComplete(step: string, runtimeState: RuntimeStatus['state'], events: InstallEvent[]): boolean {
  if (runtimeState === 'ready') return true
  return events.some((event) => event.step === step && (event.level === 'done' || (event.progress ?? 0) >= 80))
}

function latestEventForStep(events: InstallEvent[], step: string): InstallEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].step === step) return events[index]
  }
  return undefined
}

async function pollInstall(
  jobId: string,
  setEvents: (events: InstallEvent[]) => void,
  setRuntime: (runtime: RuntimeStatus) => void,
  baseRuntime: RuntimeStatus = fallback.runtime,
): Promise<void> {
  let verifyingPolls = 0
  for (;;) {
    const events = await api.runtimeInstallEvents(jobId)
    setEvents(events)
    const last = events.at(-1)
    if (last) {
      setRuntime({
        ...baseRuntime,
        state: last.level === 'error' ? 'failed' : (last.step as RuntimeStatus['state']) || 'installing',
        progress: last.progress,
        message: last.message,
      })
      if (last.level === 'done' || last.level === 'error') return
      if (last.level === 'warn' && last.step === 'verifying') {
        verifyingPolls += 1
        const runtime = await api.runtimeStatus().catch(() => undefined)
        if (runtime) setRuntime(runtime)
        if (runtime?.gateway?.state === 'running' || runtime?.state === 'ready' || runtime?.gateway?.state === 'failed' || verifyingPolls > 120) return
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 900))
  }
}
