import { z } from "zod";
import {
  MEMORY_QUESTION_COUNT_MAX,
  MEMORY_QUESTION_COUNT_MIN,
} from "@/lib/policy-tokens";
import {
  upsertMemoryNameFieldDescription,
  upsertMemoryContentFieldDescription,
  upsertMemoryImpressionFieldDescription,
  upsertMemoryConfidenceFieldDescription,
  upsertMemoryIdFieldDescription,
  upsertMemoryQuestionsFieldDescription,
} from "@/prompts/tools/upsert-memory";

/**
 * Tool input for create/update Memory. Canvas layout is client-owned
 * (placement cache) — never present on this schema; the LLM must not invent
 * coordinates or rank.
 *
 * Union so TypeScript narrows: omit id = create (core fields + questions);
 * pass id = patch (at least one field). Product Memory row stays a full row.
 */

/** Agent-written retrieval probes; tool embeds and stores MemoryQuestion rows. */
const upsertMemoryQuestionsSchema = z
  .array(z.string().min(1).max(500))
  .min(MEMORY_QUESTION_COUNT_MIN)
  .max(MEMORY_QUESTION_COUNT_MAX)
  .describe(upsertMemoryQuestionsFieldDescription);

const createMemoryInputSchema = z.object({
  name: z.string().min(1).describe(upsertMemoryNameFieldDescription),
  content: z.string().min(1).describe(upsertMemoryContentFieldDescription),
  impression: z
    .string()
    .min(1)
    .describe(upsertMemoryImpressionFieldDescription),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(upsertMemoryConfidenceFieldDescription),
  questions: upsertMemoryQuestionsSchema,
});

const patchMemoryInputSchema = z
  .object({
    id: z.string().min(1).describe(upsertMemoryIdFieldDescription),
    name: z
      .string()
      .min(1)
      .optional()
      .describe(upsertMemoryNameFieldDescription),
    content: z
      .string()
      .min(1)
      .optional()
      .describe(upsertMemoryContentFieldDescription),
    impression: z
      .string()
      .optional()
      .describe(upsertMemoryImpressionFieldDescription),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(upsertMemoryConfidenceFieldDescription),
    questions: upsertMemoryQuestionsSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const hasPatchField =
      data.name !== undefined ||
      data.content !== undefined ||
      data.impression !== undefined ||
      data.confidence !== undefined ||
      data.questions !== undefined;
    if (!hasPatchField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "When id is set, provide at least one of name, content, impression, confidence, or questions.",
        path: ["id"],
      });
    }
    const touchesNameOrContent =
      data.name !== undefined || data.content !== undefined;
    if (touchesNameOrContent && data.questions === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "When patching name or content, questions are required (full replacement set).",
        path: ["questions"],
      });
    }
  });

/** Patch first so `{ id, … }` is not stripped into a create. */
export const upsertMemoryInputSchema = z.union([
  patchMemoryInputSchema,
  createMemoryInputSchema,
]);

export type UpsertMemoryInput = z.infer<typeof upsertMemoryInputSchema>;
