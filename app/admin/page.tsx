import { redirect } from "next/navigation";
import { getDemoSession } from "../demo-auth";
import BusinessApp from "../business-app";
export const dynamic = "force-dynamic";
export const metadata = { title: "Administración · Mostrador", robots: { index: false, follow: false } };
export default async function Admin() {
  if (!(await getDemoSession())) redirect("/admin/login");
  return <BusinessApp />;
}
