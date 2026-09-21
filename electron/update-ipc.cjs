const STATUS_CHANNEL = "casa:updates:state";
const ACTION_CHANNEL = "casa:updates:action";
const CHANGED_CHANNEL = "casa:updates:changed";

function trustedSender(event, window, origin) {
  try {
    return Boolean(window && !window.isDestroyed() && event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame && new URL(event.senderFrame.url).origin === origin);
  } catch { return false; }
}

function registerUpdateIpc({ ipcMain, window, origin, controller }) {
  const verify = (event) => {
    if (!trustedSender(event, window, origin)) throw new Error("Solicitud de actualización no autorizada.");
  };
  ipcMain.handle(STATUS_CHANNEL, (event) => { verify(event); return controller.getState(); });
  ipcMain.handle(ACTION_CHANNEL, (event, action, value) => {
    verify(event);
    switch (action) {
      case "check": return controller.check();
      case "download": return controller.download();
      case "install": return controller.install();
      case "dismiss": return controller.dismiss();
      case "skip": return controller.skip();
      case "automatic": return controller.setAutomatic(value);
      default: throw new Error("Acción de actualización inválida.");
    }
  });
  return () => { ipcMain.removeHandler(STATUS_CHANNEL); ipcMain.removeHandler(ACTION_CHANNEL); };
}

module.exports = { registerUpdateIpc, trustedSender, CHANGED_CHANNEL };
