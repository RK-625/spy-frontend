/**
 * Chat product barrel — public import surface for product/cross-package code.
 *
 * Prefer: `import { … } from "@/components/chat"`.
 * Inside chat/* use relative imports (never this barrel — avoids cycles).
 *
 * Domain SoT:
 *   - `./prompt/*`       — PromptInputProvider + PromptInput* UI
 *   - `./conversation/*` — message stream, CoT, sources, shimmer
 *   - `./sidebar/*`      — conversation navigation
 *   - `./overlays/*`     — command palette, settings dialog
 *   - `./mcp-app/*`      — MCP App host (MCPAppCard + MCPAppRenderer)
 */
export * from "./sidebar";
export * from "./overlays";
export * from "./prompt";
export * from "./conversation";
export * from "./mcp-app";
