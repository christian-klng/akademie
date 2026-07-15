import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the minimal Docker runner image (Coolify deploy).
  output: "standalone",
};

export default nextConfig;
