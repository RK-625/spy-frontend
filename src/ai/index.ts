/**
 * Public `@/ai` barrel — models + schemas only.
 *
 * Prefer domain paths:
 * - `@/ai/agent` — runAgent (Node-only: pulls tools → FalkorDB)
 * - `@/ai/models` — modelConfig / generateEmbedding
 * - `@/ai/tools` — createToolSet (Node-only: pulls FalkorDB)
 * - `@/ai/schemas/*-schema` — Zod SoT (client-safe when deep-imported)
 *
 * Agent and tools are intentionally omitted: either re-export pulls
 * createToolSet → @/lib/falkor (native). Server routes import
 * `runAgent` from `@/ai/agent`. Client code uses deep schema paths only
 * (e.g. `@/ai/schemas/ask-schema`).
 */
export * from "./models";
export * from "./schemas";
