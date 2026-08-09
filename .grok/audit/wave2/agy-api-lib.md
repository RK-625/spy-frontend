# Codebase Audit: API Routes & Lib Root Domain (`src/app/api/**` + `src/lib/*`)

**Target Domain**: `src/app/api/` & `src/lib/` root  
**Date**: August 8, 2026  
**Auditor**: AGY Leaf Agent  
**Scope**: Read-only Architectural & Code Preferences Audit  

---

## Executive Summary

An in-depth architectural and code-quality audit of the **API Routes & Lib Root Domain** (`src/app/api/**` and `src/lib/*`) was conducted against the project design constitution ([`AGENTS.md`](file:///Users/apple/Development/Spy/spy-frontend/AGENTS.md)) and code preference guidelines ([`.grok/rules/code-preferences.md`](file:///Users/apple/Development/Spy/spy-frontend/.grok/rules/code-preferences.md)).

The audit targeted five core focus areas:
1. **Edge / FalkorDB Runtime Enforcement**: Verifying that native FalkorDB driver modules are strictly isolated to Node.js runtimes.
2. **Client-Unsafe Imports & Layer Isolation**: Auditing boundary separation between server database logic, React components, and client helpers.
3. **TypeScript Safety (`any` usage)**: Eliminating untyped objects and implicit `any` fallbacks.
4. **Dead & Debug Endpoint Audit (`test-db`)**: Evaluating security, quota usage, and utility of test API routes.
5. **Token Source of Truth (SoT)**: Auditing design tokens (`icon-tokens.ts`, `policy-tokens.ts`), model definitions (`models.ts`), and styling utilities.

### Key Audit Discoveries
1. **Missing Node.js Runtime Enforcement**: `POST /api/chat` ([`route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/chat/route.ts#L1-L15)) and `GET /api/test-db` ([`route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/test-db/route.ts#L1-L37)) fail to export `export const runtime = "nodejs";`. While `GET /api/graph` correctly sets it, missing runtime declarations in `chat/route.ts` leave FalkorDB native driver bindings (`falkordblite`) vulnerable to fatal build/runtime crashes if deployed to Edge runtimes.
2. **Dead & Vulnerable Debug Route (`test-db`)**: `GET /api/test-db` ([`route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/test-db/route.ts#L1-L37)) is an unreferenced, dead API route. It publicly exposes database index metadata and triggers live calls to the Google Gemini Embedding API (`gemini-embedding-2`) without authentication or environment guards.
3. **Model Catalog SoT Breakage & React UI Coupling**: `src/lib/models.ts` ([`models.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/models.ts#L1-L21)) defines only two DeepSeek models, while the server model resolver ([`modelstore.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/models/modelstore.ts#L21-L46)) expects OpenAI, Anthropic, Google, and DeepSeek. Furthermore, `models.ts` imports React SVG components (`Deepseek` from `@/components/logos`), forcing server-side AI execution paths to import React UI components.
4. **Client-Unsafe Type Re-exports in `falkor.ts`**: `src/lib/falkor.ts` ([`falkor.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/falkor.ts#L20-L22)) re-exports wire types (`GraphTopology`, `MemoryNode`) out of a server-only module containing `node:fs` and `falkordblite` native bindings, introducing module resolution crash risks if imported by client components.
5. **Unhandled Route Exception Handling**: `POST /api/chat` ([`route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/chat/route.ts#L10-L13)) re-throws caught exceptions (`throw error`), causing Next.js to leak HTML 500 error pages to client stream consumers instead of returning structured JSON error responses.

---

## Audit Findings Matrix

| ID | Severity | Category | File | Description |
|---|---|---|---|---|
| **AL-01** | 🔴 HIGH | Edge / Falkor Enforcement | [`app/api/chat/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/chat/route.ts#L1-L15) | Missing `export const runtime = "nodejs"`; risks fatal FalkorDB native driver crash in Edge runtimes. |
| **AL-02** | 🔴 HIGH | Dead Route / Security & Quota | [`app/api/test-db/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/test-db/route.ts#L1-L37) | Dead, unreferenced route exposes DB index metadata & consumes Gemini embedding quota on public GET requests. |
| **AL-03** | 🔴 HIGH | Model Catalog SoT & Coupling | [`lib/models.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/models.ts#L1-L21) | Incomplete model list breaks non-DeepSeek model selection in `modelstore.ts`; imports React components in data layer. |
| **AL-04** | 🔴 HIGH | Client-Unsafe Module Exports | [`lib/falkor.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/falkor.ts#L20-L22) | Re-exports client wire types out of server-only native DB module (`node:fs`/`falkordblite`). |
| **AL-05** | 🟡 MED | Error Handling / Stream Leak | [`app/api/chat/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/chat/route.ts#L10-L13) | Re-throws caught errors (`throw error`), leaking HTML 500 pages to streaming client fetchers. |
| **AL-06** | 🟡 MED | Implicit `any` Input Payload | [`app/api/chat/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/chat/route.ts#L7) | `req.json()` payload is untyped `any` and passed directly to `runAgent` without Zod validation. |
| **AL-07** | 🟡 MED | Missing Runtime Declaration | [`app/api/test-db/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/test-db/route.ts#L5) | Missing `export const runtime = "nodejs"`; executes native FalkorDB and AI embedding calls without runtime guard. |
| **AL-08** | 🟢 LOW | Hardcoded Token Adoption | [`lib/icon-tokens.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/icon-tokens.ts#L8-L12) | `ICON_GLYPH` tokens defined correctly, but UI components frequently bypass them with literal `size={16}`. |
| **AL-09** | 🟢 LOW | Cross-Domain Schema Import | [`lib/ask-user-question.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/ask-user-question.ts#L2-L5) | Client helper imports schema directly from `@/ai/schemas/ask-schema`, risking server prompt logic bundling. |
| **AL-10** | 🟢 LOW | Serverless Path Persistence | [`lib/falkor.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/falkor.ts#L40) | Default local persistence path `.data/falkor` relies on relative disk write access. |

---

## Detailed Findings & Analysis

### 🔴 High Severity

#### AL-01: Missing `export const runtime = "nodejs"` in `POST /api/chat`
- **File**: [`src/app/api/chat/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/chat/route.ts#L1-L15)
- **Category**: Edge / Falkor Runtime Enforcement
- **Description**: `POST /api/chat` handles agent execution via `runAgent(payload)`. `runAgent` registers tool definitions (`upsertMemory`, `linkMemories`, `searchMemories`) that directly execute Cypher queries using the native FalkorDB driver in [`src/lib/falkor.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/falkor.ts#L42). However, `chat/route.ts` lacks `export const runtime = "nodejs";`.
- **Impact**: Per [`AGENTS.md`](file:///Users/apple/Development/Spy/spy-frontend/AGENTS.md) (Constraints section): *"FalkorDB native driver breaks in Edge runtime. API routes interacting with the DB must run in Node.js"*. If Next.js environment configurations or serverless platforms attempt to route `/api/chat` through Edge workers, `falkordblite` native C/C++ bindings will throw fatal module load exceptions.
- **Remediation**: Add `export const runtime = "nodejs";` to the top of `src/app/api/chat/route.ts`.

#### AL-02: Dead, Unauthenticated, & Quota-Consuming `GET /api/test-db` Endpoint
- **File**: [`src/app/api/test-db/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/test-db/route.ts#L1-L37)
- **Category**: Dead Feature Code / Security & Financial Risk
- **Description**: `src/app/api/test-db/route.ts` is an early development connectivity verification route. It is not referenced or consumed anywhere in `src/`. On every incoming `GET /api/test-db` HTTP request, it:
  1. Opens FalkorDB and executes `RETURN 1 AS ok`.
  2. Generates a 1536-dimensional vector embedding using Google Gemini API (`generateEmbedding("Spy is an alien intelligence.")`).
  3. Queries database indexes (`CALL db.indexes()`).
  4. Returns the raw 1536-float embedding vector, DB status, and index definitions in a public JSON payload.
- **Impact**: 
  - **Financial/Quota Leak**: Public unauthenticated GET requests trigger billable Gemini Embedding API calls.
  - **Information Disclosure**: Exposes internal DB schema state and index topology to external scanners.
  - **Dead Code**: Zero product value in production builds.
- **Remediation**: Remove `src/app/api/test-db/route.ts` from the repository, or wrap its handler in an `if (process.env.NODE_ENV !== "development") return NextResponse.json({ error: "Forbidden" }, { status: 403 });` guard.

#### AL-03: Model Catalog Incompleteness & React Component Coupling in `lib/models.ts`
- **File**: [`src/lib/models.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/models.ts#L1-L21), [`src/ai/models/modelstore.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/ai/models/modelstore.ts#L17-L48)
- **Category**: Data Model SoT / Architecture & Isolation
- **Description**: Two distinct issues exist in `src/lib/models.ts`:
  1. **Incomplete Catalog**: `models.ts` defines `models: AIModel[]` containing only `deepseek-v4-pro` and `deepseek-v4-flash`. However, `modelstore.ts` contains a `switch (found.chef)` supporting `"OpenAI"`, `"Anthropic"`, `"Google"`, and `"DeepSeek"`. Because `modelstore.ts` resolves model configurations via `models.find((m) => m.id === model)`, passing any non-DeepSeek model ID (e.g. `gpt-4o` or `gemini-2.5-flash`) causes `models.find` to return `undefined`, throwing `Error: Unknown model: ${model}`.
  2. **Layer Isolation Violation**: `models.ts` imports a React SVG component (`import { Deepseek } from "@/components/logos"`). Server-side AI modules (`modelstore.ts`) import `models.ts` for model metadata lookup, causing server-side execution paths to unnecessarily load React UI component bundles.
- **Impact**: Breaks non-DeepSeek LLM provider execution in `modelstore.ts`, and violates the isolation principle between data models (`@/lib/models`) and UI component renderers (`@/components/logos`).
- **Remediation**: 
  - Expand `models.ts` to include all supported models (OpenAI, Anthropic, Google, DeepSeek) matching `modelstore.ts`.
  - Remove `icon` React component references from `AIModel` data objects in `models.ts`. Map model IDs to React SVG icons inside UI component registries (e.g. `@/components/chat/prompt/`).

#### AL-04: Client-Unsafe Wire Type Re-exports in Server-Only `lib/falkor.ts`
- **File**: [`src/lib/falkor.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/falkor.ts#L20-L22)
- **Category**: Client-Unsafe Imports & Module Boundaries
- **Description**: `src/lib/falkor.ts` includes lines 20–22:
  ```ts
  /** Re-export wire SoT from client-safe `@/types/graph-topology` (do not redefine). */
  export type { GraphTopology, MemoryNode } from "@/types/graph-topology";
  export type { MemorySearchHit } from "@/types/graph-schema";
  ```
  `falkor.ts` is a server-only module that imports `node:fs/promises`, `node:path`, and `falkordblite` (native binary).
- **Impact**: Re-exporting client wire types out of `falkor.ts` misleads developers into importing types from `@/lib/falkor` in client components or shared hooks. If a client component includes a non-type import from `@/lib/falkor`, Turbopack/Webpack will attempt to bundle `node:fs` and `falkordblite` into the browser bundle, causing module build failures.
- **Remediation**: Remove type re-exports from `src/lib/falkor.ts`. Ensure all client and shared modules import types directly from `@/types/graph-topology` or `@/types/graph-schema`.

---

## Medium Severity

#### AL-05: Unhandled Route Exception Re-throwing in `POST /api/chat`
- **File**: [`src/app/api/chat/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/chat/route.ts#L10-L13)
- **Category**: Error Handling & API Response Contracts
- **Description**: `POST /api/chat` wraps `runAgent` execution in a try-catch block:
  ```ts
  } catch (error) {
    console.error("API ROUTE ERROR DETECTED:", error);
    throw error;
  }
  ```
- **Impact**: Re-throwing an exception inside a Next.js App Router API route without constructing a `NextResponse` causes Next.js to return an unhandled 500 HTML error page. Client fetch streams (`useChat`) expecting SSE text or JSON receive raw HTML strings, leading to client-side JSON parsing crashes (`Unexpected token '<'`).
- **Remediation**: Catch errors and return a structured JSON response:
  ```ts
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Internal Server Error" },
    { status: 500 }
  );
  ```

#### AL-06: Untyped `any` Payload in `POST /api/chat`
- **File**: [`src/app/api/chat/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/chat/route.ts#L7)
- **Category**: TypeScript `any` / Input Validation
- **Description**: Line 7 executes `const payload = await req.json();`. The resulting `payload` is implicitly typed as `any` and passed directly into `runAgent(payload)` without schema validation or structural type guards.
- **Impact**: Malformed HTTP POST requests (e.g. missing `messages` array or invalid model preference types) bypass route-level validation and trigger unhandled runtime exceptions deep inside AI agent loops.
- **Remediation**: Define a Zod schema for incoming chat requests (e.g. `chatRequestSchema`) and validate `payload` via `safeParse` before passing to `runAgent`.

#### AL-07: Missing Runtime Guard in `GET /api/test-db`
- **File**: [`src/app/api/test-db/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/test-db/route.ts#L5)
- **Category**: Edge / Falkor Enforcement
- **Description**: `GET /api/test-db` invokes `getDb()` from `@/lib/falkor`, but does not declare `export const runtime = "nodejs";`.
- **Impact**: Same runtime crash risk as AL-01 if deployed on Edge infrastructure.
- **Remediation**: Add `export const runtime = "nodejs";` or delete the test route.

---

## Low Severity

#### AL-08: Hardcoded Glyph Sizes Overriding `icon-tokens.ts`
- **File**: [`src/lib/icon-tokens.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/icon-tokens.ts#L8-L12)
- **Category**: Design Token Source of Truth
- **Description**: `src/lib/icon-tokens.ts` correctly defines `ICON_GLYPH = { toolbar: 20, badge: 14, inline: 16 }` matching CSS variables in `globals.css`. However, UI components across the application regularly hardcode literal `size={16}` or `size={14}` instead of consuming `ICON_GLYPH`.
- **Impact**: Soft maintenance drift; changes to `ICON_GLYPH` sizes will not propagate to components using hardcoded numeric literals.
- **Remediation**: Enforce `ICON_GLYPH` token usage in code review guidelines and refactor literal icon size props.

#### AL-09: Cross-Domain Schema Import in `ask-user-question.ts`
- **File**: [`src/lib/ask-user-question.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/ask-user-question.ts#L2-L5)
- **Category**: Architectural Isolation
- **Description**: `src/lib/ask-user-question.ts` is a client helper function used in `/home` to parse pending questions. It imports `askUserQuestionInputSchema` from `@/ai/schemas/ask-schema`.
- **Impact**: While `@/ai/schemas/ask-schema.ts` is currently client-safe, importing directly from the `@/ai/` domain in client-facing lib helpers creates a potential coupling vector if `@/ai` barrels are modified in the future.
- **Remediation**: Re-export or place shared Zod schemas in a dedicated client-safe `@/types/` or `@/lib/schemas/` directory.

#### AL-10: Persistence Path Disk Access Dependency in `falkor.ts`
- **File**: [`src/lib/falkor.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/falkor.ts#L40)
- **Category**: Environment Readiness
- **Description**: `FALKOR_PATH` defaults to `.data/falkor` relative to the workspace root.
- **Impact**: In read-only containerized environments (such as Vercel serverless functions), local disk writes to `.data/` will fail.
- **Remediation**: Ensure `FALKOR_PATH` defaults to `/tmp/falkor` when `process.env.VERCEL` or serverless environment flags are detected.

---

## Proposed Remediation Roadmap

1. **Phase 1 (High Priority - Edge Safety, Security, & Catalog Fixes)**:
   - Add `export const runtime = "nodejs";` to [`src/app/api/chat/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/chat/route.ts#L1).
   - Remove or quarantine [`src/app/api/test-db/route.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/app/api/test-db/route.ts#L1-L37) to stop public index exposure and billable Gemini embedding API consumption.
   - Update [`src/lib/models.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/models.ts#L4-L21) to include all supported providers (OpenAI, Anthropic, Google, DeepSeek) matching `modelstore.ts`, and decouple React logo components from the model data definitions.
   - Remove type re-exports from [`src/lib/falkor.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/falkor.ts#L20-L22).

2. **Phase 2 (Medium Priority - Robustness & Error Contracts)**:
   - Refactor `POST /api/chat` catch block to return a structured 500 JSON error response (`NextResponse.json({ error: ... }, { status: 500 })`) instead of re-throwing `throw error`.
   - Add Zod request validation to `POST /api/chat` to validate incoming payload structure before calling `runAgent`.

3. **Phase 3 (Low Priority - Token & Schema Governance)**:
   - Audit UI components to replace hardcoded `size={16}` literals with `ICON_GLYPH` tokens.
   - Ensure `FALKOR_PATH` fallback in `falkor.ts` uses `/tmp/falkor` in serverless environments.
