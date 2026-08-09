# Wave 1 audit — native chat-shell

**Domain:** `src/components/chat/shell/**` (sidebar, settings dialog, command palette)  
**Mode:** Audit then auto-fix ≥75% only  
**Date:** 2026-08-08  
**Agent:** native leaf (chat-shell)

## Scope read first

- `AGENTS.md` / codebase context (chat primary surface; DotMatrix only; no lucide)
- `.grok/rules/code-preferences.md` (no `any`, descriptive names, isolation)
- Git history: `remove useOptionalPromptInputContext`, PromptInputContext rename, dead model row drop in settings

## Files audited

| File | Role |
|------|------|
| `chat-sidebar.tsx` | Collapsible nav; owns settings open + new-chat via `useChatContext` |
| `settings-dialog.tsx` | Session status / message count / error |
| `command-palette.tsx` | ⌘K search dialog + optional theme group |
| `index.ts` | Domain barrel (`export *`) |

## Hunt results

### Clean already (no fix)

| Check | Result |
|-------|--------|
| Optional/soft context | **Pass.** Settings previously used `useOptionalPromptInputContext` for a model row; removed in `686344b`. Both consumers use **required** `useChatContext()` (throws outside `ChatProvider`). |
| Dead model rows | **Pass.** Model row already stripped with optional context. |
| Lucide icons | **Pass.** DotMatrix only (`plus`, `search`, `settings`, `panelLeft*`, theme icons, `x`). |
| `any` | **Pass.** None. |
| Barrel bypass | **Pass.** `@/components/ui`, `@/components/dotmatrix`; shell-internal relatives. Chat barrel re-exports shell unchanged. |
| Prop drill of stream state | **Pass.** Sidebar/settings read `ChatContext` in-tree; only dialog open flags are parent-local (correct). |
| PromptInputContext alignment | **Pass.** Settings no longer soft-reads prompt prefs (correct: Settings is outside `PromptInputProvider` in `/home` tree). |

### Issues fixed (≥75% confidence)

| ID | Conf | Finding | Fix |
|----|------|---------|-----|
| F1 | 95% | Dual export `CommandPalette as CommandMenu` — dead dual-export shim, never imported | Dropped `CommandMenu` alias; single export |
| F2 | 90% | Internal/public types used `CommandMenu*` while component is `CommandPalette` | Renamed to `CommandPaletteItemDef` / `CommandPaletteGroupDef` / `CommandPaletteTrigger*` |
| F3 | 90% | `showThemeGroup` defaulted `true` while only product consumer forced `false` | Default **`false`**; product path no longer needs the prop; opt-in remains |
| F4 | 92% | Dialog placement used undefined `--nav-stack-height-mobile/desktop` → invalid `calc()` | Desktop-first fixed placement (`top-[12vh]`, centered width) without phantom tokens |
| F5 | 85% | Generic local names (`mode`, `hydrated`, `settingsOpen`, `isFull`, `open`, `query`, `run`, `handleOpen`) | Renamed to `sidebarMode*`, `settingsDialogOpen`, `paletteOpen`, `searchQuery`, `closeThenRun`, `handleOpenPalette`, etc. |
| F6 | 88% | Search trigger wrapped in a `div`; `cloneElement` attached `onClick` to wrapper while inner button had noop handler | Trigger is now `SidebarItem` directly so open wires onto the button |
| F7 | 80% | `React.ComponentType` without React value import in sidebar | Import `type ComponentType` from `react` |
| F8 | 78% | Settings props were anonymous inline type with param `b` | Named `SettingsDialogProps`; `onOpenChange: (open: boolean) => void` |

### Deferred / not auto-fixed (<75% or out of policy)

| Item | Why deferred |
|------|----------------|
| Theme group implementation still present (opt-in) | Not dead API; product default is off. Full removal would drop `next-themes` coupling but is optional cleanup, not a bug. **No ThemeProvider** in app — opt-in path is weak; leave for explicit theme work. |
| Empty palette (no conversation groups) | Product gap (recents not wired), not a shell hygiene fix. Do not invent mock rows. |
| Settings UX expansion (theme, keys, account) | Hard stop: do not redesign settings UX. Copy already says future release. |
| Shared `isEditableTarget` helper across sidebar + palette | Only two sites; extract later if a third appears. |
| Chat barrel change | Not needed — `export * from "./shell"` still correct; public type rename is additive via re-export. |

## Post-fix surface

- **Required context:** `useChatContext` only (sidebar: `clearMessages`; settings: `status` / `messages` / `error`)
- **Public exports:** `ChatSidebar`, `CommandPalette`, `CommandPaletteProps`, `CommandPaletteGroupDef`, `SettingsDialog`, `SettingsDialogProps`
- **Removed public:** `CommandMenu`, `CommandMenuGroupDef`

## Verification

- Grep: no lucide, no `any`, no `CommandMenu`, no optional context in shell
- Manual: type shapes consistent; product `/home` still imports `ChatSidebar` from `@/components/chat`

## Commit

See git: `fix(chat-shell): audit wave1 naming, dual export, palette placement`
