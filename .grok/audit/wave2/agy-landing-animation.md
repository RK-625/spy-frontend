# Codebase Audit: Landing & Animation Domain (`app/page.tsx`, `app/layout.tsx`, `src/components/landing/**`, `src/animation/**`)

**Target Domain**: Landing Page (`app/page.tsx`), Root Layout (`app/layout.tsx`), Landing Components (`src/components/landing/`), Mascot & GSAP Animations (`src/animation/`)  
**Date**: August 8, 2026  
**Auditor**: AGY Leaf Agent  
**Scope**: Read-only Architectural & Code Preferences Audit (Dead Code, Palette Compliance, `any` / TypeScript Strictness, Dual Paths, Landing Shader Preservation)

---

## Executive Summary

An exhaustive audit of the **Landing & Animation** domain was conducted against the project design constitution ([`AGENTS.md`](file:///Users/apple/Development/Spy/spy-frontend/AGENTS.md)), project design brief, and code preference rules ([`.grok/rules/code-preferences.md`](file:///Users/apple/Development/Spy/spy-frontend/.grok/rules/code-preferences.md)).

While the landing page (`app/page.tsx`) features a working 3D sphere backdrop (`@shadergradient/react`) and text scramble hero section, the audit revealed major architectural drift, large orphaned codebases, design token violations, and redundant dependencies:

1. **🔴 High Severity Dead Code**: The entire `SpiderMascot` component and its underlying GSAP animation engine ([`src/animation/spider/mascot.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider/mascot.ts#L1-L857) and [`src/animation/spider/behaviors.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider/behaviors.ts#L1-L333)) totaling **~1,250 lines of complex code** are completely unwired and unimported anywhere in the application.
2. **🔴 Palette Constitution Violation**: `SpiderMascot` includes an embedded solid `#ffffff` white rectangular canvas (`300px x 300px`) behind the spider, directly violating [`AGENTS.md`](file:///Users/apple/Development/Spy/spy-frontend/AGENTS.md) design principles prohibiting pure white canvas/text backgrounds in Spy's dark utility register.
3. **🔴 Dual Animation Engines**: `ShinyText` imports `motion/react` (Framer Motion v12) for a basic background-position text sweep, while GSAP (`gsap`, `@gsap/react`) is used as the primary mascot animation framework, adding ~40KB+ of unnecessary dual-library bundle bloat.
4. **🟡 Redundant Resource Loading**: `RootLayout` ([`src/app/layout.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/layout.tsx#L14-L15)) initializes two separate Google Font loaders (`inter` and `interBody`) for the identical `Inter` font family under different CSS variable names.
5. **Shader Preservation**: The landing shader (`ShaderGradient`) in [`src/app/page.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/page.tsx#L29-L67) is preserved and fully functional, though its color inputs use hardcoded hex strings instead of referencing theme tokens.

---

## Audit Findings Matrix

| ID | Severity | Category | File | Description |
|---|---|---|---|---|
| **LA-01** | 🔴 HIGH | Dead Code / Unwired Package | [`spider-mascot.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider-mascot.tsx#L1-L73), [`mascot.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider/mascot.ts#L1-L857), [`behaviors.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider/behaviors.ts#L1-L333) | ~1,250 LOC mascot component & GSAP animation engine are completely unwired and unimported in the app. |
| **LA-02** | 🔴 HIGH | Palette Violation | [`spider-mascot.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider-mascot.tsx#L44-L50) | Renders a solid `#ffffff` white canvas behind mascot, violating dark utility register policy. |
| **LA-03** | 🔴 HIGH | Dual Paths / Bundle Bloat | [`shiny-text.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/shiny-text.tsx#L2) | Uses `motion/react` (Framer Motion) alongside `gsap`, creating dual animation library bloat. |
| **LA-04** | 🟡 MED | Dual Paths / Resource Loading | [`layout.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/layout.tsx#L14-L15) | Duplicate Google Font loading for `Inter` (`inter` and `interBody` loaded separately). |
| **LA-05** | 🟡 MED | Dead Code / Unused Ref | [`hero-section.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/hero-section.tsx#L53-L56) | `replayMainRef` declared and written in `useEffect` but never read or invoked. |
| **LA-06** | 🟡 MED | Dead Interface Prop | [`shiny-text.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/shiny-text.tsx#L10) | `color?: string` prop defined in `ShinyTextProps` interface but unused in component. |
| **LA-07** | 🟡 MED | Palette / Tokenization Drift | [`hero-section.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/hero-section.tsx#L104,L117), [`shiny-text.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/shiny-text.tsx#L107), [`page.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/page.tsx#L26) | Hardcoded hex strings (`#ded4f0`, `#060610`, `#e8dff8`) bypass CSS design tokens. |
| **LA-08** | 🟡 MED | Shader Palette Tokenization | [`page.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/page.tsx#L44-L46) | `ShaderGradient` props (`#4A1280`, `#8838DE`, `#DDB8F8`) hardcode colors instead of referencing theme tokens. |
| **LA-09** | 🟡 MED | Anti-Pattern / Async Timers | [`hero-section.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/hero-section.tsx#L23-L37) | 4 nested `setTimeout` calls choreograph scramble phases using arbitrary millisecond delays. |
| **LA-10** | 🟢 LOW | Dual Paths / Selector Fallbacks | [`mascot.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider/mascot.ts#L18-L22,L52-L61) | 5 fallback DOM selectors for SVG master group and 3 id variants for leg mirrors. |
| **LA-11** | 🟢 LOW | Content / Naming Drift | [`hero-section.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/hero-section.tsx#L10,L74) | Phase string uses `"SPYDER"` and comment uses `"SYPDER"` vs product name `Spy`. |
| **LA-12** | 🟢 LOW | Code Structure / Micro-File | [`shiny-text.css`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/shiny-text.css#L1-L4) | 3-line CSS file for `.shiny-text { display: inline-block; }` can be replaced with Tailwind `inline-block`. |

---

## Detailed Findings & Analysis

### 🔴 High Severity

#### LA-01: Orphaned & Dead Mascot Animation Package (~1,250 LOC)
- **Files**:
  - [`src/animation/spider-mascot.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider-mascot.tsx#L1-L73)
  - [`src/animation/spider/mascot.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider/mascot.ts#L1-L857)
  - [`src/animation/spider/behaviors.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider/behaviors.ts#L1-L333)
- **Category**: Dead Code / Unwired Feature Package
- **Description**: The 3D glossy robot spider mascot is described in [`AGENTS.md`](file:///Users/apple/Development/Spy/spy-frontend/AGENTS.md) as *"the emotional anchor of the entire page... sits center stage."* However, `SpiderMascot` (`spider-mascot.tsx`) and its complex GSAP animation engine (`mascot.ts` + `behaviors.ts`) are **completely unimported** in [`app/page.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/page.tsx#L1-L76), [`hero-section.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/hero-section.tsx#L1-L123), or anywhere else in `src/`.
- **Impact**: ~1,250 lines of sophisticated GSAP animation logic (hop sequence, eye blip dissolve, SVG visor ticker, leg toe taps, curiosity lean) sit idle as dead code. The landing page renders text scramble only, omitting the primary mascot character entirely.
- **Remediation**: Either wire `SpiderMascot` into `HeroSection` / `app/page.tsx` as intended by the design specification, or archive/clean up unused animation files if landing mascot rendering was intentionally deferred.

#### LA-02: Hardcoded White Canvas Palette Violation Behind Mascot
- **File**: [`src/animation/spider-mascot.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider-mascot.tsx#L44-L50)
- **Category**: Palette & Design Constitution Violation
- **Description**: `SpiderMascot` contains an inline `div` rendering a solid white canvas:
  ```tsx
  {/* White canvas behind the mascot (sharp edges; component-local only). */}
  <div
    className="absolute inset-0"
    style={{ background: "#ffffff", pointerEvents: "none" }}
  />
  ```
- **Impact**: Directly violates `AGENTS.md` Design Principle #2 (*"Dark utility register (Background UI)... Text/canvas is never pure white... sharp-edged, dark page over default dark mode"*). If `SpiderMascot` is mounted on the landing page, it displays a bright 300x300px white box over the dark 3D shader backdrop.
- **Remediation**: Remove the white background `div` completely or replace it with a transparent/dark utility background (`var(--background)` or `var(--surface-elevated)`).

#### LA-03: Dual Animation Framework Overhead (`motion/react` vs `gsap`)
- **Files**: [`src/components/landing/shiny-text.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/shiny-text.tsx#L2), [`package.json`](file:///Users/apple/Development/Spy/spy-frontend/package.json#L56-L58)
- **Category**: Dual Paths / Dependency Bloat
- **Description**: `ShinyText` imports `motion/react` (Framer Motion v12) to drive a basic background-position linear gradient sweep (`useAnimationFrame`, `useMotionValue`, `useTransform`, `motion.span`). Meanwhile, GSAP (`gsap`, `@gsap/react`) is configured as the main animation system across the codebase.
- **Impact**: Bundles two heavy, overlapping animation libraries (`motion` ~40KB+ and `gsap` ~70KB+), violating [.grok/rules/code-preferences.md](file:///Users/apple/Development/Spy/spy-frontend/.grok/rules/code-preferences.md) guidelines against un-engineered duplicate abstractions.
- **Remediation**: Refactor `ShinyText` to use native CSS `@keyframes` (similar to `.glossy-text` glint in `globals.css`) or standard GSAP tweens, eliminating the `motion/react` dependency on the landing path.

---

### 🟡 Medium Severity

#### LA-04: Duplicate Google Font Loading for `Inter`
- **File**: [`src/app/layout.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/layout.tsx#L14-L15)
- **Category**: Dual Paths / Resource Loading
- **Description**: `layout.tsx` instantiates the `Inter` font loader twice:
  ```tsx
  const inter = Inter({subsets:['latin'],variable:'--font-sans'});
  const interBody = Inter({subsets:['latin'],variable:'--font-body'});
  ```
- **Impact**: Causes Next.js to fetch and generate two separate font files/CSS declarations for the exact same `Inter` font family.
- **Remediation**: Remove `interBody` and map both `--font-sans` and `--font-body` to `inter.variable` or standardize on a single font loader instance.

#### LA-05: Unused Ref Dead Code in `HeroSection`
- **File**: [`src/components/landing/hero-section.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/hero-section.tsx#L53-L56)
- **Category**: Dead Code / Unused React Ref
- **Description**: `replayMainRef` is declared via `useRef`, updated in `useEffect`, but never referenced or invoked anywhere else in `HeroSection`:
  ```tsx
  const replayMainRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    replayMainRef.current = replay;
  }, [replay]);
  ```
- **Impact**: Dead ref allocation left over from previous scramble iterations.
- **Remediation**: Delete `replayMainRef` and its associated `useEffect`.

#### LA-06: Unused Prop Definition in `ShinyTextProps`
- **File**: [`src/components/landing/shiny-text.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/shiny-text.tsx#L10)
- **Category**: Dead Code / Interface Drift
- **Description**: `color?: string` is defined in `ShinyTextProps` interface, but omitted from component destructuring and unused in component rendering logic.
- **Impact**: Unused property creates a misleading interface contract for `ShinyText`.
- **Remediation**: Remove `color?: string` from `ShinyTextProps`.

#### LA-07: Hardcoded Palette Hex Colors Across Landing Components
- **Files**:
  - [`src/components/landing/hero-section.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/hero-section.tsx#L104,L117) (`text-[#ded4f0]`, `rgba(6,6,16,0.9)`, `rgba(222,212,240,0.15)`)
  - [`src/components/landing/shiny-text.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/shiny-text.tsx#L25,L107) (`#ffffff`, `#e8dff8`, `#d0b8f5`, `#b992f0`, `#9a6ae0`)
  - [`src/app/page.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/page.tsx#L26) (`bg-[#060610]`)
- **Category**: Palette & Tokenization Drift
- **Description**: Multiple components in the landing domain hardcode literal hex strings and raw RGBA values rather than using Spy's design tokens (`var(--color-text-primary)`, `var(--background)`, `var(--lavender)`).
- **Impact**: Violates design token policies in `AGENTS.md` and `.grok/rules/code-preferences.md`.
- **Remediation**: Replace raw hex values with CSS utility classes (`text-text-primary`, `bg-background`) or CSS variables (`var(--color-accent)`).

#### LA-08: Landing Shader Color Tokenization (Preserved Shader)
- **File**: [`src/app/page.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/page.tsx#L44-L46)
- **Category**: Landing Shader Preservation & Token Alignment
- **Description**: Per audit instructions, the landing shader backdrop (`ShaderGradient`) is preserved as the front-door background. However, its color props (`color1="#4A1280"`, `color2="#8838DE"`, `color3="#DDB8F8"`) are hardcoded string literals in JSX rather than referencing the CSS variable tokens (`--shader-color-1`, `--shader-color-2`, `--shader-color-3`) defined in `globals.css` (lines 189-191).
- **Impact**: Disconnects shader color configuration from global CSS token definitions.
- **Remediation**: Maintain the shader while binding color props to token constants or CSS variable reads.

#### LA-09: Nested `setTimeout` Choreography Anti-Pattern
- **File**: [`src/components/landing/hero-section.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/hero-section.tsx#L23-L37,L86)
- **Category**: Anti-Pattern / Async State Scheduling
- **Description**: `HeroSection` uses 4 nested `setTimeout` calls (1000ms, 1000ms, 50ms, 200ms) to coordinate phase 1 -> phase 2 -> phase 3 text scramble transitions.
- **Impact**: Relies on non-deterministic timer scheduling that can cause state desynchronization or memory leaks if the component unmounts mid-scramble.
- **Remediation**: Refactor phase progression to use `onAnimationEnd` callbacks or a deterministic state machine.

---

### 🟢 Low Severity

#### LA-10: Dual Leg & SVG Selector Fallbacks in GSAP Mascot Engine
- **File**: [`src/animation/spider/mascot.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/animation/spider/mascot.ts#L18-L22,L52-L61)
- **Category**: Dual Paths / Defensive Fallback Overkill
- **Description**: `initSpiderMascotAnimation` queries DOM using 5 alternative selector strings for the master SVG group (`#Spider`, `#Mascot`, `#Robot spider`, `#Group 1`, `svg > g`) and 3 alternative leg ID formats (`[id="Left 1st leg mirror_2"]`, etc.).
- **Impact**: Indicates past un-standardized SVG asset exports, adding DOM selector resolution overhead.
- **Remediation**: Standardize `mascot-3d.svg` internal layer IDs and simplify DOM query selectors.

#### LA-11: Content / Naming Drift ("SPYDER" vs "Spy" / "Spider")
- **File**: [`src/components/landing/hero-section.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/hero-section.tsx#L10,L74)
- **Category**: Content / Naming Inconsistency
- **Description**: `PHASE_3_B = "SPYDER";` and comment `// "SYPDER" scramble...`.
- **Impact**: Inconsistent spelling and branding against the canonical product name `Spy` and character `Spider`.
- **Remediation**: Align text constants with product branding (`SPY` or `SPIDER`).

#### LA-12: Redundant Micro-CSS File (`shiny-text.css`)
- **File**: [`src/components/landing/shiny-text.css`](file:///Users/apple/Development/Spy/spy-frontend/src/components/landing/shiny-text.css#L1-L4)
- **Category**: Code Structure / Micro-Files
- **Description**: `shiny-text.css` contains only 3 lines of CSS (`.shiny-text { display: inline-block; }`).
- **Impact**: Adds file import overhead for a single utility rule easily handled via Tailwind `inline-block`.
- **Remediation**: Delete `shiny-text.css` and apply `inline-block` directly in `shiny-text.tsx`.

---

## TypeScript Strictness & `any` Audit

- **`any` Usage**: `0` occurrences of the `any` keyword were found across all domain files (`app/page.tsx`, `app/layout.tsx`, `src/components/landing/**`, `src/animation/**`).
- **Type Assertions**: Type casting is limited to valid DOM element assertions (`as SVGGElement | null`, `as SVGSVGElement | null`, `as SVGPathElement[]` in `mascot.ts`).
- **Type Safety Rating**: High compliance with TypeScript strictness rules, with opportunities to type callback utility parameters in `mascot.ts` (`legRotate`).

---

## Proposed Remediation Roadmap

1. **Phase 1 (High Priority - Architecture & Dead Code)**:
   - Decide whether to mount `SpiderMascot` on the landing page or formally archive `src/animation/spider-mascot.tsx`, `mascot.ts`, and `behaviors.ts` to eliminate ~1,250 LOC of dead code.
   - Remove the solid `#ffffff` white canvas `div` from `spider-mascot.tsx`.
   - Replace `motion/react` in `ShinyText` with pure CSS `@keyframes` or GSAP, removing Framer Motion from the landing bundle.

2. **Phase 2 (Medium Priority - Palette & Resource Optimization)**:
   - Eliminate duplicate `Inter` font loading in `app/layout.tsx` by using a single font instance.
   - Replace hardcoded hex strings (`#ded4f0`, `#060610`, `#e8dff8`) across `HeroSection`, `ShinyText`, and `page.tsx` with design tokens (`text-text-primary`, `bg-background`, `var(--color-accent)`).
   - Bind `ShaderGradient` color props in `app/page.tsx` to CSS variable tokens while keeping the shader intact.

3. **Phase 3 (Low Priority - Cleanup & Refactoring)**:
   - Remove unused `replayMainRef` from `HeroSection` and `color` prop from `ShinyTextProps`.
   - Refactor scramble phase `setTimeout` chains in `HeroSection` to deterministic callback-driven transitions.
   - Delete `shiny-text.css` and inline the class into `shiny-text.tsx`.
