import type { Metadata } from "next";
import { D3Canvas } from "@/components/graph";

export const metadata: Metadata = {
  title: "D3 · Spy",
};

/**
 * Live-only knowledge graph D3 route (`/d3`).
 * Client boundary is D3Canvas ("use client") — D3-force layout + SVG draw there only.
 * No URL query flags; always live GET `/api/d3`.
 */
export default function D3Page() {
  return <D3Canvas />;
}
