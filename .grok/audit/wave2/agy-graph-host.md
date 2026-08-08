# Codebase Audit: Graph Host Domain (`src/components/graph` + `src/app/graph`)

**Target Domain**: `src/components/graph/`, `src/app/graph/`  
**Date**: August 8, 2026  
**Auditor**: AGY Leaf Agent  
**Scope**: Read-only Architectural & Code Preferences Audit  

---

## Executive Summary

An in-depth audit of the **Graph Host** domain (`src/components/graph/` and `src/app/graph/`) was conducted against the project design constitution ([`AGENTS.md`](file:///Users/apple/Development/Spy/spy-frontend/AGENTS.md)) and code preference guidelines ([`.grok/rules/code-preferences.md`](file:///Users/apple/Development/Spy/spy-frontend/.grok/rules/code-preferences.md)).

Overall, the graph host domain demonstrates **strong alignment with recent architectural pivots**:
- **Live-Only Pivot Compliance**: Fully compliant with [`plans/graph-live-only-pivot.md`](file:///Users/apple/Development/Spy/spy-frontend/plans/graph-live-only-pivot.md). Single route `/graph`, no URL query overrides (`?stress`, `?source`, `?layout`, `?motion`, `?mock`), GET `/api/graph` live fetching, and clean blank-canvas fallback without mock product data.
- **Zero Mock / FA2 Remnants**: Completely clean of ForceAtlas2 / graphology remnants and mock flag branches.
- **Strict Quality Bans Respect**: Adheres to all active graph quality bans (no lodMul/maxDots/skipOuterLats shortcuts, world-space camera transforms, default off for ambient continuous motion).
- **TypeScript Strictness**: Zero `any` types across the domain.

However, several architectural, lifecycle, performance, and tokenization items were identified:

1. **Async Mount & State Race Condition (High)**: Signal pulse state changes (`pulsesOn`) can race with in-flight dynamic imports and async renderer mounting, risking UI toggle button desynchronization.
2. **Per-Frame Component Re-render via RAF HUD State (High)**: Updating React component state (`setHud`) on every animation frame during panning/zooming causes full virtual DOM diffing of the host component and header chrome at 60–120fps.
3. **Missing Package Barrel Export (Medium)**: `src/components/graph` lacks a top-level `index.ts` domain barrel, resulting in deep imports (`@/components/graph/graph-canvas`) in `src/app/graph/page.tsx`.
4. **Icon Token Policy Drift (Medium)**: Raw numeric icon size (`size={15}`) passed to `DotMatrixIcon` instead of `ICON_GLYPH` token constants.
5. **Un-indexed Linear Hit-Testing (Medium)**: `hitTestNode` performs an $O(N)$ linear loop over all graph nodes on pointer click events rather than using spatial candidate indexing.

---

## Audit Findings Matrix

| ID | Severity | Category | File | Description |
|---|---|---|---|---|
| **GH-01** | 🔴 HIGH | Lifecycle & Race Condition | [`graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L116-L117,L248-L298) | `pulsesOn` toggle during dynamic import or renderer mount causes state desync with Pixi renderer. |
| **GH-02** | 🔴 HIGH | Performance & React State | [`graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L89-L93,L126-L138,L185,L214) | `setHud` state update on every RAF during pan/zoom forces 60–120fps React component re-renders. |
| **GH-03** | 🟡 MED | Architecture & Barrels | [`src/components/graph/`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/), [`page.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/graph/page.tsx#L2) | Missing `src/components/graph/index.ts` domain barrel; `page.tsx` uses deep import path. |
| **GH-04** | 🟡 MED | Design Tokens & Icon Policy | [`graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L392) | Literal numeric `size={15}` passed to `DotMatrixIcon` instead of `ICON_GLYPH` token size. |
| **GH-05** | 🟡 MED | Performance & Spatial Index | [`graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L35-L61) | `hitTestNode` scans all graph nodes linearly ($O(N)$) on click instead of spatial indexing. |
| **GH-06** | 🟢 LOW | Styling & Tokens | [`graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L347) | Header uses inline `style={{ fontFamily: ... }}` string instead of Tailwind font token class. |
| **GH-07** | 🟢 LOW | Formatting Complexity | [`graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L63-L69) | Custom regex-based number formatting for HUD readout where fixed float precision suffices. |

---

## Detailed Findings & Analysis

### 🔴 High Severity

#### GH-01: Async Mount Lifecycle & Signal Pulse State Desync
- **File**: [`src/components/graph/graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L116-L117,L248-L298)
- **Category**: Lifecycle & Async Race Condition
- **Description**: In `GraphCanvas`, `pulsesOn` state (`useState(true)`) is captured in the effect closure when the async setup IIFE (`void (async () => { ... })()`) begins executing. During initialization, the code performs three sequential async operations: `await import("@/lib/graph/layout/layout-loop-d3")`, `await renderer.mount(canvasHost)`, and `await fetch("/api/graph")`. If the user clicks the "Signals" toggle button during this window, `handlePulseToggle` mutates `pulsesOn` state and calls `rendererRef.current?.setSignalPulsesEnabled(next)`. However, when the async setup completes, the initial closure scope continues using its stale local `pulsesOn` variable.
- **Impact**: Toggling the "Signals" button during page load or API latency causes visual state desynchronization between the UI button label ("Signals on/off") and the actual edge animation state rendered by Pixi.
- **Remediation**: Use a mutable ref (`pulsesOnRef`) to track the latest state across async boundaries, or re-evaluate `pulsesOn` state after `renderer.mount` completes before starting the paint loop.

#### GH-02: Per-Frame React Component Re-renders via RAF HUD State Updates
- **File**: [`src/components/graph/graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L89-L93,L126-L138,L185,L214)
- **Category**: Performance & React State Management
- **Description**: `GraphCanvas` manages camera coordinate HUD state via `const [hud, setHud] = useState<HudState>({ camX: 0, camY: 0, zoom: 1 })`. Every pointer move during a pan (`handlePointerMove`) and every wheel tick during a zoom (`handleWheel`) invokes `queueHudUpdate()`, which triggers `setHud` via `requestAnimationFrame`.
- **Impact**: Calling `setHud` forces React to re-render the entire `GraphCanvas` component at up to 120Hz during user pan/zoom interactions. Re-rendering the parent component triggers virtual DOM diffing across the container `div`, canvas wrapper, `<NodeDetailDialog>`, and `<header>` controls on every single frame. This introduces main-thread micro-jank that competes with Pixi's WebGL draw loop.
- **Remediation**: Decouple the HUD readout from parent React state. Either extract `<GraphHud>` into a isolated memoized component that subscribes to camera updates, or update the HUD readout element directly via DOM `ref` (`hudTextRef.current.textContent = ...`) during continuous pan/zoom.

---

### 🟡 Medium Severity

#### GH-03: Missing Domain Barrel Export (`index.ts`) for `@/components/graph`
- **File**: [`src/components/graph/`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/), [`src/app/graph/page.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/graph/page.tsx#L2)
- **Category**: Architecture & Barrel Rules
- **Description**: Unlike `@/components/chat`, `@/components/ui`, and `@/components/dotmatrix`, `src/components/graph` does not have a top-level `index.ts` barrel export file. Consequently, `src/app/graph/page.tsx` imports `GraphCanvas` via a deep relative file path (`@/components/graph/graph-canvas`).
- **Impact**: Violates domain barrel conventions ([`AGENTS.md`](file:///Users/apple/Development/Spy/spy-frontend/AGENTS.md) line 267 & [`code-preferences.md`](file:///Users/apple/Development/Spy/spy-frontend/.grok/rules/code-preferences.md) section 7), which require package and domain directories to expose clean public interfaces.
- **Remediation**: Create `src/components/graph/index.ts` re-exporting `GraphCanvas` and `NodeDetailDialog`, and update `src/app/graph/page.tsx` to import `{ GraphCanvas }` from `@/components/graph`.

#### GH-04: Hardcoded Numeric Icon Size Overriding Token Policy
- **File**: [`src/components/graph/graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L392)
- **Category**: Design Tokens & Icon Policy
- **Description**: In `GraphCanvas`, `<DotMatrixIcon name="bulb" size={15} ... />` passes a raw literal integer `15` as the icon size.
- **Impact**: Bypasses design token standardization ([`.grok/rules/code-preferences.md`](file:///Users/apple/Development/Spy/spy-frontend/.grok/rules/code-preferences.md) section 28), making global scale or icon token maintenance inconsistent across components.
- **Remediation**: Replace `size={15}` with tokenized icon size constants from `@/lib/icon-tokens` or `@/components/dotmatrix` (e.g., `ICON_GLYPH.sm` or `ICON_GLYPH.toolbar`).

#### GH-05: Un-indexed Linear Hit-Testing on Node Selection Click
- **File**: [`src/components/graph/graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L35-L61)
- **Category**: Performance & Spatial Index Usage
- **Description**: `hitTestNode()` loops through every node in `graph.nodes` (`for (const node of graph.nodes)`) on pointer release to determine if a node was clicked.
- **Impact**: Performs an un-indexed $O(N)$ distance check over the entire node array. As graph density grows, un-indexed array scans on pointer events degrade responsiveness, bypassing pre-existing spatial index structures (`GraphSpatialIndex`) available in `@/lib/graph`.
- **Remediation**: Utilize spatial bounding box checks or query `GraphSpatialIndex` to quickly prune candidate nodes before performing distance calculations.

---

### 🟢 Low Severity

#### GH-06: Inline Font-Family Style Attribute vs Tailwind Utility Class
- **File**: [`src/components/graph/graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L347)
- **Category**: Styling Consistency & Design Tokens
- **Description**: The `<header>` element uses an inline `style={{ fontFamily: "var(--font-vt323), ui-monospace, monospace" }}` prop rather than standard Tailwind font classes.
- **Impact**: Inconsistent with `NodeDetailDialog` which uses Tailwind font utility class `font-[family-name:var(--font-terminal)]`.
- **Remediation**: Replace inline `style` with Tailwind font utility class `font-[family-name:var(--font-vt323)]` or `font-mono`.

#### GH-07: Custom Exponential / Precision Number Formatter for Readout
- **File**: [`src/components/graph/graph-canvas.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/graph/graph-canvas.tsx#L63-L69)
- **Category**: Code Cleanliness
- **Description**: `formatHudNumber` implements custom string replacement (`n.toPrecision(12).replace(/\.?0+$/, "")`) to format camera coordinates.
- **Impact**: Adds unnecessary formatting logic for a secondary HUD readout where standard coordinate rounding (e.g. `toFixed(1)` or `Math.round`) is cleaner and sufficient.
- **Remediation**: Simplify `formatHudNumber` to use standard fixed-precision formatting.

---

## Domain Positive Compliance Verification

The audit verified clean compliance across key architecture mandates:

1. **Live-Only Pivot Compliance**: `src/app/graph/page.tsx` and `src/components/graph/graph-canvas.tsx` strictly follow [`plans/graph-live-only-pivot.md`](file:///Users/apple/Development/Spy/spy-frontend/plans/graph-live-only-pivot.md). The canvas always queries `/api/graph`, uses `placeTopology` for fingerprint pose caching / single-shot settlement, and defaults to a clean blank canvas when no topology is returned. Zero URL flag parsing (`?stress`, `?source`, `?layout`, `?motion`, `?mock`).
2. **Zero Mock & FA2 Remnants**: No ForceAtlas2, graphology, or mock fixture imports exist within the graph host domain.
3. **Quality Bans Respect**: Host respects all client quality bans. The camera is managed in world-space via `RtcCamera` (never modifying `stage.scale`), continuous ambient motion is disabled by default, and signal pulses default to enabled.
4. **Strict TypeScript Compliance**: Zero `any` types detected in `src/components/graph` and `src/app/graph`.
