import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Keep module resolution and file watching inside this repo. A lockfile
  // higher up (or a stale .next cache of one) makes Turbopack walk parent
  // directories and the first compile of / never finishes.
  turbopack: {
    root: projectRoot,
  },
  serverExternalPackages: ["falkordb", "falkordblite", "better-sqlite3"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
