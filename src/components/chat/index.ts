/**
 * Chat product barrel.
 *
 * Domain SoT folders (import these or this barrel — no dual shims):
 *   - `./prompt/*`       — prompt shell (PromptShellProvider + PromptInput* UI)
 *   - `./conversation/*` — message stream, CoT, sources, reasoning, shimmer
 *   - `./shell/*`        — sidebar, settings dialog, command palette
 */
export * from "./shell";
export * from "./prompt";
export * from "./conversation";
