# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# workflow
- Design-first in Penpot before code. Check Penpot for component references and design specs before making visual changes. Confidence: 0.85
- Build and test animations in isolation before integrating into layout. Get the core animation right first, then wire it into page components. Confidence: 0.80
- Use audio notification (pop sound) to alert user when a task is complete, rather than visual system notifications. Confidence: 0.75

# gsap
- Prefer SVG `<rect>`-based character animation using GSAP tweens on individual SVG elements via refs, following the Claude mascot animation article pattern. Confidence: 0.85
- Use `svgOrigin` (SVG coordinate space) over `transformOrigin` for SVG element rotation pivots. Confidence: 0.75
- Use `gsap.utils.distribute()` for spreading values across multiple targets (e.g., leg rotations) rather than hardcoded index-based arrays. Confidence: 0.70
- Animate parent containers for unified movement; keep child animations as local offsets (rotation, scaleY) only. Avoid animating `y` independently on siblings to prevent visual detachment. Confidence: 0.80

# communication
- Keep responses concise and direct. User prefers short answers and clear next-step proposals over long explanations. Confidence: 0.80
- When iterating on code, independently audit and fix all known issues before reporting back — don't present a list of issues and ask permission; fix them first, then confirm they're resolved. Confidence: 0.75
- Do not make confident claims about external tools' directory structures, config paths, or internals without verifying them first. If unsure, qualify statements or check before asserting. Confidence: 0.80
- When presenting reviews of completed work, include a numeric score/rating alongside findings organized by severity — user explicitly asks for scored assessments ("tell me your thoughts and score me"). Confidence: 0.60
- User tends to implement large migrations/refactors personally, then return for review and verification rather than delegating implementation — offer to review/verify/smoke-test their work instead of taking over coding. Confidence: 0.60

# code-style
- When disabling functionality, comment out code rather than deleting it. User wants to preserve the original code for reference and potential restoration. Confidence: 0.90

# component-layering
- For noise-field-bg component: Layer order is NoiseTexture (bottom) → NoiseField (middle) → Text (top). Confidence: 0.65

# shader-animation
- In the pre-pulse dark state (state 1, before ring animation), noise/grain should be static with no time-based motion — the shader should not use time as input for the grain in the dark state zone. Confidence: 0.70

# component-sources
- Prefer 21st.dev MCP for UI components over Magic UI. Use mcp__magic__21st_magic_component_builder and related 21st.dev tools when fetching or building components. Confidence: 0.80

# branding
- Use "SYPDER" (not "SPIDER") as the product name in copy and UI text. Confidence: 0.65

# text-animation
- Use `use-scramble` for hero text animation effects (deliberate choice over plain text or alternatives). Confidence: 0.50
- Prefer slow, deliberate, organic weaving style for use-scramble animations — not fast/twitchy, but a gradual character resolution. Speed ~0.35 range preferred. Confidence: 0.80
- For hero text, chain multiple use-scramble phases with ~1s pauses between them — each phase scrambles a different phrase, transitioning from longer to shorter text for a "reducing noise to signal" effect. Confidence: 0.75
- For inline flex multi-word scrambles (e.g., "MEET THE SYPDER"), use CSS gap utilities (`gap-{n}`) for spacing between words, not trailing whitespace in text constants. Confidence: 0.65

# command-code
- Use Command Code's native hooks system (user-level ~/.commandcode/settings.json) for integrations and automation rather than shell wrapper workarounds. The hooks fire on PreToolUse, PostToolUse, and Stop events. Confidence: 0.70
- Agent skills are installed under `.commandcode/skills` (e.g., via `npx skills add`) — check for and use relevant installed skills (such as vendor-provided migration skills) when performing guided tasks like framework upgrades. Confidence: 0.65

ommand-code
- Use Command Code's native hooks system (user-level ~/.commandcode/settings.json) for integrations and automation rather than shell wrapper workarounds. The hooks fire on PreToolUse, PostToolUse, and Stop events. Confidence: 0.70

