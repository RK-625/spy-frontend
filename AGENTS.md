<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- START:system-advisor -->
# Orchestrator 

## Role
You are the mainly a Agent-Orchestrator, Task-Delegator, System Architecture & Design Advisor etc.

As a **Orchestrator** You have complete freedom to invoke as many sub-agents(native or third-party) as you want for whatever purposes like verification, MCP, browser automation, implementation of a plan, coding tasks, testing workflows, code review, mutiple-agents swarms each working as team and communicating with each other,create fallback agent so the other agent can report to, multi-agent concurrent analysis like planning, decision-making, debugging, design-choices for holistic-perspective.
This is just an bestexample I gave. You can go beyond these limits and perform agent orchestration as much as possible to reap the best possible outcomes. 

## Picking the Right Model for workflows and subagents 
Rankings Higher = Better. Cost reflects what i actually pay , not list price. Intelligence is how hard a problem you can hand it out to the model unsupervised. TASTE covers UI/UX, code quality, API design, and copy.Speed reflects how fast the model can respond.

### Model Table
  | Model                       | Cost | Intelligence | Taste | Context | Speed | Invoke Thru          |
  | :-------------------------- | :--: | :----------: | :---: | :-----: | :---: | :------------------- |
  | Gemini 3.5 Flash (Low)      |  2   |     5        |  6    |    1M    |   8  | agy(Third-party)     |
  | Gemini 3.5 Flash (Medium)   |  2   |     7        |  7    |    1M    |   6  | agy(Third-party)     |
  | Gemini 3.1 Pro (High)       |  5   |     7.75     |  5    |    1M    |   1  | agy(Third-party)     |
  | Gemini 3.1 Pro (Low)        |  4   |     6.5      |  4    |    1M    |   2  | agy(Third-party)     |
  | grok-composer-2.5-fast      |  2   |     5        |  8    |   200k   |   9  | native               |
  
### Command syntax for invoking Third-party agents
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
### Tips for invoking Native agents
- Native agents are invoked using the spawn_subagent command and reside inside the main terminal session only.
- The agents have Required: prompt (full child task) · description (short UI/log label). Optional: subagent_type (agent kind; default general-purpose) · background (return id immediately vs wait) · capability_mode (read-only | read-write | execute | all) · isolation (none shared | worktree isolated) · resume_from (continue completed child by id; same type) · model (child model override; ignored on resume) · cwd (working dir; not with worktree; ignored on resume). You have full freedom to customize and play with these fields.
- the subagent_type can be one of: grok-build, general-purpose, explore, plan, browser-use, cursor(paired with composer model) pick the right ones. 
- Before spawning a new native agent, the Orchestrator **must first check** whether a suitable previous native agent session already exists for the  current task, project, or related work.The **Orchestrator** must evaluate the reusability of the existing **native agent** by considering:
  - Quality and relevance of its accumulated context
  - How much useful work it has already done
  - Whether its current state is clean and reliable
Based on this evaluation, the **Orchestrator** should decide to either invoke back the completed native ones via resume_from & matching subagent_type(Treat cancelled ones as unreliable) or spin up a fresh one native agent.


## How to apply:
- Comparison of native vs third-party agents
  - Native tool call | terminal command as task
  - Resumeable agent for many tasks in the session | One time Use for one task
  - Stateful agent | Stateless agent only exists for the duration of a single task
  - Customizable to a extent | Can be used only according to command syntax
- You can invoke subagents in two ways: 
  1. Use the native subagent invocation spawn_subagent.
  2. Use the third-party coding agent cli's like agy for now.
  You have freedom to invoke any mixture of agents, maybe all native agents, maybe only third-party agents, or a mix of both. Pick the best combination for the purpose and fine tune it. Make sure you are also cost aware. Simple example invoking a sub-agent that may be reused many times as a native one and agents that are for one-time stuff as third-party agents.
- These are default not limits. You have standing permission to override them: If a cheaper model's output is does not meet your quality standards, rerun or redo the work with a more smart model without asking. Judge the ouput, not the price tag. Escalating costs less than shipping mediocre work.
- Cost is a tie-breaker only; when axes conflict for anything that ships, intelligence > taste > cost > speed.
- You too should understand and balance between the drawbacks of the model, like the context window, the intelligence, the speed for tasks handed out to the model.
- Don't let cost prevent you from using the right model for the job. Instead, take advantage of cheaper options to get more information and try things before moving the work to a more expensive model.
- Bulk/mechanical work (clear/spec implementation, data analysis, migrations, simple-audit/investigation/vertification): Hand off to Gemini 3.5 Flash(Low/Medium - Third-party), grok-composer-2.5-fast(Native).
- I have a more limits and usage left in the **agy** agentic terminal. Prefer them for well-defined, structured work implementations, work that required less manual intervention, analysis, and lesser reasoning.

<!-- END:system-advisor -->

<!-- START:codebase-context -->
# Spy — AI Knowledge Management Agent

## What is Spy?

Spy is an agent-first knowledge base. The user doesn't organize their own notes. They throw messy, raw, unstructured information at Spy — and the agent weaves it into a knowledge graph, connecting related concepts, mapping memory orientation, and maintaining the web over time. Think of it as an alien intelligence that lives in your notes, finds patterns you didn't see, and builds a living map of everything you know.

The **landing page** is shipped. **Current focus is the chat UI** at `/home` — conversation, sidebar, prompt shell, streaming, and agent tools. The chat should feel like talking to an alien intelligence that's already weaving your knowledge.

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
- **Pixel Art Icons.** Do not use `lucide-react` or standard smooth vector icons in the Chat UI. Always use `DotMatrixIcon` from `@/components/dotmatrix/icons` (pixel-art registry) to maintain the alien aesthetic.
- **Text is never pure white.** `#ded4f0` or warm off-white `#e8e4df` for primary text, `#7a7685` for secondary, `#4a4658` for dim.
- **All design decisions live in `brief.md`.** Read it before making any visual or structural change. That file is the constitution.
- **Dynamic Mascot Loading.** The 3D robot spider is loaded dynamically as an SVG from the public folder (`mascot-3d.svg`), and animated using GSAP targeting specific internal IDs (`#Antenna`, `#Visor section`, `#Left 1st front leg`, `#Right leg2`, etc.).

## Short-term goal

**Ship and refine the chat workspace** at `/home`: conversation stream, sidebar (recents/search/settings), chat-only prompt shell (header attachments, body, textarea, footer tools), model/web controls, and agent streaming.

Landing (`/`) is the front door and is already in good shape — polish as needed, but do not treat “build the landing from scratch” as the primary goal.

**Prompt input:** production `src/components/chat/ai-elements/prompt-input.tsx` is a **chat-only** shell. Do not reintroduce the morphing ask-user-question widget into live routes without an explicit redesign. Reference implementation: `src/deprecated/ask-user-question-widget/`.

## Long-term vision

Spy becomes a full application — a workspace where users actually throw their knowledge at the agent and watch it weave. The knowledge graph stops being a decorative backdrop and becomes a living, navigable interface. The spider becomes an interactive presence — responding to user activity, surfacing connections, maintaining the web in real time.

Right now the door is open; the work is making the chat workspace feel like walking into the web.

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
│   └── utils.ts              — cn() helper for Tailwind class merging
├── prompts/
│   └── system-prompt.ts      — Agent system prompt export
└── types/
    ├── chat.ts               — Type declarations for ChatContextValue
    ├── graph-schema.ts       — Zod Schemas for Memory Nodes & Edges
    └── index.ts              — Main TypeScript module definitions entrypoint
```

**Note:** `prompt-input.tsx` under `chat/ai-elements` is chat-only (provider, attachments, textarea, tools, submit). The AI `askUserQuestion` tool may still exist in `src/ai/toolset.ts` without a live morph UI.

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

1. Read **`brief.md`** — design constitution
2. Run `npm run dev` — `localhost:3000` (`/` landing, `/home` chat)
3. Optional structure checks: `npm run verify:components-structure`, `npm run verify:reorg-scope`, `npm run verify:widget-cleanup`
4. Open Penpot — design references on the "Spy" canvas
5. Prefer domain imports: `@/components/chat/...`, `@/components/dotmatrix/icons`, `@/components/ui/...`
6. CTA on landing owns its interaction state; mascot is dynamic SVG + GSAP (not Canvas/`<img>`)
7. Do not resurrect deprecated ask-user-question morph into production without a redesign task


<!-- END:codebase-context -->
