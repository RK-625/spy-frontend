/**
 * Graph canvas palette (Pixi hex colors + alphas only).
 *
 * Mirrors the product lavender / utility-register system from brief + globals.css.
 * No gold/amber. Scale tokens and formulas live in graph-scale.ts.
 */

/** Deepest register background. */
export const GRAPH_BG = 0x0a0a0c;

/** Node fill — lavender accent (`#c8acfb`). */
export const GRAPH_NODE_FILL = 0xc8acfb;
export const GRAPH_NODE_FILL_ALPHA = 0.92;

/** Thin ring for chat-border kinship (same hue, low alpha). */
export const GRAPH_NODE_RING = 0xc8acfb;
export const GRAPH_NODE_RING_ALPHA = 0.3;

/** PART_OF hierarchy edges — muted purple-gray. */
export const GRAPH_EDGE_PART_OF = 0x5a5470;
export const GRAPH_EDGE_PART_OF_ALPHA = 0.55;

/** RELATES_TO associative edges — secondary dim gray. */
export const GRAPH_EDGE_RELATES = 0x7a7685;
export const GRAPH_EDGE_RELATES_ALPHA = 0.42;
