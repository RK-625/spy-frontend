# Wave 2 — Native API routes + root lib audit

**Agent:** leaf implementer (API routes + root lib)  
**Scope (write):** `src/app/api/**`, `src/lib/falkor.ts`, `src/lib/ask-user-question.ts`, `src/lib/models.ts`, `src/lib/icon-tokens.ts`, `src/lib/policy-tokens.ts`, `src/lib/utils.ts`  
**Mode:** Audit then auto-fix ≥75% only  
**Date:** 2026-08-08

---

## Inventory

| Path | Role |
|------|------|
| `src/app/api/chat/route.ts` | Streaming chat → `runAgent` (tools → Falkor) |
| `src/app/api/graph/route.ts` | Live topology `GET /api/graph` → `listGraphTopology` |
| `src/app/api/test-db/route.ts` | Dev/ops DB + embed connectivity probe |
| `src/lib/falkor.ts` | FalkorDBLite singleton, vector index, CRUD, topology read |
| `src/lib/ask-user-question.ts` | Client pending-ask helpers (schema-direct) |
| `src/lib/models.ts` | Client model catalog |
| `src/lib/icon-tokens.ts` | Icon glyph sizes |
| `src/lib/policy-tokens.ts` | Memory search / question policy knobs |
| `src/lib/utils.ts` | `cn()` |

---

## Hunt results

### Edge runtime misuse with Falkor

| Route | Pre-audit | Verdict |
|-------|-----------|---------|
| `/api/graph` | Already `runtime = "nodejs"` | OK |
| `/api/chat` | **No runtime export** (tools → falkor) | **Fixed** — explicit `nodejs` |
| `/api/test-db` | **No runtime export** (direct falkor) | **Fixed** — explicit `nodejs` |

Default App Router is Node, but hard constraint requires Node for Falkor routes; graph already set the pattern. Explicit export is defense-in-depth against accidental Edge opt-in.

`next.config.ts` already has `serverExternalPackages: ["falkordb", "falkordblite"]` — OK.

### Dual paths / client-unsafe exports

| Item | Verdict |
|------|---------|
| `ask-user-question.ts` → `@/ai/schemas/ask-schema` | **Already fixed** (commit `2fa76f0`) — does not import `@/ai` barrel |
| `test-db` → `generateEmbedding` from `@/ai` barrel | **Fixed** — now `@/ai/models` (avoids tools/falkor re-export surface on a probe) |
| `chat` → `runAgent` from `@/ai` | OK — public product barrel; agent legitimately needs tools |
| Client imports of `@/lib/falkor` | **None** — only `api/*` + `ai/tools/toolset.ts` |
| Falkor type re-exports | Client-safe wire types re-exported from `@/types/graph-topology` — OK |
| `import "server-only"` on falkor | **Deferred** — package not in deps; hard stop forbids dep bumps |

### `any`

No `any` / `as any` in write scope. Falkor uses `unknown` + narrow casts for query rows.

### Dead routes (`test-db`)

- **References:** only AGENTS.md / plans architecture notes; no product UI fetch.
- **Role:** intentional dev/ops connectivity check (open DB, vector index ready, embed dim, ping).
- **Action:** **Kept** (defer remove — not ≥75% product-dead for ops; still useful). Hardened runtime + response shape instead.

### Magic numbers → tokens

| Constant | Location | Verdict |
|----------|----------|---------|
| Policy memory/search knobs | `policy-tokens.ts` used by falkor, toolset, schemas | OK |
| `ICON_GLYPH` | `icon-tokens.ts` used by chat UI | OK |
| `EMBEDDING_DIMENSION = 1536` | falkor local + `ai/models/embeddings.ts` | **Deferred** — dual literal; fixing embeddings is outside write scope |
| Ask option bounds 2–5 | `ask-schema` + `ask-user-question` recheck | **Deferred** — tokenizing only client side would dual-SoT vs schema (ai/schemas out of scope) |

### Single-flight / connection

`falkor.ts` already correct:

- `dbOpenPromise` single-flight open; failed open resets promise + `db`
- `vectorIndexesReadyPromise` single-flight index ensure; failure resets
- `vectorIndexesReady` process-once after success

**Do not rebreak** — no changes to falkor connection path.

---

## Auto-fixes applied (≥75%)

1. **`src/app/api/chat/route.ts`** — `export const runtime = "nodejs"` (agent tools → Falkor).
2. **`src/app/api/test-db/route.ts`**
   - `export const runtime = "nodejs"`
   - Import `generateEmbedding` from `@/ai/models` (not `@/ai` barrel)
   - Error responses use HTTP 500
   - Response returns `embeddingDimension` instead of full 1536-vector dump
   - Module doc clarifying non-product probe role

### Not changed (intentionally)

- `falkor.ts` — single-flight + policy tokens already sound
- `ask-user-question.ts` — schema-direct import already correct
- `models.ts`, `icon-tokens.ts`, `policy-tokens.ts`, `utils.ts` — no ≥75% defects
- `graph/route.ts` — already Node + typed envelope
- `test-db` route removal — deferred

---

## Residual / deferred

| Item | Why deferred |
|------|----------------|
| Remove `/api/test-db` | Ops utility; documented; not product-dead with certainty |
| `server-only` guard on falkor | Would need new dependency (hard stop) |
| Tokenize embedding dim 1536 | Needs coordinated edit in `src/ai/models/embeddings.ts` (out of scope) |
| Tokenize ask option 2–5 bounds | Needs `src/ai/schemas/ask-schema.ts` (out of scope) |
| Typecheck in this worktree | No `node_modules` present — could not run tsc |

---

## Commit

See git commit from this agent for route hardening only.
