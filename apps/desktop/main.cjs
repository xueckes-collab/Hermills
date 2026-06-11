const { randomUUID } = require("node:crypto");
const { existsSync } = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, dialog, ipcMain, Menu, shell, Tray } = require("electron");

let mainWindow;
let tray;
let isQuitting = false;
let serverInstance;
let apiBaseUrl = allowDevEndpoints() ? process.env.HERMILLS_SERVER_URL : undefined;
const desktopToken = process.env.HERMILLS_DESKTOP_TOKEN || randomUUID();

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
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Hermills", click: () => { void showMainWindow(); } },
    { type: "separator" },
    {
      label: "Quit Hermills",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
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

async function startServerIfNeeded() {
  if (apiBaseUrl) return;
  const port = await findOpenPort(47321);
  const serverPath = pathToFileURL(path.join(app.getAppPath(), "apps", "server", "dist", "index.js")).href;
  const { createServer } = await import(serverPath);
  serverInstance = await createServer({ host: "127.0.0.1", port, baseDir: app.getPath("userData"), desktopToken });
  await serverInstance.listen({ host: "127.0.0.1", port });
  apiBaseUrl = `http://127.0.0.1:${port}`;
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
