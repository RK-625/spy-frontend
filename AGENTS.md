<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Spy — AI Knowledge Management Agent

## What is Spy?

Spy is an agent-first knowledge base. The user doesn't organize their own notes. They throw messy, raw, unstructured information at Spy — and the agent weaves it into a knowledge graph, connecting related concepts, mapping memory orientation, and maintaining the web over time. Think of it as an alien intelligence that lives in your notes, finds patterns you didn't see, and builds a living map of everything you know.

The product is not yet built. What we're building right now is the **landing page** — the first thing a visitor sees. Its job is to make the visitor believe this agent is real, alive, and worth trying.

## The story

Human knowledge is messy. We dump ideas into notes apps, bookmark articles we'll never read, highlight passages we instantly forget. The tools we have — Notion, Obsidian, Roam — all assume the human will do the organizing. Tag this. Link that. Build your own system.

Spy inverts that. You don't build the system. The system builds itself around you. You throw information at Spy, and an intelligent agent — personified as an alien spider — weaves it into a web of connected knowledge. The spider is not a "cute mascot." It's an alien intelligence. It finds your chaos interesting. It works while you sleep. It remembers what you forget.

## The mascot: Why a spider?

Spiders weave webs. So does Spy.

A spider is the perfect metaphor for an autonomous knowledge agent:
- It builds webs without being told how — it just knows.
- It senses vibrations across its web — it detects new connections.
- It's alien and slightly unsettling — not a friendly chatbot, not a paperclip. It's other. It's intelligence you don't fully understand.
- It maintains its web — repairing broken threads, cleaning up dead ends.

The spider is intentionally not cute. No eyes. No face. No cartoon features. It should feel like something from another dimension who happens to find human knowledge fascinating. It's confident, curious, and a little mysterious — just like the product voice.

## Design principles

Everything we build must obey these. They are non-negotiable.

### 1. Geometric minimalism
Every element is a straight line, polygon, or simple circle. No curves, no gradients, no decorative flourishes. The spider is built from a pixel grid — sharp, deliberate, blocky. The page has no rounded corners anywhere. If something could be softened, don't.

### 2. Dark utility register
This is a tool, not a carnival. Sparse layout. High contrast only where it matters. Low contrast everywhere else. Information should feel measured and precise. The page should feel like someone thought carefully about every pixel.

### 3. The spider is the character
The pixel art spider mascot is the emotional anchor of the entire page. It sits center stage. Every visual decision orbits around it. It's not decoration — it's the living proof that Spy is real. If a visitor doesn't remember anything else, they should remember the spider.

### 4. Amber is the only color
One accent color carries the entire personality: `#c9952a` — a warm, metallic amber/gold. No cyan. No blue. No purple. No gradient text. No neon effects. The rest of the palette is warm monochrome: off-white text (`#e8e4df`, never pure `#fff`), warm silver threads, deep black surfaces.

### 5. Ambient over loud
Animation is continuous and subtle — a spider bobbing gently, a pixel frame cycling slowly, nodes drifting in the knowledge graph, edges shimmering. The page should feel inhabited, not performing. No flashy transitions. No attention-seeking effects.

### 6. Distinctive over safe
Choose the unexpected option. Unbounded over Inter for headings. Amber over cyan. A pixel art alien spider over a generic AI icon. A sharp-edged, dark, warm-toned page over the default "dark mode startup" template. If another product could swap its name and still look right, we've failed.

### 7. One verb per action
Button labels are single actions. "Start weaving," not "Get started now." Every word on the page earns its place. No filler. No marketing speak. The voice is playful but not childish, mysterious but not edgy, warm but not soft.

## What we're particular about

These are things a new engineer might not guess. They must be followed:

- **No rounded corners.** Not on buttons, not on cards, not on the canvas. Sharp edges everywhere.
- **No eyes or face on the spider.** The mascot has no facial features. It's not cute. It's alien.
- **Amber only.** If you reach for another accent color, stop. There is no other accent color.
- **Text is never pure white.** `#e8e4df` for primary text, `#7a7685` for secondary, `#4a4658` for dim. Always warm off-white.
- **All design decisions live in `brief.md`.** Read it before making any visual or structural change. That file is the constitution.
- **Pixel art spider is rendered on Canvas 2D**, not SVG, not divs, not images. It's a 32×32 grid scaled 6x, with frame data in `spider-frames.ts` and GSAP animation in `pixel-art-canvas.tsx`. The old geometric SVG spider (`geometric-spider.tsx`) is superseded and kept only for reference.

## Short-term goal

Build the **landing page** — the front door of Spy. Ship every component needed to tell the story to a first-time visitor: the spider, the knowledge graph backdrop, the tagline, the CTA, the "how it works" section. All components have been extracted from a monolithic page into atomic files. We're now iterating on their design quality via Penpot before polishing the code.

The landing page exists to make someone believe Spy is real. The actual product (the knowledge management workspace) comes after.

## Long-term vision

Spy becomes a full application — a workspace where users actually throw their knowledge at the agent and watch it weave. The knowledge graph stops being a decorative backdrop and becomes a living, navigable interface. The spider becomes an interactive presence — responding to user activity, surfacing connections, maintaining the web in real time.

But right now, we're building the door. Make it good enough that people want to walk through.

## Current architecture

```
src/
├── app/
│   ├── page.tsx              — Thin orchestrator (just composes components)
│   ├── layout.tsx            — Root layout + fonts + metadata + hydration fix
│   └── globals.css           — Tailwind v4 @theme tokens
├── components/
│   ├── hero-section.tsx      — Hero layout (composes hero items)
│   ├── logo.tsx              — "S P Y" in Unbounded, text-secondary
│   ├── tagline.tsx           — "An alien sent to organize your chaos."
│   ├── cta-button.tsx        — Amber button + response text (owns its state)
│   ├── scroll-hint.tsx       — Thin line at bottom of hero
│   ├── ambient-glow.tsx       — Subtle amber top wash (2% opacity, 100px blur)
│   ├── how-it-works.tsx      — 3-step section below the fold
│   ├── pixel-art-canvas.tsx  — Canvas 2D spider (frames + GSAP timeline)
│   ├── pixel-spider.tsx      — Div-based pixel spider (alternative renderer)
│   ├── knowledge-graph.tsx   — Canvas 2D ambient graph backdrop
│   └── geometric-spider.tsx  — Superseded by pixel art (reference only)
└── lib/
    └── spider-frames.ts      — 32×32 pixel grid, 4 frames, procedural build
```

## Design files

- **`brief.md`** — Full design specification: color palette, typography, component rules, motion specs, anti-references. Read before changing anything visual.
- **Penpot** — All components exist as design references on the "Spy" project canvas. Logo, mascot, tagline, CTA, response text, scroll hint, ambient glow, and all 3 "how it works" steps. Design first in Penpot, then translate to code.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Tailwind CSS v4 with CSS custom properties |
| Mascot | Canvas 2D + GSAP (pixel art grid) |
| Knowledge graph | Canvas 2D API (no library) |
| Fonts | Unbounded + Inter via next/font/google |
| Deployment | Static export, no backend |

## Constraints

- Desktop only for v1 (no responsive/mobile yet)
- No sound
- No backend or API calls — pure frontend
- No external runtime dependencies beyond React, Next.js, GSAP
- Build produces static export (prerendered)
- No rounded corners anywhere

## Getting started

1. Read **`brief.md`** — it's the design constitution
2. Run `npm run dev` — starts on `localhost:3000`
3. Open Penpot — all components have design references on the "Spy" canvas
4. Components follow a pattern: `interface Props { className?: string }` and accept Tailwind overrides
5. CTA button owns its own interaction state (GSAP animation + response text)
6. Pixel art canvas defers rendering to client-side to avoid hydration mismatches
