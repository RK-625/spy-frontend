# Graph live-only pivot (locked grill 2026-07-31)

## Product path

| Decision | Lock |
|---|---|
| URL | Single `/graph` — **no** `?stress`, `?source`, `?layout`, `?motion` |
| Data | Always `GET /api/graph` → topology only |
| Wire shape | `memories[]` + `links[]` (id/name/content/impression/confidence; **no** embeddings, **no** x/y/rank) |
| Mapping | **Client only** — `memoryGraphToGraphDataWithMeta` → `GraphData` |
| Placement | Client localStorage fingerprint cache; miss → one-shot d3 settle + save |
| Layout engine | Always `createLayoutLoopAsync({ layoutEngine: "d3-settle", ambientMotion: false })` |
| Cache hit | `setGraphData(graph, { settle: false })` |
| Cache miss | `setGraphData(graph)` (engine settles once) |
| Static engine | **Not used** on product path (leave impl for later / verify) |
| Ambient | **Off** product forever for now |
| Dirty host | Unplug: always full `renderer.setGraphData(graph)` — keep `graph-diff` module |
| Mock / stress | **Out of product path**; fixtures remain for verify scripts only |
| Loading | Blank canvas during fetch — **no** spinner/loading UI |
| Empty KB | Blank canvas |
| Fetch/API error | `console.warn` + blank canvas (no mock fallback) |
| Content on list | Keep full `content` on topology payload (v1) |
| Docs | Update `AGENTS.md` + API route comments |

## Out of scope this slice

- Deleting `diffGraphDirty` / renderer dirty APIs
- Deleting static layout-loop implementation
- Deleting mock/stress fixture files
- Loading / empty / error chrome design
- Server-side placement or GraphNode wire format
- Progressive BFS (C3b)

## Host pipeline (target)

```
mount blank
→ fetch /api/graph
→ empty | error → stay blank (+ warn on error)
→ non-empty → memoryGraphToGraphDataWithMeta
→ hit → setGraphData(graph, { settle: false })
→ miss → setGraphData(graph)  // d3-settle once
→ renderOnGraphData → always full setGraphData + queueRender
```
