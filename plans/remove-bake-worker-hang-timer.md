# Renderer dead-surface cleanup — Claims 1–6

**Status:** Claims **1–4 DONE** (implemented). Claims **5–6** still **DISCUSSION ONLY** (withheld).

**Scope:** `src/lib/graph/render/*` product-minimal dead surface (code-preferences: no speculative dual paths / unused exports).

---

## DONE — Claims 1–4

| # | Claim | Status | What shipped |
|---|---|---|---|
| **1** | Hang timer `BAKE_WORKER_HANG_MS` / `armBakeHangTimer` | **DONE** | Removed timer + arm/clear. Keep native ESM worker + `worker.onerror` → release → sync forever. Fence in `verify-d3-force-recipe`. |
| **2** | `applyBakeResult` dead `_dotCount` | **DONE** | Signature is `(dots, ranges, cullAabb, overscan)`. Worker/sample `dotCount` fields kept on transport types. |
| **3** | `bakeAll` / `cullAabb === null` dual path | **DONE** | `buildSamplePayload(cullAabb: WorldAabb)` always overscan candidates; apply/upload/replace take non-null AABB; `BakeSamplePayload.cullAabb` non-null. |
| **4** | `insetSegment` verify-only | **DONE** | Deleted from `draw-arrow.ts`, barrel, and `verify-node-size` assert. |

### Files touched (1–4)

- `src/lib/graph/render/pixi-renderer.ts`
- `src/lib/graph/render/bake-sample.ts`
- `src/lib/graph/render/draw-arrow.ts`
- `src/lib/graph/index.ts`
- `scripts/verify-d3-force-recipe.mjs` (resurrection fences)
- `scripts/verify-node-size.mjs`

### Product behavior

Unchanged on the healthy path: overscan residency, worker bake, `onerror` → sync, DotStream + nodes + signals.

---

## OPEN — Claim 5 (withheld — perf, not dead code)

**Status:** DISCUSSION ONLY — **do not implement in a dead-code pass.**

**Scope:** Signal-wave path in `uploadEdgesFromMergedBuffer` + `edge-signal-pulse.ts`.

### Independent review note

The original audit overstated cost as “per-dot geometry.” Live loop already hoists style/length/radii/`pulseProgress` **outside** the per-dot loop (O(edges) + O(dots) for `modulateDotAppearance` only). Residual wins are optional: cache style/phase basis across frames, avoid per-edge style object alloc. **Severity: micro-opt on small KB; not a bug.**

### Optional later fix (if measured)

Cache per-edge wave fields on `mergedEdgeLayout` at bake time; frame loop only `modulateDotAppearance`.

### Relevant code

- `pixi-renderer.ts` — wave upload loops
- `edge-signal-pulse.ts` — `waveStyleForType`, `pulseProgress`, `modulateDotAppearance`
- `graph-style.ts` — `GRAPH_PULSE_UPLOAD_INTERVAL_MS`

---

## OPEN — Claim 6 (withheld — architecture, not cleanup)

**Status:** DISCUSSION ONLY — **no code change from this claim.**

### The claim

Renderer machinery (overscan, worker, spatial index, durable buffer, tiles, signals) targets full-KB residency. Today `GET /api/graph` returns **full topology** with **no server viewport slices**. Machinery is **ahead of product scale**, not dead.

### Decision (locked)

| Choice | Action |
|---|---|
| **(a) Keep machinery** | Target arch for full-KB residency; only strip dead surface (1–4) |
| **(b) Server viewport slices** | Separate **product track** (AGENTS.md What’s left) — not a cleanup PR |

**Recommendation:** **(a)** for cleanup; **(b)** later as product work.

### Relevant code

- `pixi-renderer.ts` header / overscan / worker
- `graph-canvas.tsx` — full `GET /api/graph`
- `api/graph/route.ts` — topology only, no slice params
- `AGENTS.md` — full-KB residency still open

---

## Summary table

| Claim | Category | Status |
|---|---|---|
| 1 Hang timer | Dead code | **DONE** |
| 2 `_dotCount` | Dead code | **DONE** |
| 3 `bakeAll` / null cull | Dead code | **DONE** |
| 4 `insetSegment` | Dead code | **DONE** |
| 5 Signal-wave cache | Perf | **OPEN (withhold)** |
| 6 Machinery vs product scale | Architecture | **OPEN (withhold)** |

**Bottom line:** 1–4 shipped. 5 optional measured perf later. 6 stays product-track framing only.
