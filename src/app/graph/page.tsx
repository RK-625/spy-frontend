import type { Metadata } from "next";
import { SigmaCanvasHost } from "@/components/graph";

export const metadata: Metadata = {
  title: "Graph · Spy",
};

/**
 * Live-only knowledge graph product route (`/graph`).
 * Client boundary is SigmaCanvasHost (dynamic, ssr: false) — Sigma touches WebGL
 * at import and cannot evaluate in Node. GET `/api/graph` is the topology route.
 * No URL query flags; live topology only.
 */
export default function GraphPage() {
  return <SigmaCanvasHost />;
}
