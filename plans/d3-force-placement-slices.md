# d3-force placement — atomic slice plan

**Status:** Planning only — implement one slice per PR.  
**Date:** 2026-07-29  
**Supersedes for sequencing:** `D3-FORCE-LAYOUT-PLAN.md` dual-authority FA2→d3 polish path.  
**Direction locked for this plan:** d3-force is the **placement** engine (one-shot / short settle). Visual **size** stays rank-driven in `graph-scale.ts`. Continuous ambient motion stays **off** until a later optional slice.

---

## Product locks (do not re-litigate per slice)

| Lock | Decision |
|------|----------|
| Placement SoT | d3 settle writes world `x` / `y` |
| Rank | Topology-derived (PART_OF depth); never from force |
| Visual size | `nodeScreenRadius(rank, zoom)` in `graph-scale.ts` only |
| Layout spacing | Force recipe may **read** rank for collide / link distance |
| Continuous ambient | Off by default (not placement) |
| Default `/graph` | Static / current mock path until opt-in flag or post-flip slice |
| FA2 | Do not build parallel product engine; leave dead path until a dedicated delete slice |
| Quality bans | Unchanged |

**Persist policy (pick before Slice 5, not before Slice 0):**

- **P-A:** Persist **settled** `x/y` only (stable reopen).  
- **P-B:** Do not persist `x/y`; re-settle on every load.

Until that pick, Slices 0–3 treat positions as **session / verify-only**.

---

## Slice rules

1. **One slice = one PR** (or one tightly scoped commit series).  
2. **Green exit criteria** before the next slice starts.  
3. **No drive-by refactors** outside the slice’s file list.  
4. **No toolset / Falkor placement flip** until Slice 5.  
5. Prefer **verify scripts** over manual-only gates for pure modules.

---

## Dependency graph

```text
S0 force-recipe + verify
 └── S1 one-shot settle loop (opt-in, mock)
      └── S2 cold-start missing xy → settle
           ├── S3 live topology feed (positions optional)
           │    └── S4 opt-in settle on live data
           └── S5 toolset: stop fan place; rank + settle write
                └── S6 demote memory-placement geometry
                     └── S7 FA2 path delete (optional cleanup)
                          └── S8 ambient motion (optional polish)
```

**Do not skip S0 → S1.** S3 can start after S1 if cold-start is deferred, but S2 before trusting real rows without coords.

---

## Slice 0 — Pure force recipe + verify

**Goal:** Prove d3 can place mock topology without UI, toolset, or Pixi.

| | |
|--|--|
| **Files add** | `src/lib/graph/force-recipe.ts`, `scripts/verify-d3-force-recipe.mjs` |
| **Files touch** | `package.json` (dep + script only) |
| **Deps** | `d3-force` (+ `@types/d3-force` if needed) |
| **Must not touch** | toolset, falkor, memory-placement, pixi-renderer, graph-canvas, layout-loop product default |

**Work:**

1. Install `d3-force`.  
2. Export pure builders, e.g. `buildForceSimulation(graph: GraphData)` / `settleGraphData(graph, opts) → GraphData`.  
3. Forces (initial knobs — tune in verify, not in product UI):  
   - `forceLink`: `PART_OF` stiffer / shorter; `RELATES_TO` softer / longer  
   - `forceCollide`: radius from `nodeScreenRadius(rank, 1) * pad`  
   - `forceManyBody`: mild  
   - `forceCenter(0,0)`: weak  
4. Preserve `id`, `label`, `rank`; only mutate / output `x`, `y`.  
5. Verify script: load mock graph → settle → assertions.

**Exit criteria:**

- [ ] `npm run verify:d3-force-recipe` green  
- [ ] All positions finite; ranks identical to input  
- [ ] Mean PART_OF length &lt; mean RELATES_TO length (soft assert with tolerance)  
- [ ] Static product path still does not import `d3-force` (no wire yet)

**Rollback:** remove dep + two files + script.

---

## Slice 1 — One-shot settle loop, opt-in on `/graph` (mock)

**Goal:** See placement on canvas without changing product default.

| | |
|--|--|
| **Files add** | `src/lib/graph/layout-loop-d3.ts` (or settle-only module if thinner) |
| **Files touch** | `layout-loop.ts` (dispatcher / flag only), `graph-canvas.tsx` (opt-in read of query/flag), optional `index.ts` export |
| **Depends on** | S0 |
| **Must not** | Flip `LAYOUT_SIMULATION_ENABLED` default; continuous rAF ambient; touch toolset |

**Work:**

1. Implement settle path that mirrors enough of `LayoutLoopHandle` for: `setGraphData` → settle → `renderOnGraphData` with `movedNodeIds` + `dirtyEdges` when possible.  
2. Opt-in only, e.g. `/graph?layout=d3` or `createLayoutLoopAsync({ layoutEngine: "d3-settle" })`.  
3. Default `/graph` remains static mock (today’s behavior).  
4. Add `scripts/verify-d3-layout.mjs` — settle moves ≥1 node vs static frozen path.

**Exit criteria:**

- [ ] `/graph` unchanged (static)  
- [ ] `/graph?layout=d3` (or agreed flag): readable layout, no NaN, pan/zoom still works  
- [ ] `verify:d3-layout` green  
- [ ] Dynamic import so default chunk still avoids `d3-force` when flag off  

**Rollback:** remove opt-in branch; leave S0.

---

## Slice 2 — Cold-start contract (missing xy)

**Goal:** Topology without finite coords does not permanently stack at origin.

| | |
|--|--|
| **Files touch** | `from-memory-graph.ts` (document / flag needs-layout; avoid silent “forever 0” as final), settle entry from S0/S1 |
| **Depends on** | S0; ideally S1 for visual proof |
| **Must not** | Change toolset place calls yet |

**Work:**

1. Define contract: missing / non-finite `x/y` → layout required.  
2. Adapter may still default seed `0` for DTO shape, but settle path **must** run before “final” paint when any node needs layout (or all-zero collapse detected).  
3. Verify: synthetic graph with edges + ranks, all `x/y` missing → after settle, nodes not all within epsilon of origin.

**Exit criteria:**

- [ ] Verify covers missing-xy graph  
- [ ] Documented in `from-memory-graph.ts` header (one short paragraph)  
- [ ] No rank recompute in adapter  

**Rollback:** revert adapter + settle trigger only.

---

## Slice 3 — Live topology feed (read-only layout)

**Goal:** `/graph` can load Memory + Links from Falkor; placement still settle/opt-in.

| | |
|--|--|
| **Files add** | e.g. `src/app/api/graph/route.ts` (or equivalent list query) |
| **Files touch** | `falkor.ts` (read helpers only if missing), `graph-canvas.tsx` load path |
| **Depends on** | S1 recommended; S2 if DB rows lack xy  
| **Must not** | Write layout from client; change placement policy in toolset |

**Work:**

1. API returns memories + links (or GraphData-ready payload).  
2. Canvas: `memoryGraphToGraphData` → existing layout loop.  
3. Mock remains fallback (env/query) for offline / empty DB.

**Exit criteria:**

- [ ] With DB data: nodes/edges render  
- [ ] Empty DB: graceful empty or mock fallback (product choice, document in PR)  
- [ ] No `setMemoryLayout` from client  

**Rollback:** feature-flag feed off; mock only.

---

## Slice 4 — Settle on live data (opt-in)

**Goal:** Same as S1, but feed + settle together.

| | |
|--|--|
| **Files touch** | graph load path + settle flag only  
| **Depends on** | S1 + S3 (+ S2 if coords missing) |

**Work:**

1. When feed loads and `layout=d3` (or “always settle if needs-layout”), run one-shot settle.  
2. If P-A later: do **not** auto-persist yet (persist is S5/S5b).  

**Exit criteria:**

- [ ] Live graph + settle opt-in readable  
- [ ] Default still non-breaking  

---

## Slice 5 — Toolset placement flip

**Goal:** Agent weave stops using fan/spiral as geometry SoT.

| | |
|--|--|
| **Files touch** | `src/ai/toolset.ts`, possibly thin server settle helper importing shared recipe  
| **Depends on** | S0; S3 for product proof; **persist policy P-A or P-B locked** |
| **Must not** | Change edge schema; LLM tool inputs for x/y |

**Work:**

1. On upsert/link: derive **rank** only; create/update topology.  
2. Stop calling `placeAsRoot` / `placeAsChild` / `placeForRelates` for durable geometry.  
3. Run **shared** settle (Node-safe pure recipe) → if **P-A**, `setMemoryLayout` settled coords; if **P-B**, leave xy unset / null and client settles.  
4. Content-only upsert: still must not reshuffle (no re-settle unless topology changed — explicit policy in PR).

**Exit criteria:**

- [ ] New weave produces layout without fan module  
- [ ] Rank still correct on PART_OF  
- [ ] No dual-write fan + settle for the same event  

**Rollback:** restore place* calls behind a flag for one release if needed.

---

## Slice 5b — Persist policy only (if split from S5)

**Use when S5 is too large.** Atomic half-slice:

- Wire only rank + no place; client always settles (P-B), **or**  
- Wire only settled write API after server settle (P-A).

---

## Slice 6 — Demote `memory-placement` geometry

**Goal:** Single placement brain in code, not just in policy comments.

| | |
|--|--|
| **Files touch** | `memory-placement.ts` (remove or deprecate place*), toolset imports, any tests  
| **Depends on** | S5 stable  

**Work:**

1. Keep rank helpers / shared constants if still used.  
2. Delete or `@deprecated` fan/spiral place APIs.  
3. Grep clean for `placeAsChild` etc. in production paths.

**Exit criteria:**

- [ ] `rg placeAs|placeMemoryNode|placeForRelates` clean on product paths  
- [ ] Verify scripts for rank still green  

---

## Slice 7 — Remove FA2 dead path (cleanup)

**Goal:** Drop unused graphology/FA2 after d3 settle is the only engine.

| | |
|--|--|
| **Files remove** | `layout-loop-sim.ts`, `fa2-worker.ts` (when unused) |
| **Files touch** | `layout-loop.ts`, `package.json`, `AGENTS.md` |
| **Depends on** | S1+ used in product or CI; no FA2 callers |

**Exit criteria:**

- [ ] `rg graphology` clean  
- [ ] Bundle / import guard: sim chunk is d3 only if any  

---

## Slice 8 — Optional ambient motion (not placement)

**Goal:** Subtle continuous motion if product wants “living web” polish.

| | |
|--|--|
| **Depends on** | S1+ stable; UX sign-off  
| **Default** | Still off  

**Exit:** motion flag separate from settle; freeze during pan optional.

---

## Out of scope (all slices unless explicitly reopened)

- Dagre dual engine  
- Viewport-only sim (KB scale) — later program  
- Relaxing graph quality bans  
- Resurrecting ask-user-question morph  
- Changing DotStream size formulas beyond sharing tokens with collide  
- Parallel long-lived `layoutEngine: "fa2" | "d3"` product matrix  

---

## Suggested first three PRs (start now)

| PR | Slice | One-line title |
|----|-------|----------------|
| 1 | **S0** | `feat(graph): d3 force-recipe + verify (placement spike)` |
| 2 | **S1** | `feat(graph): opt-in one-shot d3 settle on /graph` |
| 3 | **S2** | `fix(graph): cold-start settle when xy missing` |

After PR3, stop and lock **P-A vs P-B** before S5.

---

## Verification map

| Slice | Script / check |
|-------|----------------|
| S0 | `verify:d3-force-recipe` |
| S1 | `verify:d3-layout` + manual `/graph` vs `/graph?layout=d3` |
| S2 | missing-xy case in recipe or layout verify |
| S3 | manual / API smoke + empty DB |
| S5 | weave integration smoke (create + PART_OF) |
| Existing | `verify:mock-layout`, `verify:hierarchy`, `verify:node-size` stay green every PR |

---

## Relation to root `D3-FORCE-LAYOUT-PLAN.md`

| That doc | This plan |
|----------|-----------|
| FA2 → d3 as **session polish**; placement stays fan | d3 is **placement**; fan retired by S6 |
| Phases 1–4 engine parity first | S0–S1 placement proof first |
| Live feed “adjacent” Phase 5 | S3 after opt-in settle visible |
| Parallel FA2+d3 deprecation train | S7 only after d3 used; no long dual product engine |

Keep `D3-FORCE-LAYOUT-PLAN.md` as historical / FA2 notes if useful; **execute this slice plan** for implementation order.

---

## Open before S5 (not blockers for S0–S1)

| ID | Question | Options |
|----|----------|---------|
| P1 | Persist settled xy? | P-A yes / P-B no |
| P2 | Settle on server, client, or shared both? | Prefer **shared pure recipe**; run where write authority lives |
| P3 | Content-only upsert re-settle? | Default **no** |
| P4 | Opt-in query name | `layout=d3` vs settings flag |

---

*Document version: 1.0 — 2026-07-29*
