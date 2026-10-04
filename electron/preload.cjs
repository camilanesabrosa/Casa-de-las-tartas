const { contextBridge, ipcRenderer } = require("electron");

// No generic IPC, filesystem access, URLs or installer paths cross this bridge.
contextBridge.exposeInMainWorld(
  "casaDesktop",
  Object.freeze({
    platform: process.platform,
    business: Object.freeze({
      onChange: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on("casa:business:changed", listener);
        return () => ipcRenderer.removeListener("casa:business:changed", listener);
      },
    }),
    updates: Object.freeze({
      getState: () => ipcRenderer.invoke("casa:updates:state"),
      check: () => ipcRenderer.invoke("casa:updates:action", "check"),
      download: () => ipcRenderer.invoke("casa:updates:action", "download"),
      install: () => ipcRenderer.invoke("casa:updates:action", "install"),
      dismiss: () => ipcRenderer.invoke("casa:updates:action", "dismiss"),
      skip: () => ipcRenderer.invoke("casa:updates:action", "skip"),
      setAutomatic: (enabled) => ipcRenderer.invoke("casa:updates:action", "automatic", enabled),
      onStateChange: (callback) => {
        const listener = (_event, state) => callback(state);
        ipcRenderer.on("casa:updates:changed", listener);
        return () => ipcRenderer.removeListener("casa:updates:changed", listener);
      },
    }),
    drive: Object.freeze({
      getState: () => ipcRenderer.invoke("casa:drive:state"),
      connect: () => ipcRenderer.invoke("casa:drive:action", "connect"),
      backupNow: () => ipcRenderer.invoke("casa:drive:action", "backup"),
      listBackups: () => ipcRenderer.invoke("casa:drive:action", "list"),
      restoreBackup: (id) => ipcRenderer.invoke("casa:drive:action", "restore", id),
      disconnect: () => ipcRenderer.invoke("casa:drive:action", "disconnect"),
      markReady: () => ipcRenderer.send("casa:drive:ready"),
      dataChanged: () => ipcRenderer.send("casa:drive:data-changed"),
      onStateChange: (callback) => {
        const listener = (_event, state) => callback(state);
        ipcRenderer.on("casa:drive:changed", listener);
        return () => ipcRenderer.removeListener("casa:drive:changed", listener);
      },
    }),
  }),
);
