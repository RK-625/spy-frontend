import { z } from "zod";

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
  searchEmbedding: z
    .number()
    .array()
    .describe("The embedding vector used for searching the memory"),
  contentEmbedding: z
    .number()
    .array()
    .describe("The embedding vector of the memory content"),
  confidence: z
    .number()
    .describe(
      "The confidence score of the memory of how well the user understands and grasps the content",
    ),
  /**
   * Server-owned canvas layout storage (world space). Written by placement /
   * toolset after create or PART_OF link — not model-authored tool input.
   * Optional on schema so reads/writes without layout stay valid.
   * Not used for search; do not put incidence/rim/edge ids on Memory.
   */
  x: z
    .number()
    .optional()
    .describe(
      "Server-owned world X on the knowledge-graph canvas (system placement only; never LLM tool input)",
    ),
  y: z
    .number()
    .optional()
    .describe(
      "Server-owned world Y on the knowledge-graph canvas (system placement only; never LLM tool input)",
    ),
  rank: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Server-owned hierarchy depth from PART_OF: 0 = root; child = parent.rank + 1 (system-derived, not model-authored)",
    ),
});
/** Inferred product Memory row (value `Memory` is the Zod schema). */
export type Memory = z.infer<typeof Memory>;

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
