import type { Metadata } from "next";
import { GraphCanvas } from "@/components/graph";

export const metadata: Metadata = {
  title: "Graph · Spy",
};

/**
 * Live-only knowledge graph product route (`/graph`).
 * Client boundary is GraphCanvas ("use client") — Pixi + RTC + paint mount there only.
 * No URL query flags; always live GET `/api/graph` (see graph-live-only-pivot).
 */
export default function GraphPage() {
  return <GraphCanvas />;
}
