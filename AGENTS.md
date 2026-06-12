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

The spider is intentionally a unique robot design — its visor replaces traditional eyes, its antenna and mechanical legs make it feel alien rather than insect-like. It should feel like something from another dimension who happens to find human knowledge fascinating. It's confident, curious, and a little mysterious — just like the product voice.

## Design principles

Everything we build must obey these. They are non-negotiable.

### 1. Complex 3D Glossy Aesthetics
The mascot is a highly detailed, 3D glossy robot spider loaded from `mascot-3d.svg`. It uses smooth curves, gradients, and metallic purple/lavender reflections to feel alien, sleek, and full of personality.

### 2. Dark utility register (Background UI)
While the mascot is glossy and detailed, the background UI remains a dark utility register. Sparse layout, high contrast only where it matters.

### 3. The spider is the character
The 3D glossy robot spider is the emotional anchor of the entire page. It sits center stage. It features a sleek visor, antenna, and articulated mechanical legs — feeling alien and intelligent, not cartoonish.

### 4. Color Palette
The background uses a dynamic 3D sphere gradient in deep purples and lavender highlights (`#4A1280` / `#8838DE` / `#DDB8F8`) morphing over deepest black. Text uses lavender-white (`#ded4f0`) and a glossy purple gradient (`#e8dff8` to `#9a6ae0`). Gold/Amber (`#c9952a`) is reserved strictly for interactive action elements and buttons below the fold.

### 5. Ambient over loud
Animation is continuous and subtle — a morphing 3D gradient sphere, a spider bobbing gently, text scrambling phases, and a CSS glint sweep across titles. The page should feel inhabited, not performing. No flashy transitions. No attention-seeking effects.

### 6. Distinctive over safe
Choose the unexpected option. Unbounded and VT323 over Inter for headings. A deep, glossy purple/lavender theme over the typical startup dark/cyan templates. A sharp-edged, dark page over the default "dark mode startup" template. If another product could swap its name and still look right, we've failed.

### 7. One verb per action
Button labels are single actions. "Start weaving," not "Get started now." Every word on the page earns its place. No filler. No marketing speak. The voice is playful but not childish, mysterious but not edgy, warm but not soft.

## What we're particular about

These are things a new engineer might not guess. They must be followed:

- **No rounded corners.** Not on buttons, not on cards, not on the canvas. Sharp edges everywhere.
- **Mascot is cute and 3D.** The mascot features a visor, antenna, and articulated legs. It is a glossy 3D vector loaded from `mascot-3d.svg`.
- **Gold/Amber Accents.** Interactive elements and buttons use gold/amber. The main title/scramble typography and the mascot itself are exempt, using custom purple/lavender gradient tones.
- **Text is never pure white.** `#ded4f0` or warm off-white `#e8e4df` for primary text, `#7a7685` for secondary, `#4a4658` for dim.
- **All design decisions live in `brief.md`.** Read it before making any visual or structural change. That file is the constitution.
- **Dynamic Mascot Loading.** The 3D robot spider is loaded dynamically as an SVG from the public folder (`mascot-3d.svg`), and animated using GSAP targeting specific internal IDs (`#Antenna`, `#Visor section`, `#Left 1st front leg`, `#Right leg2`, etc.).

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
│   ├── spider-mascot.tsx     — Dynamic SVG `<mascot-3d.svg>` loader with GSAP idle animation (targets `#Antenna`, `#Visor section`, leg IDs)
│   ├── pixel-art-canvas.tsx  — Canvas 2D spider (superseded, reference only)
│   ├── pixel-spider.tsx      — Div-based pixel spider (superseded, reference only)
│   ├── knowledge-graph.tsx   — Canvas 2D ambient graph backdrop
│   └── geometric-spider.tsx  — Superseded by pixel art (reference only)
└── lib/
    ├── spider-frames.ts      — Superseded by inline arrays in spider-mascot.tsx (kept as reference)
```

## Design files

- **`brief.md`** — Full design specification: color palette, typography, component rules, motion specs, anti-references. Read before changing anything visual.
- **Penpot** — All components exist as design references on the "Spy" project canvas. Logo, mascot, tagline, CTA, response text, scroll hint, ambient glow, and all 3 "how it works" steps. Design first in Penpot, then translate to code.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Tailwind CSS v4 with CSS custom properties |
| Mascot | Dynamic SVG (`mascot-3d.svg`) + GSAP (targets internal IDs for animation) |
| Backdrop | ShaderGradient 3D canvas (`@shadergradient/react` sphere) |
| Fonts | Unbounded + Inter + VT323 via next/font/google |
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
6. The mascot (`mascot-3d.svg`) is loaded dynamically and animated with GSAP targeting internal SVG IDs. Do not use Canvas or `<img>` tags for the mascot.
