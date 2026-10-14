/**
 * Brand / product mark barrel — import from `@/components/logos`.
 *
 * File modules keep local names (`Openai`); the barrel renames to the
 * product-facing `OpenAI`. Prefer this barrel over deep paths.
 * Single-color marks (OpenAI, Anthropic) use currentColor so they follow the theme.
 */
export { Deepseek } from "./deepseek";
export { Exa } from "./exa";
export { Excalidraw } from "./excalidraw";
export { Meta } from "./meta";
export { Openai as OpenAI } from "./openai";
export { Anthropic } from "./anthropic";
export { Google } from "./google";
