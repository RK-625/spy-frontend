import { tool, Tool } from "ai";
import { nanoid } from "nanoid";
import Exa from "exa-js";
import { askUserQuestionInputSchema } from "@/ai/schemas/ask-user-question";
import { upsertMemoryInputSchema } from "@/ai/schemas/upsert-memory";
import { linkMemoriesInputSchema } from "@/ai/schemas/link-memories";
import { webSearchInputSchema } from "@/ai/schemas/web-search";
import { generateEmbedding } from "@/ai/embeddings";
import {
  upsertMemory as falkorUpsertMemory,
  createLink as falkorCreateLink,
} from "@/lib/falkor";

export type { AskUserQuestionInput } from "@/ai/schemas/ask-user-question";
export { askUserQuestionInputSchema } from "@/ai/schemas/ask-user-question";
export type { UpsertMemoryInput } from "@/ai/schemas/upsert-memory";
export { upsertMemoryInputSchema } from "@/ai/schemas/upsert-memory";
export type { LinkMemoriesInput } from "@/ai/schemas/link-memories";
export { linkMemoriesInputSchema } from "@/ai/schemas/link-memories";
export type { WebSearchInput } from "@/ai/schemas/web-search";
export { webSearchInputSchema } from "@/ai/schemas/web-search";

/** Lazy Exa client — never construct at module load (missing key must not kill chat). */
function getExaClient(): Exa | null {
  const key = process.env.EXA_API_KEY;
  if (key == null || key.trim() === "") return null;
  return new Exa(key);
}

const webSearch: Tool = tool({
  description:
    "Search the web for up-to-date information, news, details, and facts.",
  inputSchema: webSearchInputSchema,
  execute: async ({ query }) => {
    try {
      const exa = getExaClient();
      if (exa == null) {
        return { error: "Web search is unavailable: EXA_API_KEY is not set." };
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
    "Create or update a Memory node in the knowledge graph. Use for durable facts, concepts, or explanations worth weaving into the user's web. Prefer small focused memories; omit id to create, pass id to update.",
  inputSchema: upsertMemoryInputSchema,
  execute: async (input) => {
    try {
      const id = input.id ?? nanoid();
      const impression = input.impression ?? "";
      const confidence = input.confidence ?? 0.5;
      const searchText = `${input.name}\n${input.content}`;

      const [searchEmbedding, contentEmbedding] = await Promise.all([
        generateEmbedding(searchText),
        generateEmbedding(input.content),
      ]);

      await falkorUpsertMemory({
        id,
        name: input.name,
        content: input.content,
        impression,
        confidence,
        searchEmbedding,
        contentEmbedding,
      });

      return { id, name: input.name };
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
    "Create a directed edge between two existing Memory nodes. Call only after both nodes exist (upsert first if needed). PART_OF is hierarchical (child → parent); RELATES_TO is associative.",
  inputSchema: linkMemoriesInputSchema,
  execute: async ({ source, target, type }) => {
    try {
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

export const toolSet: Record<string, Tool> = {
  webSearch,
  askUserQuestion,
  upsertMemory,
  linkMemories,
};
