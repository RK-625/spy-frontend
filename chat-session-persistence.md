# Chat session persistence — plan

**Status:** Product **S0 locked** (2026-08-10); implementation via **turn-by-turn** hunks (~100–200 LOC), approve → implement  
**Dates:** Draft 2026-08-07 · S0 lock 2026-08-10  
**Branch context:** `chat-sessions` (chat still single in-memory session pre-implementation)  
**Depends on:** AI SDK 6 `useChat` + `UIMessage` (`parts`-native UI already shipped on `/home`)

**One-line goal:** ChatGPT/Claude-style **named conversation sessions** in the sidebar — switch between histories, persist transcripts locally, while **all sessions share one global Falkor knowledge base** and **global prompt prefs** (model / mode / web).

**Delivery process:** Propose a small hunk → user approve / reject / modify → implement only that hunk. Auto-split any logical step that exceeds ~200 LOC. Optional client libs (e.g. Zustand) allowed when multi-session clarity needs them.

---

## Intent (what we want)

| Capability | Decision |
|---|---|
| Multiple conversations | Each session has its own message history + stream lifecycle |
| Sidebar Recents | Real list of past sessions (replace placeholder), **paginated** |
| Session switch | Load hydrated `UIMessage[]` for selected session; other sessions may keep streaming |
| New chat | **Client-only empty draft** — no DB row until first send |
| Title | First user message text, trimmed (ChatGPT-style); no title row before first message |
| Shared KB | All sessions use the same Falkor memories via agent toolset |
| Global prefs | Model, mode, web search — **not** per-session |
| Per-session draft | Textarea + attachments: **in-memory only** (survive in-app switch; lost on full reload) |
| Delete session | **Out of scope** (v1) |
| Auth / multi-user | **Later** |
| Search conversations | **Later** (sidebar search stays stub) |
| Draft persistence to disk | **Out of scope** (v1) |

---

## What we explicitly rejected

| Rejected | Why |
|---|---|
| Store chat transcripts in Falkor | Wrong data model — Falkor is knowledge graph (memories + links), not chat log |
| Per-session model/mode/web prefs | Product decision: prefs are workspace-global |
| Persist on every stream token | Too chatty; persist **finished** messages only |
| Legacy `content` string storage | AI SDK 6 UI path is `UIMessage.parts` — store and hydrate `parts` |
| Empty `chat_sessions` rows | No “New chat” litter in SQLite; create on first message only |
| Resume last session as `/home` default | Default surface is empty draft (today’s blank chat feel) |
| Block switch while streaming (v1) | Full multi-session background streams (N concurrent) |

---

## Locked S0 — product defaults (2026-08-10)

| # | Topic | Lock |
|---|---|---|
| 1 | `/home` load | **Empty draft, no `sessionId`** — same blank-chat feel as today’s `/home`. Past sessions only via Recents. |
| 2 | Empty sessions / New chat | **No empty DB rows.** New chat = client-only empty UI. **`sessionId` minted on first message only** (create session → then stream). |
| 3 | Mid-stream switch | **True multi-session background (full 3C).** **N concurrent streams** allowed (stream in A, switch to B, send in B). |
| 4 | Recents list | **Paginated pages of 30** (cursor/offset); infinite scroll / load more — not a hard “50 only” cap with no paging. |
| 5 | Titles | No DB row before first send → no stored title. On first user text: `title = text.trim().slice(0, N)` (N ≈ 60–80). Do not rename later. |
| 6 | Prefs vs session | **Prefs global** (model / mode / web). **Messages + stream lifecycle per session.** |
| 7 | Unsent draft | **Per session, in-memory only** — survives in-app switches while the tab lives; lost on full page reload. No draft SQLite. |
| 8 | Missing / corrupt session id | **Toast + empty client draft** (no DB row created). |
| 9 | Registry timing | **Multi-session registry early** — right after SQLite + session APIs (before full sidebar polish / after basic APIs). |
| 10 | SQLite driver | **`better-sqlite3`** + `serverExternalPackages` (same pattern as `falkordblite`). Client store libs (e.g. Zustand) OK if they simplify multi-session. |

### Architecture knock-ons from S0

1. **Ephemeral client key** for the empty draft (`useChat` / provider key) until first send mints a real session id.
2. **Session registry** (not one global `useChat("spy-chat")`): multi-instance streams for true 3C.
3. **Submit path:** if no `sessionId` → create session → attach id → stream → persist on finish.
4. **New chat** = switch UI to ephemeral empty surface (do **not** `POST /api/sessions`).
5. **API list** returns real sessions only (sessions that have been created at first message).

---

## Storage decision: SQLite (local)

| Layer | Holds |
|---|---|
| **Falkor** (`.data/falkor`) | Memories, embeddings, graph topology — **unchanged** |
| **SQLite** (`.data/sessions.db`) | `chat_sessions` + `chat_messages` — conversation catalog + transcripts |
| **Browser** | In-memory per-session drafts + multi-session stream registry. **No** transcript SoT in `localStorage`. **No** last-active resume as default pane (S0). |

Mirror Falkor’s local-first pattern: embedded DB beside `.data/falkor`, Node.js runtime only, singleton open in `src/lib/…`.

**Dependency:** `better-sqlite3`  
**Next config:** add to `serverExternalPackages` (same pattern as `falkordblite`).

---

## Schema (agreed)

```sql
CREATE TABLE chat_sessions (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,   -- unix ms
  updated_at  INTEGER NOT NULL    -- unix ms; bump on each append
);

CREATE TABLE chat_messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES chat_sessions(id),
  ordinal     INTEGER NOT NULL,   -- 0, 1, 2… stable order within session
  role        TEXT NOT NULL,      -- user | assistant  (system possible later)
  parts_json  TEXT NOT NULL,      -- JSON.stringify(UIMessage.parts)
  created_at  INTEGER NOT NULL
);
```

### Indexing (recommended)

```sql
CREATE INDEX idx_chat_messages_session_ordinal
  ON chat_messages (session_id, ordinal);

-- Recents pagination: newest first
CREATE INDEX idx_chat_sessions_updated_at
  ON chat_sessions (updated_at DESC);
```

### `UNIQUE (session_id, ordinal)` — optional integrity guard

| Question | Conclusion |
|---|---|
| Is `session_id` alone enough? | **For loading:** yes — `WHERE session_id = ? ORDER BY ordinal ASC` |
| Is composite unique required for hydration? | **No** — hydration only needs grouped rows + order |
| What does composite unique prevent? | Two rows at the same ordinal in one session (double-insert / race / retry bug) |
| v1 decision | **Optional** — skip if insert path assigns ordinals transactionally (`MAX(ordinal)+1`); add later if we see dup slots |

**Do not** make `session_id` UNIQUE on `chat_messages` — that would allow only one message per session.

**Do not** insert a `chat_sessions` row until first user message (S0 — no empty rows).

---

## AI SDK hydration mapping

AI SDK 6 `UIMessage` shape:

```ts
{
  id: string;
  role: "system" | "user" | "assistant";
  metadata?: unknown;   // optional — not stored in v1
  parts: UIMessagePart[];
}
```

### Column → `UIMessage`

| DB column | Maps to |
|---|---|
| `id` | `UIMessage.id` |
| `role` | `UIMessage.role` |
| `parts_json` | `JSON.parse(parts_json)` → `UIMessage.parts` |
| `ordinal` | `ORDER BY ordinal ASC` when loading — **not** on `UIMessage` |
| `session_id` | Session grouping only |
| `created_at` | Audit metadata — not required for hydration |

### Hydrate helper (illustrative)

```ts
function rowToUIMessage(row: ChatMessageRow): UIMessage {
  return {
    id: row.id,
    role: row.role as UIMessage["role"],
    parts: JSON.parse(row.parts_json),
  };
}
```

### Client wiring (S0-aligned)

```ts
// Ephemeral empty draft (no DB id yet)
useChat<UIMessage>({
  id: ephemeralClientKey, // e.g. "draft-…"
  messages: [],
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});

// Persisted / switched session — one registry entry per sessionId
useChat<UIMessage>({
  id: sessionId,
  messages: hydratedMessages,
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});
```

True **N concurrent streams** implies a **session registry** (multiple live `useChat` instances or equivalent), not a single remount that tears down background streams. Prefer keeping non-active sessions mounted/hidden or otherwise stream-owned so `onFinish` still lands on the correct session.

### Persistence rules

1. **Store full `parts` array** — text, reasoning, tool parts (`tool-webSearch`, `askUserQuestion`, etc.), `source-url`, file parts. Truncating to text-only breaks CoT, sources, and attachment replay on reload.
2. **Persist finished messages only** — on stream `onFinish`, not per token. Do not store `state: "streaming"` partials.
3. **Validate on load** — Zod parse `parts_json` before passing to `useChat` (fail soft: log + skip bad row).
4. **`metadata`** — skip for v1; add `metadata_json` column later if needed.
5. **`role`** — `user | assistant` covers product path; `system` reserved for future (agent already avoids system messages in UI).
6. **First message creates session** — if request has no `sessionId`, server (or pre-flight client) creates `chat_sessions` + sets title from first user text, then appends rows.

### What the UI already consumes (no render rewrite)

`/home` reads `message.parts` for:

- Chain of thought (`reasoning`, `tool-webSearch`)
- Sources (`source-url`)
- Text (`text`)
- Pending ask (`ask-user-question.ts` scans tool parts)

Persistence must round-trip the same `parts` the stream produced.

---

## Architecture (target)

```text
┌─────────────────────────────────────────────────────────────┐
│ Browser (/home)                                              │
│  Session registry: Map of sessionId | draftKey → stream     │
│  Active surface: empty draft (no id) OR selected sessionId  │
│  Per-session: messages + in-memory draft (textarea/files)   │
│  Global prefs: model / mode / web (PromptInputProvider)     │
│  Sidebar Recents ← GET /api/sessions?limit=30&cursor=…      │
└─────────────────────────────────────────────────────────────┘
          │                              │
          │ GET/POST /api/sessions       │ POST /api/chat
          │ (list paginated; create on   │  { sessionId?, … }
          │  first message path)         │  create-if-missing
          ▼                              ▼
┌──────────────────────┐    ┌──────────────────────────────────────────┐
│ SQLite sessions.db    │    │ runAgent → streamText → onFinish          │
│  chat_sessions        │    │  append user + assistant rows              │
│  chat_messages        │    │  title only on first user message          │
└──────────────────────┘    └──────────────────────────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────┐
                            │ Falkor (.data/falkor) │
                            │  memories + links     │
                            │  (global KB — shared) │
                            └──────────────────────┘
```

### API surface (proposed)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/sessions` | List recents paginated (`limit=30`, cursor/offset); `id`, `title`, `updated_at` |
| `POST` | `/api/sessions` | Create session — used on **first message** path (not New chat click). May be folded into `/api/chat` create-if-missing. |
| `GET` | `/api/sessions/[id]` | Load messages ordered by `ordinal` → `UIMessage[]` |
| `POST` | `/api/chat` | Existing stream; optional `sessionId`; **create session if missing** on first send; persist on `onFinish` |

Optional later: `PATCH /api/sessions/[id]` for title edits — not required if title is set once from first user message.

**Pagination (S0):** page size **30**; prefer cursor on `(updated_at, id)` for stable “load more” (exact cursor format locked in the API implementation turn).

### Persistence timing (agreed direction)

| Event | Action |
|---|---|
| New chat click | **No DB write** — switch UI to ephemeral empty draft |
| First user send (no sessionId) | Create `chat_sessions` (title from user text) + insert user row |
| Later user send | Insert user row (`ordinal = next`) |
| Assistant stream completes (`onFinish`) | Insert assistant row with full `parts_json` |
| Every append | Bump `chat_sessions.updated_at` |

**Preferred:** server-side persistence in `/api/chat` (create-if-missing + `onFinish`) so refresh mid-stream still lands finished messages when the server completed. Client registry keeps optimistic UI per session.

### Title policy (S0)

- **No row** until first send → no default `"New chat"` row in DB
- After first **user** message with non-empty text: `title = text.trim().slice(0, N)` (N e.g. 60–80)
- Do not rename on subsequent messages (ChatGPT behavior)

---

## Current baseline (pre-implementation)

| File / area | Today |
|---|---|
| `src/contexts/ChatContext.tsx` | Single `useChat({ id: "spy-chat" })`, `messages: []`, in-memory only |
| `src/app/api/chat/route.ts` | Thin `runAgent` → `toUIMessageStreamResponse()` — no persistence |
| `src/components/chat/shell/chat-sidebar.tsx` | "New chat" → `clearMessages()`; Recents placeholder |
| Submit path | **Verify live wiring** on implement turns — plan historically cited `src/hooks/use-chat-submit.ts`; product shell is zero-prop `PromptInputWorkspace` (hook may be gone/stale). Pass `sessionId` wherever body is built. |
| `src/lib/falkor.ts` | KB only — no chat tables |
| Message rendering | Already `UIMessage.parts`-native — **no UI rewrite needed** |

---

## Scope estimate

**Size class:** medium–large feature (multi-session registry increases client work vs original single-`useChat` estimate) — expect **more than** ~8–12 files once registry lands; still **no** message UI rewrite.

| Slice | Notes |
|---|---|
| SQLite lib + schema + CRUD | Split across turns if >200 LOC |
| API routes + pagination | Split list vs detail vs create |
| Multi-session registry | Early; largest client complexity |
| Persist / first-send create | `/api/chat` + submit body |
| Sidebar + load more | After registry + list API |
| Polish | Toasts, generating indicators, smoke |

**Not in scope (keeps size down):** auth, delete, search, per-session prefs, message edit/regenerate persistence, draft SQLite, Falkor changes.

### Complexity hotspots

| Area | Notes |
|---|---|
| N concurrent streams | Registry must not tear down background `useChat` on switch |
| First-send create | Race: double-submit before `sessionId` returns — need single-flight create |
| `onFinish` capture | Must persist complete assistant `parts`, not text-only |
| Ephemeral draft → real id | Re-key registry entry when first message mints `sessionId` |
| Pagination cursor | Stable order under concurrent `updated_at` bumps |

---

## Implementation slices (S0-aligned order)

Turn-by-turn delivery maps onto these slices; each slice may be multiple turns.

### S0 — Docs lock (this file) — **done**

- [x] Capture discussion + schema + hydration + scope in repo root
- [x] Lock product S0 (2026-08-10) + turn-by-turn process
- [x] Revise slice order: registry early; no empty rows; pagination 30
- [ ] Copy summary into `AGENTS.md` **What's left** when implementation starts (optional)

### S1 — SQLite foundation

- Add `better-sqlite3` + `serverExternalPackages`
- `src/lib/sessions.ts`: open `.data/sessions.db`, migrate schema, singleton pattern (like `falkor.ts`)
- Types + Zod: `ChatSessionRow`, `ChatMessageRow`, `rowToUIMessage`
- CRUD: `listSessions` (limit/cursor), `createSession`, `getSessionMessages`, `appendMessage`, `updateSessionTitle`, `touchSession`
- **Invariant:** callers should not create sessions with zero messages in product paths (API may still expose create for first-send)

### S2 — Session API routes

- `GET /api/sessions` — paginated list for sidebar (`limit=30`, cursor)
- `POST /api/sessions` — create (first-message path; not New chat)
- `GET /api/sessions/[id]` — messages for hydration

### S3 — Multi-session registry (early)

- Client session registry: active surface + map of session entries
- Ephemeral draft key (no DB id) as default `/home` surface
- Per-session stream ownership so N concurrent streams can run
- Global prefs stay outside the registry (or single shared prefs slice)
- Per-session in-memory draft (textarea/attachments); no disk
- Optional Zustand (or equivalent) if it keeps registry pure

### S4 — Persist on chat stream + first-send create

- Extend `POST /api/chat` body: optional `sessionId`
- Create-if-missing on first send; title from first user text
- On finish: append user + assistant with full `parts_json`; bump `updated_at`
- Wire live submit path to pass `sessionId` when known

### S5 — Sidebar Recents

- Render session list from paginated API
- Highlight active session (none highlighted on pure empty draft, or draft distinct)
- "New chat" → ephemeral empty draft (**no** POST)
- Click row → activate registry entry + hydrate if needed
- Load more (next 30)

### S6 — Polish / edge cases

- Sidebar “generating” indicator per session (3C)
- Toast on missing/corrupt session → empty draft
- Error toasts on failed load/save
- Manual smoke: empty → send → reload → history; switch mid-stream; CoT/sources round-trip; New chat does not create DB row

---

## Files to create / modify (checklist)

### New

- `src/lib/sessions.ts` (or `src/lib/chat-sessions/` if it grows)
- `src/types/session.ts` (optional)
- `src/app/api/sessions/route.ts`
- `src/app/api/sessions/[id]/route.ts`
- Client registry module (path TBD in registry turn — e.g. under `src/contexts/` or `src/lib/chat-session/`)

### Modify

- `src/contexts/ChatContext.tsx` (likely evolves with registry)
- `src/components/chat/shell/chat-sidebar.tsx`
- `src/app/api/chat/route.ts`
- Live submit wiring (verify path; do not assume `use-chat-submit.ts` exists)
- `src/types/chat.ts` as needed
- `package.json`
- `next.config.ts`

### Unchanged

- Falkor / graph / agent toolset (KB stays global)
- Message rendering components (`conversation/`, `/home` parts loop)
- Global model/mode/web **prefs** behavior (still global; may share provider with per-session draft state carefully)

---

## Verification (no Jest in repo)

- `npm run lint`
- `npm run verify:components-structure` (if new chat lib folders)
- Manual `/home`:
  - Empty default → send message → session appears in Recents with title from first text
  - Refresh → empty default again; open Recents row → history restores
  - Switch session while another streams → both complete; correct isolated histories
  - CoT / web search tool parts / sources survive reload
  - New chat does **not** create `.data/sessions.db` rows until first send
  - Load more after 30+ sessions
- Confirm `.data/sessions.db` created alongside `.data/falkor` after first persisted send

---

## Related prior work

Already shipped (separate from persistence):

- Prompt shell scoped to `PromptInputWorkspace` (not page-level)
- `PromptInputProvider` rename from `PromptShellProvider`
- Removed hidden shader on `/home`
- Removed `ChatProviderWrapper`; `ChatProvider` owns `TooltipProvider`
- Draft PR #5: prompt shell scope + related refactors

Session persistence is the **next** chunk; delivery is **turn-by-turn** under locked S0.

---

## Summary

| Topic | Conclusion |
|---|---|
| Where to store transcripts | SQLite `.data/sessions.db`, not Falkor |
| Message shape | `id` + `role` + `parts_json` round-trips `UIMessage` |
| Ordering | `session_id` + `ORDER BY ordinal` |
| Empty sessions | **None** — create on first message only |
| `/home` default | Empty draft, no session id |
| Streams | N concurrent; multi-session registry early |
| Recents | Page size 30 + load more |
| Prefs / draft | Prefs global; draft per-session in-memory |
| Unique constraint | Optional integrity; not required for hydration |
| Shared KB | Falkor global |
| Process | Turn-by-turn ~100–200 LOC, approve before implement |
| Blockers | S0 product locks **done** |
