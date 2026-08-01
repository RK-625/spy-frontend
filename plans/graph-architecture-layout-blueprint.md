# Spy System Architecture — Diagram Layout Blueprint

> **Purpose:** Redraw `graph-architecture.tldraw` from this blueprint.  
> **Source:** Fallback (third-party `cmd` with `deepseek/deepseek-v4-pro` failed: API server error, exit 7). Built from root `AGENTS.md` + `find src -type f` inventory (~162 TS/TSX files).  
> **Canvas units:** Approximate tldraw world coords. Origin = top-left of canvas. 1 unit ≈ 1 px. Non-overlapping sections with ≥80px gutters.

---

## 0. Canvas frame & global rules

| Setting | Value |
|---|---|
| Canvas size | ~4200 × 3200 |
| Title banner | Top strip `y=0–80`, full width: **"Spy — System Architecture (src/)"** |
| Legend strip | Bottom `y=3000–3200`: SoT vs compat, placement policy, edge legend |
| Overlap rule | Section frames never overlap; arrows only in gutter corridors |
| Arrow style | Orthogonal preferred; feed-forward only (left→right or top→bottom) |
| Cycle rule | One labeled cycle only (Chat stream loop) — see §8 |

**Legend (draw as small keyed boxes at bottom):**
- **SoT** = thick border / filled header
- **Compat shim** = dashed border / muted fill
- **Server / Node** = purple-tint frame
- **Client pure logic** = blue-tint frame
- **React host** = lavender-tint frame
- **Deprecated** = gray / strikethrough title

**Edge legend:**
- solid black = import / compose
- solid lavender = HTTP / stream
- dashed = optional / query-param path
- double line = placement policy boundary (annotation, not runtime)

---

## 1. Spatial region map (non-overlapping)

```
Y↓ / X→     0──────────900───────1800───────2700───────3600───4200
0–80        [================ TITLE BANNER =================]
80–900      [ A APP ROUTES ] [ B AI SERVER  ] [ C PROMPTS+TYPES ]
            [   + API      ] [   STACK     ] [   + CONTEXTS     ]
900–1700    [ D CHAT UI (prompt | conversation | shell)        ]
            [   + DotMatrix + Brand + UI primitives            ]
1700–2600   [ E GRAPH REACT HOST ] [ F LIB/GRAPH PURE LOGIC     ]
            [                    ] [   camera|core|layout|     ]
            [                    ] [   placement|render|fix ]
2600–3000   [ G SERVER DB: falkor ] [ H ANIMATION ] [ I DEPRECATED ]
3000–3200   [================ LEGEND + FLOW CALLOUTS ============]
```

**Column gutters:** 80px between A|B|C and E|F.  
**Row gutters:** 80px between row bands.

### Region coordinates (frame top-left → bottom-right)

| ID | Section | x0 | y0 | x1 | y1 |
|---|---|---:|---:|---:|---:|
| A | App Routes + API | 40 | 100 | 880 | 860 |
| B | AI Server Stack | 960 | 100 | 1880 | 860 |
| C | Prompts / Types / Contexts / Hooks / Lib misc | 1960 | 100 | 4160 | 860 |
| D | Chat UI + DotMatrix + Brand + UI | 40 | 980 | 4160 | 1660 |
| E | Graph React Host | 40 | 1780 | 880 | 2520 |
| F | Lib Graph Pure Logic | 960 | 1780 | 4160 | 2520 |
| G | Server DB Falkor | 40 | 2600 | 1200 | 2960 |
| H | Animation (Mascot) | 1280 | 2600 | 2400 | 2960 |
| I | Deprecated | 2480 | 2600 | 4160 | 2960 |

---

## 2. Section A — App Routes + API (`src/app/`)

**Frame title:** `APP — Routes & API (Node.js runtime)`  
**Layout inside A:** two columns — Pages (left), API (right).

### A1 Pages (left column, x≈60–460)

| Node | Path | Summary |
|---|---|---|
| `layout.tsx` | `app/layout.tsx` | Root layout: fonts (Unbounded/Inter/VT323), metadata, hydration fix |
| `page.tsx` | `app/page.tsx` | Landing `/` — composes hero + mascot |
| `home/page.tsx` | `app/home/page.tsx` | Chat workspace `/home` — primary product surface |
| `graph/page.tsx` | `app/graph/page.tsx` | Knowledge graph canvas `/graph` (+ stress/layout/motion query params) |
| `globals.css` | `app/globals.css` | Tailwind v4 `@theme` tokens + chat/design tokens |

### A2 API (right column, x≈480–860)

| Node | Path | Summary |
|---|---|---|
| `api/chat/route.ts` | `app/api/chat/route.ts` | Streaming chat + memory extraction loop → `runAgent` |
| `api/graph/route.ts` | `app/api/graph/route.ts` | Live topology for `/graph` (Falkor; **no xy**) |
| `api/test-db/route.ts` | `app/api/test-db/route.ts` | DB connectivity check |

**Internal stacking (top→bottom):** layout → pages cluster → globals; API routes stacked chat / graph / test-db.

---

## 3. Section B — AI Server Stack (`src/ai/`)

**Frame title:** `AI — Agent / Models / Tools / Schemas`  
**Sub-columns inside B (left→right):** Agent | Models | Tools | Schemas | Root shims

### B1 Agent (`ai/agent/`) — SoT

| Node | Summary |
|---|---|
| `agent/agent.ts` | **SoT** `runAgent` — server-side model streaming |
| `agent/index.ts` | Barrel |

### B2 Models (`ai/models/`) — SoT

| Node | Summary |
|---|---|
| `models/modelstore.ts` | Model / embed model wiring (Vercel AI SDK + Gemini) |
| `models/embeddings.ts` | `gemini-embedding-2` generation (1536 dim truncate) |
| `models/index.ts` | Barrel |

### B3 Tools (`ai/tools/`) — SoT

| Node | Summary |
|---|---|
| `tools/toolset.ts` | upsert / link / search / ask; **never settles layout** |
| `tools/index.ts` | Barrel |

### B4 Schemas (`ai/schemas/`) — SoT `*-schema.ts`

| Node | Summary |
|---|---|
| `ask-schema.ts` | Zod ask input SoT |
| `upsert-schema.ts` | Zod upsert memory SoT |
| `link-schema.ts` | Zod link memories SoT |
| `web-search-schema.ts` | Zod web search SoT |
| `ask-user-question.ts` | Compat re-export shim |
| `upsert-memory.ts` | Compat re-export shim |
| `link-memories.ts` | Compat re-export shim |
| `web-search.ts` | Compat re-export shim |
| `schemas/index.ts` | Barrel |

### B5 Root AI shims (dashed boxes, bottom of B)

| Node | Summary |
|---|---|
| `ai/agent.ts` | Compat → `ai/agent` |
| `ai/toolset.ts` | Compat → `ai/tools` |
| `ai/modelstore.ts` | Compat → `ai/models` |
| `ai/embeddings.ts` | Compat → `ai/models/embeddings` |
| `ai/index.ts` | Public AI barrel |

**Intra-B arrows (feed-forward):**
- `schemas/*-schema` → `tools/toolset` (validate inputs)
- `models/modelstore` → `agent/agent` (model selection)
- `models/embeddings` → `tools/toolset` (embed on upsert/search)
- `tools/toolset` → `agent/agent` (tool registration)
- Root shims → SoT modules (re-export only; draw thin dashed)

---

## 4. Section C — Prompts / Types / Contexts / Hooks / Lib misc

**Frame title:** `CROSS-CUTTING — prompts, types, contexts, hooks, lib helpers`  
**Grid:** 2×3 or 5 small clusters left→right.

### C1 Prompts

| Node | Summary |
|---|---|
| `prompts/system-prompt.ts` | Agent system prompt export |

### C2 Types

| Node | Summary |
|---|---|
| `types/chat.ts` | `ChatContextValue` declarations |
| `types/graph-schema.ts` | Zod Memory Nodes & Edges (`PART_OF`, `RELATES_TO`) |
| `types/models.ts` | Model id / provider types |
| `types/index.ts` | Types barrel |

### C3 Contexts

| Node | Summary |
|---|---|
| `contexts/ChatContext.tsx` | Shared chat state (`useChat` wrapper) |

### C4 Hooks

| Node | Summary |
|---|---|
| `hooks/use-mobile.ts` | Responsive breakpoint state |

### C5 Lib misc (not graph)

| Node | Summary |
|---|---|
| `lib/falkor.ts` | *(also annotated in G)* Server FalkorDB Cypher — topology only |
| `lib/ask-user-question.ts` | Pending-ask client helpers (no morph UI) |
| `lib/models.ts` | Client model catalog (id / provider list) |
| `lib/utils.ts` | `cn()` Tailwind merge |
| `lib/icon-tokens.ts` | Icon token helpers |

---

## 5. Section D — Chat UI + shared visual systems

**Frame title:** `COMPONENTS — Chat (primary) + DotMatrix + Brand + UI`  
**Internal layout:** four horizontal bands / sub-frames.

```
D top row (y≈1000–1280):   [ D1 Prompt SoT ] [ D2 Conversation SoT ] [ D3 Shell SoT ]
D mid row (y≈1300–1480):   [ D4 ai-elements + root shell COMPAT shims (dashed) ]
D bottom (y≈1500–1640):    [ D5 DotMatrix ] [ D6 Brand logos ] [ D7 UI primitives ]
```

### D1 Prompt SoT (`components/chat/prompt/`)

| Node | Summary |
|---|---|
| `prompt-input.tsx` | **SoT** chat-only shell: provider, attachments, textarea, tools, submit |
| `prompt-input-files.ts` | **`PROMPT_INPUT_ACCEPT` SoT** — allowlist + filterIncomingFiles |
| `prompt-input-attachments.tsx` | Attachment chips (restrained radius; rectangular remove badge) |
| `prompt-input-controls.tsx` | Footer tools / model / web controls |
| `attachments.tsx` | Attachment UI pieces |
| `model-selector.tsx` | Model picker UI |
| `speech-input.tsx` | Speech input control |
| `suggestion.tsx` | Suggestion chips |
| `prompt/index.ts` | Barrel |

### D2 Conversation SoT (`components/chat/conversation/`)

| Node | Summary |
|---|---|
| `conversation.tsx` | Message stream container |
| `message.tsx` | Message chrome |
| `chain-of-thought.tsx` | CoT / tool-trace UI |
| `sources.tsx` | Source citation chips (`pill-source-*` exception) |
| `reasoning.tsx` | Reasoning display |
| `shimmer.tsx` | Streaming shimmer |
| `conversation/index.ts` | Barrel |

### D3 Shell SoT (`components/chat/shell/`)

| Node | Summary |
|---|---|
| `chat-sidebar.tsx` | Recents / search / nav |
| `settings-dialog.tsx` | Settings modal |
| `command-palette.tsx` | Command palette |
| `shell/index.ts` | Barrel |

### D4 Compat shims (dashed)

| Node | Summary |
|---|---|
| `chat/ai-elements/*` | Compat re-exports → prompt + conversation (**do not add new impl**) |
| `chat/chat-sidebar.tsx` | Compat → shell |
| `chat/settings-dialog.tsx` | Compat → shell |
| `chat/command-palette.tsx` | Compat → shell |
| `chat/index.ts` | Chat barrel |

### D5 DotMatrix (`components/dotmatrix/`)

| Node | Summary |
|---|---|
| `core/core.tsx` | Grid utilities SoT |
| `core/hooks.ts` | Animation hooks SoT |
| `icons/icons.tsx` | **`DotMatrixIcon` registry SoT** (pixel-art; no lucide in chat) |
| `loaders/hex-9.tsx` | Hex loader |
| `loaders/square-18.tsx` | Square loader |
| `loaders/triangle-16.tsx` | Triangle loader |
| `loaders/loader.css` | Loader styles SoT |
| Root `dotmatrix/*.tsx` / `loader.css` | Compat re-exports |

### D6 Brand (`components/brand/logos/`)

| Node | Summary |
|---|---|
| `openai.tsx` / `openai-dark.tsx` | OpenAI marks |
| `anthropic-black.tsx` / `anthropic-white.tsx` | Anthropic marks |
| `google.tsx` | Google mark |
| `deepseek.tsx` | DeepSeek mark |

### D7 UI primitives (`components/ui/`)

Cluster as one labeled group box (do not expand every file unless space):  
`button`, `dialog`, `input`, `textarea`, `select`, `dropdown-menu`, `command`, `sheet`, `tabs`, `tooltip`, `scroll-area`, `separator`, `switch`, `badge`, `card`, `accordion`, `alert`, `avatar`, `carousel`, `collapsible`, `hover-card`, `input-group`, `button-group`, `progress`, `skeleton`, `sonner`, `spinner` — shadcn-style design-system only.

### D8 Landing (small cluster attached to left of D or under A pages)

| Node | Summary |
|---|---|
| `landing/hero-section.tsx` | Landing hero layout |
| `landing/shiny-text.tsx` | Glint sweep text animation |
| `landing/shiny-text.css` | Shiny text styles |

---

## 6. Section E — Graph React Host (`components/graph/`)

**Frame title:** `GRAPH HOST — React (not pure logic)`  
**Tint:** lavender (React host)

| Node | Summary |
|---|---|
| `graph-canvas.tsx` | Host for `/graph`: Pixi renderer + RTC camera + bake orchestration |
| `node-detail-dialog.tsx` | Node inspector overlay |

---

## 7. Section F — Lib Graph Pure Logic (`lib/graph/`)

**Frame title:** `LIB/GRAPH — Pure logic (placement / layout / render / camera / core)`  
**Tint:** blue (client pure logic)  
**Internal columns left→right:** Fixtures | Core | Placement | Layout | Camera | Render | Barrel

### F1 Fixtures

| Node | Summary |
|---|---|
| `fixtures/mock-graph.ts` | Default ~23n/41e mock + stress fixture |

### F2 Core

| Node | Summary |
|---|---|
| `core/graph-data.ts` | Graph data structures |
| `core/graph-diff.ts` | Dirty diff (`dirtyEdges` / `movedNodeIds`) |
| `core/graph-scale.ts` | Scale helpers |
| `core/graph-style.ts` | Visual style constants |

### F3 Placement (client placement cache policy)

| Node | Summary |
|---|---|
| `placement/placement-cache.ts` | `localStorage` pose cache |
| `placement/memory-placement.ts` | Memory→pose placement |
| `placement/from-memory-graph.ts` | Build placed graph from topology |
| `placement/force-recipe.ts` | Force recipe for d3 settle |

### F4 Layout

| Node | Summary |
|---|---|
| `layout/layout-loop.ts` | Static engine default (continuous off) |
| `layout/layout-loop-d3.ts` | Dynamic-import d3 one-shot settle (`?layout=d3`) + ambient (`?motion=1`) |
| `layout/rim-lock.ts` | RimLock O(E) / incremental |
| `layout/spatial-index.ts` | GraphSpatialIndex (universal residency) |

### F5 Camera

| Node | Summary |
|---|---|
| `camera/rtc-camera.ts` | RTC camera — transforms `graphContent`; **never `stage.scale` for world camera** |

### F6 Render

| Node | Summary |
|---|---|
| `render/pixi-renderer.ts` | Pixi v8 renderer orchestration |
| `render/bake-worker.ts` | DotStream bake worker |
| `render/bake-worker-pool.ts` | Worker pool / latest-only cancel |
| `render/bake-sample.ts` | Bake sampling |
| `render/dot-circle-batch.ts` | Dot circle batching |
| `render/draw-arrow.ts` | Edge arrow primitives |
| `render/edge-signal-pulse.ts` | Edge pulse |

### F7 Barrel

| Node | Summary |
|---|---|
| `lib/graph/index.ts` | Public graph exports |

**Intra-F feed-forward (draw as column pipeline):**
```
fixtures/mock-graph → core/graph-data → placement/* → layout/* → render/pixi-renderer
                                                      ↘ camera/rtc-camera (view only)
core/graph-diff → render bake (dirty path)
layout/spatial-index → residency / bake candidates
```

---

## 8. Section G — Server DB (`lib/falkor.ts`)

**Frame title:** `SERVER DB — Falkor (topology only; no product x/y/rank writes)`  
**Tint:** purple (server)

| Node | Summary |
|---|---|
| `lib/falkor.ts` | FalkorDB connection & Cypher; topology only |

**Placement policy annotation (double-line callout box beside G↔F):**
> Falkor holds topology only. Client d3 + `localStorage` pose cache. Toolset never settles/persists layout. No server placement writes.

---

## 9. Section H — Animation (`animation/`)

**Frame title:** `ANIMATION — Spider mascot (GSAP + dynamic SVG)`

| Node | Summary |
|---|---|
| `spider-mascot.tsx` | React host for mascot |
| `spider/mascot.ts` | Mascot timeline / GSAP targets (`#Antenna`, `#Visor`, legs…) |
| `spider/behaviors.ts` | GSAP behavior helpers |
| *(asset)* `public/mascot-3d.svg` | Glossy 3D robot spider SVG (not under src; note as external leaf) |

---

## 10. Section I — Deprecated

**Frame title:** `DEPRECATED — not wired to / or /home without intent`  
**Tint:** gray

| Node | Summary |
|---|---|
| `ask-user-question-widget/prompt-input-with-widget.tsx` | Old morph + ask widget snapshot |
| `ask-user-question-widget/widget-layout.ts` | Widget layout tokens |
| `ui-prototypes/app-page/page.tsx` | Archived lab page |
| `ui-prototypes/components/interactive-question-variants.tsx` | Interactive question variants |

**Note on canvas:** dashed arrow from I → D1 labeled `do not reintroduce without redesign`.

---

## 11. Master arrow list (from → to + label)

Draw arrows in gutters only. Prefer left→right / top→bottom.

### Product compose (App → UI)

| From | To | Label |
|---|---|---|
| `app/page.tsx` | `landing/hero-section` | compose landing |
| `app/page.tsx` | `animation/spider-mascot` | mascot host |
| `app/home/page.tsx` | `contexts/ChatContext` | provide chat state |
| `app/home/page.tsx` | `chat/prompt/prompt-input` | prompt shell |
| `app/home/page.tsx` | `chat/conversation/*` | message stream |
| `app/home/page.tsx` | `chat/shell/*` | sidebar / settings / palette |
| `app/graph/page.tsx` | `components/graph/graph-canvas` | canvas host |
| `app/layout.tsx` | `app/globals.css` | design tokens |
| `landing/hero-section` | `landing/shiny-text` | title glint |
| `chat/prompt/*` | `dotmatrix/icons` | pixel icons |
| `chat/shell/*` | `components/ui/*` | primitives |
| `chat/prompt/model-selector` | `brand/logos/*` | provider marks |
| `chat/prompt/model-selector` | `lib/models.ts` | client catalog |

### Chat stream cycle (SINGLE labeled cycle)

Draw as one rounded cycle badge between D and A2/B:

```
[ChatContext /home]
        │ POST stream
        ▼
[api/chat/route.ts] ──runAgent──► [ai/agent/agent.ts]
        ▲                              │ tools
        │ SSE / UI message parts       ▼
        └──────── chat UI ◄──── [ai/tools/toolset.ts]
```

| From | To | Label |
|---|---|---|
| `ChatContext` | `api/chat/route` | POST `/api/chat` (stream) |
| `api/chat/route` | `ai/agent/agent` | `runAgent` |
| `ai/agent/agent` | `ai/tools/toolset` | tool calls |
| `ai/agent/agent` | `prompts/system-prompt` | system prompt |
| `ai/agent/agent` | `ai/models/modelstore` | model |
| Stream response | `chat/conversation/*` | render parts (cycle close) |

### Knowledge write / read (feed-forward; no spaghetti)

| From | To | Label |
|---|---|---|
| `ai/tools/toolset` | `lib/falkor.ts` | upsert / link / search Cypher |
| `ai/tools/toolset` | `ai/models/embeddings` | embed content |
| `ai/tools/toolset` | `types/graph-schema` | Memory node/edge types |
| `ai/schemas/*-schema` | `ai/tools/toolset` | Zod validate |
| `api/graph/route` | `lib/falkor.ts` | fetch topology (no xy) |
| `graph-canvas` | `api/graph/route` | GET live topology |
| `graph-canvas` | `lib/graph/placement/*` | cache hit/miss pose |
| `graph-canvas` | `lib/graph/layout/*` | static / `?layout=d3` settle |
| `graph-canvas` | `lib/graph/render/pixi-renderer` | draw |
| `graph-canvas` | `lib/graph/camera/rtc-camera` | pan/zoom world |
| `graph-canvas` | `node-detail-dialog` | inspect node |
| `placement-cache` | *(browser localStorage)* | pose read/write (annotate external) |
| `fixtures/mock-graph` | `graph-canvas` | default / `?stress=1` |

### Explicit non-edges (annotate as banned / policy)

| Claim | How to show |
|---|---|
| Toolset never settles/persists layout | Red X note on `toolset → layout` |
| Falkor has no product xy/rank writes | Red X note on `falkor ← placement` |
| Camera never uses `stage.scale` for world | Note on `rtc-camera` |
| Deprecated ask-widget not in live prompt | Dashed ban arrow I ↛ D1 |

---

## 12. Placement policy boundary (draw as vertical double-line between E/F and G)

Three labeled lanes across bottom of F/G:

1. **React host** → `components/graph/*`  
2. **Client pure logic** → `lib/graph/{placement,layout,render,camera,core,fixtures}`  
3. **Server DB** → `lib/falkor.ts` (topology only)

Callout text (from AGENTS.md):
> Client placement cache MVP: Falkor topology only; client d3 + localStorage pose cache; live `/graph` cache-hit paints / cache-miss one-shot settle. Continuous layout off by default.

---

## 13. Suggested tldraw redraw order

1. Draw section frames A–I with titles and tints (no overlap).  
2. Place leaf nodes with short summaries inside each frame.  
3. Draw SoT vs dashed compat styling.  
4. Add feed-forward arrows from §11 (skip reverse edges except the one chat cycle).  
5. Add placement-policy double-line + banned-edge callouts.  
6. Add legend strip.  
7. Title banner last (or first) for framing.

---

## 14. Quality checklist before finishing the tldraw file

- [ ] No overlapping section frames  
- [ ] All major `src/` domains present (ai, app, components/{chat,graph,landing,ui,dotmatrix,brand}, lib/{falkor,graph}, animation, contexts, hooks, prompts, types, deprecated)  
- [ ] Major files appear as leaves with ≤1-line summaries  
- [ ] Arrows hierarchical / feed-forward  
- [ ] Exactly one labeled chat stream cycle  
- [ ] Placement policy (topology vs pose) visible  
- [ ] Compat shims visually distinct from SoT  
- [ ] Deprecated parked and not wired into live routes  

---

*End of blueprint.*
