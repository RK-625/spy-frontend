/**
 * Compat re-export: historical path for PromptInput shell + hooks + UI pieces.
 * Prefer `@/components/chat/prompt` barrel or domain subpaths.
 */
export * from "./shell/context";
export * from "./shell/prompt-input";
export * from "./header/header";
export * from "./body/body";
export * from "./body/textarea";
export * from "./ask/pending-ask";
export * from "./footer/footer";
export * from "./footer/tools";
export * from "./footer/button";
export * from "./footer/submit";
// Historical: `import { PROMPT_INPUT_ACCEPT } from ".../prompt-input"`
export { PROMPT_INPUT_ACCEPT } from "./attachments/prompt-input-files";
