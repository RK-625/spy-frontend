import { z } from "zod";
import {
  linkMemoriesSourceFieldDescription,
  linkMemoriesTargetFieldDescription,
  linkMemoriesTypeFieldDescription,
} from "@/prompts/tools/link-memories";

/**
 * Tool input for directed Memory edges.
 * Topology only — tools never author canvas geometry or rank.
 * Graph client derives rank from PART_OF and places nodes from topology/cache.
 */
export const linkMemoriesInputSchema = z.object({
  source: z.string().min(1).describe(linkMemoriesSourceFieldDescription),
  target: z.string().min(1).describe(linkMemoriesTargetFieldDescription),
  type: z
    .enum(["PART_OF", "RELATES_TO"])
    .describe(linkMemoriesTypeFieldDescription),
});

export type LinkMemoriesInput = z.infer<typeof linkMemoriesInputSchema>;
