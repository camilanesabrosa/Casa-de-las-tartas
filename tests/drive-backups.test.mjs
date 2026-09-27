import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DriveBackupController } from "../electron/drive-backups.cjs";
import { registerDriveIpc } from "../electron/drive-ipc.cjs";

function driveIpc(controller) {
  const handlers = new Map();
  const listeners = new Map();
  const ipcMain = {
    handle: (channel, handler) => handlers.set(channel, handler),
    on: (channel, listener) => listeners.set(channel, listener),
    removeHandler: (channel) => handlers.delete(channel),
    removeAllListeners: (channel) => listeners.delete(channel),
  };
  const frame = { url: "http://127.0.0.1:4000/" };
  const window = { isDestroyed: () => false, webContents: { mainFrame: frame } };
  registerDriveIpc({ ipcMain, window, origin: "http://127.0.0.1:4000", controller, restoreBackup: async () => ({ restored: true }) });
  return { action: handlers.get("casa:drive:action"), event: { sender: window.webContents, senderFrame: frame } };
}

test("una computadora nueva no reemplaza las copias existentes al vincular Drive", async () => {
  let backups = 0;
  const controller = {
    authorize: async () => {},
    emit: () => {},
    getState: async () => ({ restoreDecisionRequired: true }),
    backupNow: async () => { backups += 1; },
  };
  const { action, event } = driveIpc(controller);
  const state = await action(event, "connect");
  assert.equal(state.restoreDecisionRequired, true);
  assert.equal(backups, 0);
});

test("el primer enlace sin copias crea un respaldo inicial", async () => {
  let backups = 0;
  const controller = {
    authorize: async () => {},
    emit: () => {},
    getState: async () => ({ restoreDecisionRequired: false }),
    backupNow: async (kind) => { backups += 1; assert.equal(kind, "automatic"); return { connected: true }; },
  };
  const { action, event } = driveIpc(controller);
  assert.deepEqual(await action(event, "connect"), { connected: true });
  assert.equal(backups, 1);
});

test("una restauración pendiente pausa los respaldos automáticos hasta resolverla", async () => {
  const directory = await mkdtemp(join(tmpdir(), "casa-drive-restore-test-"));
  const statePath = join(directory, "google-drive.json");
  await writeFile(statePath, JSON.stringify({
    version: 1,
    encryptedRefreshToken: "existing-token",
    folderId: "existing-folder",
    lastBackupAt: null,
    lastError: "",
    restoreDecisionRequired: true,
  }));
  const controller = new DriveBackupController({
    clientId: "test-client",
    databasePath: join(directory, "business.sqlite"),
    statePath,
    safeStorage: {},
    shell: {},
    notify: () => {},
  });
  let backups = 0;
  controller.backupNow = async () => { backups += 1; };

  try {
    const state = await controller.markReady();
    controller.notifyDataChanged();
    assert.equal(state.restoreDecisionRequired, true);
    assert.equal(controller.pendingSave, null);
    assert.equal(backups, 0);

    await controller.resolveRestoreDecision();
    assert.equal((await controller.getState()).restoreDecisionRequired, false);
    assert.equal(backups, 0);
  } finally {
    controller.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
