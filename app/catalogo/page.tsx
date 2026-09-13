import Catalog from "./shop";
import { requireChatGPTUser } from "../chatgpt-auth";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catálogo · Mi cocina",
  description:
    "Precocidos, congelados, pastas y más. Armá tu pedido por unidad o por peso.",
};
export default async function Page() {
  await requireChatGPTUser("/catalogo");
  return <Catalog />;
}
