# Wave 2 — Native audit: landing + animation + root page/layout

**Agent:** leaf implementer (native)  
**Mode:** Audit then auto-fix ≥75% only  
**Scope:** `src/components/landing/**`, `src/animation/**`, `src/app/page.tsx`, `src/app/layout.tsx` (shared, careful)  
**Hard stops:** no push/force; no landing hero redesign; keep landing ShaderGradient  

---

## Inventory

| Path | Role | Live consumers |
|---|---|---|
| `src/app/page.tsx` | Landing route `/` — ShaderGradient + `HeroSection` | App Router |
| `src/app/layout.tsx` | Root layout, fonts, toaster | All routes |
| `src/components/landing/hero-section.tsx` | Scramble text phases + ShinyText “SPYDER” | `page.tsx` only |
| `src/components/landing/shiny-text.tsx` | Motion shine sweep on gradient text | landing hero + `/home` header |
| `src/components/landing/shiny-text.css` | `.shiny-text { display: inline-block }` | imported by shiny-text |
| `src/animation/spider-mascot.tsx` | React host: fetch SVG + GSAP init | **none in product** (docs only) |
| `src/animation/spider/mascot.ts` | Greeting hop, eyes, visor ticker, idle handoff | spider-mascot |
| `src/animation/spider/behaviors.ts` | Micro-behaviors + continuous idles | mascot.ts |

---

## Hunt results

### Dead / dual path
- **No lucide** on landing/animation.
- **No gold/amber** palette violations in scope.
- **No `any`** in scope.
- **SpiderMascot stack is unwired** from `/` (and all product routes). Architecture/docs still describe it as the landing emotional anchor; product page currently ships text-scramble hero only. **Not deleted** — hard stop “don’t redesign landing hero”; host is intentional infrastructure for a future rewire, not a throwaway experiment.
- **ShinyText shared with `/home`** — not landing-only; keep API stable for chat header.
- **shiny-text.css** is a one-rule dual path vs Tailwind `inline-block`. **Left in place** because `scripts/verify-components-structure.mjs` and `scripts/verify-reorg-scope.mjs` still require `src/components/landing/shiny-text.css`. Folding would need script + plan map updates outside write scope.
- **Dual Inter in layout** (`--font-sans` + `--font-body`): both CSS vars are live (chat CoT / prompt use `--font-body`). Not removable without a globals alias (out of scope). Formatted + `display: "swap"` only.

### Naming / isolation
- Landing (3 files) and animation (host + `spider/` with 2 modules) stay under the 5-file subdomain threshold — no forced barrel/subdir reorg.
- Default export `Home` on landing route was a naming lie → renamed `LandingPage` (export name only; routing unchanged).
- Hero comment typo `SYPDER` → `SPYDER`.

### Palette notes (not fixed — &lt;75% product risk or intentional)
- ShinyText default `shineColor = "#ffffff"`: glint highlight, not body text; “text never pure white” is about copy, not specular shine.
- SpiderMascot white canvas `#ffffff`: component-local backdrop for the 3D SVG; intentional.

---

## Auto-fixed (≥75%)

| # | Confidence | File | Change |
|---|------------|------|--------|
| 1 | 95% | `hero-section.tsx` | Removed dead `replayMainRef` + effect; main scramble only needs `ref` (replay never read). |
| 2 | 95% | `hero-section.tsx` | Comment typo `SYPDER` → `SPYDER`. |
| 3 | 98% | `shiny-text.tsx` | Removed dead `color?` prop from `ShinyTextProps` (never destructured/used). |
| 4 | 85% | `shiny-text.tsx` | Normalized quotes / formatting to project double-quote style. |
| 5 | 95% | `behaviors.ts` | Dropped unused public `list()` from return API. |
| 6 | 90% | `behaviors.ts`, `mascot.ts` | Removed unnecessary `"use client"` from pure GSAP modules (client boundary is `spider-mascot.tsx`). |
| 7 | 95% | `mascot.ts` | Cleanup now kills `hiTl`, `floatTween`, `glowTween` (was leaking GSAP timelines on unmount). |
| 8 | 90% | `spider-mascot.tsx` | Cancel flag on SVG fetch so unmount doesn’t setState/onReady after dispose. |
| 9 | 90% | `layout.tsx` | Format dual Inter declarations + `display: "swap"`; comment why both vars exist. |
| 10 | 85% | `page.tsx` | Rename default export `Home` → `LandingPage`. ShaderGradient **kept**. |

---

## Explicit non-fixes (documented)

| Item | Why skipped |
|---|---|
| Rewire SpiderMascot onto landing | Redesign / product decision; hard stop |
| Delete SpiderMascot / spider/* | Orphaned host, not dead experiment; docs + brief still call for it |
| Fold/delete `shiny-text.css` | Breaks structure/reorg verify gates without script edits (out of write scope) |
| Collapse dual Inter to one instance | Needs `--font-body` alias in `globals.css` (out of write scope) |
| Change shine/white canvas colors | Intentional highlights, not body-text palette violations |
| Hero phase timing / copy / layout | “Don’t redesign landing hero” |
| Strip unused ShinyText knobs (`yoyo`, `pauseOnHover`, …) | Used API surface for home + future; only `color` was truly dead |

---

## Post-fix shape

```
src/components/landing/
  hero-section.tsx      # scramble phases; no dead main replay ref
  shiny-text.tsx        # no dead color prop; home still imports
  shiny-text.css        # kept for verify gate (display:inline-block)

src/animation/
  spider-mascot.tsx     # fetch cancel on unmount; still unwired product-side
  spider/
    mascot.ts           # GSAP cleanup complete; no "use client"
    behaviors.ts        # no list(); no "use client"

src/app/page.tsx        # LandingPage + ShaderGradient
src/app/layout.tsx      # formatted Inter + swap
```

---

## Follow-ups (for orchestrator / later waves)

1. **Product:** decide whether to re-mount SpiderMascot on `/` per brief, or update brief/docs to match text-only hero.
2. **Scripts:** allow folding `shiny-text.css` into Tailwind by updating `verify-components-structure` + `verify-reorg-scope` RENAME_MAP.
3. **Layout:** single Inter instance + `--font-body: var(--font-sans)` in `globals.css` to avoid double font registration.
4. **Animation package:** optional `src/animation/index.ts` barrel if more hosts land; currently &lt;5 files.

---

## Verification

- Write scope respected (no chat/home product edits; ShaderGradient retained on landing).
- No push/force.
- `ShinyText` still consumable from `@/components/landing/shiny-text` for `/home`.
