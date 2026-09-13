import Catalog from "./catalogo/shop";
import { readCatalog } from "@/db/catalog-store";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mi cocina · Catálogo",
  description: "Precocidos, congelados, pastas y más. Mirá los precios y armá tu pedido por unidad o por peso.",
};
export default async function Home() {
  try {
    return <Catalog initialData={await readCatalog()} />;
  } catch (error) {
    console.error("Catalog read failed", error);
    return <Catalog />;
  }
}
