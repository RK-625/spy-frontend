# Recents gutter delete — UI slice

**Status:** PLAN ONLY — implement from this document.

**Audience:** Implementing agent (not Grok). When done, the human pastes the handoff block back to Grok for review. **Do not commit.** Grok will say when to commit.

**Depends on:** `plans/chat-session-delete.md` (already implemented). `ChatContext.deleteChat(chatId)` exists and must be **called**, not reimplemented.

**Workspace:** repo root. Read `Agents.md` / `AGENTS.md` first. This is Next.js **16.2.6** — do not invent App Router APIs from training data. This slice is **client UI only** (no new route handlers).

---

## 0. Product locks (do not reopen)

| Decision | Lock |
|---|---|
| Title left-click | Opens the chat (`switchChat`). **Unchanged.** |
| Delete affordance | **Gutter** on the right of the Recents **row**, not the title click, not a Settings/node Dialog. |
| Menu | Portaled `DropdownMenu` beside the gutter (`side="right"`). One text item **Delete**. **No icons in the menu.** |
| Confirm | **None.** Click Delete → `deleteChat(id)`. |
| Gutter glyph | **Vertical** three dots (`⋮` as three stacked CSS dots). **Not** horizontal `⋯`. |
| Gutter visibility | **Only** while the pointer is over **that row**, or the row is `:focus-within`, or the menu is **open**. Idle rows look like Recents today. |
| Gutter fill | **Existing Recents tokens only** — not a new solid purple. Idle-on-row: `--surface-hover` (`rgba(200, 172, 251, 0.08)`). Gutter hovered/pressed: `--surface-focus` (`rgba(200, 172, 251, 0.20)`). |
| Motion | Micro: opacity + slight scale, **150ms ease-out** (same family as sidebar label `0.15s ease-out` / `duration-200`). Appear and exit. |
| Overflow | **No hard ellipsis against the dots.** While the gutter is showing, title **fades** into the gutter (~24px mask). Idle: current full-width truncate at the row edge is fine. |
| Failure | `toast.error` on `deleteChat` throw. Success: no toast; Recents refresh via existing `chatOrder`. |
| Scope | Full sidebar only (`sidebarMode === "full"`). Icon rail does not list Recents. |
| Graph / Falkor | Do not touch. |
| App logic | Do not change `chats.ts`, `/api/chats`, `chats-api.ts`, or `ChatContext` delete sequence. |

**Fill choice (locked):** 8% / 20% pair. The louder solid-purple square in the sketch is **rejected**.

---

## 1. Current facts

**Recents row today** (`src/components/chat/shell/chat-sidebar.tsx` ~312–331): one full-width `<button>` per chat. `truncate`, `px-2 py-1.5`, `text-[0.8125rem]`, active `bg-[var(--surface-focus)]`, idle `hover:bg-[var(--surface-hover)]`. Click → `handleOpenRecent` → `switchChat`.

**Delete already exists:** `useChatContext().deleteChat` in `src/contexts/ChatContext.tsx` (tombstone → instance `stop` → Map drop → `DELETE /api/chats?id=` → `newChat()` if active → `chatOrder++`).

**Menu primitive:** `DropdownMenu*` from `@/components/ui` (`src/components/ui/overlays/dropdown-menu.tsx`). `DropdownMenuItem` already has `variant="destructive"`. **No product usage yet.**

**Critical default to override:** `DropdownMenuContent` sets `w-(--radix-dropdown-menu-content-available-height)` / **`w-(--radix-dropdown-menu-trigger-width)`**. A 24px trigger would make a 24px-wide menu. Pass `className` that sets **`w-auto min-w-32`** (and keep `min-w-32` from the primitive).

**DotMatrix:** no vertical-ellipsis glyph. **Do not add a glyph.** Three CSS dots in a column.

**`src/components/chat/shell/` has 4 files.** Adding `recents-row.tsx` would make 5 and **require** a directory split (code-preferences). **Do not add a file.** Put a local `RecentsRow` function in `chat-sidebar.tsx` next to `SidebarItem`.

**Tokens (globals.css):**

```css
--surface-hover: rgba(200, 172, 251, 0.08);
--surface-focus: rgba(200, 172, 251, 0.20);
--radius: 0.55rem;
```

Sidebar rows already use `rounded-[var(--radius)]` and `transition-colors`.

---

## 2. Target structure (one Recents row)

```
div.group.relative  (row chrome: active / hover surface — same as today)
  button[title]     (full width, opens chat — no nested button)
    span            (title text; overflow hidden; mask only when gutter visible)
  DropdownMenu
    DropdownMenuTrigger   (absolute right; size-6; vertical dots)
    DropdownMenuContent   (portal, side=right, text-only Delete)
```

**Never** nest the gutter `<button>` inside the title `<button>`.

---

## 3. Implementation spec

### 3.1 `ChatSidebar` wiring

```ts
const { chatId, status, newChat, switchChat, deleteChat, chatOrder } = useChatContext();
```

Replace the Recents `.map` button with `<RecentsRow … />`. Keep `handleOpenRecent` / empty state / Load more.

### 3.2 Local `RecentsRow` (same file)

Props (names must say what they are — not `isOpen` / `toggle`):

```ts
interface RecentsRowProps {
  chat: ChatMeta;
  isActiveChat: boolean;
  onOpenChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => Promise<void>;
}
```

**Row container**

- `group relative`
- Same padding / radius / type size as today’s button
- Active: `bg-[var(--surface-focus)]`
- Idle: `hover:bg-[var(--surface-hover)]`
- `focus-within:ring-2 focus-visible` equivalent: title and trigger already have `focus-visible:ring-2 focus-visible:ring-ring`

**Title button**

- `w-full truncate` **removed** from the text node while gutter shows; the **button** is `w-full text-left px-2 py-1.5 pr-2`
- `onClick` → `onOpenChat(chat.id)`
- `aria-current={isActiveChat ? "true" : undefined}`
- `title={chat.title}` (native tooltip still OK)
- Inner span:

```
min-w-0 block overflow-hidden whitespace-nowrap
group-hover:[mask-image:linear-gradient(to_right,#000_0%,#000_calc(100%-24px),transparent_100%)]
group-focus-within:[mask-image:…]
[[data-slot=dropdown-menu-trigger][data-state=open]_&]: … 
```

Simplest reliable approach: put `data-gutter-open` on the row when the menu is open (controlled `DropdownMenu` `open` + `onOpenChange`), and apply the mask when `group-hover`, `group-focus-within`, or `data-gutter-open`:

```ts
const [gutterMenuOpen, setGutterMenuOpen] = useState(false);
```

Mask class when `gutterMenuOpen ||` via `group-hover` / `group-focus-within` Tailwind variants on the inner span. Controlled open is required so the gutter **stays visible** while the pointer is on the portaled menu (pointer may leave the row).

**Gutter trigger**

- `absolute right-1 top-1/2 -translate-y-1/2 z-10`
- `flex size-6 items-center justify-center rounded-[var(--radius)]`
- `cursor-pointer`
- Fill: `bg-[var(--surface-hover)]` by default when visible; `hover:bg-[var(--surface-focus)]` `data-[state=open]:bg-[var(--surface-focus)]`
- Visibility:

```
opacity-0 scale-95 pointer-events-none
group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto
group-focus-within:opacity-100 group-focus-within:scale-100 group-focus-within:pointer-events-auto
data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=open]:pointer-events-auto
```

When `gutterMenuOpen`, also force visible (Radix `data-state=open` on the trigger should be enough).

- Motion: `transition-[opacity,transform,background-color] duration-150 ease-out`
- `aria-label={`Delete actions for ${chat.title}`}` (or `Chat actions for …`)
- `onClick` / `onPointerDown`: `event.stopPropagation()` so the title does not fire
- **Vertical dots** (no icon component):

```tsx
<span className="flex flex-col items-center gap-[3px]" aria-hidden>
  <span className="size-[3px] rounded-full bg-current" />
  <span className="size-[3px] rounded-full bg-current" />
  <span className="size-[3px] rounded-full bg-current" />
</span>
```

`text-text-secondary` on the trigger; hover can stay current color.

**Menu**

```tsx
<DropdownMenu open={gutterMenuOpen} onOpenChange={setGutterMenuOpen}>
  <DropdownMenuTrigger … />
  <DropdownMenuContent
    side="right"
    align="center"
    sideOffset={4}
    className="min-w-32 w-auto"
  >
    <DropdownMenuItem
      variant="destructive"
      onSelect={() => {
        void onDeleteChat(chat.id);
      }}
    >
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

No extra items. No confirm. No `window.confirm`.

### 3.3 Delete handler in `ChatSidebar`

```ts
const handleDeleteRecent = useCallback(
  async (id: string) => {
    try {
      await deleteChat(id);
    } catch (err: unknown) {
      console.error("deleteChat:", err);
      toast.error("Failed to delete chat");
    }
  },
  [deleteChat],
);
```

Import `toast` from `@/components/ui` (same as `src/components/chat/prompt/shell/prompt-input.tsx`). Do **not** toast on success.

Optimistic Recents filter is **optional**. Prefer relying on `chatOrder` refetch (already wired). If the list flashes the deleted row for one frame, a local `setRecents((prev) => prev.filter((c) => c.id !== id))` **before** `await deleteChat` is allowed; on failure, `chatOrder` will not bump and a refetch is not guaranteed — **do not** optimistic-filter if you cannot restore on error. Safest: **no optimistic filter**; wait for `chatOrder`.

### 3.4 Imports

From `@/components/ui`:

- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `toast`

Do not import `@/lib/chats`. Do not import Lucide.

---

## 4. Style / code guardrails

- **No `any`.**
- **No new design tokens** in `globals.css` for this. Use `--surface-hover`, `--surface-focus`, `--radius`, existing text colors.
- **No new DotMatrix icon.**
- **No Dialog / AlertDialog / `window.confirm`.**
- **No nested buttons.**
- Do not restyle New chat / Search / Graph / Settings / Load more except accidental drive-bys — **forbidden**.
- Do not extract a shared hook used in one place.
- Comments only for non-obvious constraints (mask while gutter visible; `w-auto` override because Content inherits trigger width; stopPropagation).
- `shell/` stays at 4 files.
- Match existing `cn(...)` class grouping.

---

## 5. Out of scope

- Command palette listing / deleting chats
- Icon-mode Recents
- Bulk delete
- New purple gutter token
- Updating `graph-editor-wireframe.excalidraw` (optional; not required to ship)
- Changing delete durability (`ChatContext` / SQLite)

---

## 6. Verification (implementer must run and report)

### 6.1 Static / compile

```bash
npx tsc --noEmit
npx eslint src/components/chat/shell/chat-sidebar.tsx
```

Grep the diff:

- [ ] `deleteChat` from `useChatContext`
- [ ] `variant="destructive"`
- [ ] `stopPropagation`
- [ ] `w-auto` (or equivalent) on `DropdownMenuContent`
- [ ] no `AlertDialog` / `confirm(`
- [ ] no nested `<button>` inside the title `<button>`
- [ ] no new files under `src/components/chat/shell/`
- [ ] no edits under `src/lib/chats.ts`, `src/app/api/chats/`, `src/contexts/ChatContext.tsx`

### 6.2 Interaction (browser or closest substitute)

If a dev server is available, exercise Recents in **full** sidebar (⌘B if collapsed):

| # | Action | Expect |
|---|---|---|
| U1 | Idle Recents | No gutter dots; titles as today |
| U2 | Hover a row | Vertical ⋮ fades in (150ms) on the right, 8% fill |
| U3 | Hover the ⋮ | Fill goes to 20%; cursor pointer |
| U4 | Leave the row (menu closed) | Gutter fades out; no leftover dots |
| U5 | Long title on hover | Letters **fade** into the gutter — no hard `…` jammed on the dots |
| U6 | Click the **title** | Opens that chat (`switchChat`) |
| U7 | Click **⋮** | Small menu to the **right**; does **not** open the chat |
| U8 | Move pointer onto the menu | Gutter + menu stay; no Dialog in the screen center |
| U9 | Click **Delete** | Row leaves Recents after `chatOrder` refetch; no confirm |
| U10 | Delete the **active** chat | Workspace becomes a new empty chat (`newChat`) |
| U11 | Keyboard: focus ⋮, Enter, choose Delete | Same as U9 |
| U12 | Collapse sidebar | Recents unmount; no stray menus |

If you cannot open a browser, say so and still complete 6.1. Grok will visually review.

---

## 7. Diff hygiene

Allowed paths:

- `src/components/chat/shell/chat-sidebar.tsx` (**required**)

Forbidden unless you have a one-line import re-export reason (you should not):

- anything else

```bash
git diff -- src/components/chat/shell/chat-sidebar.tsx
```

---

## 8. Handoff back to Grok (required)

```
Recents gutter delete UI implemented per plans/recents-gutter-delete.md

Files changed:
- …

Commands run + results:
- npx tsc --noEmit
- npx eslint src/components/chat/shell/chat-sidebar.tsx
- Browser U1–U12 (or skipped, with reason)

Deviations from the plan:
- …
```

Do not `git commit`.

---

## 9. Suggested commit message (Grok may edit)

```
feat(chat): Recents gutter menu to delete a session

Hover-only vertical-dot gutter on each Recents row opens a portaled
Delete menu (no confirm). Title click still switches chat. Overflow
fades into the gutter instead of clipping against the control.
```
