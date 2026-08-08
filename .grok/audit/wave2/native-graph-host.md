# Wave2 audit — native graph host + `/graph` route

**Agent:** native leaf (graph React host)  
**Scope (write):** `src/components/graph/**`, `src/app/graph/**`  
**Mode:** audit → auto-fix ≥75% confidence only  
**Date:** 2026-08-08  
**Refs:** `plans/graph-live-only-pivot.md`, `plans/client-placement-cache.md`, AGENTS.md graph sections  

---

## Files audited

| Path | Role |
|------|------|
| `src/components/graph/graph-canvas.tsx` | Product host: fetch live topology, place, Pixi + RTC, chrome |
| `src/components/graph/node-detail-dialog.tsx` | Node inspect modal |
| `src/app/graph/page.tsx` | Server route shell for `/graph` |
| `src/components/graph/index.ts` | **Added** — domain barrel |

Out of write scope (hunt only, not edited): `src/lib/graph/**`, `src/app/api/graph/**`, verify scripts.

---

## Hunt results (smell matrix)

| Smell | Status | Notes |
|-------|--------|-------|
| Mock product path | **Clean** | No `createMockGraphData` / `createLargeStressGraphData` / mock fallback. Empty + error → blank canvas + `console.warn`. |
| URL layout flags (`?stress`/`?source`/`?layout`/`?motion`) | **Clean** | No `URLSearchParams` / `location.search` / layout get. Single `/graph`. |
| Dead FA2 / graphology | **Clean** | No imports in host/route. |
| Dual barrels / dual-path shims | **Fixed (partial)** | Host used deep `@/components/graph/node-detail-dialog` + page deep-imported canvas. Now barrel `@/components/graph` + relative in-package import. |
| `any` | **Clean** | No `any` in host/route. |
| Dead props | **Clean** | `NodeDetailDialog` props all used. |
| Continuous layout ambient on product | **Clean** | Host uses `createGraphPaintLoop` only; no layout-engine / continuous-layout option surface. Verify string ban: no `ambientMotion` / `layoutEngine` in canvas. |
| Signals vs layout ambient confusion | **Fixed (docs)** | Comments previously said “ambient signal-pulse”; clarified as **edge-signal pulse** (weave chrome), not continuous force layout. |
| Naming / placement vs `lib/graph` isolation | **Mostly clean** | Placement via `placeTopology`; paint via dynamic `layout-loop-d3`. Hit-test pure logic still local to host (see deferred). |
| Host doing pure logic that belongs in lib | **Smell kept** | `hitTestNode` + radius pad are pure world hit-test; belong under `lib/graph` (e.g. camera/ or core/) but **out of write scope**. |
| Quality bans (maxDots / lodMul / skipOuterLats / half-res / EDGE_BASE_BAND fatten / packing floor 0.15 / hierarchy silent-hide) | **Clean** | Host does not implement bake/LOD/perf knobs. |
| Leftover spike marker | **Fixed** | Removed `data-graph-spike="step-3"`. |
| Magic background hex | **Fixed** | Dropped `background: 0x0a0a0c`; `createPixiRenderer()` defaults to `GRAPH_BG`. |

---

## Live-only product path (verified against pivot)

```
mount blank
→ fetch("/api/graph")
→ !ok | error → console.warn + stay blank
→ empty memories → stay blank
→ placeTopology({ memories, links })  // hit/miss + settle + cache inside lib
→ layoutLoop.setGraphData(graph)      // paint only
```

| Pivot lock | Host compliance |
|------------|-----------------|
| Single URL `/graph` | Yes |
| Always GET `/api/graph` | Yes |
| Topology only → client place | Yes (`placeTopology`) |
| Continuous layout product off | Yes (paint loop only) |
| Empty / error → blank, no mock | Yes |
| No URL flags | Yes |
| Loading spinner | None (blank during fetch) |

---

## Auto-fixes applied (≥75%)

1. **Remove lab spike attr** `data-graph-spike="step-3"` (product route, not spike step).
2. **Drop redundant renderer background hex** — rely on `GRAPH_BG` default in `createPixiRenderer`.
3. **In-package relative import** for `NodeDetailDialog` (`./node-detail-dialog`).
4. **Domain barrel** `src/components/graph/index.ts` exporting `GraphCanvas` + `NodeDetailDialog`.
5. **Route import** `@/components/graph` (barrel) instead of deep canvas path.
6. **Comment clarity** — Signals = edge pulse chrome; continuous layout explicitly off in product-path docs (without introducing banned `ambientMotion` string in canvas source).

---

## Deferred / not fixed (scope or &lt;75% product change)

| Item | Why not fixed |
|------|----------------|
| Move `hitTestNode` → `lib/graph` | Pure logic isolation win, but write scope forbids `src/lib/graph/**`. |
| Spatial-index accelerated hit-test | Would be pure-perf / lib work; quality bans + scope. Host O(N) hit is fine for current sizes. |
| Live dirty / poll while mounted (C6) | Product deferred; host always full `setGraphData`. |
| Loading / empty chrome design | Pivot out of scope. |
| Add barrel to `verify-components-structure` required list | Scripts out of write scope; barrel is additive and not forbidden. |
| `verify-d3-layout` / `verify-weave-layout` runtime import failures | Pre-existing ESM extension resolution under `src/lib/graph` (out of scope). Static canvas assertions re-run via source read — all PASS. |

---

## Verification (this slice)

Static host invariants (source-level, mirror `verify-d3-layout` canvas asserts):

- no force-recipe / d3-force static import  
- dynamic `layout-loop-d3` + `createGraphPaintLoop`  
- no `ambientMotion` / `layoutEngine` / `createLayoutLoopAsync`  
- always `fetch("/api/graph")` + `placeTopology` + `setGraphData(graph)` only  
- no mock/stress product path, no URL query parsing, no `settleIfNeeded`  
- no `data-graph-spike`, no magic `0x0a0a0c`  
- relative dialog import; page uses barrel  

`npm run verify:components-structure` → ok (graph domain present).

---

## Hard bans — untouched

Host never sets maxDots / lodMul / skipOuterLats / half-res soft sprites / EDGE_BASE_BAND fatten / packing floor 0.15 / hierarchy silent-hide. No pure-perf experiments.

---

## Commit

See git commit on this worktree for the applied host + route + barrel + audit file.
