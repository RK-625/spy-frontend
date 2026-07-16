# Deprecated: ui-prototypes lab

This folder is a **deprecated morph/widget lab**. It is not part of the product surface.

## What lived here

- **`app-page/`** — former Next.js route page that was served at `/ui-prototypes`
- **`components/`** — interactive question variant experiments and lab UI

The `/ui-prototypes` route was intentionally removed so it cannot be hit casually.

## Source of truth for redesign

Redesign continues from:

- **`/home`** (`src/app/home/page.tsx`)
- **Current prompt-input stack** under `src/components/chat/ai-elements/` (especially `prompt-input.tsx` and related pieces)

Work proceeds **block-by-block** on that live stack. Do not treat this archive as the baseline for new product UI.

## Do not restore the route casually

Do **not** move these files back under `src/app/` or re-expose `/ui-prototypes` without an explicit product decision. This archive exists for reference only.
