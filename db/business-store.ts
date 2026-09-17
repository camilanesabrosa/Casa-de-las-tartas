import { env } from "cloudflare:workers";
import { createDemo, withProductNumbers, type Business } from "@/lib/business";
import { applyAction } from "@/lib/actions";
type Stored = Business & { completedRequests?: string[] };
function db() {
  if (!env.DB) throw new Error("La base de datos no está disponible.");
  return env.DB;
}
export async function readBusiness(ownerId: string): Promise<Stored> {
  let row = await db()
    .prepare("SELECT payload FROM businesses WHERE owner_id = ?")
    .bind(ownerId)
    .first<{ payload: string }>();
  if (!row) {
    const demo = createDemo();
    await db()
      .prepare(
        "INSERT INTO businesses (owner_id, revision, payload, updated_at) VALUES (?, 0, ?, ?) ON CONFLICT(owner_id) DO NOTHING",
      )
      .bind(ownerId, JSON.stringify(demo), new Date().toISOString())
      .run();
    row = await db()
      .prepare("SELECT payload FROM businesses WHERE owner_id = ?")
      .bind(ownerId)
      .first<{ payload: string }>();
  }
  if (!row) throw new Error("No pudimos abrir los datos del negocio.");
  return withProductNumbers(JSON.parse(row.payload) as Stored);
}
export async function updateBusiness(
  ownerId: string,
  version: number,
  requestId: string,
  action: unknown,
) {
  const previous = await readBusiness(ownerId);
  if (previous.completedRequests?.includes(requestId)) return previous;
  if (previous.version !== version)
    throw new Error(
      "Los datos cambiaron en otra ventana. Actualizá los datos y volvé a guardar.",
    );
  const next: Stored = applyAction(previous, action);
  next.completedRequests = [
    ...(previous.completedRequests || []),
    requestId,
  ].slice(-500);
  const payload = JSON.stringify(next);
  if (new TextEncoder().encode(payload).byteLength > 1_000_000)
    throw new Error(
      "La muestra llegó a su límite de datos. Exportá una copia y contactá a Fernando para ampliar el almacenamiento.",
    );
  const result = await db()
    .prepare(
      "UPDATE businesses SET revision = ?, payload = ?, updated_at = ? WHERE owner_id = ? AND revision = ?",
    )
    .bind(next.version, payload, new Date().toISOString(), ownerId, version)
    .run();
  if (result.meta.changes !== 1)
    throw new Error(
      "Otra operación se guardó primero. Actualizá los datos y volvé a guardar.",
    );
  return next;
}
