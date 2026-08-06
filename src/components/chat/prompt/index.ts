/**
 * Prompt domain barrel — sole package public surface for the chat prompt shell.
 * Domain SoT: shell/ (PromptShellProvider + form), header/, body/, ask/, attachments/, footer/, suggestion.tsx.
 * Import via `@/components/chat` (package barrel) or relative within chat.
 */
export * from "./shell/context";
export * from "./shell/prompt-input";
export * from "./header/header";
export * from "./body/body";
export * from "./body/textarea";
export * from "./ask/pending-ask";
export * from "./attachments/prompt-input-files";
export * from "./attachments/attachment-chip";
export * from "./attachments/attachment-strip";
export * from "./footer/footer";
export * from "./footer/tools";
export * from "./footer/button";
export * from "./footer/submit";
export * from "./footer/speech-input";
export * from "./footer/model-selector";
export * from "./suggestion";
