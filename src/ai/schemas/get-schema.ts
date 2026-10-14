import { z } from "zod";
import { MemoryLinkType } from "@/types/graph-schema";
import { MEMORY_GET_MAX_REQUESTS } from "@/lib/graph/policy";
import {
  getMemoriesMemoriesFieldDescription,
  getMemoriesIdFieldDescription,
  getMemoriesHopsFieldDescription,
  getMemoriesLinkTypesFieldDescription,
} from "@/prompts/tools/get-memories";

/**
 * One Memory lookup: PARENT_OF cone and/or center-incident RELATES_TO.
 * hops is PARENT_OF generations only (optional, default 0 at execute); no max.
 * linkTypes required — at least one of PARENT_OF / RELATES_TO.
 */
export const getMemoryRequestSchema = z.object({
  id: z.string().min(1).describe(getMemoriesIdFieldDescription),
  hops: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(getMemoriesHopsFieldDescription),
  linkTypes: z
    .array(MemoryLinkType)
    .min(1)
    .describe(getMemoriesLinkTypesFieldDescription),
});

/** Batch requests retain independent traversal settings and input order. */
export const getMemoriesInputSchema = z.object({
  memories: z
    .array(getMemoryRequestSchema)
    .min(1)
    .max(MEMORY_GET_MAX_REQUESTS)
    .describe(getMemoriesMemoriesFieldDescription),
});

export type GetMemoriesInput = z.infer<typeof getMemoriesInputSchema>;

/** Full Memory listing needs no search terms, ids, or traversal settings. */
export const getAllMemoriesInputSchema = z.object({});
