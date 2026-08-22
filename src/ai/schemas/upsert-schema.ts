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
 * Single object schema (DeepSeek-compatible JSON Schema type: object):
 * omit id = create (core fields + questions required via superRefine);
 * pass id = patch (at least one field). Product Memory row stays a full row.
 */

/** Agent-written retrieval probes; tool embeds and stores MemoryQuestion rows. */
const upsertMemoryQuestionsSchema = z
  .array(z.string().min(1).max(500))
  .min(MEMORY_QUESTION_COUNT_MIN)
  .max(MEMORY_QUESTION_COUNT_MAX)
  .describe(upsertMemoryQuestionsFieldDescription);

export const upsertMemoryInputSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .optional()
      .describe(upsertMemoryIdFieldDescription),
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
      .min(1)
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
    const isCreate = data.id === undefined;

    if (isCreate) {
      // Create: all core fields + questions required (same as old createMemoryInputSchema).
      if (data.name === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "name is required to create a Memory",
          path: ["name"],
        });
      }
      if (data.content === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "content is required to create a Memory",
          path: ["content"],
        });
      }
      if (data.impression === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "impression is required to create a Memory",
          path: ["impression"],
        });
      }
      if (data.confidence === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "confidence is required to create a Memory",
          path: ["confidence"],
        });
      }
      if (data.questions === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "questions are required to create a Memory",
          path: ["questions"],
        });
      }
      return;
    }

    // Patch: at least one field; name/content requires questions.
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

export type UpsertMemoryInput = z.infer<typeof upsertMemoryInputSchema>;
