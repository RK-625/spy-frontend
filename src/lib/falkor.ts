import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { FalkorDB } from "falkordblite";
import {
  Memory as MemorySchema,
  Links as LinksSchema,
  type Memory,
  type Links,
} from "../types/graph-schema";
import { z } from "zod";

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
/** Set after ensureSchema succeeds once per process (indexes are durable on disk). */
let schemaReady = false;

async function ensureFalkorDataDir(): Promise<string> {
  await mkdir(FALKOR_PATH, { recursive: true });
  return FALKOR_PATH;
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
  if (!db) {
    const dataDir = await ensureFalkorDataDir();
    // falkordblite: embedded server — use open(), not falkordb client connect()
    db = await FalkorDB.open({ path: dataDir });
    console.log(`FalkorDBLite open at ${dataDir}`);
  }

  const graph = db.selectGraph(GRAPH_NAME);
  if (!schemaReady) {
    await ensureSchema(graph);
    schemaReady = true;
  }
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

export async function upsertMemory(memory: Memory) {
  const parsed = MemorySchema.parse(memory);
  const graph = await getDb();

  // coalesce layout props so content-only upserts do not wipe stored x/y/rank
  const query = `
    MERGE (m:Memory {id: $id})
    SET m.name = $name,
        m.content = $content,
        m.impression = $impression,
        m.confidence = $confidence,
        m.searchEmbedding = vecf32($searchEmbedding),
        m.contentEmbedding = vecf32($contentEmbedding),
        m.x = coalesce($x, m.x),
        m.y = coalesce($y, m.y),
        m.rank = coalesce($rank, m.rank)
    RETURN m.id AS id
  `;

  try {
    const result = (await graph.query(query, {
      params: {
        ...parsed,
        x: parsed.x ?? null,
        y: parsed.y ?? null,
        rank: parsed.rank ?? null,
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

/** Layout fields used for canvas placement (no embeddings / content). */
export type MemoryLayout = {
  id: string;
  x: number | null;
  y: number | null;
  rank: number | null;
};

function numOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * All Memory nodes with layout props (for collision / cluster placement).
 */
export async function listMemoryLayouts(): Promise<MemoryLayout[]> {
  const graph = await getDb();
  const query = `
    MATCH (m:Memory)
    RETURN m.id AS id, m.x AS x, m.y AS y, m.rank AS rank
  `;
  try {
    const result = (await graph.query(query)) as {
      data: Array<{ id: unknown; x: unknown; y: unknown; rank: unknown }>;
    };
    return (result.data ?? [])
      .map((row) => ({
        id: String(row.id ?? ""),
        x: numOrNull(row.x),
        y: numOrNull(row.y),
        rank: numOrNull(row.rank),
      }))
      .filter((row) => row.id.length > 0);
  } catch (error) {
    console.error("listMemoryLayouts error:", error);
    throw error;
  }
}

export async function getMemoryLayout(
  id: string,
): Promise<MemoryLayout | null> {
  const validId = z.string().min(1).parse(id);
  const graph = await getDb();
  const query = `
    MATCH (m:Memory {id: $id})
    RETURN m.id AS id, m.x AS x, m.y AS y, m.rank AS rank
  `;
  try {
    const result = (await graph.query(query, {
      params: { id: validId },
    })) as {
      data: Array<{ id: unknown; x: unknown; y: unknown; rank: unknown }>;
    };
    const row = result.data?.[0];
    if (row == null) return null;
    return {
      id: String(row.id ?? validId),
      x: numOrNull(row.x),
      y: numOrNull(row.y),
      rank: numOrNull(row.rank),
    };
  } catch (error) {
    console.error("getMemoryLayout error:", error);
    throw error;
  }
}

/**
 * Force-write canvas layout (does not coalesce — used after placeMemoryNode).
 */
export async function setMemoryLayout(input: {
  id: string;
  x: number;
  y: number;
  rank: number;
}): Promise<void> {
  const id = z.string().min(1).parse(input.id);
  const x = z.number().finite().parse(input.x);
  const y = z.number().finite().parse(input.y);
  const rank = z.number().int().min(0).parse(input.rank);
  const graph = await getDb();
  const query = `
    MATCH (m:Memory {id: $id})
    SET m.x = $x, m.y = $y, m.rank = $rank
    RETURN m.id AS id
  `;
  try {
    const result = (await graph.query(query, {
      params: { id, x, y, rank },
    })) as { data: Array<{ id: string }> };
    if (result.data.length === 0) {
      throw new Error(`setMemoryLayout: Memory not found (${id})`);
    }
  } catch (error) {
    console.error("setMemoryLayout error:", error);
    throw error;
  }
}
