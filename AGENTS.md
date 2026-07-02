<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
<!-- kirograph:codex:start -->
## KiroGraph

# KiroGraph

KiroGraph builds a local semantic knowledge graph of this codebase. When the `kirograph` MCP server is available, prefer its tools over broad grep/glob/file-read exploration.

## Quick decision guide

| Question | Tool |
|----------|------|
| Where do I start on this task? | `kirograph_context` |
| What is this symbol / show me its code | `kirograph_node` with `detail: "signatures"` |
| Find a symbol by name | `kirograph_search` |
| Who calls function X? | `kirograph_callers` |
| What does function X call? | `kirograph_callees` |
| What breaks if I change X? | `kirograph_impact` |
| What files are indexed? | `kirograph_files` |
| Is the index healthy? | `kirograph_status` |
| How are X and Y connected? | `kirograph_path` |
| Which code is never called? | `kirograph_dead_code` |
| Are there import cycles? | `kirograph_circular_deps` |
| What extends / implements this type? | `kirograph_type_hierarchy` |

| What are the most critical symbols? | `kirograph_hotspots` |
| Any unexpected cross-module coupling? | `kirograph_surprising` |
| What changed since the last snapshot? | `kirograph_diff` |
| Semantic context for my current changes? | `kirograph_flows` |
| What packages/layers exist? | `kirograph_architecture` |
| How coupled is package X? | `kirograph_coupling` |
| What does package X depend on? | `kirograph_package` |
| Run a command with token savings | `kirograph_exec` |
| Check token savings stats | `kirograph_gain` |
| Read a file (cached) | `kirograph_read` |
| Compress text or shell output before sending | `kirograph_compress` |
| Search past decisions/patterns | `kirograph_mem_search` |
| Store an observation | `kirograph_mem_store` |
| Find a doc section | `kirograph_docs_search` |
| Get doc table of contents | `kirograph_docs_toc` |
| What datasets are indexed? | `kirograph_data_list` |
| Query rows with filters | `kirograph_data_query` |
| Aggregate data server-side | `kirograph_data_aggregate` |
| Are there vulnerable dependencies? | `kirograph_security` |
| Which CVEs affect my project? | `kirograph_vulns` |
| Is this vulnerability reachable? | `kirograph_reachability` |
| What licenses do my deps use? | `kirograph_licenses` |
| Are dependencies outdated? | `kirograph_staleness` |
| Find structural code patterns? | `kirograph_live_search` |
| Browse SAST rules | `kirograph pattern --list` |
| Look up project knowledge | `kirograph_wiki_search` |
| Update wiki with new knowledge | `kirograph_wiki_ingest` + `kirograph_wiki_apply_diff` |

## Tool selection

- Start code tasks with `kirograph_context`; use `detail: "signatures"` to reduce tokens when full source isn't needed yet.
- Find symbols by name with `kirograph_search`.
- Inspect a symbol with `kirograph_node`; use `detail: "full"` only when source is needed.
- Trace call flow with `kirograph_callers` and `kirograph_callees`.
- Check blast radius before edits with `kirograph_impact`.
- Use `kirograph_files` to inspect indexed file structure.
- Use `kirograph_status` if results seem stale or incomplete.
- Use `kirograph_path` to explain how two symbols connect.
- Use `kirograph_type_hierarchy` for inheritance/interface questions.
- Use `kirograph_hotspots`, `kirograph_surprising`, and `kirograph_diff` for refactor planning and review.
- Use `kirograph_architecture`, `kirograph_coupling`, and `kirograph_package` for package/layer questions.


## Workflow

1. Call `kirograph_context` for orientation.
2. Drill into specific symbols with `kirograph_node`.
3. Use graph traversal tools before reading unrelated files.
4. Fall back to normal filesystem tools only when the graph is missing, stale, or lacks the needed detail.

If `.kirograph/` does not exist, ask whether to run `kirograph init --index`.

## Shell Compression (`kirograph_exec`)

When running shell commands, prefer `kirograph_exec` over raw shell execution for:
- **git** operations (status, log, diff, push, pull, commit, add, fetch, branch)
- **GitHub CLI** (gh pr list/view, gh issue list, gh run list)
- **test runners** (jest, vitest, pytest, cargo test, go test, rspec, minitest, playwright)
- **linters/build** (eslint, tsc, ruff, clippy, cargo build, prettier, biome, golangci-lint, rubocop, next build)
- **file listings** (ls, find, tree)
- **search** (grep, rg/ripgrep: grouped by file)
- **diff** (diff file1 file2: condensed context)
- **docker/k8s** (docker ps, images, logs, compose ps, kubectl pods, logs, services)
- **package managers** (npm/pnpm install/list, pip list/install, bundle install, prisma generate)
- **AWS CLI** (sts, ec2, lambda, logs, cloudformation, dynamodb, iam, s3, ecs, sqs, sns)
- **network** (curl, wget: strip progress bars and headers)

This saves 60-90% of tokens compared to raw output.

Compression level: **normal**: Balanced: removes noise, keeps structure.

```
kirograph_exec(command: "git status")
kirograph_exec(command: "npm test")
kirograph_exec(command: "cargo build")
kirograph_exec(command: "ls -la src/")
```

**Important:** Error details are always preserved. Failed commands show full diagnostic output regardless of level.

**Do NOT re-run commands:** When `kirograph_exec` returns a result, treat it as the final answer. Never re-run the same command with raw shell execution to "get more details." The compressed output preserves all essential information. If you genuinely need something missing from the output, explain what's missing before making a second call.

Use `kirograph_gain` to check token savings statistics.

## Memory

KiroGraph has persistent memory. Use `kirograph_mem_search` to recall past decisions,
errors, and patterns before making changes. Use `kirograph_mem_store` to save important
observations (architecture decisions, bug root causes, patterns discovered).

Memory is searchable via hybrid FTS + vector search. Observations are automatically
linked to code symbols in the graph and surface in `kirograph_context` and
`kirograph_impact` results when relevant.

**When to store:** After fixing a bug, making an architecture decision, discovering a pattern,
encountering a non-obvious error, or learning something about the codebase that future sessions
should know. Keep observations concise — one fact per store call.

## Architecture

KiroGraph analyzes the package structure and layer dependencies of the codebase.

- `kirograph_architecture` — full package graph, detected layers (api/service/data/ui/shared), dependency edges
- `kirograph_coupling` — Ca (afferent), Ce (efferent), instability per package; high Ca = load-bearing, high Ce = volatile
- `kirograph_package` — drill into a single package: coupling metrics, deps, dependents, files

Use `kirograph_architecture` for architectural questions instead of reading directory trees.
High Ca + low instability = risky to change interface. High Ce + high instability = safe to refactor internals.

## Documentation

KiroGraph indexes project documentation by heading structure. Use `kirograph_docs_search`
to find relevant sections instead of reading entire files.

- `kirograph_docs_toc` — table of contents for a file or the whole project
- `kirograph_docs_search` — search sections by query
- `kirograph_docs_section` — retrieve full section content by ID
- `kirograph_docs_outline` — heading hierarchy for a single file
- `kirograph_docs_refs` — code ↔ doc cross-references

Before reading a doc file directly, try `kirograph_docs_search` or `kirograph_docs_outline` first.

## Data

KiroGraph indexes tabular data files (CSV, TSV, JSONL, JSON, Excel, Parquet).

- `kirograph_data_list` — list all indexed datasets
- `kirograph_data_describe` — schema profile: column names, types, cardinality, samples
- `kirograph_data_query` — filtered row retrieval (eq, gt, contains, in, between)
- `kirograph_data_aggregate` — server-side GROUP BY: count, sum, avg, min, max

Use `kirograph_data_describe` before reading a data file. Use `kirograph_data_query` with
filters instead of loading all rows. Use `kirograph_data_aggregate` for statistics.
This saves 95-99% of tokens compared to reading raw data files.

## Security

KiroGraph scans dependency manifests across 14 ecosystems for known vulnerabilities, performs
call-graph reachability analysis, tracks EPSS exploitation probability, checks license
compliance, and monitors dependency staleness.

**Available tools:**
- `kirograph_security` — overview: dep count, CVE count, verdict breakdown, stale warnings
- `kirograph_vulns` — list CVEs with severity, EPSS score, reachability verdict, fix suggestion
- `kirograph_reachability` — call paths, entry points, affected layers for one CVE or package
- `kirograph_licenses` — list dependency licenses; flag policy violations
- `kirograph_staleness` — identify outdated dependencies (staleness score 0.0–1.0)
- `kirograph_sbom` / `kirograph_vex` — export CycloneDX 1.5 SBOM and VEX documents
- `kirograph_vuln_add` — manually register a private/internal CVE

**Proactive triggers:** Run `kirograph_security` when a dependency is added/updated, before a
production deploy, or when the user asks about security/compliance.

**Interpreting verdicts:**
- `affected` — a call path exists from an entry point to the vulnerable code. Act on this.
- `not_affected` — no reachable path found. Strong signal: likely safe.
- `under_investigation` — unresolved symbols in traversal. Treat with caution.

**EPSS scores:** >= 0.5 = patch immediately; 0.1–0.5 = elevated risk; < 0.1 = low probability.

**Workflow:** `kirograph_security` → `kirograph_vulns --verdict affected` → `kirograph_reachability <cve>` → fix → `kirograph_vulns --refresh`

## Wiki

KiroGraph maintains a structured LLM wiki — a set of markdown pages that compound knowledge
across sessions. Consult it before starting a complex task, and update it after sessions that
produce durable knowledge.

**Available tools:**
- `kirograph_wiki_search` — full-text search over wiki pages
- `kirograph_wiki_page` — retrieve a page by slug
- `kirograph_wiki_list` — list all pages
- `kirograph_wiki_ingest` — build an ingest prompt for a source text
- `kirograph_wiki_apply_diff` — apply a WIKI_DIFF to create or update pages
- `kirograph_wiki_lint` — health check: broken links, orphans, contradictions

**Ingest workflow (two-tool):**
1. `kirograph_wiki_ingest(source: "...", sourceName: "...")` — get the structured prompt
2. Generate a `WIKI_DIFF_START ... WIKI_DIFF_END` block from the prompt
3. `kirograph_wiki_apply_diff(diff: "...")` — apply it; review conflicts in the response

**When to consult:** Before starting complex work, search for relevant wiki pages.
**When to update:** After sessions with architecture decisions, API contracts, or process knowledge.

## Pattern Search

KiroGraph supports AST structural pattern search via `kirograph_live_search` (only available when `enablePatterns: true` and `@ast-grep/napi` is installed).

- `kirograph_live_search` — find any structural code pattern across the indexed file list
- `kirograph pattern --list` — browse 10 bundled SAST rules (SQL injection, eval, path traversal, etc.)
- `kirograph pattern --library <id>` — run a specific library rule

Use `kirograph_live_search` when you need to find patterns that can't be expressed as symbol names: anonymous functions, specific code structures, or security anti-patterns.

## Session Hygiene

This tool does not have automatic sync hooks. To keep the index fresh:
- Run `kirograph sync` at the **start** of each session if files changed outside the agent.
- Run `kirograph sync` at the **end** of each session after making changes.
- If results from graph tools seem stale, run `kirograph sync` before retrying.
- Store important observations with `kirograph_mem_store` before ending your session.
<!-- kirograph:codex:end -->


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

