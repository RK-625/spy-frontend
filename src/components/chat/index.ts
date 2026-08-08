/**
 * Chat product barrel — public import surface for product/cross-package code.
 *
 * Prefer: `import { … } from "@/components/chat"`.
 * Inside chat/* use relative imports (never this barrel — avoids cycles).
 *
 * Domain SoT:
 *   - `./prompt/*`       — PromptInputProvider + PromptInput* UI
 *   - `./conversation/*` — message stream, CoT, sources, shimmer
 *   - `./shell/*`        — sidebar, settings dialog, command palette
 */
export * from "./shell";
export * from "./prompt";
export * from "./conversation";
