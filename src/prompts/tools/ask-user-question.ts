/**
 * Narrative for askUserQuestion (ambiguity / decision path).
 * Tool description + agent bullet + field describes.
 */

/** `tool({ description })` for askUserQuestion in the product toolset. */
export const askUserQuestionToolDescription = `Ask a multiple-choice question (2–5 options) to resolve ambiguity or force a decision.
Set allowCustomInput true only when a write-in is reasonable.
Do not use for open-ended chat.`;

/** Short how-to bullet for the agent system prompt. */
export const ASK_USER_QUESTION_AGENT_BULLET = `Tool for resolving ambiguity or forcing a decision — for understanding the user's intent or perspective,
leading to clearer session alignment.
Not open-ended chat.`;

/** Zod `.describe(...)` for the `question` field on askUserQuestion input schema. */
export const askUserQuestionQuestionFieldDescription = `The question sent to the user.
One concrete decision or ambiguity — the listed options must be complete answers to this question.`;

/** Zod `.describe(...)` for the `options` field on askUserQuestion input schema. */
export const askUserQuestionOptionsFieldDescription = `2–5 distinct choice labels.
Each option is a complete, mutually exclusive answer path — not a vague stub.`;

/** Zod `.describe(...)` for the `allowCustomInput` field on askUserQuestion input schema. */
export const askUserQuestionAllowCustomInputFieldDescription = `True only when a free-text write-in is a reasonable alternative to the listed options.
False for forced-choice decisions.`;
