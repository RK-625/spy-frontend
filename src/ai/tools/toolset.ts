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
  upsertMemory as falkorUpsertMemory,
  patchMemory as falkorPatchMemory,
  getMemory as falkorGetMemory,
  createLink as falkorCreateLink,
  deleteLink as falkorDeleteLink,
  setMemoryQuestions as falkorSetMemoryQuestions,
  vectorSearchByQuestions as falkorVectorSearchByQuestions,
  getMemoryCone as falkorGetMemoryCone,
  type MemoryPatchFields,
} from "@/lib/falkor";
import { MEMORY_SEARCH_TOP_K } from "@/lib/policy-tokens";
import type {
  ManageLinkItemResult,
  ManageLinksBatchResult,
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
        // --- Create: omit id; core fields + questions required ---
        if (!("id" in input)) {
          const { name, content, impression, confidence, questions } = input;
          const id = nanoid();
          const rows = await embedQuestionRows(questions);

          await falkorUpsertMemory({
            id,
            name,
            content,
            impression,
            confidence,
          });
          await falkorSetMemoryQuestions(id, rows);

          return { id, name, questionCount: rows.length };
        }

        // --- Patch: id present; only provided keys overwrite ---
        const existing = await falkorGetMemory(input.id);
        if (existing == null) {
          return { error: "Memory not found" };
        }

        const patch: MemoryPatchFields = {};
        if (input.name !== undefined) patch.name = input.name;
        if (input.content !== undefined) patch.content = input.content;
        if (input.impression !== undefined) patch.impression = input.impression;
        if (input.confidence !== undefined) patch.confidence = input.confidence;

        if (Object.keys(patch).length > 0) {
          await falkorPatchMemory(input.id, patch);
        }

        const mergedName = input.name ?? existing.name;

        if (input.questions !== undefined) {
          const rows = await embedQuestionRows(input.questions);
          await falkorSetMemoryQuestions(input.id, rows);
          return {
            id: input.id,
            name: mergedName,
            questionCount: rows.length,
          };
        }

        // Impression/confidence-only: no re-embed.
        return { id: input.id, name: mergedName };
      } catch (error) {
        console.error("upsertMemory tool error:", error);
        const message =
          error instanceof Error ? error.message : "Failed to upsert memory.";
        return { error: message };
      }
    },
  });

  const manageLinks: Tool = tool({
    description: manageLinksToolDescription,
    inputSchema: manageLinksInputSchema,
    execute: async ({ remove, upsert }) => {
      try {
        const removeResults: ManageLinkItemResult[] = [];
        let removeSucceeded = 0;
        for (const link of remove) {
          const { source, target, type } = link;
          try {
            await falkorDeleteLink(link);
            removeResults.push({ source, target, type, ok: true });
            removeSucceeded += 1;
          } catch (error) {
            console.error("manageLinks remove item error:", error);
            const message =
              error instanceof Error ? error.message : "Failed to remove link.";
            removeResults.push({
              source,
              target,
              type,
              ok: false,
              error: message,
            });
          }
        }

        const upsertResults: ManageLinkItemResult[] = [];
        let upsertSucceeded = 0;
        for (const link of upsert) {
          const { source, target, type } = link;
          try {
            await falkorCreateLink(link);
            upsertResults.push({ source, target, type, ok: true });
            upsertSucceeded += 1;
          } catch (error) {
            console.error("manageLinks upsert item error:", error);
            const message =
              error instanceof Error ? error.message : "Failed to upsert link.";
            upsertResults.push({
              source,
              target,
              type,
              ok: false,
              error: message,
            });
          }
        }

        const removeBatch: ManageLinksBatchResult = {
          succeeded: removeSucceeded,
          total: remove.length,
          results: removeResults,
        };
        const upsertBatch: ManageLinksBatchResult = {
          succeeded: upsertSucceeded,
          total: upsert.length,
          results: upsertResults,
        };
        return { remove: removeBatch, upsert: upsertBatch };
      } catch (error) {
        console.error("manageLinks tool error:", error);
        const message =
          error instanceof Error ? error.message : "Failed to manage links.";
        return { error: message };
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
