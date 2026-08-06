/**
 * Shared wire / topology types for GET /api/graph.
 *
 * Client-safe SoT (no Node, Falkor, or embeddings). Used by:
 * - server: `listGraphTopology` (falkor), `GET /api/graph`
 * - client: `/graph` host (`graph-canvas`) → `placeTopology`
 *
 * Topology is Memory-only (core fields). Embeddings live on MemoryQuestion
 * (`questionEmbedding`) and are never on this wire payload.
 * Placement (x/y/rank) is client-only — never on this wire shape.
 *
 * `MemoryNode` is the lean row SoT (`@/types/graph-schema`; alias of Memory).
 */

import type { Links, MemoryNode } from "@/types/graph-schema";

export type { MemoryNode };

/** Topology payload: memories + PART_OF / RELATES_TO links. */
export type GraphTopology = {
  memories: MemoryNode[];
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
