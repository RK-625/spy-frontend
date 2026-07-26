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
   * Graph canvas layout (world space). Optional on write — filled by layout
   * or authoring so /graph can place nodes without re-running layout every load.
   * Not used for search; do not put incidence/rim/edge ids on Memory.
   */
  x: z
    .number()
    .optional()
    .describe("World X for the knowledge-graph canvas (stable layout)"),
  y: z
    .number()
    .optional()
    .describe("World Y for the knowledge-graph canvas (stable layout)"),
  rank: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Hierarchy depth for PART_OF: 0 = root (no parent); child = parent.rank + 1",
    ),
});
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
export const Links = z.object({
  source: z.string().describe("The ID of the source node"),
  target: z.string().describe("The ID of the target node"),
  type: z
    .enum(["PART_OF", "RELATES_TO"])
    .describe("The kind of the relation-ship between 2 nodes"),
});
