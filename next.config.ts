import type { NextConfig } from "next";

// "vps": servidor publicado detrás de Nginx, bajo un prefijo.
// "app": servidor local que abre la aplicación de escritorio, en la raíz.
const target = process.env.MOSTRADOR_TARGET;

const nextConfig: NextConfig = {
  ...(target === "vps" || target === "app" ? { output: "standalone" } : {}),
  ...(target === "vps"
    ? {
        basePath: "/casadelastartas",
        env: { NEXT_PUBLIC_BASE_PATH: "/casadelastartas" },
      }
    : {}),
};

export default nextConfig;
