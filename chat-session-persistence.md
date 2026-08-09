# Chat session persistence — plan draft

**Status:** Draft (discussion locked; implementation not started)  
**Date:** 2026-08-07  
**Branch context:** `chat-interface` (prompt shell refactor landed; chat still single in-memory session)  
**Depends on:** AI SDK 6 `useChat` + `UIMessage` (`parts`-native UI already shipped on `/home`)

**One-line goal:** ChatGPT/Claude-style **named conversation sessions** in the sidebar — switch between histories, persist transcripts locally, while **all sessions share one global Falkor knowledge base** and **global prompt prefs** (model / mode / web).

---

## Intent (what we want)

| Capability | Decision |
|---|---|
| Multiple conversations | Each session has its own message history |
| Sidebar Recents | Real list of past sessions (replace placeholder) |
| Session switch | Load hydrated `UIMessage[]` for selected session |
| New chat | Start a fresh session (empty transcript) |
| Title | First user message text, trimmed (ChatGPT-style) |
| Shared KB | All sessions use the same Falkor memories via agent toolset |
| Global prefs | Model, mode, web search — **not** per-session |
| Delete session | **Out of scope** (v1) |
| Auth / multi-user | **Later** |
| Search conversations | **Later** (sidebar search stays stub) |

---

## What we explicitly rejected

| Rejected | Why |
|---|---|
| Store chat transcripts in Falkor | Wrong data model — Falkor is knowledge graph (memories + links), not chat log |
| Per-session model/mode/web prefs | Product decision: prefs are workspace-global |
| Persist on every stream token | Too chatty; persist **finished** messages only |
| Legacy `content` string storage | AI SDK 6 UI path is `UIMessage.parts` — store and hydrate `parts` |

---

## Storage decision: SQLite (local)

| Layer | Holds |
|---|---|
| **Falkor** (`.data/falkor`) | Memories, embeddings, graph topology — **unchanged** |
| **SQLite** (`.data/sessions.db`) | `chat_sessions` + `chat_messages` — conversation catalog + transcripts |
| **Browser** | Optional `localStorage` for last-active `sessionId` only (not transcript SoT) |

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

### Indexing (recommended, not yet locked)

```sql
CREATE INDEX idx_chat_messages_session_ordinal
  ON chat_messages (session_id, ordinal);
```

### `UNIQUE (session_id, ordinal)` — optional integrity guard

| Question | Conclusion |
|---|---|
| Is `session_id` alone enough? | **For loading:** yes — `WHERE session_id = ? ORDER BY ordinal ASC` |
| Is composite unique required for hydration? | **No** — hydration only needs grouped rows + order |
| What does composite unique prevent? | Two rows at the same ordinal in one session (double-insert / race / retry bug) |
| v1 decision | **Optional** — skip if insert path assigns ordinals transactionally (`MAX(ordinal)+1`); add later if we see dup slots |

**Do not** make `session_id` UNIQUE on `chat_messages` — that would allow only one message per session.

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

### Client wiring

```ts
// Option A (preferred v1): remount useChat per session
useChat<UIMessage>({
  id: sessionId,
  messages: hydratedMessages,
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});

// Option B: same instance, swap after fetch
setMessages(hydratedMessages);
```

### Persistence rules

1. **Store full `parts` array** — text, reasoning, tool parts (`tool-webSearch`, `askUserQuestion`, etc.), `source-url`, file parts. Truncating to text-only breaks CoT, sources, and attachment replay on reload.
2. **Persist finished messages only** — on stream `onFinish`, not per token. Do not store `state: "streaming"` partials.
3. **Validate on load** — Zod parse `parts_json` before passing to `useChat` (fail soft: log + skip bad row).
4. **`metadata`** — skip for v1; add `metadata_json` column later if needed.
5. **`role`** — `user | assistant` covers product path; `system` reserved for future (agent already avoids system messages in UI).

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
│  ChatSessionStore: activeSessionId, catalog[], hydrate()    │
│  ChatProvider: useChat({ id: sessionId, messages })         │
│  Sidebar: Recents ← GET /api/sessions                        │
│  Prompt prefs: global (PromptInputProvider — unchanged)      │
└─────────────────────────────────────────────────────────────┘
          │                              │
          │ GET/POST /api/sessions       │ POST /api/chat { sessionId, … }
          ▼                              ▼
┌──────────────────────┐    ┌──────────────────────────────────────────┐
│ SQLite sessions.db    │    │ runAgent → streamText → onFinish          │
│  chat_sessions        │    │  append user + assistant rows              │
│  chat_messages        │    │  set title from first user message         │
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
| `GET` | `/api/sessions` | List recents (`id`, `title`, `updated_at`) for sidebar |
| `POST` | `/api/sessions` | Create empty session; return `{ id, title, … }` |
| `GET` | `/api/sessions/[id]` | Load messages ordered by `ordinal` → `UIMessage[]` |
| `POST` | `/api/chat` | Existing stream; **add** `sessionId` in body; persist on `onFinish` |

Optional later: `PATCH /api/sessions/[id]` for title edits — not required if title is set once from first user message.

### Persistence timing (agreed direction)

| Event | Action |
|---|---|
| User sends message | Insert user row (`ordinal = next`) before or after stream start |
| Assistant stream completes (`onFinish`) | Insert assistant row with full `parts_json` |
| First user message in session | Set `chat_sessions.title` from trimmed text |
| Every append | Bump `chat_sessions.updated_at` |

**Preferred:** server-side `onFinish` in `/api/chat` (single source of truth, survives client refresh mid-stream). Client may optimistically show messages via `useChat` while stream runs.

### Title policy

- Default title on create: `"New chat"` or empty placeholder until first send
- After first **user** message with non-empty text: `title = text.trim().slice(0, N)` (pick N e.g. 60–80)
- Do not rename on subsequent messages (ChatGPT behavior)

---

## Current baseline (pre-implementation)

| File / area | Today |
|---|---|
| `src/contexts/ChatContext.tsx` | Single `useChat({ id: "spy-chat" })`, `messages: []`, in-memory only |
| `src/app/api/chat/route.ts` | Thin `runAgent` → `toUIMessageStreamResponse()` — no persistence |
| `src/components/chat/shell/chat-sidebar.tsx` | "New chat" → `clearMessages()`; Recents placeholder |
| `src/hooks/use-chat-submit.ts` | Sends `{ model, useWebSearch, mode }` in body — no `sessionId` |
| `src/lib/falkor.ts` | KB only — no chat tables |
| Message rendering | Already `UIMessage.parts`-native — **no UI rewrite needed** |

---

## Scope estimate (from discussion)

**Size class:** medium feature — ~**700–1,200 LOC** across ~**8–12 files** (new + modified).

| Slice | LOC (rough) | Files |
|---|---|---|
| SQLite lib + schema + CRUD | 200–300 | 1–2 new (`src/lib/sessions.ts`, types) |
| API routes | 150–250 | 2–3 new under `src/app/api/sessions/` |
| Client session orchestration | 250–400 | `ChatContext.tsx` (largest change) |
| Sidebar wiring | 80–150 | `chat-sidebar.tsx` |
| Chat route + submit touch-ups | 50–100 | `api/chat/route.ts`, `use-chat-submit.ts` |
| Config / deps | small | `package.json`, `next.config.ts` |

**Not in scope (keeps size down):** auth, delete, search, per-session prefs, message edit/regenerate persistence, Falkor changes.

### Complexity hotspots

| Area | Notes |
|---|---|
| Switch session while streaming | Need policy: **block** switch, or **abort** stream then switch |
| When to `POST /api/sessions` | On "New chat" click vs first message affects empty-session count |
| `onFinish` capture | Must persist complete assistant `parts`, not text-only |
| `useChat` lifecycle | Key `ChatProvider` on `sessionId` (simpler) vs `setMessages` on switch |
| First page load | Resume last session vs always new — needs product lock |

---

## Open product decisions (not locked)

Answer these before or during implementation to avoid rework:

| # | Question | Options |
|---|---|---|
| 1 | On `/home` load | **A)** Resume last active session (from `localStorage`) **B)** Always start new **C)** Resume if exists, else create |
| 2 | "New chat" timing | **A)** Create `chat_sessions` row immediately on click **B)** Create on first message send |
| 3 | Switch while streaming | **A)** Block sidebar switch until idle **B)** Abort stream + switch **C)** Allow background stream (messy) |
| 4 | Recents cap | **A)** All sessions **B)** Limit (e.g. 50) with `ORDER BY updated_at DESC` |

**Recommendation (if we want fastest MVP):** 1C, 2A, 3A, 4B.

---

## Implementation slices (proposed order)

### S0 — Docs lock (this file)

- [x] Capture discussion + schema + hydration + scope in repo root
- [ ] Copy summary into `AGENTS.md` **What's left** when implementation starts (optional)

### S1 — SQLite foundation

- Add `better-sqlite3` + `serverExternalPackages`
- `src/lib/sessions.ts`: open `.data/sessions.db`, migrate schema, singleton pattern (like `falkor.ts`)
- Types + Zod: `ChatSessionRow`, `ChatMessageRow`, `rowToUIMessage`
- CRUD: `listSessions`, `createSession`, `getSessionMessages`, `appendMessage`, `updateSessionTitle`, `touchSession`

### S2 — API routes

- `GET /api/sessions` — list for sidebar
- `POST /api/sessions` — create
- `GET /api/sessions/[id]` — messages for hydration

### S3 — Persist on chat stream

- Extend `POST /api/chat` body: `sessionId`
- On finish: append assistant message; ensure user message appended; set title on first user text
- Wire `use-chat-submit` to pass `sessionId`

### S4 — Client session store + `ChatContext`

- `activeSessionId` state (+ optional `localStorage` last-active)
- Fetch catalog on mount; load messages on session select
- Key `useChat` on `sessionId` or hydrate via `setMessages`
- Replace `clearMessages` with `createSession` + switch

### S5 — Sidebar Recents

- Render session list from API
- Highlight active session
- "New chat" → create + switch
- Click row → load + hydrate

### S6 — Polish / edge cases

- Stream guard (open decision #3)
- Empty title placeholder UX
- Error toasts on failed load/save
- Manual smoke: new → send → reload → switch → CoT/sources still render

---

## Files to create / modify (checklist)

### New

- `src/lib/sessions.ts` (or `src/lib/chat-sessions/` if it grows)
- `src/types/session.ts` (optional)
- `src/app/api/sessions/route.ts`
- `src/app/api/sessions/[id]/route.ts`

### Modify

- `src/contexts/ChatContext.tsx`
- `src/components/chat/shell/chat-sidebar.tsx`
- `src/app/api/chat/route.ts`
- `src/hooks/use-chat-submit.ts`
- `src/types/chat.ts`
- `package.json`
- `next.config.ts`

### Unchanged

- Falkor / graph / agent toolset (KB stays global)
- `PromptInputProvider` / prefs (global)
- Message rendering components (`conversation/`, `/home` parts loop)

---

## Verification (no Jest in repo)

- `npm run lint`
- `npm run verify:components-structure` (if new chat lib folders)
- Manual `/home`:
  - Create session → send message → refresh → history restores
  - Switch session → correct isolated history
  - CoT / web search tool parts / sources survive reload
  - Sidebar title matches first user message
  - New chat starts empty session
- Confirm `.data/sessions.db` created alongside `.data/falkor`

---

## Related prior work on `chat-interface`

Already shipped (separate from persistence):

- Prompt shell scoped to `PromptInputWorkspace` (not page-level)
- `PromptInputProvider` rename from `PromptShellProvider`
- Removed hidden shader on `/home`
- Removed `ChatProviderWrapper`; `ChatProvider` owns `TooltipProvider`
- Draft PR #5: prompt shell scope + related refactors

Session persistence is the **next** chunk on top of that branch.

---

## Summary

| Topic | Conclusion |
|---|---|
| Where to store transcripts | SQLite `.data/sessions.db`, not Falkor |
| Message shape | `id` + `role` + `parts_json` round-trips `UIMessage` |
| Ordering | `session_id` + `ORDER BY ordinal` |
| Unique constraint | Optional integrity; not required for hydration |
| Shared state | KB global (Falkor); prefs global (prompt shell) |
| Size | Medium — ~8–12 files, core plumbing not UI rewrite |
| Blockers | Four UX decisions (resume, new-chat timing, mid-stream switch, recents cap) |
