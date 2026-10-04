import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import clockModule from "../electron/register-closing.cjs";
const { RegisterClosingController } = clockModule;

function fixture() {
  const powerMonitor = new EventEmitter();
  let now = Date.parse("2026-10-05T02:58:59.000Z");
  let data = { version: 1, nextRegisterCloseAt: "2026-10-05T02:59:00.000Z", registers: [] };
  const scheduled = new Map();
  const notifications = [];
  const errors = [];
  let id = 0, reads = 0;
  const controller = new RegisterClosingController({
    powerMonitor, now: () => now,
    read: async () => { reads++; return data; },
    notify: (result) => notifications.push(result), onError: (error) => errors.push(error),
    timers: { setTimeout: (fn, delay) => { scheduled.set(++id, { fn, delay }); return id; }, clearTimeout: (key) => scheduled.delete(key) },
  });
  return { controller, powerMonitor, scheduled, notifications, errors, setNow: (time) => { now = Date.parse(time); },
    setData: (value) => { data = value; }, reads: () => reads };
}
test("reloj de caja: chequea al iniciar y programa exactamente el corte desde el proceso principal", async () => {
  const f = fixture();
  f.controller.start();
  f.controller.start();
  await f.controller.check();
  assert.equal(f.reads(), 1);
  assert.equal(f.powerMonitor.listenerCount("resume"), 1);
  assert.equal([...f.scheduled.values()][0].delay, 1000);
  f.setNow("2026-10-05T02:59:00.000Z");
  f.setData({ version: 2, nextRegisterCloseAt: null, registers: [{ closedAt: "2026-10-05T02:59:00.000Z", automatic: true }] });
  await f.controller.check();
  assert.equal(f.notifications.length, 1);
  await f.controller.check();
  assert.equal(f.notifications.length, 1, "no duplica avisos de una misma revisión");
  f.controller.stop();
  assert.equal(f.scheduled.size, 0);
  assert.equal(f.powerMonitor.listenerCount("resume"), 0);
});
test("reloj de caja: recupera al salir de suspensión y no depende de la ventana", async () => {
  const f = fixture();
  f.controller.start();
  await f.controller.check();
  f.setNow("2026-10-06T12:00:00.000Z");
  f.setData({ version: 2, nextRegisterCloseAt: null });
  f.powerMonitor.emit("resume");
  await f.controller.check();
  assert.equal(f.reads(), 2);
  assert.equal(f.notifications.length, 1);
  f.controller.stop();
});
test("reloj de caja: errores se reintentan y no deja temporizadores ni notificaciones al detenerse", async () => {
  const f = fixture();
  f.controller.read = () => { throw new Error("Servidor no disponible"); };
  f.controller.start();
  await f.controller.check();
  assert.equal(f.errors.length, 1);
  assert.equal(f.scheduled.size, 1);
  let resolve;
  f.controller.read = () => new Promise((done) => { resolve = done; });
  const pending = f.controller.check();
  await Promise.resolve();
  assert.equal(f.controller.check(), pending, "no solapa consultas");
  f.controller.stop();
  resolve({ version: 3, nextRegisterCloseAt: null });
  await pending;
  assert.equal(f.notifications.length, 0);
  assert.equal(f.scheduled.size, 0);
});
