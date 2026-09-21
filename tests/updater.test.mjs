import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import vm from "node:vm";
import updaterModule from "../electron/updater.cjs";
import ipcModule from "../electron/update-ipc.cjs";
import preferenceModule from "../electron/update-preferences.cjs";
import { NsisUpdater } from "electron-updater/out/NsisUpdater.js";
import { ElectronHttpExecutor } from "electron-updater/out/electronHttpExecutor.js";

const { UpdateController, unavailableReason, validRelease, newerVersion } = updaterModule;
const { trustedSender, registerUpdateIpc } = ipcModule;
const { openUpdatePreferences } = preferenceModule;
const release = (version = "0.2.0") => ({ version, releaseNotes: "Nuevo calendario",
  files: [{ url: `Casa-de-las-Tartas-${version}-win-x64-Setup.exe`, sha512: createHash("sha512").update("installer fixture").digest("base64") }] });

function fixture(options = {}) {
  const engine = new EventEmitter();
  engine.checks = engine.downloads = engine.installs = 0;
  engine.info = release();
  engine.checkForUpdates = async () => {
    engine.checks++;
    engine.emit("update-available", engine.info);
    return { updateInfo: engine.info, isUpdateAvailable: true };
  };
  engine.downloadUpdate = async () => {
    engine.downloads++;
    engine.emit("download-progress", { percent: 42.4 });
    engine.emit("update-downloaded", engine.info);
    return ["fixture.exe"];
  };
  engine.quitAndInstall = (...args) => { engine.installs++; engine.installArgs = args; };
  const saved = { automatic: true, skippedVersion: null, ...options.prefs };
  const events = [];
  const scheduled = new Map();
  let timerId = 0;
  const timers = {
    setTimeout: (fn, delay) => { scheduled.set(++timerId, { fn, delay, interval: false }); return timerId; },
    setInterval: (fn, delay) => { scheduled.set(++timerId, { fn, delay, interval: true }); return timerId; },
    clearTimeout: (id) => scheduled.delete(id),
    clearInterval: (id) => scheduled.delete(id),
  };
  const controller = new UpdateController({ updater: engine, currentVersion: "0.1.0",
    preferences: { read: () => ({ ...saved }), write: (key, value) => { saved[key] = value; } },
    notify: (event) => events.push(event), timers, confirmInstall: async () => true, ...options });
  return { controller, engine, saved, events, scheduled };
}

test("actualizador: compara versiones numéricas y rechaza prereleases", () => {
  assert.ok(newerVersion("0.10.0", "0.9.0"));
  for (const version of ["0.1.0", "0.0.9", "v0.2.0", "0.2.0-beta.1", "01.2.0", "bad", null, {}, ["0.2.0"]])
    assert.equal(newerVersion(version, "0.1.0"), false, String(version));
});

test("actualizador: solo acepta nuestro instalador x64 con SHA-512", () => {
  assert.ok(validRelease(release(), "0.1.0"));
  assert.equal(validRelease(release("0.0.1"), "0.1.0"), false);
  for (const url of ["otro.exe", "../../malware.exe", "https://example.com/installer.exe", "Casa-de-las-Tartas-0.2.0-win-ia32-Setup.exe"])
    assert.equal(validRelease({ ...release(), files: [{ ...release().files[0], url }] }, "0.1.0"), false);
  for (const sha512 of [undefined, "", "broken", "a".repeat(128)])
    assert.equal(validRelease({ ...release(), files: [{ ...release().files[0], sha512 }] }, "0.1.0"), false);
  assert.equal(validRelease({ ...release(), files: [] }, "0.1.0"), false);
  assert.equal(validRelease({ ...release(), files: [null] }, "0.1.0"), false);
  assert.equal(validRelease({ ...release(), files: [{}] }, "0.1.0"), false);
});

test("actualizador: nunca descarga ni instala automáticamente", async () => {
  const { controller, engine } = fixture();
  assert.equal(engine.autoDownload, false);
  assert.equal(engine.autoInstallOnAppQuit, false);
  assert.equal(engine.allowDowngrade, false);
  assert.equal(engine.allowPrerelease, false);
  assert.equal(engine.disableWebInstaller, true);
  assert.equal((await controller.check()).phase, "available");
  assert.equal(engine.downloads, 0);
  assert.equal(engine.installs, 0);
});

test("actualizador: descarga con progreso e instala solo tras confirmar", async () => {
  let allow = false;
  const { controller, engine, events } = fixture({ confirmInstall: async () => allow });
  await assert.rejects(controller.install(), /todavía no está lista/);
  await controller.check();
  await controller.download();
  assert.ok(events.some((state) => state.phase === "downloading" && state.progress === 42));
  assert.equal(controller.getState().phase, "downloaded");
  await controller.install();
  assert.equal(engine.installs, 0);
  allow = true;
  await controller.install();
  assert.equal(engine.installs, 1);
  assert.deepEqual(engine.installArgs, [false, true]);
  await assert.rejects(controller.install());
  assert.equal(engine.installs, 1);
});

test("actualizador: fallo de hash o red no habilita instalación y se puede reintentar", async () => {
  const { controller, engine } = fixture();
  await controller.check();
  const successful = engine.downloadUpdate;
  engine.downloadUpdate = async () => { throw new Error("SHA512 checksum mismatch"); };
  assert.equal((await controller.download()).phase, "error");
  await assert.rejects(controller.install());
  assert.equal(engine.installs, 0);
  engine.downloadUpdate = successful;
  assert.equal((await controller.download()).phase, "downloaded");
});

test("actualizador: un error al abrir el instalador permite volver a intentarlo", async () => {
  const { controller, engine } = fixture();
  await controller.check();
  await controller.download();
  engine.quitAndInstall = () => engine.emit("error", new Error("EACCES"));
  assert.equal((await controller.install()).phase, "downloaded");
  assert.match(controller.getState().error, /iniciar el instalador/);
});

test("actualizador: chequeo sin internet no crea un aviso global de descarga", async () => {
  const { controller, engine } = fixture();
  engine.checkForUpdates = async () => { engine.emit("error", new Error("offline")); throw new Error("offline"); };
  const state = await controller.check();
  assert.equal(state.phase, "idle");
  assert.equal(state.latestVersion, null);
  assert.ok(state.lastCheckedAt);
  assert.match(state.error, /seguir usando la app/);
});

test("actualizador: metadatos inválidos no permiten descargar", async () => {
  const { controller, engine } = fixture();
  engine.info = { ...release(), files: [] };
  assert.equal((await controller.check()).phase, "idle");
  await assert.rejects(controller.download());
  assert.equal(engine.downloads, 0);
});

test("actualizador: doble clic y chequeos simultáneos no duplican operaciones", async () => {
  const { controller, engine } = fixture();
  let finish;
  engine.checkForUpdates = async () => { engine.checks++; await new Promise((resolve) => { finish = resolve; });
    engine.emit("update-available", engine.info); return { updateInfo: engine.info }; };
  const pending = controller.check();
  await controller.check();
  assert.equal(engine.checks, 1);
  finish();
  await pending;
  await Promise.all([controller.download(), controller.download()]);
  assert.equal(engine.downloads, 1);
  assert.equal(controller.getState().phase, "downloaded");
  await controller.check();
  assert.equal(engine.checks, 1, "no cambia el instalador ya verificado");
});

test("actualizador: temporizadores de un minuto y seis horas, desactivar y chequeo manual", async () => {
  const { controller, engine, saved, scheduled } = fixture();
  controller.start();
  controller.start();
  assert.equal(scheduled.size, 1);
  const initial = [...scheduled.values()][0];
  assert.equal(initial.delay, 60000);
  scheduled.clear();
  initial.fn();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(engine.checks, 1);
  assert.equal([...scheduled.values()][0].delay, 6 * 60 * 60 * 1000);
  controller.setAutomatic(false);
  assert.equal(saved.automatic, false);
  assert.equal(scheduled.size, 0);
  await controller.check(false);
  assert.equal(engine.checks, 1);
  await controller.check();
  assert.equal(engine.checks, 2, "la búsqueda manual funciona aunque la automática esté desactivada");
  assert.throws(() => controller.setAutomatic("true"), /verdadera o falsa/);
  controller.setAutomatic(true);
  assert.equal(scheduled.size, 1);
  controller.stop();
  assert.equal(scheduled.size, 0);
});

test("actualizador: Más tarde dura la sesión, omitir se persiste y no oculta versiones siguientes", async () => {
  const { controller, engine, saved } = fixture();
  await controller.check();
  controller.dismiss();
  assert.equal(controller.getState().dismissed, true);
  assert.equal(saved.skippedVersion, null);
  controller.skip();
  assert.equal(saved.skippedVersion, "0.2.0");
  const nextSession = fixture({ prefs: saved });
  await nextSession.controller.check();
  assert.equal(nextSession.controller.getState().dismissed, false);
  assert.equal(nextSession.controller.getState().skippedVersion, "0.2.0");
  engine.info = release("0.3.0");
  await controller.check();
  assert.equal(controller.getState().dismissed, false);
  assert.notEqual(controller.getState().latestVersion, controller.getState().skippedVersion);
  await controller.download();
  assert.equal(saved.skippedVersion, null);
});

test("actualizador: plataformas no compatibles o desarrollo no consultan la red", async () => {
  assert.equal(unavailableReason({ platform: "win32", arch: "x64", packaged: true, configured: true }), null);
  for (const options of [{ platform: "darwin" }, { arch: "arm64" }, { packaged: false }, { configured: false }]) {
    const reason = unavailableReason({ platform: "win32", arch: "x64", packaged: true, configured: true, ...options });
    assert.ok(reason);
    const { controller, engine, scheduled } = fixture({ reason });
    controller.start();
    await controller.check();
    await assert.rejects(controller.download());
    assert.equal(engine.checks, 0);
    assert.equal(scheduled.size, 0);
  }
});

test("actualizador: cerrar la app durante un chequeo no emite estados tardíos", async () => {
  const { controller, engine, events } = fixture();
  let finish;
  engine.checkForUpdates = () => new Promise((resolve) => { finish = resolve; });
  const pending = controller.check();
  controller.stop();
  const count = events.length;
  engine.emit("update-available", release());
  finish(null);
  await pending;
  assert.equal(events.length, count);
});

test("actualizador: el motor NSIS real lee latest.yml y rechaza bytes con SHA-512 incorrecto", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "tartas-update-engine-"));
  const payload = Buffer.from("Fixture de prueba; no es un ejecutable ni se instala.");
  const info = release();
  info.files[0].sha512 = createHash("sha512").update(payload).digest("base64");
  info.files[0].size = payload.length;
  let corrupted = true;
  const requested = [];
  const server = createServer((req, res) => {
    const path = new URL(req.url, "http://127.0.0.1").pathname;
    requested.push(path);
    if (path === "/cdt/update/latest.yml") {
      res.end(`version: ${info.version}\nfiles:\n  - url: ${info.files[0].url}\n    sha512: ${info.files[0].sha512}\n    size: ${payload.length}\n`);
    } else if (path === `/cdt/update/${info.files[0].url}`) {
      const body = corrupted ? Buffer.from("contenido alterado") : payload;
      res.writeHead(200, { "Content-Length": body.length });
      res.end(body);
    } else { res.writeHead(404); res.end(); }
  });
  let controller;
  t.after(async () => {
    controller?.stop();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const config = join(dir, "app-update.yml");
  writeFileSync(config, JSON.stringify({ provider: "generic",
    url: `http://127.0.0.1:${server.address().port}/cdt/update/`, updaterCacheDirName: "test-cache" }));
  const engine = new NsisUpdater(undefined, {
    version: "0.1.0", name: "Update test", isPackaged: true, appUpdateConfigPath: config,
    userDataPath: dir, baseCachePath: dir, whenReady: async () => {},
    onQuit: () => assert.fail("No debe instalar al cerrar"),
    quit: () => assert.fail("La prueba nunca debe cerrar ni instalar"),
  });
  // Use the library's actual download and digest verification with Node's HTTP
  // transport, so this test also runs on a development Mac without Electron.
  const executor = new ElectronHttpExecutor();
  executor.createRequest = (options, callback) => {
    assert.equal(options.hostname, "127.0.0.1", "la prueba solo consulta su servidor local");
    return request(options, callback);
  };
  engine.httpExecutor = executor;
  engine._testOnlyOptions = { platform: "win32", isUseDifferentialDownload: false };
  engine.disableDifferentialDownload = true;
  engine.logger = null;
  controller = new UpdateController({ updater: engine, currentVersion: "0.1.0",
    preferences: { read: () => ({ automatic: false, skippedVersion: null }), write: () => {} } });
  assert.equal((await controller.check()).phase, "available");
  assert.deepEqual(requested, ["/cdt/update/latest.yml"], "no descarga al buscar");
  assert.equal((await controller.download()).phase, "error");
  await assert.rejects(controller.install());
  corrupted = false;
  assert.equal((await controller.download()).phase, "downloaded");
  assert.deepEqual(readFileSync(engine.installerPath), payload);
  assert.equal(engine.quitHandlerAdded, false);
});

test("actualizador: preferencias sobreviven al reinicio sin alterar tablas del negocio", () => {
  const dir = mkdtempSync(join(tmpdir(), "tartas-update-test-"));
  const file = join(dir, "business.sqlite");
  try {
    const business = new DatabaseSync(file);
    business.exec("CREATE TABLE products (name TEXT); INSERT INTO products VALUES ('Tarta de cebolla')");
    business.close();
    const prefs = openUpdatePreferences(file);
    assert.deepEqual(prefs.read(), { automatic: true, skippedVersion: null });
    prefs.write("automatic", false);
    prefs.write("skippedVersion", "0.2.0");
    assert.throws(() => prefs.write("unsafe", "x"));
    prefs.close();
    const reopened = openUpdatePreferences(file);
    assert.deepEqual(reopened.read(), { automatic: false, skippedVersion: "0.2.0" });
    reopened.close();
    const db = new DatabaseSync(file);
    assert.equal(db.prepare("SELECT name FROM products").get().name, "Tarta de cebolla");
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("actualizador: IPC rechaza ventanas, orígenes e iframes ajenos", () => {
  const frame = { url: "http://127.0.0.1:5555/" };
  const contents = { mainFrame: frame };
  const window = { isDestroyed: () => false, webContents: contents };
  const event = { sender: contents, senderFrame: frame };
  const origin = "http://127.0.0.1:5555";
  assert.equal(trustedSender(event, window, origin), true);
  assert.equal(trustedSender({ ...event, sender: {} }, window, origin), false);
  assert.equal(trustedSender({ ...event, senderFrame: { ...frame } }, window, origin), false);
  assert.equal(trustedSender({ ...event, senderFrame: null }, window, origin), false);
  frame.url = "https://example.com/";
  assert.equal(trustedSender(event, window, origin), false);
  frame.url = origin;
  const handlers = new Map();
  const ipcMain = { handle: (name, handler) => handlers.set(name, handler), removeHandler: (name) => handlers.delete(name) };
  const { controller } = fixture();
  const dispose = registerUpdateIpc({ ipcMain, window, origin, controller });
  assert.equal(handlers.get("casa:updates:state")(event).currentVersion, "0.1.0");
  assert.throws(() => handlers.get("casa:updates:action")({ ...event, sender: {} }, "install"), /no autorizada/);
  assert.throws(() => handlers.get("casa:updates:action")(event, "exec", "evil.exe"), /inválida/);
  dispose();
  assert.equal(handlers.size, 0);
});

test("actualizador: el preload no expone IPC genérico ni eventos de Electron", async () => {
  let exposed;
  const ipc = new EventEmitter();
  const calls = [];
  ipc.invoke = async (...args) => { calls.push(args); return { phase: "idle" }; };
  vm.runInNewContext(readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8"), {
    process: { platform: "win32" },
    require: () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld: (_key, api) => { exposed = api; } } }),
  });
  assert.equal(exposed.ipcRenderer, undefined);
  assert.equal(exposed.updates.invoke, undefined);
  await exposed.updates.download("https://evil.invalid/file.exe");
  assert.deepEqual(calls[0], ["casa:updates:action", "download"]);
  const seen = [];
  const unsubscribe = exposed.updates.onStateChange((...args) => seen.push(args));
  ipc.emit("casa:updates:changed", { dangerous: true }, { phase: "available" });
  assert.deepEqual(seen[0], [{ phase: "available" }]);
  unsubscribe();
  assert.equal(ipc.listenerCount("casa:updates:changed"), 0);
});
