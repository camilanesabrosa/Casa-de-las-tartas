import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.MOSTRADOR_TARGET === "vps" ? {
    output: "standalone",
    basePath: "/casadelastartas",
    env: { NEXT_PUBLIC_BASE_PATH: "/casadelastartas" },
  } : {}),
};

export default nextConfig;
