import type { Metadata } from "next";
import { GraphCanvas } from "@/components/graph/graph-canvas";

export const metadata: Metadata = {
  title: "Graph · Spy",
};

/**
 * Live-only knowledge graph product route (`/graph`).
 * Client boundary is GraphCanvas ("use client") — Pixi + RTC + layout mount there only.
 */
export default function GraphPage() {
  return <GraphCanvas />;
}
