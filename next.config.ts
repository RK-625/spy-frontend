import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["falkordb", "falkordblite", "better-sqlite3"],
};

export default nextConfig;
