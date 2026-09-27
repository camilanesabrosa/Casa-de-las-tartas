// Proceso principal de la aplicación de escritorio.
// Levanta el servidor Node del build `app` en 127.0.0.1, con la base SQLite
// guardada junto a los datos del usuario, y lo muestra en una ventana.
const {
  app,
  BrowserWindow,
  shell,
  dialog,
  Menu,
  nativeImage,
  ipcMain,
  safeStorage,
} = require("electron");
const { fork } = require("node:child_process");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { createServer } = require("node:net");
const { join, resolve, isAbsolute } = require("node:path");
const { mkdirSync, existsSync } = require("node:fs");
const { rename, rm } = require("node:fs/promises");
const { UpdateController, unavailableReason } = require("./updater.cjs");
const { openUpdatePreferences } = require("./update-preferences.cjs");
const { registerUpdateIpc, CHANGED_CHANNEL, trustedSender } = require("./update-ipc.cjs");
const { DriveBackupController } = require("./drive-backups.cjs");
const { registerDriveIpc } = require("./drive-ipc.cjs");
const { clientId: driveClientId, clientSecret: driveClientSecret } = require("./drive-config.cjs");

const SERVER = join(__dirname, "..", "dist", "standalone", "server.js");
const HOST = "127.0.0.1";
// electron-builder removes the build configuration from the packaged manifest.
const APP_NAME = "Casa de las Tartas";
const ICON = join(__dirname, "assets", "icon.png");

// Branding must never move an existing installation's SQLite file or settings.
const testDataDirectory = process.env.CASA_TEST_DATA_DIR;
if (testDataDirectory && !isAbsolute(testDataDirectory))
  throw new Error("CASA_TEST_DATA_DIR debe ser una ruta absoluta.");
const dataDirectory = testDataDirectory
  ? resolve(testDataDirectory)
  : join(app.getPath("appData"), "mostrador");
mkdirSync(dataDirectory, { recursive: true });
app.setPath("userData", dataDirectory);
app.setName(APP_NAME);
if (process.platform === "win32")
  app.setAppUserModelId("dev.sinnick.mostrador");

let server;
let window;
let updates;
let updatePreferences;
let removeUpdateIpc;
let driveBackups;
let removeDriveIpc;
let restoring = false;

// The installer must never compete with another running copy of this app.
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on("second-instance", () => {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});

function setupUpdates(url) {
  const origin = new URL(url).origin;
  let reason = unavailableReason({ platform: process.platform, arch: process.arch,
    packaged: app.isPackaged, configured: existsSync(join(process.resourcesPath, "app-update.yml")) });
  let updater = null;
  try {
    updatePreferences = openUpdatePreferences(join(dataDirectory, "business.sqlite"));
    if (!reason) updater = require("electron-updater").autoUpdater;
  } catch (error) {
    console.error("No se pudo iniciar el actualizador:", error);
    reason = "No se pudo iniciar el actualizador. Cerrá y volvé a abrir la app para reintentar.";
  }
  updates = new UpdateController({
    updater, reason, currentVersion: app.getVersion(),
    preferences: updatePreferences || { read: () => ({ automatic: true, skippedVersion: null }) },
    notify: (state) => {
      if (window && !window.isDestroyed() && trustedSender({ sender: window.webContents,
        senderFrame: window.webContents.mainFrame }, window, origin)) {
        window.webContents.send(CHANGED_CHANNEL, state);
      }
    },
    confirmInstall: async (version) => {
      const { response } = await dialog.showMessageBox(window, {
        type: "question",
        title: "Instalar actualización",
        message: `¿Instalar la versión ${version} y reiniciar?`,
        detail: "Guardá los cambios pendientes antes de continuar. La app se cerrará para instalar la actualización. Los datos de tu negocio se conservan.",
        buttons: ["Instalar y reiniciar", "Cancelar"],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      return response === 0;
    },
  });
  removeUpdateIpc = registerUpdateIpc({ ipcMain, window, origin, controller: updates });
  updates.start();
}

function setupDriveBackups(url) {
  const origin = new URL(url).origin;
  driveBackups ||= new DriveBackupController({
    clientId: driveClientId,
    clientSecret: driveClientSecret,
    databasePath: join(dataDirectory, "business.sqlite"),
    statePath: join(dataDirectory, "google-drive.json"),
    safeStorage,
    shell,
    notify: (state) => {
      if (window && !window.isDestroyed() && trustedSender({ sender: window.webContents,
        senderFrame: window.webContents.mainFrame }, window, origin))
        window.webContents.send("casa:drive:changed", state);
    },
  });
  void driveBackups.start().catch((error) => console.error("No se pudieron iniciar los respaldos de Drive:", error));
  removeDriveIpc = registerDriveIpc({
    ipcMain,
    window,
    origin,
    controller: driveBackups,
    restoreBackup: restoreDriveBackup,
  });
}

async function stopServerForRestore() {
  const currentServer = server;
  server = undefined;
  if (!currentServer || currentServer.exitCode !== null) return;
  await new Promise((resolve) => {
    const forceKill = setTimeout(() => {
      currentServer.kill("SIGKILL");
    }, 10_000);
    currentServer.once("exit", () => {
      clearTimeout(forceKill);
      resolve();
    });
    currentServer.kill("SIGTERM");
  });
}

async function restoreDriveBackup(fileId) {
  if (restoring) throw new Error("Ya hay una restauración en curso.");
  restoring = true;
  app.isRestoring = true;
  const databasePath = join(dataDirectory, "business.sqlite");
  const incomingPath = join(dataDirectory, `.restore-${crypto.randomUUID()}.sqlite`);
  let archivedPath = "";
  let serverStopped = false;
  try {
    const backupInfo = await driveBackups.downloadBackup(fileId, incomingPath);
    updates?.stop();
    updatePreferences?.close();
    updatePreferences = undefined;
    await stopServerForRestore();
    serverStopped = true;
    const current = new DatabaseSync(databasePath);
    try { current.exec("PRAGMA wal_checkpoint(TRUNCATE)"); }
    finally { current.close(); }
    await rm(`${databasePath}-wal`, { force: true });
    await rm(`${databasePath}-shm`, { force: true });

    archivedPath = `${databasePath}.pre-restore-${new Date().toISOString().replaceAll(":", "-")}-${crypto.randomUUID().slice(0, 8)}.sqlite`;
    await rename(databasePath, archivedPath);
    try {
      await rename(incomingPath, databasePath);
      const restored = new DatabaseSync(databasePath, { readOnly: true });
      try {
        const integrity = restored.prepare("PRAGMA integrity_check").get();
        if (integrity.integrity_check !== "ok") throw new Error("La base restaurada no pasó la comprobación de integridad.");
      } finally { restored.close(); }
    } catch (error) {
      await rm(databasePath, { force: true }).catch(() => {});
      await rename(archivedPath, databasePath);
      archivedPath = "";
      throw error;
    }
    await dialog.showMessageBox(window, {
      type: "info",
      title: "Respaldo restaurado",
      message: "Se restauró el negocio desde Google Drive.",
      detail: "Casa de las Tartas se cerrará. Abrila de nuevo para continuar.",
      buttons: ["Aceptar"],
      noLink: true,
    });
    app.relaunch();
    app.quit();
    return { restored: true, name: backupInfo.name };
  } catch (error) {
    if (serverStopped) {
      try {
        app.isRestoring = false;
        const url = await start();
        removeUpdateIpc?.();
        updates?.stop();
        setupUpdates(url);
        removeDriveIpc?.();
        setupDriveBackups(url);
        await window.loadURL(url);
      } catch (startError) {
        console.error("No se pudo volver a abrir la base anterior:", startError);
        app.quit();
      }
    }
    throw error;
  } finally {
    restoring = false;
    if (!app.isQuitting) app.isRestoring = false;
    await rm(incomingPath, { force: true }).catch(() => {});
  }
}

// Puerto libre elegido por el sistema: la app no compite con nada del equipo.
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, HOST, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitUntilReady(url, deadlineMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      if (!server || server.exitCode !== null)
        return reject(new Error("El servidor interno se cerró al iniciar."));
      try {
        await fetch(url, { method: "HEAD" });
        return resolve();
      } catch {
        if (Date.now() - started > deadlineMs)
          return reject(
            new Error("El servidor interno no respondió a tiempo."),
          );
        setTimeout(attempt, 250);
      }
    };
    attempt();
  });
}

async function start() {
  const port = await freePort();
  const url = `http://${HOST}:${port}/`;
  server = fork(SERVER, {
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST,
      PORT: String(port),
      MOSTRADOR_DATABASE_PATH: join(app.getPath("userData"), "business.sqlite"),
    },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  server.on("exit", (code) => {
    // Si el servidor muere con la app abierta, no queda una ventana en blanco.
    if (!app.isQuitting && !app.isRestoring && code !== 0) {
      dialog.showErrorBox(
        APP_NAME,
        "El servidor interno se cerró inesperadamente. Volvé a abrir la aplicación.",
      );
      app.quit();
    }
  });
  await waitUntilReady(url);
  return url;
}

function createWindow(url) {
  window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#f5f6f2",
    show: false,
    title: APP_NAME,
    icon: ICON,
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 16, y: 16 } }
      : {
          titleBarOverlay: {
            color: "#f5f6f2",
            symbolColor: "#202722",
            height: 48,
          },
        }),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: join(__dirname, "preload.cjs"),
    },
  });
  window.once("ready-to-show", () => window.show());
  // Cualquier enlace externo abre en el navegador, no dentro de la app.
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target)) void shell.openExternal(target);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== new URL(url).origin) event.preventDefault();
  });
  setupUpdates(url);
  setupDriveBackups(url);
  void window.loadURL(url);
}

if (primaryInstance) app.whenReady().then(async () => {
  if (process.platform === "darwin")
    app.dock.setIcon(nativeImage.createFromPath(ICON));
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: app.getVersion(),
    iconPath: ICON,
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin"
        ? [
            {
              label: APP_NAME,
              submenu: [
                { role: "about", label: `Acerca de ${APP_NAME}` },
                { type: "separator" },
                { role: "hide", label: "Ocultar" },
                { role: "hideOthers", label: "Ocultar otras aplicaciones" },
                { role: "unhide", label: "Mostrar todo" },
                { type: "separator" },
                { role: "quit", label: `Salir de ${APP_NAME}` },
              ],
            },
          ]
        : []),
      {
        label: "Edición",
        submenu: [
          { role: "undo", label: "Deshacer" },
          { role: "redo", label: "Rehacer" },
          { type: "separator" },
          { role: "cut", label: "Cortar" },
          { role: "copy", label: "Copiar" },
          { role: "paste", label: "Pegar" },
          { role: "selectAll", label: "Seleccionar todo" },
        ],
      },
      {
        label: "Ver",
        submenu: [
          { role: "resetZoom", label: "Tamaño real" },
          { role: "zoomIn", label: "Acercar" },
          { role: "zoomOut", label: "Alejar" },
          { type: "separator" },
          { role: "togglefullscreen", label: "Pantalla completa" },
        ],
      },
      {
        label: "Ventana",
        submenu: [
          { role: "minimize", label: "Minimizar" },
          { role: "zoom", label: "Ampliar" },
          { role: "close", label: "Cerrar ventana" },
        ],
      },
    ]),
  );
  try {
    createWindow(await start());
  } catch (error) {
    dialog.showErrorBox(
      APP_NAME,
      `No pudimos abrir el negocio.\n\n${error.message}`,
    );
    app.quit();
    return;
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && window) window.show();
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
  driveBackups?.stop();
  updates?.stop();
  removeUpdateIpc?.();
  removeDriveIpc?.();
  updatePreferences?.close();
  updatePreferences = undefined;
  if (server && server.exitCode === null) server.kill();
});

app.on("window-all-closed", () => app.quit());
