const { contextBridge, ipcRenderer } = require("electron");

// No generic IPC, filesystem access, URLs or installer paths cross this bridge.
contextBridge.exposeInMainWorld(
  "casaDesktop",
  Object.freeze({
    platform: process.platform,
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
  }),
);
