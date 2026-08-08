import { z } from "zod";
import {
  upsertMemoryNameFieldDescription,
  upsertMemoryContentFieldDescription,
  upsertMemoryImpressionFieldDescription,
  upsertMemoryConfidenceFieldDescription,
  upsertMemoryIdFieldDescription,
} from "@/prompts/tools/upsert-memory";

/**
 * Tool input for create/update Memory. Canvas layout is client-owned
 * (placement cache) — never present on this schema; the LLM must not invent
 * coordinates or rank.
 */
export const upsertMemoryInputSchema = z.object({
  name: z.string().min(1).describe(upsertMemoryNameFieldDescription),
  content: z.string().min(1).describe(upsertMemoryContentFieldDescription),
  impression: z
    .string()
    .min(1)
    .optional()
    .describe(upsertMemoryImpressionFieldDescription),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(upsertMemoryConfidenceFieldDescription),
  id: z.string().min(1).optional().describe(upsertMemoryIdFieldDescription),
});

export type UpsertMemoryInput = z.infer<typeof upsertMemoryInputSchema>;
