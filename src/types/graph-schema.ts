import { z } from "zod";

/**
 * Product Memory row — core fields only.
 * Embeddings live on MemoryQuestion (`questionEmbedding`), never on Memory.
 * Layout (x/y/rank) is client-only via placement-cache.
 */
export const Memory = z.object({
  id: z.string().describe("A unique identifier to the Memory"),
  name: z.string().describe("The main title of the Memory"),
  content: z
    .string()
    .describe("The facts,knowledge or user-friendly explanation of the memory"),
  impression: z
    .string()
    .describe(
      "The user's impression on this memory from prepestive of the AI and how it evolved",
    ),
  confidence: z
    .number()
    .describe(
      "The confidence score of the memory of how well the user understands and grasps the content",
    ),
});
/** Inferred product Memory row (value `Memory` is the Zod schema). */
export type Memory = z.infer<typeof Memory>;

/**
 * Question node used for product ANN search (Q↔Q).
 * Linked (:MemoryQuestion)-[:FOR_MEMORY]->(:Memory). Never on canvas topology.
 */
export const MemoryQuestion = z.object({
  id: z.string().describe("Unique id for this MemoryQuestion"),
  text: z
    .string()
    .describe("Natural-language retrieval question (LLM-generated at write)"),
  questionEmbedding: z
    .number()
    .array()
    .describe("Embedding of text — sole product ANN index field"),
});
export type MemoryQuestion = z.infer<typeof MemoryQuestion>;

/**
 * Lean Memory row for topology transfer / placement.
 * With Memory core-only, this is identical to Memory (alias).
 * Wire shape for GET `/api/graph` and `placeTopology` input.
 */
export type MemoryNode = Memory;

/** Vector search hit: Memory + fused RRF score. */
export type MemorySearchHit = MemoryNode & { score: number };

export const Concept = z.object({
  id: z.string().describe("A unique identifier to the node"),
  name: z.string().describe("The main title of the node"),
  content: z
    .string()
    .describe("The facts,knowledge or user-friendly explanation of the memory"),
  impression: z
    .string()
    .describe(
      "The user's impression on this memory from prepestive of the AI and how it evolved",
    ),
  confidence: z
    .number()
    .describe(
      "The confidence score of the memory of how well the user understands and grasps the content",
    ),
});
export type Concept = z.infer<typeof Concept>;

export const Links = z.object({
  source: z.string().describe("The ID of the source node"),
  target: z.string().describe("The ID of the target node"),
  type: z
    .enum(["PART_OF", "RELATES_TO"])
    .describe("The kind of the relation-ship between 2 nodes"),
});
/** Inferred product link row (value `Links` is the Zod schema). */
export type Links = z.infer<typeof Links>;

export const Link = Links;
export type Link = Links;
