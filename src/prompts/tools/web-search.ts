/**
 * Narrative for webSearch (external facts / verification path).
 * Tool description + agent bullet.
 */

/** `tool({ description })` for webSearch in the product toolset. */
export const webSearchToolDescription = `Search the web for up-to-date information, news, details, and facts.`;

/** Short how-to bullet for the agent system prompt. */
export const WEB_SEARCH_AGENT_BULLET = `current facts, news, or verification; weave durable results into memories when they should stick.`;

/** Zod `.describe(...)` for the `query` field on webSearch input schema. */
export const webSearchQueryFieldDescription = `The search query to look up on the web —
keywords or a short natural-language phrase for current facts, news, or details.`;
