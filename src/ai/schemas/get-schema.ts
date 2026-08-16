import { z } from "zod";
import { MemoryLinkType } from "@/types/graph-schema";
import {
  getMemoriesIdFieldDescription,
  getMemoriesHopsFieldDescription,
  getMemoriesLinkTypesFieldDescription,
} from "@/prompts/tools/get-memories";

/**
 * Tool input for Memory inspect: PARENT_OF cone and/or center-incident RELATES_TO.
 * hops is PARENT_OF generations only (optional, default 0 at execute); no max.
 * linkTypes required — at least one of PARENT_OF / RELATES_TO.
 */
export const getMemoriesInputSchema = z.object({
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

export type GetMemoriesInput = z.infer<typeof getMemoriesInputSchema>;
