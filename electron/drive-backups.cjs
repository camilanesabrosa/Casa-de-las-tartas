const crypto = require("node:crypto");
const http = require("node:http");
const { readFile, writeFile, rename, mkdir, rm } = require("node:fs/promises");
const { dirname, join } = require("node:path");
const { DatabaseSync, backup } = require("node:sqlite");

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_NAME = "Casa de las Tartas";
const BACKUP_PREFIX = "casa-de-las-tartas-respaldo-";
const AUTO_PREFIX = `${BACKUP_PREFIX}auto-`;
const BACKUP_MIME = "application/vnd.sqlite3";
const MAX_RESTORE_BYTES = 256 * 1024 * 1024;

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function describeError(error) {
  const message = error instanceof Error ? error.message : "Error desconocido.";
  return message.slice(0, 280);
}

class DriveBackupController {
  constructor({ clientId, clientSecret = "", databasePath, statePath, safeStorage, shell, notify }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.databasePath = databasePath;
    this.statePath = statePath;
    this.safeStorage = safeStorage;
    this.shell = shell;
    this.notify = notify;
    this.config = {
      version: 1,
      encryptedRefreshToken: "",
      folderId: "",
      lastBackupAt: null,
      lastError: "",
      restoreDecisionRequired: false,
    };
    this.accessToken = "";
    this.accessTokenExpiresAt = 0;
    this.busy = null;
    this.started = false;
    this.ready = false;
    this.pendingSave = null;
    this.retryTimer = null;
  }

  async start() {
    if (this.started) return;
    this.started = true;
    try {
      const stored = JSON.parse(await readFile(this.statePath, "utf8"));
      if (stored?.version === 1) {
        this.config = {
          version: 1,
          encryptedRefreshToken: typeof stored.encryptedRefreshToken === "string" ? stored.encryptedRefreshToken : "",
          folderId: typeof stored.folderId === "string" ? stored.folderId : "",
          lastBackupAt: typeof stored.lastBackupAt === "string" ? stored.lastBackupAt : null,
          lastError: typeof stored.lastError === "string" ? stored.lastError.slice(0, 280) : "",
          restoreDecisionRequired: stored.restoreDecisionRequired === true,
        };
      }
    } catch (error) {
      if (error.code !== "ENOENT") console.warn("No se pudieron leer las preferencias de Drive.", error);
    }
  }

  async persist() {
    await mkdir(dirname(this.statePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.statePath}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(this.config), { mode: 0o600 });
    await rename(temporary, this.statePath);
  }

  async getState() {
    await this.start();
    return {
      configured: Boolean(this.clientId),
      connected: Boolean(this.config.encryptedRefreshToken),
      busy: this.busy,
      lastBackupAt: this.config.lastBackupAt,
      lastError: this.config.lastError,
      restoreDecisionRequired: this.config.restoreDecisionRequired,
    };
  }

  emit() {
    Promise.resolve(this.getState()).then((state) => this.notify(state)).catch(() => {});
  }

  setBusy(busy) {
    this.busy = busy;
    this.emit();
  }

  async writeEncryptedToken(refreshToken) {
    if (!this.safeStorage.isEncryptionAvailable())
      throw new Error("Windows no tiene disponible el cifrado seguro para guardar el acceso a Google.");
    const encrypted = this.safeStorage.encryptString(refreshToken);
    this.config.encryptedRefreshToken = encrypted.toString("base64");
    await this.persist();
  }

  async readRefreshToken() {
    if (!this.config.encryptedRefreshToken) return "";
    if (!this.safeStorage.isEncryptionAvailable())
      throw new Error("Windows no puede descifrar el acceso guardado. Volvé a conectar Google Drive.");
    return this.safeStorage.decryptString(Buffer.from(this.config.encryptedRefreshToken, "base64"));
  }

  async authorize() {
    await this.start();
    if (!this.clientId) throw new Error("Falta configurar el cliente OAuth de Google Drive para la app.");
    const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const state = crypto.randomBytes(32).toString("base64url");
    const server = http.createServer();
    server.requestTimeout = 180_000;
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    const redirectUri = `http://127.0.0.1:${address.port}/`;
    const result = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Se venció el tiempo para conectar Google Drive.")), 180_000);
      server.on("request", (request, response) => {
        const url = new URL(request.url, redirectUri);
        if (url.pathname !== "/" || request.method !== "GET") {
          response.writeHead(404).end();
          return;
        }
        if (url.searchParams.get("state") !== state) {
          response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("No se pudo validar la conexión. Cerrá esta ventana y volvé a la app.");
          clearTimeout(timeout);
          reject(new Error("Google devolvió una autorización no válida."));
          return;
        }
        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");
        response.writeHead(error || !code ? 400 : 200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<!doctype html><meta charset=utf-8><title>Casa de las Tartas</title><p>Listo. Volvé a Casa de las Tartas.</p>");
        clearTimeout(timeout);
        if (error) reject(new Error("Se canceló la conexión con Google Drive."));
        else if (!code) reject(new Error("Google no devolvió el código de autorización."));
        else resolve(code);
      });
    });
    try {
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.search = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/drive.file",
        access_type: "offline",
        prompt: "consent",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
      }).toString();
      await this.shell.openExternal(authUrl.href);
      const code = await result;
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.clientId,
          ...(this.clientSecret ? { client_secret: this.clientSecret } : {}),
          code,
          code_verifier: verifier,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok || !tokens.access_token) {
        const code = typeof tokens.error === "string" ? tokens.error : "respuesta_incompleta";
        const description = typeof tokens.error_description === "string"
          ? tokens.error_description.replaceAll(this.clientId, "[Client ID]").replace(/\s+/g, " ").slice(0, 240)
          : "";
        const reasons = {
          invalid_client: "Google rechazó el Client ID. Confirmá que siga activo y que sea de tipo Desktop.",
          invalid_grant: "El código expiró o no coincide con esta autorización. Volvé a iniciar la conexión.",
          unauthorized_client: "Google no autorizó este tipo de cliente para la cuenta o el proyecto.",
          redirect_uri_mismatch: "La dirección local de retorno no coincide con la configuración OAuth.",
        };
        throw new Error(`Google rechazó la conexión (${code}). ${description || reasons[code] || "Revisá la configuración OAuth e intentá otra vez."}`);
      }
      if (tokens.refresh_token) await this.writeEncryptedToken(tokens.refresh_token);
      else if (!this.config.encryptedRefreshToken)
        throw new Error("Google no entregó un acceso persistente. Desconectá la app en tu cuenta de Google y volvé a conectar.");
      this.accessToken = tokens.access_token;
      this.accessTokenExpiresAt = Date.now() + Math.max(0, tokens.expires_in - 60) * 1000;
      const backups = await this.listFiles(this.accessToken);
      this.config.restoreDecisionRequired = backups.length > 0;
      await this.persist();
    } finally {
      server.close();
    }
  }

  async getAccessToken() {
    await this.start();
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) return this.accessToken;
    const refreshToken = await this.readRefreshToken();
    if (!refreshToken) throw new Error("Conectá Google Drive para guardar los respaldos.");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        ...(this.clientSecret ? { client_secret: this.clientSecret } : {}),
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const tokens = await response.json();
    if (!response.ok || !tokens.access_token) {
      if (tokens.error === "invalid_grant")
        throw new Error("Google revocó el acceso guardado. Desconectá y volvé a conectar Drive.");
      throw new Error("No se pudo renovar el acceso a Google Drive.");
    }
    this.accessToken = tokens.access_token;
    this.accessTokenExpiresAt = Date.now() + Math.max(0, tokens.expires_in - 60) * 1000;
    return this.accessToken;
  }

  async api(path, { method = "GET", token, body, headers = {} } = {}) {
    const accessToken = token || await this.getAccessToken();
    const response = await fetch(`${DRIVE_API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Google Drive respondió con error ${response.status}.`);
    return response.status === 204 ? null : response.json();
  }

  async ensureFolder(token) {
    if (this.config.folderId) {
      const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(this.config.folderId)}?fields=id,mimeType,trashed`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        const folder = await response.json();
        if (!folder.trashed && folder.mimeType === "application/vnd.google-apps.folder") return folder.id;
      }
      this.config.folderId = "";
    }
    const query = `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const search = await this.api(`/files?q=${encodeURIComponent(query)}&spaces=drive&pageSize=100&fields=files(id,name,mimeType)`, { token });
    const found = search.files?.find((file) => file.name === FOLDER_NAME);
    if (found) this.config.folderId = found.id;
    else {
      const folder = await this.api("/files?fields=id,name", { method: "POST", token, body: { name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" } });
      this.config.folderId = folder.id;
    }
    await this.persist();
    return this.config.folderId;
  }

  async listFiles(token) {
    const folderId = await this.ensureFolder(token);
    const query = `'${folderId}' in parents and name contains '${BACKUP_PREFIX}' and trashed = false`;
    const result = await this.api(`/files?q=${encodeURIComponent(query)}&spaces=drive&pageSize=100&orderBy=modifiedTime%20desc&fields=files(id,name,size,modifiedTime,mimeType)`, { token });
    return (result.files || []).filter((file) => file.mimeType !== "application/vnd.google-apps.folder" && file.name.startsWith(BACKUP_PREFIX));
  }

  async uploadSnapshot(path, name, token, existingFileId) {
    const bytes = await readFile(path);
    const method = existingFileId ? "PATCH" : "POST";
    const endpoint = existingFileId ? `${UPLOAD_API}/${encodeURIComponent(existingFileId)}` : UPLOAD_API;
    const metadata = existingFileId ? undefined : { name, mimeType: BACKUP_MIME, parents: [this.config.folderId] };
    const initiation = await fetch(`${endpoint}?uploadType=resumable&fields=id,name,modifiedTime,size`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": metadata ? "application/json; charset=UTF-8" : BACKUP_MIME,
        "X-Upload-Content-Type": BACKUP_MIME,
        "X-Upload-Content-Length": String(bytes.length),
      },
      ...(metadata ? { body: JSON.stringify(metadata) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    if (!initiation.ok || !initiation.headers.get("location"))
      throw new Error(`Google Drive no pudo preparar la carga (${initiation.status}).`);
    const uploaded = await fetch(initiation.headers.get("location"), {
      method: "PUT",
      headers: { "Content-Type": BACKUP_MIME, "Content-Length": String(bytes.length) },
      body: bytes,
      signal: AbortSignal.timeout(120_000),
    });
    if (!uploaded.ok) throw new Error(`La carga a Google Drive no terminó (${uploaded.status}).`);
    return uploaded.json();
  }

  async makeSnapshot() {
    const directory = dirname(this.databasePath);
    const target = join(directory, `.drive-backup-${crypto.randomUUID()}.sqlite`);
    const source = new DatabaseSync(this.databasePath, { readOnly: true });
    try {
      await backup(source, target);
    } finally {
      source.close();
    }
    const copy = new DatabaseSync(target, { readOnly: true });
    try {
      const result = copy.prepare("PRAGMA integrity_check").get();
      if (result.integrity_check !== "ok") throw new Error("La copia de SQLite no pasó la comprobación de integridad.");
    } finally {
      copy.close();
    }
    return target;
  }

  async pruneAutoBackups(token, files) {
    const autoFiles = files.filter((file) => file.name.startsWith(AUTO_PREFIX)).sort((a, b) => b.name.localeCompare(a.name));
    for (const file of autoFiles.slice(30)) await this.api(`/files/${encodeURIComponent(file.id)}`, { method: "DELETE", token });
  }

  async backupNow(kind = "manual") {
    await this.start();
    if (this.busy) throw new Error("Ya hay una tarea de Google Drive en curso.");
    this.setBusy("backup");
    let snapshot;
    try {
      const token = await this.getAccessToken();
      await this.ensureFolder(token);
      snapshot = await this.makeSnapshot();
      const files = await this.listFiles(token);
      const day = localDate();
      let name;
      let existing;
      if (kind === "automatic") {
        name = `${AUTO_PREFIX}${day}.sqlite`;
        existing = files.find((file) => file.name === name);
      } else {
        const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
        name = `${BACKUP_PREFIX}manual-${stamp}.sqlite`;
      }
      await this.uploadSnapshot(snapshot, name, token, existing?.id);
      if (kind === "automatic") await this.pruneAutoBackups(token, [...files, { id: "current", name }]);
      this.config.lastBackupAt = new Date().toISOString();
      this.config.lastError = "";
      await this.persist();
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      return await this.getState();
    } catch (error) {
      this.config.lastError = describeError(error);
      await this.persist().catch((persistError) => console.error("No se pudo guardar el error de Google Drive:", persistError));
      if (kind === "automatic" && this.ready && this.config.encryptedRefreshToken &&
          !/revocó el acceso|Falta configurar|Conectá Google Drive/i.test(this.config.lastError)) {
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          if (this.ready && this.config.encryptedRefreshToken) void this.backupNow("automatic").catch(() => {});
        }, 15 * 60 * 1000);
        this.retryTimer.unref?.();
      }
      throw error;
    } finally {
      if (snapshot) await rm(snapshot, { force: true }).catch(() => {});
      this.setBusy(null);
    }
  }

  async markReady() {
    await this.start();
    this.ready = true;
    if (this.config.encryptedRefreshToken && !this.config.restoreDecisionRequired)
      void this.backupNow("automatic").catch(() => {});
    return this.getState();
  }

  notifyDataChanged() {
    if (!this.ready || !this.config.encryptedRefreshToken || this.config.restoreDecisionRequired) return;
    clearTimeout(this.pendingSave);
    this.pendingSave = setTimeout(() => {
      this.pendingSave = null;
      void this.backupNow("automatic").catch(() => {});
    }, 30_000);
  }

  async listBackups() {
    const token = await this.getAccessToken();
    const files = await this.listFiles(token);
    return files.sort((a, b) => b.name.localeCompare(a.name)).map((file) => ({
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime,
      size: Number(file.size || 0),
    }));
  }

  async downloadBackup(fileId, targetPath) {
    const token = await this.getAccessToken();
    const files = await this.listFiles(token);
    const file = files.find((item) => item.id === fileId);
    if (!file) throw new Error("No encontramos ese respaldo en la carpeta de Drive.");
    const size = Number(file.size || 0);
    if (!size || size > MAX_RESTORE_BYTES) throw new Error("El tamaño del respaldo no es válido para restaurarlo.");
    const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`No se pudo descargar el respaldo (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== size) throw new Error("La descarga del respaldo llegó incompleta.");
    await writeFile(targetPath, bytes, { mode: 0o600 });
    const snapshot = new DatabaseSync(targetPath, { readOnly: true });
    try {
      const integrity = snapshot.prepare("PRAGMA integrity_check").get();
      const businessMeta = snapshot.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='business_meta'").get();
      const products = snapshot.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
      if (integrity.integrity_check !== "ok" || !businessMeta || !products)
        throw new Error("El archivo no es un respaldo válido de Casa de las Tartas.");
    } finally {
      snapshot.close();
    }
    return { name: file.name, bytes: size };
  }

  async disconnect() {
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.config.encryptedRefreshToken = "";
    this.config.folderId = "";
    this.config.restoreDecisionRequired = false;
    this.accessToken = "";
    this.accessTokenExpiresAt = 0;
    await this.persist();
    this.emit();
    return this.getState();
  }

  async resolveRestoreDecision() {
    this.config.restoreDecisionRequired = false;
    await this.persist();
    this.emit();
  }

  stop() {
    this.ready = false;
    clearTimeout(this.pendingSave);
    clearTimeout(this.retryTimer);
  }
}

module.exports = { DriveBackupController, BACKUP_PREFIX, AUTO_PREFIX, MAX_RESTORE_BYTES };
