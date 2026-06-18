# Spy — Design Brief

## Register

**Brand** (landing page, marketing) + **Product** (chat UI). The workspace/app is Product register.

## Name

**Spy** — always capitalized, always the full name. No abbreviation.

## Category

AI knowledge management agent. An alien spider that weaves and maintains a knowledge graph for you.

## Users

People with messy knowledge — students, researchers, lifelong learners, creators — who accumulate notes, ideas, and fragments of memory across tools and want an agent to organize it all into a connected web they can navigate and remember.

They arrive curious ("what is this?") and leave intrigued ("I want to try this").

## Purpose

Spy is an agent-first knowledge base. Unlike Obsidian or Notion, you don't organize your own notes. You throw information at Spy — messy, raw, unstructured — and the agent weaves it into a knowledge graph, connecting related concepts, mapping memory orientation, and maintaining the web over time.

The landing page's job: make the visitor believe this agent is real, alive, and worth trying.

The chat UI's job: be a clean, distraction-free conversation surface where the agent's intelligence is the focus.

## Artifact

**3D Gradient Sphere Backdrop** — A dynamic, morphing 3D gradient sphere that represents the active, alien, processing intelligence of Spy. It runs full-screen behind the hero as an ambient backdrop. The knowledge graph is built by the agent and shown inside the application itself.

## Evidence

The morphing 3D sphere gradient and the multi-phased terminal scramble sequence demonstrate the product's core value: turning raw, messy information into structured, intelligent form.

## Voice

- Playful but not childish
- Mysterious but not edgy
- Smart but not corporate
- Warm but not soft
- Confident but not loud

Spy talks like a clever alien who finds human knowledge fascinating and slightly chaotic. "An alien sent to organize your chaos." captures the tone perfectly.

## Anti-references

Do NOT look like:
- Generic AI startup landing pages (dark bg + cyan neon + centered hero)
- Terminal/developer tool aesthetics (monospace, green-on-black)
- Corporate SaaS (navy, rounded cards, "trusted by" logos)
- Cartoonish mascots, big eyes, cute characters
- Any product that could swap its name and still work
- ChatGPT/Claude generic chat layouts — Spy's chat should feel distinctly alien

## Design principles

1. **Complex 3D Glossy Aesthetics** — The mascot is a highly detailed 3D glossy robot spider. The background shader gradient is the complex visual; everything else recedes.

2. **Dark utility register** — Sparse layout, high contrast where it matters, low contrast everywhere else.

3. **Distinctive over safe** — Unbounded and VT323 over Inter for headings. Deep glossy purple/lavender over typical startup dark/cyan templates.

4. **Ambient over loud** — Continuous subtle animation over flashy effects. The page should feel inhabited, not performing.

5. **One verb per action** — "Start weaving", not "Get started now". Every word earns its place.

6. **Consistency is king** — Every component follows the same design tokens. Same radius, same spacing scale, same color roles. No orphan treatments.

## Visual foundation

### Color

**Surface & Background:**
- `#060610` — deepest black, page background base
- `#150c28` — dark purple, chat page background
- ShaderGradient 3D Sphere: `#4A1280` / `#8838DE` / `#DDB8F8`

**UI Text & Accents (unified lavender-white system):**
- `#e8dff8` — primary accent (submit button, focus rings, links, interactive highlights)
- `#f0eaff` — hover accent (brighter variant)
- `#ded4f0` — primary text (headings, strong)
- `#e8e4df` — body text (warm off-white)
- `#C8ACFB` — secondary text (inline code, triggers, muted labels)
- `#9a8cc0` — dim text (suggestion chips, branch selector)
- `#7a7685` — muted text (blockquote, metadata)
- `#4a4658` — dimmest text

**Surfaces:**
- `rgba(10, 5, 22, 0.8)` — code blocks, elevated containers
- `rgba(14, 7, 32, 0.5)` — suggestion chips, toolbar bg
- `rgba(200, 172, 251, 0.08)` — borders, dividers
- `rgba(200, 172, 251, 0.04)` — trigger backgrounds

**Color rules:**
- Background is dark purple/lavender, transitioning to deepest black
- All interactive accents use glossy lavender-white (`#e8dff8`), never gold
- Text is never pure `#fff` — always warm off-white or lavender-tinted
- Borders use `rgba(200, 172, 251, 0.08)` at 1px — barely visible, structural

### Typography

- **Display:** Unbounded (400, 500, 600, 700) — headings, section titles
- **Terminal:** VT323 — scramble text, visor text, tech indicators, logo
- **Body:** Inter (400, 500) — tagline, descriptions, UI text, suggestion chips
- **Code:** `ui-monospace, Cascadia Code, Source Code Pro, Menlo, Consolas` — code blocks, inline code
- Light on dark needs compensation: heavier weights, more line-height, trace of letter-spacing
- Sentence case everywhere

### Spacing & Radius

- **Spacing scale:** 4px base. Components use 4/8/12/16/24/32px multiples
- **Border radius:** `--radius: 0.55rem` (8.8px) — applied globally via CSS token
- **Input wrapper:** `0.825rem` (13.2px) — slightly larger for the elevated input area
- **No pill shapes** — radius is present but restrained, never fully rounded

### Motion

- **Collapsible open:** 0.25s ease-out, opacity 0→1, translateY -4→0, max-height 0→500px
- **Collapsible close:** 0.25s ease-in, opacity 1→0, translateY 0→-4px, max-height 500→0
- **Chevron rotation:** 0.25s ease via CSS `rotate` property (not `transform`)
- **Input focus glow:** 0.35s ease border-color + box-shadow
- **Suggestion hover:** all 0.2s
- **Scroll fade:** 48px gradient at bottom of conversation area
- **Dissolve overlay:** 2.5s linear fade-out on page load

## Chat UI Design System

### Layout

- **Viewport-locked:** `h-screen` container, header top / messages scroll / input bottom
- **Max width:** `max-w-4xl` (896px), centered
- **Background:** `bg-[#150c28]/80 backdrop-blur-sm` over ShaderGradient

### Message Bubbles

- **User:** Right-aligned, `max-width: 70%`, gradient bg (`rgba(30,21,64,0.95)` → `rgba(26,16,56,0.85)`), 1px lavender border, `var(--radius)` corners, `px-4 py-3`
- **Assistant:** Left-aligned, full width, no bg, clean markdown typography

### Code Blocks

- **Single container** (no nested windows): outer `rgba(10,5,22,0.8)` bg, 1px border, `var(--radius)` corners
- **Header:** language label (top-left), copy button (top-right, visible on hover only)
- **Font:** `ui-monospace` stack at 0.78rem, line-height 1.6
- **Line numbers:** 13px, right-aligned, `rgba(200,172,251,0.50)` color

### Input Area

- **Elevated wrapper:** `0.825rem` radius, `rgba(10,5,22,0.65)` bg, `blur(16px)` backdrop, 1px border
- **Focus state:** border `rgba(200,172,251,0.2)`, glow shadow, top gradient line
- **Toolbar:** all buttons `size-8` (32×32), `var(--radius)` corners, ghost variant
- **Submit:** `bg-primary` (`#e8dff8`), `text-primary-foreground` (`#150c28`), ArrowUp icon

### Suggestion Chips

- Horizontal scroll, no visible scrollbar, `px-4` padding
- `var(--radius)` corners, Inter 0.75rem medium, `text-[#9a8cc0]`
- Border `rgba(200,172,251,0.1)`, bg `rgba(14,7,32,0.5)`
- Hover: border `rgba(232,223,248,0.2)`, bg `rgba(232,223,248,0.06)`, text `#f0eaff`

### Collapsible Triggers (Sources / Reasoning)

- `inline-flex`, `var(--radius)` corners, `rgba(200,172,251,0.04)` bg
- 1px border `rgba(200,172,251,0.08)`, hover: `0.08` bg, `0.15` border
- Icon (BookIcon/BrainIcon) + text + chevron, 0.75rem font
- Chevron rotates 180° on open via CSS `rotate` property

### Scrollbar

- Conversation: 4px wide, `rgba(255,255,255,0.15)` thumb, `min-height: 40px`, `scrollbar-gutter: stable`
- Global: 2px wide, same thumb color

## Component rules

### Buttons
- Lavender-white (`#e8dff8`) background for primary actions
- Ghost variant for toolbar buttons
- `var(--radius)` corners, `size-8` (32×32) for toolbar
- One verb per button label

### Spider mascot
- 3D glossy vector SVG loaded dynamically
- GSAP animation targeting internal group IDs
- Always centered, always the visual anchor on landing page

### Shader Backdrop
- Canvas-rendered 3D noise deformation
- Purple/lavender/deep violet hues
- Full-screen, fixed position, z-index -10

## Tech stack

- **Framework:** Next.js 16 App Router (Turbopack)
- **Styling:** Tailwind CSS v4 with CSS custom properties
- **Chat UI:** ai-elements (local components on shadcn primitives)
- **Mascot:** Dynamic SVG + GSAP
- **Backdrop:** ShaderGradient 3D canvas
- **Fonts:** Google Fonts (Unbounded + Inter + VT323) via next/font

## Constraints

- Desktop only for v1 (no responsive/mobile yet)
- No sound
- No backend/API calls in demo — pure frontend with mock streaming
- Build produces static export (prerendered)
