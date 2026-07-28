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
  getMemoryLayout,
} from "@/lib/falkor";
import {
  rankAfterParent,
  shouldPlaceOnUpsert,
  shouldPlaceOnLink,
} from "@/lib/memory-placement";
import { settleAndPersistMemoryLayouts } from "@/lib/memory-layout-settle";

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
    "Create or update a Memory node in the knowledge graph. Use for durable facts, concepts, or explanations worth weaving into the user's web. Prefer small focused memories; omit id to create, pass id to update content only (does not move the node). Do not pass canvas coordinates or rank — the system places nodes. Structure via linkMemories.",
  inputSchema: upsertMemoryInputSchema,
  execute: async (input) => {
    try {
      const isCreate = input.id == null || input.id === "";
      const id: string = isCreate ? nanoid() : (input.id as string);
      const impression = input.impression ?? "";
      const confidence = input.confidence ?? 0.5;
      const searchText = `${input.name}\n${input.content}`;

      const [searchEmbedding, contentEmbedding] = await Promise.all([
        generateEmbedding(searchText),
        generateEmbedding(input.content),
      ]);

      // Layout is system-owned (P-A). Content-only updates preserve x/y/rank —
      // no re-settle when topology is unchanged (shouldPlaceOnUpsert).
      const existing = isCreate ? null : await getMemoryLayout(id);
      const needsSettle = shouldPlaceOnUpsert({ isCreate, existing });

      await falkorUpsertMemory({
        id,
        name: input.name,
        content: input.content,
        impression,
        confidence,
        searchEmbedding,
        contentEmbedding,
        // Rank only on create; geometry comes from shared d3 settle + setMemoryLayout.
        ...(isCreate ? { rank: 0 } : {}),
      });

      if (needsSettle) {
        await settleAndPersistMemoryLayouts();
      }

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
    "Create a directed edge between two existing Memory nodes. Call only after both nodes exist (upsert first if needed). PART_OF is hierarchical (source=child → target=parent); system sets child rank and settles layout. RELATES_TO is associative; system settles only when source lacks layout. Geometry is never LLM-authored.",
  inputSchema: linkMemoriesInputSchema,
  execute: async ({ source, target, type }) => {
    try {
      await falkorCreateLink({ source, target, type });

      // Topology/rank via shared settle (force-recipe) + P-A setMemoryLayout.
      // No fan/spiral placeAs* — durable geometry is settled coords only.
      if (type === "PART_OF") {
        const parent = await getMemoryLayout(target);
        const sourceLayout = await getMemoryLayout(source);
        if (shouldPlaceOnLink({ type: "PART_OF", sourceLayout })) {
          const childRank = rankAfterParent(parent?.rank ?? 0);
          await settleAndPersistMemoryLayouts({
            rankOverrides: { [source]: childRank },
          });
        }
      } else if (type === "RELATES_TO") {
        const sourceLayout = await getMemoryLayout(source);
        if (shouldPlaceOnLink({ type: "RELATES_TO", sourceLayout })) {
          await settleAndPersistMemoryLayouts();
        }
      }

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
