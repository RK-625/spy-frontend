/**
 * Shared wire / topology types for GET /api/graph.
 *
 * Client-safe SoT (no Node, Falkor, or embeddings). Used by:
 * - server: `listGraphTopology` (falkor), `GET /api/graph`
 * - client: `/graph` host (`graph-canvas`) → `memoryGraphToGraphDataWithMeta`
 *
 * Full product `Memory` is NOT the wire type (embeddings required on Memory).
 * Placement (x/y/rank) is client-only — never on this wire shape.
 *
 * `GraphTopologyMemory` is assignable to `MemoryGraphNodeInput` (placement adapter).
 */

import type { Links } from "@/types/graph-schema";

/**
 * Lean Memory row for topology transfer — no embeddings, no placement.
 * Matches fields selected by `listGraphTopology` / returned by GET /api/graph.
 */
export type GraphTopologyMemory = {
  id: string;
  name: string;
  content: string;
  impression: string;
  confidence: number;
};

/** Topology payload: memories + PART_OF / RELATES_TO links. */
export type GraphTopology = {
  memories: GraphTopologyMemory[];
  links: Links[];
};

/**
 * HTTP envelope for GET /api/graph.
 * Composes `GraphTopology` so memories/links stay single-source with the DB row shape.
 * Route always includes ok / empty / memories / links / source;
 * `error` only on failure paths.
 */
export type GraphApiResponse = GraphTopology & {
  ok: boolean;
  empty: boolean;
  /** Always `"falkor"` from the live product route today. */
  source: string;
  error?: string;
};
