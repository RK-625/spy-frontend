import { z } from "zod";
import { webSearchQueryFieldDescription } from "@/prompts/tools/web-search";

export const webSearchInputSchema = z.object({
  query: z.string().min(1).describe(webSearchQueryFieldDescription),
});

export type WebSearchInput = z.infer<typeof webSearchInputSchema>;
