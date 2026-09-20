import BusinessApp from "./business-app";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mostrador",
  robots: { index: false, follow: false },
};
export default function Home() {
  return <BusinessApp />;
}
