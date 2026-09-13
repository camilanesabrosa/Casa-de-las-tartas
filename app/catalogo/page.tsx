import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catálogo · Mi cocina",
  description:
    "Precocidos, congelados, pastas y más. Armá tu pedido por unidad o por peso.",
};
export default async function Page() {
  redirect("/");
}
