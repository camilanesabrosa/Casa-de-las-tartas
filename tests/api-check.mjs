// Pruebas del contrato HTTP contra el servidor ya construido de la aplicación.
// Levantarlo antes, apuntando a una base descartable:
//   node scripts/build-app.mjs
//   MOSTRADOR_DATABASE_PATH=/tmp/mostrador-qa/business.sqlite PORT=8788 \
//     HOST=127.0.0.1 node dist/standalone/server.js
//   node tests/api-check.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const ORIGIN = process.env.MOSTRADOR_TEST_ORIGIN || "http://127.0.0.1:8788";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(ORIGIN).hostname),
  "Estas pruebas escriben datos: nunca correrlas contra una base real.",
);

const call = async (path = "/api/business", method = "GET", payload) => {
  const r = await fetch(ORIGIN + path, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    redirect: "manual",
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body, headers: r.headers };
};

const save = (action, state, requestId = randomUUID()) =>
  call("/api/business", "POST", { version: state.version, requestId, action });

// La aplicación corre local y sin cuentas: la administración abre en la raíz.
const root = await call("/");
assert.equal(root.status, 200);
assert.ok(typeof root.body === "string" && root.body.includes("<"), "la raíz sirve la aplicación");

// El catálogo público y las sesiones ya no existen.
for (const gone of ["/catalogo", "/admin", "/admin/login", "/api/session"])
  assert.equal((await call(gone)).status, 404, gone + " debería estar dado de baja");
assert.equal((await call("/api/business?catalog=1")).status, 200, "el parámetro catalog ya no cambia la respuesta");

// Los datos se leen sin iniciar sesión, y nunca se filtra el registro interno.
const first = await call();
assert.equal(first.status, 200);
const business = first.body;
assert.ok(business.products.length > 0);
assert.ok(!("completedRequests" in business), "completedRequests no sale al cliente");

// Guardar: la revisión avanza y el mismo requestId no aplica el cambio dos veces.
const product = { ...business.products[0], price: 987654 };
const requestId = randomUUID();
const saved = await save({ type: "product", product }, business, requestId);
assert.equal(saved.status, 200, JSON.stringify(saved.body));
assert.ok(saved.body.version > business.version, "la revisión avanza");
const retry = await save({ type: "product", product }, business, requestId);
assert.equal(retry.body.version, saved.body.version, "reintentar el mismo pedido no duplica");

// Una escritura con la revisión vieja se rechaza en vez de pisar lo guardado.
const stale = await save({ type: "product", product }, business);
assert.equal(stale.status, 409, "revisión vencida rechazada");
assert.equal((await call()).body.products[0].price, 987654);

// Dos escrituras simultáneas: una gana, la otra reintenta.
const current = (await call()).body;
const expense = {
  type: "expense",
  name: "Prueba concurrente",
  category: "Variable",
  amount: 100,
  paid: false,
};
const both = await Promise.all([
  save(expense, current),
  save(expense, current),
]);
assert.deepEqual(
  both.map((r) => r.status).sort(),
  [200, 409],
  "exactamente una de las dos escrituras simultáneas gana",
);

// Límite de tamaño del cuerpo.
const huge = await save(
  { type: "expense", name: "x".repeat(40000), category: "Fijo", amount: 1, paid: false },
  (await call()).body,
);
assert.equal(huge.status, 413, "cuerpo demasiado grande rechazado");

// Datos inválidos vuelven como error de validación, no como caída.
const bad = await call("/api/business", "POST", { version: 0, requestId: "no-es-uuid", action: {} });
assert.equal(bad.status, 400);

console.log("OK: raíz servida, catálogo y sesiones dados de baja, lectura abierta, idempotencia, revisión, concurrencia, tamaño y validación.");
