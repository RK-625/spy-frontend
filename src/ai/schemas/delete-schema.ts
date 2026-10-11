import { z } from "zod";
import { deleteMemoriesIdsFieldDescription } from "@/prompts/tools/delete-memories";

export const deleteMemoriesInputSchema = z.object({
  ids: z
    .array(z.string().trim().min(1))
    .min(1)
    .describe(deleteMemoriesIdsFieldDescription),
});

export type DeleteMemoriesInput = z.infer<typeof deleteMemoriesInputSchema>;
