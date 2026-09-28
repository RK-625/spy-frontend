import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { FalkorDB } from "falkordblite";
import {
  Links as LinksSchema,
  type Memory,
  type Links,
  type MemoryLinkType,
  type MemorySearchHit,
  type MemoryChild,
  type MemoryCone,
  type MemoryNode,
} from "@/types/graph-schema";
import type { GraphTopology } from "@/types/graph-topology";
import {
  MEMORY_SEARCH_MAX_DISTANCE,
  MEMORY_SEARCH_TOP_K,
} from "@/lib/graph/policy";
import { z } from "zod";

/** Re-export wire SoT from client-safe `@/types/graph-topology` (do not redefine). */
export type { GraphTopology, MemoryNode } from "@/types/graph-topology";
export type { MemorySearchHit, MemoryChild, MemoryCone } from "@/types/graph-schema";

const GRAPH_NAME = "spy_brain";

/** Embedding dim must match `generateEmbedding` (gemini-embedding-2 truncated to 1536). */
const EMBEDDING_DIMENSION = 1536;
const VECTOR_SIMILARITY = "cosine" as const;

/**
 * Product ANN index field on MemoryQuestion nodes.
 * Index CREATE + queryNodes + CREATE node props all use this name.
 */
const MEMORY_QUESTION_EMBEDDING_PROP = "questionEmbedding" as const;

/**
 * Local data **directory** for FalkorDBLite persistence (not a single SQLite file).
 * Override with FALKOR_PATH. Lite also mkdir's this on open; we ensure it first.
 */
const FALKOR_PATH = resolve(process.env.FALKOR_PATH ?? ".data/falkor");

type FalkorClient = Awaited<ReturnType<typeof FalkorDB.open>>;
type FalkorGraph = ReturnType<FalkorClient["selectGraph"]>;

type FalkorSingleton = {
  client: FalkorClient | null;
  opening: Promise<FalkorClient> | null;
  vectorReady: boolean;
  vectorOpening: Promise<void> | null;
};

// Turbopack serves this module from more than one server chunk. A module-level
// singleton opens a second embedded Falkor, and that copy does not see the
// graph the other copy is serving. globalThis keeps one client per process.
const falkorSingleton: FalkorSingleton = ((
  globalThis as { __spyFalkor?: FalkorSingleton }
).__spyFalkor ??= {
  client: null,
  opening: null,
  vectorReady: false,
  vectorOpening: null,
});

async function ensureFalkorDataDir(): Promise<string> {
  await mkdir(FALKOR_PATH, { recursive: true });
  return FALKOR_PATH;
}

/**
 * Process-singleton open. Concurrent callers await the same promise; failed opens
 * reset so the next call can retry (do not leave a rejected promise cached forever).
 */
function openDbClient(): Promise<FalkorClient> {
  if (falkorSingleton.client) {
    return Promise.resolve(falkorSingleton.client);
  }
  if (!falkorSingleton.opening) {
    falkorSingleton.opening = (async () => {
      const dataDir = await ensureFalkorDataDir();
      // falkordblite: embedded server — use open(), not falkordb client connect()
      // Lite's signal cleanup sends SHUTDOWN NOSAVE, so only periodic RDB
      // snapshots persist. Snapshot 1s after any write (lite default: 60s).
      const client = await FalkorDB.open({
        path: dataDir,
        additionalConfig: { save: "1 1" },
      });
      falkorSingleton.client = client;
      console.log(`FalkorDBLite open at ${dataDir}`);
      return client;
    })().catch((error: unknown) => {
      falkorSingleton.opening = null;
      falkorSingleton.client = null;
      throw error;
    });
  }
  return falkorSingleton.opening;
}

async function createVectorIndex(
  graph: FalkorGraph,
  label: string,
  field: string,
): Promise<void> {
  const query = `
    CREATE VECTOR INDEX FOR (n:${label}) ON (n.${field})
    OPTIONS {dimension: ${EMBEDDING_DIMENSION}, similarityFunction: '${VECTOR_SIMILARITY}'}
  `;
  try {
    await graph.query(query);
    console.log(`FalkorDB vector index ready: ${label}.${field}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists|already indexed|Index already/i.test(message)) {
      console.log(`FalkorDB vector index already present: ${label}.${field}`);
      return;
    }
    console.error(
      `FalkorDB ensureVectorIndexes failed for ${label}.${field}:`,
      error,
    );
    throw error;
  }
}

/**
 * Ensure product vector index (MemoryQuestion.questionEmbedding only).
 * Single-flight / process-once: concurrent callers share one promise; success
 * sets vectorIndexesReady so later getDb() skips re-CREATE.
 * Idempotent: already-exists logs and continues; other errors throw.
 */
async function ensureVectorIndexes(graph: FalkorGraph): Promise<void> {
  if (falkorSingleton.vectorReady) {
    return;
  }
  if (!falkorSingleton.vectorOpening) {
    falkorSingleton.vectorOpening = (async () => {
      await createVectorIndex(
        graph,
        "MemoryQuestion",
        MEMORY_QUESTION_EMBEDDING_PROP,
      );
      falkorSingleton.vectorReady = true;
    })().catch((error: unknown) => {
      falkorSingleton.vectorOpening = null;
      throw error;
    });
  }
  return falkorSingleton.vectorOpening;
}

export function isVectorIndexesReady(): boolean {
  return falkorSingleton.vectorReady;
}

export async function getDb() {
  const client = await openDbClient();
  const graph = client.selectGraph(GRAPH_NAME);
  await ensureVectorIndexes(graph);
  return graph;
}

/** Local ANN row from Cypher — slim id/name/score only (not a full Memory). */
type AnnProbeRow = {
  id: string;
  name: string;
  score: number;
};

/**
 * Product vector search: each probe embedding is its own ANN lookup over
 * MemoryQuestion.questionEmbedding (FOR_MEMORY → Memory). Per-probe
 * cosine-distance ceiling (MEMORY_SEARCH_MAX_DISTANCE; Falkor yields distance,
 * 0 = identical); no cross-probe fusion.
 * Returns MemorySearchHit[][] aligned with embeddings (results[i] = probe i).
 */
export async function vectorSearchByQuestions(
  embeddings: number[][],
  topK: number = MEMORY_SEARCH_TOP_K,
): Promise<MemorySearchHit[][]> {
  if (embeddings.length === 0) {
    return [];
  }

  const graph = await getDb();
  const annQuery = `
    CALL db.idx.vector.queryNodes('MemoryQuestion', '${MEMORY_QUESTION_EMBEDDING_PROP}', $topK, vecf32($embedding))
    YIELD node, score
    MATCH (node)-[:FOR_MEMORY]->(m:Memory)
    RETURN m.id AS id,
           m.name AS name,
           score
  `;

  try {
    const results: MemorySearchHit[][] = [];

    for (const embedding of embeddings) {
      const result = (await graph.query(annQuery, {
        params: { topK, embedding },
      })) as { data: AnnProbeRow[] };

      const bestByMemoryId = new Map<string, MemorySearchHit>();
      for (const row of result.data ?? []) {
        if (row.score > MEMORY_SEARCH_MAX_DISTANCE) continue;
        const prior = bestByMemoryId.get(row.id);
        // Best hit per Memory = smallest distance (closest to the probe).
        if (prior == null || row.score < prior.score) {
          bestByMemoryId.set(row.id, {
            id: row.id,
            name: row.name,
            score: row.score,
          });
        }
      }

      const probeHits = Array.from(bestByMemoryId.values())
        // Ascending: smallest distance = most similar first.
        .sort((a, b) => a.score - b.score)
        .slice(0, topK);
      results.push(probeHits);
    }

    return results;
  } catch (error) {
    console.error("vectorSearchByQuestions error:", error);
    throw error;
  }
}

/** Cypher Memory core RETURN (no embeddings, no MemoryQuestion). */
const MEMORY_CORE_RETURN = `
           m.id AS id,
           m.name AS name,
           m.content AS content,
           m.impression AS impression,
           m.confidence AS confidence
`;

/**
 * Read one Memory by id (core fields only). Unknown id → null (does not throw).
 */
export async function getMemory(id: string): Promise<Memory | null> {
  const validId = z.string().min(1).parse(id);
  const graph = await getDb();
  const query = `
    MATCH (m:Memory {id: $id})
    RETURN ${MEMORY_CORE_RETURN}
  `;
  try {
    const result = (await graph.query(query, {
      params: { id: validId },
    })) as { data: Memory[] };
    const row = result.data?.[0];
    if (row == null) return null;
    return row;
  } catch (error) {
    console.error("getMemory error:", error);
    throw error;
  }
}

/**
 * Walk the incoming PARENT_OF chain (one parent max per hop).
 * Stops on missing parent or visited-set cycle. Missing gens omitted.
 */
async function collectAncestors(
  graph: FalkorGraph,
  startId: string,
  hops: number,
  visited: Set<string>,
): Promise<Memory[]> {
  const ancestors: Memory[] = [];
  let currentId = startId;
  const query = `
    MATCH (m:Memory)-[:PARENT_OF]->(c:Memory {id: $id})
    RETURN ${MEMORY_CORE_RETURN}
  `;

  for (let hop = 0; hop < hops; hop++) {
    const result = (await graph.query(query, {
      params: { id: currentId },
    })) as { data: Memory[] };
    const row = result.data?.[0];
    if (row == null) break;
    if (visited.has(row.id)) break;
    visited.add(row.id);
    ancestors.push(row);
    currentId = row.id;
  }

  return ancestors;
}

/**
 * Walk outgoing PARENT_OF children to `remainingHops` depth.
 * Visited-set cycle fuse skips already-seen ids (not a hop ceiling).
 */
async function collectDescendants(
  graph: FalkorGraph,
  parentId: string,
  remainingHops: number,
  visited: Set<string>,
): Promise<MemoryChild[]> {
  if (remainingHops <= 0) return [];

  const query = `
    MATCH (p:Memory {id: $id})-[:PARENT_OF]->(m:Memory)
    RETURN ${MEMORY_CORE_RETURN}
  `;
  const result = (await graph.query(query, {
    params: { id: parentId },
  })) as { data: Memory[] };

  const children: MemoryChild[] = [];
  for (const memory of result.data ?? []) {
    if (visited.has(memory.id)) continue;
    visited.add(memory.id);
    const nested = await collectDescendants(
      graph,
      memory.id,
      remainingHops - 1,
      visited,
    );
    children.push({ memory, children: nested });
  }
  return children;
}

/**
 * Load RELATES_TO edges incident on the center Memory only (incoming + outgoing).
 * Not a BFS — never walks beyond the center.
 */
async function collectCenterRelatesTo(
  graph: FalkorGraph,
  centerId: string,
): Promise<Links[]> {
  const query = `
    MATCH (a:Memory)-[r:RELATES_TO]->(b:Memory)
    WHERE a.id = $id OR b.id = $id
    RETURN a.id AS source, b.id AS target, type(r) AS type
  `;
  const result = (await graph.query(query, {
    params: { id: centerId },
  })) as { data: Array<{ source: string; target: string; type: string }> };

  return (result.data ?? []).map((row) =>
    LinksSchema.parse({
      source: row.source,
      target: row.target,
      type: row.type,
    }),
  );
}

/**
 * Neighborhood around a Memory: PARENT_OF cone and/or center RELATES_TO.
 * - PARENT_OF in linkTypes + hops > 0 → ancestors/descendants cone
 * - RELATES_TO in linkTypes → center-incident relatesTo only
 * - only RELATES_TO → ignore hops
 * - both → cone + relatesTo
 * Empty linkTypes (should not reach here if schema enforces min 1) → no walks.
 * hops NEVER walks RELATES_TO. Unknown id → null.
 */
export async function getMemoryCone(
  id: string,
  hops: number,
  linkTypes: MemoryLinkType[],
): Promise<MemoryCone | null> {
  const validId = z.string().min(1).parse(id);
  const memory = await getMemory(validId);
  if (memory == null) return null;

  const wantParentOf = linkTypes.includes("PARENT_OF");
  const wantRelatesTo = linkTypes.includes("RELATES_TO");

  let ancestors: Memory[] = [];
  let descendants: MemoryChild[] = [];
  let relatesTo: Links[] = [];

  if (wantParentOf && hops > 0) {
    const graph = await getDb();
    const visited = new Set<string>([memory.id]);
    ancestors = await collectAncestors(graph, memory.id, hops, visited);
    descendants = await collectDescendants(graph, memory.id, hops, visited);
  }

  if (wantRelatesTo) {
    const graph = await getDb();
    relatesTo = await collectCenterRelatesTo(graph, memory.id);
  }

  return { memory, ancestors, descendants, relatesTo };
}

/**
 * Read-only: all Memory nodes + PARENT_OF / RELATES_TO links for the graph canvas.
 * Omits embeddings. Does not write layout. Trusts write-path shape (no row filters).
 * NEVER returns MemoryQuestion or FOR_MEMORY (canvas topology is Memory-only).
 */
export async function listGraphTopology(): Promise<GraphTopology> {
  const graph = await getDb();

  const memoryQuery = `
    MATCH (m:Memory)
    RETURN m.id AS id,
           m.name AS name,
           m.content AS content,
           m.impression AS impression,
           m.confidence AS confidence
  `;

  const linkQuery = `
    MATCH (a:Memory)-[r]->(b:Memory)
    WHERE type(r) IN ['PARENT_OF', 'RELATES_TO']
    RETURN a.id AS source, b.id AS target, type(r) AS type
  `;

  try {
    const memResult = (await graph.query(memoryQuery)) as {
      data: Array<{
        id: string;
        name: string;
        content: string;
        impression: string;
        confidence: number;
      }>;
    };

    const linkResult = (await graph.query(linkQuery)) as {
      data: Array<{
        source: string;
        target: string;
        type: Links["type"];
      }>;
    };

    const memories: MemoryNode[] = (memResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      content: row.content,
      impression: row.impression,
      confidence: row.confidence,
    }));

    const links: Links[] = (linkResult.data ?? []).map((row) => ({
      source: row.source,
      target: row.target,
      type: row.type,
    }));

    return { memories, links };
  } catch (error) {
    console.error("listGraphTopology error:", error);
    throw error;
  }
}
