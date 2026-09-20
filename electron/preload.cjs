const { contextBridge } = require("electron");

// Only platform information crosses the isolated renderer boundary.
// Window controls are native, so no privileged IPC is exposed to the page.
contextBridge.exposeInMainWorld(
  "casaDesktop",
  Object.freeze({
    platform: process.platform,
  }),
);
