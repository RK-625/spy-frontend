# Wave 2 — native audit: `dotmatrix` + `logos`

**Agent:** leaf implementer (native)  
**Scope:** `src/components/dotmatrix/**`, `src/components/logos/**` only  
**Mode:** Audit then auto-fix ≥75% confidence  
**Baseline history:** `1a7c9fc` — *refactor(components): barrel-only dotmatrix and flatten logos*  
**Date:** 2026-08-08

---

## Summary

| Area | Status |
|------|--------|
| Dual-export root shims | **Clean** (post-`1a7c9fc`) |
| Flatten leftovers (`brand/`, root re-exports) | **None** |
| Consumer import paths | **All** use package barrels |
| `any` types | **None** |
| Public API over-export | **Fixed** (explicit barrel) |
| Dead icons / loaders | **Reported** (not deleted) |
| Logo inventory | **OK** (provider marks; only Deepseek live) |

**Structure verify:** `node scripts/verify-components-structure.mjs` → **ok**.

---

## Package layout (current)

### `src/components/dotmatrix/`

```
index.ts                 # explicit public barrel (was export *)
core/
  core.tsx               # DotMatrixBase, patterns, bloom, path-wave utils
  hooks.ts               # motion / phase hooks
  index.ts               # subdomain barrel (export * — package-private use)
icons/
  icons.tsx              # DotMatrixIcon + ICONS registry
  index.ts
loaders/
  hex-9.tsx              # DotmHex9
  square-18.tsx          # DotmSquare18
  triangle-16.tsx        # DotmTriangle16
  loader.css             # dmx-* CSS (imported from core.tsx)
  index.ts
```

### `src/components/logos/`

```
index.ts                 # provider-mark barrel (OpenAI renames)
anthropic-black.tsx
anthropic-white.tsx
deepseek.tsx
google.tsx
openai.tsx
openai-dark.tsx
```

---

## History check vs `1a7c9fc`

`1a7c9fc` removed root dual shims:

| Forbidden (must not exist) | Present? |
|----------------------------|----------|
| `dotmatrix/core.tsx` (root) | No |
| `dotmatrix/hooks.ts` (root) | No |
| `dotmatrix/icons.tsx` (root) | No |
| `dotmatrix/loader.css` (root) | No |
| `dotmatrix/hex-9.tsx` etc. (root) | No |
| `src/components/brand/` | No |

Product imports already standardized on `@/components/dotmatrix` / `@/components/logos` (also reinforced in `9a64358`). **No flatten leftovers to remove.**

---

## Findings

### F1 — Public barrel leaked package internals (FIXED, conf 92%)

**Before:** `export * from "./core" | "./icons" | "./loaders"` re-exported ~40+ symbols including:

- `DotMatrixBase`, `createPathWaveComponent`, `createPathWaveResolver`
- Path-norm helpers (`snakePath*`, `spiralInward*`, `outerRing*`, …)
- Pattern index arrays, `cx`, bloom helpers, etc.

**External consumers only need:**

| Export | Used by |
|--------|---------|
| `DotMatrixIcon` | chat, ui, graph, deprecated |
| `DotMatrixIconName` | CoT, attachment-chip |
| `DotmHex9` / `DotmTriangle16` / `DotmSquare18` | prompt footer, conversation, deprecated |
| `usePrefersReducedMotion` | attachment-strip |

**Fix:** Explicit package barrel in `src/components/dotmatrix/index.ts`. Subdomain barrels remain for internal relative imports.

### F2 — `DotMatrixIconProps` not public (FIXED, conf 88%)

Props interface was unexported while `DotMatrixIconName` was public → inconsistent API.

**Fix:** `export interface DotMatrixIconProps` in `icons/icons.tsx`; re-exported from package barrel.

### F3 — `DotmTriangle16` missing halo spread class (FIXED, conf 90%)

`hex-9` and `DotMatrixBase` apply `dmxBloomHaloSpreadClass(halo)`; triangle loader did not, so `halo > 0` enabled bloom root but not the wider CSS falloff.

**Fix:** Apply `dmxBloomHaloSpreadClass(halo)` on triangle root; fix `--dmx-halo-level` indent.

### F4 — Fragmented relative imports in loaders (FIXED, conf 85%)

Loaders split many single-symbol imports from `../core` / `../core/hooks`.

**Fix:** Consolidated import blocks (behavior unchanged).

### F5 — Logos barrel docs (FIXED, conf 80%)

Documented rename contract (`Openai` → `OpenAI` / `OpenaiDark` → `OpenAIDark`) on the barrel. No API change.

---

## Not fixed (below threshold or intentional inventory)

### N1 — Dead icon glyphs: `square`, `arrowDown` (conf remove ~60%)

Registry has 21 names. **Zero** production/deprecated `name="square"` or `name="arrowDown"`.

Kept: icon registries often retain glyphs for upcoming UI; removing shrinks `DotMatrixIconName` public union without product request. **Do not invent styles; do not delete without explicit inventory pass.**

### N2 — Dead hook: `useSteppedCycle` (conf remove ~75%, leave)

Defined in `core/hooks.ts`, never referenced. Shared RAF bus is non-trivial; leave until a dedicated dead-code sweep of `core.tsx` / hooks. Not on public barrel after F1.

### N3 — Path-wave factory + path norms unused (conf remove ~70%)

`createPathWaveComponent` / path-order maps only self-reference. Large block in `core.tsx`. **De-publicized** via F1; deletion deferred (possible future loaders; avoid inventing replacement loaders).

### N4 — Logo marks unused except Deepseek

Live: `Deepseek` via `src/lib/models.ts`.  
Inventory-only: `OpenAI`, `OpenAIDark`, `AnthropicBlack`, `AnthropicWhite`, `Google`.

Keep provider inventory for multi-chef catalog.

### N5 — Verify script gaps (out of write scope)

`scripts/verify-components-structure.mjs` required list omits:

- `src/components/logos/index.ts`
- `src/components/logos/anthropic-black.tsx`
- `src/components/logos/openai-dark.tsx`

`scripts/verify-reorg-scope.mjs` still maps historical targets under `brand/logos/` (migration map, not live paths). Out of this agent’s write scope.

### N6 — `verify-icon-inventory` failures (out of scope)

Failures are in `src/app/home/page.tsx` sizing, not in `dotmatrix`/`logos` packages.

### N7 — README / plans still mention `brand/logos`

Docs outside write scope; product code paths are clean.

---

## Icon usage inventory

| Name | Live usage |
|------|------------|
| bulb | CoT, graph, sonner |
| search | sidebar, command, palette |
| plus | sidebar, prompt, deprecated |
| mic | speech-input |
| globe | prompt, CoT, sources-adjacent, deprecated |
| settings | sidebar, prompt, reasoning |
| panelLeftClose / Open | sidebar |
| cornerDownLeft | deprecated only |
| arrowUp | deprecated / prototypes |
| **square** | **none** |
| x | dialog, sheet, palette, attachments, sonner |
| book | sources |
| chevronDown / Left / Right | many ui + chat |
| **arrowDown** | **none** |
| check | select, dropdown, prompt, sonner |
| pencil | deprecated only |
| sun / moon / monitor | command-palette theme |

### Loader usage

| Loader | Live |
|--------|------|
| DotmTriangle16 | conversation scroll, submit |
| DotmHex9 | submit |
| DotmSquare18 | speech-input |

All three loaders are live — **no dead loaders.**

---

## Public API after fix

### `@/components/dotmatrix`

```
DotMatrixIcon
DotMatrixIconName
DotMatrixIconProps
DotmHex9 / DotmHex9Props
DotmSquare18 / DotmSquare18Props
DotmTriangle16 / DotmTriangle16Props
usePrefersReducedMotion
DotMatrixCommonProps
DotMatrixColorPreset
DotShape
DotMatrixPhase
MatrixPattern
```

### `@/components/logos`

```
Deepseek
OpenAI          (file: Openai)
OpenAIDark      (file: OpenaiDark)
AnthropicBlack
AnthropicWhite
Google
```

---

## Auto-fix file list

| File | Change |
|------|--------|
| `src/components/dotmatrix/index.ts` | Explicit public barrel |
| `src/components/dotmatrix/icons/icons.tsx` | Export `DotMatrixIconProps` |
| `src/components/dotmatrix/loaders/triangle-16.tsx` | Halo class + import cleanup |
| `src/components/dotmatrix/loaders/hex-9.tsx` | Import cleanup + halo style indent |
| `src/components/dotmatrix/loaders/square-18.tsx` | Import cleanup |
| `src/components/logos/index.ts` | Barrel contract comment |

---

## Hard stops honored

- No push / force
- No new icon styles / glyphs
- Write scope limited to `dotmatrix/**` + `logos/**`
- No deletion of intentional provider-mark inventory

---

## Recommended follow-ups (other agents)

1. Structure script: require `logos/index.ts`, `anthropic-black.tsx`, `openai-dark.tsx`.
2. Optional: prune `square` / `arrowDown` icons after product sign-off.
3. Optional: delete or isolate path-wave dead code in `core/core.tsx` + `useSteppedCycle`.
4. Home icon-inventory failures live outside this package.
