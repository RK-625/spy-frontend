# Client placement cache — topology in Falkor, pose in the browser

**Status:** **Implemented (MVP)** — C0–C5 product path shipped; **C3b progressive BFS growth deferred**.  
**Date:** 2026-07-29 (grill) · MVP closed 2026-07-30  
**Depends on:** `plans/d3-force-placement-slices.md` S0–S8 (force-recipe, live `/api/graph`, FA2/fan gone).  
**Supersedes for placement policy:**  
- `plans/hybrid-placement-cache-dirty.md` (server P-A create-always-place / dirty persist) — **void as product direction**  
- Deferred-create F1/F10 null-xy + cold upsert settle as happy path  
- Durable Falkor `x` / `y` / `rank` as placement SoT  

**One-line goal:** Falkor holds **knowledge + topology only**. d3 computes `x`/`y` (and rank) **in the client** at render/weave time. Poses live in **browser cache** (memory + `localStorage`), never in app DB.

### MVP shipped vs deferred

| Slice | Status |
|-------|--------|
| C0 Docs lock | Done |
| C1 Strip server placement writes (toolset) | Done |
| C2 Rank + fingerprint + localStorage | Done (`placement-cache.ts`, `verify:placement-cache`) |
| C3 Progressive BFS place + seeds | **MVP:** deterministic seeds + one-shot `settleGraphData` + cache save; cache hit paints without settle. **`computeBfsOrder` wired for node order.** |
| **C3b** Progressive stream (invisible-until-posed growth animation) | **Deferred** — not required for stable reopen |
| C4 `/api/graph` lean payload (no xy/rank) | Done |
| C5 Cleanup (no product setMemoryPlacement / settleAndPersist) | Done |
| C6 Live dirty while mounted | Later |
| C7 PART_OF reparent replace | Later |

---

## Intent (what you meant — confirmed)

| Layer | Holds |
|-------|--------|
| **Falkor (app data)** | Memory content, embeddings, confidence, impression, **links only** — **no** layout coordinates |
| **d3 (compute)** | Produces world `x`/`y` from topology (+ derived rank); not a DB writer |
| **Client cache** | Last computed poses + topo fingerprint; `localStorage` per origin + in-memory for session |
| **Cost** | Paid on **fingerprint miss** (first open / topology change / cleared storage), not on every pan/zoom |

Leaner server: **delete** product-path settle/persist for placement. Cleaner model: map is a **view**, not durable knowledge.

---

## Product locks

| Lock | Decision |
|------|----------|
| Structural SoT | Memory fields (no xy/rank) + `PART_OF` / `RELATES_TO` links |
| Placement engine | Client d3 (`force-recipe` / progressive wrapper) |
| Placement storage | **Client only** — memory + `localStorage`; **never Falkor** |
| Map stability | **Best-effort per browser profile**; multi-device / cleared data may reshuffle — **accepted** (map is a view) |
| Rank | **Not stored in Falkor**; derived on client from PART_OF tree |
| PART_OF shape | **Tree:** one child → at most one parent (LLM + app-level enforce) |
| Visual size | Still `nodeScreenRadius(rank, …)` using **client-derived** rank |
| LLM | Never authors x/y/rank |
| Continuous ambient | Off by default (`?motion=1` only) |
| Quality bans | Unchanged |
| Live multi-surface | **v1:** no live patch; reopen/refetch `/graph` uses fingerprint |
| Progressive first paint | **C3b deferred** — MVP: one-shot settle paints all nodes; warm open = full cache paint |
| Not-yet-posed nodes | **C3b deferred** — MVP paints all seeded/settled nodes immediately (no invisible stream) |
| Seeds | **Deterministic from node id** for stable-ish cold opens |
| Cache key | `topoFingerprint = hash(nodeIds + edges + derived ranks)` (+ optional `placementAlgoVersion`) |
| Cache scope | **Per origin** (single-user local app) |
| BFS root | Max **total degree** (PART_OF + RELATES); empty graph no-op |
| Server settle/persist | **Removed from product path** |

---

## Architecture

```text
┌─────────────────────────────────────────┐
│ Falkor                                   │
│  :Memory  id, name, content, embeddings, │
│           impression, confidence         │
│  NO x, y, rank                           │
│  Links PART_OF | RELATES_TO              │
│  App rule: ≤1 PART_OF out-edge / child   │
└─────────────────────────────────────────┘
                    │
                    ▼
            GET /api/graph   (topology only)
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Client GraphCanvas / layout host         │
│  1. fingerprint topology                 │
│  2. localStorage hit? → paint cache      │
│  3. miss? derive ranks → BFS order       │
│     → progressive d3 / park              │
│     → reveal nodes as posed              │
│     → write cache                        │
└─────────────────────────────────────────┘
```

### Cache shape (illustrative)

```ts
// localStorage key e.g. spy:graph-placement:v1
type PlacementCacheFile = {
  algoVersion: number;
  fingerprint: string;
  /** world poses */
  nodes: Record<string, { x: number; y: number; rank: number }>;
};
```

On hit (same fingerprint + algoVersion): skip d3, paint.  
On miss: progressive place, then overwrite cache entry.

---

## Progressive place-on-the-go (v1)

1. **Fetch** topology (no xy).  
2. **Derive rank** (PART_OF tree, single parent): root rank 0, child = parent.rank + 1; cycle guard.  
3. **Pick BFS root:** node with maximum degree over all edge types; ties → stable min(id).  
4. **BFS order** for introduction stream (growth narrative).  
5. For each node in order (or small batches):  
   - seed `x,y` from **hash(id)** (deterministic)  
   - short settle with **already-posed nodes pinned** (optional incremental) **or** batch settle then lerp — implement simplest that still streams reveals  
   - mark posed → **visible** to renderer  
6. When stream completes → write `localStorage` with fingerprint.

**Not-yet-posed:** do not draw node (and prefer not to draw edges until both ends posed).

**Pan/zoom:** never re-settle; camera only (existing RTC path).

---

## Server / toolset after pivot

| Today | After |
|-------|--------|
| Create: rank 0, xy null, no settle | Create: content + embeddings only |
| Update cold settle | **Never** settle on server |
| linkMemories settle + setMemoryPlacement | Create link only; optional **reject** second PART_OF parent |
| `setMemoryPlacement` / settleAndPersist product | **Delete or dead-code remove** from product path |
| Memory schema x,y,rank | **Strip** from Zod + Cypher writes/reads over slices |
| `/api/graph` may return x,y,rank | Topology only (name, content, … for inspect) |

Client owns all pose; force-recipe stays as **client** dependency (already used from graph-canvas path).

---

## PART_OF tree enforcement (v1 app-level)

1. **System prompt:** one hierarchical parent per child; reparent = replace, don’t stack.  
2. **`linkMemories` PART_OF:** if source already has a PART_OF out-edge to another target, **reject** or **replace** (pick **reject** for v1 simplicity unless reparent UX is required — **default: reject with clear error**; reparent slice later).  
3. **No Falkor unique constraint required for v1.**  
4. Client rank derivation assumes forest of arborescences; multi-parent → treat as data bug (fallback rank 0 or first edge only — document).

---

## Slice plan

### C0 — Docs lock

| | |
|--|--|
| **Touch** | This file status, `hybrid-placement-cache-dirty.md` supersession banner, optional AGENTS “What's left”, banner on historical D3 root plan |
| **Exit** | Agents do not implement server H1 create-persist |

### C1 — Strip server placement writes

| | |
|--|--|
| **Touch** | `toolset.ts`, `memory-layout-settle.ts` (stop product calls), `falkor.ts` upsert (no rank/xy on create), `graph-schema.ts` (mark xy/rank removed or optional-ignored) |
| **Work** | upsertMemory: content only; linkMemories: edge only + PART_OF single-parent guard; remove settleAndPersist from tools |
| **Exit** | `rg settleAndPersistMemoryPlacements` clean in toolset; create does not write x/y/rank; verify scripts updated |

### C2 — Client rank + fingerprint + localStorage cache

| | |
|--|--|
| **Touch** | new `src/lib/graph/placement-cache.ts` (or similar), `from-memory-graph.ts` / graph-canvas load path |
| **Work** | `deriveRanks(graph)`, `topoFingerprint`, load/save localStorage per origin, algoVersion constant |
| **Exit** | Unit/verify: same topology → same fingerprint; ranks match hand tree |

### C3 — Progressive BFS place + deterministic seeds

| | |
|--|--|
| **Touch** | graph-canvas or layout helper, force-recipe usage, reveal flags |
| **Work** | BFS from max-degree root; hash seeds; invisible until posed; pin already posed if incremental; write cache on complete |
| **Exit** | Manual: cold open grows; second open instant paint from cache; clear storage → re-grow similar (seeds) |
| **MVP (shipped)** | Cache hit → paint; miss → `seedNodePosition` + one-shot settle + `savePlacementCache`. BFS order applied to node list. No growth animation. |
| **C3b (deferred)** | Progressive reveal stream; not-yet-posed invisible; optional incremental pin already-posed |

### C4 — `/api/graph` + adapter lean payload

| | |
|--|--|
| **Touch** | `listGraphTopology`, api route, types |
| **Work** | Stop returning x/y/rank (or ignore if legacy rows exist) |
| **Exit** | Payload has no layout fields; inspect fields remain |

### C5 — Cleanup

| | |
|--|--|
| **Touch** | memory-placement policy for server place, deprecated setMemoryPlacement aliases, verify-weave-layout F1/F10 asserts, hybrid plan archived |
| **Work** | Remove dead server settle product path; keep force-recipe; optional delete obsolete settle-persist if unused |
| **Exit** | `rg setMemoryPlacement` only deprecated or gone; AGENTS describes client cache model |

### C6 — (Later) Live dirty while /graph mounted

Optional: tool results → fingerprint miss → progressive dirty only. **Not v1** (grill: simplest = no live).

### C7 — (Later) Reparent PART_OF replace semantics

If reject-only is too harsh.

---

## Exact direction vs old H1 (contrast)

| | Old hybrid H1 | **This program (locked)** |
|--|---------------|---------------------------|
| Create | settle + **write xy to Falkor** | **no** xy/rank in Falkor |
| Content update | no settle if placed | n/a server placement |
| Cache | DB | **localStorage + memory** |
| Multi-device same map | yes | **no (accepted)** |
| First open cost | server | **client progressive** |
| Rank | server | **client from PART_OF** |

---

## Non-goals (v1)

- Server P-A durable poses  
- Multi-device layout sync  
- Live chat→graph patch  
- Continuous ambient default  
- Full KB viewport residency  
- Falkor-native PART_OF uniqueness constraints  
- Growth animation polish beyond invisible→posed stream  

---

## Risks (accepted or mitigated)

| Risk | Mitigation |
|------|------------|
| localStorage quota / huge graphs | Fingerprint + poses only; later compress or cap; stress mode may skip persist |
| Main-thread settle jank | Progressive batches; later worker (out of v1 unless needed) |
| Multi-parent bad data | App reject + LLM; client fallback |
| “My map moved” after clear data | Accepted view semantics; deterministic seeds reduce shock |
| Mock/stress fixtures | Client still places; fixtures may ship without xy |

---

## Verification

| Gate | When |
|------|------|
| `verify:d3-force-recipe` | C3+ |
| New `verify:placement-cache` (fingerprint, ranks, single-parent) | C2 |
| `verify:weave-layout` rewritten for no server settle | C1/C5 |
| Manual cold open growth + warm open cache hit | C3 |
| Manual PART_OF second parent rejected | C1 |

---

## Success definition

1. Falkor Memory rows have **no** product dependency on `x`/`y`/`rank`. ✅  
2. Tools never call placement settle/persist. ✅  
3. `/graph` cold open one-shot places via seeds + d3 and writes **localStorage**; warm open reads cache. ✅ MVP (progressive growth = C3b).  
4. Topology change changes fingerprint → re-place; pan/zoom does not. ✅  
5. Codebase is **leaner**: one client placement path, no dual server/client pose authority. ✅

---

## Grill session decisions log

| Topic | Decision |
|-------|----------|
| SoT for live pose | Client cache only |
| Multi-device reshuffle | Acceptable (map is view) |
| Invalidation | topoFingerprint (+ algoVersion) |
| Rank storage | Strip from Falkor; client derive |
| PART_OF | One parent per child; app-level + LLM |
| Progressive order | Derive ranks → BFS from max total degree |
| Not-yet-posed | Invisible |
| Live weave → graph | v1 no live; refetch on open |
| localStorage scope | Per origin |
| Seeds | Deterministic from node id |
| Server settle path | Delete from product |
| Old hybrid H1 | Superseded / void |
