import { z } from "zod";

export const webSearchInputSchema = z.object({
  query: z
    .string()
    .describe(
      "The search query to look up on the web — keywords or a short natural-language phrase for current facts, news, or details.",
    ),
});

export type WebSearchInput = z.infer<typeof webSearchInputSchema>;
