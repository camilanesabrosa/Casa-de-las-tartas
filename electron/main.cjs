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
} = require("electron");
const { fork } = require("node:child_process");
const { createServer } = require("node:net");
const { join } = require("node:path");
const { mkdirSync } = require("node:fs");

const SERVER = join(__dirname, "..", "dist", "standalone", "server.js");
const HOST = "127.0.0.1";
// electron-builder removes the build configuration from the packaged manifest.
const APP_NAME = "Casa de las Tartas";
const ICON = join(__dirname, "assets", "icon.png");

// Branding must never move an existing installation's SQLite file or settings.
const dataDirectory = join(app.getPath("appData"), "mostrador");
mkdirSync(dataDirectory, { recursive: true });
app.setPath("userData", dataDirectory);
app.setName(APP_NAME);
if (process.platform === "win32")
  app.setAppUserModelId("dev.sinnick.mostrador");

let server;
let window;

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
    if (!app.isQuitting && code !== 0) {
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
    void shell.openExternal(target);
    return { action: "deny" };
  });
  void window.loadURL(url);
}

app.whenReady().then(async () => {
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
  if (server && server.exitCode === null) server.kill();
});

app.on("window-all-closed", () => app.quit());
