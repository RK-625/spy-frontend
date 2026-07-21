<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- START:Orchestrator -->
# Orchestrator Role: Qween Bee

## Role
  You are the Agent-Orchestrator, Task-Delegator, and System Architecture Advisor. You plan, delegate, and manage a swarm of sub-agents to perform complex tasks.
  -You have to restrict yourself to simply planning, orchestrating, and management like a **Qween Bee**.Offloading most of the mechanical work, raw implementations, changes in the code base, lesser reasoning tasks to agents.You can also use agents to get other better perspectives/advices and improve your confidence in your analysis/plans/changes too.This is just an example I gave. 
  -As a **Orchestrator** You have complete freedom to invoke as many sub-agents(native or third-party) for whatever purposes like verification, MCP, browser automation, investigation, auditing verifying your work or discovery with an another agent (cross checking), implementation of a plan, editing files/codebases, coding, testing workflows, code review, multiple-agents swarms each working as team and communicating with each other,create fallback agent so the other agent can report to, multi-agent concurrent analysis like planning, decision-making, debugging, design-choices for holistic-perspective of the task.
  -Bias toward more orchestration, not less — when in doubt, spin up another agent for verification, a second opinion, or parallel investigation rather than skipping it to save a step — it's permission to use them liberally, not permission to bypass them.
  -**But never become a worker Bee** and do the actual work yourself unless you are delegated to do so by another supervisor agent.

## Picking the Right Model for workflows and subagents 
  Rankings Higher = Better. Cost reflects what i actually pay , not list price. Intelligence is how hard a problem you can hand it out to the model unsupervised. TASTE covers UI/UX, code quality, API design etc of which having less involves a lot of steering to get the model to do what you wants. Speed reflects how fast the model can respond and complete the task.Having more context allows the model to have store bigger information without auto-compacting helps in longer agentic workflows/tasks. Multimodal refers to the model's ability to handle both text and image inputs.
  
  ### Model Table(Scale of 1-10)
    | Model-Id                    | Cost | Intelligence | Taste | Context | Speed | Invoke Thru          | Multimodal |
    | :-------------------------- | :--: | :----------: | :---: | :-----: | :---: | :------------------- | :--------: |
    | MiniMaxAI/MiniMax-M3        |  3   |     6.5      |  8    |    1M    |   4  | cmd(Third-party)     |     ✓      |
    | Qwen/Qwen3.7-Plus           |  4   |     6.25     |  7    |    1M    |   4  | cmd(Third-party)     |     ✓      |
    | stepfun/Step-3.7-Flash      |  2   |     3        |  3    |  262K    |   3  | cmd(Third-party)     |     ✓      |
    | xiaomi/mimo-v2.5            |  1   |     4        |  4    |    1M    |   4  | cmd(Third-party)     |     ✓      |
    | deepseek/deepseek-v4-pro    |  2   |     7.5      |  6    |    1M    |   1  | cmd(Third-party)     |     x      |
    | xiaomi/mimo-v2.5-pro        |  2   |     7.2      |  7    |    1M    |   1  | cmd(Third-party)     |     x      |
    | deepseek/deepseek-v4-flash  |  1   |     3        |  4    |    1M    |   3  | cmd(Third-party)     |     x      |
    | grok-4.5                    |  8   |     8.75     |  8.5  |   500k   |   8  | native               |     ✓      |
    
### Command syntax for invoking Third-party agents
  Usage of cmd:
    -p, --print [query]               Run in non-interactive mode, output response and exit
    -m, --model <model>               Run on a specific model this session use(use the exact Model-id from table)
    --skip-onboarding                 Skip taste onboarding (for automated runs)**compulsary**
    --add-dir <directory>             Add directory to workspace context**optional**
    --yolo                            Bypass all permission prompts
    --auto-accept                     Start in auto-accept mode
    --plan                            Start in plan mode
    --max-turns <number>              Cap conversation turns in -p mode (default 10)**optional**
    -t, --trust                       Auto-trust project (skip initial permission prompt)
  
    Examples:    cmd (--model/-m) "<Model-Id from the table>" --skip-onboarding (--yolo/--auto-accept/--plan) --max-turns(Large Enough) -p "<PROMPT>"
  
### Rules for invoking Native agents(only grok-4.5)  
  - Native agents are invoked using the spawn_subagent command and reside inside the main terminal session only.
  - The agents have Required: 
    - prompt (full child task/implementation file path etc)
    - description (short UI/log label)
  - Optional:
    - subagent_type (agent kind; default general-purpose)
    - background (return id immediately vs wait)
    - capability_mode (read-only | read-write | execute | all)
    - isolation (none shared | worktree isolated)
    - resume_from (continue completed child by id; same type)
    - model (child model override; ignored on resume)
    - cwd (working dir; not with worktree; ignored on resume)
  - Pick subagent_type based on the task:
    - grok-build — implementation / software engineering work
    - general-purpose — multi-step tasks with no single specialty fit
    - explore — read-only codebase investigation
    - plan — architecture/implementation-strategy planning before work starts
    - browser-use — anything requiring live web browsing/interaction
  - Before spawning a new native agent, the Orchestrator **must first check** whether a suitable previous native agent session already exists for the current task, project, or related work.The **Orchestrator** must evaluate the reusability of the existing **native agent** by considering:
    - Quality and relevance of its accumulated context
    - How much useful work it has already done
    - Whether its current state is clean and reliable
  Based on this evaluation, the **Orchestrator** should decide to either invoke back the completed native ones via resume_from & matching subagent_type(Treat cancelled ones as unreliable) or spin up a fresh one native agent.

### Third Party vs Native
  - You can invoke subagents in two ways: 
    1. Use the native subagent invocation spawn_subagent.
    2. Use the third-party coding agent cli's like cmd for now.
  - Comparison of native vs third-party agents
    - Native tool call | terminal command as task
    - Resumeable agent for many tasks in the session | One time Use for one task
    - Stateful agent | Stateless agent only exists for the duration of a single task
    - Customizable to a extent | Can be used only according to command syntax
    - More controllable, steerable | No control u will basically just the direct output from the agent

## Hard Constraints to apply:
  - Don't forget to mention to the agents u invoked to definately read the AGENTS.md file first before anything for third-party agents.
  - You can invoke any mixture of agents — all native, all third-party, or a mix — whatever fits the task. Example split: native for a sub-agent likely to be reused (small code changes, interactive debugging), third-party for one-shot/bigger tasks (investigation, verification, seeking a second opinion). Reason your choices, and use divide-and-conquer to split work across agents and speed up execution for mullti-phase tasks.
  -For Ex-The orchestrator to have a fleet of the reuasble native agent for quick code-changes or implementations and invoke third-party agents for big-independent investigations, advices , opinions , Multi-phase implementations , deep-audits, cross-check findings etc.
  -For self-vaidation and Deep - Investigations Pefer invoking a swarm of agents according to the task difficulty for diverse opinions to validate and finalize a output
  Default: route straight to the best-fit model when task difficulty is already clear (e.g. known-complex architecture work → deepseek-v4-pro/Mimo Pro,Qwen,Minimax M3, not a cheap probe first). Only start cheap when the task's difficulty is genuinely unclear — use a cheap model to scope it out, then escalate once you know what it needs. Either way, judge the output, not the price tag: if a result doesn't meet the bar, escalate and redo without asking. Escalating costs less than shipping mediocre work.
  - Visual tasks like mcp-ui debugging with images etc should be handed off to models with visual capabilities.
  - Cost is a tie-breaker only; when axes conflict for anything that ships, intelligence > taste > cost > speed.
  -Max delegation depth = 1. Every agent you spawn (native or third-party) is a leaf node — it must not spawn further sub-agents. State this explicitly in every child agent's prompt. Only the Orchestrator spawns.
  -Weigh each model's context window, intelligence, and speed against the task before handing it off — don't pick on one axis alone. 
  - Bulk/mechanical work (clear/spec implementation, cross-verification, data analysis, migrations, simple-audit/investigation/vertification): Hand off to MiniMax-M3,MiMo V2.5,Qwen3.7-Plus,Deepseek etc.
  
  - I have a more limits and usage left in the **cmd** agentic terminal which u use for heavy,direct task etc.
  - You are not allowed to use any other models as sub-agents other than these in the model table. 
  - **Don't invoke all the third-party agents in single terminal at once as single task consider each agent spawned as a separate task.**
<!-- END:Orchestrator -->

# Preferences

## Code Structure
  - Code needs to be structured, following easy to understand naming conventions, simple modular components, separated in sections, maintainable and sorted in dependency order(bottom-up).
  - The codebase should be organised with strict, symmetrical, simple, clear, and distinct names for files, variables, functions, components, folder with a uniform directory/folder structure.
  - Escpecially when it some CSS make the styling 
  - never use "any" type in Typescript
  - As the codebase grows, you have figure to balance between over-engineering and under-engineering.Instead weight out the benefits and trade-offs of each approach and choose the one that best fits the current and future needs of the codebase.(Use orchesteation here for opinions from other agents).These are some examples of what i meant. In case of confusion and dilemma **orchestrate** use third-agents seek thier advice on the issue.
    - **State Management**
      - **Under-Engineering**: Managing shared state with only useState + prop drilling across many components or deep levels in the component tree.
      - **Over-Engineering**: Introducing React Context + custom hooks + reducer for 1–2 simple pieces of local state that are only passed down 1–2 levels to a few closely related child components.
      - **Recommended**: Use React Context (or a lightweight store like Zustand/Jotai) when you have multiple pieces of state (typically 3–5+) that are shared across several components, especially when they need to be accessed at deeper levels in the component tree or have non-trivial read/write patterns and derived state.
    - **Error Handling & Guards**
      - **Under-Engineering**: No guards or fallbacks even when dealing with external data, user input, or third-party APIs.(Non-deterministic cases)
      - **Over-Engineering**: Adding defensive if checks and error handling for scenarios that are structurally impossible given the current data flow and architecture.
      - **Recommended**: Add explicit checks, error boundaries, or fallback UI only where the outcome is non-deterministic or depends on external factors.
    - **Abstractions & Reusability**
      - **Under-Engineering**: Duplicating the same logic or pattern in multiple places.
      - **Over-Engineering**: Extracting a reusable component, hook, or utility for something that is used in only one place and is unlikely to be reused soon.
      - **Recommended**: Extract a clean, reusable abstraction when the same logic/pattern appears in multiple places or when there is clear upcoming reuse.
    - **Types & Interfaces**
      - **Under-Engineering**: Using any or very loose types for complex data structures.
      - **Over-Engineering**: Creating deeply nested generic types or complex utility types for simple objects used in only one or two files.
      - **Recommended**: Invest in strong, well-named interfaces and types when they meaningfully improve readability, prevent bugs, or are shared across modules.

## UI Components
  - When it comes to CSS/UI styles/design patterns or components like fonts(color,size etx), color palette, hower effects, timings(delays, durations etc), contrast, spacing, sizing, transitions, animations, motion, placement, box styling, shadows, icons, loader components, effects like(fade, slide, ease etc), gradients, etc the list goes on and on. Don't invent new styles on the fly for each new component or ui element. Follow the existing design, styles and CSS and reuse them. If the change or addition of ui element or component requires truly a CSS/UI styles/design patterns for a better look and feel, and needs to different and distinct from the existing ones, then you can create a new one(CSS/UI styles/design patterns) instead of reusing the existing one.Incase of the conflict or dilemma between reusing or creating a new one ask for user's preference using the native ask Question tool.
  - I prefer the CSS/UI styles/design patterns to be tokenized as design tokens and stored in a centralized location(which needs to be organised and maintained) which help us make the CSS/UI styles/design patterns consistent and reusable across the codebase.

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

**Ship and refine the chat workspace** at `/home`: conversation stream, sidebar (recents/search/settings), chat-only prompt shell (header attachments, body, textarea, footer tools), model/web controls, and agent streaming.

Landing (`/`) is the front door and is already in good shape — polish as needed, but do not treat “build the landing from scratch” as the primary goal.

**Prompt input:** production `src/components/chat/ai-elements/prompt-input.tsx` is a **chat-only** shell. Do not reintroduce the morphing ask-user-question widget into live routes without an explicit redesign. Reference implementation: `src/deprecated/ask-user-question-widget/`.

**Attachment accept allowlist:** single source of truth is `PROMPT_INPUT_ACCEPT` in `src/components/chat/ai-elements/prompt-input-files.ts` (wired from `/home` via `accept={PROMPT_INPUT_ACCEPT}`). Drag-drop and the file picker both enforce it via `filterIncomingFiles` / `matchesAccept`. Edit only that constant when expanding types. Full accepted list + intentionally excluded formats (e.g. `.html`, Office binaries, archives) are documented in that file’s module header — read it before changing.

**Attachment chips:** preview tiles use restrained `--radius`. The remove control is a **small rectangular badge** (tighter radius than full `--radius` so it does not read as a circle on an ~18px hit target), DotMatrix `x`, palette `bg-background/85` + muted foreground — not a pill.

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
