import { z } from "zod";
import {
  getMemoriesIdFieldDescription,
  getMemoriesHopsFieldDescription,
} from "@/prompts/tools/get-memories";

/**
 * Tool input for PARENT_OF cone inspect around a Memory id.
 * hops is generations (optional, default 0 at execute); no max.
 */
export const getMemoriesInputSchema = z.object({
  id: z.string().min(1).describe(getMemoriesIdFieldDescription),
  hops: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(getMemoriesHopsFieldDescription),
});

export type GetMemoriesInput = z.infer<typeof getMemoriesInputSchema>;
