const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hermillsDesktop", {
  getConfig: () => ipcRenderer.invoke("hermills:get-config"),
  selectWorkspaceDirectory: () => ipcRenderer.invoke("hermills:select-workspace-directory")
});
