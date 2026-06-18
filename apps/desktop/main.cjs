const { randomUUID } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, dialog, ipcMain, Menu, shell, Tray } = require("electron");

let autoUpdater;
try {
  ({ autoUpdater } = require("electron-updater"));
} catch (error) {
  autoUpdater = undefined;
}

let mainWindow;
let tray;
let isQuitting = false;
let serverInstance;
let apiBaseUrl = allowDevEndpoints() ? process.env.HERMILLS_SERVER_URL : undefined;
const desktopToken = process.env.HERMILLS_DESKTOP_TOKEN || randomUUID();
const appUpdateState = {
  configured: false,
  checking: false,
  downloading: false,
  promptOpen: false,
  manualCheck: false,
  downloadedInfo: undefined
};

async function createWindow() {
  await startServerIfNeeded();
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    title: "Hermills",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: "#f3f1eb",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs")
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  const rendererUrl = allowDevEndpoints() ? process.env.HERMILLS_RENDERER_URL : undefined;
  if (rendererUrl) await mainWindow.loadURL(rendererUrl);
  else await mainWindow.loadFile(path.join(app.getAppPath(), "apps", "renderer", "dist", "index.html"));
}

async function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    await createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return tray;
  tray = new Tray(getTrayIconPath());
  tray.setToolTip("Hermills");
  const trayItems = [
    { label: "Show Hermills", click: () => { void showMainWindow(); } },
    { label: "Check for Updates...", click: () => { void checkForAppUpdates(true); } },
    { type: "separator" },
    {
      label: "Quit Hermills",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(trayItems));
  tray.on("click", () => { void showMainWindow(); });
  tray.on("double-click", () => { void showMainWindow(); });
  return tray;
}

function getTrayIconPath() {
  const iconNames = process.platform === "win32" ? ["icon.ico", "icon.png"] : ["icon.png", "icon.ico"];
  const iconRoots = app.isPackaged
    ? [path.join(process.resourcesPath, "build"), path.join(app.getAppPath(), "build")]
    : [path.join(app.getAppPath(), "build")];
  for (const iconRoot of iconRoots) {
    for (const iconName of iconNames) {
      const iconPath = path.join(iconRoot, iconName);
      if (existsSync(iconPath)) return iconPath;
    }
  }
  return path.join(iconRoots[0], iconNames[0]);
}

function allowDevEndpoints() {
  return !app.isPackaged;
}

function configureAppUpdates() {
  if (appUpdateState.configured || !autoUpdater) return;
  appUpdateState.configured = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.logger = null;
  autoUpdater.on("checking-for-update", () => {
    appUpdateState.checking = true;
  });
  autoUpdater.on("update-not-available", (info) => {
    const manual = appUpdateState.manualCheck;
    appUpdateState.checking = false;
    appUpdateState.manualCheck = false;
    if (manual) void showNoAppUpdateDialog(info);
  });
  autoUpdater.on("update-available", (info) => {
    appUpdateState.checking = false;
    appUpdateState.manualCheck = false;
    void promptForAppUpdateDownload(info);
  });
  autoUpdater.on("download-progress", () => {
    appUpdateState.downloading = true;
  });
  autoUpdater.on("update-downloaded", (info) => {
    appUpdateState.downloading = false;
    appUpdateState.downloadedInfo = info;
    void promptForDownloadedAppUpdate(info);
  });
  autoUpdater.on("error", (error) => {
    const manual = appUpdateState.manualCheck;
    appUpdateState.checking = false;
    appUpdateState.downloading = false;
    appUpdateState.manualCheck = false;
    console.warn("Hermills app update failed:", error);
    if (manual) void showAppUpdateErrorDialog(error);
  });
}

async function checkForAppUpdates(manual = false) {
  configureAppUpdates();
  if (!app.isPackaged || !autoUpdater) {
    if (manual) {
      await showAppUpdateDialog({
        type: "info",
        buttons: ["OK"],
        defaultId: 0,
        title: "Hermills updates",
        message: "Updates are available in the installed Windows app.",
        detail: "Developer builds do not check GitHub releases automatically."
      });
    }
    return;
  }
  if (appUpdateState.downloadedInfo) {
    await promptForDownloadedAppUpdate(appUpdateState.downloadedInfo);
    return;
  }
  if (appUpdateState.downloading) {
    if (manual) {
      await showAppUpdateDialog({
        type: "info",
        buttons: ["OK"],
        defaultId: 0,
        title: "Hermills update",
        message: "Hermills is already downloading an update.",
        detail: "You can keep using the app. Hermills will ask again when the download is ready to install."
      });
    }
    return;
  }
  if (appUpdateState.checking) {
    if (manual) {
      await showAppUpdateDialog({
        type: "info",
        buttons: ["OK"],
        defaultId: 0,
        title: "Hermills update",
        message: "Hermills is already checking for updates."
      });
    }
    return;
  }
  appUpdateState.manualCheck = manual;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    appUpdateState.checking = false;
    appUpdateState.manualCheck = false;
    console.warn("Hermills app update check failed:", error);
    if (manual) await showAppUpdateErrorDialog(error);
  }
}

async function promptForAppUpdateDownload(info) {
  if (appUpdateState.promptOpen || appUpdateState.downloading) return;
  appUpdateState.promptOpen = true;
  try {
    const result = await showAppUpdateDialog({
      type: "info",
      buttons: ["Download Update", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Hermills update available",
      message: `Hermills ${formatAppUpdateVersion(info)} is available.`,
      detail: "Download the update now? Hermills will ask before restarting to install it."
    });
    if (result.response !== 0) return;
    appUpdateState.downloading = true;
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      appUpdateState.downloading = false;
      console.warn("Hermills app update download failed:", error);
      await showAppUpdateErrorDialog(error);
    }
  } finally {
    appUpdateState.promptOpen = false;
  }
}

async function promptForDownloadedAppUpdate(info) {
  if (appUpdateState.promptOpen) return;
  appUpdateState.promptOpen = true;
  try {
    const result = await showAppUpdateDialog({
      type: "info",
      buttons: ["Restart and Install", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Hermills update ready",
      message: `Hermills ${formatAppUpdateVersion(info)} is ready to install.`,
      detail: "Hermills will close, install the update, and open again when installation finishes."
    });
    if (result.response !== 0) return;
    isQuitting = true;
    autoUpdater.quitAndInstall(false, true);
  } finally {
    appUpdateState.promptOpen = false;
  }
}

async function showNoAppUpdateDialog(info) {
  await showAppUpdateDialog({
    type: "info",
    buttons: ["OK"],
    defaultId: 0,
    title: "Hermills updates",
    message: "Hermills is up to date.",
    detail: `Installed version: ${app.getVersion()}. Latest release: ${formatAppUpdateVersion(info)}.`
  });
}

async function showAppUpdateErrorDialog(error) {
  await showAppUpdateDialog({
    type: "warning",
    buttons: ["OK"],
    defaultId: 0,
    title: "Hermills update failed",
    message: "Hermills could not check for updates right now.",
    detail: error && error.message ? error.message : "Please try again later."
  });
}

function showAppUpdateDialog(options) {
  const ownerWindow = getDialogOwnerWindow();
  return ownerWindow ? dialog.showMessageBox(ownerWindow, options) : dialog.showMessageBox(options);
}

function getDialogOwnerWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return undefined;
  return mainWindow;
}

function formatAppUpdateVersion(info) {
  return info && info.version ? `v${info.version}` : "the latest version";
}

async function startServerIfNeeded() {
  if (apiBaseUrl) return;
  loadCloudConfigEnv();
  const port = await findOpenPort(47321);
  const serverPath = pathToFileURL(path.join(app.getAppPath(), "apps", "server", "dist", "index.js")).href;
  const { createServer } = await import(serverPath);
  serverInstance = await createServer({ host: "127.0.0.1", port, baseDir: app.getPath("userData"), desktopToken });
  await serverInstance.listen({ host: "127.0.0.1", port });
  apiBaseUrl = `http://127.0.0.1:${port}`;
}

function loadCloudConfigEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.HERMILLS_CHAT_RELAY_URL) return;
  const candidates = [
    path.join(app.getPath("userData"), "hermills-cloud.json"),
    process.resourcesPath ? path.join(process.resourcesPath, "hermills-cloud.json") : undefined,
    path.join(app.getAppPath(), "build", "hermills-cloud.json")
  ].filter(Boolean);
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const config = JSON.parse(readFileSync(filePath, "utf8"));
      process.env.SUPABASE_URL ||= stringConfigValue(config.supabaseUrl ?? config.SUPABASE_URL);
      process.env.SUPABASE_ANON_KEY ||= stringConfigValue(config.supabaseAnonKey ?? config.SUPABASE_ANON_KEY);
      process.env.HERMILLS_CLOUD_REQUIRED ||= stringConfigValue(config.cloudRequired ?? config.HERMILLS_CLOUD_REQUIRED) ?? "1";
      process.env.HERMILLS_CHAT_RELAY_URL ||= stringConfigValue(config.chatRelayUrl ?? config.HERMILLS_CHAT_RELAY_URL);
      return;
    } catch (error) {
      console.warn(`Ignoring invalid Hermills cloud config at ${filePath}: ${error && error.message ? error.message : error}`);
    }
  }
}

function stringConfigValue(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  if (normalized.toLowerCase() === "undefined" || normalized.toLowerCase() === "null") return undefined;
  return normalized;
}

function findOpenPort(startPort) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.once("error", (error) => error.code === "EADDRINUSE" ? tryPort(port + 1) : reject(error));
      server.once("listening", () => server.close(() => resolve(port)));
      server.listen(port, "127.0.0.1");
    };
    tryPort(startPort);
  });
}

ipcMain.handle("hermills:get-config", () => ({ apiBaseUrl, desktopToken, platform: process.platform, version: app.getVersion() }));
ipcMain.handle("hermills:select-workspace-directory", async (event) => {
  const ownerWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: "Select workspace directory",
    properties: ["openDirectory", "createDirectory"]
  });
  const selectedPath = result.filePaths[0];
  if (result.canceled || !selectedPath) return { canceled: true };
  return { canceled: false, path: selectedPath };
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await createWindow();
  createTray();
  setTimeout(() => { void checkForAppUpdates(false); }, 6000);
});
app.on("window-all-closed", () => {
  if (isQuitting && process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  void showMainWindow();
});
app.on("before-quit", async () => {
  isQuitting = true;
  if (serverInstance) await serverInstance.close();
});
