import { redirect } from "next/navigation";
import { getDemoSession } from "@/app/demo-auth";
import Login from "./login";
export const dynamic = "force-dynamic";
export const metadata = { title: "Acceso de prueba · Mostrador", robots: { index: false, follow: false } };
export default async function Page() {
  if (await getDemoSession()) redirect("/admin");
  return <Login />;
}
