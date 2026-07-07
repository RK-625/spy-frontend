import { createClient } from "redis";
import { Memory, Links } from "../types/graph-schema";
import { z } from "zod";
const client = createClient({
  url: process.env.DATABASE_URL,
});

client.on("error", (err) => {
  console.error("Falkor Client Error:", err);
});

let isConnected = false;

type Memory = z.infer<typeof Memory>;
type Links = z.infer<typeof Links>;
type FalkorNode<T> = {
  id: number; // FalkorDB's internal numeric node id — NOT your app id
  labels: string[];
  properties: T;
};
type VectorSearchRow = {
  node: FalkorNode<z.infer<typeof Memory>>;
  score: number;
};
type VectorSearchResult = {
  data: VectorSearchRow[];
};

export async function getDb() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log("Falkor Client Connected");
  }
  return client;
}

export async function vectorSearch(embedding: number[], topK: number = 10) {
  z.array(z.number()).parse(embedding);
  z.number().min(1).parse(topK);
  const db = await getDb();
  const query = `CALL db.idx.vector.queryNodes('Memory','searchEmbedding', $topK, vecf32($embedding))
    YIELD node, score
    RETURN node, score`;
  try {
    // 1. Tell TypeScript exactly what shape FalkorDB returns
    const result = (await db.graph.query("spy_brain", query, {
      params: { topK, embedding },
    })) as VectorSearchResult;
    console.log(result);
    // 2. We don't need `any` here anymore because TypeScript knows row is a Record
    const formattedResults = result.data.map((row) => ({
      id: row.node.properties.id,
      name: row.node.properties.name,
      score: row.score,
    }));
    return formattedResults;
  } catch (error) {
    console.error("Vector Search Error:", error);
    throw error;
  }
}

export async function upsertMemory(memory: Memory) {
  const parsed = Memory.parse(memory);
  const db = await getDb();
  const query = `MERGE (m:Memory {id: $id})
          SET m.name = $name,
              m.content = $content,
              m.impression = $impression,
              m.confidence = $confidence,
              m.searchEmbedding = vecf32($searchEmbedding),
              m.contentEmbedding = vecf32($contentEmbedding)
          RETURN m.id
        `;
  try {
    const result = await db.graph.query("spy_brain", query, {
      params: parsed,
    });
    console.log(result);
  } catch (error) {
    console.error("Upsert Memory Error:", error);
    throw error;
  }
}

export async function CreateLink(link: Links) {
  const db = await getDb();
  const parsed = Links.parse(link);
  const query = `
          MATCH (source:Memory {id: $source})
          MATCH (target:Memory {id: $target})
          MERGE (source)-[r:${parsed.type}]->(target)
          RETURN type(r) AS type
        `;
  try {
    const result = (await db.graph.query("spy_brain", query, {
      params: {
        source: parsed.source,
        target: parsed.target,
      },
    })) as { data: Array<{ type: string }> };
    console.log(result);
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
