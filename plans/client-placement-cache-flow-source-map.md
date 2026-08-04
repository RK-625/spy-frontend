# Client placement-cache flow — source map

Companion to `client-placement-cache-flow.tldraw`.  
Maps the **live `/graph` install path as coded** (MVP C0–C5; **C3b progressive BFS stream deferred**).

Policy SoT: `plans/client-placement-cache.md`.  
No Falkor x/y/rank reads or writes on this path.

---

## Legend

| Shape | Meaning |
|-------|---------|
| Box | Function / module step |
| Diamond | Conditional branch |
| Note | Side path / deferred / invariant |

---

## Ordered main path (live, non-empty KB)

| # | Label | Symbol / location | Role |
|---|--------|-------------------|------|
| 0 | Mount GraphCanvas | `GraphCanvas` — `src/components/graph/graph-canvas.tsx` | Client host; RTC + Pixi + layout loop |
| 1 | Resolve query | `initialGraphFromSearch` / URLSearchParams | `stress` → stress fixture; default mock seed; `source=live` empty start; `layout=d3` / `motion=1` → engine `d3-settle` |
| 2 | createLayoutLoopAsync + Pixi mount | `createLayoutLoopAsync`, `createPixiRenderer` | Static or d3-settle engine; `layoutLoop.start()` |
| 3 | Want live? | `wantLive` | Skip fetch if `source=mock` or `stress` |
| 4 | GET /api/graph | `GET` — `src/app/api/graph/route.ts` → `listGraphTopology` | Topology only: id/name/content/impression/confidence + links. **No x/y/rank.** |
| 5 | Response ok + memories[]? | `data.ok && Array.isArray(data.memories)` | Else → mock fallback (step E1) |
| 6 | Empty memories? | `data.memories.length === 0` | Explicit live → keep empty; default → keep mock seed; **return** |
| 7 | memoryGraphToGraphDataWithMeta | `memoryGraphToGraphDataWithMeta` — `src/lib/graph/placement/from-memory-graph.ts` | Adapter entry; returns `{ graph, needsLayout, fingerprint }` |
| 7a | filterTopologyLinks | `filterTopologyLinks` | PART_OF / RELATES_TO only; endpoints in set; dedupe |
| 7b | deriveRanks | `deriveRanks` — `placement-cache.ts` | PART_OF tree ranks (child = parent+1; roots 0) |
| 7c | computeTopoFingerprint | `computeTopoFingerprint` | `algoVersion\|id:rank;…\|sorted edges` |
| 7d | loadPlacementCache | `loadPlacementCache` | localStorage `spy:graph-placement:v1` if fingerprint + algo match |
| 7e | computeBfsOrder | `computeBfsOrder` | Stable node order (**C3b progressive stream deferred** — order only) |
| 7f | seedNodePosition / cache poses | `seedNodePosition` | Per node: valid cache pose or deterministic seed xy; rank from cache or derived |
| 7g | fullCacheHit / needsLayout | `fullCacheHit = n>0 && cachedPoseCount===n`; `needsLayout = n>0 && !fullCacheHit` | **Diamond SoT** |
| 7h | recomputeIncidence | `recomputeIncidence` | childIds / parentIds / relateIds on GraphData |
| **D1** | needsLayout? | graph-canvas after adapter | **false** → hit; **true** → miss |

### Branch A — Full cache hit (`needsLayout === false`)

| # | Label | Symbol | Role |
|---|--------|--------|------|
| H1 | layoutLoop.setGraphData(graph, { settle: false }) | `LayoutLoop.setGraphData` | Paint cached poses; **no settle**; **no savePlacementCache** |
| H2 | renderOnGraphData → Pixi | `createPixiRenderer` / `setGraphData` | World bake + camera |

Hit applies for **both** static and `layout=d3` engines (code comment: skip re-settle including layout=d3).

### Branch B — Cache miss / partial (`needsLayout === true`)

| # | Label | Symbol | Role |
|---|--------|--------|------|
| M0 | Seeds already on GraphData | from adapter step 7f | No extra seed pass required |
| M1a | Engine is d3-settle? | `layoutEngine === "d3-settle"` | From `?layout=d3` or `?motion=1` |
| M1b | layoutLoop.setGraphData(graph) | d3 path default settle | One-shot `settleGraphData` inside engine → **saves cache** |
| M2 | settleIfNeeded(graph, { needsLayout: true }) | `settleIfNeeded` — `force-recipe.ts` | Static engine miss path |
| M2a | applyColdStartJitter | `applyColdStartJitter` | Tiny deterministic jitter then settle |
| M2b | settleGraphData | `settleGraphData` | d3-force one-shot ticks |
| M2c | savePlacementCache | `savePlacementCache` (inside settleGraphData when `saveCache !== false`) | Persist poses under same filtered-edge fingerprint |
| M3 | layoutLoop.setGraphData(settled) | static install | Paint settled graph |
| M4 | renderOnGraphData → Pixi | same as H2 | |

### Side paths

| Id | Label | When | Behavior |
|----|--------|------|----------|
| E0 | source=mock / stress | `!wantLive` | No fetch; fixture only |
| E1 | fetch/JSON error or `!data.ok` | catch / non-ok | `createMockGraphData()` install |
| E2 | empty memories | length 0 | Default keeps mock seed; `source=live` stays empty |
| DEF | C3b progressive BFS stream | product not implemented | `computeBfsOrder` exists; invisible-until-posed stream **deferred** |
| INV | No Falkor placement writes | always | Client localStorage only; API topology-only |

---

## Branch semantics checklist (for audit)

| Assertion | Code truth |
|-----------|------------|
| Hit does **not** call settle/save | `setGraphData(graph, { settle: false })` only |
| Miss **does** settle and save | d3: engine settle; static: `settleIfNeeded` → `settleGraphData` → `savePlacementCache` |
| No product arrow to Falkor set x/y/rank | `listGraphTopology` omits layout; toolset server settle is **out of this diagram** |
| API xy ignored | Adapter docs + no layout fields on `MemoryGraphNodeInput` |

---

## Sequence (compact)

```
GraphCanvas mount
  → createLayoutLoopAsync + Pixi
  → [wantLive?]
       no  → mock/stress only
       yes → GET /api/graph
              → [ok memories?]
                   no  → mock fallback
                   empty → keep mock | empty live
                   yes → memoryGraphToGraphDataWithMeta
                          filterTopologyLinks
                          deriveRanks
                          computeTopoFingerprint
                          loadPlacementCache
                          computeBfsOrder
                          seedNodePosition | cache poses
                          recomputeIncidence
                          needsLayout = !fullCacheHit
                          → [needsLayout?]
                               false → setGraphData(settle:false) → paint
                               true  → [layoutEngine d3-settle?]
                                         yes → setGraphData() → settleGraphData+save → paint
                                         no  → settleIfNeeded → settleGraphData+save
                                               → setGraphData(settled) → paint
```
