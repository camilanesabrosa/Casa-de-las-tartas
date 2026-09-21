import type { Metadata } from "next";
import "./globals.css";
import "./desktop.css";
import "./calendar.css";
import "./updates.css";
import { appPath } from "@/lib/paths";
import { APP_NAME } from "@/lib/branding";
import { DesktopTitlebar } from "./desktop-titlebar";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Ventas, stock, proveedores y gastos de tu negocio en un solo lugar.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: appPath("/brand/icon.svg"),
    shortcut: appPath("/brand/icon.svg"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <DesktopTitlebar />
        {children}
      </body>
    </html>
  );
}
