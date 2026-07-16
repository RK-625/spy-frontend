# Spy

**Spy** is an agent-first knowledge base. You throw messy notes and fragments at an alien intelligence; it weaves them into a connected knowledge graph. This repo is the Next.js frontend: landing experience, chat workspace, and agent API routes.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Route | What |
|-------|------|
| `/` | Landing (mascot, story, CTA) |
| `/home` | Chat UI (conversation, sidebar, prompt shell) |

Configure provider/API keys as needed in `.env.local` (never commit secrets).

## Docs

| File | Role |
|------|------|
| **`brief.md`** | Design constitution — color, type, chat chrome, voice, anti-references |
| **`AGENTS.md`** | Architecture map for humans and coding agents — stack, constraints, component domains |

## Project layout (high level)

```text
src/
  app/           # Routes + API (chat, etc.)
  components/
    ui/          # Design-system primitives
    chat/        # Chat shell + ai-elements (prompt, messages, CoT, …)
    landing/     # Marketing/hero surfaces
    dotmatrix/   # Pixel icons + loaders (use DotMatrixIcon from here)
    brand/logos/ # Provider marks
  deprecated/    # Archived experiments — not production routes
  ai/            # Agent streaming, tools, embeddings
  contexts/      # ChatContext, etc.
```

**Prompt input** in production is a **chat-only** shell. The old morphing “ask user question” widget lives under `src/deprecated/ask-user-question-widget/` for redesign; do not rewire it into `/home` without an explicit task.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run verify:components-structure   # domain folder / naming gates
npm run verify:reorg-scope           # rename-fidelity vs HEAD map
npm run verify:widget-cleanup        # prompt-input stays free of widget symbols
```

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · Vercel AI SDK · FalkorDB (Node runtime for DB routes) · GSAP + ShaderGradient on landing.

## License

Private / project-specific unless otherwise stated.
