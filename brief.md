# Spy — Design Brief

## Register

**Brand** (landing page, marketing). The workspace/app will be **Product** register when built.

## Name

**Spy** — always capitalized, always the full name. No abbreviation. The landing page hero's final reveal uses the customized title **SYPDER**.

## Category

AI knowledge management agent. An alien spider that weaves and maintains a knowledge graph for you.

## Users

People with messy knowledge — students, researchers, lifelong learners, creators — who accumulate notes, ideas, and fragments of memory across tools and want an agent to organize it all into a connected web they can navigate and remember.

They arrive curious ("what is this?") and leave intrigued ("I want to try this").

## Purpose

Spy is an agent-first knowledge base. Unlike Obsidian or Notion, you don't organize your own notes. You throw information at Spy — messy, raw, unstructured — and the agent weaves it into a knowledge graph, connecting related concepts, mapping memory orientation, and maintaining the web over time.

The landing page's job: make the visitor believe this agent is real, alive, and worth trying.

## Artifact

**3D Gradient Sphere Backdrop** — A dynamic, morphing 3D gradient sphere that represents the active, alien, processing intelligence of Spy. It runs full-screen behind the hero as an ambient backdrop. The knowledge graph is built by the agent and shown inside the application itself.

## Evidence

The morphing 3D sphere gradient and the multi-phased terminal scramble sequence ("KNOWLEDGE UNSTRUCTURED IS JUST NOISE !!!" -> "MANAGE THE CHAOS" -> "MEET SYPDER") demonstrate the product's core value: turning raw, messy information into structured, intelligent form.

## Voice

- Playful but not childish
- Mysterious but not edgy
- Smart but not corporate
- Warm but not soft
- Confident but not loud

Spy talks like a clever alien who finds human knowledge fascinating and slightly chaotic. "An alien sent to organize your chaos." captures the tone perfectly.

## Anti-references

Do NOT look like:
- Generic AI startup landing pages (dark bg + cyan neon + centered hero)
- Terminal/developer tool aesthetics (monospace, green-on-black)
- Corporate SaaS (navy, rounded cards, "trusted by" logos)
- Cartoonish mascots, big eyes, cute characters — the robot spider has a visor and insectoid eyes, not a cute face
- Any product that could swap its name and still work

## Design principles

1. **Complex 3D Glossy Aesthetics** — The mascot is a highly detailed 3D glossy robot spider loaded from `mascot-3d.svg`. It uses smooth curves, gradients, and metallic purple/lavender reflections to feel alien, sleek, and full of personality. The page itself has no rounded corners or decorative flourishes — the spider and the background shader gradient are the complex visuals, everything else recedes.

2. **Dark utility register** — Sparse layout, high contrast where it matters, low contrast everywhere else. The page is a tool introduction, not a carnival. Information should feel measured and precise.

3. **Alien Intelligence is the Backdrop** — The morphing 3D gradient sphere is a visual metaphor for the agent's mind, running full-screen behind the hero. It is covered by a slow startup dissolve to hold focus during initial load.

4. **Distinctive over safe** — Choose the unexpected option. Unbounded and VT323 over Inter for headings. A deep, glossy purple/lavender gradient and lavender-white theme over the typical startup dark/cyan templates.

5. **Ambient over loud** — Continuous subtle animation (3D sphere morph, spider bob, visor ticker scroll, text scramble sequence, glint sweep) over flashy effects. The page should feel inhabited, not performing.

6. **One verb per action** — "Start weaving", not "Get started now". Every word earns its place.

## Visual foundation

### Color

The palette is restrained and uses deep purple, lavender, and monochrome tones.

**Surface & Background:**
- `#060610` — deepest black, page background base
- `@shadergradient/react` 3D Sphere colors:
  - `#4A1280` — dark purple body
  - `#8838DE` — mid purple surface tone
  - `#DDB8F8` — lavender highlight

**UI Text & Accents:**
- `#ded4f0` — lavender-white for primary and scramble text
- `#7a7685` — muted secondary text
- `#4a4658` — dim metadata
- Glossy gradient for **SYPDER**:
  - `#e8dff8` (0%) to `#d0b8f5` (30%) to `#b992f0` (60%) to `#9a6ae0` (100%), with a radial glint sweep
  - Drop shadow offset: `#1e0c50` block shadows
- Gold/Amber (`#c9952a` / `#e0ad3a`) — reserved for interactive action elements, buttons, and system notices below the fold.

**Color rules:**
- The background is built on a dark purple/lavender gradient, transitioning into deepest black.
- Main title text uses lavender-white and glossy purple gradients, never pure #fff.
- Focus rings and interactive buttons use the gold/amber accent for strong call-outs.

### Typography

* **Display:** Unbounded (400, 500, 600, 700) — headings, logo, section titles
* **Terminal:** VT323 / custom monospace — scramble text, visor text, tech indicators
* **Body:** Inter (400, 500) — tagline, descriptions, UI text
* Light on dark needs compensation: heavier weights, more line-height, trace of letter-spacing
* Sentence case everywhere
* Micro scale for UI: 0.65rem for step numbers, 0.7rem for logo, 0.75rem for CTA

### Motion & Interactivity

* **Black Overlay Dissolve:** Starts at 0.8s, runs a 2.5s linear fade-out (`dissolve-out`) to cover shader compilation. Scramble text starts after this overlay is fully dissolved.
* **Three-Phase Scramble:** Scramble text runs using `use-scramble` (speed 0.35, tick 2, step 1, scramble 2, range [65, 125]):
  * Phase 1: `"KNOWLEDGE UNSTRUCTURED IS JUST NOISE !!!"`
  * Phase 2: `"MANAGE THE CHAOS"` (triggers after 1s pause)
  * Phase 3: `"MEET"` (lavender-white) + `"SYPDER"` (glossy purple gradient)
* **Highlight Sweep:** 200ms after Phase 3 resolves, a CSS `::after` radial white-gold glint sweep (`coin-glint` animation) cycles across `"SYPDER"`.
* **Spider idle (SpiderMascot):** Continuous GSAP tweens — body float (translateY, 2.5s sine.inOut, yoyo), leg twitches (rotation via svgOrigin from hip joints, staggered per leg), pedipalp micro-movement. No frame cycling.
* **Reduced motion:** Respect `prefers-reduced-motion`

## Composition

* **Hero:** Employs a three-phase text reveal scramble sequence. Underneath a dissolving startup overlay, the morphing 3D gradient sphere provides depth. The spider mascot, logo, tagline, and CTA are orchestrated below or integrated within this central viewport.
* **Scroll hint:** Thin line at bottom of hero suggesting more content below.
* **Ambient top glow:** Subtle amber/violet wash at the top of the page, nearly invisible (2% opacity, 100px blur).

## Component rules

### Buttons
* Amber/gold background with dark text
* Hover: lighter amber, smooth transition
* Focus: 2px amber outline with 4px offset
* No border-radius (all components are sharp-edged)
* One verb per button label

### Spider mascot (SpiderMascot)
* Rendered using a complex, 3D-style glossy vector SVG (`mascot-3d.svg`) loaded dynamically
* Colors: Deep glossy purples and lavender tones with metallic reflections
* Animation: SVG is loaded dynamically from `/mascot-3d.svg`, and GSAP targets internal grouped IDs (`#Antenna`, `#Visor section`, `#Left 1st front leg`, `#Right leg2`, `#Right back leg`, etc.) for physics-based animations — floating, antenna twitch, visor scan, leg micro-movements
* Mascot feels alien, intelligent, and highly detailed — completely distinct from the geometric minimalist UI behind it
* Always centered, always the visual anchor

### Shader Backdrop
* Canvas-rendered using `@shadergradient/react` for smooth 3D noise deformation
* Shifting purple/lavender/deep violet hues
* Runs full-screen, fixed position, z-index -10 behind all content

## Tech stack

- **Framework:** Next.js 16 App Router
- **Styling:** Tailwind CSS v4 with CSS variables
- **Mascot:** Dynamic SVG (`mascot-3d.svg`) loaded dynamically, animated with GSAP targeting internal group IDs for physics-based motion
- **Backdrop:** ShaderGradient 3D canvas (`@shadergradient/react` sphere)
- **Fonts:** Google Fonts (Unbounded + Inter + VT323) via next/font
- **No client state management** needed for v1


## Constraints

- Desktop only for v1 (no responsive/mobile yet)
- No sound
- No backend/API calls — pure frontend
- No external runtime dependencies beyond React, Next.js, GSAP
- Build produces static export (prerendered)
- No rounded corners anywhere (design language is sharp-edged)
