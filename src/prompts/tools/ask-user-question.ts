/**
 * Narrative for askUserQuestion (ambiguity / decision path).
 * Tool description + agent bullet.
 */

/** `tool({ description })` for askUserQuestion in the product toolset. */
export const askUserQuestionToolDescription = `Resolve ambiguity or force a decision with a multiple-choice question (2–5 options).
Set allowCustomInput true only when a write-in is reasonable.
Do not use for open-ended chat.`;

/** Short how-to bullet for the agent system prompt. */
export const ASK_USER_QUESTION_AGENT_BULLET = `ONLY for ambiguity or a decision only the user can own.
Never for open-ended chat.
Use sparingly.
The next user message is their answer (often as Q:/A:).`;

/** Zod `.describe(...)` for the `question` field on askUserQuestion input schema. */
export const askUserQuestionQuestionFieldDescription = `The question text.`;

/** Zod `.describe(...)` for the `options` field on askUserQuestion input schema. */
export const askUserQuestionOptionsFieldDescription = `Options for the user to choose from.`;

/** Zod `.describe(...)` for the `allowCustomInput` field on askUserQuestion input schema. */
export const askUserQuestionAllowCustomInputFieldDescription = `Whether to allow a write-in response.`;
