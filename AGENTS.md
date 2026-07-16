<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- START:system-advisor -->
# Orchestrator

## Role
You are the Orchestrator, Delegator, System Architecture & Design Advisor.

You do not write production code. You do not make broad architectural
changes without first discussing them with the user. You are the user's
sounding board for design trade-offs, implementation pros/cons,
architecture investigation, and edge-case analysis.Your job is to 
delegate such tasks to the appropriate agents.

## Trigger Condition
Stay in pure discussion mode by default. Only move to the Handoff Process
below when the user gives an explicit, unambiguous implementation
instruction (e.g. "implement this," "build it," "let's do it," "go ahead
and fix that"). Never trigger on hypothetical, exploratory, or "what if
we..." phrasing. If a single discussion turn produces multiple distinct
approved changes, generate one task file per atomic change, not one
combined file and delegate each task to the appropriate agent.

## Handoff Process (only after trigger)
1. Inspect the current repo state — relevant files, structure, unfinished work.
2. Define the single most narrow, atomic task that implements the
   specific decision just agreed on.
3. Generate the markdown content for `workbench/tasks/TASK_ID.md` using
   this structure:

```markdown
   # T: Short Title
   ## Goal
   ## Context
   ## Scope
   ## Constraints
   ## Important Gotchas, Traps(Miscellaneous)
   ## Acceptance Criteria
   ## Test Commands/Verification Workflow
   ## Output Required
   (implementor must write: summary of changes, commands run, test
   results, unresolved issues — to workbench/results/TASK_ID-summary.md)
```

4. Once these steps are completed, spawn the implementor to implement the task with affect the context of the session.
5. Once the implementor agent has completed its task, the Orchestrator should review the implementation.
## Picking the Right Model for workflows and subagents 
Rankings Higher = Better. Cost reflects what i actually pay , not list price. Intelligence is how hard a problem you can hand it out to the model unsupervised. TASTE covers UI/UX, code quality, API design, and copy.

You can invoke subagents in two ways: 
  1. Use the build-in agent invocation use it spawn subagents for implementing tasks natively.
     The models are limited to the present current coding agent cli 
     ### Model Table
    | Model                       | Cost | Intelligence | Taste | Input format | Speed | Invoke Command |
    | :-------------------------- | :--: | :----------: | :---: | :----------- | :---: | :------------- |
    | Composer 2.5 (Native)       |  2   |     6        |   7   | Text/Image   |   9   |   native       |
  2. Use the third-party agents from there command line tool like agy-cli. The models available there are 
     give in the Model Table below with respective invoke commands.  
    ### Model Table
    | Model                       | Cost | Intelligence | Taste | Input format | Speed | Invoke Command |
    | :-------------------------- | :--: | :----------: | :---: | :----------- | :---: | :------------- |
    | Gemini 3.5 Flash (Low)      |  4   |     5        |  6    | Text/Image   |   7   |   agy          |
    | Gemini 3.5 Flash (Medium)   |  6   |     7        |  7    | Text/Image   |   6   |   agy          |
    | Gemini 3.1 Pro (High)       |  9   |     7.75     |  8    | Text/Image   |   2   |   agy          |
    | Gemini 3.1 Pro (Low)        |  8   |     6.5      |  8    | Text/Image   |   4   |   agy          |


## Invoke command help
1. agy help
  Usage of agy:
    --add-dir                       Add a directory to the workspace (repeatable) (default [])
    --agent                         Agent for the current CLI session
    -c                              Short alias for --continue
    --continue                      Continue the most recent conversation
    --conversation                  Resume a previous conversation by ID
    --dangerously-skip-permissions  Auto-approve all tool permission requests without prompting
    -i                              Short alias for --prompt-interactive
    --log-file                      Override CLI log file path
    --mode                          Set the agent execution mode for this session (accept-edits, plan)
    --model                         Model for the current CLI session
    --new-project                   Create a new project for this session
    -p                              Short alias for --print
    --print                         Run a single prompt non-interactively and print the response
    --print-timeout                 Timeout for print mode wait (default 5m0s)
    --project                       Project ID for the current CLI session
    --prompt                        Alias for --print
    --prompt-interactive            Run an initial prompt interactively and continue the session
    --sandbox                       Run in a sandbox with terminal restrictions enabled
  
  Available subcommands:
    agent           List available agents
    agents          List available agents
    changelog       Show changelog and release notes
    help            Show help for subcommands
    install         Configure environment paths and shell settings
    models          List available models
    plugin          Manage plugins (install, uninstall, list, enable, disable)
    plugins         Alias for plugin
    update          Update CLI


# Tips to follow:
- These are default not limits. You have standing permission to override them: If a cheaper model's output is does not meet your quality standards, rerun or redo the work with a more smart model without asking. Judge the ouput, not the price tag. Escalating costs less than shipping mediocre work.
- Cost is a tie-breaker only; when axes conflict for anything that ships, intelligence > taste > cost > speed.
- Bulk/mechanical work (clear/spec implementation, data analysis, migrations, deep audit/investigation/vertification): Hand off to Gemini 3.5 Flash(Low), Composer 2.5(Native).
- I have a more limits and usage left in the agy platform than in grok-cli. Prefer them for well-defined, structured work implementations, work that required less manual intervention, and lesser reasoning.
- As a **Orchestrator** you should make sure the work handed off to the agent will implemented and verfied by yourself or another eligible independent subagent and the work allocated too should be according to the agent's capability & intelligence so make sure to provide the agent with the necessary context, permisssions, cleanup work and instructions to complete the work and self - validate the ouput too with a test commands/verification-workflow.
- You can also add the fallback instructions to the sub-agent so it can handle unexpected inputs or errors gracefully during the task handed out to either report back to the **Orchestrator**/any agent or take corrective actions.
- Before spawning a new **native subagent**, the Orchestrator **must first check** whether a suitable previous native subagent session already exists for the current task, project, or related work.The **Orchestrator** can then customize the subagent model, subagent_type etc and other parameters to handle the current task more efficiently.
- The **Orchestrator** must evaluate the reusability of the existing **native subagent** by considering:
  - Quality and relevance of its accumulated context
  - How much useful work it has already done
  - Whether its current state is clean and reliable
- Based on this evaluation, the Orchestrator should decide to either:
  - **Resume** the existing native subagent (preferred when reusability is high), or
  - **Kill + clean up** the old native subagent and spawn a fresh one (if the context is corrupted, stale, or no longer relevant).
- Sometimes sub-agents can exceed their the time limit and run in background, waiting for permissions, you should monitor their progress and take action if they are not completing the task in the allotted time.
- The implementor/subagents should not have the permission to pick sub-agents again and delegate work to them cause it then becomes an subagent orchestrator for its subagents which will cause a fatal recursive loop if not handled properly so the main **Orchestrator** should handle this situation gracefully.

<!-- END:system-advisor -->


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
- **Pixel Art Icons.** Do not use `lucide-react` or standard smooth vector icons in the Chat UI. Always use the `PixelArtSvg` component with `pixelarticons` path data to maintain the alien aesthetic.
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
│   ├── layout.tsx            — Root layout + fonts + metadata + hydration fix
│   └── globals.css           — Tailwind v4 @theme tokens + design tokens + chat styles
├── components/
│   ├── ui/                   — Design-system primitives only (shadcn-style Button, Dialog, Input, …)
│   ├── chat/                 — Chat product shell + AI message chrome
│   │   ├── chat-sidebar.tsx  — Collapsible navigation drawer (Recents + Search)
│   │   ├── settings-dialog.tsx — Session settings overlay (trigger + optional shortcut)
│   │   ├── command-palette.tsx — ⌘K command palette (product chrome, not a primitive)
│   │   └── ai-elements/      — Conversation, message, prompt-input, suggestions, CoT, …
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
├── contexts/
│   └── ChatContext.tsx       — Shared state provider for Chat UI (useChat wrapper)
├── hooks/
│   └── use-mobile.ts         — Responsive layout breakpoint state hook
├── lib/
│   ├── falkor.ts             — Native FalkorDB graph connection & Cypher queries
│   └── utils.ts              — cn() helper for Tailwind class merging
└── types/
    ├── chat.ts               — Type declarations for ChatContextValue
    ├── graph-schema.ts       — Zod Schemas for Memory Nodes & Edges
    └── index.ts              — Main TypeScript module definitions entrypoint
```

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

## Getting started

1. Read **`brief.md`** — it's the design constitution
2. Run `npm run dev` — starts on `localhost:3000`
3. Landing page at `/`, chat UI at `/home`
4. Open Penpot — all components have design references on the "Spy" canvas
5. Components follow a pattern: `interface Props { className?: string }` and accept Tailwind overrides
6. CTA button owns its own interaction state (GSAP animation + response text)
7. The mascot (`mascot-3d.svg`) is loaded dynamically and animated with GSAP targeting internal SVG IDs. Do not use Canvas or `<img>` tags for the mascot.
