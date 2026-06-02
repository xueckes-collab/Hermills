import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  AlertCircle,
  Bot,
  Brain,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Globe2,
  KeyRound,
  Languages,
  ListChecks,
  Menu,
  MessageCircle,
  PanelRightOpen,
  Paperclip,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  Wrench,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api, fallback } from './api.js'
import type { Agent, AgentInput, AnalyticsSummary, ChatSession, InstallEvent, Material, MaterialPreview, ProfileState, Provider, RuntimeStatus, RuntimeUpdateCheck, UsageSummary } from './api.js'
import { getUiCopy } from './i18n.js'
import type { AssistantRoleCardId, ChatEmptyEntryId, FileActionId, UiCopy, UiModeId } from './i18n.js'

type AdvancedPanel = 'setup' | 'personalize' | 'agents' | 'profiles' | 'keys' | 'diagnostics'

const advancedItems: Array<{ id: AdvancedPanel; icon: LucideIcon }> = [
  { id: 'setup', icon: Cpu },
  { id: 'personalize', icon: Languages },
  { id: 'agents', icon: Bot },
  { id: 'profiles', icon: ShieldCheck },
  { id: 'keys', icon: KeyRound },
  { id: 'diagnostics', icon: Wrench },
]

const simpleAdvancedPanels: AdvancedPanel[] = ['setup', 'personalize', 'agents', 'keys']

const chatEmptyActions: Array<{ id: ChatEmptyEntryId; icon: LucideIcon }> = [
  { id: 'quickChat', icon: MessageCircle },
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
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    displayName: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    keyPlaceholder: 'sk-or-...',
  },
  {
    id: 'custom',
    label: 'Custom',
    displayName: 'Custom provider',
    baseUrl: 'https://provider.example/v1',
    defaultModel: 'model-name',
    keyPlaceholder: 'API key',
  },
] as const

type ProviderPresetId = (typeof providerPresets)[number]['id']

type ProviderForm = {
  displayName: string
  baseUrl: string
  defaultModel: string
  apiKey: string
}

type OnboardingStepId = 'language' | 'identity' | 'provider' | 'theme' | 'workspace' | 'features'
type OnboardingLanguage = 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'en'
type OnboardingProviderChoice = ProviderPresetId | 'skip'
type OnboardingTheme = 'warm' | 'night' | 'plain' | 'system'
type OnboardingFeatureId = 'chat' | 'files' | 'memory' | 'assistants' | 'diagnostics'

type OnboardingProviderInput = {
  id?: string
  kind?: 'openai-compatible' | 'openai' | 'anthropic' | 'local'
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
}

const onboardingSteps: Array<{ id: OnboardingStepId; icon: LucideIcon }> = [
  { id: 'language', icon: Languages },
  { id: 'identity', icon: UserRound },
  { id: 'workspace', icon: FolderOpen },
]

const languageOptions: Array<{ id: OnboardingLanguage; label: string }> = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
]

const themeOptions: Array<{ id: OnboardingTheme }> = [
  { id: 'warm' },
  { id: 'night' },
  { id: 'plain' },
  { id: 'system' },
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
  theme: 'warm',
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
    displayName: preset.displayName,
    baseUrl: preset.baseUrl,
    defaultModel: preset.defaultModel,
    apiKey: '',
  }
}

function draftFromOnboarding(state: OnboardingState): OnboardingDraft {
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
          displayName: normalized.provider.displayName || providerDefaults.displayName,
          baseUrl: normalized.provider.baseUrl || providerDefaults.baseUrl,
          defaultModel: normalized.provider.defaultModel || providerDefaults.defaultModel,
          apiKey: normalized.provider.apiKey ?? '',
        }
      : providerDefaults,
    theme: normalized.theme ?? 'warm',
    workspacePath: normalized.workspacePath ?? '~/Desktop/Hermills-Workspace',
    features: normalized.features?.length ? normalized.features : defaultOnboardingFeatures,
  }
}

function onboardingInputFromDraft(draft: OnboardingDraft): OnboardingInput {
  const provider: OnboardingProviderInput | null = draft.providerChoice === 'skip'
    ? null
    : {
        kind: 'openai-compatible',
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
  const appState = useEndpoint(api.appState, fallback.appState)
  const runtime = useEndpoint(api.runtimeStatus, fallback.runtime)
  const localDeploymentComplete = !appState.data.shouldShowFirstDeploy
  const workspaceEnabled = !appState.loading && localDeploymentComplete
  const onboarding = useEndpoint(loadOnboardingState, fallbackOnboarding, workspaceEnabled)
  const chatEnabled = workspaceEnabled && onboarding.data.completed
  const agents = useEndpoint(api.agents, fallback.agents, chatEnabled)
  const providers = useEndpoint(api.providers, fallback.providers, chatEnabled)
  const profiles = useEndpoint(api.profiles, fallback.profiles, chatEnabled)
  const usage = useEndpoint(api.usageSummary, fallback.usage, chatEnabled)
  const analytics = useEndpoint(api.analyticsSummary, fallback.analytics, chatEnabled)
  const sessions = useEndpoint(api.chatSessions, fallback.sessions, chatEnabled)
  const materials = useEndpoint(api.materials, fallback.materials, chatEnabled)

  const readyProviders = providers.data.filter((provider) => provider.status === 'connected').length
  const readyAgents = agents.data.filter((agent) => agent.status !== 'draft').length
  const serviceWarning = appState.error || runtime.error || onboarding.error || agents.error || providers.error || profiles.error || usage.error || analytics.error || sessions.error || materials.error
  const copy = getUiCopy(onboarding.data.language ?? fallbackOnboarding.language)

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

  if (onboarding.loading) {
    return (
      <OnboardingLoadingPage serviceError={serviceWarning} copy={copy} />
    )
  }

  if (!onboarding.data.completed) {
    return (
      <OnboardingWizard
        initialState={onboarding.data}
        serviceError={serviceWarning}
        onFinished={(next) => onboarding.setData(next)}
      />
    )
  }

  return (
    <div className={`client-shell client-theme-${onboarding.data.theme ?? 'warm'}`}>
      {serviceWarning ? <div className="service-warning">{copy.topbar.serviceWarning(serviceWarning)}</div> : null}

      <ClientWorkspace
        runtime={runtime.data}
        sessions={sessions.data}
        setSessions={sessions.setData}
        materials={materials.data}
        setMaterials={materials.setData}
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
          uiMode={uiMode}
          setUiMode={setUiMode}
          copy={copy}
        />
      ) : null}
    </div>
  )
}

function ClientWorkspace({
  runtime,
  sessions,
  setSessions,
  materials,
  setMaterials,
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
}: {
  runtime: RuntimeStatus
  sessions: ChatSession[]
  setSessions: (sessions: ChatSession[]) => void
  materials: Material[]
  setMaterials: (materials: Material[]) => void
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
}) {
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

  function updateScrollPreference() {
    const stream = streamRef.current
    if (!stream) return
    stickToBottomRef.current = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 160
  }

  function focusComposer() {
    window.setTimeout(() => composerInputRef.current?.focus(), 0)
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

  async function newSession() {
    setSendError('')
    const agent = preferredAgentId ? agents.find((item) => item.id === preferredAgentId) : undefined
    const session = await api.createChatSession(agent ? copy.chat.newAssistantConversation(agent.name) : copy.chat.newConversation, getChatSessionDefaults(agent, defaultChatProvider))
    setSessions([session, ...sessions])
    setActiveSessionId(session.id)
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
      setAssistantsOpen(false)
    } catch (err) {
      setSendError(humanizeErrorMessage(err, copy, 'message'))
    }
  }

  function selectSession(id: string) {
    setSendError('')
    setActiveSessionId(id)
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
      const next = await api.sendChatMessage(session.id, content, selectedMaterialIds)
      setSessions(replaceSession(nextSessionList, next))
      setActiveSessionId(next.id)
      setDraft('')
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

  return (
    <main className={`client-layout ${sourcesOpen ? 'sources-visible' : ''}`}>
      <SessionSidebar
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
        onOpenSettings={() => openAdvanced('setup')}
        onOpenUpdate={() => openAdvanced('setup')}
        copy={copy}
      />

      {sessionsOpen ? (
        <div className="mobile-session-overlay" onClick={() => setSessionsOpen(false)}>
          <SessionSidebar
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
            onOpenSettings={() => openAdvanced('setup')}
            onOpenUpdate={() => openAdvanced('setup')}
            className="mobile-session-panel"
            copy={copy}
          />
        </div>
      ) : null}

      <section className="conversation-surface">
        {!chatReady ? <GatewayBanner runtime={runtime} setRuntime={setRuntime} openAdvanced={openAdvanced} copy={copy} /> : null}

        <div className="conversation-title">
          <div className="conversation-heading">
            <button className="icon-button mobile-session-trigger" aria-label={copy.topbar.chats} onClick={() => setSessionsOpen(true)}>
              <Menu size={17} />
            </button>
            <div>
              <span>{copy.chat.sectionLabel}</span>
              <h1>{activeSession?.title || copy.chat.defaultTitle}</h1>
              <div className="conversation-meta">
                <button className="assistant-chip" onClick={() => setAssistantsOpen(true)}>
                  <Bot size={13} />
                  {activeAgent?.name || copy.chat.defaultAssistant}
                </button>
              </div>
            </div>
          </div>
          <button className="soft-button compact" onClick={() => setSourcesOpen(true)}>
            <Paperclip size={15} />
            {selectedMaterialIds.length ? copy.chat.selectedFiles(selectedMaterialIds.length) : copy.chat.addFile}
          </button>
        </div>

        <div className="message-stream" ref={streamRef} onScroll={updateScrollPreference}>
          {activeSession?.messages.length ? (
            activeSession.messages.filter((message) => message.role !== 'system').map((message) => (
              <div className={`message ${message.role === 'assistant' ? 'agent' : message.role}`} key={message.id}>
                <span>{message.role === 'assistant' ? 'Hermes' : copy.chat.you}</span>
                <MessageContent content={message.content} />
              </div>
            ))
          ) : (
            <div className="empty-chat">
              <MessageCircle size={30} />
              <strong>{copy.chat.emptyTitle}</strong>
              <span>{copy.chat.emptyDescription}</span>
              <div className="empty-chat-actions">
                {chatEmptyActions.map((action) => {
                  const Icon = action.icon
                  const entry = copy.chat.emptyActions[action.id]
                  return (
                    <button className="empty-chat-entry" type="button" key={action.id} onClick={() => handleEmptyChatAction(action.id)}>
                      <Icon size={17} />
                      <span>
                        <strong>{entry.title}</strong>
                        <span>{entry.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div ref={streamBottomRef} />
        </div>

        {selectedMaterialIds.length ? (
          <div className="file-action-bar">
            <span className="state-hint">{copy.files.attached(selectedMaterialIds.length)}</span>
            {fileActionItems.map((action) => {
              const Icon = action.icon
              return (
                <button className="file-action-button" type="button" key={action.id} onClick={() => applyFileAction(action.id)}>
                  <Icon size={15} />
                  {copy.files.actions[action.id].label}
                </button>
              )
            })}
          </div>
        ) : null}

        {sendError ? (
          <div className="inline-alert composer-alert">
            <span>{sendError}</span>
            {!chatReady ? <button className="text-button" onClick={() => openAdvanced('setup')}>{copy.chat.openSetup}</button> : null}
            {chatReady && !hasReadyProvider ? <button className="text-button" onClick={() => openAdvanced('keys')}>{copy.chat.addApiKey}</button> : null}
          </div>
        ) : null}

        {chatReady && !hasReadyProvider ? <KeySetupNudge onOpen={() => openAdvanced('keys')} onSaved={connectSavedProvider} copy={copy} /> : null}

        <form className="composer" onSubmit={sendMessage}>
          <button className="icon-button" type="button" aria-label={copy.chat.openSourcesAria} onClick={() => setSourcesOpen(true)}>
            <Paperclip size={17} />
          </button>
          <textarea
            className="composer-input"
            ref={composerInputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={copy.chat.messageAria}
            placeholder={chatReady ? copy.chat.placeholderReady : copy.chat.placeholderNotReady}
            rows={1}
            disabled={!chatReady || sending}
          />
          <button className="send-button" type="submit" disabled={!chatReady || sending || !draft.trim()}>
            <Send size={16} />
            {sending ? copy.common.sending : copy.common.send}
          </button>
        </form>
      </section>

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
  )
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
    <main className="onboarding-shell">
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
  serviceError,
  onFinished,
}: {
  initialState: OnboardingState
  serviceError: string
  onFinished: (state: OnboardingState) => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<OnboardingDraft>(() => draftFromOnboarding(initialState))
  const [busy, setBusy] = useState(false)
  const [pickingWorkspace, setPickingWorkspace] = useState(false)
  const [error, setError] = useState('')
  const step = onboardingSteps[stepIndex] ?? onboardingSteps[0]
  const copy = getUiCopy(draft.language)
  const stepCopy = copy.onboarding.steps[step.id]
  const StepIcon = step.icon
  const isLastStep = stepIndex === onboardingSteps.length - 1
  const progress = `${((stepIndex + 1) / onboardingSteps.length) * 100}%`

  function updateDraft(patch: Partial<OnboardingDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function updateProvider(patch: Partial<ProviderForm>) {
    setDraft((current) => ({ ...current, provider: { ...current.provider, ...patch } }))
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
      if (isLastStep) {
        onFinished(await completeOnboardingState(input))
      } else {
        await updateOnboardingState(input)
        setStepIndex((current) => Math.min(current + 1, onboardingSteps.length - 1))
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
    <main className={`onboarding-shell onboarding-theme-${draft.theme}`}>
      <header className="onboarding-brand">
        <div className="brand-mark">H</div>
        <div>
          <strong>Hermes</strong>
          <span>{copy.common.brandSubtitle}</span>
        </div>
      </header>

      <section className="onboarding-card">
        <aside className="onboarding-steps" aria-label={copy.onboarding.stepsAria}>
          {onboardingSteps.map((item, index) => {
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
              <span>{copy.onboarding.stepProgress(stepIndex + 1, onboardingSteps.length)}</span>
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
    displayName: initialPreset.displayName,
    baseUrl: initialPreset.baseUrl,
    defaultModel: initialPreset.defaultModel,
    apiKey: '',
  })

  function selectPreset(presetId: ProviderPresetId) {
    const preset = providerPresets.find((item) => item.id === presetId) ?? initialPreset
    setSelectedPreset(preset.id)
    setForm((current) => ({
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
    <div className="advanced-backdrop" role="dialog" aria-modal="true">
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
              <DiagnosticsPanel runtime={runtime} sessions={sessions} materials={materials} providers={providers} agents={agents} usage={usage} analytics={analytics} copy={copy} />
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
    theme: onboardingState.theme ?? 'warm',
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
      theme: onboardingState.theme ?? 'warm',
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
  providers,
  agents,
  usage,
  analytics,
  copy,
}: {
  runtime: RuntimeStatus
  sessions: ChatSession[]
  materials: Material[]
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
