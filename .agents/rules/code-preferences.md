---
description: "Code preferences and engineering balance guidelines"
alwaysApply: true
---

# Preferences

## Code Structure
  - Code needs to be structured, following simple modular components, separated in sections, maintainable and sorted in dependency order(bottom-up) following the isloation principle ensuring that every feature, module, or component is entirely self-contained, predictable, and decoupled. By treating each directory as an independent micro-system with a strict public interface, we prevent tangled dependencies, eliminate 'spaghetti code,' and make the codebase instantly navigable for any developer.
  - Naming convention for the functions, variables , components, folders , files should be clear, strict, symmetrical, simple, clear, and distinct and reflect it function or purpose. The names should be functional and descriptive, avoiding generic names like `isOpen` or `toggle`.
  - Every module, domain directory, or nested subdirectory at ANY level of the project hierarchy MUST be physically organized following the isolation principle — acting as a self-contained, decoupled micro-system with a flat or shallow directory structure appropriate to the functionality of its files, maintaining strict topological dependency order.
  - Any module or domain directory containing 5 or more files (e.g., `src/lib/graph/`, `src/components/chat/`) MUST be physically organized into subdirectories by responsibility (e.g., `cache/`, `renderer/`, `camera/`, `physics/`), while maintaining a top-level `index.ts` barrel export for clean `@/` domain imports. Every directory must follow the isolation principle by acting as a self-contained micro-system with a strict public interface.
  - never use "any" type in Typescript
  - As the codebase grows, you have figure to balance between over-engineering and under-engineering.Instead weight out the benefits and trade-offs of each approach and choose the one that best fits the current and future needs of the codebase.(Use orchesteation here for opinions from other agents).These are some examples of what i meant. In case of confusion and dilemma **orchestrate** use third-agents seek thier advice on the issue.
    - **State Management**
      - **Under-Engineering**: Managing shared state with only useState + prop drilling across many components or deep levels in the component tree.
      - **Over-Engineering**: Introducing React Context + custom hooks + reducer for 1–2 simple pieces of local state that are only passed down 1–2 levels to a few closely related child components.
      - **Recommended**: Use React Context (or a lightweight store like Zustand/Jotai) when you have multiple pieces of state (typically 3–5+) that are shared across several components, especially when they need to be accessed at deeper levels in the component tree or have non-trivial read/write patterns and derived state.
    - **Error Handling & Guards**
      - **Under-Engineering**: No guards or fallbacks even when dealing with external data, user input, or third-party APIs.(Non-deterministic cases)
      - **Over-Engineering**: Adding defensive if checks and error handling for scenarios that are structurally not likely given the current data flow and architecture.Avoid false positives or negatives.
      - **Recommended**: Add explicit checks, error boundaries, or fallback UI only where the outcome is non-deterministic or depends on external factors.
    - **Abstractions & Reusability**
      - **Under-Engineering**: Duplicating the same logic or pattern in multiple places.
      - **Over-Engineering**: Extracting a reusable component, hook, or utility for something that is used in only one place and is unlikely to be reused soon.
      - **Recommended**: Extract a clean, reusable abstraction when the same logic/pattern appears in multiple places or when there is clear upcoming reuse.
    - **Types & Interfaces**
      - **Under-Engineering**: Using any or very loose types for complex data structures.
      - **Over-Engineering**: Creating deeply nested generic types or complex utility types for simple objects used in only one or two files.
      - **Recommended**: Invest in strong, well-named interfaces and types when they meaningfully improve readability, prevent bugs, or are shared across modules.

## UI Components
  - When it comes to CSS/UI styles/design patterns or components like fonts(color,size etx), color palette, hower effects, timings(delays, durations etc), contrast, spacing, sizing, transitions, animations, motion, placement, box styling, shadows, icons, loader components, effects like(fade, slide, ease etc), gradients, etc the list goes on and on. Don't invent new styles on the fly for each new component or ui element. Follow the existing design, styles and CSS and reuse them. If the change or addition of ui element or component requires truly a CSS/UI styles/design patterns for a better look and feel, and needs to different and distinct from the existing ones, then you can create a new one(CSS/UI styles/design patterns) instead of reusing the existing one.Incase of the conflict or dilemma between reusing or creating a new one ask for user's preference using the native ask Question tool.
  - I prefer the CSS/UI styles/design patterns to be tokenized as design tokens and stored in a centralized location(which needs to be organised and maintained) which help us make the CSS/UI styles/design patterns consistent and reusable across the codebase.
