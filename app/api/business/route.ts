import { getDemoSession, sameOrigin } from "@/app/demo-auth";
import { DEMO_BUSINESS_ID } from "@/lib/demo-account";
import { readCatalog } from "@/db/catalog-store";
import { readBusiness, updateBusiness } from "@/db/business-store";
import { z } from "zod";
export const dynamic = "force-dynamic";
const respond = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("catalog") === "1")
      return respond(await readCatalog());
    if (!(await getDemoSession()))
      return respond({ error: "Iniciá sesión para abrir el negocio." }, 401);
    const data = await readBusiness(DEMO_BUSINESS_ID);
    const { completedRequests, ...safe } = data;
    return respond(safe);
  } catch (error) {
    console.error("Business read failed", error);
    return respond(
      { error: "No pudimos cargar los datos. Volvé a intentar." },
      503,
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return respond({ error: "Solicitud no permitida." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 30000)
    return respond({ error: "La solicitud es demasiado grande." }, 413);
  try {
    if (!(await getDemoSession()))
      return respond({ error: "Iniciá sesión para guardar cambios." }, 401);
    const raw = await request.text();
    if (raw.length > 30000)
      return respond({ error: "La solicitud es demasiado grande." }, 413);
    const body = z
      .object({
        version: z.number().int().nonnegative(),
        requestId: z.string().uuid(),
        action: z.unknown(),
      })
      .parse(JSON.parse(raw));
    const { completedRequests, ...next } = await updateBusiness(
      DEMO_BUSINESS_ID,
      body.version,
      body.requestId,
      body.action,
    );
    return respond(next);
  } catch (error) {
    if (error instanceof z.ZodError)
      return respond(
        { error: error.issues[0]?.message || "Revisá los datos ingresados." },
        400,
      );
    if (error instanceof SyntaxError)
      return respond({ error: "No pudimos leer los datos enviados." }, 400);
    const message = error instanceof Error ? error.message : "";
    if (/D1_|SQLITE|database/i.test(message)) {
      console.error("Business write failed", error);
      return respond(
        {
          error:
            "No pudimos guardar. Tus datos del formulario se conservaron; volvé a intentar.",
        },
        503,
      );
    }
    return respond(
      { error: message || "No pudimos guardar. Volvé a intentar." },
      409,
    );
  }
}
