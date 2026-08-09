/**
 * Domain barrel for `@/ai/schemas`.
 * SoT files are `*-schema.ts` only (no alias shims).
 * Client-safe when deep-imported (`@/ai/schemas/ask-schema`); schemas pull
 * Zod + prompt field copy only — never Falkor/toolset.
 */
export * from "./ask-schema";
export * from "./link-schema";
export * from "./search-schema";
export * from "./upsert-schema";
export * from "./web-search-schema";
