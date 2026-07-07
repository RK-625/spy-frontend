import { FalkorDB } from "falkordb";
import { Memory, Links } from "../types/graph-schema";
import { z } from "zod";

type Memory = z.infer<typeof Memory>;
type Links = z.infer<typeof Links>;

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

let db: Awaited<ReturnType<typeof FalkorDB.connect>> | null = null;

export async function getDb() {
  if (!db) {
    db = await FalkorDB.connect({
      url: process.env.DATABASE_URL,
    });
    console.log("Falkor Client Connected");
  }
  return db.selectGraph(GRAPH_NAME);
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
  const parsed = Memory.parse(memory);
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
      params: parsed,
    })) as { data: Array<{ id: string }> };

    return result.data[0]?.id;
  } catch (error) {
    console.error("Upsert Memory Error:", error);
    throw error;
  }
}

export async function createLink(link: Links) {
  const parsed = Links.parse(link);
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
