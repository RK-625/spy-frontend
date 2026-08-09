# Wave2 — Native deprecated tree + verify scripts cleanup

**Agent:** LEAF native implementer  
**Mode:** Audit then auto-fix ≥75%  
**Date:** 2026-08-08  
**Confidence:** 95% (delete)  

## Decision

**DELETE entire `src/deprecated/`** — zero production consumers.

User decision was explicit: delete if no production imports from live product (`src/app/home`, `src/app/graph`, `src/app/page.tsx`, production components outside deprecated).

## Audit

### Import scan

| Query | Production hits (non-deprecated `.ts`/`.tsx`/`.mjs` under `src/`, excluding `src/deprecated`) |
|---|---|
| `@/deprecated` | **0** |
| `src/deprecated` | **0** |
| relative imports into deprecated | **0** |

**Pre-delete tree (only consumers were internal):**

- `src/deprecated/ask-user-question-widget/`
  - `prompt-input-with-widget.tsx`
  - `widget-layout.ts`
  - `README.md`
- `src/deprecated/ui-prototypes/`
  - `app-page/page.tsx` → imported variants via `@/deprecated/...`
  - `components/interactive-question-variants.tsx` → imported widget-layout via `@/deprecated/...`
  - `README.md`

**Lab route:** `src/app/ui-prototypes` — **absent** (already not wired into App Router). Live routes remain `/`, `/home`, `/graph` only.

**tsconfig / next.config path aliases for deprecated:** none.

**Mentions only in docs/plans (not code consumers):** `AGENTS.md`, `brief.md`, `README.md`, `plans/safe-deprecated-cleanup.md`, `plans/d3-force-placement-slices.md`, `plans/hybrid-placement-cache-dirty.md`. Left untouched (write scope: root plan/docs only if clearly obsolete ≥75%; these still describe historical policy and live pending-ask rules).

### Production pending-ask path (must keep)

Unchanged:

- `src/components/chat/prompt/` shell + body + `ask/pending-ask`
- `src/lib/ask-user-question.ts`
- `src/ai/schemas/ask-schema.ts` / toolset `askUserQuestion` may remain for agent tool

`verify-widget-cleanup` continues to ban morph symbols (`WIDGET_TYPE`, `widget-layout`, cascade exit, etc.) from production prompt SoT files.

## Changes applied

1. **Deleted** `src/deprecated/**` (entire tree).
2. **`scripts/verify-widget-cleanup.mjs`**
   - Added `DELETED` guards: `src/deprecated`, morph widget + ui-prototypes subtrees, `src/app/ui-prototypes`.
   - Comment updated: morph UI gone; live pending-ask remains.
3. **`scripts/verify-reorg-scope.mjs`**
   - Removed `RENAME_MAP` pairs that targeted `src/deprecated/ui-prototypes/*`.
   - Removed `IMPORT_SUBS` entry rewriting to `@/deprecated/ui-prototypes/...`.
   - Left comment noting archive removal.
4. **package.json** — no script renames/removals required; `verify:widget-cleanup` / `verify:reorg-scope` / `verify:pending-ask` still valid.
5. **No dependency bumps. No push.**

## Verify results

| Script | Result |
|---|---|
| `npm run verify:widget-cleanup` | **PASS** — “deprecated tree absent” |
| `npm run verify:pending-ask` | **Structural PASS** (exports, last-message-only, schema/toolset wiring). Behavioral tsx block **FAIL** in this worktree: `Cannot find module 'zod'` (missing install / env) — not caused by deprecated deletion. |
| `npm run verify:reorg-scope` | **Pre-existing fail** unrelated to this cleanup: script does unconditional `git show HEAD:src/ai/agent.ts` but that path is not on HEAD (agent packing already under `src/ai/agent/`). Rename-map deprecated pairs removed; agent-packing block not rewritten (out of deprecate scope). |

## Hard stops respected

- No push / force  
- No dependency version bumps  
- Production pending-ask path intact  
- Morph widget not reintroduced  

## Residual (out of scope)

- Narrative references to `src/deprecated/...` in `AGENTS.md` / `brief.md` / `README.md` / plans — docs still say “parked under deprecated”; product code no longer has that tree. Follow-up doc sweep optional.
- `verify-reorg-scope` agent packing should use try/catch or HEAD path that exists (`src/ai/agent/agent.ts`) — separate fix.
