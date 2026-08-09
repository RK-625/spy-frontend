# Wave 2 — native graph lib audit (`src/lib/graph/**`)

**Agent:** leaf implementer (lib/graph pure logic)  
**Mode:** Audit → auto-fix ≥75% only  
**Scope:** `src/lib/graph/**` only (no React host, no scripts, no dep bumps)  
**Date:** 2026-08-08

---

## Summary

| Area | Verdict |
|------|---------|
| Dead FA2 / graphology code | **Clean** — only a historical FA2 *comment* (fixed) |
| Ambient continuous *layout* API | **Clean** — paint store has no settle/ambient; `stop()` is no-op |
| Dual exports / barrel pollution | **Fixed** fixture re-exports; residual style/scale surface noted |
| Mock fixtures on product surface | **Fixed** — removed from `@/lib/graph` barrel |
| Dead layout engines | **Clean** — no `layout-loop.ts` / sim / FA2; settle only in `force-recipe` |
| Placement cache | **Healthy** — xy-only cache; ranks re-derived; settle pure |
| Server xy/rank writes | **None** in this package |
| Quality bans | **Intact** (packing floor `1e-6`, no lodMul/maxDots/half-res) |
| `any` types | **None** (word “any” only in comments) |
| Naming / 5+ file dirs | **Deferred** — `render/` (7 files), `layout-loop-d3` filename legacy |

**Auto-fixed:** 4 high-confidence items.  
**Deferred:** structural reorg + rename requiring host/script coordination.  
**Verify:** graph-related scripts green except pre-existing out-of-scope `verify:weave-layout` toolset assertion.

---

## Hunt findings

### 1. Dead FA2 / graphology remnants

| Location | Finding | Action |
|----------|---------|--------|
| `camera/rtc-camera.ts` | Comment: “e.g. FA2 clusters at 1e17” | **Fixed** → “large world spreads” |
| Entire package | No `graphology`, `forceAtlas`, FA2 imports or APIs | None |

Confidence: 100%.

### 2. Ambient continuous paths

| Surface | Status |
|---------|--------|
| `layout/layout-loop-d3.ts` | Paint-only store. No `ambientMotion`, `step()`, settle option, or d3-force import. `stop()` no-op. |
| `placement/force-recipe.ts` | One-shot `settleGraphData` only — comment explicit “not continuous ambient motion”. |
| “ambient” in style / pulse / pixi | **Product visual** (edge signal wave), not layout ambient. Keep. |

No product-dead continuous-layout API left to strip. Header comment on paint loop clarified (filename legacy).

### 3. Dual exports / barrel pollution

| Item | Severity | Action |
|------|----------|--------|
| Fixtures re-exported from product barrel | High — contradicts live-only / verify-only policy | **Removed** |
| Force settle / `deriveRanks` / placement-cache knobs | Correctly **not** on barrel (subpath only) | Keep |
| `diffGraphDirty` + hub expand on barrel | Product host uses full `setGraphData`; lib kept for C6 / verify | Keep (intentional) |
| Full `graph-style` + `graph-scale` token dumps on barrel | Broad; host uses few symbols | Defer shrink (low risk / high churn) |
| Wire types re-export (`GraphApiResponse`, `MemoryNode`) | Convenience dual path vs `@/types/graph-topology` | Keep (client-safe SoT mirror) |
| `ScreenPoint` vs `EdgeScreenPoint` alias | Deliberate dual name on barrel | Keep |

### 4. Mock fixtures vs product export surface

- **Before:** `@/lib/graph` exported `createMockGraphData`, `createLargeStressGraphData`, `HUB_SPOKE_COUNT`, `LargeStressFixtureOptions`.
- **After:** fixtures live only under `fixtures/mock-graph.ts`; verify scripts already deep-import that path.
- Product host (`graph-canvas`) already has zero mock imports (asserted by `verify:d3-layout`).
- `createLargeStressGraphData` had **no** script consumers — still kept in fixtures for stress labs.

### 5. Dead layout engines / placement cache smell

| Check | Result |
|-------|--------|
| `layout-loop.ts` thin wrapper | Deleted (verify fences) |
| Static sim / `createLayoutLoopAsync` / `settleIfNeeded` | Gone |
| `placeTopology` owns hit/miss + settle + cache | Correct |
| `CachedPlacementNode` | `{ x, y }` only — ranks never stored |
| `settleGraphData` purity | No localStorage (force-recipe) |
| Miss path | Origin assemble → settle → save poses |
| Rank | Always `deriveRanks` on assemble |

No placement-cache smell requiring fix.

### 6. Naming symmetry / directory structure

| Issue | Notes | Decision |
|-------|-------|----------|
| `layout-loop-d3.ts` | Filename says d3; module imports **no** d3-force (settle is placement) | **Deferred** — host + many verify scripts hardcode path; host edits out of scope |
| `LayoutLoopHandle` / `LayoutLoopOptions` vs `createGraphPaintLoop` | Type prefix lags function rename | Deferred (same coupling) |
| `render/` has **7** files | code-preferences: 5+ → responsibility subdirs | **Deferred** — worker `new URL("./bake-worker.ts")` + deep imports; large blast radius |
| Suggested render split | `bake/` (sample, worker, pool), draw primitives, `pixi-renderer` at render root | Future explicit reorg task |
| Other dirs | core 4, layout 3, placement 3 — under threshold | OK |
| Subdir barrels missing | Top-level `index.ts` is public surface; deep paths for verify | Acceptable |

### 7. Server xy / rank leftovers

None in `src/lib/graph/**`. Placement is client localStorage only. Ranks client-derived. No Falkor write paths here.

### 8. Quality bans (spot-check)

| Ban | Status |
|-----|--------|
| packing floor 0.15 | Replaced by `1e-6` in `draw-arrow` (comment documents ban) |
| lodMul / maxDots / skipOuterLats | Absent; comments reaffirm |
| half-res soft sprites | Absent |
| EDGE_BASE_BAND fatten for perf | Token is design SoT only |
| hierarchy silent-hide | Not present |

No pure-perf hacks introduced or reopened.

### 9. Import hygiene

Three modules used explicit `.ts` suffix imports (`graph-diff`, `spatial-index`, `edge-signal-pulse`); rest did not. **Normalized** to extensionless for package symmetry.

---

## Auto-fixes applied (confidence ≥75%)

1. **Remove fixtures from product barrel** (`index.ts`) — confidence **95%**  
2. **FA2 comment cleanup** (`rtc-camera.ts`) — confidence **100%**  
3. **Normalize `.ts` import suffixes** (3 files) — confidence **90%**  
4. **Clarify paint-loop header** (`layout-loop-d3.ts`) — confidence **90%**  
5. **Fixtures module header** — deep-import only, not barrel — confidence **95%**

## Explicitly not changed

- No quality-ban / pure-perf changes  
- No `render/` physical reorg  
- No `layout-loop-d3` file rename (host + verify path coupling)  
- No barrel trim of style/scale tokens (product unused but low harm)  
- No deletion of `graph-diff` (C6 / verify residual)  
- No dep bumps / force-push  

---

## Package map (post-audit)

```
src/lib/graph/
├── index.ts                 — product barrel (no fixtures)
├── camera/rtc-camera.ts
├── core/                    — graph-data, graph-diff, graph-scale, graph-style
├── fixtures/mock-graph.ts   — verify/labs only (deep import)
├── layout/                  — layout-loop-d3 (paint), rim-lock, spatial-index
├── placement/               — place-topology, placement-cache, force-recipe
└── render/                  — pixi-renderer, bake-*, draw-arrow, dot-circle-batch, edge-signal-pulse
```

**Product path:** `placeTopology` → paint loop `setGraphData` → Pixi (dynamic layout import).  
**Settle path:** cache miss only via `settleGraphData` (pure) → `savePlacementCache`.

---

## Verification

| Script | Result |
|--------|--------|
| `verify:d3-layout` | pass |
| `verify:d3-force-recipe` | pass |
| `verify:mock-layout` | pass |
| `verify:hierarchy` | pass |
| `verify:rtc-camera` | pass |
| `verify:placement-cache` | pass |
| `verify:node-size` | pass |
| `verify:weave-layout` | **1 fail** — `tools/toolset.ts exports const toolSet` (out of scope; not graph lib) |

---

## Follow-ups (optional, out of this leaf)

1. Rename `layout-loop-d3.ts` → `graph-paint-loop.ts` + update host dynamic import + verify path fences.  
2. Split `render/` into `bake/` + draw primitives (≥5-file rule).  
3. Optionally slim barrel style/scale exports to product-used surface only.  
4. Add verify fence: product barrel must not re-export fixture symbols.  
5. Fix out-of-scope `toolset` assertion in weave-layout separately.

---

## Commit

Changes under `src/lib/graph/**` + this report; committed by native leaf agent.
