/**
 * Compat re-export barrel for historical `@/components/chat/ai-elements/*` imports.
 *
 * Source of truth lives in domain folders:
 *   - `../prompt/*`     — prompt shell, attachments, model selector, speech
 *   - `../conversation/*` — conversation stream, message, CoT, sources, …
 *
 * Prefer new code import from those domain folders or the chat barrel
 * (`@/components/chat`). Do not add new implementations under `ai-elements/`.
 */
export * from "../prompt";
export * from "../conversation";
