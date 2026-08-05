/**
 * Compat re-export barrel for historical conversation paths under
 * `@/components/chat/ai-elements/*`.
 *
 * Prompt SoT is `@/components/chat/prompt` only (no dual re-export here).
 * Conversation SoT: `../conversation/*`.
 * Prefer domain folders or `@/components/chat` for new imports.
 * Do not add new implementations under `ai-elements/`.
 */
export * from "../conversation";
