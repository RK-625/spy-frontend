/**
 * Directory barrel for `src/ai/agent/*` imports.
 * Public consumers should use `@/ai/agent` (root file shim → `./agent/agent`).
 * Root `src/ai/agent.ts` must keep `export * from "./agent/agent"` (not `./agent`).
 */
export * from "./agent";
