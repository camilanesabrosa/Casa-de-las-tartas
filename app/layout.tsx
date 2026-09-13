import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mostrador · Mi cocina",
  description:
    "Ventas, stock, proveedores y gastos de tu negocio en un solo lugar.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
