# Spy UI audit — verified action page (1 page)

**Method:** 39 raw audits → **batches of 5** → **cross-model** validators (auditor ≠ reviewer, max-turns ~18–20) → **one reusable native** spot-check helper → raw reports **deleted**.  
**Surviving artifacts:** `MASTER-BACKLOG.md` · `meta/batch*` · this file.  
**Date:** 2026-07-22

---

## Priority action list (ship order)

| P | Domain | Action | Why (validated) |
|---|--------|--------|-----------------|
| **P0** | **Sources / design system** | Apply `--pill-source-*` + `rounded-full` to `Source` chips (mirror CoT search chips) | Multi-model KEEP; AGENTS pill exception; native confirmed |
| **P0** | **A11y — speech** | Default `aria-label` on mic; expose recording state to AT | Cross-validated blocker; F4 spinner claim partly false — keep F1 |
| **P0** | **A11y — command palette** | Combobox/listbox/`aria-activedescendant`; stop stripping focus-visible; single open-focus path | Hy3→deepseek all 7 confirmed; native strong KEEP |
| **P1** | **A11y — model popover** | Remove `outline-hidden!` or restore focus ring on selector content | deepseek CONFIRMED major |
| **P1** | **A11y / HTML** | Reasoning trigger: no `<p>` inside `<button>` (use span) | deepseek KEEP; invalid HTML |
| **P1** | **Icons** | Attachment **video** category: stop using `arrowUp` glyph | deepseek CONFIRMED |
| **P1** | **Tokens** | Settings (and sidebar) raw hex → `text-text-*` / accent tokens; status colors without emerald/red scatter | Batch1 native + deepseek |
| **P1** | **Structure** | Drop nested `TooltipProvider` inside `MessageAction` (root provider already on home) | MiniMax KEEP escalated |
| **P2** | **Shell / AGENTS** | home `!size-8` / `!rounded` / Tools `!` overrides → fix defaults in shell, not call-site `!important` | Qwen/MiniMax major agreement |
| **P2** | **Home UX** | Gate **Suggestions** when `messages.length > 0` | deepseek KEEP |
| **P2** | **Home layout** | Align header `px-6` with content `px-4` gutter | deepseek KEEP |
| **P2** | **CSS** | `chat-fade-bottom` use `color-mix` / token, not hard rgba | deepseek KEEP |
| **P2** | **Sidebar a11y** | `type="button"`; fix Search double ring; optional onClick | Qwen KEEP |
| **P2** | **Message** | `MessageBranchContent` spread order — don’t clobber `className` | native KEEP |
| **P2** | **Conversation** | Scroll button default `aria-label`; remove dead `[data-slot=scroll-button]` CSS | confirmed |
| **P3** | **Structure** | Extract CoT `LOADING_PHRASES` out of component module | 3 models agree bulk; not UX blocker |
| **P3** | **State** | ChatContext: drop dead toast import; don’t hoist model/mode open state if single consumer; slim public API | Qwen confirmed over-surface (not all “majors”) |
| **P3** | **Polish** | Footer/header pad consistency; collapse icon jump; divider calc; dead ModelSelectorDialog | scattered KEEP/nit |

---

## By category (eligible only)

### Vulnerabilities / a11y (treat as must-fix)
- Command palette keyboard + AT (combobox pattern)
- Speech mic unnamed control
- Model selector focus killed by `outline-hidden!`
- Reasoning invalid button content

### Important (design system / correctness)
- Sources missing pill-source tokens
- Video attachment wrong icon
- Settings/sidebar untokenized palette colors
- Nested tooltip providers
- Call-site `!important` fighting prompt shell

### Improvements
- Suggestions empty-only gate · header gutter · fade token · MessageBranch props · LOADING_PHRASES extract · ChatContext slim · platform detection modernize

### UI polish
- Sidebar stacked py / divider calc / justify jump · empty-state pad · CoT step `rounded-full` policy · option title on line-clamp · dead CSS slots

### Good-to-have
- Hoist repeated classes · dead ModelSelectorDialog · type unions for model/mode · toast on submit error

---

## Explicitly **rejected** (do not implement)

| Claim | Reason |
|-------|--------|
| `--radius-badge` / `--border-subtle` **undefined** | **False** — defined & used (MiniMax cross-check); retract old SYNTHESIS P0 |
| Must use **`addToolOutput`** for askUserQuestion | Product is **Q:/A:** user message + ignoreIncompleteToolCalls |
| Message user-bubble “major” token crisis | Intentional asymmetry; rejected by Qwen+native |
| CoT Context = major over-eng defect | Compound open/streaming pattern; optional style only |
| Reasoning `isExplicitlyClosed` “dead trap” | Claim inverted vs code |
| DotMatrix required for 6px status dot | Unrenderable; CSS circle OK |
| Suggestion chips need new spacing token family | Over-engineering (MiniMax rejected Qwen 8/10) |
| Widget mode “shouldn’t ship” | Live product path for pending ask |
| StickToBottom “overrides” overflow-hidden | Only when overflow is `visible` |

---

## Domain map (quick)

| Domain | Top items |
|--------|-----------|
| **Chat chrome** | Palette a11y · sidebar ring/type · suggestions gate |
| **Message stream** | Sources pills · tooltip hoist · branch className · reasoning HTML |
| **Prompt shell** | Kill call-site `!` · pad owners · video icon |
| **Tokens/CSS** | Settings hex · fade rgba · dead scroll-button rule |
| **State** | ChatContext surface area · silent submit errors |
| **Ask widget** | **Pass** — pad ownership + allowCustom omit TA confirmed clean |

---

## Process notes

- Batches **1–8** processed; re-delegated failures (02, 03, 09, 12) to **different** models.  
- Native helper id chain: `…07f414db` → `…5e05d8b9671` → `…1e88ab2a44d0`.  
- Raw `NN-*.md` audits **deleted** after verification. Meta validations retained under `tmp/ui-audit/meta/` for audit trail (delete anytime).

**Next engineering step:** implement **P0 only** (Sources pills · speech name · command palette a11y), then P1.
