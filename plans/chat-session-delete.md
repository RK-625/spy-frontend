# Chat session delete — application-logic slice

**Status:** PLAN ONLY — implement from this document. Do not invent Recents UI.

**Audience:** Implementing agent (not Grok). After you finish, the human reports the diff back to Grok for review. **Do not commit.** Grok will say when to commit.

**Workspace:** repo root (this worktree). Read `Agents.md` / `AGENTS.md` first. This is Next.js **16.2.6** — route-handler APIs in training data may be wrong. Before touching `src/app/api/chats/route.ts`, read:

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (if present)

---

## 0. Product locks (do not reopen)

| Decision | Lock |
|---|---|
| Identifier | One id: `chatId`. Same as AI SDK `Chat.id` and `chats.id` PK. |
| HTTP | `DELETE /api/chats?id=<chatId>` — mirrors `GET /api/chats?id=` |
| Missing row | **Idempotent 204** (even if zero SQLite rows). GET one-chat stays **404**. |
| Recents | Not a second store. Sidebar `useState<ChatMeta[]>` from `GET /api/chats`. Refresh = bump existing `chatOrder` so the `listChats()` effect re-runs. **Do not** return recents in the DELETE body. |
| Graph / Falkor | **Do not cascade.** Memories/embeddings/links have no `chatId`. |
| UI chrome | **Parked.** No Recents trash/x, no confirm Dialog, no new DotMatrix glyphs, no toast for delete. |
| This slice | DB + HTTP + `chats-api` + `ChatContext.deleteChat` (tombstone / stop / Map drop / `newChat` if active / `chatOrder`). |

### Why ChatContext is in this slice (not Recents chrome)

`POST /api/chats` is **upsert**. `createChat` `onFinish` always `saveChatMessages`. If the `Chat` instance still exists after SQLite delete, a finishing stream **re-inserts the row**, then `updateChatOrder()` puts it back in Recents.

`useChat().stop` only stops the **active** chat. `chatsRef` can hold background streams (`newChat` does not wipe others). AI SDK `Chat` extends `AbstractChat` and has `stop(): Promise<void>` on the **instance**.

So context `deleteChat` is durability, not a button.

---

## 1. Current architecture (facts)

**SQLite** (`.data/chats.db`, override `CHATS_DB_PATH`):

```sql
chats(id TEXT PK, title, created_at, updated_at, messages_json)
```

One blob per conversation. No messages table, no attachments table.

**HTTP today** (`src/app/api/chats/route.ts`): `GET` + `POST` only. `runtime = "nodejs"`. No nested `/api/chats/[id]`.

**Browser wrapper** (`src/lib/chats-api.ts`): `saveChatMessages`, `fetchChat`, `listChats`. Comment: *Server SQLite lives in `@/lib/chats` — do not import that from client.*

**Recents** (`src/components/chat/shell/chat-sidebar.tsx`):

```ts
useEffect(() => {
  if (!isSidebarFull) return;
  void listChats().then(({ chats, nextCursor }) => { /* setRecents */ });
}, [isSidebarFull, chatId, streamReady, chatOrder]);
```

**Registry** (`src/contexts/ChatContext.tsx`): `chatsRef: Map<id, Chat>`. `onFinish` → `saveChatMessages` → `updateChatOrder()`. No unregister.

---

## 2. Target call chain

```
(future Recents row — NOT THIS SLICE)
        │
        ▼
ChatContext.deleteChat(chatId)
        │  1. tombstone id
        │  2. instance.stop() if in Map
        │  3. Map.delete
        │  4. await chats-api deleteChat
        │  5. if active → newChat()
        │  6. updateChatOrder()
        ▼
deleteChat() in src/lib/chats-api.ts
        ▼
DELETE /api/chats?id=
        ▼
deleteChatRecord() in src/lib/chats.ts
        DELETE FROM chats WHERE id = ?
```

---

## 3. Allowlist — files you may touch

| File | What to add |
|---|---|
| `src/lib/chats.ts` | `deleteChatRecord` |
| `src/app/api/chats/route.ts` | `export async function DELETE` |
| `src/lib/chats-api.ts` | `deleteChat` fetch helper |
| `src/types/chat.ts` | `deleteChat` on `ChatContextValue` |
| `src/contexts/ChatContext.tsx` | tombstone ref, `onFinish` guard, `deleteChat` handler; thread ref into `createChat` |
| `scripts/verify-chat-delete.mjs` | **New.** DB-layer verify script (see §7) |
| `package.json` | Optional `"verify:chat-delete"` script pointing at that file |

### Forbidden (fail the slice if you touch them)

- `src/components/chat/shell/chat-sidebar.tsx` (Recents rows stay title-only buttons)
- Any `src/components/dotmatrix/**`
- `src/lib/falkor.ts`, graph routes, graph components
- `src/app/api/chat/route.ts` (streaming agent — not the catalog)
- New nested route `src/app/api/chats/[id]/`
- New confirm/dialog/dropdown usage
- `toast` / sonner wiring for delete
- Drive-by refactors (`newChat` empty-deps is pre-existing; do not “fix” unrelated hooks unless required for `deleteChat`)

---

## 4. Implementation spec (exact)

### 4.1 `src/lib/chats.ts`

Place **after** `upsertChatMessages` (file ends ~line 370). Same CRUD section. No `any`. Do **not** parse `messages_json` (corrupt rows must still delete).

```ts
/**
 * Delete the chats row. Idempotent: missing id is not an error.
 * Does not parse messages_json (corrupt rows can still be removed).
 * Returns whether a row was actually removed.
 */
export function deleteChatRecord(chatId: string): boolean {
  const db = getChatsDb();
  const result = db.prepare(`DELETE FROM chats WHERE id = ?`).run(chatId);
  return result.changes > 0;
}
```

Guardrails:

- `chatId` is used only as a bound parameter (`?`). Never string-concatenate SQL.
- Do **not** `DELETE FROM chats` without `WHERE`.
- Return value is for verify/logs. HTTP still 204 when `false`.

### 4.2 `src/app/api/chats/route.ts`

- Import `deleteChatRecord` next to existing `@/lib/chats` imports.
- Keep `export const runtime = "nodejs"`.
- Add `DELETE` **after** `POST`. Mirror GET/POST try/catch + `console.error` prefix.

Contract:

| Request | Response |
|---|---|
| `id` missing, empty, or whitespace-only after trim | **400** `{ ok: false, error: "id is required" }` JSON. **Never delete-all.** |
| any other `id` | `deleteChatRecord(id)` then **204** with **empty body** |
| thrown error (sqlite open, etc.) | **500** `{ ok: false, error: string }` like GET/POST |

204 implementation (do **not** `NextResponse.json(..., { status: 204 })`):

```ts
return new NextResponse(null, { status: 204 });
```

Sketch:

```ts
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
    if (id.length === 0) {
      return NextResponse.json(
        { ok: false, error: "id is required" },
        { status: 400 },
      );
    }
    deleteChatRecord(id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    console.error("DELETE /api/chats:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
```

GET `?id=` **404** for missing chat is unchanged. POST upsert is unchanged.

### 4.3 `src/lib/chats-api.ts`

Same file as the other catalog helpers. Still **must not** import `@/lib/chats`.

```ts
/** DELETE /api/chats?id= — idempotent; 204 even if the row was already gone. */
export async function deleteChat(chatId: string): Promise<void> {
  const res = await fetch(`/api/chats?id=${encodeURIComponent(chatId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`DELETE /api/chats failed: ${res.status}`);
  }
}
```

- `204` is `res.ok === true`. Do not `res.json()` on 204.
- Error style matches `saveChatMessages` / `listChats` (status only).
- Always `encodeURIComponent(chatId)`.

### 4.4 `src/types/chat.ts`

Add to `ChatContextValue` after `switchChat` (keep `chatOrder` last):

```ts
  /**
   * Remove a conversation from SQLite and the in-memory Chat map.
   * Recents refetch via chatOrder. If it was active, mint a new empty chat.
   */
  deleteChat: (chatId: string) => Promise<void>;
  /** Catalog revision after persist; Recents refetch. */
  chatOrder: number;
```

### 4.5 `src/contexts/ChatContext.tsx`

**Imports:** add `deleteChat as deleteChatRequest` from `@/lib/chats-api` (name-clash with context method).

**Refs (declare `deletedIdsRef` before the `activeChat` `useState` initializer):**

```ts
const deletedIdsRef = useRef(new Set<string>());
```

**`createChat` signature** — thread the ref (all call sites: `useState` init, `newChat`, `switchChat`):

```ts
function createChat(
  chatId: string,
  messages: UIMessage[] = [],
  updateChatOrder: () => void,
  deletedIdsRef: React.MutableRefObject<Set<string>>,
): Chat<UIMessage>
```

Use `import type { MutableRefObject } from "react"` or `React.MutableRefObject` consistently with the file (it currently does not import `React` namespace — prefer `MutableRefObject` from `"react"`).

**`onFinish` guard** (tombstone before any POST):

```ts
onFinish: ({ messages: finished }) => {
  // Deleted chats must not upsert: POST /api/chats creates a missing row.
  if (deletedIdsRef.current.has(chatId)) return;
  void saveChatMessages(chatId, finished)
    .then(() => updateChatOrder())
    .catch((err: unknown) => {
      console.error("saveChatMessages:", err);
    });
},
```

**`deleteChat` handler — order is mandatory:**

```
1. const id = chatId.trim(); if empty, return (do not call API)
2. deletedIdsRef.current.add(id)
3. const registered = chatsRef.current.get(id)
4. if registered: try { await registered.stop() } catch { /* still delete */ }
5. chatsRef.current.delete(id)
6. await deleteChatRequest(id)   // throws on non-2xx
7. if (activeChat.id === id) newChat()
8. updateChatOrder()
```

If step 6 throws: **keep** tombstone and Map drop (do not re-register; a late `onFinish` must not recreate the row). Re-throw so a later UI can toast. Still skip `newChat`/`updateChatOrder` if the active id was **not** the deleted one and the request failed? **No — if it was active you already dropped the Map entry.** If it was active and DELETE failed, you must still `newChat()` so the workspace is not bound to a dead instance; then re-throw. If it was not active, re-throw without `newChat`. `updateChatOrder` after a failed DELETE is optional; prefer **not** bumping if SQLite likely still has the row (so Recents does not flicker). Spec:

- DELETE **succeeds**: always `updateChatOrder()`. If active → `newChat()` then bump.
- DELETE **fails**: if it was active → `newChat()` (workspace correctness), then re-throw. **Do not** `updateChatOrder()` on failure.

**Context value:** pass `deleteChat` through `useMemo` value + dependency array next to `switchChat`.

**Deps:** `deleteChat` closes over `activeChat.id`, `newChat`, `updateChatOrder`. Refs are stable. Do not “fix” `newChat`’s `[]` deps unless `createChat` would otherwise capture a stale `deletedIdsRef` (it will not — the ref object is stable).

**Do not** call `useChat().stop` as a substitute for instance `stop()` when deleting a **background** id.

---

## 5. Code / style guardrails

From `.grok/rules/code-preferences.md` and this repo:

- **No `any`.** Use `unknown` + narrowing (route already does this).
- Names: `deleteChatRecord` (DB), `deleteChat` (client + context). Do not invent `removeChat` / `destroySession`.
- Comments: only non-obvious constraints (tombstone vs upsert resurrection; 204 empty body; idempotent DELETE vs GET 404). No narration of the edit.
- Do not extract a shared hook/util used in one place.
- Do not add error handling for structurally impossible cases; **do** handle non-deterministic IO (sqlite, fetch).
- Client modules must not import `src/lib/chats.ts` (`better-sqlite3` is Node-only).
- Match existing `console.error("VERB /api/chats:", error)` logging.
- Do not change GET pagination, POST body shape, title derivation, or WAL/schema setup.

---

## 6. Out of scope (parked UI / later)

Document in your PR/summary as **not done**; do not implement:

- Recents hover-`x` / trash / dropdown (row is a single `<button>` today; nested button is a later layout change)
- Confirm Dialog (`Dialog` exists for Settings; no AlertDialog)
- `toast.error` on delete failure (prompt-input uses sonner; Recents `listChats` is still `console.error`)
- Command palette listing chats
- `switchChat` 404 hardening (only needed if a deleted id can still be opened; Recents will drop it after `chatOrder`)
- Graph/memory cleanup
- Bulk delete

---

## 7. Verification (implementer must run and report)

### 7.1 New script `scripts/verify-chat-delete.mjs`

Match existing `scripts/verify-*.mjs` style (plain Node, `process.exit(1)` on failure).

**Must use an isolated DB.** `getChatsDb()` is a process singleton. Run as its **own process** with:

```bash
CHATS_DB_PATH="$(mktemp -t chats-delete-verify).db" npx tsx scripts/verify-chat-delete.mjs
```

Do **not** point at `.data/chats.db` (destroys real Recents). Delete the temp file in `finally`.

Cases (all must pass):

1. `createChatRecord` then `deleteChatRecord(id)` → `true`; `getChat(id)` → `null`.
2. `deleteChatRecord` on the same id again → `false` (idempotent, no throw).
3. `deleteChatRecord` on a never-seen UUID → `false`, no throw.
4. Create a row, overwrite `messages_json` with `'not-json'` via raw SQL (or insert invalid blob), `deleteChatRecord` still returns `true` (no `CorruptChatError`).
5. After delete, `listChats({ limit: 30 })` does not include that id.
6. **Negative:** script source (or a static assert) confirms it never issues `DELETE FROM chats` without `WHERE`.

If importing TS from ESM is painful, the script may `npx tsx` and `import { createChatRecord, deleteChatRecord, getChat, listChats } from "../src/lib/chats.ts"`.

Optional npm script:

```json
"verify:chat-delete": "npx tsx scripts/verify-chat-delete.mjs"
```

The npm script **must** set `CHATS_DB_PATH` to a temp file internally, or refuse to run if `CHATS_DB_PATH` is unset/points at `.data/chats.db`. Prefer: script itself creates a temp path if env is unset, and **never** defaults to `.data/chats.db`.

### 7.2 Typecheck and lint

```bash
npx tsc --noEmit
npx eslint src/lib/chats.ts src/lib/chats-api.ts src/app/api/chats/route.ts src/contexts/ChatContext.tsx src/types/chat.ts
```

Zero new errors on those files.

### 7.3 HTTP contract (dev server)

With `npm run dev` and a **throwaway** `CHATS_DB_PATH` (do not use the user’s real catalog if you can avoid it):

| # | Call | Expect |
|---|---|---|
| H1 | `DELETE /api/chats` (no `id`) | 400 JSON `id is required` |
| H2 | `DELETE /api/chats?id=` | 400 |
| H3 | `DELETE /api/chats?id=does-not-exist` | **204**, empty body |
| H4 | `POST /api/chats` with `{ chatId, messages }` then `DELETE ?id=` that id | 204 |
| H5 | `GET /api/chats?id=` same id after H4 | **404** |
| H6 | `GET /api/chats` list does not contain that id | 200 list |
| H7 | Second `DELETE ?id=` same id | 204 again |
| H8 | `GET /api/chats?id=` unknown (never posted) | still **404** (GET unchanged) |

Example:

```bash
curl -sS -D - -o /tmp/del-body -X DELETE "http://localhost:3000/api/chats?id=$(uuidgen)"
# Status: 204, body empty
```

### 7.4 Client / context checks (static + optional manual)

Static (grep the diff):

- [ ] `deletedIdsRef.current.has(chatId)` before `saveChatMessages` in `onFinish`
- [ ] `deleteChat` calls `registered.stop` (instance), not only hook `stop`
- [ ] Tombstone **before** `stop`
- [ ] `chatsRef.current.delete(id)` before or immediately after stop, **before** relying on Recents
- [ ] `updateChatOrder()` on successful delete
- [ ] `newChat()` when `activeChat.id === id`
- [ ] `ChatContextValue` includes `deleteChat`
- [ ] No import of `@/lib/chats` from `chats-api.ts` or `ChatContext.tsx`
- [ ] `chat-sidebar.tsx` unchanged (`git diff -- src/components/chat/shell/chat-sidebar.tsx` empty)
- [ ] No `falkor` / graph files in the diff

Manual (if you have the app running; no Recents button yet):

- Persist a chat (send a message so it appears in Recents).
- From a small temporary caller **or** React DevTools, invoke `deleteChat(id)` is optional; if you cannot, skip UI and rely on HTTP + DB verify.
- **Do not leave a temporary Recents button in the tree.** If you add a debug caller, revert it before handing off.

### 7.5 Resurrection regression (must reason in the summary)

Write 4–6 sentences in the handoff: why `onFinish` without tombstone recreates the row (`upsertChatMessages` insert path), and how tombstone + `stop` + Map delete prevent it for **active and background** chats.

---

## 8. Diff hygiene (before you stop)

```bash
git diff --stat
git diff -- src/lib/chats.ts src/lib/chats-api.ts src/app/api/chats/route.ts src/contexts/ChatContext.tsx src/types/chat.ts scripts/verify-chat-delete.mjs package.json
```

- No unrelated files.
- No `any`.
- No comments that say “add delete feature” as a diary.
- Plan file `plans/chat-session-delete.md` — **do not edit** unless you find a factual error; if you must, add a short “Implementer notes” section at the bottom instead of rewriting locks.

---

## 9. Handoff back to Grok (required)

When done, give the human this block to paste to Grok:

```
Chat delete slice implemented per plans/chat-session-delete.md

Files changed:
- …

Commands run + results:
- CHATS_DB_PATH=… npx tsx scripts/verify-chat-delete.mjs
- npx tsc --noEmit
- npx eslint …
- HTTP H1–H8 (or skipped, with reason)

Resurrection notes:
- …

Known gaps / deviations from the plan:
- …
```

Grok will review, clean up, and say **when to commit**. Do not `git commit` yourself.

---

## 10. Suggested commit message (Grok may edit)

```
feat(chats): add idempotent DELETE for session catalog

SQLite deleteChatRecord, DELETE /api/chats?id=, chats-api helper,
and ChatContext.deleteChat that tombstones onFinish so upsert cannot
resurrect a removed row. Recents refresh via existing chatOrder.
UI chrome deferred.
```
