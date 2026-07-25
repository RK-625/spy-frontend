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

/**
 * PART_OF hierarchy edges — cool muted blue-gray (readable type at rest).
 * Slight cool shift so hierarchy shafts differ from RELATES without loud color.
 */
export const GRAPH_EDGE_PART_OF = 0x4e5a72;
export const GRAPH_EDGE_PART_OF_ALPHA = 0.58;

/**
 * RELATES_TO associative edges — warm muted purple-gray (readable type at rest).
 * Quieter than PART_OF; distinct family from cool hierarchy shafts.
 */
export const GRAPH_EDGE_RELATES = 0x6a5870;
export const GRAPH_EDGE_RELATES_ALPHA = 0.44;

// ---------------------------------------------------------------------------
// Edge signal wave (brightness through DotStream — ambient, not dashboard)
// ---------------------------------------------------------------------------

/**
 * PART_OF hierarchy wave peak — electric sky blue (aqua–blue family, cooler than mint cyan).
 * Slightly bluer than pure aqua so it reads cleaner on purple-gray streams + lavender nodes.
 * Signal layer only; base GRAPH_EDGE_PART_OF stays muted utility gray.
 */
export const GRAPH_PULSE_PART_OF = 0x5ec8ff;
/** Strong mix so the packet pops off the muted shaft. */
export const GRAPH_PULSE_PART_OF_COLOR_MIX = 0.9;
export const GRAPH_PULSE_PART_OF_ALPHA_LIFT = 0.4;

/**
 * RELATES_TO associative wave peak — electric orchid / magenta neon.
 * Cool product-adjacent pop, far from yellow/teal; clearly ≠ PART_OF sky blue.
 * Signal layer only; base RELATES shaft stays gray.
 */
export const GRAPH_PULSE_RELATES = 0xf0abfc;
export const GRAPH_PULSE_RELATES_COLOR_MIX = 0.86;
export const GRAPH_PULSE_RELATES_ALPHA_LIFT = 0.36;

/**
 * Classic arrow ▶ + rocket trail. Packet size is **world/screen coherent**,
 * not a fixed % of edge length (avoids long-edge stretch).
 */
/** Target packet head length in screen pixels (converted via camera zoom). */
export const GRAPH_PULSE_PACKET_SCREEN_PX = 48;
/** World-unit clamps for packet head length after zoom conversion. */
export const GRAPH_PULSE_PACKET_WORLD_MIN = 10;
export const GRAPH_PULSE_PACKET_WORLD_MAX = 36;
/** t-space clamps so short edges still show a packet and long edges never sprawl. */
export const GRAPH_PULSE_BAND_T_MIN = 0.04;
export const GRAPH_PULSE_BAND_T_MAX = 0.14;
/** RELATES packet scale vs PART_OF (slightly shorter). */
export const GRAPH_PULSE_PACKET_SCALE_RELATES = 0.82;

/** Min half-width at arrow tip (|u| domain, 0–1). */
export const GRAPH_PULSE_ARROW_TIP_MIN = 0.1;
/** Head length as fraction of bandT. */
export const GRAPH_PULSE_ARROW_UNIT = 0.82;
export const GRAPH_PULSE_ARROW_SOFTNESS = 0.28;
/** Trail length as fraction of head unitLen. */
export const GRAPH_PULSE_TRAIL_UNIT = 0.75;
/** Trail strength vs head — slightly stronger on long edges is handled in code. */
export const GRAPH_PULSE_TRAIL_STRENGTH = 0.4;
export const GRAPH_PULSE_TRAIL_WIDTH_SCALE = 1.18;
export const GRAPH_PULSE_FLARE_WIDEN = 1.55;
/**
 * Geometric flare: world reach ≈ nodeR * mult + pad (not fixed 22% of edge).
 * Converted to t via / edgeLength and clamped.
 */
export const GRAPH_PULSE_FLARE_NODE_FRAC = 0.55;
export const GRAPH_PULSE_FLARE_WORLD_PAD = 10;
export const GRAPH_PULSE_FLARE_T_MIN = 0.03;
export const GRAPH_PULSE_FLARE_T_MAX = 0.16;

/** PART_OF second soft beat (multi-packet) — phase lag in [0,1) and strength scale. */
export const GRAPH_PULSE_SECOND_PHASE = 0.42;
export const GRAPH_PULSE_SECOND_STRENGTH = 0.48;

export const GRAPH_PULSE_STRENGTH_STEPS = 4;

/** World units / second — uniform visual pace. */
export const GRAPH_PULSE_WORLD_SPEED = 15.47;
export const GRAPH_PULSE_DURATION_MIN_S = 4.8;
export const GRAPH_PULSE_DURATION_MAX_S = 12.09;
export const GRAPH_PULSE_DURATION_JITTER = 0.08;
export const GRAPH_PULSE_SPEED_PART_OF = 1.08;
export const GRAPH_PULSE_SPEED_RELATES = 0.92;

/** Signal color re-upload throttle (ms) — camera transform still every frame. */
export const GRAPH_PULSE_UPLOAD_INTERVAL_MS = 33;
