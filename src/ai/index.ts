/**
 * Public `@/ai` barrel for **server** API routes.
 *
 * Prefer domain paths:
 * - `@/ai/agent` — runAgent
 * - `@/ai/models` — modelConfig / generateEmbedding
 * - `@/ai/tools` — createToolSet (Node-only: pulls FalkorDB)
 * - `@/ai/schemas/*-schema` — Zod SoT (client-safe when deep-imported)
 *
 * Client components MUST NOT import this barrel. Tools/agent transitively
 * import Falkor (native). Client code uses deep schema paths only
 * (e.g. `@/ai/schemas/ask-schema`) — see 2fa76f0.
 *
 * Tools are intentionally omitted here so a mistaken client `from "@/ai"`
 * for schemas/models is less likely to pull native deps via this entry.
 * createToolSet remains on `@/ai/tools` and is used by agent internally.
 */
export * from "./agent";
export * from "./models";
export * from "./schemas";
