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
 * Canvas / API topology row — no embeddings (keep `/api/graph` payloads small).
 * Enough for `memoryGraphToGraphData` + HUD labels.
 */
export type GraphTopologyMemory = {
  id: string;
  name: string;
  content: string;
  impression: string;
  confidence: number;
  x?: number;
  y?: number;
  rank?: number;
};

export type GraphTopology = {
  memories: GraphTopologyMemory[];
  links: Links[];
};

function strOr(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function numOr(value: unknown, fallback: number): number {
  const n = numOrNull(value);
  return n == null ? fallback : n;
}

/**
 * Read-only: all Memory nodes + PART_OF / RELATES_TO links for the graph canvas.
 * Omits embeddings. Does not write layout.
 */
export async function listGraphTopology(): Promise<GraphTopology> {
  const graph = await getDb();

  const memoryQuery = `
    MATCH (m:Memory)
    RETURN m.id AS id,
           m.name AS name,
           m.content AS content,
           m.impression AS impression,
           m.confidence AS confidence,
           m.x AS x,
           m.y AS y,
           m.rank AS rank
  `;

  const linkQuery = `
    MATCH (a:Memory)-[r]->(b:Memory)
    WHERE type(r) IN ['PART_OF', 'RELATES_TO']
    RETURN a.id AS source, b.id AS target, type(r) AS type
  `;

  try {
    const memResult = (await graph.query(memoryQuery)) as {
      data: Array<{
        id: unknown;
        name: unknown;
        content: unknown;
        impression: unknown;
        confidence: unknown;
        x: unknown;
        y: unknown;
        rank: unknown;
      }>;
    };

    const linkResult = (await graph.query(linkQuery)) as {
      data: Array<{ source: unknown; target: unknown; type: unknown }>;
    };

    const memories: GraphTopologyMemory[] = (memResult.data ?? [])
      .map((row) => {
        const id = strOr(row.id, "").trim();
        if (!id) return null;
        const x = numOrNull(row.x);
        const y = numOrNull(row.y);
        const rank = numOrNull(row.rank);
        const out: GraphTopologyMemory = {
          id,
          name: strOr(row.name, id),
          content: strOr(row.content, ""),
          impression: strOr(row.impression, ""),
          confidence: numOr(row.confidence, 0.5),
        };
        if (x != null) out.x = x;
        if (y != null) out.y = y;
        if (rank != null) out.rank = Math.max(0, Math.floor(rank));
        return out;
      })
      .filter((row): row is GraphTopologyMemory => row != null);

    const links: Links[] = [];
    const seen = new Set<string>();
    for (const row of linkResult.data ?? []) {
      const source = strOr(row.source, "").trim();
      const target = strOr(row.target, "").trim();
      const type = strOr(row.type, "");
      if (!source || !target) continue;
      if (type !== "PART_OF" && type !== "RELATES_TO") continue;
      const key = `${type}:${source}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source, target, type });
    }

    return { memories, links };
  } catch (error) {
    console.error("listGraphTopology error:", error);
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
