import { generateText, Output, tool, Tool } from "ai";
import { nanoid } from "nanoid";
import Exa from "exa-js";
import { z } from "zod";
import { askUserQuestionInputSchema } from "../schemas/ask-schema";
import { upsertMemoryInputSchema } from "../schemas/upsert-schema";
import { manageLinksInputSchema } from "../schemas/link-schema";
import { searchMemoriesInputSchema } from "../schemas/search-schema";
import { getMemoriesInputSchema } from "../schemas/get-schema";
import { webSearchInputSchema } from "../schemas/web-search-schema";
import { generateEmbedding } from "../models/embeddings";
import { modelConfig } from "../models/modelstore";
import {
  upsertMemory as falkorUpsertMemory,
  createLink as falkorCreateLink,
  deleteLink as falkorDeleteLink,
  setMemoryQuestions as falkorSetMemoryQuestions,
  vectorSearchByQuestions as falkorVectorSearchByQuestions,
  getMemoryCone as falkorGetMemoryCone,
} from "@/lib/falkor";
import { MEMORY_SEARCH_TOP_K } from "@/lib/policy-tokens";
import type {
  ManageLinkItemResult,
  ManageLinksBatchResult,
} from "@/types/graph-schema";
import {
  MEMORY_QUESTIONS_USER_PROMPT_PREFIX,
  askUserQuestionToolDescription,
  manageLinksToolDescription,
  memoryQuestionsGenerationSystem,
  getMemoriesToolDescription,
  searchMemoriesToolDescription,
  upsertMemoryToolDescription,
  webSearchToolDescription,
} from "@/prompts/tools";

export type CreateToolSetOptions = {
  /** Chat model id for tool-side LLM work (e.g. MemoryQuestion generation). */
  model?: string;
};

/** Max chars per generated retrieval question (schema element cap). */
const RETRIEVAL_QUESTION_MAX_CHARS = 500;

/** Lazy Exa client — never construct at module load (missing key must not kill chat). */
function getExaClient(): Exa | null {
  const key = process.env.EXA_API_KEY;
  if (key == null || key.trim() === "") return null;
  return new Exa(key);
}

/**
 * Build the product tool registry. Pass `model` so upsertMemory can generate
 * retrieval questions with the user's selected chat model.
 */
export function createToolSet(
  opts?: CreateToolSetOptions,
): Record<string, Tool> {
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
        const modelId = opts?.model;
        if (modelId == null || modelId.trim() === "") {
          return {
            error:
              "upsertMemory failed: chat model is required to generate retrieval questions.",
          };
        }
        const id =
          input.id != null && input.id !== "" ? input.id : nanoid();
        const impression = input.impression ?? "";
        const confidence = input.confidence ?? 0.5;

        // 1. Generate questions before any Memory write — fail whole tool if Q-gen fails.
        const memoryPayload: {
          name: string;
          content: string;
          impression?: string;
          confidence?: number;
        } = {
          name: input.name,
          content: input.content,
        };
        if (input.impression != null && input.impression !== "") {
          memoryPayload.impression = input.impression;
        }
        if (input.confidence != null) {
          memoryPayload.confidence = input.confidence;
        }

        const { model } = modelConfig({ model: modelId });
        const { output } = await generateText({
          model,
          system: memoryQuestionsGenerationSystem,
          prompt: [
            MEMORY_QUESTIONS_USER_PROMPT_PREFIX,
            JSON.stringify(memoryPayload),
          ].join("\n\n"),
          output: Output.array({
            element: z.string().min(1).max(RETRIEVAL_QUESTION_MAX_CHARS),
          }),
        });
        if (output == null) {
          throw new Error("upsertMemory: model returned no output.");
        }
        const questionTexts = output;

        // 2. Upsert core Memory.
        await falkorUpsertMemory({
          id,
          name: input.name,
          content: input.content,
          impression,
          confidence,
        });

        // 3. Embed each question + set MemoryQuestions (fail tool if this fails).
        const questionEmbeddings = await Promise.all(
          questionTexts.map((text) => generateEmbedding(text)),
        );
        const questions = questionTexts.map((text, index) => {
          const questionEmbedding = questionEmbeddings[index];
          return {
            id: nanoid(),
            text,
            questionEmbedding,
          };
        });
        await falkorSetMemoryQuestions(id, questions);

        return { id, name: input.name, questionCount: questions.length };
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
