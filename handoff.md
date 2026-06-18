# Spy — Chat UI Handoff

**Branch:** `chat-interface`
**Build status:** `npm run build` passes clean (5/5 static pages)
**Run:** `npm run dev` serves on port 3000

---

## Current state snapshot

### What is BUILT and WORKING

**`/home` (chat page)**
- `<HomePage>` wraps `<ChatSidebar>` + `<ChatProvider>` + `<Example />` (chat content)
- `<ChatSidebar>` — single-component 2-mode sidebar (icon 56px ↔ full 240px)
- `<ChatProvider>` — React context holding messages, status, model, error state
- `<Example />` consumes context, renders `Conversation > Message > MessageResponse`
- `ConversationEmptyState` shown when `messages.length === 0`

**Sidebar (`src/components/ChatSidebar.tsx`, ~320 lines)**
- 2 modes: `icon` (56px rail) and `full` (240px) — single component, `motion.aside` with `animate={{ width }}`
- `icon` mode: 4 icon buttons + Recents divider + "No conversations yet" text
- `full` mode: all same items with labels beside icons + ⌘K badge on Search
- State persists via `localStorage["spy-sidebar-mode"]`
- `⌘B` toggles `icon` ↔ `full`
- Settings opens a `SettingsDialog` (shadcn Dialog with live state)
- ChatProvider context wired: "New chat" calls `clearMessages()`
- NO floating menu button — rail is always visible (default = icon mode)
- NO tooltips
- NO hidden mode — can't fully hide the sidebar

**Icons — NOW ALL PIXEL ART**
- All lucide-react AI-element icons swapped to `PixelArtSvg` (pixelarticons)
- All local `*Icon.tsx` wrapper files DELETED (17 files removed, 10 KB+ saved)
- `PixelArtSvg` renders raw pixel-art SVG paths from `pixelart-paths.ts`
- `pixelarticons` npm package installed (813 SVGs, MIT license) — used ONLY for path extraction
- Comparison prototypes: `prototype-3way-icons.html` (3 libraries side-by-side)

**ChatContext (`src/contexts/ChatContext.tsx`, ~95 lines)**
- Holds: `messages`, `status`, `model`, `text`, `error`, `referencedSources`
- Methods: `addUserMessage`, `clearMessages`, `setModel`, `setStatus`, `setError`
- Wraps both ChatSidebar + Example in `HomePage`

**Design tokens** (`src/app/globals.css`, ~680 lines)
- `--radius: 0.55rem` (8.8px) — all shadcn buttons/inputs/cards
- `pixel` radius variant: `--radius-pixel: 0rem` — for pixel-art icons
- `--font-terminal` (VT323), `--font-display` (Unbounded), `--font-body` (Inter)
- `--font-code` (monospace stack: Cascadia, Source Code Pro)
- ~40 design tokens for border surface accent and scrollbar scales
- `@media (prefers-reduced-motion: reduce)` disables all animations
- Scrollbar: 2px global, 4px conversation, hidden on default conversation hover

**ChatProvider** (`src/contexts/ChatContext.tsx`)
- 95 lines, type-safe React context + Provider pattern
- Messages initialized from `initialMessages` static data (4 hardcoded messages)

**AI-Elements** (in `src/components/ai-elements/`)
- 12 files, ~50 components, ALL ported to `PixelArtSvg`
- Sources/Reasoning triggers use pixel art icons
- Code blocks flattened (single container, no nested windows)
- Collapsible animations fixed (0.25s symmetric open/close, max-height animated)

---

## Key files MODIFIED (most recent → oldest)

| File | What changed |
|------|-------------|
| `ChatSidebar.tsx` | Rewrote: 2-mode inline sidebar (56↔240px), no tooltips, no floating button, push layout |
| `home/page.tsx` | Wrapped in ChatProvider, refactored Example to use context, added empty state |
| `contexts/ChatContext.tsx` | New file — all chat state centralized |
| `globals.css` | ~680 lines of design tokens, scrollbar, collapsible, tokenize, reduced-motion |
| `ai-elements/*.tsx` (12 files) | ALL icons swapped to PixelArtSvg (lucide-react removed from these files) |
| `ui/pixelart-svg.tsx` | New file — renders pixel art icons from paths map |
| `ui/pixelart-paths.ts` | New file — 30 pixelarticons SVG path definitions |
| `ui/command-palette.tsx` | Fixed: Search icon import (was missing) |

## Files DELETED (bloat removal)

| Deleted | Why |
|---------|-----|
| `pixel-art-canvas.tsx` | Superseded by `pixelart-svg.tsx` |
| `pixel-spider.tsx` | Superseded by `pixelart-svg.tsx` |
| `geometric-spider.tsx` | Superseded by `pixelart-svg.tsx` |
| 9 `*Icon.tsx` files (plus, x, menu, search, settings, message-square, message-square-plus, pen-tool, copy) | All UI icons now use `PixelArtSvg` directly — no wrapper components needed |
| `pixelart-icons-compact.tsx` (3 variants) | Redundant wrapper — `PixelArtSvg` handles all sizing |
| 10 references `pixelart-motion-paths.ts` | Dead code, never exported from |
| `prototype-icons.html`, `prototype-3way-icons.html`, `prototype-rounded.html` | Reference only, kept in root for review but not in build |
| `src/lib/spider-frames.ts` | Superseded by inline arrays in spider-mascot.tsx |
| `src/app/home/suggestion-test/` | Test route, deleted |

## Suggested skills

- `/design` — for design checkup, review, or finish passes
- `/grill-me` — for interrogating design decisions before building
- `lucide-animated` — if animated icons are needed again (registry available but not used currently)
- `pixelarticons` — the installed icon library (npm package, not registry)

---

## Next 3 things to do

1. **Wire conversation list** — currently always shows "No conversations yet". Need to store conversations in context and render them in the sidebar Recents section.
2. **Wire real LLM** — replace `streamResponse` setTimeout mock with `useChat` from AI SDK. The whole `streamResponse` function is throwaway.
3. **Add sidebar hover actions** — `pen-tool` (rename) and `copy` (duplicate) on conversation rows. Icons already have paths in `pixelart-paths.ts`.
