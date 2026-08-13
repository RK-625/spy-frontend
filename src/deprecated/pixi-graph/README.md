# Deprecated: Pixi graph engine

Parked snapshot of the previous `/graph` client engine (Pixi v8 + RTC camera +
DotStream bake worker + d3 one-shot placement cache).

**Not wired to product routes.** Live `/graph` is Cosmograph
(`src/components/graph/graph-canvas.tsx`).

Keep this tree to refer back (verify scripts, layout recipe, bake quality bans).
Do not import from here in `/`, `/home`, or `/graph` product code.

| Was | Now |
|-----|-----|
| `src/lib/graph/` | `src/deprecated/pixi-graph/` |

Verify scripts that still exercise this snapshot point at this path.

Moved: 2026-08-13 (`graph-ops` Cosmograph rewrite).
