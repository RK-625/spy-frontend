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
export const askUserQuestionQuestionFieldDescription = `Clear, single decision or ambiguity to resolve.
Not open-ended chat; the user will pick an option (or write-in when allowed).`;

/** Zod `.describe(...)` for the `options` field on askUserQuestion input schema. */
export const askUserQuestionOptionsFieldDescription = `2–5 distinct choice labels the user can pick.
Each option is a complete, mutually exclusive answer path — not vague stubs.`;

/** Zod `.describe(...)` for the `allowCustomInput` field on askUserQuestion input schema. */
export const askUserQuestionAllowCustomInputFieldDescription = `True only when a free-text write-in is a reasonable alternative to the listed options.
False for forced-choice decisions.`;
