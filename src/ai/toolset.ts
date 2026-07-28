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
  setMemoryLayout,
} from "@/lib/falkor";
import {
  isPlacedLayout,
  rankAfterParent,
  shouldPlaceOnUpsert,
  shouldPlaceOnLink,
  partOfRankNeedsUpdate,
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
      // Create: rank 0 only, leave x/y null — do **not** settle on create alone
      // (F1/F10). Missing xy later settles via cold update or link path.
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
        // Rank only on create; geometry comes from link/cold settle + setMemoryLayout.
        ...(isCreate ? { rank: 0 } : {}),
      });

      // F1/F10: never settle on create alone. Cold path: update missing/unplaced xy.
      if (!isCreate && needsSettle) {
        await settleAndPersistMemoryLayouts({ focusIds: [id] });
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
    "Create a directed edge between two existing Memory nodes. Call only after both nodes exist (upsert first if needed). PART_OF is hierarchical (source=child → target=parent); system sets child rank and settles layout with parent pinned. RELATES_TO is associative; system settles on link (topology). Geometry is never LLM-authored.",
  inputSchema: linkMemoriesInputSchema,
  execute: async ({ source, target, type }) => {
    try {
      await falkorCreateLink({ source, target, type });

      // Topology/rank via shared settle (force-recipe) + P-A setMemoryLayout.
      // Fan/spiral place* removed (S6); durable geometry is settled coords only.
      if (type === "PART_OF") {
        const parent = await getMemoryLayout(target);
        const sourceLayout = await getMemoryLayout(source);
        const parentRank = parent?.rank ?? 0;
        const childRank = rankAfterParent(parentRank);
        const childPlaced = isPlacedLayout(sourceLayout);
        const rankNeeds = partOfRankNeedsUpdate({
          sourceLayout,
          parentRank,
        });

        if (childPlaced && !rankNeeds) {
          // Already placed with correct rank — skip settle and rank write.
        } else if (childPlaced && rankNeeds) {
          // Rank-only: keep durable xy, write topology-derived rank (no force).
          const x = sourceLayout!.x as number;
          const y = sourceLayout!.y as number;
          await setMemoryLayout({ id: source, x, y, rank: childRank });
        } else if (shouldPlaceOnLink({ type: "PART_OF", sourceLayout })) {
          // Unplaced child: settle with parent as forced anchor.
          await settleAndPersistMemoryLayouts({
            focusIds: [source],
            anchorIds: [target],
            rankOverrides: { [source]: childRank },
          });
        }
      } else if (type === "RELATES_TO") {
        // F1: always settle RELATES_TO on link (topology; edge can pull nodes).
        // shouldPlaceOnLink(RELATES_TO) is always true — call settle directly.
        await settleAndPersistMemoryLayouts({ focusIds: [source] });
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
