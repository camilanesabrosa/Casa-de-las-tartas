import BusinessApp from "./business-app";
import { APP_NAME } from "@/lib/branding";
export const dynamic = "force-dynamic";
export const metadata = {
  title: APP_NAME,
  robots: { index: false, follow: false },
};
export default function Home() {
  return <BusinessApp />;
}
