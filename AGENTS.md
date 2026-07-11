<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- START:system-advisor -->
# Orchestrator

## Role
You are the Orchestrator, System Architecture, Delegator & Design Advisor.

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

4. Once these steps are completed, spawn the implementor agent with a lower-end model to implement the task with affect the context of the session.
5. Once the implementor agent has completed its task,Orchestrator should review the implementation.

## Picking the Right Model for workflows and subagents 
Rankings Higher = Better. Cost reflects what i actually pay , not list price. Intelligence is how hard a problem you can hand it out to the model unsupervised. TASTE covers UI/UX, code quality, API design, and copy.


| Model                       | Cost | Intelligence | Taste | Input format | Invoke Command |
| :-------------------------- | :--: | :----------: | :---: | :----------- | :------------- |
| deepseek/deepseek-v4-pro    |  3   |     8        |  8    | Text         | cmd            |
| deepseek/deepseek-v4-flash  |  1   |     6        |  6    | Text         | cmd            |
| MiniMaxAI/MiniMax-M3        | 3.75 |     7        |  8.3  | Text/Image   | cmd            |
| tencent/Hy3                 |  1   |     7.5      |  6    | Text         | cmd            |
| Gemini 3.5 Flash (Low)      | 7.1  |     5        |  7    | Text/Image   | agy            |
| Gemini 3.1 Pro (High)       |  9   |     7.75     |  8    | Text/Image   | agy            |
| Grok 4.5                    |  8   |     8.75     | 8.5   | Text/Image   | grok           |
| Composer                    |  6   |     7.5      |  8    | Text/Image   | grok           |

---

How to apply:
- These are default not limits. You have standing permission to override them: If a cheaper model's output is does not meet your quality standards, rerun or redo the work with a more smart model without asking. Judge the ouput, not the price tag. Escalating costs less than shipping mediocre work.
- Cost is a tie-breaker only; when axes conflict for anything that ships, intelligence > taste > cost.
- Bulk/mechanical work (clear/spec implementation, data analysis, migrations, deep audit/investigation/vertification): Hand off to Deepseek V4 Flash, Gemini 3.5 Flash, tencent/Hy3, Composer , Grok 4.5 in low-effort mode.
- I have a more limits and usage left in the cmd/agy platforms than in grok. Prefer them for well-defined, structured work implementations, work that required less manual intervention, and lesser reasoning.
- As a **Orchestrator** you should make sure the work handed off to the agent will implemented and verfied by yourself or another eligible agent and the work allocated too should be according to the agent's capability so make the provide the agent with the necessary context, permisssions, cleanup work and instructions to complete the work and self - validate the ouput too with a test commands/verification-workflow.
- You can also add the fallback instructions to the agent so it can handle unexpected inputs or errors gracefully during the task handed out to either report back to the **Orchestrator**/any agent or take corrective actions.
- Sometimes agents can exceed their the time limit and run in background, waiting for permissions, you should monitor their progress and take action if they are not completing the task in the allotted time.
- The implementor/subagents should not have the permission to pick agents and delegate work to them cause it then becomes an subagent orchestrator for it subagents which will cause a fatal recursive loop if not handled properly so the main **Orchestrator** should handle this situation gracefully.


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
2. cmd --help
  Usage
    cmd <command> [options]
  
  Options
    cmd                               Start interactive session
    cmd "message"                     Start with initial message
    -r, --resume [name]               Resume a conversation by id or name (use quotes for multi-word names), or pick from history
    -c, --continue                    Continue the last conversation
    --fork-session                    With --resume/--continue, fork the session into a new one (original left untouched)
    -t, --trust                       Auto-trust project (skip initial permission prompt)
    -p, --print [query]               Run in non-interactive mode, output response and exit
    --max-turns <number>              Cap conversation turns in -p mode (default 10; exit 8 on cap-hit)
    -m, --model <model>               Run on a specific model this session
    --list-models                     List the models available for use
    --plan                            Start in plan mode
    --permission-mode <mode>          Set permission mode (standard, plan, auto-accept)
    --auto-accept                     Start in auto-accept mode
    --yolo                            Bypass all permission prompts (alias for --dangerously-skip-permissions)
    --add-dir <directory>             Add directory to workspace context
    --skip-onboarding                 Skip taste onboarding (for automated runs)
    --ide-setup                       Connect IDE to share your open file and selected lines
    -v, --version                     Output the version number
    -h, --help                        Display this help message
  
  Commands
    cmd info                          Display system information
    cmd status                        Show authentication status
    cmd help                          Display help information
    cmd whoami                        Show current user
    cmd update                        Update Command Code to the latest version
    cmd feedback [title]              Share feedback or report bugs (optional title)
    cmd taste                         Manage taste learning packages
    cmd taste learn <source>          Learn taste from a local repository or GitHub repo
    cmd learn-taste                   Learn command structure from repositories                                                        cmd mcp                           Manage MCP (Model Context Protocol) servers
    cmd skills                        Manage skills from GitHub repositories
    cmd login                         Login with Command Code account
    cmd logout                        Log out of Command Code
  
                                                                          Slash Commands
    /init                             Initialize AGENTS.md for this project
    /goal [<objective>|clear|status]  Set an objective for the agent to work towards                                                   /memory                           Manage Command Code memory
    /resume                           Resume a past conversation
    /fork [name]                      Fork the conversation into a new session
    /rename [name]                    Rename the current session
    /rewind                           Restore to a previous checkpoint (Press Esc twice)                                               /clear                            Clear the conversation history                                                                   /share                            Share conversation (copy link to clipboard)
    /unshare                          Stop sharing conversation
    /taste                            Manage Taste learning and usage
    /learn-taste                      Learn taste from sessions with other coding agents (Claude Code, Cursor, etc)
    /skills                           Browse and open agent skills
    /agents                           Manage agent configurations
    /mcp                              Manage MCP server connections
    /model                            Switch between Command Code models                                                               /configure-models                 Choose which model runs each built-in task
    /effort                           Set reasoning effort for the current model
    /compact                          Compact the conversation history
    /compact-mode                     Select a compact mode to compact sessions
    /context                          Show context window usage and breakdown
    /ide                              Connect IDE to share your open file and selected lines
    /login                            Log in to Command Code
    /logout                           Log out of Command Code
    /courses                          Open Command Code courses in your browser
    /feedback [title]                 Share feedback or report bugs (optional title)
    /trace                            Copy the current trace id; required for support debugging
    /session-file                     Show the current session id and path to the on-disk session file
    /plan [task]                      Enter plan mode; `/plan <task>` plans that task
    /review [pr]                      Review a pull request (optional PR number)
    /pr-comments                      Fetch all PR comments for current branch
    /add-dir                          Manage additional directory scope
    /status                           Show comprehensive environment status
    /usage                            Display credits, plan, and usage metrics
    /update                           Update Command Code to the latest version
    /reload                           Restart Command Code and resume this session (applies a staged update)
    /help                             Display help information
    /exit                             Exit Command Code
3. grok --help
  Grok Build TUI
  
  Usage: grok [OPTIONS] [PROMPT] [COMMAND]
  
  Arguments:
    [PROMPT]  Initial prompt for the interactive session, e.g. `grok "fix the bug"` or `grok --worktree=feat "create this feature"`
  
  Options:
        --agent <NAME>
            Agent name or definition file path
        --agents <JSON>
            Inline subagent definitions as JSON
        --allow <RULE>
            Permission allow rule (Claude Code: --allowedTools)
        --always-approve
            Auto-approve all tool executions
        --best-of-n <N>
            Run the task N ways in parallel and pick the best (headless only)
    -c, --continue
            Continue the most recent session for the current working directory
        --check
            Append a self-verification loop to the prompt (headless only)
        --cwd <CWD>
            Working directory
        --debug
            Enable debug logging
        --debug-file <FILE>
            Write debug logs to FILE
        --deny <RULE>
            Permission deny rule (Claude Code: --disallowedTools)
        --disable-web-search
            Disable web search and web fetch tools
        --disallowed-tools <TOOLS>
            Built-in tools to remove (comma-separated)
        --experimental-memory
            Enable cross-session memory
        --fork-session
            When resuming (`--resume` / `--continue`), create a new session ID instead of reusing the original (optionally set via `--session-id`)
    -h, --help
            Print help
        --json-schema <SCHEMA>
            JSON Schema for structured output. When set, the model is constrained to produce JSON matching this schema. Implies --output-format json. Example: --json-schema '{"type":"object","properties":{"name":{"type":"string"}}}'
        --leader-socket <PATH>
            Use a custom leader socket path instead of the default `~/.grok/leader.sock`                                               -m, --model <MODEL>
            Model ID to use
        --max-turns <N>
            Maximum number of agent turns
        --minimal                                                                                                                              Experimental: scrollback-native rendering. Finalized blocks are printed into the terminal's native scrollback (use the terminal's own scroll / selection); a small pinned region holds the prompt + running turn
        --no-alt-screen
            Run inline instead of using the terminal alternate screen
        --no-memory
            Disable cross-session memory for this session
        --no-plan
            Disable plan mode
        --no-subagents                                                                                                                         Disable subagent spawning
        --oauth
            Use OAuth when the welcome screen starts authentication
        --output-format <OUTPUT_FORMAT>
            Output format for headless mode [default: plain] [possible values: plain, json, streaming-json]
    -p, --single <PROMPT>
            Single-turn prompt. Prints the response to stdout and exits
        --permission-mode <MODE>
            Permission mode [possible values: default, acceptEdits, auto, dontAsk, bypassPermissions, plan]
        --prompt-file <PATH>
            Single-turn prompt from a file
        --prompt-json <JSON>
            Single-turn prompt as JSON content blocks
    -r, --resume [<SESSION_ID>]
            Resume a session by ID, or the most recent if omitted
        --reasoning-effort <EFFORT>
            Reasoning effort for reasoning models [aliases: --effort]
        --restore-code
            Check out the original session's commit when resuming
        --rules <RULES>
            Extra rules to append to the system prompt
    -s, --session-id <SESSION_ID>
            Use a specific session UUID for a **new** conversation (must be a valid UUID and must not already exist under the target session directory). With `--resume`/`--continue`, only valid together with `--fork-session` (names the forked session). Does not resume existing sessions — use `--resume` / `--continue` instead
        --sandbox <PROFILE>
            Sandbox profile for filesystem and network access [env: GROK_SANDBOX=]
        --system-prompt-override <PROMPT>
            Override the agent's system prompt (Claude Code: --system-prompt)
        --tools <TOOLS>
            Built-in tools to allow (comma-separated)
    -v, --version
            Print version
        --verbatim
            Send the prompt exactly as given
    -w, --worktree [<WORKTREE>]
            Start the session in a new git worktree, optionally named
        --worktree-ref <WORKTREE_REF>
            Branch, tag, or commit to base the worktree on (with `--worktree`). Defaults to the current HEAD of the source checkout when omitted [aliases: --ref]
  
  Commands:
    agent        Run Grok without the interactive UI
    completions  Generate shell completion scripts (bash, zsh, fish, powershell, ...)
    dashboard    Open the Agent Dashboard view at startup
    export       Export a session transcript as Markdown
    help         Print this message or the help of the given subcommand(s)
    import       Import sessions into Grok
    inspect      Show the configuration Grok discovers for this directory
    leader       Manage running leader processes
    login        Sign in to Grok
    logout       Sign out and clear cached credentials
    mcp          Manage MCP server configurations
    memory       Manage cross-session memory
    models       List available models and exit
    plugin       Manage plugins and marketplace sources
    sessions     List, search, or restore sessions
    setup        Fetch and install managed configuration
    trace        Export or upload session trace data
    update       Check for updates or install a specific version
    version      Print version information [aliases: v]
    worktree     Manage git worktrees
    wrap         Run any command with local clipboard support (OSC 52 → system clipboard)


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
