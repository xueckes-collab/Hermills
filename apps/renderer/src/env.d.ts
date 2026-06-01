/// <reference types="vite/client" />

interface HermillsDesktopConfig {
  apiBaseUrl: string
  desktopToken?: string
  platform: string
  version: string
}

interface HermillsDesktopDirectorySelection {
  canceled: boolean
  path?: string
}

interface Window {
  hermillsDesktop?: {
    getConfig: () => Promise<HermillsDesktopConfig>
    selectWorkspaceDirectory: () => Promise<HermillsDesktopDirectorySelection>
  }
}
