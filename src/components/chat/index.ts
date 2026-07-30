/**
 * Chat product barrel.
 *
 * Domain SoT folders:
 *   - `./prompt/*`       — prompt input shell + attachments + tools chrome
 *   - `./conversation/*` — message stream, CoT, sources, reasoning, shimmer
 *   - `./shell/*`        — sidebar, settings dialog, command palette
 *
 * Compat re-exports (do not delete without a call-site migration):
 *   - `./ai-elements/*`  — re-exports prompt + conversation for older paths
 *   - root `chat-sidebar.tsx` / `settings-dialog.tsx` / `command-palette.tsx`
 *     → re-export from `./shell/*`
 *
 * Prefer domain folders or this barrel for new imports.
 */
export * from "./shell";
export * from "./prompt";
export * from "./conversation";
