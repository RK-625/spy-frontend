import type { UIMessage } from "ai";
import {
  askUserQuestionInputSchema,
  type AskUserQuestionInput,
} from "@/ai/schemas/ask-user-question";

export type { AskUserQuestionInput };

/** Pack user answer for a pending ask as a tight Q/A chat message. */
export function formatAskUserQuestionAnswer(args: {
  question: string;
  answer: string;
}): string {
  const question = args.question.trim();
  const answer = args.answer.trim();
  return `Q: ${question}\nA: ${answer}`;
}

/** Pending askUserQuestion on the last assistant message (input-available). */
export type PendingAskUserQuestion = {
  toolCallId: string;
  messageId: string;
  question: string;
  options: { id: string; label: string }[];
  allowCustomInput: boolean;
};

/** Extract toolCallId/state/input when part is tool-askUserQuestion. */
function readAskUserQuestionPart(
  part: UIMessage["parts"][number] | undefined,
): { toolCallId: string; state: string; input: unknown } | null {
  if (!part || typeof part !== "object") return null;
  if (!("type" in part) || part.type !== "tool-askUserQuestion") return null;
  if (!("toolCallId" in part) || typeof part.toolCallId !== "string") return null;
  if (!("state" in part) || typeof part.state !== "string") return null;
  const input = "input" in part ? part.input : undefined;
  return { toolCallId: part.toolCallId, state: part.state, input };
}

export function getPendingAskUserQuestion(
  messages: UIMessage[],
): PendingAskUserQuestion | null {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return null;

  for (let i = (last.parts?.length ?? 0) - 1; i >= 0; i--) {
    const toolPart = readAskUserQuestionPart(last.parts![i]);
    if (!toolPart) continue;
    if (toolPart.state !== "input-available") continue;

    const parsed = askUserQuestionInputSchema.safeParse(toolPart.input);
    if (!parsed.success) continue;

    const question = parsed.data.question.trim();
    if (!question) continue;

    const options = parsed.data.options
      .map((label, index) => ({ id: `opt-${index}`, label: label.trim() }))
      .filter((o) => o.label.length > 0);
    if (options.length < 2 || options.length > 5) continue;

    return {
      toolCallId: toolPart.toolCallId,
      messageId: last.id,
      question,
      options,
      allowCustomInput: parsed.data.allowCustomInput,
    };
  }
  return null;
}
