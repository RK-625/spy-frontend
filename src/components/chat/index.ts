/**
 * Chat product barrel.
 *
 * Domain SoT folders:
 *   - `./prompt/*`       — prompt shell (shell/header/body/ask/attachments/footer)
 *   - `./conversation/*` — message stream, CoT, sources, reasoning, shimmer
 *   - `./shell/*`        — sidebar, settings dialog, command palette
 *
 * Compat (do not delete without a call-site migration):
 *   - `./ai-elements/*`  — conversation-only historical paths
 *   - root `chat-sidebar.tsx` / `settings-dialog.tsx` / `command-palette.tsx`
 *     → re-export from `./shell/*`
 *
 * Prefer domain folders or this barrel for new imports.
 * Prompt public surface: `@/components/chat/prompt` barrel (not ai-elements).
 */
export * from "./shell";
export * from "./prompt";
export * from "./conversation";
