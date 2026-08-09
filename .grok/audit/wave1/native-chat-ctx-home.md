# Wave 1 — native chat-ctx / hooks / types / home

**Agent:** leaf implementer (chat-context domain)  
**Mode:** Audit → auto-fix ≥75% only  
**Scope write:** `src/contexts/**`, `src/hooks/**`, `src/types/**`, `src/app/home/**`  
**Hard stops:** no push/force/dep bumps; keep `ChatProvider` + `PromptInputProvider` pattern

---

## Prior art (git)

| Commit | Change |
|--------|--------|
| `ec78d6e` | Remove `ChatProviderWrapper`; fold `TooltipProvider` into `ChatProvider` |
| `4a5b253` | Delete `use-chat-submit.ts`; inline submit into prompt shell |
| `b574b06` | `PromptInputWorkspace` zero-prop shell; home stops prop-drilling status/stop/pendingAsk |

---

## Audit findings

### Already clean (no fix)

| Item | Status |
|------|--------|
| `ChatProviderWrapper` | Gone; home mounts `ChatProvider` directly |
| Prop drilling to `PromptInputWorkspace` | Zero-prop; workspace reads `useChatContext` |
| Soft default on chat context | `createContext(null)` + throw in `useChatContext` — no silent empty object |
| Dual providers pattern | `ChatProvider` (stream) + `PromptInputProvider` (draft/prefs) kept |
| Graph types (`graph-schema`, `graph-topology`) | Untouched |
| `any` / client `@/ai` imports in scope | None |
| Hidden dead UI on `/home` | None remaining (suggestions/ShaderGradient already removed) |
| Naming vs `PromptInput*` | Symmetric enough: `ChatProvider` / `useChatContext` vs `PromptInputProvider` / `usePromptInputContext` |

### Consumers of stream API (post-audit)

| Surface | Fields used |
|---------|-------------|
| `/home` `ChatWorkspace` | `status`, `messages`, `error` |
| `PromptInputWorkspaceContent` | `sendMessage`, `status`, `stop`, `messages` |
| `ChatSidebar` | `clearMessages` |
| `SettingsDialog` | `status`, `messages`, `error` |

### Fixed (≥75%)

#### 1. Dead hook: `src/hooks/use-mobile.ts` — **deleted** (100%)

- Zero imports in production/src.
- Only historical consumer was deleted shadcn `sidebar.tsx` (`78e029d`).
- Task rule: “hooks dir may only have use-mobile — **keep if used**” → unused → remove.
- Soft-default smell inside hook (`return !!isMobile` coerces `undefined` → `false`) becomes moot.
- `src/hooks/` directory removed (empty).

#### 2. Stale `ChatContextValue.addToolOutput` — **removed** (90%)

- Exposed on context + types; **no consumer** anywhere.
- Product ask path: user answers as a normal chat message; `runAgent` uses `ignoreIncompleteToolCalls: true` — not `addToolOutput`.
- Pruned from `ChatContextValue` and `ChatProvider` value memo / `useChat` destructure.

#### 3. Unused `export type { ChatStatus }` dual path — **removed** (85%)

- Re-export from `@/types/chat` had zero importers.
- Consumers that need status type already import `ChatStatus` from `"ai"` (e.g. submit control).
- `ChatStatus` remains an internal field type on `ChatContextValue`.

#### 4. Type import hygiene — **fixed** (85%)

- `ChatContext`: `React.ReactNode` → `import type { ReactNode }`.
- `/home`: `React.CSSProperties` without React value import → `import type { CSSProperties }`.
- Dropped redundant `messages: [] as UIMessage[]` on `useChat` (SDK default empty list).

### Not fixed (below 75% or out of scope)

| Item | Why left |
|------|----------|
| Local `SpyUITools` webSearch mirror on home | Client-safe; avoids bundling toolset/Falkor. Not dual type debt. |
| `toolCallId` on `PendingAskUserQuestion` unused for tool-result path | Lives in `src/lib/ask-user-question.ts` (out of write scope); intentional message-answer product path |
| AGENTS.md still lists `use-chat-submit.ts` / `use-mobile.ts` | Docs out of write scope; note for docs pass |
| `chat-session-persistence.md` still references deleted submit hook | Plan draft, not product code |
| Message render IIFEs / CoT structure on home | Working product UI; refactor would be style-only |

---

## Files changed

| Path | Action |
|------|--------|
| `src/hooks/use-mobile.ts` | **Deleted** (dir removed) |
| `src/types/chat.ts` | Drop `addToolOutput`, drop `ChatStatus` re-export, comment stream-only contract |
| `src/contexts/ChatContext.tsx` | Drop `addToolOutput`, `ReactNode` import, omit empty initial messages |
| `src/app/home/page.tsx` | `CSSProperties` type import |
| `.grok/audit/wave1/native-chat-ctx-home.md` | This report |

---

## Post-fix architecture (stream)

```
HomePage
└── ChatProvider          ← useChat + TooltipProvider
    ├── ChatSidebar       ← clearMessages
    └── ChatWorkspace     ← status / messages / error
        └── PromptInputWorkspace (zero-prop)
            └── PromptInputProvider
                └── PromptInputWorkspaceContent  ← sendMessage / status / stop / messages
```

---

## Residual risks / follow-ups (not this commit)

1. Docs drift: AGENTS.md architecture tree still mentions `use-chat-submit.ts` and `use-mobile.ts`.
2. If product ever moves askUserQuestion to true client tool-result protocol, reintroduce `addToolOutput` (or `addToolResult`) on purpose — not as a soft always-on surface.
3. Session persistence plan should wire `sessionId` into `ChatProvider` / prompt submit body, not resurrect `use-chat-submit.ts` as a separate hook unless prefs re-split.
