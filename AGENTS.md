<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


<!-- START:codebase-context -->
# Spy — AI Knowledge Management Agent

## What is Spy?

Spy is an agent-first knowledge base. The user doesn't organize their own notes. They throw messy, raw, unstructured information at Spy — and the agent weaves it into a knowledge graph, connecting related concepts, mapping memory orientation, and maintaining the web over time. Think of it as an alien intelligence that lives in your notes, finds patterns you didn't see, and builds a living map of everything you know.

The **landing page** is shipped. **Primary product surface is chat** at `/home` — conversation, sidebar, prompt shell, streaming, and agent tools. The chat should feel like talking to an alien intelligence that's already weaving your knowledge.

**Knowledge graph canvas** lives at `/graph` (Pixi v8 + RTC camera) — a living knowledge-graph spike and path toward a navigable graph UI. Default mock is ~23 nodes / ~41 edges; opt-in stress: `/graph?stress=1` (`hubs`, `spokes` query params). Client pure-perf under quality bans has hit its product ceiling for static mock / large-loaded-graph tracks; full DB-scale residency is not achieved (see **What's left**).

**Not in live chat UI:** the in-prompt multiple-choice / morphing “ask user question” widget was removed from production `prompt-input` and parked under `src/deprecated/ask-user-question-widget/` for a future redesign.

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
The background uses a dynamic 3D sphere gradient in deep purples and lavender highlights (`#4A1280` / `#8838DE` / `#DDB8F8`) morphing over deepest black. Text uses lavender-white (`#ded4f0`) and a glossy purple gradient (`#e8dff8` to `#9a6ae0`). Interactive accents, focus rings, and action highlights use the lavender system (`#e8dff8` / `#C8ACFB` / `--ring` lavender). Gold/Amber is **not** part of the production UI palette.

### 5. Ambient over loud
Animation is continuous and subtle — a morphing 3D gradient sphere, a spider bobbing gently, text scrambling phases, and a CSS glint sweep across titles. The page should feel inhabited, not performing. No flashy transitions. No attention-seeking effects.

### 6. Distinctive over safe
Choose the unexpected option. Unbounded and VT323 over Inter for headings. A deep, glossy purple/lavender theme over the typical startup dark/cyan templates. A sharp-edged, dark page over the default "dark mode startup" template. If another product could swap its name and still look right, we've failed.

### 7. One verb per action
Button labels are single actions. "Start weaving," not "Get started now." Every word on the page earns its place. No filler. No marketing speak. The voice is playful but not childish, mysterious but not edgy, warm but not soft.

## What we're particular about

These are things a new engineer might not guess. They must be followed:

- **Restrained rounded corners.** We use `--radius: 0.55rem` globally. Do not use fully rounded pill shapes.
- **Deliberate pill exception: source / URL chips.** Source citations in `Sources` and `ChainOfThoughtSearchResult` use `rounded-full` (`pill-source-*` tokens). This is a deliberate exception for compact, dense reference chips; general UI controls remain `--radius`. Do not flatten these back to `--radius` without an explicit design review.
- **Mascot is cute and 3D.** The mascot features a visor, antenna, and articulated legs. It is a glossy 3D vector loaded from `mascot-3d.svg`.
- **Lavender accents only.** Focus ring (`--ring`), interactive controls, and loaders use the lavender system. Do not reintroduce gold/amber (`#c9952a`) into production UI.
- **Pixel Art Icons.** Do not use `lucide-react` or standard smooth vector icons in the Chat UI. Always use `DotMatrixIcon` from `@/components/dotmatrix/icons` (pixel-art registry) to maintain the alien aesthetic.
- **Text is never pure white.** `#ded4f0` or warm off-white `#e8e4df` for primary text, `#7a7685` for secondary, `#4a4658` for dim.
- **All design decisions live in `brief.md`.** Read it before making any visual or structural change. That file is the constitution.
- **Dynamic Mascot Loading.** The 3D robot spider is loaded dynamically as an SVG from the public folder (`mascot-3d.svg`), and animated using GSAP targeting specific internal IDs (`#Antenna`, `#Visor section`, `#Left 1st front leg`, `#Right leg2`, etc.).

## Short-term goal

**Ship and refine the chat workspace** at `/home`: conversation stream, sidebar (recents/search/settings), chat-only prompt shell (header attachments, body, textarea, footer tools), model/web controls, and agent streaming. Chat remains the primary product surface; the graph is adjacent infrastructure.

Landing (`/`) is the front door and is already in good shape — polish as needed, but do not treat “build the landing from scratch” as the primary goal.

**Graph (`/graph`):** interactive Pixi canvas spike (not a decorative backdrop). Client pure-perf ceiling for static mock pan/zoom and large-loaded-graph tracks is **achieved** under quality bans. Continuous layout is **off** by default (static engine; FA2/graphology path removed). Opt-in placement: `/graph?layout=d3` (one-shot d3 settle); optional ambient: `?motion=1`. Active placement architecture follows [`plans/client-placement-cache.md`](plans/client-placement-cache.md) (client placement cache, Falkor holds topology only, no server placement writes). Deprecated cleanup program: [`plans/safe-deprecated-cleanup.md`](plans/safe-deprecated-cleanup.md). Do not re-litigate ban-safe pure-perf; next graph work is product modes (ambient when wanted, full KB residency). Details under **What's left**.

**Prompt input:** production `src/components/chat/ai-elements/prompt-input.tsx` is a **chat-only** shell. Do not reintroduce the morphing ask-user-question widget into live routes without an explicit redesign. Reference implementation: `src/deprecated/ask-user-question-widget/`.

**Attachment accept allowlist:** single source of truth is `PROMPT_INPUT_ACCEPT` in `src/components/chat/ai-elements/prompt-input-files.ts` (wired from `/home` via `accept={PROMPT_INPUT_ACCEPT}`). Drag-drop and the file picker both enforce it via `filterIncomingFiles` / `matchesAccept`. Edit only that constant when expanding types. Full accepted list + intentionally excluded formats (e.g. `.html`, Office binaries, archives) are documented in that file’s module header — read it before changing.

**Attachment chips:** preview tiles use restrained `--radius`. The remove control is a **small rectangular badge** (tighter radius than full `--radius` so it does not read as a circle on an ~18px hit target), DotMatrix `x`, palette `bg-background/85` + muted foreground — not a pill.

## Long-term vision

Spy becomes a full application — a workspace where users actually throw their knowledge at the agent and watch it weave. `/graph` is already a real interactive canvas spike (Pixi + RTC camera); the long-term path is a living, navigable knowledge-graph interface backed by full KB residency — not mock-only. The spider becomes an interactive presence — responding to user activity, surfacing connections, maintaining the web in real time.

Right now the door is open; the work is making the chat workspace feel like walking into the web, with the graph as the navigable map underneath.

## Current architecture

src/
├── ai/
│   ├── agent.ts              — Server-side model streaming logic
│   ├── embeddings.ts         — Gemini-embedding-2 generation (1536 dim)
│   ├── retrieval.ts          — FalkorDB vector similarity search
│   └── schema.ts             — (Legacy/WIP) AI extraction schemas
├── app/
│   ├── api/                  — Backend API routes (Node.js runtime)
│   │   ├── chat/route.ts     — Streaming chat & memory extraction loop
│   │   └── prep-session/route.ts — Pre-fetches graph context for session
│   ├── page.tsx              — Landing page (composes hero components)
│   ├── home/
│   │   └── page.tsx          — Chat UI (conversation, messages, input, suggestions)
│   ├── graph/
│   │   └── page.tsx          — Knowledge graph canvas route (`/graph`, stress query params)
│   ├── layout.tsx            — Root layout + fonts + metadata + hydration fix
│   └── globals.css           — Tailwind v4 @theme tokens + design tokens + chat styles
├── components/
│   ├── ui/                   — Design-system primitives only (shadcn-style Button, Dialog, Input, …)
│   ├── chat/                 — Chat product shell + AI message chrome
│   │   ├── chat-sidebar.tsx  — Collapsible navigation drawer (Recents + Search)
│   │   ├── settings-dialog.tsx — Session settings overlay (trigger + optional shortcut)
│   │   ├── command-palette.tsx — ⌘K command palette (product chrome, not a primitive)
│   │   └── ai-elements/      — Conversation, message, prompt-input, suggestions, CoT, …
│   ├── graph/
│   │   └── graph-canvas.tsx  — Host for `/graph` (Pixi renderer + camera + bake)
│   ├── landing/              — Landing/marketing surfaces
│   │   ├── hero-section.tsx  — Hero layout
│   │   └── shiny-text.tsx    — Glint sweep text animation
│   ├── dotmatrix/            — Shared pixel / dot-matrix system
│   │   ├── icons.tsx         — Pixel-art icon registry (DotMatrixIcon)
│   │   ├── core.tsx / hooks.ts — Grid utilities + animation hooks
│   │   ├── hex-9 / square-18 / triangle-16 — Shape loaders
│   │   └── loader.css
│   └── brand/
│       └── logos/            — Provider mark SVGs (OpenAI, Anthropic, Google, DeepSeek)
├── deprecated/               — Not production routes; do not wire into / or /home without intent
│   ├── ask-user-question-widget/ — Snapshot of old prompt-input morph + widget-layout tokens
│   ├── ui-prototypes/        — Lab page + interactive question variants (archived)
│   └── (older mascot experiments if present)
├── contexts/
│   └── ChatContext.tsx       — Shared state provider for Chat UI (useChat wrapper)
├── hooks/
│   └── use-mobile.ts         — Responsive layout breakpoint state hook
├── lib/
│   ├── falkor.ts             — Native FalkorDB graph connection & Cypher queries
│   ├── graph/                — Knowledge graph client (Pixi pure-perf stack)
│   │   ├── pixi-renderer.ts  — World-space DotStream bake; camera → graphContent only
│   │   ├── bake-sample.ts / bake-worker.ts / bake-worker-pool.ts — Bake + residency
│   │   ├── spatial-index.ts  — GraphSpatialIndex (viewport + OVERSCAN_MARGIN=2.0)
│   │   ├── rim-lock.ts       — RimLock (O(E) / incremental)
│   │   ├── graph-diff.ts     — host diffGraphDirty + dirtyEdges / movedNodeIds
│   │   ├── layout-loop.ts / layout-loop-d3.ts — static + opt-in d3 settle (± ambient)
│   │   ├── force-recipe.ts   — pure d3-force placement (shared server/client)
│   │   ├── draw-arrow.ts / dot-circle-batch.ts — DotStream draw primitives
│   │   ├── graph-scale.ts / graph-style.ts — scale + visual tokens
│   │   ├── rtc-camera.ts     — RTC camera (never stage.scale for world camera)
│   │   ├── graph-data.ts     — default mock + stress fixture
│   │   └── index.ts          — public exports
│   └── utils.ts              — cn() helper for Tailwind class merging
├── prompts/
│   └── system-prompt.ts      — Agent system prompt export
└── types/
    ├── chat.ts               — Type declarations for ChatContextValue
    ├── graph-schema.ts       — Zod Schemas for Memory Nodes & Edges
    └── index.ts              — Main TypeScript module definitions entrypoint
```

**Note:** `prompt-input.tsx` under `chat/ai-elements` is chat-only (provider, attachments, textarea, tools, submit). The AI `askUserQuestion` tool may still exist in `src/ai/toolset.ts` without a live morph UI.

**Graph note:** Continuous layout off by default (static engine). FA2/graphology removed; placement policy follows [`plans/client-placement-cache.md`](plans/client-placement-cache.md) (client d3 compute + `localStorage` pose cache, Falkor holds topology only, no server placement writes). Deprecated cleanup program: [`plans/safe-deprecated-cleanup.md`](plans/safe-deprecated-cleanup.md). Universal residency (viewport + overscan + spatial index + bake worker) applies for all graph sizes under quality bans.

## Design files

- **`brief.md`** — Full design specification: color palette, typography, component rules, motion specs, anti-references. Read before changing anything visual.
- **Penpot** — All components exist as design references on the "Spy" project canvas. Logo, mascot, tagline, CTA, response text, scroll hint, ambient glow, and all 3 "how it works" steps. Design first in Penpot, then translate to code.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Backend | Node.js Runtime API Routes |
| Database | FalkorDB (Native driver via `falkordb`) |
| Validation | Zod (Strict JSON Schema extraction) |
| AI / LLM | Vercel AI SDK + Google Gemini |
| Embeddings | `gemini-embedding-2` (Truncated to 1536 dim) |
| Styling | Tailwind CSS v4 with CSS custom properties |
| Mascot | Dynamic SVG (`mascot-3d.svg`) + GSAP (targets internal IDs for animation) |
| Backdrop | ShaderGradient 3D canvas (`@shadergradient/react` sphere) |
| Fonts | Unbounded + Inter + VT323 via next/font/google |

## Constraints

- Desktop only for v1 (no responsive/mobile yet)
- No sound
- **Graph Schema strictness:** Memory edges are strictly limited to `PART_OF` (Hierarchical) and `RELATES_TO` (Associative). We do not use prerequisite or causal edges because semantic vector search on content embeddings implicitly handles those relationships.
- **Node.js Runtime only:** FalkorDB native driver breaks in Edge runtime. API routes interacting with the DB must run in Node.js and require `serverExternalPackages: ["falkordb"]` in `next.config.ts`.
- Restrained rounded corners only (--radius)
- **Graph client quality bans (still in force):** no maxDots / lodMul / skipOuterLats; no half-res soft sprites; no EDGE_BASE_BAND fatten; no packing floor 0.15 (keep 1e-6); no hierarchy silent-hide as “perf”

## What's left

### Done / do not re-litigate (graph pure-perf)

Client pure-perf under quality bans — **ceiling status:**

| Track | Status |
|---|---|
| Product ceiling (static mock pan/zoom) | **Achieved** |
| Client large-loaded-graph pure-perf (A–C) | **Achieved** for planned scope |
| Absolute / full product KB (DB-scale data residency) | **Not achieved** — Tier D out of scope |

**Achieved (ban-safe client pure-perf):**
- World-space DotStream bake @ z=1; camera only transforms `graphContent` (never `stage.scale` for world camera)
- Universal residency: viewport + `OVERSCAN_MARGIN=2.0` + GraphSpatialIndex + bake worker (all graph sizes)
- Wave 2: underlay pan-decouple, packed bake payloads/transferables, O(candidates) payload, resident buffer pooling, RimLock O(E), dynamic-import layout-loop-d3 (d3-force not on static path), strip no-op setInteractionQuality settle timers
- Large-KB track: rim-coupled dirty expansion, host `diffGraphDirty` + dirtyEdges/movedNodeIds, durable mergedDotBuffer splice, worker latest-only/cancel, incremental RimLock, spatial incidence + int keys, node redraw only when nodes dirty
- Layout: static product default; FA2/graphology **removed** (S7); d3 one-shot settle + optional ambient (`?motion=1`)

Hard bans remain in force (see Constraints). Do not re-open pure-perf by relaxing quality bans.

### Left (next product modes — not unfinished mock pan work)

1. **Client placement cache (MVP)** — **Achieved (C0–C5 MVP)**: Falkor topology only; client d3 + `localStorage` pose cache; toolset never settles/persists layout; live `/graph` cache-hit paints / cache-miss one-shot settle. **C3b deferred:** progressive BFS stream (invisible-until-posed growth animation). See [`plans/client-placement-cache.md`](plans/client-placement-cache.md). C6 live dirty / C7 reparent later.
2. **Opt-in ambient / settle when product wants motion** — `?layout=d3` settle + `?motion=1` ambient (default off). Do not claim continuous motion is live until product enables it.
3. **Full KB data residency** — server viewport slices / Falkor fetch / hierarchy expand-on-drill as a **product** choice, not silent LOD. Absolute DB-scale residency is the open ceiling.
4. **Multi-mesh / deeper GPU partial** — only if profiling shows hitch on huge residents.
5. **Chat `/home` shipping polish** — still the primary product surface (short-term goal above).
6. Prompt shell, streaming, sidebar/search/settings, model/web controls — remain true short-term chat work; do not resurrect ask-user-question morph without redesign.

Graph is **adjacent infrastructure**; chat-first short-term goal stands.

## Getting started

1. Read **`brief.md`** — design constitution
2. Run `npm run dev` — `localhost:3000` (`/` landing, `/home` chat, `/graph` knowledge graph; stress: `/graph?stress=1`)
3. Optional structure checks: `npm run verify:components-structure`, `npm run verify:reorg-scope`, `npm run verify:widget-cleanup`
4. Open Penpot — design references on the "Spy" canvas
5. Prefer domain imports: `@/components/chat/...`, `@/components/graph/...`, `@/lib/graph/...`, `@/components/dotmatrix/icons`, `@/components/ui/...`
6. CTA on landing owns its interaction state; mascot is dynamic SVG + GSAP (not Canvas/`<img>`)
7. Do not resurrect deprecated ask-user-question morph into production without a redesign task


<!-- END:codebase-context -->
