# Comprehensive Audit: `src/lib/graph/**` Pure Logic

**Audit Date:** August 8, 2026  
**Auditor Mode:** LEAF (Direct Inspection)  
**Target Domain:** `src/lib/graph/**` (Graph Pure Logic & Canvas Engine)  
**Output Path:** `.grok/audit/wave2/agy-graph-lib.md`  

---

## 1. Executive Summary

A comprehensive, line-by-line audit of `src/lib/graph/**` was conducted against the repository specifications in `AGENTS.md` and `.grok/rules/code-preferences.md`. The domain comprises 20 TypeScript files organized across 6 subdirectories (`camera/`, `core/`, `fixtures/`, `layout/`, `placement/`, `render/`) plus the top-level barrel (`index.ts`).

### Overall Status Matrix

| Audit Axis | Status | Key Observation / Deficiency |
| :--- | :---: | :--- |
| **Dead FA2 / Graphology Leftovers** | **PASS** | 0 FA2/Graphology imports or runtime code. 1 residual JSDoc comment in `rtc-camera.ts`. |
| **Fixtures Product Leak** | ❌ **FAIL** | Main public barrel `@/lib/graph` (`src/lib/graph/index.ts`) re-exports mock/stress fixtures. |
| **Barrel Pollution & Export Hygiene** | ❌ **FAIL** | Main barrel flattens 88+ internal symbols; `render/` (7 files) lacks a sub-domain barrel (`index.ts`). |
| **Placement & Cache Architecture** | ⚠️ **SMELL** | `placeTopology` flow is solid; `rim-lock.ts` has an O(E) array `.find()` in loop. |
| **TypeScript Strictness (`any` ban)** | ⚠️ **SMELL** | 0 `any` types in TS code (100% clean); however, `bake-sample.ts` uses `as never` type coercions. |
| **Quality Bans Compliance** | **PASS** | All strict bans (no `maxDots`, no half-res, `EDGE_BASE_BAND` 2.268, no 0.15 floor, RTC camera) intact. |
| **Subdirectory & Isolation Rules** | ❌ **FAIL** | Sub-directories lack `index.ts` public interface barrels; `render/` exceeds 5-file rule without barrel. |

---

## 2. Itemized Findings by Category

### Category A: Dead FA2 / Graphology Leftovers

* **Runtime Code Scan:** Grep search across `src/` confirmed zero imports of `graphology`, `forceatlas2`, or `layout-loop-fa2`.
* **Leftover Artifact:**
  * [`src/lib/graph/camera/rtc-camera.ts:L5`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/graph/camera/rtc-camera.ts#L5): Comment references legacy clusters: `* when cam and content sit far from the origin (e.g. FA2 clusters at 1e17).`
* **Assessment:** PASS. Dead code is completely removed. Only 1 doc comment needs minor cleanup.

---

### Category B: Fixtures Product Leak & Test Artifacts

* **Barrel Leak in `@/lib/graph`:**
  * [`src/lib/graph/index.ts:L30-L36`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/graph/index.ts#L30-L36):
    ```ts
    // --- Fixtures (mock / stress; not live DB) --------------------------------
    export {
      createMockGraphData,
      createLargeStressGraphData,
      HUB_SPOKE_COUNT,
      type LargeStressFixtureOptions,
    } from "./fixtures/mock-graph";
    ```
  * **Violation:** `AGENTS.md` explicitly dictates that mock/stress fixtures live under `src/lib/graph/fixtures/` for verify scripts and test suites only and must not pollute product surfaces. Exporting them from the root barrel exposes them on the primary domain API.
* **Outdated Fixture Comments:**
  * [`src/lib/graph/fixtures/mock-graph.ts:L200`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/graph/fixtures/mock-graph.ts#L200): JSDoc mentions `opt in via query (host wiring)`, referencing deprecated URL query flags (`?stress`).
* **Assessment:** FAIL. Fixture creators must be removed from `src/lib/graph/index.ts` so callers import `@/lib/graph/fixtures/mock-graph` directly in verify scripts.

---

### Category C: Barrel Pollution & Export Hygiene

* **Over-broad Root Export Surface:**
  * [`src/lib/graph/index.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/graph/index.ts) re-exports 88+ internal constants, scale formulas, layout helpers, and render internals (e.g., `EDGE_COLS_FIRM`, `DOT_RADIUS_FRAC`, `EdgeScreenPoint`, `DotEmit`, `applyRimLockForNodes`, `packCellKey`, `diffGraphDirty`).
  * `AGENTS.md` states: *"Inside a package use relative imports (never that package barrel — avoids cycles)."*
* **Missing Sub-Domain Barrels (`code-preferences.md` Rule 7):**
  * `code-preferences.md` Rule 7 requires: *"Any module or domain directory containing 5 or more files MUST be physically organized into subdirectories by responsibility... maintaining a top-level index.ts barrel export for clean `@/` domain imports."*
  * `src/lib/graph/render/` contains **7 files** (`pixi-renderer.ts`, `bake-worker.ts`, `bake-worker-pool.ts`, `bake-sample.ts`, `dot-circle-batch.ts`, `draw-arrow.ts`, `edge-signal-pulse.ts`) but has **no `index.ts` barrel**.
  * `src/lib/graph/core/` (4 files), `src/lib/graph/placement/` (3 files), `src/lib/graph/layout/` (3 files), `src/lib/graph/camera/` (1 file) also lack sub-domain barrels.
* **Import Path Extension Inconsistencies:**
  * Explicit `.ts` extensions are used in relative imports across 3 files:
    * [`src/lib/graph/core/graph-diff.ts:L9`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/graph/core/graph-diff.ts#L9): `import type { GraphData, GraphEdge } from "./graph-data.ts";`
    * [`src/lib/graph/layout/spatial-index.ts:L11`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/graph/layout/spatial-index.ts#L11): `import type { GraphData, GraphEdge, GraphNode } from "../core/graph-data.ts";`
    * [`src/lib/graph/render/edge-signal-pulse.ts:L11`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/graph/render/edge-signal-pulse.ts#L11): `import type { GraphEdge, GraphLinkType, GraphNode } from "../core/graph-data.ts";`
  * All other files omit `.ts` in relative module specifiers (e.g., `import { ... } from "../core/graph-data"`).
* **Assessment:** FAIL. Need sub-domain barrels and cleanup of root barrel pollution & `.ts` import extensions.

---

### Category D: Placement Architecture & Cache Smells

* **Product Placement Architecture (`placeTopology`):**
  * [`src/lib/graph/placement/place-topology.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/graph/placement/place-topology.ts): Clean implementation of hit/miss semantics.
    * **Hit:** Loads cached `{x,y}` poses from `localStorage`; re-derives ranks via `deriveRanks`.
    * **Miss:** Assembles nodes at `(0,0)`, executes pure `settleGraphData`, saves `{x,y}` to `localStorage`, and returns.
  * Fingerprint logic (`computeTopoFingerprint` in `placement-cache.ts`): Uses deterministic `algoVersion|nodesWithRanks|sortedLinks` format.
* **Storage Guarding (`placement-cache.ts`):**
  * `loadPlacementCache` and `savePlacementCache` correctly check `typeof window === "undefined"` for SSR safety and catch `QuotaExceededError` gracefully.
* **Performance Smell in `rim-lock.ts`:**
  * [`src/lib/graph/layout/rim-lock.ts:L148`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/graph/layout/rim-lock.ts#L148):
    ```ts
    const edge = graph.edges.find((e) => e.id === edgeId);
    ```
    Inside `rimLockNodesForMoves`, an O(E) array search (`graph.edges.find`) is executed in a loop for every incident edge ID. A pre-constructed `edgesById` Map should be used instead.
* **Assessment:** PASS with 1 minor performance smell (`rim-lock.ts` array `.find()`).

---

### Category E: TypeScript Strictness & Type Safety

* **`any` Type Ban (`code-preferences.md` Rule 8):**
  * **Status:** 100% CLEAN. Grep search confirmed zero occurrences of TypeScript `any` in code. (All matches were in English comments).
* **Type Coercion Smell (`as never` in `bake-sample.ts`):**
  * [`src/lib/graph/render/bake-sample.ts:L231-L238`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/graph/render/bake-sample.ts#L231-L238):
    ```ts
    const dummyEdge = { type: isPartOf ? "PART_OF" : "RELATES" } as const;
    const dummySrc = { rank: srcRank } as const;
    const dummyTgt = { rank: tgtRank } as const;

    const endpoints = pulseEndpoints(
      dummyEdge as never,
      { x: srcX, y: srcY } as never,
      { x: tgtX, y: tgtY } as never
    );
    const radii = pulseEndpointRadii(
      dummyEdge as never,
      dummySrc as never,
      dummyTgt as never
    );
    ```
  * `as never` is an unsafe cast used to pass partial dummy objects to functions expecting full `GraphEdge` / `GraphNode` types.
* **Unused Variable in `bake-sample.ts`:**
  * [`src/lib/graph/render/bake-sample.ts:L235`](file:///Users/apple/Development/Spy/spy-frontend/src/lib/graph/render/bake-sample.ts#L235): `const radii` is computed via `pulseEndpointRadii` but is **never read or used** anywhere in `sampleGraphEdgeDotsCooperative`.
* **Assessment:** SMELL (`as never` casts & dead variable in `bake-sample.ts`).

---

### Category F: Quality Bans Compliance

The code was checked against all non-negotiable quality bans listed in `AGENTS.md`:

| Quality Ban Criterion | Code Verification | Compliance |
| :--- | :--- | :---: |
| **No `maxDots`, `lodMul`, `skipOuterLats`** | Verified zero LOD thinning params in `graph-scale.ts` or `draw-arrow.ts`. | ✅ **PASS** |
| **No half-res soft sprites** | `DotCircleBatch` uses GPU triangle-mesh circles & GlProgram SDF discs. | ✅ **PASS** |
| **No `EDGE_BASE_BAND` fattening** | `EDGE_BASE_BAND = 2.268` in `graph-scale.ts`; pure linear scaling. | ✅ **PASS** |
| **No packing floor `0.15` (keep `1e-6`)** | `localR` in `draw-arrow.ts:L282` uses `Math.max(1e-6, ...)` floor. | ✅ **PASS** |
| **No hierarchy silent-hide as "perf"** | All nodes/edges in overscan are rendered without rank hiding. | ✅ **PASS** |
| **`ambientMotion` default off** | Product uses single-shot `settleGraphData`; layout paint loop does not simulate. | ✅ **PASS** |
| **No `stage.scale` world camera** | `RtcCamera` projects points; `pixi-renderer.ts` scales `graphContent` container only. | ✅ **PASS** |

---

## 3. Recommended Remediation Plan

1. **Clean Root Barrel (`src/lib/graph/index.ts`):**
   * Remove fixture re-exports (`createMockGraphData`, `createLargeStressGraphData`, `HUB_SPOKE_COUNT`, `LargeStressFixtureOptions`).
   * Keep only public domain entry points (`GraphData`, `placeTopology`, `RtcCamera`, `createPixiRenderer`, etc.).

2. **Add Sub-Domain Barrels:**
   * Create `src/lib/graph/render/index.ts` to satisfy `code-preferences.md` Rule 7 (5+ files rule).
   * Create barrels for `core/`, `placement/`, `layout/`, `camera/`, `fixtures/`.

3. **Fix Type Safety & Unused Code in `bake-sample.ts`:**
   * Remove `const radii` dead assignment.
   * Refactor `pulseEndpoints` / helper parameters or create clean helper functions so `as never` casts can be eliminated.

4. **Optimize `rim-lock.ts`:**
   * Replace `graph.edges.find((e) => e.id === edgeId)` in `rimLockNodesForMoves` with `edgesById.get(edgeId)`.

5. **Normalize Import Extensions:**
   * Remove explicit `.ts` extensions in `graph-diff.ts`, `spatial-index.ts`, and `edge-signal-pulse.ts`.
