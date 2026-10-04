import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { autoCloseRegisters, createFreshBusiness, openRegister, registerClosingAt, summary } from "../lib/business";
import { applyAction } from "../lib/actions";
import { dailyBalances } from "../lib/calendar";
import { CalendarView } from "../app/calendar-view";

const opening = "2026-10-04T12:00:00.000Z";
const cutoff = "2026-10-05T02:59:00.000Z";
function fixture() {
  let b = applyAction(createFreshBusiness(), { type: "openRegister", opening: 50000 }, opening);
  b = applyAction(b, { type: "cash", kind: "deposit", amount: 20000, reason: "Aporte" }, "2026-10-04T22:00:00.000Z");
  b = applyAction(b, { type: "expense", name: "Envases", category: "Variable", amount: 10000, paid: true }, "2026-10-05T02:58:59.000Z");
  return b;
}
test("caja: el corte es 23:59 de Mendoza incluso cuando UTC ya es otro día", () => {
  assert.equal(registerClosingAt(opening), cutoff);
  assert.equal(registerClosingAt("2026-10-05T02:30:00.000Z"), cutoff);
  assert.equal(registerClosingAt("2026-12-31T23:00:00.000Z"), "2027-01-01T02:59:00.000Z");
});
test("caja: no cierra antes del corte y cierra exactamente a las 23:59 sin inventar arqueo", () => {
  const before = fixture();
  assert.equal(autoCloseRegisters(before, "2026-10-05T02:58:59.999Z"), before);
  const closed = autoCloseRegisters(before, cutoff);
  const r = closed.registers[0];
  assert.equal(r.closedAt, cutoff);
  assert.equal(r.expected, 60000);
  assert.equal(r.automatic, true);
  assert.equal(r.counted, undefined);
  assert.equal(r.difference, undefined);
  assert.equal(openRegister(closed), undefined);
  assert.equal(closed.version, before.version + 1);
  assert.deepEqual(closed.payments, before.payments);
  assert.deepEqual(closed.products, before.products);
  assert.equal(summary(closed).balance, summary(before).balance);
  assert.equal(before.registers[0].closedAt, undefined);
  assert.equal(autoCloseRegisters(closed, "2026-10-06T14:00:00.000Z"), closed);
});
test("caja: recupera un cierre olvidado sin sumar operaciones posteriores ni cambiar su fecha", () => {
  const b = fixture();
  b.payments.push({ id: "later", date: "2026-10-05T03:15:00.000Z", amount: 90000, kind: "deposit", reference: "Otro día" });
  const closed = autoCloseRegisters(b, "2026-10-10T14:00:00.000Z");
  assert.equal(closed.registers[0].closedAt, cutoff);
  assert.equal(closed.registers[0].expected, 60000);
  const days = dailyBalances(closed);
  assert.equal(days.get("2026-10-04")!.registers.length, 1);
  assert.equal(days.get("2026-10-05")!.registers.length, 0);
  assert.equal(days.get("2026-10-05")!.balance, 90000);
});
test("caja: el cierre manual se conserva y el día siguiente se puede abrir normalmente", () => {
  const manual = applyAction(fixture(), { type: "closeRegister", counted: 55000 }, "2026-10-05T02:45:00.000Z");
  assert.equal(autoCloseRegisters(manual, cutoff), manual);
  assert.equal(manual.registers[0].automatic, undefined);
  const recovered = applyAction(fixture(), { type: "openRegister", opening: 70000 }, "2026-10-05T12:00:00.000Z");
  assert.equal(recovered.registers[0].automatic, true);
  assert.equal(openRegister(recovered)!.opening, 70000);
  assert.throws(() => applyAction(createFreshBusiness(), { type: "openRegister", opening: 0 }, cutoff), /desde las 00:00/);
  assert.throws(() => applyAction(fixture(), { type: "closeRegister", counted: 0 }, cutoff), /ninguna caja abierta/);
});
test("calendario: distingue cierre automático y no muestra contado cero ni diferencia cero", () => {
  const b = createFreshBusiness();
  // Calendar's initial selection is today; do not change the system clock.
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Mendoza" }).format(new Date());
  b.registers = [{ id: "automatic", openedAt: `${today}T12:00:00-03:00`, opening: 50000,
    closedAt: `${today}T23:59:00-03:00`, expected: 60000, automatic: true }];
  const html = renderToStaticMarkup(<CalendarView data={b} />);
  assert.ok(html.includes("Caja cerrada automáticamente"));
  assert.ok(html.includes("Saldo calculado"));
  assert.ok(html.includes("Sin arqueo"));
  assert.ok(html.includes("23:59"));
  assert.ok(!html.includes("Contado"));
  assert.ok(!html.includes("Diferencia"));
});
