<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Spy — AI Knowledge Management Agent

## What is Spy?

Spy is an agent-first knowledge base. The user doesn't organize their own notes. They throw messy, raw, unstructured information at Spy — and the agent weaves it into a knowledge graph, connecting related concepts, mapping memory orientation, and maintaining the web over time. Think of it as an alien intelligence that lives in your notes, finds patterns you didn't see, and builds a living map of everything you know.

The **landing page** is built and polished. What we're building right now is the **chat UI** — the conversation interface where users interact with the AI agent. Its job is to feel like talking to an alien intelligence that's already weaving your knowledge.

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
The background uses a dynamic 3D sphere gradient in deep purples and lavender highlights (`#4A1280` / `#8838DE` / `#DDB8F8`) morphing over deepest black. Text uses lavender-white (`#ded4f0`) and a glossy purple gradient (`#e8dff8` to `#9a6ae0`). Gold/Amber (`#c9952a`) is reserved strictly for interactive action elements, buttons, and system notices below the fold.

### 5. Ambient over loud
Animation is continuous and subtle — a morphing 3D gradient sphere, a spider bobbing gently, text scrambling phases, and a CSS glint sweep across titles. The page should feel inhabited, not performing. No flashy transitions. No attention-seeking effects.

### 6. Distinctive over safe
Choose the unexpected option. Unbounded and VT323 over Inter for headings. A deep, glossy purple/lavender theme over the typical startup dark/cyan templates. A sharp-edged, dark page over the default "dark mode startup" template. If another product could swap its name and still look right, we've failed.

### 7. One verb per action
Button labels are single actions. "Start weaving," not "Get started now." Every word on the page earns its place. No filler. No marketing speak. The voice is playful but not childish, mysterious but not edgy, warm but not soft.

## What we're particular about

These are things a new engineer might not guess. They must be followed:

- **Restrained rounded corners.** We use `--radius: 0.55rem` globally. Do not use fully rounded pill shapes.
- **Mascot is cute and 3D.** The mascot features a visor, antenna, and articulated legs. It is a glossy 3D vector loaded from `mascot-3d.svg`.
- **Gold/Amber Accents.** Gold/Amber (`#c9952a`) is reserved strictly for the focus ring (`--ring`) and the main Landing Page CTA button. Chat UI components and loaders should use the default lavender/white styling.
- **Custom DotMatrix Icons.** Do not use `lucide-react` or standard smooth vector icons in the Chat UI. Always use the pixel-art `DotMatrixIcon` registry to maintain the alien aesthetic.
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
├── ai/
│   └── agent.ts              — Server-side model streaming logic
├── app/
│   ├── page.tsx              — Landing page (composes hero components)
│   ├── home/
│   │   └── page.tsx          — Chat UI (conversation, messages, input, suggestions)
│   ├── layout.tsx            — Root layout + fonts + metadata + hydration fix
│   └── globals.css           — Tailwind v4 @theme tokens + design tokens + chat styles
├── components/
│   ├── ai-elements/          — Chat UI component library
│   │   ├── conversation.tsx  — Scrollable message container (StickToBottom)
│   │   ├── message.tsx       — Message wrapper (user/assistant), branch selector, toolbar
│   │   ├── prompt-input.tsx  — Chat input (textarea, toolbar, submit, attachments)
│   │   ├── speech-input.tsx  — Microphone button (speech recognition + media recorder)
│   │   ├── suggestion.tsx    — Suggestion chips (horizontal scroll)
│   │   ├── model-selector.tsx — Model picker (dialog with search)
│   │   ├── sources.tsx       — Collapsible source links
│   │   ├── reasoning.tsx     — Collapsible reasoning/thinking display
│   │   ├── attachments.tsx   — File attachment preview and management
│   │   ├── shimmer.tsx       — Streaming message animation
│   │   └── scroll-to-bottom.tsx — Floating scroll button
│   ├── ui/                   — shadcn primitives (Button, Input, Dialog, etc.) + custom components:
│   │   ├── command-palette.tsx — Command palette search trigger and modal
│   │   ├── dotmatrix-core.tsx  — Custom pixel-art dot-matrix grids and utilities
│   │   └── dotmatrix-hooks.ts — Animation state hooks for dot-matrix cells
│   ├── ChatSidebar.tsx       — Collapsible navigation drawer (Recents list + Search)
│   ├── SettingsDialog.tsx    — Chat/model parameter override drawer
│   ├── ShinyText.tsx         — Glint sweep animation for "SPY" header
│   ├── hero-section.tsx      — Hero layout (composes hero items)
│   ├── logo.tsx              — "S P Y" in Unbounded, text-secondary
│   ├── tagline.tsx           — "An alien sent to organize your chaos."
│   ├── cta-button.tsx        — Amber button + response text (owns its state)
│   ├── scroll-hint.tsx       — Thin line at bottom of hero
│   ├── ambient-glow.tsx       — Subtle amber top wash (2% opacity, 100px blur)
│   ├── how-it-works.tsx      — 3-step section below the fold
│   ├── spider-mascot.tsx     — Dynamic SVG `<mascot-3d.svg>` loader with GSAP idle animation (targets `#Antenna`, `#Visor section`, leg IDs)
│   ├── dot-matrix-icons.tsx  — Central registry for pixel-art SVG icons
│   └── knowledge-graph.tsx   — Canvas 2D ambient graph backdrop
├── contexts/
│   └── ChatContext.tsx       — Shared state provider for Chat UI (useChat wrapper)
├── hooks/
│   └── use-mobile.ts         — Responsive layout breakpoint state hook
├── lib/
│   └── utils.ts              — cn() helper for Tailwind class merging
└── types/
    ├── chat.ts               — Type declarations for ChatContextValue
    └── index.ts              — Main TypeScript module definitions entrypoint
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
- Restrained rounded corners only (--radius)

## Getting started

1. Read **`brief.md`** — it's the design constitution
2. Run `npm run dev` — starts on `localhost:3000`
3. Landing page at `/`, chat UI at `/home`
4. Open Penpot — all components have design references on the "Spy" canvas
5. Components follow a pattern: `interface Props { className?: string }` and accept Tailwind overrides
6. CTA button owns its own interaction state (GSAP animation + response text)
7. The mascot (`mascot-3d.svg`) is loaded dynamically and animated with GSAP targeting internal SVG IDs. Do not use Canvas or `<img>` tags for the mascot.
