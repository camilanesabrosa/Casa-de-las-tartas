const INITIAL_DELAY = 60_000;
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const VERSION = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;

function newerVersion(candidate, current) {
  if (typeof candidate !== "string" || typeof current !== "string" ||
    !VERSION.test(candidate) || !VERSION.test(current)) return false;
  const a = candidate.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

function validRelease(info, currentVersion) {
  if (!info || !newerVersion(info.version, currentVersion)) return false;
  const expected = `Casa-de-las-Tartas-${info.version}-win-x64-Setup.exe`;
  // Only our full x64 installer, with a SHA-512 digest. No web installer,
  // arbitrary executable URLs, old versions or prereleases.
  if (!Array.isArray(info.files) || info.files.length !== 1) return false;
  const file = info.files[0];
  return Boolean(file && file.url === expected && typeof file.sha512 === "string" &&
    /^[A-Za-z0-9+/]{86}==$/.test(file.sha512));
}

function unavailableReason({ platform, arch, packaged, configured }) {
  if (platform !== "win32" || arch !== "x64") return "Las actualizaciones están disponibles en la versión para Windows de 64 bits.";
  if (!packaged) return "Las actualizaciones se habilitan en la app instalada, no en desarrollo.";
  if (!configured) return "Esta versión todavía no tiene un canal de actualizaciones configurado.";
  return null;
}

class UpdateController {
  constructor({ updater, currentVersion, reason = null, preferences, notify = () => {}, confirmInstall = async () => false,
    timers = { setTimeout, clearTimeout, setInterval, clearInterval }, now = () => new Date().toISOString() }) {
    this.updater = updater;
    this.preferences = preferences;
    this.prefs = preferences.read();
    this.notify = notify;
    this.confirmInstall = confirmInstall;
    this.timers = timers;
    this.now = now;
    this.operation = null;
    this.disposed = false;
    this.initialTimer = null;
    this.intervalTimer = null;
    this.dismissedVersion = null;
    this.state = {
      supported: Boolean(updater) && !reason,
      reason,
      currentVersion,
      phase: updater && !reason ? "idle" : "unavailable",
      latestVersion: null,
      releaseNotes: "",
      lastCheckedAt: null,
      progress: 0,
      error: null,
    };
    if (!this.state.supported) return;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.disableWebInstaller = true;
    updater.on("update-available", (info) => {
      if (this.disposed) return;
      if (!validRelease(info, currentVersion)) {
        this.patch({ phase: "idle", latestVersion: null, error: "La publicación no contiene un instalador válido de Windows x64 con su hash SHA-512." });
        return;
      }
      const notes = typeof info.releaseNotes === "string" ? info.releaseNotes :
        Array.isArray(info.releaseNotes) ? info.releaseNotes.map((item) => typeof item?.note === "string" ? item.note : "").join("\n") : "";
      this.patch({ phase: "available", latestVersion: info.version, releaseNotes: notes.slice(0, 2000), progress: 0, error: null });
    });
    updater.on("update-not-available", () => {
      this.patch({ phase: "idle", latestVersion: null, releaseNotes: "", progress: 0, error: null });
    });
    updater.on("download-progress", ({ percent }) => {
      if (this.state.phase === "downloading" && Number.isFinite(percent))
        this.patch({ progress: Math.max(0, Math.min(100, Math.floor(percent))) });
    });
    updater.on("update-downloaded", (info) => {
      if (this.operation !== "download") return;
      if (!validRelease(info, currentVersion) || info.version !== this.state.latestVersion) {
        this.patch({ phase: "error", error: "La versión descargada no coincide con la actualización ofrecida." });
        return;
      }
      // electron-updater emits this only after validating the downloaded file.
      this.patch({ phase: "downloaded", progress: 100, error: null });
    });
    updater.on("error", () => this.fail());
  }

  getState() {
    return { ...this.state, automatic: this.prefs.automatic, skippedVersion: this.prefs.skippedVersion,
      dismissed: Boolean(this.state.latestVersion && this.dismissedVersion === this.state.latestVersion) };
  }

  patch(values) {
    if (this.disposed) return;
    Object.assign(this.state, values);
    this.notify(this.getState());
  }

  fail() {
    if (this.disposed) return;
    if (this.operation === "download") {
      this.patch({ phase: "error", error: "No se pudo descargar o verificar la actualización. Revisá la conexión y reintentá." });
    } else if (this.operation === "install" || this.state.phase === "installing") {
      this.patch({ phase: "downloaded", error: "No se pudo iniciar el instalador. Podés volver a intentarlo." });
    } else {
      this.patch({ phase: this.state.latestVersion ? "available" : "idle", error: "No se pudo consultar el canal de actualizaciones. Podés seguir usando la app y reintentar más tarde." });
    }
  }

  requireSupported() {
    if (this.disposed || !this.state.supported) throw new Error(this.state.reason || "El actualizador no está disponible.");
  }

  start() {
    if (this.disposed || !this.state.supported || !this.prefs.automatic || this.initialTimer || this.intervalTimer) return;
    this.initialTimer = this.timers.setTimeout(() => {
      this.initialTimer = null;
      void this.check(false);
      this.intervalTimer = this.timers.setInterval(() => { void this.check(false); }, CHECK_INTERVAL);
      this.intervalTimer?.unref?.();
    }, INITIAL_DELAY);
    this.initialTimer?.unref?.();
  }

  clearTimers() {
    if (this.initialTimer) this.timers.clearTimeout(this.initialTimer);
    if (this.intervalTimer) this.timers.clearInterval(this.intervalTimer);
    this.initialTimer = this.intervalTimer = null;
  }

  stop() { this.clearTimers(); this.disposed = true; }

  async check(manual = true) {
    if (!this.state.supported || this.disposed || (!manual && !this.prefs.automatic) || this.operation ||
      ["downloaded", "installing"].includes(this.state.phase)) return this.getState();
    this.operation = "check";
    this.patch({ phase: "checking", error: null });
    try {
      const result = await this.updater.checkForUpdates();
      if (!result) this.fail();
    } catch { this.fail(); }
    finally {
      this.operation = null;
      this.patch({ lastCheckedAt: this.now() });
    }
    return this.getState();
  }

  async download() {
    this.requireSupported();
    if (this.operation) return this.getState();
    if (!["available", "error"].includes(this.state.phase) || !this.state.latestVersion)
      throw new Error("Primero buscá una actualización disponible.");
    this.preferences.write("skippedVersion", null);
    this.prefs.skippedVersion = null;
    this.dismissedVersion = null;
    this.operation = "download";
    this.patch({ phase: "downloading", progress: 0, error: null });
    try {
      await this.updater.downloadUpdate();
      if (this.state.phase === "downloading") this.fail();
    } catch { this.fail(); }
    finally { this.operation = null; }
    return this.getState();
  }

  async install() {
    this.requireSupported();
    if (this.operation) return this.getState();
    if (this.state.phase !== "downloaded") throw new Error("La actualización todavía no está lista para instalar.");
    this.operation = "install";
    try {
      if (await this.confirmInstall(this.state.latestVersion)) {
        if (this.disposed) return this.getState();
        this.patch({ phase: "installing", error: null });
        this.updater.quitAndInstall(false, true);
      }
    } catch { this.fail(); }
    finally { this.operation = null; }
    return this.getState();
  }

  setAutomatic(value) {
    this.requireSupported();
    if (typeof value !== "boolean") throw new Error("La preferencia debe ser verdadera o falsa.");
    this.preferences.write("automatic", value);
    this.prefs.automatic = value;
    this.clearTimers();
    this.start();
    this.patch({});
    return this.getState();
  }

  dismiss() {
    this.dismissedVersion = this.state.latestVersion;
    this.patch({});
    return this.getState();
  }

  skip() {
    this.requireSupported();
    if (this.operation || this.state.phase !== "available") return this.getState();
    this.preferences.write("skippedVersion", this.state.latestVersion);
    this.prefs.skippedVersion = this.state.latestVersion;
    this.patch({});
    return this.getState();
  }
}

module.exports = { UpdateController, unavailableReason, validRelease, newerVersion };
