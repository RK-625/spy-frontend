import { z } from "zod";

/**
 * Product Memory row — core fields only.
 * Embeddings live on MemoryQuestion (`questionEmbedding`), never on Memory.
 * Layout (x/y) is client-only — Sigma + graphology FA2 own placement; never on this wire.
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
    .describe("Natural-language retrieval question (agent-provided at write)"),
  questionEmbedding: z
    .number()
    .array()
    .describe("Embedding of text — sole product ANN index field"),
});
export type MemoryQuestion = z.infer<typeof MemoryQuestion>;

/**
 * Lean Memory row for topology transfer.
 * With Memory core-only, this is identical to Memory (alias).
 * Wire shape for GET `/api/graph`; client Sigma host maps memories/links.
 */
export type MemoryNode = Memory;

/**
 * Slim vector-search hit for one probe: id + name + best ANN cosine.
 * Score is that probe’s cosine, not RRF, and not a full Memory body.
 */
export type MemorySearchHit = {
  id: string;
  name: string;
  score: number;
};

/** Recursive PARENT_OF child in a getMemories cone. */
export type MemoryChild = {
  memory: Memory;
  children: MemoryChild[];
};

/**
 * Neighborhood around a center Memory.
 * PARENT_OF cone (ancestors up, descendants down) and/or center-incident RELATES_TO.
 * `relatesTo` is always present (empty when not requested or none exist).
 */
export type MemoryCone = {
  memory: Memory;
  ancestors: Memory[];
  descendants: MemoryChild[];
  relatesTo: Links[];
};

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

/** Hierarchical PARENT_OF (parent → child) or associative RELATES_TO. */
export const MemoryLinkType = z.enum(["PARENT_OF", "RELATES_TO"]);
export type MemoryLinkType = z.infer<typeof MemoryLinkType>;

export const Links = z.object({
  source: z.string().describe("The ID of the source node"),
  target: z.string().describe("The ID of the target node"),
  type: MemoryLinkType.describe(
    "PARENT_OF: parent → child. RELATES_TO: association.",
  ),
});
/** Inferred product link row (value `Links` is the Zod schema). */
export type Links = z.infer<typeof Links>;

export const Link = Links;
export type Link = Links;

/** Per-edge outcome inside a manageLinks remove or upsert batch. */
export type ManageLinkItemResult = {
  source: string;
  target: string;
  type: MemoryLinkType;
  ok: boolean;
  error?: string;
};

/** Aggregated results for one manageLinks array (remove or upsert). */
export type ManageLinksBatchResult = {
  succeeded: number;
  total: number;
  results: ManageLinkItemResult[];
};

/** manageLinks tool result: both batches on success, or `{ error }` only on failure. */
export type ManageLinksResult =
  | { remove: ManageLinksBatchResult; upsert: ManageLinksBatchResult }
  | { error: string };
