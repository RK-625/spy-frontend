/**
 * Graph canvas visual tokens (Pixi hex colors).
 *
 * Mirror the product lavender / utility-register system from brief + globals.css:
 * lavender-white text, muted purple edges, soft node fill — no gold/amber.
 * Keep numbers here; CSS remains the chat UI source of truth.
 */

/** Deepest register background. */
export const GRAPH_BG = 0x0a0a0c;

/** Node fill — lavender accent (`#c8acfb`). */
export const GRAPH_NODE_FILL = 0xc8acfb;
export const GRAPH_NODE_FILL_ALPHA = 0.92;

/** Thin ring for chat-border kinship (same hue, low alpha). */
export const GRAPH_NODE_RING = 0xc8acfb;
export const GRAPH_NODE_RING_ALPHA = 0.3;
export const GRAPH_NODE_RING_WIDTH = 1;

/** PART_OF hierarchy edges — muted purple-gray. */
export const GRAPH_EDGE_PART_OF = 0x5a5470;
export const GRAPH_EDGE_PART_OF_ALPHA = 0.55;

/** RELATES_TO associative edges — secondary dim gray. */
export const GRAPH_EDGE_RELATES = 0x7a7685;
export const GRAPH_EDGE_RELATES_ALPHA = 0.42;
/** RELATES_TO is thinner than PART_OF at the same zoom. */
export const GRAPH_EDGE_RELATES_WIDTH_SCALE = 0.75;

/**
 * Base pitch (screen px) between dots on a RELATES_TO shaft.
 * Lightly scaled with stroke width at draw time.
 */
export const GRAPH_DOT_PITCH = 4.5;
