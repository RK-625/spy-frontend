# Safe deprecated / redundant cleanup plan

**Status:** Phases 0–4 **done** (2026-07-30). Phases 5–6 still **blocked** on product decisions.  
**Depends on:** `plans/client-placement-cache.md` **Implemented (MVP)**  
**Goal:** Remove dead fields, dual-path helpers, FA2 soft-switches, and optional archives **without** breaking live chat, client placement, or design-history retention rules.

---

## Executive summary

Most “old stuff” falls into **three buckets**. Only the first two are pure hygiene; the third needs product intent.

| Bucket | Examples | Safe to delete as hygiene? |
|--------|----------|----------------------------|
| **A. Legacy placement dual-path** | Memory Zod `x`/`y`/`rank`; `memoryNeedsLayout*`; FA2 `simulationEnabled`; `EDGE_SYNAPSE_GAP_MIN`; slim `memory-placement` / `memory-layout-settle` after verify migration | **Yes**, phased + verify gates |
| **B. Doc / plan drift** | Superseded plans still read as live; AGENTS historical wording | **Yes** (docs-only) |
| **C. Parked or still-live product** | `src/deprecated/*` archives; non-morph `askUserQuestion` on `/home` | **No** without explicit product decision |

**Hard rules (every phase):**

1. Do **not** resurrect ask-user-question **morph** into live `prompt-input`.  
2. Do **not** reintroduce server settle/persist (`setMemoryPlacement`, Falkor xy writes).  
3. Do **not** treat parked redesign archives or the **live pending-ask** pipeline as trash without sign-off.  
4. Green verify matrix before merging each phase (listed per phase).  
5. Prefer **stop production/read usage → drop exports → delete** order; never “delete then fix callers.”

---

## Inventory (sources of truth)

> **Post Phases 0–4:** §1–§3 below are the **current** map. Pre-cleanup research tables are gone; see “removed by phase.”

### 1. Already gone (do not re-litigate)

| Item | Evidence |
|------|----------|
| FA2 / graphology modules | Removed under d3 S7; not under `src/lib/graph` |
| Fan/spiral geometry | Snapshot deleted (was `memory-placement-geometry.ts`) |
| Product `setMemoryPlacement` / `getMemoryPlacement` / `listMemoryPlacements` | Deleted from `falkor.ts`; `verify:weave-layout` asserts absence |
| Product `settleAndPersistMemoryPlacements` + `memory-layout-settle.ts` | Module deleted (Phase 2); pure settle is `force-recipe` only |
| Server toolset placement | `upsertMemory` / `linkMemories` no settle |

### 2. Removed by phase (layout dual-path + FA2 soft-switches)

| Phase | Removed | Where it lived |
|-------|---------|----------------|
| 1 | `memoryNeedsLayout` / `memoriesNeedLayout` | `from-memory-graph.ts` + barrel — product gate is `memoryGraphToGraphDataWithMeta().needsLayout` |
| 1 | `EDGE_SYNAPSE_GAP_MIN` | `graph-scale.ts` + barrel — live path uses `EDGE_SYNAPSE_GAP_FRAC` only |
| 1 | `LAYOUT_SIMULATION_ENABLED`, `simulationEnabled`, `iterationsPerFrame` | `layout-loop.ts` + barrel — engines are `"static"` \| `"d3-settle"` only |
| 2 | `shouldPlaceOnUpsert` / `shouldPlaceOnLink` / `partOfRankNeedsUpdate` | former `memory-placement.ts` server-policy gates |
| 2 | `settleMemoryGraphIncremental` + `memory-layout-settle.ts` | dual-path incremental settle module deleted |
| 3 | Memory Zod `x` / `y` / `rank`; `MemoryGraphNodeInput` layout fields | `graph-schema.ts`, `from-memory-graph.ts` — client cache owns pose |

**Still present (thin client helpers only):** `memory-placement.ts` keeps `isPlacedLayout`, `rankAfterParent`, `PARENT_CHILD_RADIUS`, `LAYOUT_ORIGIN_EPSILON` for pure pose gating / verify — not server place policy.

### 3. Current product placement surface

| Symbol / path | Role |
|---------------|------|
| `placement-cache.ts` + adapter `needsLayout` / fingerprint | Client pose SoT (`localStorage`) |
| `force-recipe.settleGraphData` | Pure d3 one-shot settle; may save cache |
| `layout-loop` engines `"static"` \| `"d3-settle"` | Canvas install path; no continuous FA2 sim |
| `listGraphTopology` | Content + links only (no `m.x`/`m.y`/`m.rank`) |
| `verify:weave-layout` / `verify:placement-cache` | Fence dual-path resurrection + client-cache invariants |

### 4. Still-live product (do **not** delete under “cleanup”)

| Surface | Why it stays |
|---------|----------------|
| `askUserQuestion` tool + schema | Always-on in agent; client-answered |
| `src/lib/ask-user-question.ts` + `/home` `pendingAsk` | Non-morph option chips still production |
| `verify:pending-ask` / `verify:widget-cleanup` | Protect tool + forbid morph re-entry |

### 5. Parked archives (`src/deprecated/`)

| Path | Role | Production imports? |
|------|------|---------------------|
| `ask-user-question-widget/` | Morph snapshot for redesign | **None** from product |
| `ui-prototypes/` | Lab variants; imports widget-layout | **None** from product |

**Coupling:** `ui-prototypes` → `ask-user-question-widget/widget-layout`. Delete **both or neither**.

### 6. Historical docs (not code)

| Path | Role |
|------|------|
| `plans/hybrid-placement-cache-dirty.md` | **SUPERSEDED** — keep as tombstone or archive |
| `plans/d3-force-placement-slices.md` | **Done** S0–S8 — historical sequencing; P-A text is pre–client-cache |
| `D3-FORCE-LAYOUT-PLAN.md` | Historical FA2 dual-authority |
| `brief.md` / AGENTS morph notes | Intentional retention of redesign parking |

---

## Phased removal plan

### Phase 0 — Confirm already clean (no code delete) — **DONE**

**Work:** Re-run gates; document “already done.”

```bash
npm run verify:weave-layout
npm run verify:placement-cache
npm run verify:widget-cleanup
npm run verify:components-structure
```

**Exit:** No product imports of deleted placement APIs; morph still out of live prompt-input.

---

### Phase 1 — Low-risk API debt (one PR) — **DONE**

**Goal:** Drop soft-switches and helpers that product already does not use, after verify migration.

| # | Action | Touch |
|---|--------|--------|
| 1.1 | Migrate verify scripts off `memoryNeedsLayout` → `memoryGraphToGraphDataWithMeta().needsLayout` (or pure seed/cache checks) | `scripts/verify-d3-force-recipe.mjs` (+ any other) |
| 1.2 | Remove barrel + function exports of `memoryNeedsLayout` / `memoriesNeedLayout` when `rg` clean | `from-memory-graph.ts`, `lib/graph/index.ts` |
| 1.3 | Remove `EDGE_SYNAPSE_GAP_MIN` after `rg` clean | `graph-scale.ts`, barrel, docs |
| 1.4 | Remove FA2-era options: `simulationEnabled`, `iterationsPerFrame`, and optionally `LAYOUT_SIMULATION_ENABLED` constant | `layout-loop.ts`, barrel, graph-canvas comments, `verify-mock-layout`, `verify-d3-layout` |
| 1.5 | Update verify scripts that only assert `LAYOUT_SIMULATION_ENABLED === false` to assert engine is static/d3 without the constant | verify scripts |

**Must not:** Touch toolset, falkor, chat pending-ask, `src/deprecated`.

**Gates:**

```bash
npm run verify:d3-force-recipe
npm run verify:d3-layout
npm run verify:mock-layout
npm run verify:placement-cache
```

---

### Phase 2 — Dual-path placement modules (one PR) — **DONE**

**Goal:** Collapse leftover “server placement policy” surface to pure client-cache helpers only.

| # | Action | Notes |
|---|--------|--------|
| 2.1 | Inventory: `rg shouldPlaceOnUpsert|shouldPlaceOnLink|settleMemoryGraphIncremental|isPlacedLayout` | Expect **verify-weave** only |
| 2.2 | **Option A (prefer):** Rewrite `verify-weave-layout` to assert client-placement invariants (fingerprint, no Falkor place, pure force-recipe settle) without `shouldPlaceOn*` | Then delete unused gates from `memory-placement.ts` |
| 2.3 | **Option B:** Keep `isPlacedLayout` + `rankAfterParent` if still useful for pure tests; delete only `shouldPlaceOnUpsert` / `shouldPlaceOnLink` once unused | Smaller |
| 2.4 | Delete or fold `memory-layout-settle.ts` into `force-recipe` tests once verify no longer imports it | Pure incremental settle is optional library debt |
| 2.5 | Slim `memory-placement.ts` header to “client pose helpers only” or rename file if only `isPlacedLayout` + rank remain | Avoid P-A language |

**Gates:**

```bash
npm run verify:weave-layout
npm run verify:placement-cache
npm run verify:d3-force-recipe
```

**Must not:** Reintroduce Falkor placement writes.

---

### Phase 3 — Schema field drop (one PR, after Phase 1–2) — **DONE**

**Goal:** Memory Zod no longer pretends layout lives on the node.

| # | Action |
|---|--------|
| 3.1 | Confirm `rg` for Memory `x`/`y`/`rank` writers = none in product |
| 3.2 | Remove optional `x`/`y`/`rank` from `Memory` Zod in `graph-schema.ts` |
| 3.3 | Remove deprecated fields from `MemoryGraphNodeInput` if present |
| 3.4 | Leave Falkor **physical** props alone unless a separate DB migration is planned (orphan props on disk are OK; stop reading/writing them) |

**Gates:** placement + weave + TypeScript build (`tsc` / `next build` as usual).

**Risk:** Any external test fixture that still POSTs layout fields into Memory parse will fail — fix fixtures in same PR.

---

### Phase 4 — Docs tombstones (can parallel Phase 1) — **DONE**

| # | Action |
|---|--------|
| 4.1 | Banner `plans/d3-force-placement-slices.md`: completed; **placement product policy** is `client-placement-cache.md` (not P-A persist) |
| 4.2 | Keep `hybrid-placement-cache-dirty.md` SUPERSEDED banner (already) |
| 4.3 | AGENTS: one line under graph — “deprecated cleanup program: `plans/safe-deprecated-cleanup.md`” |
| 4.4 | Optional: move historical root `D3-FORCE-LAYOUT-PLAN.md` to `plans/archive/` |

**Gates:** docs-only; no code verify required.

---

### Phase 5 — Ask-user-question product decision (**blocked**)

**Not hygiene.** Two different decisions:

| Decision | What to remove | Order |
|----------|----------------|-------|
| **5a Kill pending-ask entirely** | Stop `/home` reads → remove tool/schema/lib/system-prompt guidance → update `verify:pending-ask` / widget-cleanup | Only with product kill |
| **5b Keep non-morph chips; only archives** | No production delete | — |

**Default for this plan:** **do nothing** until product says kill or redesign.

---

### Phase 6 — Archives (`src/deprecated/*`) (**blocked**)

| Decision | Action |
|----------|--------|
| **Keep for redesign** (default) | Leave both trees; no production imports today |
| **Delete design history** | Delete `ask-user-question-widget` **and** `ui-prototypes` together; update AGENTS/brief/README links; keep `verify:widget-cleanup` as fence |

**Must not:** Delete only one of the two without fixing ui-prototypes imports.

---

## Dependency graph

```text
Phase 0 (confirm)
 └── Phase 1 (low-risk APIs + FA2 flags)
      └── Phase 2 (memory-placement / layout-settle dual path)
           └── Phase 3 (Zod x/y/rank drop)
 Phase 4 docs (parallel anytime)
 Phase 5 ask UX  ── product gate
 Phase 6 archives ── product gate
```

---

## Acceptance matrix (full program)

| Gate | Phases |
|------|--------|
| `verify:placement-cache` | 0–3 |
| `verify:weave-layout` | 0–3 |
| `verify:d3-force-recipe` | 1–3 |
| `verify:d3-layout` | 1 |
| `verify:mock-layout` | 1 |
| `verify:widget-cleanup` | 0, 5–6 |
| `verify:pending-ask` | 5 only if changing ask path |
| `verify:components-structure` | 6 if paths change |
| Manual `/graph` cold open + warm cache hit | 1–3 |
| Manual `/home` chat still works | every PR |

---

## Explicit non-goals

- Re-opening pure-perf quality bans  
- Full KB residency / viewport slices  
- C3b progressive growth (separate feature)  
- Deleting ask tool “because morph is deprecated”  
- Force-deleting `src/deprecated` without product OK  

---

## Recommended first PR (smallest high leverage)

**Phase 1 only:**

1. Migrate verifies off `memoryNeedsLayout`.  
2. Delete those helpers + `EDGE_SYNAPSE_GAP_MIN`.  
3. Remove FA2 option fields / `LAYOUT_SIMULATION_ENABLED` with verify updates.  
4. No schema drop, no archive delete, no ask changes.

Estimated blast radius: layout-loop + graph barrel + 2–3 verify scripts. No chat surface.

---

## Research provenance

Synthesized from deep-research (2026-07-30) over:

- `src/deprecated/*`, `src/types/graph-schema.ts`, `from-memory-graph.ts`, `layout-loop.ts`, `graph-scale.ts`, `memory-placement.ts`, `memory-layout-settle.ts`, `falkor.ts`, toolset, `/home` pending-ask, verify scripts, `plans/client-placement-cache.md`, d3/hybrid plans, AGENTS.md  

Status of that research: **Partial** (no live DB legacy prop inspection; ask permanent kill unresolved). This plan treats those as explicit gates, not assumptions.

---

## Success definition

Program complete when:

1. No `@deprecated` layout fields on product Memory Zod **or** product deliberately keeps them with zero readers (prefer remove).  
2. No FA2-shaped layout-loop options or `LAYOUT_SIMULATION_ENABLED` soft-switch.  
3. No dual “API xy needsLayout” helpers; single client-cache gate.  
4. `memory-layout-settle` gone or clearly test-only with no product imports.  
5. Docs no longer present superseded P-A as live product policy.  
6. Ask morph archive and pending-ask status are **explicit product decisions**, not accidental deletes.
