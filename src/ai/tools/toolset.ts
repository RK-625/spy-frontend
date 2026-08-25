import { tool, Tool } from "ai";
import { nanoid } from "nanoid";
import Exa from "exa-js";
import { askUserQuestionInputSchema } from "../schemas/ask-schema";
import { upsertMemoryInputSchema } from "../schemas/upsert-schema";
import { manageLinksInputSchema } from "../schemas/link-schema";
import { searchMemoriesInputSchema } from "../schemas/search-schema";
import { getMemoriesInputSchema } from "../schemas/get-schema";
import { webSearchInputSchema } from "../schemas/web-search-schema";
import { generateEmbedding } from "../models/embeddings";
import {
  getDb,
  vectorSearchByQuestions as falkorVectorSearchByQuestions,
  getMemoryCone as falkorGetMemoryCone,
} from "@/lib/falkor";
import { MEMORY_SEARCH_TOP_K } from "@/lib/policy-tokens";
import type {
  Links,
  ManageLinksBatchResult,
  ManageLinksResult,
  MemoryQuestion,
} from "@/types/graph-schema";
import {
  askUserQuestionToolDescription,
  manageLinksToolDescription,
  getMemoriesToolDescription,
  searchMemoriesToolDescription,
  upsertMemoryToolDescription,
  webSearchToolDescription,
} from "@/prompts/tools";

/** Map Falkor/Cypher assert failures to the readable manageLinks error fragment. */
function manageLinksEngineErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : "Failed to manage links.";
  // Sticky PARENT_OF assert uses 1/0 (toInteger(string) is null in Falkor, not an error).
  if (/division by zero/i.test(raw)) {
    return "Link failed: Memory already has a PARENT_OF parent. A Memory can have at most one PARENT_OF parent.";
  }
  if (/endpoint was not found/i.test(raw)) {
    return "Link not created — source or target not found";
  }
  if (/not found/i.test(raw)) return raw;
  if (/already has a PARENT_OF/i.test(raw)) return raw;
  return raw;
}

/** Readable fragment for upsertMemory all-or-nothing catch. */
function upsertMemoryEngineErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to upsert memory.";
}

/**
 * Unrolled MemoryQuestion CREATE clauses for one GRAPH.QUERY.
 * MATCH attach by Memory id so clauses stay valid after CREATE Memory or
 * MATCH+SET+delete old probes in the same query. Per-param vecf32($qN_emb)
 * (UNWIND map.vecf32 is unreliable in Falkor).
 */
function memoryQuestionCreateCypher(
  rows: MemoryQuestion[],
  memoryId: string,
): {
  cypher: string;
  params: Record<string, string | number[]>;
} {
  const params: Record<string, string | number[]> = { memoryId };
  const createClauses = rows.map((row, index) => {
    const idKey = `q${index}_id`;
    const textKey = `q${index}_text`;
    const embKey = `q${index}_emb`;
    params[idKey] = row.id;
    params[textKey] = row.text;
    params[embKey] = row.questionEmbedding;
    return `
      CREATE (mq${index}:MemoryQuestion {
        id: $${idKey},
        text: $${textKey},
        questionEmbedding: vecf32($${embKey})
      })-[:FOR_MEMORY]->(mqMem)`;
  });
  return {
    cypher: `
      MATCH (mqMem:Memory {id: $memoryId})
      ${createClauses.join("\n")}`,
    params,
  };
}

/** Lazy Exa client — never construct at module load (missing key must not kill chat). */
function getExaClient(): Exa | null {
  const key = process.env.EXA_API_KEY;
  if (key == null || key.trim() === "") return null;
  return new Exa(key);
}

/** Embed agent-provided probe texts into MemoryQuestion rows (ids + vectors). */
async function embedQuestionRows(texts: string[]): Promise<MemoryQuestion[]> {
  const questionEmbeddings = await Promise.all(
    texts.map((text) => generateEmbedding(text)),
  );
  return texts.map((text, index) => ({
    id: nanoid(),
    text,
    questionEmbedding: questionEmbeddings[index]!,
  }));
}

/**
 * Build the product tool registry.
 * Retrieval probes are agent-authored on upsertMemory; this toolset only embeds.
 */
export function createToolSet(): Record<string, Tool> {
  const webSearch: Tool = tool({
    description: webSearchToolDescription,
    inputSchema: webSearchInputSchema,
    execute: async ({ query }) => {
      try {
        const exa = getExaClient();
        if (exa == null) {
          return {
            error: "Web search is unavailable: EXA_API_KEY is not set.",
          };
        }
        const response = await exa.search(query, {
          numResults: 5,
          contents: { text: { maxCharacters: 5000 } },
        });
        return {
          results: response.results.map((r) => ({
            title: r.title || "Undefined",
            url: r.url,
            text: r.text || "",
          })),
        };
      } catch (error) {
        console.error("Exa search error:", error);
        return { error: "Failed to retrieve search results." };
      }
    },
  });

  const askUserQuestion: Tool = tool({
    description: askUserQuestionToolDescription,
    inputSchema: askUserQuestionInputSchema,
  });

  const upsertMemory: Tool = tool({
    description: upsertMemoryToolDescription,
    inputSchema: upsertMemoryInputSchema,
    execute: async (input) => {
      try {
        const graph = await getDb();
        const rows =
          input.questions !== undefined
            ? await embedQuestionRows(input.questions)
            : null;

        // --- Create: omit id; rows already embedded; one GRAPH.QUERY ---
        if (input.id == null) {
          const { name, content, impression, confidence } = input;
          const id = nanoid();
          if (name === undefined) {
            return { error: "name required to create a Memory" };
          }
          if (content === undefined) {
            return { error: "content required to create a Memory" };
          }
          if (impression === undefined) {
            return { error: "impression required to create a Memory" };
          }
          if (confidence === undefined) {
            return { error: "confidence required to create a Memory" };
          }
          // Create schema requires questions; rows is non-null here.
          if (rows == null) {
            return { error: "questions required to create a Memory" };
          }
          const questionWrite = memoryQuestionCreateCypher(rows, id);

          const query = `
            CREATE (m:Memory {
              id: $id,
              name: $name,
              content: $content,
              impression: $impression,
              confidence: $confidence
            })
            WITH m
            ${questionWrite.cypher}
            RETURN m.id AS id
          `;

          await graph.query(query, {
            params: {
              id,
              name,
              content,
              impression,
              confidence,
              ...questionWrite.params,
            },
          });

          return { id, name, questionCount: rows.length };
        }

        // --- Patch: rows already embedded when questions present; one GRAPH.QUERY ---
        const memoryId = input.id;
        const props: Record<string, string | number> = {};
        if (input.name !== undefined) props.name = input.name;
        if (input.content !== undefined) props.content = input.content;
        if (input.impression !== undefined) props.impression = input.impression;
        if (input.confidence !== undefined) props.confidence = input.confidence;
        const params: Record<
          string,
          string | number | number[] | Record<string, string | number>
        > = { id: memoryId, props };
        let query: string;
        if (rows != null) {
          const questionWrite = memoryQuestionCreateCypher(rows, memoryId);
          Object.assign(params, questionWrite.params);
          // SET + replace probes in the same query so failure rolls back both.
          query = `
            MATCH (m:Memory {id: $id})
            SET m += $props
            WITH m
            OPTIONAL MATCH (m)<-[:FOR_MEMORY]-(oldq:MemoryQuestion)
            DETACH DELETE oldq
            WITH DISTINCT m
            ${questionWrite.cypher}
            RETURN m.id AS id, m.name AS name
          `;
        } else {
          // Impression/confidence-only (or empty props edge): SET only, no probe rewrite.
          query = `
            MATCH (m:Memory {id: $id})
            SET m += $props
            RETURN m.id AS id, m.name AS name
          `;
        }

        const result = (await graph.query(query, { params })) as {
          data: Array<{ id: string; name: string }>;
        };
        const row = result.data?.[0];
        if (row == null) {
          return { error: "Memory not found" };
        }

        if (rows != null) {
          return {
            id: row.id,
            name: row.name,
            questionCount: rows.length,
          };
        }

        return { id: row.id, name: row.name };
      } catch (error) {
        console.error("upsertMemory tool error:", error);
        return {
          error: `upsertMemory failed (all-or-nothing); graph unchanged. ${upsertMemoryEngineErrorMessage(error)}`,
        };
      }
    },
  });

  const manageLinks: Tool = tool({
    description: manageLinksToolDescription,
    inputSchema: manageLinksInputSchema,
    execute: async ({ remove, upsert }): Promise<ManageLinksResult> => {
      const emptyBatch = (): ManageLinksBatchResult => ({
        succeeded: 0,
        total: 0,
        results: [],
      });
      const okBatch = (links: Links[]): ManageLinksBatchResult => ({
        succeeded: links.length,
        total: links.length,
        results: links.map((link) => ({
          source: link.source,
          target: link.target,
          type: link.type,
          ok: true,
        })),
      });

      try {
        if (remove.length === 0 && upsert.length === 0) {
          return { remove: emptyBatch(), upsert: emptyBatch() };
        }

        // One GRAPH.QUERY: DELETE removes, then MERGE upserts. Asserts force
        // engine rollback on missing upsert endpoints or sticky PARENT_OF.
        type LinkEndpointParam = { source: string; target: string };

        const removeParentOf: LinkEndpointParam[] = remove
          .filter((r) => r.type === "PARENT_OF")
          .map(({ source, target }) => ({ source, target }));
        const removeRelatesTo: LinkEndpointParam[] = remove
          .filter((r) => r.type === "RELATES_TO")
          .map(({ source, target }) => ({ source, target }));
        const upsertParentOf: LinkEndpointParam[] = upsert
          .filter((u) => u.type === "PARENT_OF")
          .map(({ source, target }) => ({ source, target }));
        const upsertRelatesTo: LinkEndpointParam[] = upsert
          .filter((u) => u.type === "RELATES_TO")
          .map(({ source, target }) => ({ source, target }));

        const stages: string[] = [];
        const pushStage = (cypher: string) => {
          if (stages.length > 0) {
            stages.push(`WITH count(*) AS _bridge${stages.length}`);
          }
          stages.push(cypher.trim());
        };

        if (removeParentOf.length > 0) {
          pushStage(`
            UNWIND $removeParentOf AS rm
            OPTIONAL MATCH (rms:Memory {id: rm.source})-[rmr:PARENT_OF]->(rmt:Memory {id: rm.target})
            FOREACH (_ IN CASE WHEN rmr IS NOT NULL THEN [1] ELSE [] END | DELETE rmr)
          `);
        }
        if (removeRelatesTo.length > 0) {
          pushStage(`
            UNWIND $removeRelatesTo AS rm
            OPTIONAL MATCH (rms:Memory {id: rm.source})-[rmr:RELATES_TO]->(rmt:Memory {id: rm.target})
            FOREACH (_ IN CASE WHEN rmr IS NOT NULL THEN [1] ELSE [] END | DELETE rmr)
          `);
        }

        // One stage per PARENT_OF so same-query deletes + earlier MERGEs are visible.
        // Missing endpoints: MATCH-style require via MERGE (null endpoint errors).
        // Sticky other parent: 1/0 aborts the query so earlier deletes roll back.
        for (let i = 0; i < upsertParentOf.length; i++) {
          pushStage(`
            WITH $upsertParentOf[${i}] AS up
            OPTIONAL MATCH (us:Memory {id: up.source})
            OPTIONAL MATCH (ut:Memory {id: up.target})
            OPTIONAL MATCH (other)-[:PARENT_OF]->(ut)
            WHERE other.id <> up.source
            WITH us, ut, up, other,
              1 / CASE
                WHEN other IS NOT NULL THEN 0
                ELSE 1
              END AS _ok
            MERGE (us)-[:PARENT_OF]->(ut)
          `);
        }

        // OPTIONAL + MERGE: missing endpoint errors the query (MATCH alone yields 0 rows).
        if (upsertRelatesTo.length > 0) {
          pushStage(`
            UNWIND $upsertRelatesTo AS up
            OPTIONAL MATCH (us:Memory {id: up.source})
            OPTIONAL MATCH (ut:Memory {id: up.target})
            MERGE (us)-[:RELATES_TO]->(ut)
          `);
        }

        const query = `${stages.join("\n")}\nRETURN count(*) AS done`;
        const params = {
          removeParentOf,
          removeRelatesTo,
          upsertParentOf,
          upsertRelatesTo,
        };

        const graph = await getDb();
        await graph.query(query, { params });

        return {
          remove: okBatch(remove),
          upsert: okBatch(upsert),
        };
      } catch (error) {
        console.error("manageLinks tool error:", error);
        return {
          error: `manageLinks failed (all-or-nothing); graph unchanged. ${manageLinksEngineErrorMessage(error)}`,
        };
      }
    },
  });

  const searchMemories: Tool = tool({
    description: searchMemoriesToolDescription,
    inputSchema: searchMemoriesInputSchema,
    execute: async ({ questions }) => {
      try {
        const embeddings = await Promise.all(
          questions.map((q) => generateEmbedding(q)),
        );
        const hits = await falkorVectorSearchByQuestions(
          embeddings,
          MEMORY_SEARCH_TOP_K,
        );
        return { results: hits };
      } catch (error) {
        console.error("searchMemories tool error:", error);
        const message =
          error instanceof Error ? error.message : "Failed to search memories.";
        return { error: message };
      }
    },
  });

  const getMemories: Tool = tool({
    description: getMemoriesToolDescription,
    inputSchema: getMemoriesInputSchema,
    execute: async ({ id, hops, linkTypes }) => {
      try {
        const cone = await falkorGetMemoryCone(id, hops ?? 0, linkTypes);
        if (cone == null) {
          return { error: "Memory not found" };
        }
        return cone;
      } catch (error) {
        console.error("getMemories tool error:", error);
        const message =
          error instanceof Error ? error.message : "Failed to get memories.";
        return { error: message };
      }
    },
  });

  return {
    webSearch,
    askUserQuestion,
    upsertMemory,
    manageLinks,
    searchMemories,
    getMemories,
  };
}
