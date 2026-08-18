/**
 * Narrative for webSearch (external facts / verification path).
 * Tool description + agent bullet + query field describe.
 */

/** `tool({ description })` for webSearch in the product toolset. */
export const webSearchToolDescription = `Search the web for current facts, news, articles, and details.`;

/** Short how-to bullet for the agent system prompt. */
export const WEB_SEARCH_AGENT_BULLET = `Look up current facts or sources on the web.`;

/** Zod `.describe(...)` for the `query` field on webSearch input schema. */
export const webSearchQueryFieldDescription = `Keywords or a short natural-language phrase to look up.`;
