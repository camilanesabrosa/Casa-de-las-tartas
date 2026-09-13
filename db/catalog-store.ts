import { readBusiness } from "./business-store";
import { DEMO_BUSINESS_ID } from "@/lib/demo-account";
import { publicCatalog } from "@/lib/catalog";

export async function readCatalog() {
  return publicCatalog(await readBusiness(DEMO_BUSINESS_ID));
}
