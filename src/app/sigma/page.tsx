import type { Metadata } from "next";
import { SigmaCanvas } from "@/components/graph";

export const metadata: Metadata = {
  title: "Sigma · Spy",
};

/**
 * Live-only knowledge graph Sigma route (`/sigma`).
 * Client boundary is SigmaCanvas ("use client") — graphology FA2 + Sigma draw there only.
 * No URL query flags; always live GET `/api/sigma`.
 */
export default function SigmaPage() {
  return <SigmaCanvas />;
}
