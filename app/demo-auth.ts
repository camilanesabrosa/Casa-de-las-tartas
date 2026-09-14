import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { BASE_PATH } from "@/lib/paths";

export const SESSION_COOKIE = "mostrador_demo_session";
export const SESSION_AGE = 60 * 60 * 8;
function db() {
  if (!env.DB) throw new Error("La base de datos no está disponible.");
  return env.DB;
}
const digest = async (token: string) => {
  const value = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(value), (b) => b.toString(16).padStart(2, "0")).join("");
};
export async function getDemoSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const session = await db().prepare(
    "SELECT token_hash FROM demo_sessions WHERE token_hash = ? AND expires_at > ?",
  ).bind(await digest(token), Date.now()).first();
  return Boolean(session);
}
export async function createDemoSession() {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (b) => b.toString(16).padStart(2, "0")).join("");
  await db().batch([
    db().prepare("DELETE FROM demo_sessions WHERE expires_at <= ?").bind(Date.now()),
    db().prepare("INSERT INTO demo_sessions (token_hash, expires_at) VALUES (?, ?)")
      .bind(await digest(token), Date.now() + SESSION_AGE * 1000),
  ]);
  return token;
}
export async function deleteDemoSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await db().prepare("DELETE FROM demo_sessions WHERE token_hash = ?")
    .bind(await digest(token)).run();
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}
export function sessionCookie(request: Request, token: string) {
  return `${SESSION_COOKIE}=${token}; Path=${BASE_PATH || "/"}; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_AGE : 0}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
