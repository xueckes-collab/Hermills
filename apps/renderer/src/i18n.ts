export type UiLanguage = 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'en'
export type AdvancedPanelId = 'setup' | 'personalize' | 'company' | 'agents' | 'profiles' | 'keys' | 'diagnostics'
export type OnboardingStepId = 'language' | 'identity' | 'provider' | 'theme' | 'workspace' | 'features'
export type OnboardingThemeId = 'warm' | 'night' | 'plain' | 'system'
export type OnboardingFeatureId = 'chat' | 'files' | 'memory' | 'assistants' | 'diagnostics'
export type RuntimeStepId = 'not-installed' | 'ready' | 'failed' | 'needs-user-action' | 'checking' | 'downloading' | 'installing' | 'configuring' | 'starting' | 'verifying'
export type ProviderStatusId = 'connected' | 'missing' | 'invalid'
export type UiModeId = 'simple' | 'expert'
export type ChatEmptyEntryId = 'quickChat' | 'companyKnowledge' | 'addFiles' | 'createAssistant'
export type FileActionId = 'summarize' | 'keyPoints' | 'askFile' | 'actionPlan'
export type AssistantRoleCardId = 'study' | 'writing' | 'code' | 'files'
export type NormalSettingsSectionId = 'general' | 'appearance' | 'workspace' | 'assistants'
export type ExpertSettingsSectionId = 'providers' | 'runtime' | 'privacy' | 'diagnostics'
export type FriendlyErrorId = 'runtimeUnavailable' | 'providerMissing' | 'apiKeyInvalid' | 'messageFailed' | 'fileUploadFailed' | 'fileTooLarge' | 'assistantCreateFailed' | 'unknown'

export type UiCopy = {
  common: {
    brandSubtitle: string
    back: string
    continue: string
    save: string
    saving: string
    saved: string
    create: string
    creating: string
    edit: string
    new: string
    add: string
    use: string
    chat: string
    files: string
    assistants: string
    settings: string
    update: string
    details: string
    hideDetails: string
    openSettings: string
    setup: string
    search: string
    send: string
    sending: string
    ready: string
    unknown: string
    notChecked: string
    localHermes: string
    companyKnowledge: string
    companyMaterials: string
    apiKey: string
    provider: string
    providerName: string
    baseUrl: string
    defaultModel: string
    model: string
  }
  advanced: {
    eyebrow: string
    title: string
    closeAria: string
    navAria: string
    tabs: Record<AdvancedPanelId, string>
  }
  onboarding: {
    loadingEyebrow: string
    loadingTitle: string
    loadingDescription: string
    stepsAria: string
    stepProgress: (current: number, total: number) => string
    steps: Record<OnboardingStepId, { label: string; title: string; description: string }>
    languageDetails: Record<UiLanguage, string>
    identity: {
      userName: string
      agentName: string
      memoryTitle: string
      memoryDescription: string
    }
    provider: {
      skip: string
      skipDetail: string
      setupLater: string
    }
    themeOptions: Record<OnboardingThemeId, { label: string; detail: string }>
    workspace: {
      path: string
      chooseFolder: string
      choosingFolder: string
    }
    features: Record<OnboardingFeatureId, { label: string; detail: string }>
    validation: {
      missingNames: string
      missingProvider: string
      missingWorkspace: string
      missingFeature: string
      noDirectoryPicker: string
    }
    startChatting: string
  }
  firstRun: {
    setupEyebrow: string
    checkingTitle: string
    checkingDescription: string
    oneTimeSetup: string
    packageCheckFallback: string
  }
  topbar: {
    chats: string
    assistants: string
    files: string
    settingsAria: string
    serviceWarning: (message: string) => string
  }
  mode: {
    label: string
    ariaLabel: string
    options: Record<UiModeId, { label: string; description: string; switchLabel: string; currentLabel: string }>
  }
  chat: {
    sectionLabel: string
    defaultTitle: string
    defaultAssistant: string
    addFile: string
    addCompanyMaterial: string
    openCompanyKnowledgeAria: string
    selectedCompanyMaterials: (count: number) => string
    selectedFiles: (count: number) => string
    you: string
    emptyTitle: string
    emptyDescription: string
    openSetup: string
    addApiKey: string
    openSourcesAria: string
    messageAria: string
    placeholderReady: string
    placeholderNotReady: string
    startBeforeSend: string
    newConversation: string
    newAssistantConversation: (name: string) => string
    emptyActions: Record<ChatEmptyEntryId, { title: string; description: string; action: string; prompt: string }>
  }
  session: {
    count: (count: number) => string
    newSessionAria: string
    closeAria: string
    searchAria: string
    searchPlaceholder: string
    titleAria: string
    saveTitleAria: string
    renameAria: (title: string) => string
    deleteAria: (title: string) => string
    messages: (count: number) => string
    noMatch: string
    tryAnother: string
    newConversation: string
    startWithHermes: string
  }
  files: {
    title: string
    attachLocalFiles: string
    attached: (count: number) => string
    closeAria: string
    addFiles: string
    uploading: string
    supportedTypes: string
    preview: string
    closePreviewAria: string
    noPreview: string
    fileNameAria: string
    saveFileNameAria: string
    previewAria: (name: string) => string
    downloadAria: (name: string) => string
    copyAria: (name: string) => string
    renameAria: (name: string) => string
    deleteAria: (name: string) => string
    empty: string
    actions: Record<FileActionId, { label: string; description: string; prompt: string }>
    status: {
      ready: string
      needsRetry: string
      gettingReady: string
      added: string
    }
  }
  companyKnowledge: {
    eyebrow: string
    title: string
    subtitle: string
    profileTitle: string
    materialsTitle: string
    addFiles: string
    uploading: string
    supportedTypes: string
    empty: string
    noPreview: string
    categoryForNewFiles: string
    fields: {
      name: string
      website: string
      markets: string
      mainProducts: string
      certifications: string
      paymentTerms: string
      shippingTerms: string
      brandVoice: string
      notes: string
    }
    categories: Record<import('./api.js').CompanyMaterialCategory, string>
  }
  keyNudge: {
    pasteOneKey: string
    pasteKeyFirst: string
    saving: string
    savedCanSend: string
    save: string
  }
  gateway: {
    restartTitle: string
    notReadyTitle: string
    startHermes: string
    tryAgain: string
    details: string
    setup: string
    starting: string
    failed: string
    notInstalled: string
    paused: string
  }
  runtime: {
    setupTitle: string
    updateTitle: string
    status: {
      setupNeeded: string
      ready: string
      starting: string
      restart: string
      paused: string
    }
    action: {
      settingUp: string
      setUp: string
      needsSetup: string
      updating: string
      update: string
      current: string
    }
    title: {
      setupRetry: string
      settingUp: string
      setupOnce: string
      hasUpdate: string
      ready: string
      needsRepair: string
      installed: string
    }
    description: {
      checking: string
      updateAvailable: string
      unknown: string
      current: string
    }
    summary: {
      checking: string
      ready: string
      updateFound: string
      couldNotFinish: string
      current: string
    }
    meta: {
      installed: string
      latest: string
      lastCheck: string
      localChat: string
      ready: string
      notStarted: string
      unknown: string
    }
    buttons: {
      checkUpdates: string
      checking: string
      startHermes: string
      copyReport: string
      repairOptions: string
      repairInstall: string
    }
    repair: {
      title: string
      description: string
    }
    steps: Record<RuntimeStepId, string>
    waiting: string
    detail: (installed: string, latest: string) => string
    runningUpdateCheck: string
    installMessages: {
      checkingUpdate: string
      checkingSetup: string
      updateFailed: string
      setupFailed: string
    }
  }
  personalization: {
    eyebrow: string
    title: string
    language: string
    theme: string
    userName: string
    agentName: string
    memoryOn: string
    workspacePath: string
    chooseFolder: string
    runSetupAgain: string
    missingAgentName: string
    noDirectoryPicker: string
  }
  assistant: {
    drawerTitle: string
    drawerSubtitle: string
    closeAria: string
    sectionEyebrow: string
    createTitle: string
    editTitle: string
    new: string
    create: string
    saveChanges: string
    saving: string
    name: string
    helpWith: string
    behavior: string
    starters: string
    useFiles: string
    rememberContext: string
    useTools: string
    modelOptions: string
    provider: string
    localHermes: string
    savedAgents: string
    ready: string
    noAssistants: string
    use: string
    chat: string
    copyAria: (name: string) => string
    deleteAria: (name: string) => string
    deleteConfirm: (name: string) => string
    copyName: (name: string) => string
    validation: string
    quickCreate: {
      title: string
      description: string
      action: string
      creating: string
      created: string
    }
    roleCards: Record<AssistantRoleCardId, { title: string; description: string; action: string; defaultName: string; defaultInstructions: string; starter: string }>
    templates: Array<{ id: string; label: string; description: string; form: { name: string; description: string; instructions: string; starters: string; tools?: boolean; files?: boolean } }>
    defaultForm: { name: string; description: string; instructions: string; starters: string }
  }
  profile: {
    eyebrow: string
    title: string
    newNamePlaceholder: string
    newNameAria: string
    add: string
    profileNameAria: string
    saveProfileAria: string
    activeNow: string
    clickToUse: string
    renameAria: (name: string) => string
    deleteAria: (name: string) => string
    rulesTitle: string
    keepChatsLocal: string
    keepFilesLocal: string
    shareWithTeam: string
  }
  keys: {
    readySummary: (providers: number, agents: number) => string
    title: string
    saveKey: string
    advancedDetails: string
    hideDetails: string
    savedHelp: string
    noModels: string
    noKeySaved: string
    noProviders: string
    test: string
    models: string
    defaults: string
    maskKeys: string
    confirmDestructiveTools: string
    allowExternalTools: string
    form: {
      pasteKeyFirst: string
      saving: string
      saved: string
      testing: string
      connected: string
      checkingModels: string
    }
  }
  diagnostics: {
    runtime: string
    conversations: string
    sources: string
    companyKnowledge: string
    keys: string
    agents: string
    tokens: string
    storage: string
    jobs: string
    channels: string
    logs: string
    localChatHistory: string
    uploadedLocalContext: string
    uploadedCompanyContext: string
    storedProviderEntries: string
    savedInstructionProfiles: string
    tokenDetail: (input: string, output: string) => string
    localFiles: (count: number) => string
    companyMaterials: (count: number) => string
    jobDetail: (runs: number, failed: number) => string
    channelDetail: (count: number) => string
    logDetail: (count: number) => string
  }
  settings: {
    normal: {
      title: string
      description: string
      sections: Record<NormalSettingsSectionId, { title: string; description: string }>
    }
    expert: {
      title: string
      description: string
      warning: string
      sections: Record<ExpertSettingsSectionId, { title: string; description: string }>
    }
  }
  errors: {
    title: string
    retry: string
    copyDetails: string
    openSettings: string
    withDetail: (message: string) => string
    friendly: Record<FriendlyErrorId, { title: string; message: string; recovery: string }>
  }
  format: {
    usage: (input: string, output: string, total: string) => string
  }
  providerStatus: Record<ProviderStatusId, string>
}

const en: UiCopy = {
  common: {
    brandSubtitle: 'Local AI companion',
    back: 'Back',
    continue: 'Continue',
    save: 'Save',
    saving: 'Saving',
    saved: 'Saved',
    create: 'Create',
    creating: 'Creating',
    edit: 'Edit',
    new: 'New',
    add: 'Add',
    use: 'Use',
    chat: 'Chat',
    files: 'Files',
    assistants: 'Assistants',
    settings: 'Settings',
    update: 'Update',
    details: 'Details',
    hideDetails: 'Hide details',
    openSettings: 'Open settings',
    setup: 'Setup',
    search: 'Search',
    send: 'Send',
    sending: 'Sending',
    ready: 'ready',
    unknown: 'Unknown',
    notChecked: 'Not checked',
    localHermes: 'Local Hermes',
    companyKnowledge: 'Company knowledge base',
    companyMaterials: 'Company docs',
    apiKey: 'API key',
    provider: 'Provider',
    providerName: 'Provider name',
    baseUrl: 'Base URL',
    defaultModel: 'Default model',
    model: 'Model',
  },
  advanced: {
    eyebrow: 'Advanced',
    title: 'Hermes settings',
    closeAria: 'Close advanced settings',
    navAria: 'Advanced settings',
    tabs: { setup: 'Hermes', personalize: 'Personalize', company: 'Company docs', agents: 'Assistants', profiles: 'Profiles', keys: 'Keys', diagnostics: 'Diagnostics' },
  },
  onboarding: {
    loadingEyebrow: 'First run',
    loadingTitle: 'Preparing your workspace.',
    loadingDescription: 'Hermes will open the setup guide once local deployment is ready.',
    stepsAria: 'Onboarding steps',
    stepProgress: (current, total) => `Step ${current} of ${total}`,
    steps: {
      language: { label: 'Language', title: 'Choose your language.', description: 'Hermes will use this for the first workspace experience.' },
      identity: { label: 'Identity', title: 'Name this workspace.', description: 'Set the names Hermes should use in chat and decide whether memory starts on.' },
      provider: { label: 'Provider', title: 'Connect a model provider.', description: 'Add an OpenAI-compatible provider now, or skip and finish this later.' },
      theme: { label: 'Theme', title: 'Pick a simple theme.', description: 'Choose the surface tone for this local workspace.' },
      workspace: { label: 'Path', title: 'Choose a work path.', description: 'Hermes stores local workspace material in this directory.' },
      features: { label: 'Features', title: 'Turn on the basics.', description: 'Select what should be visible when chat opens.' },
    },
    languageDetails: {
      'zh-CN': 'Use Simplified Chinese for the first experience.',
      'zh-TW': 'Use Traditional Chinese for the first experience.',
      ja: 'Use Japanese for the first experience.',
      ko: 'Use Korean for the first experience.',
      en: 'Use English for Hermills and Hermes.',
    },
    identity: { userName: 'Your name', agentName: 'Agent name', memoryTitle: 'Start with memory on', memoryDescription: 'Hermes can remember selected preferences for this workspace.' },
    provider: { skip: 'Skip', skipDetail: 'Set this up later', setupLater: 'You can open Settings later and add a provider before sending model-backed messages.' },
    themeOptions: {
      warm: { label: 'Warm paper', detail: 'Soft paper surface with blue-green accents.' },
      night: { label: 'Blue night', detail: 'Low-light dark mode for night work.' },
      plain: { label: 'Plain white', detail: 'High contrast, simple and clean.' },
      system: { label: 'Automatic', detail: 'Follow this Mac system appearance.' },
    },
    workspace: { path: 'Workspace path', chooseFolder: 'Choose folder', choosingFolder: 'Choosing...' },
    features: {
      chat: { label: 'Chat', detail: 'Open directly into the local chat workspace.' },
      files: { label: 'Files', detail: 'Attach files and use them as local context.' },
      memory: { label: 'Memory', detail: 'Let Hermes remember selected preferences.' },
      assistants: { label: 'Assistants', detail: 'Create task-specific agents later.' },
      diagnostics: { label: 'Diagnostics', detail: 'Keep runtime health checks visible.' },
    },
    validation: {
      missingNames: 'Add both names before continuing.',
      missingProvider: 'Provider name, base URL, and default model are required.',
      missingWorkspace: 'Choose or type a workspace path.',
      missingFeature: 'Select at least one feature.',
      noDirectoryPicker: 'Directory picker is not available in this build. Type a path instead.',
    },
    startChatting: 'Start chatting',
  },
  firstRun: {
    setupEyebrow: 'Hermes setup',
    checkingTitle: 'Getting Hermes ready.',
    checkingDescription: 'This only happens once. Chat opens when Hermes is ready.',
    oneTimeSetup: 'Set up Hermes',
    packageCheckFallback: 'Hermes will handle the local setup for you.',
  },
  topbar: {
    chats: 'Chats',
    assistants: 'Assistants',
    files: 'Files',
    settingsAria: 'Advanced settings',
    serviceWarning: (message) => `Local service warning: ${message}`,
  },
  mode: {
    label: 'Mode',
    ariaLabel: 'Choose interface mode',
    options: {
      simple: { label: 'Simple', description: 'Show the everyday chat, files, assistants, and basic settings.', switchLabel: 'Use simple mode', currentLabel: 'Simple mode on' },
      expert: { label: 'Expert', description: 'Show provider, runtime, privacy, and diagnostic controls.', switchLabel: 'Use expert mode', currentLabel: 'Expert mode on' },
    },
  },
  chat: {
    sectionLabel: 'Chat',
    defaultTitle: 'Ask Hermes',
    defaultAssistant: 'Default assistant',
    addFile: 'Add file',
    addCompanyMaterial: 'Add company docs',
    openCompanyKnowledgeAria: 'Open company knowledge base',
    selectedFiles: (count) => `${count} file${count === 1 ? '' : 's'}`,
    selectedCompanyMaterials: (count) => `${count} company doc${count === 1 ? '' : 's'}`,
    you: 'You',
    emptyTitle: 'Ask Hermes anything on this Mac.',
    emptyDescription: 'Attach files when you want answers grounded in local context.',
    openSetup: 'Open setup',
    addApiKey: 'Add API key',
    openSourcesAria: 'Open sources',
    messageAria: 'Message',
    placeholderReady: 'Ask Hermes...',
    placeholderNotReady: 'Start Hermes first',
    startBeforeSend: 'Start Hermes before sending a message.',
    newConversation: 'New Hermes conversation',
    newAssistantConversation: (name) => `${name} chat`,
    emptyActions: {
      quickChat: { title: 'Ask a question', description: 'Start a normal chat and let Hermes answer from this Mac.', action: 'Start chat', prompt: 'Help me think through this.' },
      companyKnowledge: { title: 'Add company docs', description: 'Teach Hermes your products, terms, customers, and export rules.', action: 'Open company docs', prompt: 'Use our company knowledge to answer this.' },
      addFiles: { title: 'Chat with files', description: 'Add local files so answers can use your own context.', action: 'Add files', prompt: 'Summarize the files I added.' },
      createAssistant: { title: 'Create an assistant', description: 'Make a reusable helper for a task you do often.', action: 'Create assistant', prompt: 'Create an assistant for this workflow.' },
    },
  },
  session: {
    count: (count) => `${count} Conversations`,
    newSessionAria: 'New session',
    closeAria: 'Close conversations',
    searchAria: 'Search conversations',
    searchPlaceholder: 'Search',
    titleAria: 'Conversation title',
    saveTitleAria: 'Save title',
    renameAria: (title) => `Rename ${title}`,
    deleteAria: (title) => `Delete ${title}`,
    messages: (count) => `${count} messages`,
    noMatch: 'No matching chat',
    tryAnother: 'Try another word',
    newConversation: 'New conversation',
    startWithHermes: 'Start with Hermes',
  },
  files: {
    title: 'Files',
    attachLocalFiles: 'Attach local files',
    attached: (count) => `${count} attached`,
    closeAria: 'Close sources',
    addFiles: 'Add files',
    uploading: 'Uploading...',
    supportedTypes: 'PDF, docs, notes, code, images',
    preview: 'Preview',
    closePreviewAria: 'Close preview',
    noPreview: 'No readable text preview yet.',
    fileNameAria: 'File name',
    saveFileNameAria: 'Save file name',
    previewAria: (name) => `Preview ${name}`,
    downloadAria: (name) => `Download ${name}`,
    copyAria: (name) => `Copy ${name}`,
    renameAria: (name) => `Rename ${name}`,
    deleteAria: (name) => `Delete ${name}`,
    empty: 'No files yet. Add a file to keep answers grounded.',
    actions: {
      summarize: { label: 'Summarize', description: 'Turn the selected file into a short overview.', prompt: 'Summarize this file in plain language.' },
      keyPoints: { label: 'Find key points', description: 'Pull out the important facts, decisions, and risks.', prompt: 'Find the key points in this file.' },
      askFile: { label: 'Ask about this file', description: 'Ask a focused question about the selected file.', prompt: 'Answer my question using this file first.' },
      actionPlan: { label: 'Action plan', description: 'Convert the file into next steps and owners.', prompt: 'Turn this file into a practical action plan.' },
    },
    status: { ready: 'ready', needsRetry: 'needs retry', gettingReady: 'getting ready', added: 'added' },
  },
  companyKnowledge: {
    eyebrow: 'Company AI',
    title: 'Company knowledge base',
    subtitle: 'Manage company docs Hermes can cite in answers.',
    profileTitle: 'Company profile',
    materialsTitle: 'Company docs',
    addFiles: 'Add company docs',
    uploading: 'Uploading...',
    supportedTypes: 'PDF, docs, notes, web text, images',
    empty: 'No company docs yet. Add them so Hermes can answer with company context.',
    noPreview: 'Saved. Image and binary files need a vision or extraction model before readable notes appear.',
    categoryForNewFiles: 'New file type',
    fields: {
      name: 'Company name',
      website: 'Website',
      markets: 'Target markets',
      mainProducts: 'Main products',
      certifications: 'Certifications',
      paymentTerms: 'Payment terms',
      shippingTerms: 'Shipping terms',
      brandVoice: 'Brand voice',
      notes: 'Important notes',
    },
    categories: {
      'company-profile': 'Company profile',
      'product-catalog': 'Product catalog',
      'price-list': 'Price list',
      certification: 'Certification',
      'shipping-logistics': 'Shipping and logistics',
      'payment-terms': 'Payment terms',
      faq: 'FAQ',
      'case-study': 'Case study',
      other: 'Other',
    },
  },
  keyNudge: { pasteOneKey: 'Paste one API key. New chats will use it automatically.', pasteKeyFirst: 'Paste an API key first.', saving: 'Saving...', savedCanSend: 'Saved. You can send now.', save: 'Save' },
  gateway: {
    restartTitle: 'Hermes needs a restart.',
    notReadyTitle: 'Hermes is not ready yet.',
    startHermes: 'Start Hermes',
    tryAgain: 'Try again',
    details: 'Details',
    setup: 'Setup',
    starting: 'Hermes is starting. This usually takes a moment.',
    failed: 'Try again. If it still fails, open setup for more options.',
    notInstalled: 'Set up Hermes to enable private local chat.',
    paused: 'Start Hermes to send messages.',
  },
  runtime: {
    setupTitle: 'Hermes setup',
    updateTitle: 'Hermes setup',
    status: { setupNeeded: 'Setup needed', ready: 'Ready', starting: 'Starting Hermes', restart: 'Hermes needs a restart', paused: 'Hermes is paused' },
    action: { settingUp: 'Setting up Hermes...', setUp: 'Set up Hermes', needsSetup: 'Hermes needs setup', updating: 'Updating Hermes...', update: 'Update Hermes', current: 'Hermes is up to date' },
    title: { setupRetry: 'Setup needs a retry.', settingUp: 'Setting up Hermes.', setupOnce: 'Set up Hermes once on this Mac.', hasUpdate: 'Hermes has an update.', ready: 'Hermes is ready.', needsRepair: 'Hermes needs repair.', installed: 'Hermes is installed.' },
    description: { checking: 'Checking the official Hermes source for updates.', updateAvailable: 'A newer official Hermes release is available. Update when you are ready.', unknown: 'Hermills could not check the official source. Chat can keep using the local Hermes install.', current: 'Hermills checks the official Hermes source and only shows an update button when a new version exists.' },
    summary: { checking: 'Checking official Hermes updates', ready: 'Update check is ready', updateFound: 'New Hermes version found', couldNotFinish: 'Update check could not finish', current: 'Hermes is up to date' },
    meta: { installed: 'Installed', latest: 'Latest', lastCheck: 'Last check', localChat: 'Local chat', ready: 'ready', notStarted: 'not started', unknown: 'Unknown' },
    buttons: { checkUpdates: 'Check updates', checking: 'Checking...', startHermes: 'Start Hermes', copyReport: 'Copy report', repairOptions: 'Repair options', repairInstall: 'Repair install' },
    repair: { title: 'Repair local Hermes', description: 'Use this only when the local install is broken. Normal updates appear above.' },
    steps: { 'not-installed': 'Waiting to start', ready: 'Ready', failed: 'Needs retry', 'needs-user-action': 'Needs attention', checking: 'Check setup package', downloading: 'Download installer', installing: 'Install Hermes', configuring: 'Prepare local chat', starting: 'Start Hermes', verifying: 'Check chat is ready' },
    waiting: 'Waiting',
    detail: (installed, latest) => `Local ${installed}. Official ${latest}.`,
    runningUpdateCheck: 'Checking for a Hermes update...',
    installMessages: { checkingUpdate: 'Checking for a Hermes update...', checkingSetup: 'Checking Hermes setup...', updateFailed: 'Update failed. Hermes can keep using the current version.', setupFailed: 'Setup failed. Copy the report and retry.' },
  },
  personalization: {
    eyebrow: 'Personal setup',
    title: 'Language and style',
    language: 'Language',
    theme: 'Theme',
    userName: 'Your name',
    agentName: 'Agent name',
    memoryOn: 'Memory on',
    workspacePath: 'Workspace path',
    chooseFolder: 'Choose folder',
    runSetupAgain: 'Run setup again',
    missingAgentName: 'Add an agent name before saving.',
    noDirectoryPicker: 'Directory picker is not available in this build. Type a path instead.',
  },
  assistant: {
    drawerTitle: 'Assistants',
    drawerSubtitle: 'Make Hermes yours',
    closeAria: 'Close assistants',
    sectionEyebrow: 'My assistants',
    createTitle: 'Create an assistant',
    editTitle: 'Edit assistant',
    new: 'New',
    create: 'Create',
    saveChanges: 'Save changes',
    saving: 'Saving',
    name: 'Name',
    helpWith: 'What should it help with?',
    behavior: 'How should it behave?',
    starters: 'Starter prompts',
    useFiles: 'Use files',
    rememberContext: 'Remember context',
    useTools: 'Use tools',
    modelOptions: 'Model options',
    provider: 'Provider',
    localHermes: 'Local Hermes',
    savedAgents: 'Saved agents',
    ready: 'ready',
    noAssistants: 'No assistants yet. Pick a template and create one.',
    use: 'Use',
    chat: 'Chat',
    copyAria: (name) => `Copy ${name}`,
    deleteAria: (name) => `Delete ${name}`,
    deleteConfirm: (name) => `Delete ${name}? Existing chats will stay, but this assistant will be removed.`,
    copyName: (name) => `${name} copy`,
    validation: 'Add a name and tell Hermes what this assistant should do.',
    quickCreate: {
      title: 'One-click assistant',
      description: 'Pick a role and Hermes will create a ready-to-use assistant.',
      action: 'Create with one click',
      creating: 'Creating assistant...',
      created: 'Assistant created. You can start chatting now.',
    },
    roleCards: {
      study: { title: 'Study helper', description: 'Explains notes, lessons, and hard topics step by step.', action: 'Create study helper', defaultName: 'Study Helper', defaultInstructions: 'Explain clearly, break work into small steps, and check understanding with one useful question.', starter: 'Explain this simply' },
      writing: { title: 'Writing helper', description: 'Drafts, rewrites, summarizes, and polishes text.', action: 'Create writing helper', defaultName: 'Writing Helper', defaultInstructions: 'Keep the user voice, remove fluff, and make writing clear before explaining changes.', starter: 'Rewrite this more clearly' },
      code: { title: 'Code helper', description: 'Reads code, finds bugs, and suggests practical fixes.', action: 'Create code helper', defaultName: 'Code Helper', defaultInstructions: 'Read the context first, identify the real issue, and give concrete code-level guidance.', starter: 'Find the bug here' },
      files: { title: 'File analyst', description: 'Answers from uploaded files and turns them into plans.', action: 'Create file analyst', defaultName: 'File Analyst', defaultInstructions: 'Use attached files first, separate facts from guesses, and end with the next useful action.', starter: 'Summarize these files' },
    },
    defaultForm: {
      name: 'Research Partner',
      description: 'Uses local Hermes Agent tools, memory, skills, and uploaded context.',
      instructions: 'Use the attached materials first. Explain uncertainty and recommend the next action.',
      starters: 'Summarize this file\nMake a simple action plan',
    },
    templates: [
      { id: 'study', label: 'Study helper', description: 'Explains hard things in plain steps.', form: { name: 'Study Helper', description: 'Explains lessons, notes, and hard topics in simple steps.', instructions: 'Teach like a patient tutor. Break answers into small steps, check assumptions, and give one practice question when helpful.', starters: 'Explain this simply\nQuiz me on this topic' } },
      { id: 'writing', label: 'Writing helper', description: 'Drafts, rewrites, and polishes text.', form: { name: 'Writing Helper', description: 'Helps draft, rewrite, summarize, and polish writing.', instructions: 'Help write clearly. Keep the user voice, remove fluff, and offer a tighter version before explaining changes.', starters: 'Rewrite this more clearly\nMake this shorter' } },
      { id: 'code', label: 'Code helper', description: 'Reads code and explains fixes.', form: { name: 'Code Helper', description: 'Explains code, finds bugs, and suggests practical fixes.', instructions: 'Act as a pragmatic software engineer. Read the context first, identify the real issue, and give concrete code-level guidance.', starters: 'Find the bug here\nExplain this code', tools: true } },
      { id: 'files', label: 'File analyst', description: 'Answers from uploaded files.', form: { name: 'File Analyst', description: 'Reads uploaded files and turns them into answers, summaries, and plans.', instructions: 'Use attached files first. Quote file names when relevant, separate facts from guesses, and end with the next useful action.', starters: 'Summarize these files\nFind the important points', files: true } },
    ],
  },
  profile: {
    eyebrow: 'Separate local workspaces',
    title: 'User profiles',
    newNamePlaceholder: 'New profile name',
    newNameAria: 'New profile name',
    add: 'Add',
    profileNameAria: 'Profile name',
    saveProfileAria: 'Save profile',
    activeNow: 'Active now',
    clickToUse: 'Click to use',
    renameAria: (name) => `Rename ${name}`,
    deleteAria: (name) => `Delete ${name}`,
    rulesTitle: 'Local profile rules',
    keepChatsLocal: 'Keep chats local',
    keepFilesLocal: 'Keep files local',
    shareWithTeam: 'Share profile with team',
  },
  keys: {
    readySummary: (providers, agents) => `${providers} connected for ${agents} agents`,
    title: 'API key',
    saveKey: 'Save key',
    advancedDetails: 'Advanced details',
    hideDetails: 'Hide details',
    savedHelp: 'Saved keys are encrypted locally. The first saved provider is used automatically for new chats.',
    noModels: 'No models synced',
    noKeySaved: 'No key saved',
    noProviders: 'No provider keys saved.',
    test: 'Test',
    models: 'Models',
    defaults: 'Defaults',
    maskKeys: 'Mask keys',
    confirmDestructiveTools: 'Confirm destructive tools',
    allowExternalTools: 'Allow external tools',
    form: { pasteKeyFirst: 'Paste an API key first.', saving: 'Saving key...', saved: 'Saved. New chats will use this key.', testing: 'Testing...', connected: 'Connected', checkingModels: 'Checking models...' },
  },
  diagnostics: {
    runtime: 'Runtime',
    conversations: 'Conversations',
    sources: 'Sources',
    companyKnowledge: 'Company knowledge',
    keys: 'Keys',
    agents: 'Agents',
    tokens: 'Tokens',
    storage: 'Storage',
    jobs: 'Jobs',
    channels: 'Channels',
    logs: 'Logs',
    localChatHistory: 'Local chat history',
    uploadedLocalContext: 'Uploaded local context',
    uploadedCompanyContext: 'Uploaded company context',
    storedProviderEntries: 'Stored provider entries',
    savedInstructionProfiles: 'Saved instruction profiles',
    tokenDetail: (input, output) => `${input} in / ${output} out`,
    localFiles: (count) => `${count} local files`,
    companyMaterials: (count) => `${count} company doc${count === 1 ? '' : 's'}`,
    jobDetail: (runs, failed) => `${runs} runs / ${failed} failed`,
    channelDetail: (count) => `${count} configured`,
    logDetail: (count) => `${count} errors`,
  },
  settings: {
    normal: {
      title: 'Settings',
      description: 'Keep the everyday controls easy to scan.',
      sections: {
        general: { title: 'General', description: 'Name, language, and basic workspace behavior.' },
        appearance: { title: 'Appearance', description: 'Theme and display preferences.' },
        workspace: { title: 'Workspace', description: 'Local folder and file defaults.' },
        assistants: { title: 'Assistants', description: 'Default assistant and quick creation options.' },
      },
    },
    expert: {
      title: 'Expert settings',
      description: 'Controls for local runtime, providers, privacy, and diagnostics.',
      warning: 'Changing these can affect startup, model access, or local data.',
      sections: {
        providers: { title: 'Providers', description: 'API keys, base URLs, models, and connection tests.' },
        runtime: { title: 'Runtime', description: 'Local Hermes install, updates, repair, and startup state.' },
        privacy: { title: 'Privacy', description: 'Local storage, memory, files, and tool permissions.' },
        diagnostics: { title: 'Diagnostics', description: 'Health checks, logs, token usage, and troubleshooting data.' },
      },
    },
  },
  errors: {
    title: 'Something needs attention',
    retry: 'Try again',
    copyDetails: 'Copy details',
    openSettings: 'Open settings',
    withDetail: (message) => `Details: ${message}`,
    friendly: {
      runtimeUnavailable: { title: 'Hermes is not running', message: 'Local chat needs Hermes to start first.', recovery: 'Start Hermes again. If it fails, open expert settings and copy the report.' },
      providerMissing: { title: 'No model provider yet', message: 'Hermes needs a saved provider before it can use cloud models.', recovery: 'Add an API key in settings, or use local Hermes if it is ready.' },
      apiKeyInvalid: { title: 'The API key did not work', message: 'The provider rejected this key or the base URL is wrong.', recovery: 'Check the key, base URL, and default model, then test again.' },
      messageFailed: { title: 'Message was not sent', message: 'Hermes could not finish this request.', recovery: 'Retry once. If it keeps failing, copy the details for diagnostics.' },
      fileUploadFailed: { title: 'File was not added', message: 'Hermes could not read or store this file.', recovery: 'Try another file or move it to a local folder first.' },
      fileTooLarge: { title: 'File is too large', message: 'This file is bigger than Hermes can process right now.', recovery: 'Split it into smaller files and add the part you need.' },
      assistantCreateFailed: { title: 'Assistant was not created', message: 'Hermes could not save this assistant.', recovery: 'Check the name and instructions, then try again.' },
      unknown: { title: 'Unexpected problem', message: 'Hermes hit something it did not understand.', recovery: 'Try again, or copy the details if it keeps happening.' },
    },
  },
  format: { usage: (input, output, total) => `~${input} in / ${output} out / ${total} tokens` },
  providerStatus: { connected: 'connected', missing: 'missing', invalid: 'invalid' },
}

const zhCN = withOverrides(en, {
  common: {
    brandSubtitle: '本地 AI 伙伴', back: '上一步', continue: '继续', save: '保存', saving: '保存中', saved: '已保存', create: '创建', creating: '创建中', edit: '编辑', new: '新建', add: '添加', use: '使用', chat: '聊天', files: '文件', assistants: '助手', settings: '设置', update: '更新', details: '详情', hideDetails: '收起详情', openSettings: '打开设置', setup: '设置', search: '搜索', send: '发送', sending: '发送中', ready: '就绪', unknown: '未知', notChecked: '尚未检查', localHermes: '本地 Hermes', companyKnowledge: '公司知识库', companyMaterials: '公司资料', apiKey: 'API Key', provider: '供应商', providerName: '供应商名称', baseUrl: 'Base URL', defaultModel: '默认模型', model: '模型',
  },
  advanced: { eyebrow: '高级', title: 'Hermes 设置', closeAria: '关闭高级设置', navAria: '高级设置', tabs: { setup: 'Hermes', personalize: '个性化', company: '公司资料', agents: '助手', profiles: '用户', keys: '密钥', diagnostics: '诊断' } },
  onboarding: {
    loadingEyebrow: '首次使用', loadingTitle: '正在准备你的工作区。', loadingDescription: '本地部署准备好后，Hermes 会打开设置向导。', stepsAria: '首次设置步骤', stepProgress: (current, total) => `第 ${current} 步，共 ${total} 步`,
    steps: {
      language: { label: '语言', title: '选择语言。', description: 'Hermes 会用这个语言完成首次设置。' },
      identity: { label: '名字', title: '给工作区起个名字。', description: '设置 Hermes 在聊天里怎么称呼你，并决定是否开启记忆。' },
      provider: { label: '模型', title: '连接模型供应商。', description: '现在添加一个兼容 OpenAI 的供应商，或者先跳过。' },
      theme: { label: '主题', title: '选择一个简单主题。', description: '选择这个本地工作区的界面风格。' },
      workspace: { label: '路径', title: '选择工作路径。', description: 'Hermes 会把本地材料放在这个目录里。' },
      features: { label: '功能', title: '打开基础功能。', description: '选择进入聊天后要显示哪些工具。' },
    },
    languageDetails: { 'zh-CN': '用简体中文开始。', 'zh-TW': '用繁體中文開始。', ja: '日本語で開始します。', ko: '한국어로 시작합니다.', en: 'Use English for Hermills and Hermes.' },
    identity: { userName: '你的名字', agentName: '助手名字', memoryTitle: '一开始就开启记忆', memoryDescription: 'Hermes 可以记住这个工作区里你选择的偏好。' },
    provider: { skip: '跳过', skipDetail: '之后再设置', setupLater: '之后可以在设置里添加供应商，再发送需要模型回答的消息。' },
    themeOptions: { warm: { label: '暖纸', detail: '柔和纸面和蓝绿色重点。' }, night: { label: '青夜', detail: '低亮度深色，适合夜间工作。' }, plain: { label: '素白', detail: '高对比，简单清爽。' }, system: { label: '自动', detail: '跟随这台 Mac 的系统外观。' } },
    workspace: { path: '工作区路径', chooseFolder: '选择文件夹', choosingFolder: '选择中...' },
    features: { chat: { label: '聊天', detail: '直接进入本地聊天工作区。' }, files: { label: '文件', detail: '上传文件，作为本地上下文使用。' }, memory: { label: '记忆', detail: '让 Hermes 记住已选择的偏好。' }, assistants: { label: '助手', detail: '之后可以创建不同任务的 Agent。' }, diagnostics: { label: '诊断', detail: '保留运行状态和健康检查。' } },
    validation: { missingNames: '请先填写两个名字。', missingProvider: '需要供应商名称、Base URL 和默认模型。', missingWorkspace: '请选择或输入工作区路径。', missingFeature: '至少选择一个功能。', noDirectoryPicker: '当前版本不能打开文件夹选择器，请直接输入路径。' },
    startChatting: '开始聊天',
  },
  firstRun: { setupEyebrow: 'Hermes 设置', checkingTitle: '正在准备 Hermes。', checkingDescription: '这里只需要做一次。准备好后会直接进入聊天。', oneTimeSetup: '设置 Hermes', packageCheckFallback: 'Hermes 会帮你完成本地设置。' },
  topbar: { chats: '对话', assistants: '助手', files: '文件', settingsAria: '高级设置', serviceWarning: (message) => `本地服务提醒：${message}` },
  mode: { label: '模式', ariaLabel: '选择界面模式', options: { simple: { label: '简单', description: '只显示日常聊天、文件、助手和基础设置。', switchLabel: '使用简单模式', currentLabel: '已开启简单模式' }, expert: { label: '专家', description: '显示供应商、运行时、隐私和诊断控制。', switchLabel: '使用专家模式', currentLabel: '已开启专家模式' } } },
  chat: { sectionLabel: '聊天', defaultTitle: '问 Hermes', defaultAssistant: '默认助手', addFile: '添加文件', addCompanyMaterial: '添加公司资料', openCompanyKnowledgeAria: '打开公司知识库', selectedFiles: (count) => `${count} 个文件`, selectedCompanyMaterials: (count) => `${count} 份公司资料`, you: '你', emptyTitle: '在这台 Mac 上问 Hermes。', emptyDescription: '需要基于本地内容回答时，可以添加文件。', openSetup: '打开设置', addApiKey: '添加 API Key', openSourcesAria: '打开文件', messageAria: '消息', placeholderReady: '问 Hermes...', placeholderNotReady: '先启动 Hermes', startBeforeSend: '请先启动 Hermes 再发送消息。', newConversation: '新的 Hermes 对话', newAssistantConversation: (name) => `${name} 对话`, emptyActions: { quickChat: { title: '直接提问', description: '开始普通对话，让 Hermes 基于这台 Mac 回答。', action: '开始聊天', prompt: '帮我梳理这件事。' }, companyKnowledge: { title: '完善公司资料', description: '把产品、价格、认证、物流和付款条款教给 Hermes。', action: '打开公司资料', prompt: '基于我们的公司资料回答这个问题。' }, addFiles: { title: '带文件聊天', description: '添加本地文件，让回答使用你的上下文。', action: '添加文件', prompt: '总结我添加的文件。' }, createAssistant: { title: '创建助手', description: '为经常做的任务做一个可复用助手。', action: '创建助手', prompt: '为这个工作流创建一个助手。' } } },
  session: { count: (count) => `${count} 个对话`, newSessionAria: '新建对话', closeAria: '关闭对话列表', searchAria: '搜索对话', searchPlaceholder: '搜索', titleAria: '对话标题', saveTitleAria: '保存标题', renameAria: (title) => `重命名 ${title}`, deleteAria: (title) => `删除 ${title}`, messages: (count) => `${count} 条消息`, noMatch: '没有匹配的对话', tryAnother: '换个词试试', newConversation: '新对话', startWithHermes: '从 Hermes 开始' },
  files: { title: '文件', attachLocalFiles: '添加本地文件', attached: (count) => `已添加 ${count} 个`, closeAria: '关闭文件面板', addFiles: '添加文件', uploading: '上传中...', supportedTypes: 'PDF、文档、笔记、代码、图片', preview: '预览', closePreviewAria: '关闭预览', noPreview: '暂时没有可读预览。', fileNameAria: '文件名', saveFileNameAria: '保存文件名', previewAria: (name) => `预览 ${name}`, downloadAria: (name) => `下载 ${name}`, copyAria: (name) => `复制 ${name}`, renameAria: (name) => `重命名 ${name}`, deleteAria: (name) => `删除 ${name}`, empty: '还没有文件。添加文件后，回答会更贴近本地内容。', actions: { summarize: { label: '总结', description: '把选中文件变成简短概览。', prompt: '用大白话总结这个文件。' }, keyPoints: { label: '找重点', description: '提取重要事实、决定和风险。', prompt: '找出这个文件的重点。' }, askFile: { label: '问文件', description: '围绕选中文件提出具体问题。', prompt: '优先根据这个文件回答我的问题。' }, actionPlan: { label: '行动计划', description: '把文件转成下一步和负责人。', prompt: '把这个文件整理成可执行行动计划。' } }, status: { ready: '已就绪', needsRetry: '需要重试', gettingReady: '准备中', added: '已添加' } },
  companyKnowledge: {
    eyebrow: '公司 AI',
    title: '公司知识库',
    subtitle: '管理 Hermes 回答时可引用的公司资料。',
    profileTitle: '公司档案',
    materialsTitle: '公司资料',
    addFiles: '添加公司资料',
    uploading: '上传中...',
    supportedTypes: 'PDF、文档、笔记、网页文本、图片',
    empty: '还没有公司资料。添加后，Hermes 会用公司上下文回答。',
    noPreview: '已保存。图片和二进制文件需要视觉或提取模型后才会出现可读笔记。',
    categoryForNewFiles: '新文件类型',
    fields: { name: '公司名称', website: '官网', markets: '目标市场', mainProducts: '主营产品', certifications: '认证资质', paymentTerms: '付款条款', shippingTerms: '物流条款', brandVoice: '品牌语气', notes: '重要备注' },
    categories: { 'company-profile': '公司档案', 'product-catalog': '产品目录', 'price-list': '价目表', certification: '认证资质', 'shipping-logistics': '物流与运输', 'payment-terms': '付款条款', faq: '常见问题', 'case-study': '案例', other: '其他' },
  },
  keyNudge: { pasteOneKey: '粘贴一个 API Key。新对话会自动使用它。', pasteKeyFirst: '请先粘贴 API Key。', saving: '保存中...', savedCanSend: '已保存。现在可以发送。', save: '保存' },
  gateway: { restartTitle: 'Hermes 需要重启。', notReadyTitle: 'Hermes 还没准备好。', startHermes: '启动 Hermes', tryAgain: '重试', details: '详情', setup: '设置', starting: 'Hermes 正在启动，通常只需要一小会儿。', failed: '请重试。如果还是失败，打开设置查看更多选项。', notInstalled: '先设置 Hermes，才能开启本地私有聊天。', paused: '启动 Hermes 后才能发送消息。' },
  runtime: {
    setupTitle: 'Hermes 设置', updateTitle: 'Hermes 设置', status: { setupNeeded: '需要设置', ready: '就绪', starting: '正在启动 Hermes', restart: 'Hermes 需要重启', paused: 'Hermes 已暂停' },
    action: { settingUp: '正在设置 Hermes...', setUp: '设置 Hermes', needsSetup: 'Hermes 需要设置', updating: '正在更新 Hermes...', update: '更新 Hermes', current: 'Hermes 已是最新' },
    title: { setupRetry: '设置需要重试。', settingUp: '正在设置 Hermes。', setupOnce: '在这台 Mac 上设置一次 Hermes。', hasUpdate: 'Hermes 有更新。', ready: 'Hermes 已就绪。', needsRepair: 'Hermes 需要修复。', installed: 'Hermes 已安装。' },
    description: { checking: '正在检查 Hermes 官方来源。', updateAvailable: '发现新的 Hermes 官方版本，可以准备好后再更新。', unknown: 'Hermills 暂时无法检查官方来源。本地 Hermes 仍可继续使用。', current: 'Hermills 会检查 Hermes 官方来源，只在发现新版本时显示更新按钮。' },
    summary: { checking: '正在检查 Hermes 官方更新', ready: '更新检查已准备好', updateFound: '发现新的 Hermes 版本', couldNotFinish: '更新检查未完成', current: 'Hermes 已是最新' },
    meta: { installed: '已安装', latest: '最新', lastCheck: '上次检查', localChat: '本地聊天', ready: '就绪', notStarted: '未启动', unknown: '未知' },
    buttons: { checkUpdates: '检查更新', checking: '检查中...', startHermes: '启动 Hermes', copyReport: '复制报告', repairOptions: '修复选项', repairInstall: '修复安装' },
    repair: { title: '修复本地 Hermes', description: '只在本地安装损坏时使用。正常更新会显示在上方。' },
    steps: { 'not-installed': '等待开始', ready: '就绪', failed: '需要重试', 'needs-user-action': '需要处理', checking: '检查安装包', downloading: '下载安装器', installing: '安装 Hermes', configuring: '准备本地聊天', starting: '启动 Hermes', verifying: '检查聊天状态' },
    waiting: '等待中', detail: (installed, latest) => `本地 ${installed}。官方 ${latest}。`, runningUpdateCheck: '正在检查 Hermes 更新...', installMessages: { checkingUpdate: '正在检查 Hermes 更新...', checkingSetup: '正在检查 Hermes 设置...', updateFailed: '更新失败。Hermes 可以继续使用当前版本。', setupFailed: '设置失败。请复制报告后重试。' },
  },
  personalization: { eyebrow: '个人设置', title: '语言和样式', language: '语言', theme: '主题', userName: '你的名字', agentName: '助手名字', memoryOn: '开启记忆', workspacePath: '工作区路径', chooseFolder: '选择文件夹', runSetupAgain: '重新运行设置', missingAgentName: '请先填写助手名字。', noDirectoryPicker: '当前版本不能打开文件夹选择器，请直接输入路径。' },
  assistant: {
    drawerTitle: '助手', drawerSubtitle: '让 Hermes 更适合你', closeAria: '关闭助手面板', sectionEyebrow: '我的助手', createTitle: '创建助手', editTitle: '编辑助手', new: '新建', create: '创建', saveChanges: '保存修改', saving: '保存中', name: '名称', helpWith: '它帮你做什么？', behavior: '它应该怎么工作？', starters: '开场提示', useFiles: '使用文件', rememberContext: '记住上下文', useTools: '使用工具', modelOptions: '模型选项', provider: '供应商', localHermes: '本地 Hermes', savedAgents: '已保存助手', ready: '就绪', noAssistants: '还没有助手。选择模板后创建一个。', use: '使用', chat: '聊天', copyAria: (name) => `复制 ${name}`, deleteAria: (name) => `删除 ${name}`, deleteConfirm: (name) => `删除 ${name}？已有聊天会保留，但这个助手会被移除。`, copyName: (name) => `${name} 副本`, validation: '请填写名字，并说明这个助手要做什么。',
    quickCreate: { title: '一键创建助手', description: '选择一个角色，Hermes 会创建可直接使用的助手。', action: '一键创建', creating: '正在创建助手...', created: '助手已创建。现在可以开始聊天。' },
    roleCards: { study: { title: '学习助手', description: '按步骤解释笔记、课程和难题。', action: '创建学习助手', defaultName: '学习助手', defaultInstructions: '讲清楚，把任务拆成小步骤，并用一个有用问题检查理解。', starter: '把这个讲简单' }, writing: { title: '写作助手', description: '起草、改写、总结和润色文字。', action: '创建写作助手', defaultName: '写作助手', defaultInstructions: '保留用户语气，删掉废话，先把表达变清楚，再解释修改。', starter: '把这段改清楚' }, code: { title: '代码助手', description: '读代码、找问题并给出实际修复建议。', action: '创建代码助手', defaultName: '代码助手', defaultInstructions: '先读上下文，找出真正问题，给出具体代码级建议。', starter: '找出这里的问题' }, files: { title: '文件分析师', description: '基于上传文件回答，并整理成计划。', action: '创建文件分析师', defaultName: '文件分析师', defaultInstructions: '优先使用附加文件，区分事实和猜测，最后给出下一步行动。', starter: '总结这些文件' } },
    defaultForm: { name: '研究伙伴', description: '使用本地 Hermes Agent 工具、记忆、技能和上传内容。', instructions: '优先使用附加材料。说明不确定的地方，并给出下一步建议。', starters: '总结这个文件\n做一个简单行动计划' },
    templates: [
      { id: 'study', label: '学习助手', description: '把难内容拆成简单步骤。', form: { name: '学习助手', description: '用简单步骤解释课程、笔记和难题。', instructions: '像耐心老师一样讲解。把答案拆成小步骤，检查假设，需要时给一个练习题。', starters: '把这个讲简单\n考考我这个主题' } },
      { id: 'writing', label: '写作助手', description: '起草、改写、润色文字。', form: { name: '写作助手', description: '帮你起草、改写、总结和润色文字。', instructions: '帮助写得更清楚。保留用户语气，删掉废话，先给更紧凑版本，再解释修改。', starters: '把这段改清楚\n让这段更短' } },
      { id: 'code', label: '代码助手', description: '读代码并解释修复办法。', form: { name: '代码助手', description: '解释代码、找问题、给出实际修复建议。', instructions: '像务实的软件工程师一样工作。先读上下文，找出真正问题，给出具体代码级建议。', starters: '找出这里的问题\n解释这段代码', tools: true } },
      { id: 'files', label: '文件分析师', description: '根据上传文件回答。', form: { name: '文件分析师', description: '读取上传文件，整理成答案、总结和计划。', instructions: '优先使用上传文件。相关时说明文件名，区分事实和猜测，最后给出下一步。', starters: '总结这些文件\n找出重点', files: true } },
    ],
  },
  profile: { eyebrow: '独立本地工作区', title: '用户配置', newNamePlaceholder: '新的配置名称', newNameAria: '新的配置名称', add: '添加', profileNameAria: '配置名称', saveProfileAria: '保存配置', activeNow: '当前使用', clickToUse: '点击使用', renameAria: (name) => `重命名 ${name}`, deleteAria: (name) => `删除 ${name}`, rulesTitle: '本地配置规则', keepChatsLocal: '聊天保存在本地', keepFilesLocal: '文件保存在本地', shareWithTeam: '与团队共享配置' },
  keys: { readySummary: (providers, agents) => `${providers} 个供应商已连接，可用于 ${agents} 个助手`, title: 'API Key', saveKey: '保存 Key', advancedDetails: '高级详情', hideDetails: '收起详情', savedHelp: '保存的 Key 会在本地加密。第一个保存的供应商会自动用于新对话。', noModels: '还没有同步模型', noKeySaved: '没有保存 Key', noProviders: '还没有保存供应商 Key。', test: '测试', models: '模型', defaults: '默认设置', maskKeys: '隐藏 Key', confirmDestructiveTools: '危险工具需要确认', allowExternalTools: '允许外部工具', form: { pasteKeyFirst: '请先粘贴 API Key。', saving: '正在保存 Key...', saved: '已保存。新对话会使用这个 Key。', testing: '测试中...', connected: '已连接', checkingModels: '正在检查模型...' } },
  diagnostics: { runtime: '运行时', conversations: '对话', sources: '来源', companyKnowledge: '公司知识库', keys: '密钥', agents: '助手', tokens: 'Token', storage: '存储', jobs: '任务', channels: '频道', logs: '日志', localChatHistory: '本地聊天记录', uploadedLocalContext: '上传的本地上下文', uploadedCompanyContext: '已上传的公司上下文', storedProviderEntries: '已保存的供应商', savedInstructionProfiles: '已保存的指令配置', tokenDetail: (input, output) => `${input} 输入 / ${output} 输出`, localFiles: (count) => `${count} 个本地文件`, companyMaterials: (count) => `${count} 份公司资料`, jobDetail: (runs, failed) => `${runs} 次运行 / ${failed} 次失败`, channelDetail: (count) => `${count} 个已配置`, logDetail: (count) => `${count} 个错误` },
  settings: { normal: { title: '设置', description: '让日常控制更容易浏览。', sections: { general: { title: '通用', description: '名字、语言和基础工作区行为。' }, appearance: { title: '外观', description: '主题和显示偏好。' }, workspace: { title: '工作区', description: '本地文件夹和文件默认设置。' }, assistants: { title: '助手', description: '默认助手和快速创建选项。' } } }, expert: { title: '专家设置', description: '本地运行时、供应商、隐私和诊断控制。', warning: '修改这些设置可能影响启动、模型访问或本地数据。', sections: { providers: { title: '供应商', description: 'API Key、Base URL、模型和连接测试。' }, runtime: { title: '运行时', description: '本地 Hermes 安装、更新、修复和启动状态。' }, privacy: { title: '隐私', description: '本地存储、记忆、文件和工具权限。' }, diagnostics: { title: '诊断', description: '健康检查、日志、Token 用量和排障数据。' } } } },
  errors: { title: '有件事需要处理', retry: '重试', copyDetails: '复制详情', openSettings: '打开设置', withDetail: (message) => `详情：${message}`, friendly: { runtimeUnavailable: { title: 'Hermes 没有运行', message: '本地聊天需要先启动 Hermes。', recovery: '重新启动 Hermes。如果还是失败，打开专家设置并复制报告。' }, providerMissing: { title: '还没有模型供应商', message: 'Hermes 需要保存供应商后才能使用云端模型。', recovery: '在设置里添加 API Key，或使用已就绪的本地 Hermes。' }, apiKeyInvalid: { title: '这个 API Key 不能用', message: '供应商拒绝了这个 Key，或 Base URL 不正确。', recovery: '检查 Key、Base URL 和默认模型，然后再测试。' }, messageFailed: { title: '消息没有发出去', message: 'Hermes 没能完成这次请求。', recovery: '先重试一次。如果一直失败，复制详情用于诊断。' }, fileUploadFailed: { title: '文件没有添加成功', message: 'Hermes 不能读取或保存这个文件。', recovery: '换一个文件试试，或先把它移到本地文件夹。' }, fileTooLarge: { title: '文件太大', message: '这个文件超过了 Hermes 现在能处理的大小。', recovery: '把它拆成更小的文件，只添加需要的部分。' }, assistantCreateFailed: { title: '助手没有创建成功', message: 'Hermes 不能保存这个助手。', recovery: '检查名称和指令，然后再试。' }, unknown: { title: '出现了意外问题', message: 'Hermes 遇到了没能识别的问题。', recovery: '再试一次；如果反复出现，请复制详情。' } } },
  format: { usage: (input, output, total) => `约 ${input} 输入 / ${output} 输出 / ${total} tokens` },
  providerStatus: { connected: '已连接', missing: '缺少 Key', invalid: '无效' },
})

const zhTW = withOverrides(zhCN, {
  common: { brandSubtitle: '本地 AI 夥伴', back: '上一步', continue: '繼續', save: '儲存', saving: '儲存中', saved: '已儲存', create: '建立', creating: '建立中', edit: '編輯', new: '新增', add: '加入', use: '使用', chat: '聊天', files: '檔案', assistants: '助手', settings: '設定', update: '更新', details: '詳細資料', hideDetails: '收起詳細資料', openSettings: '開啟設定', setup: '設定', search: '搜尋', send: '傳送', sending: '傳送中', ready: '就緒', unknown: '未知', notChecked: '尚未檢查', localHermes: '本地 Hermes', companyKnowledge: '公司知識庫', companyMaterials: '公司資料', apiKey: 'API Key', provider: '供應商', providerName: '供應商名稱', baseUrl: 'Base URL', defaultModel: '預設模型', model: '模型' },
  advanced: { eyebrow: '進階', title: 'Hermes 設定', closeAria: '關閉進階設定', navAria: '進階設定', tabs: { setup: 'Hermes', personalize: '個人化', company: '公司資料', agents: '助手', profiles: '使用者', keys: '金鑰', diagnostics: '診斷' } },
  onboarding: {
    loadingEyebrow: '首次使用', loadingTitle: '正在準備你的工作區。', loadingDescription: '本地部署準備好後，Hermes 會開啟設定精靈。', stepsAria: '首次設定步驟', stepProgress: (current, total) => `第 ${current} 步，共 ${total} 步`,
    steps: {
      language: { label: '語言', title: '選擇語言。', description: 'Hermes 會用這個語言完成首次設定。' },
      identity: { label: '名字', title: '替工作區取個名字。', description: '設定 Hermes 在聊天裡怎麼稱呼你，並決定是否開啟記憶。' },
      provider: { label: '模型', title: '連接模型供應商。', description: '現在加入一個相容 OpenAI 的供應商，或先跳過。' },
      theme: { label: '主題', title: '選擇一個簡單主題。', description: '選擇這個本地工作區的介面風格。' },
      workspace: { label: '路徑', title: '選擇工作路徑。', description: 'Hermes 會把本地資料放在這個目錄裡。' },
      features: { label: '功能', title: '開啟基礎功能。', description: '選擇進入聊天後要顯示哪些工具。' },
    },
    languageDetails: { 'zh-CN': '用簡體中文開始。', 'zh-TW': '用繁體中文開始。', ja: '日本語で開始します。', ko: '한국어로 시작합니다.', en: 'Use English for Hermills and Hermes.' },
    identity: { userName: '你的名字', agentName: '助手名字', memoryTitle: '一開始就開啟記憶', memoryDescription: 'Hermes 可以記住這個工作區裡你選擇的偏好。' },
    provider: { skip: '跳過', skipDetail: '之後再設定', setupLater: '之後可以在設定裡加入供應商，再傳送需要模型回答的訊息。' },
    themeOptions: { warm: { label: '暖紙', detail: '柔和紙面和藍綠色重點。' }, night: { label: '青夜', detail: '低亮度深色，適合夜間工作。' }, plain: { label: '素白', detail: '高對比，簡單清爽。' }, system: { label: '自動', detail: '跟隨這台 Mac 的系統外觀。' } },
    workspace: { path: '工作區路徑', chooseFolder: '選擇資料夾', choosingFolder: '選擇中...' },
    features: { chat: { label: '聊天', detail: '直接進入本地聊天工作區。' }, files: { label: '檔案', detail: '上傳檔案，作為本地上下文使用。' }, memory: { label: '記憶', detail: '讓 Hermes 記住已選擇的偏好。' }, assistants: { label: '助手', detail: '之後可以建立不同任務的 Agent。' }, diagnostics: { label: '診斷', detail: '保留執行狀態和健康檢查。' } },
    validation: { missingNames: '請先填寫兩個名字。', missingProvider: '需要供應商名稱、Base URL 和預設模型。', missingWorkspace: '請選擇或輸入工作區路徑。', missingFeature: '至少選擇一個功能。', noDirectoryPicker: '目前版本不能開啟資料夾選擇器，請直接輸入路徑。' },
    startChatting: '開始聊天',
  },
  firstRun: { setupEyebrow: '設定', checkingTitle: '正在檢查這台 Mac。', checkingDescription: '設定完成後 Hermes 會進入聊天。', oneTimeSetup: '一次性設定', packageCheckFallback: 'Hermes 會先檢查官方安裝包。' },
  topbar: { chats: '對話', assistants: '助手', files: '檔案', settingsAria: '進階設定', serviceWarning: (message) => `本地服務提醒：${message}` },
  mode: { label: '模式', ariaLabel: '選擇介面模式', options: { simple: { label: '簡單', description: '只顯示日常聊天、檔案、助手和基本設定。', switchLabel: '使用簡單模式', currentLabel: '已開啟簡單模式' }, expert: { label: '專家', description: '顯示供應商、執行時、隱私和診斷控制。', switchLabel: '使用專家模式', currentLabel: '已開啟專家模式' } } },
  chat: { ...zhCN.chat, addFile: '加入檔案', addCompanyMaterial: '加入公司資料', openCompanyKnowledgeAria: '開啟公司知識庫', selectedFiles: (count) => `${count} 個檔案`, selectedCompanyMaterials: (count) => `${count} 份公司資料`, you: '你', emptyTitle: '在這台 Mac 上問 Hermes。', emptyDescription: '需要根據本地內容回答時，可以加入檔案。', openSetup: '開啟設定', addApiKey: '加入 API Key', openSourcesAria: '開啟檔案', placeholderNotReady: '先啟動 Hermes', startBeforeSend: '請先啟動 Hermes 再傳送訊息。', newConversation: '新的 Hermes 對話', newAssistantConversation: (name) => `${name} 對話`, emptyActions: { quickChat: { title: '直接提問', description: '開始一般對話，讓 Hermes 根據這台 Mac 回答。', action: '開始聊天', prompt: '幫我梳理這件事。' }, companyKnowledge: { title: '完善公司資料', description: '把產品、價格、認證、物流和付款條款教給 Hermes。', action: '開啟公司資料', prompt: '根據我們的公司資料回答這個問題。' }, addFiles: { title: '帶檔案聊天', description: '加入本地檔案，讓回答使用你的上下文。', action: '加入檔案', prompt: '總結我加入的檔案。' }, createAssistant: { title: '建立助手', description: '為經常做的任務建立一個可重複使用的助手。', action: '建立助手', prompt: '為這個工作流程建立一個助手。' } } },
  session: { count: (count) => `${count} 個對話`, newSessionAria: '新增對話', closeAria: '關閉對話列表', searchAria: '搜尋對話', searchPlaceholder: '搜尋', titleAria: '對話標題', saveTitleAria: '儲存標題', renameAria: (title) => `重新命名 ${title}`, deleteAria: (title) => `刪除 ${title}`, messages: (count) => `${count} 則訊息`, noMatch: '沒有符合的對話', tryAnother: '換個詞試試', newConversation: '新對話', startWithHermes: '從 Hermes 開始' },
  files: { title: '檔案', attachLocalFiles: '加入本地檔案', attached: (count) => `已加入 ${count} 個`, closeAria: '關閉檔案面板', addFiles: '加入檔案', uploading: '上傳中...', supportedTypes: 'PDF、文件、筆記、程式碼、圖片', preview: '預覽', closePreviewAria: '關閉預覽', noPreview: '暫時沒有可讀預覽。', fileNameAria: '檔案名稱', saveFileNameAria: '儲存檔案名稱', previewAria: (name) => `預覽 ${name}`, downloadAria: (name) => `下載 ${name}`, copyAria: (name) => `複製 ${name}`, renameAria: (name) => `重新命名 ${name}`, deleteAria: (name) => `刪除 ${name}`, empty: '還沒有檔案。加入檔案後，回答會更貼近本地內容。', actions: { summarize: { label: '總結', description: '把選取檔案變成簡短概覽。', prompt: '用大白話總結這個檔案。' }, keyPoints: { label: '找重點', description: '提取重要事實、決定和風險。', prompt: '找出這個檔案的重點。' }, askFile: { label: '問檔案', description: '圍繞選取檔案提出具體問題。', prompt: '優先根據這個檔案回答我的問題。' }, actionPlan: { label: '行動計畫', description: '把檔案轉成下一步和負責人。', prompt: '把這個檔案整理成可執行行動計畫。' } }, status: { ready: '已就緒', needsRetry: '需要重試', gettingReady: '準備中', added: '已加入' } },
  companyKnowledge: {
    eyebrow: '公司 AI',
    title: '公司知識庫',
    subtitle: '管理 Hermes 回答時可引用的公司資料。',
    profileTitle: '公司檔案',
    materialsTitle: '公司資料',
    addFiles: '加入公司資料',
    uploading: '上傳中...',
    supportedTypes: 'PDF、文件、筆記、網頁文字、圖片',
    empty: '還沒有公司資料。加入後，Hermes 會用公司上下文回答。',
    noPreview: '已儲存。圖片和二進位檔案需要視覺或提取模型後才會出現可讀筆記。',
    categoryForNewFiles: '新檔案類型',
    fields: { name: '公司名稱', website: '官網', markets: '目標市場', mainProducts: '主營產品', certifications: '認證資質', paymentTerms: '付款條款', shippingTerms: '物流條款', brandVoice: '品牌語氣', notes: '重要備註' },
    categories: { 'company-profile': '公司檔案', 'product-catalog': '產品目錄', 'price-list': '價目表', certification: '認證資質', 'shipping-logistics': '物流與運輸', 'payment-terms': '付款條款', faq: '常見問題', 'case-study': '案例', other: '其他' },
  },
  keyNudge: { pasteOneKey: '貼上一個 API Key。新對話會自動使用它。', pasteKeyFirst: '請先貼上 API Key。', saving: '儲存中...', savedCanSend: '已儲存。現在可以傳送。', save: '儲存' },
  gateway: { restartTitle: 'Hermes 需要重新啟動。', notReadyTitle: 'Hermes 還沒準備好。', startHermes: '啟動 Hermes', tryAgain: '重試', details: '詳細資料', setup: '設定', starting: 'Hermes 正在啟動，通常只需要一小會兒。', failed: '請重試。如果還是失敗，開啟設定查看更多選項。', notInstalled: '先設定 Hermes，才能開啟本地私有聊天。', paused: '啟動 Hermes 後才能傳送訊息。' },
  runtime: {
    setupTitle: 'Hermes 設定', updateTitle: 'Hermes 設定', status: { setupNeeded: '需要設定', ready: '就緒', starting: '正在啟動 Hermes', restart: 'Hermes 需要重新啟動', paused: 'Hermes 已暫停' },
    action: { settingUp: '正在設定 Hermes...', setUp: '設定 Hermes', needsSetup: 'Hermes 需要設定', updating: '正在更新 Hermes...', update: '更新 Hermes', current: 'Hermes 已是最新' },
    title: { setupRetry: '設定需要重試。', settingUp: '正在設定 Hermes。', setupOnce: '在這台 Mac 上設定一次 Hermes。', hasUpdate: 'Hermes 有更新。', ready: 'Hermes 已就緒。', needsRepair: 'Hermes 需要修復。', installed: 'Hermes 已安裝。' },
    description: { checking: '正在檢查 Hermes 官方來源。', updateAvailable: '發現新的 Hermes 官方版本，可以準備好後再更新。', unknown: 'Hermills 暫時無法檢查官方來源。本地 Hermes 仍可繼續使用。', current: 'Hermills 會檢查 Hermes 官方來源，只在發現新版本時顯示更新按鈕。' },
    summary: { checking: '正在檢查 Hermes 官方更新', ready: '更新檢查已準備好', updateFound: '發現新的 Hermes 版本', couldNotFinish: '更新檢查未完成', current: 'Hermes 已是最新' },
    meta: { installed: '已安裝', latest: '最新', lastCheck: '上次檢查', localChat: '本地聊天', ready: '就緒', notStarted: '未啟動', unknown: '未知' },
    buttons: { checkUpdates: '檢查更新', checking: '檢查中...', startHermes: '啟動 Hermes', copyReport: '複製報告', repairOptions: '修復選項', repairInstall: '修復安裝' },
    repair: { title: '修復本地 Hermes', description: '只在本地安裝損壞時使用。正常更新會顯示在上方。' },
    steps: { 'not-installed': '等待開始', ready: '就緒', failed: '需要重試', 'needs-user-action': '需要處理', checking: '檢查安裝包', downloading: '下載安裝器', installing: '安裝 Hermes', configuring: '準備本地聊天', starting: '啟動 Hermes', verifying: '檢查聊天狀態' },
    waiting: '等待中', detail: (installed, latest) => `本地 ${installed}。官方 ${latest}。`, runningUpdateCheck: '正在檢查 Hermes 更新...', installMessages: { checkingUpdate: '正在檢查 Hermes 更新...', checkingSetup: '正在檢查 Hermes 設定...', updateFailed: '更新失敗。Hermes 可以繼續使用目前版本。', setupFailed: '設定失敗。請複製報告後重試。' },
  },
  personalization: { eyebrow: '個人設定', title: '語言和樣式', language: '語言', theme: '主題', userName: '你的名字', agentName: '助手名字', memoryOn: '開啟記憶', workspacePath: '工作區路徑', chooseFolder: '選擇資料夾', runSetupAgain: '重新執行設定', missingAgentName: '請先填寫助手名字。', noDirectoryPicker: '目前版本不能開啟資料夾選擇器，請直接輸入路徑。' },
  assistant: {
    drawerTitle: '助手', drawerSubtitle: '讓 Hermes 更適合你', closeAria: '關閉助手面板', sectionEyebrow: '我的助手', createTitle: '建立助手', editTitle: '編輯助手', new: '新增', create: '建立', saveChanges: '儲存修改', saving: '儲存中', name: '名稱', helpWith: '它幫你做什麼？', behavior: '它應該怎麼工作？', starters: '開場提示', useFiles: '使用檔案', rememberContext: '記住上下文', useTools: '使用工具', modelOptions: '模型選項', provider: '供應商', localHermes: '本地 Hermes', savedAgents: '已儲存助手', ready: '就緒', noAssistants: '還沒有助手。選擇範本後建立一個。', use: '使用', chat: '聊天', copyAria: (name) => `複製 ${name}`, deleteAria: (name) => `刪除 ${name}`, deleteConfirm: (name) => `刪除 ${name}？已有聊天會保留，但這個助手會被移除。`, copyName: (name) => `${name} 副本`, validation: '請填寫名字，並說明這個助手要做什麼。',
    quickCreate: { title: '一鍵建立助手', description: '選擇一個角色，Hermes 會建立可直接使用的助手。', action: '一鍵建立', creating: '正在建立助手...', created: '助手已建立。現在可以開始聊天。' },
    roleCards: { study: { title: '學習助手', description: '按步驟解釋筆記、課程和難題。', action: '建立學習助手', defaultName: '學習助手', defaultInstructions: '講清楚，把任務拆成小步驟，並用一個有用問題檢查理解。', starter: '把這個講簡單' }, writing: { title: '寫作助手', description: '起草、改寫、總結和潤飾文字。', action: '建立寫作助手', defaultName: '寫作助手', defaultInstructions: '保留使用者語氣，刪掉廢話，先把表達變清楚，再解釋修改。', starter: '把這段改清楚' }, code: { title: '程式碼助手', description: '讀程式碼、找問題並給出實際修復建議。', action: '建立程式碼助手', defaultName: '程式碼助手', defaultInstructions: '先讀上下文，找出真正問題，給出具體程式碼級建議。', starter: '找出這裡的問題' }, files: { title: '檔案分析師', description: '根據上傳檔案回答，並整理成計畫。', action: '建立檔案分析師', defaultName: '檔案分析師', defaultInstructions: '優先使用附加檔案，區分事實和猜測，最後給出下一步行動。', starter: '總結這些檔案' } },
    defaultForm: { name: '研究夥伴', description: '使用本地 Hermes Agent 工具、記憶、技能和上傳內容。', instructions: '優先使用附加材料。說明不確定的地方，並給出下一步建議。', starters: '總結這個檔案\n做一個簡單行動計畫' },
    templates: [
      { id: 'study', label: '學習助手', description: '把難內容拆成簡單步驟。', form: { name: '學習助手', description: '用簡單步驟解釋課程、筆記和難題。', instructions: '像耐心老師一樣講解。把答案拆成小步驟，檢查假設，需要時給一個練習題。', starters: '把這個講簡單\n考考我這個主題' } },
      { id: 'writing', label: '寫作助手', description: '起草、改寫、潤飾文字。', form: { name: '寫作助手', description: '幫你起草、改寫、總結和潤飾文字。', instructions: '幫助寫得更清楚。保留使用者語氣，刪掉廢話，先給更緊湊版本，再解釋修改。', starters: '把這段改清楚\n讓這段更短' } },
      { id: 'code', label: '程式碼助手', description: '讀程式碼並解釋修復辦法。', form: { name: '程式碼助手', description: '解釋程式碼、找問題、給出實際修復建議。', instructions: '像務實的軟體工程師一樣工作。先讀上下文，找出真正問題，給出具體程式碼級建議。', starters: '找出這裡的問題\n解釋這段程式碼', tools: true } },
      { id: 'files', label: '檔案分析師', description: '根據上傳檔案回答。', form: { name: '檔案分析師', description: '讀取上傳檔案，整理成答案、總結和計畫。', instructions: '優先使用上傳檔案。相關時說明檔案名，區分事實和猜測，最後給出下一步。', starters: '總結這些檔案\n找出重點', files: true } },
    ],
  },
  profile: { eyebrow: '獨立本地工作區', title: '使用者設定', newNamePlaceholder: '新的設定名稱', newNameAria: '新的設定名稱', add: '加入', profileNameAria: '設定名稱', saveProfileAria: '儲存設定', activeNow: '目前使用', clickToUse: '點擊使用', renameAria: (name) => `重新命名 ${name}`, deleteAria: (name) => `刪除 ${name}`, rulesTitle: '本地設定規則', keepChatsLocal: '聊天保存在本地', keepFilesLocal: '檔案保存在本地', shareWithTeam: '與團隊共享設定' },
  keys: { readySummary: (providers, agents) => `${providers} 個供應商已連線，可用於 ${agents} 個助手`, title: 'API Key', saveKey: '儲存 Key', advancedDetails: '進階詳細資料', hideDetails: '收起詳細資料', savedHelp: '儲存的 Key 會在本地加密。第一個儲存的供應商會自動用於新對話。', noModels: '還沒有同步模型', noKeySaved: '沒有儲存 Key', noProviders: '還沒有儲存供應商 Key。', test: '測試', models: '模型', defaults: '預設值', maskKeys: '隱藏 Key', confirmDestructiveTools: '危險工具需要確認', allowExternalTools: '允許外部工具', form: { pasteKeyFirst: '請先貼上 API Key。', saving: '正在儲存 Key...', saved: '已儲存。新對話會使用這個 Key。', testing: '測試中...', connected: '已連線', checkingModels: '正在檢查模型...' } },
  diagnostics: { runtime: '執行時', conversations: '對話', sources: '來源', companyKnowledge: '公司知識庫', keys: '金鑰', agents: '助手', tokens: 'Token', storage: '儲存', jobs: '任務', channels: '頻道', logs: '日誌', localChatHistory: '本地聊天記錄', uploadedLocalContext: '上傳的本地上下文', uploadedCompanyContext: '已上傳的公司上下文', storedProviderEntries: '已儲存的供應商', savedInstructionProfiles: '已儲存的指令設定', tokenDetail: (input, output) => `${input} 輸入 / ${output} 輸出`, localFiles: (count) => `${count} 個本地檔案`, companyMaterials: (count) => `${count} 份公司資料`, jobDetail: (runs, failed) => `${runs} 次執行 / ${failed} 次失敗`, channelDetail: (count) => `${count} 個已設定`, logDetail: (count) => `${count} 個錯誤` },
  settings: { normal: { title: '設定', description: '讓日常控制更容易瀏覽。', sections: { general: { title: '通用', description: '名字、語言和基本工作區行為。' }, appearance: { title: '外觀', description: '主題和顯示偏好。' }, workspace: { title: '工作區', description: '本地資料夾和檔案預設設定。' }, assistants: { title: '助手', description: '預設助手和快速建立選項。' } } }, expert: { title: '專家設定', description: '本地執行時、供應商、隱私和診斷控制。', warning: '修改這些設定可能影響啟動、模型存取或本地資料。', sections: { providers: { title: '供應商', description: 'API Key、Base URL、模型和連線測試。' }, runtime: { title: '執行時', description: '本地 Hermes 安裝、更新、修復和啟動狀態。' }, privacy: { title: '隱私', description: '本地儲存、記憶、檔案和工具權限。' }, diagnostics: { title: '診斷', description: '健康檢查、日誌、Token 用量和排障資料。' } } } },
  errors: { title: '有件事需要處理', retry: '重試', copyDetails: '複製詳細資料', openSettings: '開啟設定', withDetail: (message) => `詳細資料：${message}`, friendly: { runtimeUnavailable: { title: 'Hermes 沒有執行', message: '本地聊天需要先啟動 Hermes。', recovery: '重新啟動 Hermes。如果還是失敗，開啟專家設定並複製報告。' }, providerMissing: { title: '還沒有模型供應商', message: 'Hermes 需要儲存供應商後才能使用雲端模型。', recovery: '在設定裡加入 API Key，或使用已就緒的本地 Hermes。' }, apiKeyInvalid: { title: '這個 API Key 不能用', message: '供應商拒絕了這個 Key，或 Base URL 不正確。', recovery: '檢查 Key、Base URL 和預設模型，然後再測試。' }, messageFailed: { title: '訊息沒有傳送出去', message: 'Hermes 沒能完成這次請求。', recovery: '先重試一次。如果一直失敗，複製詳細資料用於診斷。' }, fileUploadFailed: { title: '檔案沒有加入成功', message: 'Hermes 不能讀取或儲存這個檔案。', recovery: '換一個檔案試試，或先把它移到本地資料夾。' }, fileTooLarge: { title: '檔案太大', message: '這個檔案超過了 Hermes 現在能處理的大小。', recovery: '把它拆成更小的檔案，只加入需要的部分。' }, assistantCreateFailed: { title: '助手沒有建立成功', message: 'Hermes 不能儲存這個助手。', recovery: '檢查名稱和指令，然後再試。' }, unknown: { title: '出現了意外問題', message: 'Hermes 遇到了沒能識別的問題。', recovery: '再試一次；如果反覆出現，請複製詳細資料。' } } },
  format: { usage: (input, output, total) => `約 ${input} 輸入 / ${output} 輸出 / ${total} tokens` },
  providerStatus: { connected: '已連線', missing: '缺少 Key', invalid: '無效' },
})

const ja = withOverrides(en, {
  common: { brandSubtitle: 'ローカル AI パートナー', back: '戻る', continue: '続ける', save: '保存', saving: '保存中', saved: '保存済み', create: '作成', creating: '作成中', edit: '編集', new: '新規', add: '追加', use: '使う', chat: 'チャット', files: 'ファイル', assistants: 'アシスタント', settings: '設定', update: '更新', details: '詳細', hideDetails: '詳細を隠す', openSettings: '設定を開く', setup: '設定', search: '検索', send: '送信', sending: '送信中', ready: '準備完了', unknown: '不明', notChecked: '未確認', localHermes: 'ローカル Hermes', companyKnowledge: '会社ナレッジベース', companyMaterials: '会社資料', apiKey: 'API Key', provider: 'プロバイダー', providerName: 'プロバイダー名', baseUrl: 'Base URL', defaultModel: '既定モデル', model: 'モデル' },
  advanced: { eyebrow: '詳細', title: 'Hermes 設定', closeAria: '詳細設定を閉じる', navAria: '詳細設定', tabs: { setup: 'Hermes', personalize: '個人設定', company: '会社資料', agents: 'アシスタント', profiles: 'プロファイル', keys: 'キー', diagnostics: '診断' } },
  onboarding: { ...en.onboarding, loadingEyebrow: '初回起動', loadingTitle: 'ワークスペースを準備しています。', loadingDescription: 'ローカル展開が準備できたら、Hermes が設定ガイドを開きます。', stepsAria: '初期設定ステップ', stepProgress: (current, total) => `${total} ステップ中 ${current}`, steps: { language: { label: '言語', title: '言語を選択します。', description: 'Hermes は初回設定でこの言語を使います。' }, identity: { label: '名前', title: 'このワークスペースに名前を付けます。', description: 'チャットで使う名前と、記憶を有効にするかを決めます。' }, provider: { label: 'プロバイダー', title: 'モデルプロバイダーを接続します。', description: 'OpenAI 互換プロバイダーを追加するか、あとで設定します。' }, theme: { label: 'テーマ', title: 'シンプルなテーマを選びます。', description: 'このローカルワークスペースの見た目を選びます。' }, workspace: { label: 'パス', title: '作業パスを選択します。', description: 'Hermes はローカル資料をこのディレクトリに保存します。' }, features: { label: '機能', title: '基本機能をオンにします。', description: 'チャットを開いたときに表示するツールを選びます。' } }, languageDetails: { 'zh-CN': '簡体字中国語で開始します。', 'zh-TW': '繁体字中国語で開始します。', ja: '日本語で開始します。', ko: '韓国語で開始します。', en: '英語で Hermills と Hermes を使います。' }, identity: { userName: 'あなたの名前', agentName: 'アシスタント名', memoryTitle: '記憶をオンにして開始', memoryDescription: 'Hermes はこのワークスペースの設定を記憶できます。' }, provider: { skip: 'スキップ', skipDetail: 'あとで設定', setupLater: 'あとで設定からプロバイダーを追加できます。' }, themeOptions: { warm: { label: '暖かい紙', detail: '柔らかな紙面と青緑のアクセント。' }, night: { label: '青い夜', detail: '夜作業向けの暗い表示。' }, plain: { label: '白', detail: '高コントラストでシンプル。' }, system: { label: '自動', detail: 'Mac の外観に合わせます。' } }, workspace: { path: 'ワークスペースのパス', chooseFolder: 'フォルダを選択', choosingFolder: '選択中...' }, features: { chat: { label: 'チャット', detail: 'ローカルチャットを直接開きます。' }, files: { label: 'ファイル', detail: 'ファイルを添付してローカル文脈に使います。' }, memory: { label: '記憶', detail: '選択した設定を Hermes に記憶させます。' }, assistants: { label: 'アシスタント', detail: 'タスク別の Agent をあとで作成できます。' }, diagnostics: { label: '診断', detail: '実行状態とヘルスチェックを表示します。' } }, validation: { missingNames: '2つの名前を入力してください。', missingProvider: 'プロバイダー名、Base URL、既定モデルが必要です。', missingWorkspace: 'ワークスペースのパスを選択または入力してください。', missingFeature: '少なくとも1つの機能を選択してください。', noDirectoryPicker: 'このビルドではフォルダ選択を使えません。パスを入力してください。' }, startChatting: 'チャットを開始' },
  firstRun: { setupEyebrow: '設定', checkingTitle: 'この Mac を確認しています。', checkingDescription: '設定が完了すると Hermes がチャットを開きます。', oneTimeSetup: '初回設定', packageCheckFallback: 'Hermes はまず公式セットアップパッケージを確認します。' },
  topbar: { chats: 'チャット', assistants: 'アシスタント', files: 'ファイル', settingsAria: '詳細設定', serviceWarning: (message) => `ローカルサービス警告: ${message}` },
  mode: { label: 'モード', ariaLabel: '画面モードを選択', options: { simple: { label: 'シンプル', description: '日常のチャット、ファイル、アシスタント、基本設定だけを表示します。', switchLabel: 'シンプルモードに切り替え', currentLabel: 'シンプルモード中' }, expert: { label: 'エキスパート', description: 'プロバイダー、ランタイム、プライバシー、診断の設定を表示します。', switchLabel: 'エキスパートモードに切り替え', currentLabel: 'エキスパートモード中' } } },
  chat: { sectionLabel: 'チャット', defaultTitle: 'Hermes に質問', defaultAssistant: '既定アシスタント', addFile: 'ファイル追加', addCompanyMaterial: '会社資料を追加', openCompanyKnowledgeAria: '会社ナレッジベースを開く', selectedFiles: (count) => `${count} 件のファイル`, selectedCompanyMaterials: (count) => `${count} 件の会社資料`, you: 'あなた', emptyTitle: 'この Mac 上で Hermes に何でも聞けます。', emptyDescription: 'ローカル内容に基づく回答が必要なときはファイルを添付します。', openSetup: '設定を開く', addApiKey: 'API Key を追加', openSourcesAria: 'ファイルを開く', messageAria: 'メッセージ', placeholderReady: 'Hermes に質問...', placeholderNotReady: '先に Hermes を開始', startBeforeSend: '送信する前に Hermes を開始してください。', newConversation: '新しい Hermes 会話', newAssistantConversation: (name) => `${name} チャット`, emptyActions: { quickChat: { title: '質問する', description: '通常のチャットを始め、この Mac の内容から Hermes に答えてもらいます。', action: 'チャット開始', prompt: 'この件を整理するのを手伝ってください。' }, companyKnowledge: { title: '会社資料を整える', description: '製品、価格、認証、物流、支払い条件を Hermes に教えます。', action: '会社資料を開く', prompt: '会社資料に基づいてこの質問に答えてください。' }, addFiles: { title: 'ファイルとチャット', description: 'ローカルファイルを追加して、回答に自分の文脈を使います。', action: 'ファイル追加', prompt: '追加したファイルを要約してください。' }, createAssistant: { title: 'アシスタントを作成', description: 'よく行う作業向けの再利用できる助手を作ります。', action: 'アシスタント作成', prompt: 'このワークフロー用のアシスタントを作成してください。' } } },
  session: { count: (count) => `${count} 件の会話`, newSessionAria: '新しい会話', closeAria: '会話リストを閉じる', searchAria: '会話を検索', searchPlaceholder: '検索', titleAria: '会話タイトル', saveTitleAria: 'タイトルを保存', renameAria: (title) => `${title} を名称変更`, deleteAria: (title) => `${title} を削除`, messages: (count) => `${count} 件のメッセージ`, noMatch: '一致する会話がありません', tryAnother: '別の語で試してください', newConversation: '新しい会話', startWithHermes: 'Hermes で開始' },
  files: { title: 'ファイル', attachLocalFiles: 'ローカルファイルを添付', attached: (count) => `${count} 件添付`, closeAria: 'ファイルパネルを閉じる', addFiles: 'ファイル追加', uploading: 'アップロード中...', supportedTypes: 'PDF、文書、メモ、コード、画像', preview: 'プレビュー', closePreviewAria: 'プレビューを閉じる', noPreview: '読み取れるプレビューはまだありません。', fileNameAria: 'ファイル名', saveFileNameAria: 'ファイル名を保存', previewAria: (name) => `${name} をプレビュー`, downloadAria: (name) => `${name} をダウンロード`, copyAria: (name) => `${name} をコピー`, renameAria: (name) => `${name} を名称変更`, deleteAria: (name) => `${name} を削除`, empty: 'ファイルはまだありません。ファイルを追加すると回答に使えます。', actions: { summarize: { label: '要約', description: '選択したファイルを短い概要にします。', prompt: 'このファイルをわかりやすく要約してください。' }, keyPoints: { label: '重要点を探す', description: '重要な事実、決定、リスクを抜き出します。', prompt: 'このファイルの重要点を見つけてください。' }, askFile: { label: 'ファイルに質問', description: '選択したファイルについて具体的に質問します。', prompt: 'このファイルを優先して私の質問に答えてください。' }, actionPlan: { label: '行動計画', description: 'ファイルを次の手順と担当に変換します。', prompt: 'このファイルを実行しやすい行動計画にしてください。' } }, status: { ready: '準備完了', needsRetry: '再試行が必要', gettingReady: '準備中', added: '追加済み' } },
  companyKnowledge: {
    eyebrow: '会社 AI',
    title: '会社ナレッジベース',
    subtitle: 'Hermes が回答で参照できる会社資料を管理します。',
    profileTitle: '会社プロフィール',
    materialsTitle: '会社資料',
    addFiles: '会社資料を追加',
    uploading: 'アップロード中...',
    supportedTypes: 'PDF、文書、メモ、Web テキスト、画像',
    empty: '会社資料はまだありません。追加すると Hermes が会社文脈で回答できます。',
    noPreview: '保存済みです。画像とバイナリファイルは、視覚または抽出モデルが必要です。',
    categoryForNewFiles: '新しいファイル種別',
    fields: { name: '会社名', website: 'Web サイト', markets: '対象市場', mainProducts: '主力製品', certifications: '認証', paymentTerms: '支払い条件', shippingTerms: '物流条件', brandVoice: 'ブランドの語調', notes: '重要メモ' },
    categories: { 'company-profile': '会社プロフィール', 'product-catalog': '製品カタログ', 'price-list': '価格表', certification: '認証', 'shipping-logistics': '配送と物流', 'payment-terms': '支払い条件', faq: 'FAQ', 'case-study': '導入事例', other: 'その他' },
  },
  keyNudge: { pasteOneKey: 'API Key を1つ貼り付けます。新しいチャットで自動使用します。', pasteKeyFirst: '先に API Key を貼り付けてください。', saving: '保存中...', savedCanSend: '保存済み。送信できます。', save: '保存' },
  gateway: { restartTitle: 'Hermes の再起動が必要です。', notReadyTitle: 'Hermes はまだ準備できていません。', startHermes: 'Hermes を開始', tryAgain: '再試行', details: '詳細', setup: '設定', starting: 'Hermes を開始しています。通常はすぐ終わります。', failed: '再試行してください。失敗が続く場合は設定を開いてください。', notInstalled: 'ローカルの非公開チャットを使うには Hermes を設定してください。', paused: 'メッセージ送信前に Hermes を開始してください。' },
  runtime: {
    setupTitle: 'Hermes 設定', updateTitle: 'Hermes 設定', status: { setupNeeded: '設定が必要', ready: '準備完了', starting: 'Hermes 起動中', restart: 'Hermes の再起動が必要', paused: 'Hermes は一時停止中' },
    action: { settingUp: 'Hermes を設定中...', setUp: 'Hermes を設定', needsSetup: 'Hermes の設定が必要', updating: 'Hermes を更新中...', update: 'Hermes を更新', current: 'Hermes は最新です' },
    title: { setupRetry: '設定の再試行が必要です。', settingUp: 'Hermes を設定しています。', setupOnce: 'この Mac で Hermes を一度だけ設定します。', hasUpdate: 'Hermes の更新があります。', ready: 'Hermes は準備完了です。', needsRepair: 'Hermes の修復が必要です。', installed: 'Hermes はインストール済みです。' },
    description: { checking: 'Hermes の公式ソースで更新を確認しています。', updateAvailable: '新しい公式 Hermes リリースがあります。準備できたら更新してください。', unknown: 'Hermills は公式ソースを確認できませんでした。ローカル Hermes は引き続き使えます。', current: 'Hermills は公式 Hermes ソースを確認し、新しいバージョンがあるときだけ更新ボタンを表示します。' },
    summary: { checking: '公式 Hermes 更新を確認中', ready: '更新確認の準備完了', updateFound: '新しい Hermes バージョンがあります', couldNotFinish: '更新確認を完了できませんでした', current: 'Hermes は最新です' },
    meta: { installed: 'インストール済み', latest: '最新', lastCheck: '前回確認', localChat: 'ローカルチャット', ready: '準備完了', notStarted: '未開始', unknown: '不明' },
    buttons: { checkUpdates: '更新を確認', checking: '確認中...', startHermes: 'Hermes を開始', copyReport: 'レポートをコピー', repairOptions: '修復オプション', repairInstall: 'インストールを修復' },
    repair: { title: 'ローカル Hermes を修復', description: 'ローカルインストールが壊れたときだけ使います。通常の更新は上に表示されます。' },
    steps: { 'not-installed': '開始待ち', ready: '準備完了', failed: '再試行が必要', 'needs-user-action': '対応が必要', checking: 'セットアップパッケージを確認', downloading: 'インストーラーをダウンロード', installing: 'Hermes をインストール', configuring: 'ローカルチャットを準備', starting: 'Hermes を開始', verifying: 'チャット準備を確認' },
    waiting: '待機中', detail: (installed, latest) => `ローカル ${installed}。公式 ${latest}。`, runningUpdateCheck: 'Hermes 更新を確認中...', installMessages: { checkingUpdate: 'Hermes 更新を確認中...', checkingSetup: 'Hermes 設定を確認中...', updateFailed: '更新に失敗しました。Hermes は現在のバージョンを使い続けられます。', setupFailed: '設定に失敗しました。レポートをコピーして再試行してください。' },
  },
  personalization: { eyebrow: '個人設定', title: '言語とスタイル', language: '言語', theme: 'テーマ', userName: 'あなたの名前', agentName: 'アシスタント名', memoryOn: '記憶をオン', workspacePath: 'ワークスペースのパス', chooseFolder: 'フォルダを選択', runSetupAgain: '設定をもう一度実行', missingAgentName: '保存する前にアシスタント名を入力してください。', noDirectoryPicker: 'このビルドではフォルダ選択を使えません。パスを入力してください。' },
  assistant: {
    drawerTitle: 'アシスタント', drawerSubtitle: 'Hermes を自分向けにする', closeAria: 'アシスタントパネルを閉じる', sectionEyebrow: '自分のアシスタント', createTitle: 'アシスタントを作成', editTitle: 'アシスタントを編集', new: '新規', create: '作成', saveChanges: '変更を保存', saving: '保存中', name: '名前', helpWith: '何を手伝いますか？', behavior: 'どう振る舞いますか？', starters: '開始プロンプト', useFiles: 'ファイルを使う', rememberContext: '文脈を記憶', useTools: 'ツールを使う', modelOptions: 'モデル設定', provider: 'プロバイダー', localHermes: 'ローカル Hermes', savedAgents: '保存済みアシスタント', ready: '準備完了', noAssistants: 'アシスタントはまだありません。テンプレートを選んで作成してください。', use: '使う', chat: 'チャット', copyAria: (name) => `${name} をコピー`, deleteAria: (name) => `${name} を削除`, deleteConfirm: (name) => `${name} を削除しますか？既存のチャットは残りますが、このアシスタントは削除されます。`, copyName: (name) => `${name} のコピー`, validation: '名前を入力し、このアシスタントが何をするかを書いてください。',
    quickCreate: { title: 'ワンクリック作成', description: '役割を選ぶと、すぐ使えるアシスタントを Hermes が作成します。', action: 'ワンクリックで作成', creating: 'アシスタントを作成中...', created: 'アシスタントを作成しました。すぐチャットできます。' },
    roleCards: { study: { title: '学習ヘルパー', description: 'メモ、授業、難しい話題を手順で説明します。', action: '学習ヘルパーを作成', defaultName: '学習ヘルパー', defaultInstructions: '明確に説明し、作業を小さな手順に分け、役立つ質問で理解を確認してください。', starter: 'これを簡単に説明' }, writing: { title: '文章ヘルパー', description: '下書き、書き換え、要約、改善をします。', action: '文章ヘルパーを作成', defaultName: '文章ヘルパー', defaultInstructions: 'ユーザーの声を残し、余分な部分を削り、先に明確な表現にしてから変更点を説明してください。', starter: 'もっとわかりやすく書き換え' }, code: { title: 'コードヘルパー', description: 'コードを読み、問題を探し、実用的な修正を提案します。', action: 'コードヘルパーを作成', defaultName: 'コードヘルパー', defaultInstructions: '先に文脈を読み、本当の問題を特定し、具体的なコード単位の助言をしてください。', starter: 'ここにあるバグを見つけて' }, files: { title: 'ファイル分析', description: 'アップロードファイルから回答し、計画に整理します。', action: 'ファイル分析を作成', defaultName: 'ファイル分析', defaultInstructions: '添付ファイルを先に使い、事実と推測を分け、最後に次の有用な行動を示してください。', starter: 'これらのファイルを要約' } },
    defaultForm: { name: '調査パートナー', description: 'ローカル Hermes Agent のツール、記憶、スキル、アップロード文脈を使います。', instructions: '添付資料を先に使います。不確実な点を説明し、次の行動を提案します。', starters: 'このファイルを要約\n簡単な行動計画を作る' },
    templates: [
      { id: 'study', label: '学習ヘルパー', description: '難しいことを小さな手順で説明します。', form: { name: '学習ヘルパー', description: '授業、メモ、難しい話題を簡単な手順で説明します。', instructions: '落ち着いた家庭教師のように教えます。答えを小さく分け、前提を確認し、必要なら練習問題を1つ出します。', starters: 'これを簡単に説明\nこのテーマでクイズして' } },
      { id: 'writing', label: '文章ヘルパー', description: '下書き、書き換え、磨き込みをします。', form: { name: '文章ヘルパー', description: '文章の下書き、書き換え、要約、改善を手伝います。', instructions: 'わかりやすく書く手伝いをします。ユーザーの声を残し、余分な部分を削り、先に短く整えた版を出してから変更点を説明します。', starters: 'もっとわかりやすく書き換え\n短くして' } },
      { id: 'code', label: 'コードヘルパー', description: 'コードを読み、修正を説明します。', form: { name: 'コードヘルパー', description: 'コードを説明し、問題を見つけ、実用的な修正案を出します。', instructions: '実務的なソフトウェアエンジニアとして動きます。先に文脈を読み、本当の問題を見つけ、具体的なコード単位の助言をします。', starters: 'ここにあるバグを見つけて\nこのコードを説明して', tools: true } },
      { id: 'files', label: 'ファイル分析', description: 'アップロードファイルから答えます。', form: { name: 'ファイル分析', description: 'アップロードされたファイルを読み、答え、要約、計画に変えます。', instructions: '添付ファイルを先に使います。必要ならファイル名を示し、事実と推測を分け、最後に次の有用な行動を示します。', starters: 'これらのファイルを要約\n重要点を見つけて', files: true } },
    ],
  },
  profile: { eyebrow: '別々のローカルワークスペース', title: 'ユーザープロファイル', newNamePlaceholder: '新しいプロファイル名', newNameAria: '新しいプロファイル名', add: '追加', profileNameAria: 'プロファイル名', saveProfileAria: 'プロファイルを保存', activeNow: '使用中', clickToUse: 'クリックして使用', renameAria: (name) => `${name} を名称変更`, deleteAria: (name) => `${name} を削除`, rulesTitle: 'ローカルプロファイルのルール', keepChatsLocal: 'チャットをローカルに保存', keepFilesLocal: 'ファイルをローカルに保存', shareWithTeam: 'チームとプロファイルを共有' },
  keys: { readySummary: (providers, agents) => `${providers} 件のプロバイダーを ${agents} 件のアシスタントで使用可能`, title: 'API Key', saveKey: 'キーを保存', advancedDetails: '詳細設定', hideDetails: '詳細を隠す', savedHelp: '保存したキーはローカルで暗号化されます。最初に保存したプロバイダーが新しいチャットで自動使用されます。', noModels: '同期済みモデルはありません', noKeySaved: '保存済みキーなし', noProviders: '保存済みプロバイダーキーはありません。', test: 'テスト', models: 'モデル', defaults: '既定', maskKeys: 'キーを隠す', confirmDestructiveTools: '危険なツールは確認する', allowExternalTools: '外部ツールを許可', form: { pasteKeyFirst: '先に API Key を貼り付けてください。', saving: 'キーを保存中...', saved: '保存済み。新しいチャットでこのキーを使います。', testing: 'テスト中...', connected: '接続済み', checkingModels: 'モデルを確認中...' } },
  diagnostics: { runtime: 'ランタイム', conversations: '会話', sources: 'ソース', companyKnowledge: '会社ナレッジ', keys: 'キー', agents: 'エージェント', tokens: 'トークン', storage: 'ストレージ', jobs: 'ジョブ', channels: 'チャンネル', logs: 'ログ', localChatHistory: 'ローカルチャット履歴', uploadedLocalContext: 'アップロード済みローカル文脈', uploadedCompanyContext: 'アップロード済みの会社コンテキスト', storedProviderEntries: '保存済みプロバイダー', savedInstructionProfiles: '保存済み指示プロファイル', tokenDetail: (input, output) => `${input} 入力 / ${output} 出力`, localFiles: (count) => `${count} 件のローカルファイル`, companyMaterials: (count) => `${count} 件の会社資料`, jobDetail: (runs, failed) => `${runs} 実行 / ${failed} 失敗`, channelDetail: (count) => `${count} 件設定済み`, logDetail: (count) => `${count} 件のエラー` },
  settings: { normal: { title: '設定', description: '日常の操作を見つけやすくします。', sections: { general: { title: '一般', description: '名前、言語、基本的なワークスペース動作。' }, appearance: { title: '外観', description: 'テーマと表示設定。' }, workspace: { title: 'ワークスペース', description: 'ローカルフォルダとファイルの既定値。' }, assistants: { title: 'アシスタント', description: '既定アシスタントとすばやい作成オプション。' } } }, expert: { title: 'エキスパート設定', description: 'ローカルランタイム、プロバイダー、プライバシー、診断の制御。', warning: 'これらを変更すると、起動、モデル接続、ローカルデータに影響することがあります。', sections: { providers: { title: 'プロバイダー', description: 'API Key、Base URL、モデル、接続テスト。' }, runtime: { title: 'ランタイム', description: 'ローカル Hermes のインストール、更新、修復、起動状態。' }, privacy: { title: 'プライバシー', description: 'ローカル保存、記憶、ファイル、ツール権限。' }, diagnostics: { title: '診断', description: 'ヘルスチェック、ログ、トークン使用量、トラブルシュート情報。' } } } },
  errors: { title: '確認が必要です', retry: '再試行', copyDetails: '詳細をコピー', openSettings: '設定を開く', withDetail: (message) => `詳細: ${message}`, friendly: { runtimeUnavailable: { title: 'Hermes が実行されていません', message: 'ローカルチャットには先に Hermes の起動が必要です。', recovery: 'Hermes をもう一度開始してください。失敗が続く場合はエキスパート設定を開いてレポートをコピーします。' }, providerMissing: { title: 'モデルプロバイダーがありません', message: 'クラウドモデルを使うにはプロバイダーの保存が必要です。', recovery: '設定で API Key を追加するか、準備済みのローカル Hermes を使ってください。' }, apiKeyInvalid: { title: 'API Key が使えません', message: 'プロバイダーがこのキーを拒否したか、Base URL が違います。', recovery: 'キー、Base URL、既定モデルを確認して再テストしてください。' }, messageFailed: { title: 'メッセージを送信できませんでした', message: 'Hermes はこのリクエストを完了できませんでした。', recovery: '一度再試行してください。失敗が続く場合は詳細をコピーして診断します。' }, fileUploadFailed: { title: 'ファイルを追加できませんでした', message: 'Hermes はこのファイルを読めないか保存できません。', recovery: '別のファイルを試すか、先にローカルフォルダへ移動してください。' }, fileTooLarge: { title: 'ファイルが大きすぎます', message: 'このファイルは現在 Hermes が処理できるサイズを超えています。', recovery: '小さなファイルに分け、必要な部分だけ追加してください。' }, assistantCreateFailed: { title: 'アシスタントを作成できませんでした', message: 'Hermes はこのアシスタントを保存できません。', recovery: '名前と指示を確認して、もう一度試してください。' }, unknown: { title: '予期しない問題です', message: 'Hermes が理解できない問題に当たりました。', recovery: 'もう一度試してください。繰り返す場合は詳細をコピーしてください。' } } },
  format: { usage: (input, output, total) => `約 ${input} 入力 / ${output} 出力 / ${total} tokens` },
  providerStatus: { connected: '接続済み', missing: 'キーなし', invalid: '無効' },
})

const ko = withOverrides(en, {
  common: { brandSubtitle: '로컬 AI 파트너', back: '이전', continue: '계속', save: '저장', saving: '저장 중', saved: '저장됨', create: '만들기', creating: '만드는 중', edit: '편집', new: '새로 만들기', add: '추가', use: '사용', chat: '채팅', files: '파일', assistants: '도우미', settings: '설정', update: '업데이트', details: '자세히', hideDetails: '자세히 숨기기', openSettings: '설정 열기', setup: '설정', search: '검색', send: '보내기', sending: '보내는 중', ready: '준비됨', unknown: '알 수 없음', notChecked: '아직 확인 안 함', localHermes: '로컬 Hermes', companyKnowledge: '회사 지식 베이스', companyMaterials: '회사 자료', apiKey: 'API Key', provider: '공급자', providerName: '공급자 이름', baseUrl: 'Base URL', defaultModel: '기본 모델', model: '모델' },
  advanced: { eyebrow: '고급', title: 'Hermes 설정', closeAria: '고급 설정 닫기', navAria: '고급 설정', tabs: { setup: 'Hermes', personalize: '개인화', company: '회사 자료', agents: '도우미', profiles: '프로필', keys: '키', diagnostics: '진단' } },
  onboarding: { ...ja.onboarding, loadingEyebrow: '처음 실행', loadingTitle: '작업 공간을 준비하는 중입니다.', loadingDescription: '로컬 배포가 준비되면 Hermes가 설정 안내를 엽니다.', stepsAria: '초기 설정 단계', stepProgress: (current, total) => `${total}단계 중 ${current}단계`, steps: { language: { label: '언어', title: '언어를 선택하세요.', description: 'Hermes가 첫 설정에서 이 언어를 사용합니다.' }, identity: { label: '이름', title: '이 작업 공간의 이름을 정하세요.', description: '채팅에서 사용할 이름과 메모리 사용 여부를 정합니다.' }, provider: { label: '공급자', title: '모델 공급자를 연결하세요.', description: 'OpenAI 호환 공급자를 지금 추가하거나 나중에 설정하세요.' }, theme: { label: '테마', title: '간단한 테마를 고르세요.', description: '이 로컬 작업 공간의 화면 스타일을 선택합니다.' }, workspace: { label: '경로', title: '작업 경로를 선택하세요.', description: 'Hermes가 로컬 자료를 이 폴더에 저장합니다.' }, features: { label: '기능', title: '기본 기능을 켜세요.', description: '채팅을 열 때 보일 도구를 선택합니다.' } }, languageDetails: { 'zh-CN': '중국어 간체로 시작합니다.', 'zh-TW': '중국어 번체로 시작합니다.', ja: '일본어로 시작합니다.', ko: '한국어로 시작합니다.', en: '영어로 Hermills와 Hermes를 사용합니다.' }, identity: { userName: '내 이름', agentName: '도우미 이름', memoryTitle: '메모리를 켜고 시작', memoryDescription: 'Hermes가 이 작업 공간의 선택한 설정을 기억할 수 있습니다.' }, provider: { skip: '건너뛰기', skipDetail: '나중에 설정', setupLater: '나중에 설정에서 공급자를 추가할 수 있습니다.' }, themeOptions: { warm: { label: '따뜻한 종이', detail: '부드러운 종이 화면과 청록색 포인트.' }, night: { label: '푸른 밤', detail: '밤 작업에 맞춘 어두운 화면.' }, plain: { label: '깔끔한 흰색', detail: '높은 대비와 단순한 화면.' }, system: { label: '자동', detail: '이 Mac의 시스템 화면 설정을 따릅니다.' } }, workspace: { path: '작업 공간 경로', chooseFolder: '폴더 선택', choosingFolder: '선택 중...' }, features: { chat: { label: '채팅', detail: '로컬 채팅 작업 공간을 바로 엽니다.' }, files: { label: '파일', detail: '파일을 첨부해 로컬 문맥으로 사용합니다.' }, memory: { label: '메모리', detail: '선택한 설정을 Hermes가 기억하게 합니다.' }, assistants: { label: '도우미', detail: '나중에 작업별 Agent를 만들 수 있습니다.' }, diagnostics: { label: '진단', detail: '실행 상태와 상태 점검을 표시합니다.' } }, validation: { missingNames: '이름 두 개를 모두 입력하세요.', missingProvider: '공급자 이름, Base URL, 기본 모델이 필요합니다.', missingWorkspace: '작업 공간 경로를 선택하거나 입력하세요.', missingFeature: '기능을 하나 이상 선택하세요.', noDirectoryPicker: '이 빌드에서는 폴더 선택기를 사용할 수 없습니다. 경로를 직접 입력하세요.' }, startChatting: '채팅 시작' },
  firstRun: { setupEyebrow: '설정', checkingTitle: '이 Mac을 확인하는 중입니다.', checkingDescription: '설정이 완료되면 Hermes가 채팅을 엽니다.', oneTimeSetup: '첫 설정', packageCheckFallback: 'Hermes가 먼저 공식 설치 패키지를 확인합니다.' },
  topbar: { chats: '대화', assistants: '도우미', files: '파일', settingsAria: '고급 설정', serviceWarning: (message) => `로컬 서비스 알림: ${message}` },
  mode: { label: '모드', ariaLabel: '화면 모드 선택', options: { simple: { label: '간단', description: '일상 채팅, 파일, 도우미, 기본 설정만 표시합니다.', switchLabel: '간단 모드 사용', currentLabel: '간단 모드 사용 중' }, expert: { label: '전문가', description: '공급자, 런타임, 개인정보, 진단 설정을 표시합니다.', switchLabel: '전문가 모드 사용', currentLabel: '전문가 모드 사용 중' } } },
  chat: { sectionLabel: '채팅', defaultTitle: 'Hermes에게 묻기', defaultAssistant: '기본 도우미', addFile: '파일 추가', addCompanyMaterial: '회사 자료 추가', openCompanyKnowledgeAria: '회사 지식 베이스 열기', selectedFiles: (count) => `${count}개 파일`, selectedCompanyMaterials: (count) => `${count}개 회사 자료`, you: '나', emptyTitle: '이 Mac에서 Hermes에게 무엇이든 물어보세요.', emptyDescription: '로컬 내용에 기반한 답변이 필요하면 파일을 첨부하세요.', openSetup: '설정 열기', addApiKey: 'API Key 추가', openSourcesAria: '파일 열기', messageAria: '메시지', placeholderReady: 'Hermes에게 묻기...', placeholderNotReady: '먼저 Hermes 시작', startBeforeSend: '메시지를 보내기 전에 Hermes를 시작하세요.', newConversation: '새 Hermes 대화', newAssistantConversation: (name) => `${name} 채팅`, emptyActions: { quickChat: { title: '질문하기', description: '일반 채팅을 시작하고 Hermes가 이 Mac의 맥락으로 답하게 합니다.', action: '채팅 시작', prompt: '이 일을 정리하는 데 도움을 주세요.' }, companyKnowledge: { title: '회사 자료 정리', description: '제품, 가격, 인증, 물류, 결제 조건을 Hermes에게 알려줍니다.', action: '회사 자료 열기', prompt: '회사 자료를 바탕으로 이 질문에 답해 주세요.' }, addFiles: { title: '파일로 채팅', description: '로컬 파일을 추가해 답변에 내 문맥을 사용합니다.', action: '파일 추가', prompt: '추가한 파일을 요약해 주세요.' }, createAssistant: { title: '도우미 만들기', description: '자주 하는 작업을 위한 재사용 가능한 도우미를 만듭니다.', action: '도우미 만들기', prompt: '이 작업 흐름을 위한 도우미를 만들어 주세요.' } } },
  session: { count: (count) => `${count}개 대화`, newSessionAria: '새 대화', closeAria: '대화 목록 닫기', searchAria: '대화 검색', searchPlaceholder: '검색', titleAria: '대화 제목', saveTitleAria: '제목 저장', renameAria: (title) => `${title} 이름 바꾸기`, deleteAria: (title) => `${title} 삭제`, messages: (count) => `${count}개 메시지`, noMatch: '일치하는 대화 없음', tryAnother: '다른 단어를 시도하세요', newConversation: '새 대화', startWithHermes: 'Hermes로 시작' },
  files: { title: '파일', attachLocalFiles: '로컬 파일 첨부', attached: (count) => `${count}개 첨부됨`, closeAria: '파일 패널 닫기', addFiles: '파일 추가', uploading: '업로드 중...', supportedTypes: 'PDF, 문서, 메모, 코드, 이미지', preview: '미리보기', closePreviewAria: '미리보기 닫기', noPreview: '아직 읽을 수 있는 미리보기가 없습니다.', fileNameAria: '파일 이름', saveFileNameAria: '파일 이름 저장', previewAria: (name) => `${name} 미리보기`, downloadAria: (name) => `${name} 다운로드`, copyAria: (name) => `${name} 복사`, renameAria: (name) => `${name} 이름 바꾸기`, deleteAria: (name) => `${name} 삭제`, empty: '아직 파일이 없습니다. 파일을 추가하면 답변에 사용할 수 있습니다.', actions: { summarize: { label: '요약', description: '선택한 파일을 짧은 개요로 바꿉니다.', prompt: '이 파일을 쉬운 말로 요약해 주세요.' }, keyPoints: { label: '핵심 찾기', description: '중요한 사실, 결정, 위험을 뽑아냅니다.', prompt: '이 파일의 핵심을 찾아 주세요.' }, askFile: { label: '파일에 질문', description: '선택한 파일에 대해 구체적으로 질문합니다.', prompt: '이 파일을 먼저 사용해서 제 질문에 답해 주세요.' }, actionPlan: { label: '실행 계획', description: '파일을 다음 단계와 담당자로 정리합니다.', prompt: '이 파일을 실행 가능한 계획으로 바꿔 주세요.' } }, status: { ready: '준비됨', needsRetry: '재시도 필요', gettingReady: '준비 중', added: '추가됨' } },
  companyKnowledge: {
    eyebrow: '회사 AI',
    title: '회사 지식 베이스',
    subtitle: 'Hermes가 답변에 참고할 회사 자료를 관리합니다.',
    profileTitle: '회사 프로필',
    materialsTitle: '회사 자료',
    addFiles: '회사 자료 추가',
    uploading: '업로드 중...',
    supportedTypes: 'PDF, 문서, 메모, 웹 텍스트, 이미지',
    empty: '아직 회사 자료가 없습니다. 추가하면 Hermes가 회사 맥락으로 답할 수 있습니다.',
    noPreview: '저장되었습니다. 이미지와 바이너리 파일은 비전 또는 추출 모델이 필요합니다.',
    categoryForNewFiles: '새 파일 유형',
    fields: { name: '회사명', website: '웹사이트', markets: '대상 시장', mainProducts: '주요 제품', certifications: '인증', paymentTerms: '결제 조건', shippingTerms: '물류 조건', brandVoice: '브랜드 톤', notes: '중요 메모' },
    categories: { 'company-profile': '회사 프로필', 'product-catalog': '제품 카탈로그', 'price-list': '가격표', certification: '인증', 'shipping-logistics': '배송 및 물류', 'payment-terms': '결제 조건', faq: 'FAQ', 'case-study': '사례', other: '기타' },
  },
  keyNudge: { pasteOneKey: 'API Key 하나를 붙여넣으세요. 새 채팅에서 자동으로 사용됩니다.', pasteKeyFirst: '먼저 API Key를 붙여넣으세요.', saving: '저장 중...', savedCanSend: '저장됨. 이제 보낼 수 있습니다.', save: '저장' },
  gateway: { restartTitle: 'Hermes를 다시 시작해야 합니다.', notReadyTitle: 'Hermes가 아직 준비되지 않았습니다.', startHermes: 'Hermes 시작', tryAgain: '다시 시도', details: '자세히', setup: '설정', starting: 'Hermes가 시작 중입니다. 보통 잠시 후 완료됩니다.', failed: '다시 시도하세요. 계속 실패하면 설정을 여세요.', notInstalled: '비공개 로컬 채팅을 사용하려면 Hermes를 설정하세요.', paused: '메시지를 보내기 전에 Hermes를 시작하세요.' },
  runtime: {
    setupTitle: 'Hermes 설정', updateTitle: 'Hermes 설정', status: { setupNeeded: '설정 필요', ready: '준비됨', starting: 'Hermes 시작 중', restart: 'Hermes 다시 시작 필요', paused: 'Hermes 일시 중지됨' },
    action: { settingUp: 'Hermes 설정 중...', setUp: 'Hermes 설정', needsSetup: 'Hermes 설정 필요', updating: 'Hermes 업데이트 중...', update: 'Hermes 업데이트', current: 'Hermes가 최신 상태입니다' },
    title: { setupRetry: '설정을 다시 시도해야 합니다.', settingUp: 'Hermes를 설정하는 중입니다.', setupOnce: '이 Mac에서 Hermes를 한 번 설정합니다.', hasUpdate: 'Hermes 업데이트가 있습니다.', ready: 'Hermes가 준비되었습니다.', needsRepair: 'Hermes 복구가 필요합니다.', installed: 'Hermes가 설치되어 있습니다.' },
    description: { checking: 'Hermes 공식 출처에서 업데이트를 확인 중입니다.', updateAvailable: '새 공식 Hermes 릴리스가 있습니다. 준비되면 업데이트하세요.', unknown: 'Hermills가 공식 출처를 확인하지 못했습니다. 로컬 Hermes는 계속 사용할 수 있습니다.', current: 'Hermills는 Hermes 공식 출처를 확인하고 새 버전이 있을 때만 업데이트 버튼을 표시합니다.' },
    summary: { checking: '공식 Hermes 업데이트 확인 중', ready: '업데이트 확인 준비됨', updateFound: '새 Hermes 버전 발견', couldNotFinish: '업데이트 확인을 완료하지 못함', current: 'Hermes가 최신 상태입니다' },
    meta: { installed: '설치됨', latest: '최신', lastCheck: '마지막 확인', localChat: '로컬 채팅', ready: '준비됨', notStarted: '시작 안 됨', unknown: '알 수 없음' },
    buttons: { checkUpdates: '업데이트 확인', checking: '확인 중...', startHermes: 'Hermes 시작', copyReport: '보고서 복사', repairOptions: '복구 옵션', repairInstall: '설치 복구' },
    repair: { title: '로컬 Hermes 복구', description: '로컬 설치가 망가졌을 때만 사용하세요. 일반 업데이트는 위에 표시됩니다.' },
    steps: { 'not-installed': '시작 대기', ready: '준비됨', failed: '재시도 필요', 'needs-user-action': '확인 필요', checking: '설치 패키지 확인', downloading: '설치 파일 다운로드', installing: 'Hermes 설치', configuring: '로컬 채팅 준비', starting: 'Hermes 시작', verifying: '채팅 준비 확인' },
    waiting: '대기 중', detail: (installed, latest) => `로컬 ${installed}. 공식 ${latest}.`, runningUpdateCheck: 'Hermes 업데이트 확인 중...', installMessages: { checkingUpdate: 'Hermes 업데이트 확인 중...', checkingSetup: 'Hermes 설정 확인 중...', updateFailed: '업데이트 실패. Hermes는 현재 버전을 계속 사용할 수 있습니다.', setupFailed: '설정 실패. 보고서를 복사한 뒤 다시 시도하세요.' },
  },
  personalization: { eyebrow: '개인 설정', title: '언어와 스타일', language: '언어', theme: '테마', userName: '내 이름', agentName: '도우미 이름', memoryOn: '메모리 켜기', workspacePath: '작업 공간 경로', chooseFolder: '폴더 선택', runSetupAgain: '설정 다시 실행', missingAgentName: '저장하기 전에 도우미 이름을 입력하세요.', noDirectoryPicker: '이 빌드에서는 폴더 선택기를 사용할 수 없습니다. 경로를 직접 입력하세요.' },
  assistant: {
    drawerTitle: '도우미', drawerSubtitle: 'Hermes를 내 방식으로', closeAria: '도우미 패널 닫기', sectionEyebrow: '내 도우미', createTitle: '도우미 만들기', editTitle: '도우미 편집', new: '새로 만들기', create: '만들기', saveChanges: '변경 저장', saving: '저장 중', name: '이름', helpWith: '무엇을 도와줄까요?', behavior: '어떻게 일할까요?', starters: '시작 질문', useFiles: '파일 사용', rememberContext: '문맥 기억', useTools: '도구 사용', modelOptions: '모델 옵션', provider: '공급자', localHermes: '로컬 Hermes', savedAgents: '저장된 도우미', ready: '준비됨', noAssistants: '아직 도우미가 없습니다. 템플릿을 골라 하나 만드세요.', use: '사용', chat: '채팅', copyAria: (name) => `${name} 복사`, deleteAria: (name) => `${name} 삭제`, deleteConfirm: (name) => `${name}을 삭제할까요? 기존 채팅은 남지만 이 도우미는 제거됩니다.`, copyName: (name) => `${name} 복사본`, validation: '이름을 입력하고 이 도우미가 할 일을 적어주세요.',
    quickCreate: { title: '한 번에 도우미 만들기', description: '역할을 고르면 Hermes가 바로 쓸 수 있는 도우미를 만듭니다.', action: '한 번에 만들기', creating: '도우미 만드는 중...', created: '도우미가 만들어졌습니다. 이제 채팅할 수 있습니다.' },
    roleCards: { study: { title: '학습 도우미', description: '노트, 수업, 어려운 주제를 단계별로 설명합니다.', action: '학습 도우미 만들기', defaultName: '학습 도우미', defaultInstructions: '명확하게 설명하고 작업을 작은 단계로 나누며, 유용한 질문 하나로 이해를 확인하세요.', starter: '이걸 쉽게 설명해줘' }, writing: { title: '글쓰기 도우미', description: '초안, 수정, 요약, 다듬기를 합니다.', action: '글쓰기 도우미 만들기', defaultName: '글쓰기 도우미', defaultInstructions: '사용자의 말투를 유지하고 군더더기를 줄이며, 먼저 명확한 표현으로 고친 뒤 변경점을 설명하세요.', starter: '더 명확하게 고쳐줘' }, code: { title: '코드 도우미', description: '코드를 읽고 문제를 찾으며 실용적인 수정안을 제안합니다.', action: '코드 도우미 만들기', defaultName: '코드 도우미', defaultInstructions: '먼저 문맥을 읽고 진짜 문제를 찾은 뒤 구체적인 코드 수준 조언을 주세요.', starter: '여기 버그 찾아줘' }, files: { title: '파일 분석가', description: '업로드 파일을 바탕으로 답하고 계획으로 정리합니다.', action: '파일 분석가 만들기', defaultName: '파일 분석가', defaultInstructions: '첨부 파일을 먼저 사용하고 사실과 추측을 구분하며 마지막에 다음 유용한 행동을 제시하세요.', starter: '이 파일들 요약' } },
    defaultForm: { name: '조사 파트너', description: '로컬 Hermes Agent 도구, 메모리, 스킬, 업로드 문맥을 사용합니다.', instructions: '첨부 자료를 먼저 사용하세요. 불확실한 점을 설명하고 다음 행동을 추천하세요.', starters: '이 파일 요약\n간단한 실행 계획 만들기' },
    templates: [
      { id: 'study', label: '학습 도우미', description: '어려운 내용을 쉬운 단계로 설명합니다.', form: { name: '학습 도우미', description: '수업, 노트, 어려운 주제를 쉬운 단계로 설명합니다.', instructions: '친절한 선생님처럼 가르치세요. 답을 작은 단계로 나누고 전제를 확인하며, 도움이 되면 연습 문제 하나를 주세요.', starters: '이걸 쉽게 설명해줘\n이 주제로 퀴즈 내줘' } },
      { id: 'writing', label: '글쓰기 도우미', description: '초안, 수정, 다듬기를 도와줍니다.', form: { name: '글쓰기 도우미', description: '글 초안, 수정, 요약, 다듬기를 도와줍니다.', instructions: '명확하게 쓰도록 돕습니다. 사용자의 말투를 유지하고 군더더기를 줄인 뒤, 먼저 더 짧은 버전을 보여주고 변경점을 설명하세요.', starters: '더 명확하게 고쳐줘\n더 짧게 만들어줘' } },
      { id: 'code', label: '코드 도우미', description: '코드를 읽고 수정 방법을 설명합니다.', form: { name: '코드 도우미', description: '코드를 설명하고 버그를 찾으며 실용적인 수정안을 제안합니다.', instructions: '실용적인 소프트웨어 엔지니어처럼 행동하세요. 먼저 문맥을 읽고 진짜 문제를 찾은 뒤 구체적인 코드 수준 조언을 주세요.', starters: '여기 버그 찾아줘\n이 코드 설명해줘', tools: true } },
      { id: 'files', label: '파일 분석가', description: '업로드 파일을 바탕으로 답합니다.', form: { name: '파일 분석가', description: '업로드된 파일을 읽고 답변, 요약, 계획으로 바꿉니다.', instructions: '첨부 파일을 먼저 사용하세요. 필요하면 파일명을 말하고, 사실과 추측을 구분하며, 마지막에 다음 유용한 행동을 제시하세요.', starters: '이 파일들 요약\n중요한 점 찾아줘', files: true } },
    ],
  },
  profile: { eyebrow: '분리된 로컬 작업 공간', title: '사용자 프로필', newNamePlaceholder: '새 프로필 이름', newNameAria: '새 프로필 이름', add: '추가', profileNameAria: '프로필 이름', saveProfileAria: '프로필 저장', activeNow: '현재 사용 중', clickToUse: '클릭해서 사용', renameAria: (name) => `${name} 이름 바꾸기`, deleteAria: (name) => `${name} 삭제`, rulesTitle: '로컬 프로필 규칙', keepChatsLocal: '채팅을 로컬에 저장', keepFilesLocal: '파일을 로컬에 저장', shareWithTeam: '팀과 프로필 공유' },
  keys: { readySummary: (providers, agents) => `${providers}개 공급자를 ${agents}개 도우미에서 사용 가능`, title: 'API Key', saveKey: '키 저장', advancedDetails: '고급 자세히', hideDetails: '자세히 숨기기', savedHelp: '저장된 키는 로컬에서 암호화됩니다. 첫 번째로 저장한 공급자가 새 채팅에 자동으로 사용됩니다.', noModels: '동기화된 모델 없음', noKeySaved: '저장된 키 없음', noProviders: '저장된 공급자 키가 없습니다.', test: '테스트', models: '모델', defaults: '기본값', maskKeys: '키 숨기기', confirmDestructiveTools: '위험한 도구는 확인하기', allowExternalTools: '외부 도구 허용', form: { pasteKeyFirst: '먼저 API Key를 붙여넣으세요.', saving: '키 저장 중...', saved: '저장됨. 새 채팅에서 이 키를 사용합니다.', testing: '테스트 중...', connected: '연결됨', checkingModels: '모델 확인 중...' } },
  diagnostics: { runtime: '런타임', conversations: '대화', sources: '소스', companyKnowledge: '회사 지식', keys: '키', agents: '에이전트', tokens: '토큰', storage: '저장 공간', jobs: '작업', channels: '채널', logs: '로그', localChatHistory: '로컬 채팅 기록', uploadedLocalContext: '업로드된 로컬 문맥', uploadedCompanyContext: '업로드된 회사 맥락', storedProviderEntries: '저장된 공급자', savedInstructionProfiles: '저장된 지시 프로필', tokenDetail: (input, output) => `${input} 입력 / ${output} 출력`, localFiles: (count) => `${count}개 로컬 파일`, companyMaterials: (count) => `${count}개 회사 자료`, jobDetail: (runs, failed) => `${runs}회 실행 / ${failed}회 실패`, channelDetail: (count) => `${count}개 설정됨`, logDetail: (count) => `${count}개 오류` },
  settings: { normal: { title: '설정', description: '일상 설정을 쉽게 찾을 수 있게 합니다.', sections: { general: { title: '일반', description: '이름, 언어, 기본 작업 공간 동작.' }, appearance: { title: '화면', description: '테마와 표시 설정.' }, workspace: { title: '작업 공간', description: '로컬 폴더와 파일 기본값.' }, assistants: { title: '도우미', description: '기본 도우미와 빠른 만들기 옵션.' } } }, expert: { title: '전문가 설정', description: '로컬 런타임, 공급자, 개인정보, 진단 제어.', warning: '이 설정을 바꾸면 시작, 모델 접근, 로컬 데이터에 영향을 줄 수 있습니다.', sections: { providers: { title: '공급자', description: 'API Key, Base URL, 모델, 연결 테스트.' }, runtime: { title: '런타임', description: '로컬 Hermes 설치, 업데이트, 복구, 시작 상태.' }, privacy: { title: '개인정보', description: '로컬 저장소, 메모리, 파일, 도구 권한.' }, diagnostics: { title: '진단', description: '상태 점검, 로그, 토큰 사용량, 문제 해결 데이터.' } } } },
  errors: { title: '확인이 필요합니다', retry: '다시 시도', copyDetails: '자세히 복사', openSettings: '설정 열기', withDetail: (message) => `자세히: ${message}`, friendly: { runtimeUnavailable: { title: 'Hermes가 실행 중이 아닙니다', message: '로컬 채팅은 먼저 Hermes를 시작해야 합니다.', recovery: 'Hermes를 다시 시작하세요. 계속 실패하면 전문가 설정을 열고 보고서를 복사하세요.' }, providerMissing: { title: '모델 공급자가 없습니다', message: '클라우드 모델을 사용하려면 공급자를 저장해야 합니다.', recovery: '설정에서 API Key를 추가하거나 준비된 로컬 Hermes를 사용하세요.' }, apiKeyInvalid: { title: 'API Key를 사용할 수 없습니다', message: '공급자가 이 키를 거부했거나 Base URL이 잘못되었습니다.', recovery: '키, Base URL, 기본 모델을 확인한 뒤 다시 테스트하세요.' }, messageFailed: { title: '메시지를 보내지 못했습니다', message: 'Hermes가 이 요청을 완료하지 못했습니다.', recovery: '한 번 다시 시도하세요. 계속 실패하면 자세히를 복사해 진단하세요.' }, fileUploadFailed: { title: '파일을 추가하지 못했습니다', message: 'Hermes가 이 파일을 읽거나 저장할 수 없습니다.', recovery: '다른 파일을 시도하거나 먼저 로컬 폴더로 옮기세요.' }, fileTooLarge: { title: '파일이 너무 큽니다', message: '이 파일은 현재 Hermes가 처리할 수 있는 크기를 넘습니다.', recovery: '더 작은 파일로 나누고 필요한 부분만 추가하세요.' }, assistantCreateFailed: { title: '도우미를 만들지 못했습니다', message: 'Hermes가 이 도우미를 저장할 수 없습니다.', recovery: '이름과 지시문을 확인한 뒤 다시 시도하세요.' }, unknown: { title: '예상하지 못한 문제입니다', message: 'Hermes가 이해하지 못한 문제가 발생했습니다.', recovery: '다시 시도하세요. 반복되면 자세히를 복사하세요.' } } },
  format: { usage: (input, output, total) => `약 ${input} 입력 / ${output} 출력 / ${total} tokens` },
  providerStatus: { connected: '연결됨', missing: '키 없음', invalid: '잘못됨' },
})

const uiCopies: Record<UiLanguage, UiCopy> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  ko,
  en,
}

export function getUiCopy(language: UiLanguage | string | undefined): UiCopy {
  return uiCopies[isUiLanguage(language) ? language : 'en']
}

export function isUiLanguage(language: string | undefined): language is UiLanguage {
  return language === 'zh-CN' || language === 'zh-TW' || language === 'ja' || language === 'ko' || language === 'en'
}

function withOverrides<T extends Record<string, unknown>>(base: T, overrides: PartialDeep<T>): T {
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    const current = result[key]
    if (isPlainObject(current) && isPlainObject(value)) result[key] = withOverrides(current, value)
    else result[key] = value
  }
  return result as T
}

type PartialDeep<T> = {
  [K in keyof T]?: T[K] extends (...args: any[]) => unknown ? T[K] : T[K] extends Array<infer U> ? Array<PartialDeep<U>> : T[K] extends Record<string, unknown> ? PartialDeep<T[K]> : T[K]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
