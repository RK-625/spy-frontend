import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["falkordb", "falkordblite", "better-sqlite3"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
