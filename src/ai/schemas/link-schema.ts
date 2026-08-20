import { z } from "zod";
import { Links } from "@/types/graph-schema";
import {
  manageLinksRemoveFieldDescription,
  manageLinksUpsertFieldDescription,
} from "@/prompts/tools/manage-links";

/**
 * Tool input for batch Memory edge structure (remove then upsert).
 * Topology only — tools never author canvas geometry or rank.
 * Graph client derives rank from PARENT_OF (parent → child).
 * Output: `{ remove, upsert }` all-ok batches on success, or `{ error }` only on failure.
 */
export const manageLinksInputSchema = z.object({
  remove: z
    .array(Links)
    .default([])
    .describe(manageLinksRemoveFieldDescription),
  upsert: z
    .array(Links)
    .default([])
    .describe(manageLinksUpsertFieldDescription),
});

export type ManageLinksInput = z.infer<typeof manageLinksInputSchema>;
