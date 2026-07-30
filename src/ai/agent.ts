/**
 * Public entry for `@/ai/agent` (file beats `agent/` directory under TS/Node resolution).
 * Must re-export `./agent/agent` — not `./agent` (ambiguous with this file / directory).
 * Implementation SoT: `src/ai/agent/agent.ts`. Prefer this root path for consumers.
 */
export * from "./agent/agent";
