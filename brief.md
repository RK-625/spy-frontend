# Spy — Design Brief

## Register

**Brand** (landing page, marketing). The workspace/app will be **Product** register when built.

## Name

**Spy** — always capitalized, always the full name. No abbreviation.

## Category

AI knowledge management agent. An alien spider that weaves and maintains a knowledge graph for you.

## Users

People with messy knowledge — students, researchers, lifelong learners, creators — who accumulate notes, ideas, and fragments of memory across tools and want an agent to organize it all into a connected web they can navigate and remember.

They arrive curious ("what is this?") and leave intrigued ("I want to try this").

## Purpose

Spy is an agent-first knowledge base. Unlike Obsidian or Notion, you don't organize your own notes. You throw information at Spy — messy, raw, unstructured — and the agent weaves it into a knowledge graph, connecting related concepts, mapping memory orientation, and maintaining the web over time.

The landing page's job: make the visitor believe this agent is real, alive, and worth trying.

## Artifact

**Knowledge graph** — a web of connected nodes (concepts, memories, notes) linked by edges (relationships). This is what Spy builds and maintains. The landing page shows this graph as a full-screen ambient backdrop.

## Evidence

The knowledge graph itself is proof. Labeled nodes showing connected concepts ("memory", "learning", "patterns") with animated edges demonstrate the product's core value: your knowledge, connected and alive.

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
- Cyberpunk templates (purple gradients, glass panels, neon borders)
- Cartoonish mascots, big eyes, cute characters
- Any product that could swap its name and still work

## Design principles

1. **Geometric minimalism** — Every element is a straight line, polygon, or simple circle. No curves, gradients, or decorative flourishes. The spider is built from a pixel grid — sharp, deliberate, blocky. The page has no rounded corners.

2. **Dark utility register** — Sparse layout, high contrast where it matters, low contrast everywhere else. The page is a tool introduction, not a carnival. Information should feel measured and precise.

3. **The web is the product** — The knowledge graph is proof, not decoration. It runs full-screen behind the hero as ambient evidence of what Spy does. The pixel art spider sits at the center as the character anchor.

4. **Distinctive over safe** — Choose the unexpected option. Unbounded over Inter for headings. Amber over cyan for interactive elements. A pixel art spider mascot over a generic AI icon. This product has personality; the design should too.

5. **Ambient over loud** — Continuous subtle animation (spider bob, frame-cycle breathing, node pulse, edge shimmer) over flashy effects. The page should feel inhabited, not performing.

6. **One verb per action** — "Start weaving", not "Get started now". Every word earns its place.

## Visual foundation

### Color

The palette is restrained and monochrome-tinted. One accent carries the personality.

**Surface (85%):**
- `#060610` — deepest black, page background
- `#0c0c18` — section backgrounds
- `#141425` — raised surfaces

**Thread (10% — content, structure):**
- `#c8c3b8` — warm silver for knowledge graph edges
- `rgba(200, 195, 184, 0.08)` — subtle borders
- `rgba(200, 195, 184, 0.15)` — strong borders
- `#7a7685` — muted secondary text
- `#4a4658` — dim metadata

**Accent (5% — interactive, proof):**
- `#c9952a` — amber/gold for CTA, node glow, accent marks
- `#e0ad3a` — lighter amber for hover
- `rgba(232, 197, 106, 0.15)` — node glow glow dimension
- `rgba(201, 149, 42, 0.25)` — button glow

**Text:**
- `#e8e4df` — warm off-white (not cold white)
- `#7a7685` — muted
- `#4a4658` — dim

**Color rules:**
- Amber is the ONLY accent color. No cyan, no blue, no purple.
- Web threads are warm silver, not cold white.
- Text is warm off-white, never pure #fff.
- No gradient text, no neon effects.

### Typography

- **Display:** Unbounded (400, 500, 600, 700) — headings, logo, section titles
- **Body:** Inter (400, 500) — tagline, descriptions, UI text
- Light on dark needs compensation: heavier weights, more line-height, trace of letter-spacing
- Sentence case everywhere
- Micro scale for UI: 0.65rem for step numbers, 0.7rem for logo, 0.75rem for CTA

### Motion (GSAP)

- **Spider idle:** Frame-cycle animation (4 frames, ~500ms each, GSAP timeline loop) + gentle bob (translateY, 2s cycle), glow pulse on accent stripe (3s)
- **Knowledge graph (canvas):** Continuous ambient — nodes drift gently (sin/cos wave), edges shimmer (sine pulse), occasional new thread flash (amber, 0.15% chance per frame)
- **CTA interaction:** Button scale bounce (1 → 1.03 → 1, 0.15s), response text fades in (0.5s)
- **Exit:** CTA response fades out after 3.5s
- **Reduced motion:** Respect `prefers-reduced-motion`

### Composition

- **Hero:** Center stage. Pixel art spider mascot at the heart. Logo ("S P Y") above tagline. CTA below tagline. All stacked vertically.
- **Proof:** The pixel art spider is the character anchor. The knowledge graph below it serves as ambient proof.
- **Depth:** "How it works" section below the fold with cliffhanger principle.
- **Scroll hint:** Thin line at bottom of hero suggesting more content below.
- **Ambient top glow:** Subtle amber wash at the top of the page, nearly invisible (2% opacity, 100px blur).

## Component rules

### Buttons
- Amber/gold background with dark text
- Hover: lighter amber, smooth transition
- Focus: 2px amber outline with 4px offset
- No border-radius (all components are sharp-edged)
- One verb per button label

### Spider mascot (PixelArtCanvas)
- Rendered on a Canvas 2D element with `image-rendering: pixelated`
- 32×32 pixel grid, scaled 6x for display (192×192px)
- Built procedurally from frame data in `spider-frames.ts` (4 frames for breathing cycle)
- Body: two segments (cephalothorax + abdomen) as filled ellipses on the grid
- 8 segmented legs as line segments
- Amber accent stripe on abdomen (center horizontal line)
- Colors: `#1a1a2e` (body), `#22223a` (legs), `#c9952a` (accent)
- No eyes, no face, no cartoon features
- GSAP-driven: frame cycling timeline, float animation, glow pulse
- Always centered, always the visual anchor
- Canvas is 192×192px

### Knowledge graph
- Canvas-rendered for performance
- ~28 nodes, amber-warm core nodes with glow, silver-white edges
- Labeled concept nodes for proof (6 labels: memory, learning, patterns, ideas, knowledge, connections, recall, insight, context, structure)
- Gentle drift animation, edge shimmer, occasional new thread flash
- Full-screen, fixed position, z-index 0 behind all content

## Tech stack

- **Framework:** Next.js 16 App Router
- **Styling:** Tailwind CSS v4 with CSS variables
- **Mascot:** Canvas 2D API (pixel art grid) + GSAP for animation timeline
- **Knowledge graph:** Canvas 2D API (self-contained, no library)
- **Fonts:** Google Fonts (Unbounded + Inter) via next/font
- **No client state management** needed for v1

## Constraints

- Desktop only for v1 (no responsive/mobile yet)
- No sound
- No backend/API calls — pure frontend
- No external runtime dependencies beyond React, Next.js, GSAP
- Build produces static export (prerendered)
- No rounded corners anywhere (design language is sharp-edged)
