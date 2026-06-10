# Spy Landing Page — Handoff (option1 branch)

## Branch: `option1`
**Checked in at:** `c093fb3` — working tree clean, all changes committed.

## Current State

The landing page hero section is fully built with three animation phases:

1. **Phase 1:** "KNOWLEDGE UNSTRUCTURED IS JUST NOISE !!!" scrambles in (use-scramble, speed 0.35)
2. **Phase 2:** "MANAGE THE CHAOS" scrambles in after 1s pause
3. **Phase 3:** "MEET" + "SYPDER" scramble in side by side after 1s pause
   - "MEET" is lavender-white (`#ded4f0`)
   - "SYPDER" uses glossy purple gradient + drop-shadow block shadows (lavender → deep purple)
   - After scramble resolves (~200ms), a white highlight bar sweeps across "SYPDER" (CSS `::after`, 1.5s animation)

**Black overlay dissolve:** covers shader load — 0.8s delay → 2.5s linear fade (`@keyframes dissolve-out`). Text starts at 2.5s (after overlay clears).

**Background:** `@shadergradient/react` sphere with `lightType="3d"`, `envPreset="city"`, `reflection=0.5`, colors `#4A1280`/`#8838DE`/`#DDB8F8`. Loaded via dynamic import with `ssr: false`.

## Files

| File | Purpose |
|---|---|
| `src/app/page.tsx` | Page orchestrator — ShaderGradient background + overlay + HeroSection |
| `src/components/hero-section.tsx` | 3-phase scramble chain + sweep trigger |
| `src/app/globals.css` | `@keyframes dissolve-out`, `.glossy-text` + `::after` sweep, `@keyframes sweep` |
| `src/components/scroll-hint.tsx` | **Commented out in page.tsx** — wire up when ready |
| `src/components/how-it-works.tsx` | **Commented out in page.tsx** — wire up when ready |
| `src/components/ui/scramble-text.tsx` | **Untracked, unused** — utility wrapper for future sections |
| `public/mascot-3d.svg` | Mascot SVG — source of purple palette |

## Key Props

**ShaderGradient** (locked, tune colors via `color1`/`color2`/`color3`):
```
lightType="3d" envPreset="city" reflection={0.5}
type="sphere" uDensity=0.8 uStrength=0.4 uFrequency=5.5 uSpeed=0.3 uAmplitude=7
cAzimuthAngle=250 cPolarAngle=140 cDistance=1.5 cameraZoom=12.5
```

**Use-scramble** config (all phases):
```
speed: 0.35, tick: 2, step: 1, scramble: 2, chance: 0.7, overflow: true, range: [65, 125]
```

## Next likely work (not started)

- ScrollHint and HowItWorks — uncomment and build below the fold
- ScrollTrigger integration between hero and sections below
- Overall page layout polish with how-it-works content
- Mascot SVG interactive integration on hero around the text
- GSAP-based ambient animations on the mascot

## Suggested Skills

- `/gsap-core` — GSAP core for ambient mascot animation (spider bobbing/legs)
- `/gsap-timeline` — timeline for sequencing scroll-triggered animations
- `/gsap-scrolltrigger` — scroll-driven reveal for HowItWorks section
- `/frontend-design` — layout/design polish for the below-the-fold sections
