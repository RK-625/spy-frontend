import { z } from "zod";

export const askUserQuestionInputSchema = z.object({
  question: z.string().describe("The question text."),
  options: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Options for the user to choose from."),
  allowCustomInput: z
    .boolean()
    .describe("Whether to allow a write-in response."),
});

export type AskUserQuestionInput = z.infer<typeof askUserQuestionInputSchema>;
