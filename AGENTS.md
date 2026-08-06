<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


<!-- START:codebase-context -->
# Spy — AI Knowledge Management Agent

## What is Spy?

Spy is an agent-first knowledge base. The user doesn't organize their own notes. They throw messy, raw, unstructured information at Spy — and the agent weaves it into a knowledge graph, connecting related concepts, mapping memory orientation, and maintaining the web over time. Think of it as an alien intelligence that lives in your notes, finds patterns you didn't see, and builds a living map of everything you know.

The **landing page** is shipped. **Primary product surface is chat** at `/home` — conversation, sidebar, prompt shell, streaming, and agent tools. The chat should feel like talking to an alien intelligence that's already weaving your knowledge.

**Knowledge graph canvas** lives at `/graph` (Pixi v8 + RTC camera) — live topology only via `GET /api/graph` (Falkor memories + links; no embeddings, no server xy). Client maps topology → `GraphData`, places via localStorage fingerprint cache, and always uses one-shot d3 settle on cache miss (`ambientMotion` off). Empty KB / fetch error → blank canvas (no mock product path). Mock/stress fixtures remain under `src/lib/graph/fixtures/` for verify scripts only. Client pure-perf under quality bans has hit its product ceiling for loaded-graph pan/zoom; full DB-scale residency is not achieved (see **What's left**).

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
- **Pixel Art Icons.** Do not use `lucide-react` or standard smooth vector icons in the Chat UI. Always use `DotMatrixIcon` from `@/components/dotmatrix` (pixel-art registry) to maintain the alien aesthetic.
- **Text is never pure white.** `#ded4f0` or warm off-white `#e8e4df` for primary text, `#7a7685` for secondary, `#4a4658` for dim.
- **All design decisions live in `brief.md`.** Read it before making any visual or structural change. That file is the constitution.
- **Dynamic Mascot Loading.** The 3D robot spider is loaded dynamically as an SVG from the public folder (`mascot-3d.svg`), and animated using GSAP targeting specific internal IDs (`#Antenna`, `#Visor section`, `#Left 1st front leg`, `#Right leg2`, etc.).

## Short-term goal

**Ship and refine the chat workspace** at `/home`: conversation stream, sidebar (recents/search/settings), chat-only prompt shell (header attachments, body, textarea, footer tools), model/web controls, and agent streaming. Chat remains the primary product surface; the graph is adjacent infrastructure.

Landing (`/`) is the front door and is already in good shape — polish as needed, but do not treat “build the landing from scratch” as the primary goal.

**Graph (`/graph`):** interactive Pixi canvas spike (not a decorative backdrop). **Live-only product path** (see [`plans/graph-live-only-pivot.md`](plans/graph-live-only-pivot.md)): single URL `/graph` — no product `?stress` / `?source` / `?layout` / `?motion`. Always fetches `/api/graph`; layout engine always `d3-settle` with ambient off; cache hit paints without re-settle, miss settles once and saves. Client pure-perf ceiling for loaded-graph pan/zoom is **achieved** under quality bans. FA2/graphology path removed. Placement architecture: [`plans/client-placement-cache.md`](plans/client-placement-cache.md) (client cache, Falkor topology only, no server placement writes). Deprecated cleanup program: [`plans/safe-deprecated-cleanup.md`](plans/safe-deprecated-cleanup.md). Do not re-litigate ban-safe pure-perf; next graph work is full KB residency / live dirty. Details under **What's left**.

**Prompt input:** production SoT is under `src/components/chat/prompt/` (`shell/prompt-input.tsx` form + `shell/context.tsx` with `PromptShellProvider` draft/prefs; barrel `@/components/chat/prompt`). Chat-only shell — no dual import paths. Do not reintroduce the morphing ask-user-question widget into live routes without an explicit redesign. Reference implementation: `src/deprecated/ask-user-question-widget/`.

**Attachment accept allowlist:** single source of truth is `PROMPT_INPUT_ACCEPT` in `src/components/chat/prompt/attachments/prompt-input-files.ts` (wired from `/home` via `accept={PROMPT_INPUT_ACCEPT}`). Drag-drop and the file picker both enforce it via `filterIncomingFiles` / `matchesAccept`. Edit only that constant when expanding types. Full accepted list + intentionally excluded formats (e.g. Office binaries, archives) are documented in that file’s module header — read it before changing.

**Attachment chips:** preview tiles use restrained `--radius`. The remove control is a **small rectangular badge** (tighter radius than full `--radius` so it does not read as a circle on an ~18px hit target), DotMatrix `x`, palette `bg-background/85` + muted foreground — not a pill.

## Long-term vision

Spy becomes a full application — a workspace where users actually throw their knowledge at the agent and watch it weave. `/graph` is already a real interactive canvas spike (Pixi + RTC camera); the long-term path is a living, navigable knowledge-graph interface backed by full KB residency — not mock-only. The spider becomes an interactive presence — responding to user activity, surfacing connections, maintaining the web in real time.

Right now the door is open; the work is making the chat workspace feel like walking into the web, with the graph as the navigable map underneath.

## Current architecture

```
src/
├── ai/
│   ├── agent/                — Server-side model streaming (`@/ai/agent` directory barrel)
│   │   ├── agent.ts          — Implementation SoT (runAgent)
│   │   └── index.ts          — domain barrel
│   ├── models/               — Model config + embeddings (`@/ai/models`, embeddings deep path OK)
│   │   ├── modelstore.ts     — Model / embed model wiring
│   │   └── embeddings.ts     — Gemini-embedding-2 generation (1536 dim)
│   ├── tools/                — Agent tools SoT (`@/ai/tools`)
│   │   └── toolset.ts        — upsert/link/search/ask; never settles layout
│   ├── schemas/              — Zod tool input schemas (SoT: *-schema.ts only; no alias shims)
│   │   └── ask-schema.ts / upsert-schema.ts / link-schema.ts / web-search-schema.ts
│   └── index.ts              — public `@/ai` barrel (agent + models + tools + schemas)
├── animation/
│   ├── spider-mascot.tsx     — Mascot React host
│   └── spider/               — GSAP behaviors + mascot timeline
├── app/
│   ├── api/                  — Backend API routes (Node.js runtime)
│   │   ├── chat/route.ts     — Streaming chat & memory extraction loop
│   │   ├── graph/route.ts    — Live topology for `/graph` (Falkor; no xy)
│   │   └── test-db/route.ts  — DB connectivity check
│   ├── page.tsx              — Landing page (composes hero components)
│   ├── home/
│   │   └── page.tsx          — Chat UI (conversation, messages, input, suggestions)
│   ├── graph/
│   │   └── page.tsx          — Knowledge graph canvas route (`/graph`, live-only)
│   ├── layout.tsx            — Root layout + fonts + metadata + hydration fix
│   └── globals.css           — Tailwind v4 @theme tokens + design tokens + chat styles
├── components/
│   ├── ui/                   — Design-system primitives by role (barrel `@/components/ui`)
│   │   ├── actions/          — button, button-group
│   │   ├── forms/            — input, textarea, input-group, select, switch
│   │   ├── overlays/         — dialog, sheet, popover, hover-card, dropdown-menu, tooltip
│   │   ├── feedback/         — alert, sonner, spinner, progress, skeleton
│   │   ├── layout/           — card, separator, scroll-area, avatar, badge, collapsible, accordion, carousel
│   │   ├── navigation/       — tabs, command
│   │   └── index.ts          — public barrel (no flat dual-export shims)
│   ├── chat/                 — Chat product shell + AI message chrome
│   │   ├── prompt/           — Prompt shell SoT (shell/, header/, body/, ask/, attachments/, footer/, index.ts)
│   │   ├── conversation/     — Message stream SoT (conversation, message, CoT, sources, …)
│   │   ├── shell/            — Product chrome SoT (sidebar, settings, command palette)
│   │   └── index.ts          — chat barrel (prefer domain folders or this barrel)
│   ├── graph/                — Graph React host (not pure logic)
│   │   ├── graph-canvas.tsx  — Host for `/graph` (Pixi renderer + camera + bake)
│   │   └── node-detail-dialog.tsx — Node inspector overlay
│   ├── landing/              — Landing/marketing surfaces
│   │   ├── hero-section.tsx  — Hero layout
│   │   └── shiny-text.tsx    — Glint sweep text animation
│   ├── dotmatrix/            — Shared pixel / dot-matrix system (barrel `@/components/dotmatrix`)
│   │   ├── index.ts          — public barrel (icons, loaders, hooks, core)
│   │   ├── core/             — Grid utilities + animation hooks (SoT)
│   │   ├── icons/            — Pixel-art icon registry (DotMatrixIcon SoT)
│   │   └── loaders/          — hex-9 / square-18 / triangle-16 + loader.css (SoT)
│   └── logos/                — Provider mark SVGs (OpenAI, Anthropic, Google, DeepSeek)
├── deprecated/               — Not production routes; do not wire into / or /home without intent
│   ├── ask-user-question-widget/ — Snapshot of old prompt-input morph + widget-layout tokens
│   ├── ui-prototypes/        — Lab page + interactive question variants (archived)
│   └── (older mascot experiments if present)
├── contexts/
│   └── ChatContext.tsx       — Shared state provider for Chat UI (useChat wrapper)
├── hooks/
│   ├── use-mobile.ts         — Responsive layout breakpoint state hook
│   └── use-chat-submit.ts    — Bridges ChatContext stream + prompt prefs for send
├── lib/
│   ├── falkor.ts             — Server DB: FalkorDB connection & Cypher (topology only; no xy)
│   ├── graph/                — Graph pure logic (Pixi pure-perf + client placement)
│   │   ├── camera/           — rtc-camera (never stage.scale for world camera)
│   │   ├── core/             — graph-data, graph-diff, graph-scale, graph-style
│   │   ├── layout/           — layout-loop-d3 (`createGraphPaintLoop`; dynamic import), rim-lock, spatial-index
│   │   ├── placement/        — place-topology (hit/miss), force-recipe (pure settle), placement-cache
│   │   ├── render/           — pixi-renderer, bake stack, draw primitives, edge pulse
│   │   ├── fixtures/mock-graph.ts — verify-only mock + stress fixtures
│   │   └── index.ts          — public exports
│   ├── ask-user-question.ts  — Pending-ask client helpers (no morph UI)
│   ├── models.ts             — Client model catalog (id / provider list)
│   └── utils.ts              — cn() helper for Tailwind class merging
├── prompts/
│   └── system-prompt.ts      — Agent system prompt export
└── types/
    ├── chat.ts               — Type declarations for ChatContextValue
    ├── graph-schema.ts       — Zod Schemas for Memory Nodes & Edges
    ├── models.ts             — Model id / provider types
    └── index.ts              — Main TypeScript module definitions entrypoint
```

**Placement policy (where code lives):**
- **Graph pure logic** → `src/lib/graph/` subdomains (`placement/`, `layout/`, `render/`, `camera/`, `core/`)
- **Graph React host** → `src/components/graph/` (`graph-canvas`, node-detail dialog)
- **Server DB** → `src/lib/falkor.ts` (topology only — not under the client graph package; no product `x`/`y`/`rank` writes)
- **Agent tools / schemas** → `src/ai/tools/`, `src/ai/schemas/*-schema.ts` (domain barrels; no root dual-export shims)
- **Chat UI** → `src/components/chat/{prompt,conversation,shell}/` domain barrels only (no ai-elements / root dual shims)

**Note:** Chat prompt SoT is `chat/prompt/` domain tree + barrel (`PromptShellProvider` + `shell/prompt-input.tsx` form, pieces under header/body/ask/attachments/footer). The AI `askUserQuestion` tool may still exist in `src/ai/tools/toolset.ts` without a live morph UI.

**Graph note:** Continuous layout off by default. FA2/graphology removed; placement policy follows [`plans/client-placement-cache.md`](plans/client-placement-cache.md). **`placeTopology`** owns fingerprint hit/miss (hit → cached `{x,y}`; miss → assemble at `(0,0)` → pure `settleGraphData` → save poses). Host dynamic-imports `createGraphPaintLoop` from `layout-loop-d3` (`setGraphData(graph)` only; no settle option). Falkor holds topology only — no server placement writes. Deprecated cleanup program: [`plans/safe-deprecated-cleanup.md`](plans/safe-deprecated-cleanup.md). Universal residency (viewport + overscan + spatial index + bake worker) applies for all graph sizes under quality bans.

**Agent rules:** project instruction rules live under `.grok/rules/` (e.g. `code-perferences/`, `orchestration/`). Historical folder name `code-perferences` is intentional; do not rename without verifying the rules loader.

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
- Large-KB track: rim-coupled dirty expansion, durable mergedDotBuffer splice, worker latest-only/cancel, incremental RimLock, spatial incidence + int keys, node redraw only when nodes dirty (`diffGraphDirty` remains in lib; product host uses full `setGraphData`)
- Layout: product always d3 one-shot settle on cache miss; ambient off; FA2/graphology **removed** (S7). Static layout-loop impl kept for verify/labs.

Hard bans remain in force (see Constraints). Do not re-open pure-perf by relaxing quality bans.

### Left (next product modes — not unfinished mock pan work)

1. **Client placement cache (MVP)** — **Achieved (C0–C5 MVP)**: Falkor topology only; client d3 + `localStorage` pose cache; toolset never settles/persists layout; live `/graph` cache-hit paints / cache-miss one-shot settle. **Live-only host** — **Achieved** ([`plans/graph-live-only-pivot.md`](plans/graph-live-only-pivot.md)): no mock product path, no URL layout flags. **C3b deferred:** progressive BFS stream (invisible-until-posed growth animation). See [`plans/client-placement-cache.md`](plans/client-placement-cache.md). C6 live dirty / C7 reparent later.
2. **Ambient / continuous motion** — product ambient remains **off**. Re-enable only with an explicit product decision (impl + types still exist; no URL flag).
3. **Full KB data residency** — server viewport slices / Falkor fetch / hierarchy expand-on-drill as a **product** choice, not silent LOD. Absolute DB-scale residency is the open ceiling.
4. **Multi-mesh / deeper GPU partial** — only if profiling shows hitch on huge residents.
5. **Chat `/home` shipping polish** — still the primary product surface (short-term goal above).
6. Prompt shell, streaming, sidebar/search/settings, model/web controls — remain true short-term chat work; do not resurrect ask-user-question morph without redesign.

Graph is **adjacent infrastructure**; chat-first short-term goal stands.

## Getting started

1. Read **`brief.md`** — design constitution
2. Run `npm run dev` — `localhost:3000` (`/` landing, `/home` chat, `/graph` live knowledge graph)
3. Optional structure checks: `npm run verify:components-structure`, `npm run verify:reorg-scope`, `npm run verify:widget-cleanup`
4. Open Penpot — design references on the "Spy" canvas
5. Prefer package barrels for product/cross-package code: `@/components/chat`, `@/components/ui`, `@/components/dotmatrix`, `@/components/logos`, `@/ai`, `@/lib/graph`. Inside a package use relative imports (never that package barrel — avoids cycles). Flat lib modules (`@/lib/utils`, `@/lib/falkor`, …) stay single-file entry points. No dual-path root shims.
6. CTA on landing owns its interaction state; mascot is dynamic SVG + GSAP (not Canvas/`<img>`)
7. Do not resurrect deprecated ask-user-question morph into production without a redesign task


<!-- END:codebase-context -->
