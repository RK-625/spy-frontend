# Spy

**Spy** is an agent-first knowledge base. You throw messy notes and fragments at an alien intelligence; it weaves them into a connected knowledge graph. This repo is the Next.js app + local agent runtime: landing, chat/graph/notes workspace, and agent API routes.

## Quick start

```bash
npm install
# Avoid falkordblite Unix socket path-length crashes in deep worktrees:
FALKOR_PATH=/tmp/falkor npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Route | What |
|-------|------|
| `/` | Landing (ShaderGradient; mascot host not mounted) |
| `/chat` | Chat UI (`?c=<chatId>`). Conversation, sidebar, prompt shell. |
| `/notes` | Notes master (blank detail). `/notes/[id]` is read-only Milkdown. |
| `/graph` | Knowledge graph (Sigma + same sidebar shell) |

Configure provider/API keys as needed in `.env.local` (never commit secrets).

## Docs

| File | Role |
|------|------|
| **`AGENTS.md`** | Preferences & coding standards for humans and agents (not an architecture map). |
| Design brief | **TBD** — `brief.md` is not in the tree yet; do not invent one. |

Optional agent orchestration notes live under `.agents/rules/` and `.grok/rules/` (they drift slightly; `.grok` adds Antigravity/`agy` guidance). Skills are shared (`.grok/skills` → `.agents/skills`).

## Architecture (high level)

**Dual agents**

1. **ChatAgent** — `POST /api/chat` streams answers (retrieval, `askUserQuestion`, optional Exa web search, optional Excalidraw MCP tools/apps).
2. **GraphAgent** — after each turn, `after()` enqueues a per-chat job that writes Memories/Links into FalkorDBLite graph `spy_brain`.

Orchestrator SoT: `src/ai/agent/agent.ts`. Client transport/context: `src/contexts/ChatContext.tsx`.

**Persistence (local-first)**

| Store | Module | Contents |
|-------|--------|----------|
| SQLite (`better-sqlite3`) | `src/lib/chats/sqlite.ts` | Chat + graph-agent transcripts (`messages_json`, `graph_messages_json`) |
| FalkorDBLite | `src/lib/graph/falkor.ts` | Knowledge graph `spy_brain` |
| Dexie | `src/lib/storage/client-db.ts` | Prompt drafts in the browser |

Graph history SoT is **SQLite on the server**, synced to the client via SSE (`GET /api/chats/[chatId]/graph-events`, event `graph-history-updated`). Pub/sub: `src/lib/chats/graph-events.ts`.

**MCP Apps** — Excalidraw (and similar) via `@ai-sdk/mcp`: tool wiring in `src/ai/tools/excalidraw-mcp.ts`, proxy `GET/POST /api/mcp-apps`, iframe sandbox `src/app/mcp-app-sandbox/route.ts`, UI card under `src/components/chat/mcp-app/`.

## Project layout (high level)

```text
src/
  app/                 # Routes + API (chat, chats, graph, mcp-apps, …)
  components/
    ui/                # Design-system primitives
    chat/              # prompt/, conversation/, sidebar/, mcp-app/, overlays/, …
    graph/             # Sigma canvas + Milkdown
    landing/           # Marketing/hero surfaces
    dotmatrix/         # Pixel icons + loaders
    logos/             # Provider marks (not brand/)
  ai/                  # Dual-agent runtime, tools, schemas, models
  contexts/            # ChatContext, etc.
  lib/chats/           # SQLite + SSE
  lib/graph/           # Falkor + policy
  lib/storage/         # Dexie drafts
  prompts/             # Agent instruction + tool prompt SoTs
```

**Prompt input** SoT: `src/components/chat/prompt/shell/prompt-input.tsx`. Live **pending-ask** is a non-morph option list in the prompt body (`pendingAsk` / `onOptionSelect`). Do not rewire a morphing ask widget into `/chat` without an explicit redesign task. Ask schema SoT: `src/ai/schemas/ask-schema.ts`.

## Scripts

```bash
npm run dev
npm run build
npm run lint

# Structure / UI gates (plain node)
npm run verify:components-structure
npm run verify:widget-cleanup
npm run verify:icon-inventory
npm run verify:pending-ask

# Graph / chats (tsx; prefer FALKOR_PATH=/tmp/falkor …)
npm run verify:parent-of-hierarchy
npm run verify:notes-forest
npm run verify:chat-delete
npm run verify:graph-history

# Diagnostics
npm run probe:search-memories
npm run list:memory-questions
```

`verify:reorg-scope` was retired (stale rename map from an earlier layout); the script file is a no-op stub.

`scripts/verify-manage-links-atomic.mjs` and `scripts/verify-upsert-memory-atomic.mjs` remain on disk for manual runs (`npx tsx …`) but are not wired into `package.json`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Node `>=22` · Tailwind CSS v4 · **`motion`** · Vercel AI SDK v7 · FalkorDBLite + better-sqlite3 + Dexie · Sigma + graphology · Milkdown · ShaderGradient on landing.


## Desktop (Electron)

Additive macOS shell around the same Next.js app (does not replace `npm run dev`).

```bash
# Dev: Electron spawns `next dev`, opens /chat, stops Next on quit
npm run electron:dev

# Production-like: build Next, then Electron spawns `next start`
npm run build
npm run electron:start

# Package unsigned Spy.app (local; no notarization).
# The bundle does not include `.env`. Spy.app reads `~/.spy/.env`
# (or `SPY_ENV_FILE`) for `MUSE_SPARK_KEY`, `EXA_API_KEY`, and the rest.
npm run electron:pack
# → dist-electron/mac-arm64/Spy.app
```

| Script | What |
|--------|------|
| `electron:dev` | Start Next dev + Electron → `/chat` |
| `electron:start` | Start Next production server + Electron |
| `electron:pack` | `next build` + electron-builder mac `.app` (unsigned) |
| `electron:dist` | `next build` + electron-builder mac distributable (unsigned) |

Chats and Falkor default to `~/.spy/chats.db` and `~/.spy/falkor` on the desktop, separate from the web defaults (`.data/`). Set `CHATS_DB_PATH` / `FALKOR_PATH` to share one store across both; for deep worktrees without Electron, keep using `FALKOR_PATH=/tmp/falkor` per AGENTS.md. `FALKOR_PATH` must not contain spaces.

Finder launches do not inherit a shell `PATH`. The shell uses `SPY_NODE_BINARY` when set (rejected if older than Node 22). Otherwise it tries the first executable `node` on `PATH` (banner lines are skipped), then Homebrew's node as the Finder fallback, skipping any candidate older than Node 22 with a warning.

Startup order: install the app menu → load `~/.spy/.env` or `SPY_ENV_FILE` without overriding variables already set and without logging values → write data paths into `process.env` → spawn Next, which inherits them → open the window. `http`/`https` links leave the window for the system browser. In-app navigation stays on the app origin (`localhost` and, when set, `SPY_ELECTRON_URL`).

## License

Private / project-specific unless otherwise stated.
