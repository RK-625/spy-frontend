# Wave 1 audit — AI package + prompts (native)

**Scope:** `src/ai/**`, `src/prompts/**`  
**Mode:** Audit then auto-fix ≥75% only  
**Date:** 2026-08-08  
**Leaf agent:** no sub-delegation  

**Prior art (read):**
- `218f59a` — centralize tool prompts, slim barrels, drop empty schema shims, Q-gen under `src/prompts/tools`
- `ee67203` — remove root + schema dual-export shims; resolve `@/ai/agent` via directory barrel
- `2fa76f0` — client imports `@/ai/schemas/ask-schema` directly (avoid Falkor via root barrel)

---

## Layout (post-audit)

```
src/ai/
  index.ts              — server barrel: agent + models + schemas (tools omitted)
  agent/agent.ts        — runAgent SoT
  agent/index.ts
  models/{embeddings,modelstore,index}.ts
  schemas/*-schema.ts   — Zod SoT only (no alias shims)
  tools/toolset.ts      — createToolSet (Falkor Node-only)
  tools/index.ts

src/prompts/
  system-prompt.ts      — persona + HOW_TO_WEAVE bullets
  graph-context.ts      — shared KB / link rules
  tools/*               — tool descriptions, field describes, agent bullets, Q-gen
```

---

## Findings

| # | Area | Finding | Confidence | Action |
|---|------|---------|------------|--------|
| 1 | Dual-export shims | No root `agent.ts` / schema alias files (`ask-user-question.ts` etc.). SoT is `*-schema.ts` only. | 95% | None (already clean) |
| 2 | Client → Falkor barrel | Root `@/ai` re-exported **tools** → Falkor. Client fixed in `2fa76f0` via deep schema path, but root still re-exported tools. | 90% | **Fixed:** omit tools from root barrel; document client deep-path rule |
| 3 | In-package imports | `toolset.ts` imported schemas/models via `@/ai/...` (package self-import; cycle risk / prefs). | 90% | **Fixed:** relative `../schemas/*`, `../models/*` |
| 4 | Debug noise | `generateEmbedding` logged full embedding vectors (`console.log`). | 95% | **Fixed:** remove log; keep `console.error` |
| 5 | Loose Zod | Empty strings allowed on name/content/source/target/query/options/question/id. | 85% | **Fixed:** `.min(1)` on non-empty string fields |
| 6 | `any` | No TypeScript `any` in `src/ai` / `src/prompts` (only prose “any”). | 95% | None |
| 7 | Cast hygiene | Redundant `input.id as string` after null/empty guard. | 90% | **Fixed:** ternary without cast |
| 8 | Prompts centralization | Tool narratives live under `src/prompts/tools/*`; system prompt composes bullets + `GRAPH_CONTEXT`. Schemas hold shape only + field describes from prompts. | 95% | None (already done) |
| 9 | Ask field copy | Ask Zod describes were stub-thin vs other tools. | 80% | **Fixed:** richer field describes (prompts only) |
| 10 | askUserQuestion tool | Still registered (no `execute`; client completes). AGENTS: tool may remain. Live pending-ask path uses schema. | 95% | **Kept** (do not remove) |
| 11 | Dead exports | All schema exports used by toolset and/or client helpers. Prompt barrel exports used by system prompt + toolset + schemas. | 90% | None |
| 12 | Over/under eng. toolset | Single `createToolSet` factory; lazy Exa; Q-gen fail-closed before write; PART_OF parent guard. Appropriate for product. | 85% | None |
| 13 | Q-gen array bounds | Model asked for 5–8 questions; `Output.array` does not enforce min/max count — only per-string max chars. | 70% | Deferred (&lt;75% / needs SDK shape check) |
| 14 | Root still exports agent | `import { runAgent } from "@/ai"` still pulls agent→toolset→Falkor. Fine for API routes only; client must never use root barrel. | 90% | Documented; API consumers unchanged |
| 15 | modelstore → logos | `modelstore` → `@/lib/models` → logo React components. Server-only today; catalog coupling outside write scope. | 80% | Deferred (lib/components) |

---

## Fixes shipped (this commit)

1. **`src/ai/index.ts`** — Drop `export * from "./tools"`; document server vs client import rules.
2. **`src/ai/tools/index.ts`** — Note Node-only / Falkor boundary on domain barrel.
3. **`src/ai/schemas/index.ts`** — Document `*-schema` SoT + client deep-import safety.
4. **`src/ai/models/embeddings.ts`** — Remove embedding result `console.log`.
5. **`src/ai/tools/toolset.ts`** — Relative in-package imports; clean id assignment; drop redundant `(q: string)`.
6. **Schemas** — `.min(1)` on string fields: ask, upsert, link, web-search (search already had it).
7. **`src/prompts/tools/ask-user-question.ts`** — Align field describes with other tools.

---

## Hard stops honored

- No push / force / dep bumps.
- `askUserQuestion` tool retained.
- Falkor remains Node-only (toolset + agent path); client schema deep path preserved.

---

## Residual risks / follow-ups (not fixed)

1. **Optional `server-only` package** on `toolset.ts` / `agent.ts` would hard-fail client pulls — needs dep add (out of hard-stop).
2. **Q-gen length clamp** against `MEMORY_QUESTION_COUNT_MIN/MAX` after model output.
3. **`@/lib/models` logo coupling** for server model resolution (split client catalog vs server chef table).
4. **API routes** still use `@/ai` for `runAgent` / `generateEmbedding` (OK server-side); could migrate to `@/ai/agent` / `@/ai/models` for symmetry (app/ out of write scope).
5. AGENTS.md architecture line still says public barrel includes tools — docs drift if maintainers expect root tools export (use `@/ai/tools`).

---

## Consumer map (verified)

| Consumer | Import | Safe? |
|----------|--------|-------|
| `src/app/api/chat/route.ts` | `runAgent` from `@/ai` | Server OK |
| `src/app/api/test-db/route.ts` | `generateEmbedding` from `@/ai` | Server OK |
| `src/lib/ask-user-question.ts` | `@/ai/schemas/ask-schema` | Client OK |
| `agent/agent.ts` | relative toolset + models; `@/prompts/system-prompt` | Server OK |
| `toolset.ts` | relative schemas/models; `@/lib/falkor`; `@/prompts/tools` | Server OK |

---

## Verdict

Prior refactors (centralized prompts, no dual shims, client deep schema import) held. Remaining high-confidence issues were barrel surface, in-package import style, debug logging, loose empty-string Zod, and thin ask field copy — all fixed within write scope.
