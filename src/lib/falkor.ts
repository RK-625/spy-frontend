import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { FalkorDB } from "falkordblite";
import {
  Memory as MemorySchema,
  Links as LinksSchema,
  type Memory,
  type Links,
  type MemorySearchHit,
  type MemoryNode,
  type MemoryQuestion,
} from "@/types/graph-schema";
import type { GraphTopology } from "@/types/graph-topology";
import {
  MEMORY_SEARCH_RRF_K,
  MEMORY_SEARCH_TOP_K,
} from "@/lib/policy-tokens";
import { z } from "zod";

/** Re-export wire SoT from client-safe `@/types/graph-topology` (do not redefine). */
export type { GraphTopology, MemoryNode } from "@/types/graph-topology";
export type { MemorySearchHit } from "@/types/graph-schema";

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

let db: FalkorClient | null = null;
/** Single-flight open so concurrent getDb() callers share one FalkorDB.open(). */
let dbOpenPromise: Promise<FalkorClient> | null = null;
/** Set after ensureVectorIndexes succeeds once per process (indexes are durable on disk). */
let vectorIndexesReady = false;
/** Single-flight so concurrent getDb() callers share one ensureVectorIndexes(). */
let vectorIndexesReadyPromise: Promise<void> | null = null;

async function ensureFalkorDataDir(): Promise<string> {
  await mkdir(FALKOR_PATH, { recursive: true });
  return FALKOR_PATH;
}

/**
 * Process-singleton open. Concurrent callers await the same promise; failed opens
 * reset so the next call can retry (do not leave a rejected promise cached forever).
 */
function openDbClient(): Promise<FalkorClient> {
  if (db) {
    return Promise.resolve(db);
  }
  if (!dbOpenPromise) {
    dbOpenPromise = (async () => {
      const dataDir = await ensureFalkorDataDir();
      // falkordblite: embedded server — use open(), not falkordb client connect()
      const client = await FalkorDB.open({ path: dataDir });
      db = client;
      console.log(`FalkorDBLite open at ${dataDir}`);
      return client;
    })().catch((error: unknown) => {
      dbOpenPromise = null;
      db = null;
      throw error;
    });
  }
  return dbOpenPromise;
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
  if (vectorIndexesReady) {
    return;
  }
  if (!vectorIndexesReadyPromise) {
    vectorIndexesReadyPromise = (async () => {
      await createVectorIndex(
        graph,
        "MemoryQuestion",
        MEMORY_QUESTION_EMBEDDING_PROP,
      );
      vectorIndexesReady = true;
    })().catch((error: unknown) => {
      vectorIndexesReadyPromise = null;
      throw error;
    });
  }
  return vectorIndexesReadyPromise;
}

export function isVectorIndexesReady(): boolean {
  return vectorIndexesReady;
}

export async function getDb() {
  const client = await openDbClient();
  const graph = client.selectGraph(GRAPH_NAME);
  await ensureVectorIndexes(graph);
  return graph;
}

/**
 * Reciprocal Rank Fusion over per-query memory id rankings.
 * Rank is 1-based. When the same memory appears multiple times in one list,
 * only the best (lowest) rank contributes for that list.
 */
function fuseRankedMemoryIdsWithRrf(
  rankedMemoryIdLists: string[][],
  rrfK: number = MEMORY_SEARCH_RRF_K,
): Map<string, number> {
  const rrfScoresByMemoryId = new Map<string, number>();
  for (const list of rankedMemoryIdLists) {
    const seenInList = new Set<string>();
    list.forEach((memoryId, index) => {
      if (seenInList.has(memoryId)) return;
      seenInList.add(memoryId);
      const rank = index + 1;
      const contribution = 1 / (rrfK + rank);
      rrfScoresByMemoryId.set(
        memoryId,
        (rrfScoresByMemoryId.get(memoryId) ?? 0) + contribution,
      );
    });
  }
  return rrfScoresByMemoryId;
}

/**
 * Product vector search: multi-ANN over MemoryQuestion.questionEmbedding, follow
 * FOR_MEMORY to parent Memory, fuse with RRF by memory id.
 * Returns lean MemorySearchHit[] (no embeddings, no MemoryQuestion rows).
 */
export async function vectorSearchByQuestions(
  embeddings: number[][],
  topK: number = MEMORY_SEARCH_TOP_K,
): Promise<MemorySearchHit[]> {
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
           m.content AS content,
           m.impression AS impression,
           m.confidence AS confidence,
           score
  `;

  const memoryById = new Map<string, MemoryNode>();
  const rankedLists: string[][] = [];

  try {
    for (const embedding of embeddings) {
      const result = (await graph.query(annQuery, {
        params: { topK, embedding },
      })) as { data: MemorySearchHit[] };

      const orderedIds: string[] = [];
      for (const row of result.data ?? []) {
        if (!memoryById.has(row.id)) {
          memoryById.set(row.id, {
            id: row.id,
            name: row.name,
            content: row.content,
            impression: row.impression,
            confidence: row.confidence,
          });
        }
        orderedIds.push(row.id);
      }
      rankedLists.push(orderedIds);
    }

    const rrfScoresByMemoryId = fuseRankedMemoryIdsWithRrf(
      rankedLists,
      MEMORY_SEARCH_RRF_K,
    );
    const hits: MemorySearchHit[] = [];
    for (const [memoryId, score] of rrfScoresByMemoryId) {
      const node = memoryById.get(memoryId);
      if (node == null) continue;
      hits.push({ ...node, score });
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, topK);
  } catch (error) {
    console.error("vectorSearchByQuestions error:", error);
    throw error;
  }
}

/**
 * Set MemoryQuestions for a Memory: DETACH DELETE all FOR_MEMORY questions,
 * then create the full replacement set. Product write path after upsertMemory.
 */
export async function setMemoryQuestions(
  memoryId: string,
  questions: MemoryQuestion[],
): Promise<void> {
  const validMemoryId = z.string().min(1).parse(memoryId);
  const graph = await getDb();

  const deleteQuery = `
    MATCH (q:MemoryQuestion)-[:FOR_MEMORY]->(m:Memory {id: $memoryId})
    DETACH DELETE q
  `;

  try {
    await graph.query(deleteQuery, {
      params: { memoryId: validMemoryId },
    });

    // Create one-by-one so vecf32($questionEmbedding) is reliable per param binding.
    for (const q of questions) {
      const createQuery = `
        MATCH (m:Memory {id: $memoryId})
        CREATE (mq:MemoryQuestion {
          id: $id,
          text: $text,
          ${MEMORY_QUESTION_EMBEDDING_PROP}: vecf32($questionEmbedding)
        })-[:FOR_MEMORY]->(m)
      `;
      await graph.query(createQuery, {
        params: {
          memoryId: validMemoryId,
          id: q.id,
          text: q.text,
          questionEmbedding: q.questionEmbedding,
        },
      });
    }
  } catch (error) {
    console.error("setMemoryQuestions error:", error);
    throw error;
  }
}

export async function hasOutgoingLink(
  source: string,
  type: "PARENT_OF" | "RELATES_TO",
): Promise<boolean> {
  const validSource = z.string().min(1).parse(source);
  const graph = await getDb();
  const query = `
    MATCH (s:Memory {id: $source})-[r:${type}]->()
    RETURN count(r) AS count
  `;
  try {
    const result = (await graph.query(query, {
      params: { source: validSource },
    })) as { data: Array<{ count: unknown }> };
    const countVal = result.data?.[0]?.count;
    const count =
      typeof countVal === "number" ? countVal : Number(countVal ?? 0);
    return count > 0;
  } catch (error) {
    console.error("hasOutgoingLink error:", error);
    throw error;
  }
}

/** True if `target` already has an incoming edge of `type` (e.g. a PARENT_OF parent). */
export async function hasIncomingLink(
  target: string,
  type: "PARENT_OF" | "RELATES_TO",
): Promise<boolean> {
  const validTarget = z.string().min(1).parse(target);
  const graph = await getDb();
  const query = `
    MATCH ()-[r:${type}]->(t:Memory {id: $target})
    RETURN count(r) AS count
  `;
  try {
    const result = (await graph.query(query, {
      params: { target: validTarget },
    })) as { data: Array<{ count: unknown }> };
    const countVal = result.data?.[0]?.count;
    const count =
      typeof countVal === "number" ? countVal : Number(countVal ?? 0);
    return count > 0;
  } catch (error) {
    console.error("hasIncomingLink error:", error);
    throw error;
  }
}

/**
 * Upsert Memory core fields only (id, name, content, impression, confidence).
 * Product search questions are written separately via setMemoryQuestions.
 */
export async function upsertMemory(memory: Memory) {
  const parsed = MemorySchema.parse(memory);
  const graph = await getDb();

  const query = `
    MERGE (m:Memory {id: $id})
    SET m.name = $name,
        m.content = $content,
        m.impression = $impression,
        m.confidence = $confidence
    RETURN m.id AS id
  `;

  try {
    const result = (await graph.query(query, {
      params: {
        id: parsed.id,
        name: parsed.name,
        content: parsed.content,
        impression: parsed.impression,
        confidence: parsed.confidence,
      },
    })) as { data: Array<{ id: string }> };

    return result.data[0]?.id;
  } catch (error) {
    console.error("Upsert Memory Error:", error);
    throw error;
  }
}

export async function createLink(link: Links) {
  const parsed = LinksSchema.parse(link);
  const graph = await getDb();

  const query = `
    MATCH (source:Memory {id: $source})
    MATCH (target:Memory {id: $target})
    MERGE (source)-[r:${parsed.type}]->(target)
    RETURN type(r) AS type
  `;

  try {
    const result = (await graph.query(query, {
      params: { source: parsed.source, target: parsed.target },
    })) as { data: Array<{ type: string }> };

    if (result.data.length === 0) {
      throw new Error(
        `Link not created — source (${parsed.source}) or target (${parsed.target}) not found`,
      );
    }

    return result.data[0].type;
  } catch (error) {
    console.error("Create Link Error:", error);
    throw error;
  }
}

/**
 * Atomic PARENT_OF create: one Cypher write that MERGEs when the child has no
 * *different* PARENT_OF parent. Same source→target is idempotent (MERGE no-op).
 * A different parent blocks (no reparent / last-wins). Empty result is classified
 * via hasIncomingLink (error message only; write is atomic).
 */
export async function createParentOfLink(link: Links): Promise<"PARENT_OF"> {
  const parsed = LinksSchema.parse(link);
  if (parsed.type !== "PARENT_OF") {
    throw new Error(
      `createParentOfLink requires type PARENT_OF, got ${parsed.type}`,
    );
  }

  const graph = await getDb();

  // Block only a *different* parent; same-source edge does not bind as blocker.
  const query = `
    MATCH (source:Memory {id: $source})
    MATCH (target:Memory {id: $target})
    OPTIONAL MATCH (other)-[existing:PARENT_OF]->(target)
    WHERE other.id <> $source
    WITH source, target, existing
    WHERE existing IS NULL
    MERGE (source)-[r:PARENT_OF]->(target)
    RETURN type(r) AS type
  `;

  try {
    const result = (await graph.query(query, {
      params: { source: parsed.source, target: parsed.target },
    })) as { data: Array<{ type: string }> };

    if (result.data.length > 0) {
      return "PARENT_OF";
    }

    // Write did not land — classify for the tool error string only.
    const alreadyHasParent = await hasIncomingLink(
      parsed.target,
      "PARENT_OF",
    );
    if (alreadyHasParent) {
      throw new Error(
        `Link failed: Memory '${parsed.target}' already has a PARENT_OF parent. A Memory can have at most one PARENT_OF parent.`,
      );
    }

    throw new Error(
      `Link not created — source (${parsed.source}) or target (${parsed.target}) not found`,
    );
  } catch (error) {
    console.error("Create PARENT_OF Link Error:", error);
    throw error;
  }
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
