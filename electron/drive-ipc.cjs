function trustedSender(event, window, origin) {
  try {
    return Boolean(window && !window.isDestroyed() && event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame && new URL(event.senderFrame.url).origin === origin);
  } catch { return false; }
}

function registerDriveIpc({ ipcMain, window, origin, controller, restoreBackup }) {
  const verify = (event) => {
    if (!trustedSender(event, window, origin)) throw new Error("Solicitud de Google Drive no autorizada.");
  };
  const getState = async (event) => { verify(event); return controller.getState(); };
  ipcMain.handle("casa:drive:state", getState);
  ipcMain.handle("casa:drive:action", async (event, action, value) => {
    verify(event);
    switch (action) {
      case "connect":
        await controller.authorize();
        controller.emit();
        return controller.backupNow("automatic");
      case "backup": return controller.backupNow("manual");
      case "list": return controller.listBackups();
      case "restore": return restoreBackup(value);
      case "disconnect": return controller.disconnect();
      default: throw new Error("Acción de Google Drive no válida.");
    }
  });
  ipcMain.on("casa:drive:ready", (event) => {
    try { verify(event); void controller.markReady().catch((error) => console.error(error)); }
    catch (error) { console.error(error); }
  });
  ipcMain.on("casa:drive:data-changed", (event) => {
    try { verify(event); controller.notifyDataChanged(); }
    catch (error) { console.error(error); }
  });
  return () => {
    ipcMain.removeHandler("casa:drive:state");
    ipcMain.removeHandler("casa:drive:action");
    ipcMain.removeAllListeners("casa:drive:ready");
    ipcMain.removeAllListeners("casa:drive:data-changed");
  };
}

module.exports = { registerDriveIpc };
