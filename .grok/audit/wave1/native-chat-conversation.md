# Wave 1 — native-chat-conversation

Domain: `src/components/chat/conversation/**` (+ chat barrel conversation re-export comment)

Mode: Audit then auto-fix (confidence ≥ 75%)

## FIXED

| Issue | Confidence | Change |
|---|---|---|
| Dead `reasoning.tsx` (never imported outside itself; `/home` uses CoT for reasoning parts) | 95% | Deleted file; removed barrel re-export |
| Dead message chrome: `MessageActions`, `MessageAction`, `MessageBranch*`, `MessageToolbar` (zero product consumers) | 95% | Stripped `message.tsx` to `Message` / `MessageContent` / `MessageResponse` |
| Unused `CollapsibleTrigger` import in CoT | 98% | Removed |
| Dual DotMatrix imports (value + type separate lines) | 90% | Merged into one import |
| Loading phrase RNG never picks last phrase (`length - 1`) | 95% | Use full `LOADING_PHRASES.length` |
| `new URL(href)` can throw on malformed source URLs | 90% | `hostnameFromHref` with try/catch |
| Props type named `TextShimmerProps` while export is `Shimmer` | 92% | Renamed to `ShimmerProps` |
| Sources default icon used `className="h-4 w-4"` instead of `size` like rest of chat | 88% | `size={16}` for DotMatrixIcon consistency |
| Package barrel comment still listed "reasoning" | 98% | Updated conversation domain blurb |

## DEFERRED

| Issue | Why |
|---|---|
| `chain-of-thought.tsx` ~1.8k lines (mostly `LOADING_PHRASES` copy) | Product copy, not dead code; extract to `loading-phrases.ts` is pure move — skip without layout redesign |
| CoT / Sources collapsible trigger styling vs `brief.md` elevated chip spec | Live CoT header already diverged (no border/bg); aligning Sources alone would freestyle UI |
| Timeline step icon `rounded-full` (size-5 circle) | Not a control pill; natural node marker — keep |
| Status step-count badge `rounded-full` + `--pill-status-*` | Parallel to deliberate source-pill token system |
| Source/URL chips `rounded-full` | Explicit product exception (`pill-source-*`) |
| Generic `isOpen` / `setIsOpen` naming in CoT context | Radix-controllable pattern; rename is churn without consumer confusion |
| Export surface of compound CoT pieces (`ChainOfThoughtContent` etc.) | Used internally by root; keep compound API |
| AGENTS.md / plans still mention `reasoning.tsx` | Out of write scope |
| Restore MessageBranch when multi-branch chat ships | Product not there yet; re-add when needed |

## DOUBTS

- None blocking. Dead Reasoning was confidently removed because production path maps `reasoning` UIMessage parts into `ChainOfThoughtStep`, not the standalone Reasoning collapsible.
- If a future "thought for N seconds" duration UI is desired, reintroduce a slim reasoning chrome or fold duration into CoT header — do not resurrect the full Streamdown+auto-close stack without a product ask.

## FILES

### Touched
- `src/components/chat/conversation/message.tsx` — slimmed to live exports
- `src/components/chat/conversation/chain-of-thought.tsx` — imports, phrase RNG, safe hostname
- `src/components/chat/conversation/shimmer.tsx` — `ShimmerProps` rename
- `src/components/chat/conversation/sources.tsx` — DotMatrix size prop
- `src/components/chat/conversation/index.ts` — drop reasoning export; barrel header
- `src/components/chat/index.ts` — domain comment only

### Removed
- `src/components/chat/conversation/reasoning.tsx`

### Unchanged (audited clean enough)
- `src/components/chat/conversation/conversation.tsx` — DotMatrix scroll control, package barrels OK

## HUNT CHECKLIST

| Check | Result |
|---|---|
| Dual import paths / shims into conversation | None (consumers use `@/components/chat`) |
| Lucide / non-DotMatrix icons | None |
| Gold/amber / pure white text | None (only phrase copy containing "gold") |
| Pill radii except source chips | Source chips + status pill + circular step nodes only |
| `any` / loose types | None |
| Client importing server-only | None |
| Dead exports | Removed |

## COMMITS

- `refactor(chat): prune dead conversation chrome and harden CoT`
