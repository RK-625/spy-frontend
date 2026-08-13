import { z } from "zod";
import { MemoryLinkType } from "@/types/graph-schema";
import {
  linkMemoriesSourceFieldDescription,
  linkMemoriesTargetFieldDescription,
  linkMemoriesTypeFieldDescription,
} from "@/prompts/tools/link-memories";

/**
 * Tool input for directed Memory edges.
 * Topology only — tools never author canvas geometry or rank.
 * Graph client derives rank from PARENT_OF (parent → child).
 */
export const linkMemoriesInputSchema = z.object({
  source: z.string().min(1).describe(linkMemoriesSourceFieldDescription),
  target: z.string().min(1).describe(linkMemoriesTargetFieldDescription),
  type: MemoryLinkType.describe(linkMemoriesTypeFieldDescription),
});

export type LinkMemoriesInput = z.infer<typeof linkMemoriesInputSchema>;
