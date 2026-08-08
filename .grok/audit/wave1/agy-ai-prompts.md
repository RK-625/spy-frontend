# Audit Report: AI & Prompts Domains (`src/ai/**`, `src/prompts/**`)

**Date:** 2026-08-08  
**Scope:** `src/ai/**` (14 files), `src/prompts/**` (8 files)  
**Agent:** Antigravity (LEAF Agent — No sub-agents spawned)  
**Mode:** Audit ONLY (Zero source code modifications)  
**Target Output:** `.grok/audit/wave1/agy-ai-prompts.md`  
**Reference Standards:** [`AGENTS.md`](file:///Users/apple/Development/Spy/spy-frontend/AGENTS.md), [`.grok/rules/code-preferences.md`](file:///Users/apple/Development/Spy/spy-frontend/.grok/rules/code-preferences.md)

---

## 1. Executive Summary

This audit evaluated all 22 files across `src/ai/**` and `src/prompts/**` to identify client-unsafe barrel exports, dual shims, schema Single-Source-of-Truth (SoT) mismatches, type precision issues, and environment configuration smells.

### Key Observations:
1. **Clean Domain Separation in Logic:** Prompts and schemas are cleanly decoupled from component rendering. Prompts act as centralized strings and schema descriptions.
2. **Client-Unsafe Barrel Risk:** [`src/ai/index.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/index.ts) re-exports server-only model stores, AI SDK provider instances, and FalkorDB native driver bindings. Importing `@/ai` on the client would leak node dependencies and break client bundles.
3. **Schema SoT Discrepancies:** Discrepancies exist between tool input schemas ([`src/ai/schemas/upsert-schema.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/schemas/upsert-schema.ts)) and database/graph schemas ([`src/types/graph-schema.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/types/graph-schema.ts)). Redundant schema types (`Concept`, `Link`/`Links`) also linger in `src/types/graph-schema.ts`.

---

## 2. Audit Findings Categorized by Severity

### A. HIGH Severity

#### 1. Client-Unsafe Root Barrel Export ([`src/ai/index.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/index.ts#L1-L5))
* **Category:** Client-Unsafe Barrels / Server Dependency Leak
* **Confidence:** **95%**
* **File Location:** [`src/ai/index.ts#L1-L5`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/index.ts#L1-L5)
* **Description:**  
  `src/ai/index.ts` re-exports everything from `./agent`, `./models`, `./tools`, and `./schemas`.
  * `./tools/toolset.ts` imports server DB helpers from `@/lib/falkor` (which uses the native `falkordb` C-driver) and `exa-js`.
  * `./models/modelstore.ts` imports AI provider SDKs (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/deepseek`).
  If a client component or utility (e.g., [`src/lib/ask-user-question.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/ask-user-question.ts#L5)) imports schemas or types from `@/ai` instead of deep paths (`@/ai/schemas/ask-schema`), Turbopack/Webpack will attempt to bundle native Node C-bindings (`falkordb`) and server SDKs into the client build.
* **Recommended Fix:**  
  Remove `export * from "./agent"`, `export * from "./models"`, `export * from "./tools"` from `src/ai/index.ts`. Limit `src/ai/index.ts` to safe exports or enforce strict deep-import domain barrels (`@/ai/agent`, `@/ai/models`, `@/ai/tools`, `@/ai/schemas`).

#### 2. Schema SoT Discrepancy & Duplicate Types ([`src/types/graph-schema.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/types/graph-schema.ts) vs [`src/ai/schemas/upsert-schema.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/schemas/upsert-schema.ts))
* **Category:** Single Source of Truth (SoT) & Type Duplication
* **Confidence:** **90%**
* **File Location:** [`src/ai/schemas/upsert-schema.ts#L18-L28`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/schemas/upsert-schema.ts#L18-L28), [`src/types/graph-schema.ts#L8-L24,L54-L84`](file:///Users/apple/Development/Spy/spy-frontend/src/types/graph-schema.ts#L8-L24#L54-L84)
* **Description:**  
  * **Optionality Mismatch:** In `src/ai/schemas/upsert-schema.ts`, `impression` and `confidence` are `.optional()` for tool invocation. In `src/types/graph-schema.ts`, the `Memory` Zod schema marks `impression` (`z.string()`) and `confidence` (`z.number()`) as strictly required, creating an validation contract mismatch between tool execution and entity serialization.
  * **Redundant Duplicate Schema:** `Concept` in [`src/types/graph-schema.ts#L54-L71`](file:///Users/apple/Development/Spy/spy-frontend/src/types/graph-schema.ts#L54-L71) is a 100% copy-pasted duplicate of `Memory` (including typos in descriptions: `"prepestive"`).
  * **Dual Export Alias:** `Link` and `Links` in `src/types/graph-schema.ts#L73-L84` are dual exports for the exact same schema.
* **Recommended Fix:**  
  Align `Memory` schema optionality across `src/types/graph-schema.ts` and `src/ai/schemas/upsert-schema.ts` (or compose them from a single base Zod schema), remove `Concept`, and unify `Link`/`Links` into a single canonical export.

---

### B. MEDIUM Severity

#### 3. Dual Export Shims in Tool Prompts Barrel ([`src/prompts/tools/index.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/prompts/tools/index.ts))
* **Category:** Dual Export Shims / Barrel Redundancies
* **Confidence:** **85%**
* **File Location:** [`src/prompts/tools/index.ts#L5-L45`](file:///Users/apple/Development/Spy/spy-frontend/src/prompts/tools/index.ts#L5-L45)
* **Description:**  
  `src/prompts/tools/index.ts` re-exports 25 individual string constants from `upsert-memory.ts`, `search-memories.ts`, `link-memories.ts`, `web-search.ts`, and `ask-user-question.ts`. Files in `src/ai/schemas/*` import directly from individual prompt files (e.g. `import { ... } from "@/prompts/tools/ask-user-question"`), whereas `src/prompts/system-prompt.ts` imports from `./tools` barrel.
* **Recommended Fix:**  
  Standardize prompt exports to eliminate dual import paths (barrel vs deep module).

#### 4. Hardcoded Model Provider Lookup ([`src/ai/models/modelstore.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/models/modelstore.ts#L21-L48))
* **Category:** Architectural Tight Coupling
* **Confidence:** **80%**
* **File Location:** [`src/ai/models/modelstore.ts#L21-L48`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/models/modelstore.ts#L21-L48)
* **Description:**  
  `modelConfig()` relies on string matching against `found.chef` (`"OpenAI"`, `"Anthropic"`, `"Google"`, `"DeepSeek"`). Provider options are constructed inline without typed configuration mappings. Additionally, `embedModel()` is statically hardcoded to `google.embedding("gemini-embedding-2")`.
* **Recommended Fix:**  
  Refactor provider lookups into a typed map object and extract embedding model selection configuration.

#### 5. Soft-Failure Handling for Missing Search API Key ([`src/ai/tools/toolset.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/tools/toolset.ts#L56-L63))
* **Category:** Error Handling & Tool Registration
* **Confidence:** **75%**
* **File Location:** [`src/ai/tools/toolset.ts#L56-L63`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/tools/toolset.ts#L56-L63)
* **Description:**  
  When `EXA_API_KEY` is missing, `webSearch.execute` returns `{ error: "Web search is unavailable: EXA_API_KEY is not set." }`. The LLM receives this string as successful tool output and may attempt to answer the user using the error message string.
* **Recommended Fix:**  
  Dynamically omit `webSearch` from `toolSet` when `EXA_API_KEY` is not configured.

---

### C. LOW Severity

#### 6. Missing Return Type Annotation on `runAgent` ([`src/ai/agent/agent.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/agent/agent.ts#L11-L45))
* **Category:** TypeScript Precision
* **Confidence:** **70%**
* **File Location:** [`src/ai/agent/agent.ts#L11-L45`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/agent/agent.ts#L11-L45)
* **Description:**  
  `runAgent` omits an explicit return type annotation, relying on implicit inference of `streamText` return value.
* **Recommended Fix:**  
  Add explicit return type annotation to `runAgent`.

#### 7. Inline Magic Numbers for Dimensionality and Char Caps ([`src/ai/models/embeddings.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/models/embeddings.ts#L10), [`src/ai/tools/toolset.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/tools/toolset.ts#L36))
* **Category:** Policy Token Centralization
* **Confidence:** **70%**
* **File Location:** [`src/ai/models/embeddings.ts#L10`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/models/embeddings.ts#L10), [`src/ai/tools/toolset.ts#L36`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/tools/toolset.ts#L36)
* **Description:**  
  `outputDimensionality: 1536` and `RETRIEVAL_QUESTION_MAX_CHARS = 500` are hardcoded inline numbers rather than exported from [`src/lib/policy-tokens.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/policy-tokens.ts).
* **Recommended Fix:**  
  Extract `EMBEDDING_DIMENSIONALITY` and `RETRIEVAL_QUESTION_MAX_CHARS` into `@/lib/policy-tokens`.

---

## 3. Summary of Files Audited

| Directory | File | Audited Status |
|---|---|---|
| `src/ai` | `index.ts` | Audited — Client-unsafe barrel found |
| `src/ai/agent` | `agent.ts`, `index.ts` | Audited — Missing return type annotation |
| `src/ai/models` | `embeddings.ts`, `modelstore.ts`, `index.ts` | Audited — Hardcoded provider switch & magic numbers |
| `src/ai/tools` | `toolset.ts`, `index.ts` | Audited — Exa soft-failure & policy tokens |
| `src/ai/schemas` | `ask-schema.ts`, `link-schema.ts`, `search-schema.ts`, `upsert-schema.ts`, `web-search-schema.ts`, `index.ts` | Audited — Schema SoT discrepancy with `graph-schema.ts` |
| `src/prompts` | `system-prompt.ts`, `graph-context.ts` | Audited — Well-structured system prompt composition |
| `src/prompts/tools` | `ask-user-question.ts`, `link-memories.ts`, `search-memories.ts`, `upsert-memory.ts`, `web-search.ts`, `index.ts` | Audited — Dual export shims in barrel |
