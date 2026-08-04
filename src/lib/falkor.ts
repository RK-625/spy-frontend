import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { FalkorDB } from "falkordblite";
import {
  Memory as MemorySchema,
  Links as LinksSchema,
  type Memory,
  type Links,
} from "@/types/graph-schema";
import type { GraphTopology, MemoryNode } from "@/types/graph-topology";
import { z } from "zod";

/** Re-export wire SoT from client-safe `@/types/graph-topology` (do not redefine). */
export type { GraphTopology, MemoryNode } from "@/types/graph-topology";

type FalkorNode<T> = {
  id: number; // FalkorDB's internal numeric node id — NOT your app id
  labels: string[];
  properties: T;
};

type VectorSearchRow = {
  node: FalkorNode<Memory>;
  score: number;
};

type VectorSearchResult = {
  data: VectorSearchRow[];
};

const GRAPH_NAME = "spy_brain";

/** Embedding dim must match `generateEmbedding` (gemini-embedding-2 truncated to 1536). */
const EMBEDDING_DIMENSION = 1536;
const VECTOR_SIMILARITY = "cosine" as const;
/** Property names on :Memory — must match upsertMemory + vectorSearch. */
const VECTOR_INDEX_FIELDS = ["searchEmbedding", "contentEmbedding"] as const;

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
/** Set after ensureSchema succeeds once per process (indexes are durable on disk). */
let schemaReady = false;
/** Single-flight schema so concurrent getDb() callers share one ensureSchema(). */
let schemaReadyPromise: Promise<void> | null = null;

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

/**
 * Process-singleton schema ensure. Concurrent callers await the same promise;
 * failure resets so the next getDb() can retry.
 */
function ensureSchemaOnce(graph: FalkorGraph): Promise<void> {
  if (schemaReady) {
    return Promise.resolve();
  }
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureSchema(graph)
      .then(() => {
        schemaReady = true;
      })
      .catch((error: unknown) => {
        schemaReadyPromise = null;
        throw error;
      });
  }
  return schemaReadyPromise;
}

function isAlreadyExistsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists|already indexed|Index already/i.test(message);
}

/**
 * Create cosine vector indexes on Memory embeddings.
 * Idempotent: swallows "already exists" so re-open / multi-worker is safe.
 */
async function ensureSchema(graph: FalkorGraph): Promise<void> {
  for (const field of VECTOR_INDEX_FIELDS) {
    const query = `
      CREATE VECTOR INDEX FOR (m:Memory) ON (m.${field})
      OPTIONS {dimension: ${EMBEDDING_DIMENSION}, similarityFunction: '${VECTOR_SIMILARITY}'}
    `;
    try {
      await graph.query(query);
      console.log(`FalkorDB vector index ready: Memory.${field}`);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        console.log(`FalkorDB vector index already present: Memory.${field}`);
        continue;
      }
      console.error(`FalkorDB ensureSchema failed for Memory.${field}:`, error);
      throw error;
    }
  }
}

export function isSchemaReady(): boolean {
  return schemaReady;
}

export async function getDb() {
  const client = await openDbClient();
  const graph = client.selectGraph(GRAPH_NAME);
  await ensureSchemaOnce(graph);
  return graph;
}

export async function vectorSearch(embedding: number[], topK: number = 10) {
  const validEmbedding = z.array(z.number()).parse(embedding);
  const validTopK = z.number().int().min(1).max(100).parse(topK);

  const graph = await getDb();
  const query = `
    CALL db.idx.vector.queryNodes('Memory', 'searchEmbedding', $topK, vecf32($embedding))
    YIELD node, score
    RETURN node, score
  `;

  try {
    const result = (await graph.query(query, {
      params: { topK: validTopK, embedding: validEmbedding },
    })) as VectorSearchResult;

    return result.data.map((row) => ({
      id: row.node.properties.id,
      name: row.node.properties.name,
      score: row.score,
    }));
  } catch (error) {
    console.error("Vector Search Error:", error);
    throw error;
  }
}

export async function hasOutgoingLink(
  source: string,
  type: "PART_OF" | "RELATES_TO",
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

export async function upsertMemory(memory: Memory) {
  const parsed = MemorySchema.parse(memory);
  const graph = await getDb();

  const query = `
    MERGE (m:Memory {id: $id})
    SET m.name = $name,
        m.content = $content,
        m.impression = $impression,
        m.confidence = $confidence,
        m.searchEmbedding = vecf32($searchEmbedding),
        m.contentEmbedding = vecf32($contentEmbedding)
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
        searchEmbedding: parsed.searchEmbedding,
        contentEmbedding: parsed.contentEmbedding,
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
 * Read-only: all Memory nodes + PART_OF / RELATES_TO links for the graph canvas.
 * Omits embeddings. Does not write layout. Trusts write-path shape (no row filters).
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
    WHERE type(r) IN ['PART_OF', 'RELATES_TO']
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
