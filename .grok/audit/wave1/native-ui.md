# Wave 1 — Native UI primitives audit (`src/components/ui/**`)

**Agent:** native implementer (UI domain), leaf  
**Mode:** Audit then auto-fix ≥75% only  
**Date:** 2026-08-08  
**Scope write:** `src/components/ui/**` only  
**Refs:** `AGENTS.md`, code-preferences (UI tokens), git `b9c3503` (role folders + barrel), `5ebb99d` (barrel-only product imports)

---

## Summary

Role-folder layout from `b9c3503` is intact. Barrel is complete for role modules. No `any`. No lucide in ui. Internal imports use relative paths (no barrel cycles).

**Shipped fixes:** corrupted radius utilities on Dialog/Card, AppToaster public export, spinner/badge token reuse, missing React type imports, deprecation note on flat toaster BC path.

**Not deleted:** unused design-system primitives (Alert, Progress, Skeleton, Switch, Accordion, Avatar, Badge, Card, ScrollArea, Tabs, Sheet, HoverCard production-only) — intentional DS surface, not dead product leftovers.

---

## Structure (pass)

| Role folder | Modules |
|---|---|
| `actions/` | `button`, `button-group` |
| `forms/` | `input`, `textarea`, `input-group`, `select`, `switch` |
| `overlays/` | `dialog`, `sheet`, `popover`, `hover-card`, `dropdown-menu`, `tooltip` |
| `feedback/` | `alert`, `sonner`, `spinner`, `progress`, `skeleton` |
| `layout/` | `card`, `separator`, `scroll-area`, `avatar`, `badge`, `collapsible`, `accordion`, `carousel` |
| `navigation/` | `tabs`, `command` |
| root | `index.ts` barrel, `app-toaster.tsx` (BC dual path — residual) |

Forbidden flat dual shims (`ui/button.tsx`, `ui/dialog.tsx`, …) from `verify-components-structure.mjs` remain absent.

---

## Findings

### F1 — Corrupted radius class strings (CRITICAL) — FIXED

**Confidence:** 95%

Broken fragments `(var(--radius-4xl),24px)]` (missing `rounded-[min` / `rounded-t-[min` / `rounded-b-[min` prefix) in:

- `overlays/dialog.tsx` — `DialogContent`
- `layout/card.tsx` — root, header, footer, first/last img selectors

Present since initial add (`3447c3b` / `b9c3503`); radius never applied.

**Fix:** Restore token-capped radius:

- `rounded-[min(var(--radius-4xl),24px)]`
- `rounded-t-[min(...)]` / `rounded-b-[min(...)]` on card parts

Uses existing `--radius-4xl` theme token (globals).

### F2 — Flat dual-export leftover `app-toaster.tsx` — PARTIAL

**Confidence:** 90% structure issue; product migration out of write scope

- Root `app-toaster.tsx` re-exports from `feedback/sonner` (flat leftover outside role folders).
- Product deep imports:
  - `src/app/layout.tsx` → `@/components/ui/app-toaster` (`AppToaster`)
  - `src/components/chat/prompt/shell/prompt-input.tsx` → same (`toast`)
- Barrel previously exported `Toaster` / `toast` but **not** product name `AppToaster`.

**Fix (ui only):**

- Export `AppToaster` alias from `feedback/sonner.tsx` (barrel gets it via `export *`).
- Mark `app-toaster.tsx` `@deprecated` with BC re-export of `AppToaster` + `toast`.
- Document barrel as public SoT.

**Follow-up (product wave, out of scope):** migrate deep imports to `@/components/ui`, then delete root `app-toaster.tsx` and forbid path in verify script.

### F3 — Spinner invented raw lavender rgba — FIXED

**Confidence:** 90%

`text-[rgba(200,172,251,0.55)]` duplicated palette instead of token.

**Fix:** `text-lavender/55` (`--color-lavender` in `@theme`). Keep `rounded-full` (spinner geometry, not control pill exception).

### F4 — Badge radius not using design token — FIXED

**Confidence:** 85%

`rounded-2xl` maps to theme `--radius-2xl` (restrained scale, not a full pill), but globals define intentional `--radius-badge`.

**Fix:** `rounded-[var(--radius-badge)]`.

### F5 — `React` namespace without import — FIXED

**Confidence:** 88%

Files used `React.ComponentProps` / `React.CSSProperties` without importing React:

- `feedback/spinner.tsx`, `feedback/skeleton.tsx`
- `actions/button-group.tsx`
- `layout/collapsible.tsx`
- `feedback/sonner.tsx` (switched to `import type { CSSProperties }`)

`jsx: react-jsx` covers JSX only, not the `React` value/namespace.

### F6 — No `any` — PASS

No `: any` / `as any` under `src/components/ui/**`.

### F7 — Barrel gaps / non-public internals — PASS (after F2)

- Public primitives re-exported via `export *` from role modules.
- Variant helpers (`buttonVariants`, `badgeVariants`, `tabsListVariants`, `buttonGroupVariants`) exported — normal for CVA consumers; leave public.
- Internals not re-exported beyond module exports.

### F8 — Naming / role folders — PASS

Folders match AGENTS map: actions / forms / overlays / feedback / layout / navigation. File names kebab-case. No mis-filed primitives.

### F9 — Dead unused primitives — DOCUMENTED, not deleted

**Confidence for “unused in product”:** ≥90% for several; **confidence for “safe to delete”:** &lt;75% (design-system inventory).

| Primitive | Outside `ui/` product usage (approx.) | Action |
|---|---|---|
| Alert (+ parts) | 0 | Keep DS |
| Progress | 0 | Keep DS |
| Skeleton | 0 | Keep DS |
| Switch | 0 | Keep DS |
| Accordion | 0 | Keep DS |
| Avatar | 0 | Keep DS |
| Badge | 0 product | Keep DS (token fix only) |
| Card | 0 product | Keep DS (radius fix) |
| ScrollArea | 0 | Keep DS |
| Tabs | 0 | Keep DS |
| Sheet | 0 | Keep DS |
| Separator | internal (button-group) | Keep |
| HoverCard | deprecated widget only | Keep DS |
| Carousel | false-positive string hits in CoT | Keep DS |
| Toaster | via AppToaster | Keep |

Do not strip unused shadcn surface without an explicit DS-trim task.

### F10 — Style invent vs tokens (residual notes, no wholesale restyle)

| Item | Note | Action |
|---|---|---|
| Button / Input missing explicit `rounded-*` | May rely on base/shadcn defaults; no corruption found | Leave (avoid restyle) |
| Popover / Sheet / Select content | No `rounded-*` in class strings | Leave unless product visual bug |
| Command uses `rounded-[var(--radius-md)]` + surface tokens | Good token reuse | Leave |
| Skeleton `rounded-[var(--radius)]` | Good | Leave |
| Sonner CSS vars map to popover/radius tokens | Good | Leave |

### F11 — Dual product import path for toast — residual

Prefer barrel:

```ts
import { AppToaster, toast } from "@/components/ui";
```

Deep path still works for BC.

---

## Changes shipped (this commit)

| File | Change |
|---|---|
| `overlays/dialog.tsx` | Restore `rounded-[min(var(--radius-4xl),24px)]` |
| `layout/card.tsx` | Restore root / header / footer / img radius utilities |
| `layout/badge.tsx` | `rounded-[var(--radius-badge)]` |
| `feedback/spinner.tsx` | React import; `text-lavender/55` |
| `feedback/skeleton.tsx` | React import |
| `feedback/sonner.tsx` | CSSProperties import; export `AppToaster` |
| `actions/button-group.tsx` | React import |
| `layout/collapsible.tsx` | React import |
| `app-toaster.tsx` | Deprecation + re-export `AppToaster` |
| `index.ts` | Comment: barrel SoT; BC path note |

---

## Follow-ups (out of write scope)

1. **Product import migration:** `layout.tsx` + `prompt-input.tsx` → `@/components/ui`; delete `app-toaster.tsx`; add forbidden path in `scripts/verify-components-structure.mjs`.
2. **Optional DS trim:** if product never needs Alert/Progress/…, remove with explicit approval (not wave-1 auto).
3. **Button/Input/Popover radius audit** against Penpot/brief if surfaces look square in UI review.
4. Do not reintroduce lucide or gold/amber into ui.

---

## Verify checklist

- [x] No flat dual shims for button/input/dialog/tooltip/command
- [x] Role folders + barrel only for public API
- [x] No `any`
- [x] Radius corruption repaired
- [x] Spinner/badge use tokens
- [ ] Product deep toaster imports migrated (deferred)
- [ ] `npm run verify:components-structure` (run in CI/local with deps)

---

## Verdict

**ui domain is structurally healthy** after role-folder reorg. Highest-risk bug was silent radius corruption on Dialog/Card. Barrel now exposes `AppToaster`. Residual dual path is documented and BC-safe until a product import pass.
