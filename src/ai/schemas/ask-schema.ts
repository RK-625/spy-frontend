import { z } from "zod";
import {
  askUserQuestionQuestionFieldDescription,
  askUserQuestionOptionsFieldDescription,
  askUserQuestionAllowCustomInputFieldDescription,
} from "@/prompts/tools/ask-user-question";

export const askUserQuestionInputSchema = z.object({
  question: z.string().describe(askUserQuestionQuestionFieldDescription),
  options: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe(askUserQuestionOptionsFieldDescription),
  allowCustomInput: z
    .boolean()
    .describe(askUserQuestionAllowCustomInputFieldDescription),
});

export type AskUserQuestionInput = z.infer<typeof askUserQuestionInputSchema>;
