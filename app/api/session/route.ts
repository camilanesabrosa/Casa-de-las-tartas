import { createDemoSession, deleteDemoSession, sameOrigin, sessionCookie } from "@/app/demo-auth";
import { DEMO_ACCOUNT } from "@/lib/demo-account";
export const dynamic = "force-dynamic";
const respond = (data: unknown, status = 200, cookie?: string) => Response.json(data, {
  status, headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) },
});
export async function POST(request: Request) {
  if (!sameOrigin(request)) return respond({ error: "Solicitud no permitida." }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 2000) return respond({ error: "Revisá los datos ingresados." }, 400);
    const input = JSON.parse(raw);
    if (input?.email !== DEMO_ACCOUNT.email || input?.password !== DEMO_ACCOUNT.password)
      return respond({ error: "El usuario o la contraseña no son correctos." }, 401);
    return respond({ ok: true }, 200, sessionCookie(request, await createDemoSession()));
  } catch (error) {
    if (error instanceof SyntaxError) return respond({ error: "Revisá los datos ingresados." }, 400);
    console.error("Demo sign in failed", error);
    return respond({ error: "No pudimos iniciar sesión. Volvé a intentar." }, 503);
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return respond({ error: "Solicitud no permitida." }, 403);
  try {
    await deleteDemoSession();
    return respond({ ok: true }, 200, sessionCookie(request, ""));
  } catch (error) {
    console.error("Demo sign out failed", error);
    return respond({ error: "No pudimos cerrar la sesión. Volvé a intentar." }, 503);
  }
}
