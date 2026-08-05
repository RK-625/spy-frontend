import { generateText, Output, tool, Tool } from "ai";
import { nanoid } from "nanoid";
import Exa from "exa-js";
import { z } from "zod";
import { askUserQuestionInputSchema } from "@/ai/schemas/ask-schema";
import { upsertMemoryInputSchema } from "@/ai/schemas/upsert-schema";
import { linkMemoriesInputSchema } from "@/ai/schemas/link-schema";
import { searchMemoriesInputSchema } from "@/ai/schemas/search-schema";
import { webSearchInputSchema } from "@/ai/schemas/web-search-schema";
import { generateEmbedding } from "@/ai/models/embeddings";
import { modelConfig } from "@/ai/models/modelstore";
import {
  upsertMemory as falkorUpsertMemory,
  createLink as falkorCreateLink,
  hasOutgoingLink,
  setMemoryQuestions as falkorSetMemoryQuestions,
  vectorSearchByQuestions as falkorVectorSearchByQuestions,
} from "@/lib/falkor";
import {
  MEMORY_QUESTION_COUNT_MAX,
  MEMORY_QUESTION_COUNT_MIN,
  MEMORY_QUESTIONS_PER_MEMORY,
  MEMORY_SEARCH_TOP_K,
} from "@/lib/policy-tokens";
import { memoryQuestionsPrompt } from "@/prompts/memory-questions-prompt";

export type { AskUserQuestionInput } from "@/ai/schemas/ask-schema";
export { askUserQuestionInputSchema } from "@/ai/schemas/ask-schema";
export type { UpsertMemoryInput } from "@/ai/schemas/upsert-schema";
export { upsertMemoryInputSchema } from "@/ai/schemas/upsert-schema";
export type { LinkMemoriesInput } from "@/ai/schemas/link-schema";
export { linkMemoriesInputSchema } from "@/ai/schemas/link-schema";
export type { SearchMemoriesInput } from "@/ai/schemas/search-schema";
export { searchMemoriesInputSchema } from "@/ai/schemas/search-schema";
export type { WebSearchInput } from "@/ai/schemas/web-search-schema";
export { webSearchInputSchema } from "@/ai/schemas/web-search-schema";

export type CreateToolSetOptions = {
  /** Chat model id for tool-side LLM work (e.g. MemoryQuestion generation). */
  model?: string;
};

/** Policy-derived target count for MemoryQuestion generation (prompt-side only). */
const questionCountTarget = Math.min(
  MEMORY_QUESTION_COUNT_MAX,
  Math.max(MEMORY_QUESTION_COUNT_MIN, MEMORY_QUESTIONS_PER_MEMORY),
);

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
    description:
      "Search the web for up-to-date information, news, details, and facts.",
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
    description:
      "Resolve ambiguity or force a decision with a multiple-choice question (2–5 options). Set allowCustomInput true only when a write-in is reasonable. Do not use for open-ended chat.",
    inputSchema: askUserQuestionInputSchema,
  });

  const upsertMemory: Tool = tool({
    description:
      "Create or update a Memory node in the knowledge graph. Use for durable facts, concepts, or explanations worth weaving into the user's web. Prefer small focused memories; omit id to create, pass id to update content only. The system auto-generates retrieval questions via LLM for later Q↔Q search — do not invent or pass questions yourself. Do not pass canvas coordinates or rank — placement is client-side on the graph map. Structure via linkMemories.",
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

        const id: string =
          input.id == null || input.id === "" ? nanoid() : (input.id as string);
        const impression = input.impression ?? "";
        const confidence = input.confidence ?? 0.5;

        // 1. Generate questions before any Memory write — fail whole tool if Q-gen fails.
        const { model } = modelConfig({ model: modelId });
        const userPayload = [
          `Memory name: ${input.name}`,
          `Memory content:\n${input.content}`,
          input.impression != null && input.impression !== ""
            ? `Impression: ${input.impression}`
            : null,
          input.confidence != null ? `Confidence: ${input.confidence}` : null,
          `Generate ${questionCountTarget} retrieval questions (${MEMORY_QUESTION_COUNT_MIN}–${MEMORY_QUESTION_COUNT_MAX}).`,
        ]
          .filter((line): line is string => line != null)
          .join("\n\n");

        const { output } = await generateText({
          model,
          system: memoryQuestionsPrompt,
          prompt: userPayload,
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
          if (questionEmbedding == null) {
            throw new Error(
              "upsertMemory failed: missing embedding for a retrieval question.",
            );
          }
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

  const linkMemories: Tool = tool({
    description:
      "Create a directed edge between two existing Memory nodes. Call only after both nodes exist (upsert first if needed). PART_OF is hierarchical (source=child → target=parent); a child may have at most one PART_OF parent. RELATES_TO is associative. Geometry/rank are never LLM-authored — the graph client derives rank and places nodes from topology.",
    inputSchema: linkMemoriesInputSchema,
    execute: async ({ source, target, type }) => {
      try {
        if (type === "PART_OF") {
          const hasParent = await hasOutgoingLink(source, "PART_OF");
          if (hasParent) {
            return {
              error: `Link failed: Memory '${source}' already has a PART_OF parent link. A Memory can have at most one PART_OF parent.`,
            };
          }
        }

        await falkorCreateLink({ source, target, type });

        return { type, source, target };
      } catch (error) {
        console.error("linkMemories tool error:", error);
        const message =
          error instanceof Error ? error.message : "Failed to link memories.";
        return { error: message };
      }
    },
  });

  const searchMemories: Tool = tool({
    description:
      "Semantic search over the knowledge graph via MemoryQuestion embeddings (Q↔Q). Pass 1–5 natural-language questions in user-meta style (e.g. \"What do I know about React Server Components?\"). Multi-ANN + RRF returns Memory hits. Use before create to avoid duplicates and to find ids for update/link. Does not invent layout or write nodes.",
    inputSchema: searchMemoriesInputSchema,
    execute: async ({ questions }) => {
      try {
        const embeddings = await Promise.all(
          questions.map((q: string) => generateEmbedding(q)),
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

  return {
    webSearch,
    askUserQuestion,
    upsertMemory,
    linkMemories,
    searchMemories,
  };
}
