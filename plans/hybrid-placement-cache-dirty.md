# Hybrid placement — topology → d3, cache, dirty recompute

> [!WARNING]
> **SUPERSEDED** (2026-07-29 grill)  
> This plan is **SUPERSEDED** by [`plans/client-placement-cache.md`](./client-placement-cache.md). Do not implement H1 server create-persist. FalkorDB holds topology only; `x`/`y` (and rank) are client compute + `localStorage` cache, never saved in the app DB.

**Status:** **SUPERSEDED** (2026-07-29 grill). Do not implement H1 server create-persist.  
**Replacement:** [`plans/client-placement-cache.md`](./client-placement-cache.md) — Falkor topology only; `x`/`y` (and rank) are **client** compute + `localStorage` cache, never app DB.  
**Date:** 2026-07-29  
**Depends on:** `plans/d3-force-placement-slices.md` **S0–S8 complete**.  
**Historical note:** This draft assumed durable Falkor placement cache (P-A). Product direction locked to **client-only pose cache** instead.

---

## Why this plan exists

S0–S8 delivered:

- d3-force as the **placement engine** (`force-recipe.ts`)
- Server **P-A** persist via `settleAndPersistMemoryPlacements` + `setMemoryPlacement`
- Live `/api/graph` + client paint; continuous layout off by default
- Fan/spiral and FA2 removed from product paths

What is still heavy / inconsistent with the desired product story:

| Today | Desired |
|-------|---------|
| Create writes `rank: 0`, leaves **`x`/`y` null** | Every durable Memory has a **placement cache** pose |
| Content update may **cold-settle** if unplaced | Content update **never** moves nodes |
| Link path branches (placed / rank-only / unplaced / RELATES) | One **dirty → settle → persist** entrypoint |
| `x`/`y` feel like dual SoT | Topology is SoT; **`x`/`y` are cache** of last settle |
| Client may session-settle unplaced rows without write | Server owns durable cache; client paints cache |
| Policy helpers (`shouldPlaceOnUpsert` create-true-but-no-settle) | Small dirty matrix; repair = cache miss only |

**Goal:** Leaner layout management, stable reopen, live local motion after weave, **less policy code** — without dropping the placement cache (full ephemeral re-settle every open is rejected for product map stability).

---

## Product locks (do not re-litigate inside this program)

| Lock | Decision |
|------|----------|
| Structural SoT | Memory content + embeddings + links (`PART_OF` / `RELATES_TO`) |
| Placement engine | d3 one-shot / short settle (`settleGraphData` / incremental wrapper) |
| Placement cache | Durable world `x`/`y` (and rank) after settle — **P-A remains** |
| Rank | Topology-derived (PART_OF depth); force never invents rank |
| Visual size | `nodeScreenRadius` in `graph-scale.ts` only |
| LLM | Never authors `x` / `y` / `rank` (tool schemas stay clean) |
| Client write | `/graph` **never** calls `setMemoryPlacement` |
| Default `/graph` | Live-first via `/api/graph`; empty/error → mock; overrides unchanged |
| Continuous ambient | Off by default (`?motion=1` only) |
| Quality bans | Unchanged |
| Full KB viewport residency | **Out of scope** (separate program) |

**Rejected for this program:**

- **P-B** (no durable xy; re-settle entire graph on every load) as product default  
- Reintroducing fan/spiral or FA2  
- Continuous simulation as the stability mechanism  

---

## Target architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ Falkor                                                       │
│  Memory: knowledge fields + rank (hierarchy cache)           │
│  Placement cache: x, y  (system-only; not search/LLM)        │
│  Links: PART_OF | RELATES_TO                                 │
└──────────────────────────────────────────────────────────────┘
              │                              ▲
              │ listGraphTopology            │ setMemoryPlacement
              ▼                              │   (dirty only)
     GET /api/graph                 afterTopologyChange(...)
     (read-only paint)                 │
              │                        ├─ compute dirty + anchors
              ▼                        ├─ settleMemoryGraphIncremental
        GraphCanvas                    └─ persist dirty placements
        static paint from cache
        (optional: live patch after weave)
```

### Mental model (one line)

**Topology is truth; positions are a cache of `f(topology)`; invalidate by dirty ids; d3 moves only the dirty set (others pinned).**

### Dirty matrix (product constitution)

| Event | Dirty set | Anchors / pins | Settle? | Persist? |
|-------|-----------|----------------|---------|----------|
| **Create Memory** | `{newId}` | all existing placed (or empty graph) | **Yes** (orphan park / 1-node settle) | Yes — **always write pose** |
| **Update content only** | ∅ | — | **No** | No (content + embeddings only) |
| **PART_OF link** | child (+ 1-hop expand as today) | parent + outsiders | Yes if rank/xy need change | Dirty only |
| **RELATES_TO link** | source focus (+ 1-hop) | outsiders | Yes | Dirty only |
| **Unlink / reparent** (future) | affected ends | rest | Yes | Dirty only |
| **Cache miss** (null / near-origin xy) | miss ids | placed nodes | Yes (repair) | Yes |
| **Open `/graph`** | ∅ if cache complete | — | No (static paint) | No |

**Invariant after H1+:** Happy-path DB rows always have finite, non-origin `x`/`y` and a defined `rank`. Cache miss is **repair**, not normal create.

---

## Relationship to prior plans

| Doc | Role after this plan |
|-----|----------------------|
| `plans/d3-force-placement-slices.md` | **Done** foundation (S0–S8). Do not re-implement. |
| `D3-FORCE-LAYOUT-PLAN.md` | **Historical** (FA2 dual-authority, fan as placement SoT). Banner only; not sequencing authority. |
| **This file** | Sequencing authority for **hybrid cache + dirty policy collapse + cleanup**. |

---

## Slice rules

1. **One slice = one PR** (or one tightly scoped commit series).  
2. **Green exit criteria** before the next slice.  
3. **No drive-by refactors** outside the slice file list.  
4. Prefer **verify scripts** for pure policy / settle gates.  
5. Keep Pixi quality bans and static default layout engine unless a slice explicitly says otherwise.  
6. Do not flip continuous ambient or `LAYOUT_SIMULATION_ENABLED` as a side effect.

---

## Dependency graph

```text
H0 docs + locks banner (optional parallel)
 └── H1 policy collapse: create always places; content never settles
      └── H2 single entrypoint afterTopologyChange (toolset thin)
           └── H3 naming / schema narrative: placement cache (not dual SoT)
                ├── H4 live graph patch after weave (optional product)
                └── H5 cleanup: dead cold-path helpers, deprecated aliases, docs
                     └── H6 (optional) algo version + deterministic seeds / mass rebuild
```

**Do not skip H1 → H2.** H4 can trail H5 if live multi-surface is deferred. H0 can land anytime.

---

## Slice H0 — Docs lock + historical banner

**Goal:** Stop agents from re-executing S0–S8 or following the root FA2 plan.

| | |
|--|--|
| **Files touch** | `plans/d3-force-placement-slices.md` (status pointer), `D3-FORCE-LAYOUT-PLAN.md` (historical banner), optionally `AGENTS.md` “What's left” note |
| **Must not touch** | toolset, falkor, force-recipe, pixi |

**Work:**

1. Banner on `D3-FORCE-LAYOUT-PLAN.md`: historical; supersession by S0–S8; next program = this plan.  
2. Point AGENTS graph “left” item: hybrid dirty placement cache program (link this file), not re-litigate pure-perf.  
3. Clarify live-first `/graph` in AGENTS if still mock-centric.

**Exit criteria:**

- [ ] Root plan clearly historical  
- [ ] This plan linked as next placement policy work  
- [ ] No code behavior change  

---

## Slice H1 — Policy collapse (create always places)

**Goal:** Enforce “durable node ⇒ placement cache written.” Kill create-null + cold-update-as-happy-path.

| | |
|--|--|
| **Files touch** | `src/ai/toolset.ts`, `src/lib/memory-placement.ts`, `scripts/verify-weave-layout.mjs` |
| **May touch** | `src/lib/memory-layout-settle.ts` (only if create needs a documented park helper) |
| **Must not touch** | pixi-renderer, graph-canvas, force-recipe knobs, embeddings |

**Work:**

1. **Create (`isNew`):** after `falkorUpsertMemory` with `rank: 0`, call  
   `settleAndPersistMemoryPlacements({ focusIds: [id] })`  
   (orphan: single movable node; empty or pinned rest).  
2. **Content update:** never call settle. Do not use `shouldPlaceOnUpsert` to trigger cold settle.  
3. **Repair (optional in H1):** if update and `!isPlacedLayout(existing)` → settle once (migration / broken rows only). Prefer a clearly named `repairPlacementIfMissing` so it is not confused with content policy.  
4. Rewrite `memory-placement.ts` policy comments: create **does** settle; F1/F10 “never settle on create” **retired**.  
5. Update `verify-weave-layout.mjs` assertions that currently require `!isNew && needsSettle` create-skip behavior.

**Exit criteria:**

- [ ] New Memory rows get finite non-origin `x`/`y` after create tool (manual or verify with test double / settle path)  
- [ ] Content-only upsert with placed xy does not call settle  
- [ ] `verify:weave-layout` green under new policy  
- [ ] `verify:d3-force-recipe` still green  

**Risks:**

- Create cost = one incremental settle per new node (acceptable at weave rate).  
- Single-node settle quality: ensure jitter/center still parks orphans off origin (`isPlacedLayout`).

---

## Slice H2 — Single entrypoint `afterTopologyChange`

**Goal:** Toolset stops branching layout; one module owns dirty + rank + settle + persist.

| | |
|--|--|
| **Files add** | e.g. `src/lib/memory-topology-change.ts` (name flexible) |
| **Files touch** | `src/ai/toolset.ts`, `src/lib/memory-layout-settle.ts`, `src/lib/memory-placement.ts` |
| **Must not touch** | pixi, graph-canvas (unless types only) |

**Work:**

1. Introduce a small API, e.g.:

   ```ts
   type TopologyChange =
     | { kind: "create"; id: string }
     | { kind: "content"; id: string } // no-op for placement
     | { kind: "link"; source: string; target: string; type: "PART_OF" | "RELATES_TO" }
     | { kind: "repair"; ids: string[] };

   afterTopologyChange(change): Promise<{ written: number; dirty: number }>
   ```

2. Map dirty matrix inside this module (reuse `settleAndPersistMemoryPlacements` / rank helpers).  
3. `linkMemories` becomes: create link → `afterTopologyChange({ kind: "link", ... })`.  
4. `upsertMemory` becomes: upsert row → create or content (or repair).  
5. Collapse PART_OF branches (skip / rank-only / settle) into the entrypoint implementation so toolset has no layout if-ladders.

**Exit criteria:**

- [ ] toolset has **no** direct `shouldPlaceOnLink` / multi-branch settle logic  
- [ ] PART_OF parent pinned; child rank = parent+1 when linked  
- [ ] RELATES always dirty-settles focus neighborhood  
- [ ] Content path writes zero placement rows when already placed  
- [ ] `verify:weave-layout` (+ any new unit checks) green  

---

## Slice H3 — Placement cache narrative (schema + API naming)

**Goal:** Make “cache not knowledge” undeniable in types and docs without a forced storage migration.

| | |
|--|--|
| **Files touch** | `src/types/graph-schema.ts`, `src/lib/falkor.ts` comments, `src/lib/memory-placement.ts` header, tool descriptions if needed |
| **Must not touch** | Cypher property names unless a dedicated migration slice is added |

**Work:**

1. Document on `Memory.x` / `Memory.y`: **placement cache**, system-owned, optional only for legacy/repair rows (target: always set after H1).  
2. Keep physical props `x`/`y` on `:Memory` for H3 (side table deferred — see non-goals).  
3. Ensure public comments use `getMemoryPlacement` / `setMemoryPlacement`; deprecate aliases already present stay until H5.  
4. No LLM schema fields for coordinates (already true — reaffirm).

**Exit criteria:**

- [ ] Schema comments match hybrid model  
- [ ] No runtime behavior change required  
- [ ] Agents reading types do not treat xy as model-authored knowledge  

**Optional later (not H3):** move cache to `:Placement` or side map — only if product wants stricter schema purity.

---

## Slice H4 — Live dirty patch to `/graph` (optional product)

**Goal:** Real-time feel without continuous sim: after weave, canvas updates moved nodes only.

| | |
|--|--|
| **Files touch** | `src/components/graph/graph-canvas.tsx`, possibly chat tool-result plumbing, `src/lib/graph/graph-diff.ts` (use existing) |
| **Must not touch** | force knobs, quality bans, client persist |

**Work (pick one, lean first):**

1. **Minimal:** after relevant tool results in a future graph-aware host, `GET /api/graph` again and `setGraphData` with `diffGraphDirty` (already used).  
2. **Richer:** tool/settle returns `{ dirtyIds, placements: {id,x,y,rank}[] }`; canvas merges without full topology reload.  
3. Animate only `movedNodeIds` path already supported by Pixi dirty options.

**Exit criteria:**

- [ ] Client still never calls `setMemoryPlacement`  
- [ ] Pan/zoom stay static (no ambient unless `?motion=1`)  
- [ ] After weave + refresh/patch, positions match server cache  
- [ ] No full-graph force on the client for happy path when cache is complete  

**Defer if:** chat and graph are not co-visible yet; H1–H2 still deliver leaner server layout alone.

---

## Slice H5 — Cleanup

**Goal:** Delete policy debt and doc lies; keep deprecated snapshots intentional.

| | |
|--|--|
| **Files touch** | toolset, memory-placement, verify scripts, AGENTS.md, plan status, deprecated aliases |
| **May delete / shrink** | cold-path-only helpers if unused; redundant comments; verify regexes for old F1/F10 |

**Work:**

1. Remove or rehome unused `shouldPlaceOnUpsert` semantics if replaced by `afterTopologyChange`.  
2. Drop deprecated `getMemoryLayout` / `settleAndPersistMemoryLayouts` aliases **if** repo `rg` is clean (or keep one release with `@deprecated`).  
3. Confirm product paths do not import `src/deprecated/memory-placement-geometry.ts`.  
4. Update AGENTS.md architecture notes: hybrid cache + dirty; create always places.  
5. Mark this plan slices complete as they land.  
6. Historical root plan remains banner-only (from H0).

**Exit criteria:**

- [ ] `rg` clean for retired policy phrases that contradict H1 (e.g. “never settle on create alone” in product code)  
- [ ] verify scripts match live policy  
- [ ] No fan/FA2 resurrection  
- [ ] Lint/typecheck/relevant verifies green  

---

## Slice H6 — Optional hardening (algo version + deterministic seeds)

**Goal:** Mass rebuild and cold full-settle stay stable; support future “invalidate all caches.”

| | |
|--|--|
| **Files touch** | `force-recipe.ts` (seed helper), settle module, maybe placement meta field |
| **Must not touch** | Pixi quality path |

**Work:**

1. Deterministic hash seed from `id` before jitter when xy missing.  
2. Optional `placementAlgoVersion` constant; bump → full settle job (script or admin path).  
3. Document full-rebuild procedure for migration after force knob changes.

**Exit criteria:**

- [ ] Same topology + empty cache ≈ stable-ish layout across runs (hash seeds)  
- [ ] Version bump path documented  
- [ ] Still no continuous ambient default  

---

## Cleanup checklist (aggregated)

| Item | Slice | Notes |
|------|-------|-------|
| Banner `D3-FORCE-LAYOUT-PLAN.md` historical | H0 | Prevent dual-authority confusion |
| AGENTS live-first + next program pointer | H0 / H5 | Context accuracy |
| Retire F1/F10 create-null happy path | H1 | Core policy flip |
| Thin toolset layout branches | H2 | Complexity slash |
| Placement cache wording on Memory schema | H3 | Mental model |
| Dead cold upsert settle path | H1–H5 | Repair only |
| Deprecated layout aliases | H5 | After `rg` clean |
| Fan geometry remains deprecated-only | ongoing | S6 already |
| FA2 remains deleted | ongoing | S7 already |
| Client session settle for missing xy | H1+ | Should become rare; prefer server repair |
| verify-weave-layout policy asserts | H1 | Must flip with policy |

---

## Non-goals

- Viewport-scoped Falkor fetch / full KB residency  
- Multi-mesh GPU partials  
- Resurrect ask-user-question morph  
- Default continuous ambient  
- P-B ephemeral-only layout as product default  
- LLM-visible coordinates  
- DotStream / rank size formula redesign  
- Mandatory move of xy to a separate Falkor label (optional later)  

---

## Verification matrix

| Gate | When |
|------|------|
| `npm run verify:d3-force-recipe` | Every PR in this program |
| `npm run verify:d3-layout` | If layout-loop / canvas flags touched |
| `npm run verify:weave-layout` | H1, H2, H5 (policy) |
| `npm run verify:hierarchy` / `verify:node-size` / `verify:mock-layout` | If graph-scale or fixtures touched |
| Manual: create memory → `/graph?source=live` shows node off-origin | H1+ |
| Manual: content update does not jump placed node | H1+ |
| Manual: PART_OF moves/ranks child; parent stays | H2 |
| Manual: default `/graph` pan/zoom static | all |

---

## Implementation order (recommended)

1. **H0** — docs only (safe).  
2. **H1** — highest product correctness win (always place on create).  
3. **H2** — largest code-complexity slash.  
4. **H3** — cheap clarity.  
5. **H5** — cleanup once H1–H2 stable.  
6. **H4** — when chat+graph co-presence needs live feel.  
7. **H6** — when force knobs change often or mass rebuild needed.

---

## Success definition

Program is done when:

1. **Create always** leaves a durable placement cache pose.  
2. **Content never** reshuffles the map.  
3. **Links** go through one dirty/settle/persist path.  
4. **`/graph`** paints cache statically; client does not own durability.  
5. Policy surface in toolset is thin; verify scripts encode the dirty matrix.  
6. Docs no longer advertise create-null or FA2 dual-authority as current truth.

---

## Open product choices (resolve before or during H1)

| Choice | Default in this plan | Alternative |
|--------|----------------------|-------------|
| Create settle vs cheap park formula | **d3 incremental settle** (reuse stack) | Deterministic park without force for orphans only |
| Repair on content update if miss | **Yes, explicit repair** | Separate admin/migrate only |
| Live patch H4 | Optional after H2 | Refetch-only forever |
| Side Placement node | Deferred | H3+ migration if schema purity required |

---

## Appendix — Current code anchors (as of plan write)

| Concern | Location |
|---------|----------|
| Create null xy + cold settle | `src/ai/toolset.ts` `upsertMemory` |
| Link settle branches | `src/ai/toolset.ts` `linkMemories` |
| Incremental settle + persist | `src/lib/memory-layout-settle.ts` |
| Policy helpers | `src/lib/graph/memory-placement.ts` (moved from `src/lib/memory-placement.ts`) |
| Pure d3 | `src/lib/graph/force-recipe.ts` |
| Live feed | `src/app/api/graph/route.ts`, `graph-canvas.tsx` |
| Placement read/write | `src/lib/falkor.ts` `getMemoryPlacement` / `setMemoryPlacement` |
| Prior completed program | `plans/d3-force-placement-slices.md` |
