/**
 * Pure helpers for continuous neural-style signal waves through DotStream edges.
 *
 * - Classic soft arrow (▶) + faint rocket trail on existing dots only
 * - Packet size: world/screen coherent (not % of edge → no long-edge stretch)
 * - Flare widen: geometric near-node zone (node radius + pad → t)
 * - Timing: constant world speed (uniform pace for all lengths)
 * - PART_OF: optional second soft beat (multi-packet)
 */

import type { GraphEdge, GraphLinkType, GraphNode } from "../core/graph-data";
import {
  GRAPH_PULSE_ARROW_SOFTNESS,
  GRAPH_PULSE_ARROW_TIP_MIN,
  GRAPH_PULSE_ARROW_UNIT,
  GRAPH_PULSE_BAND_T_MAX,
  GRAPH_PULSE_BAND_T_MIN,
  GRAPH_PULSE_DURATION_JITTER,
  GRAPH_PULSE_DURATION_MAX_S,
  GRAPH_PULSE_DURATION_MIN_S,
  GRAPH_PULSE_FLARE_NODE_FRAC,
  GRAPH_PULSE_FLARE_T_MAX,
  GRAPH_PULSE_FLARE_T_MIN,
  GRAPH_PULSE_FLARE_WIDEN,
  GRAPH_PULSE_FLARE_WORLD_PAD,
  GRAPH_PULSE_PACKET_SCALE_RELATES,
  GRAPH_PULSE_PACKET_SCREEN_PX,
  GRAPH_PULSE_PACKET_WORLD_MAX,
  GRAPH_PULSE_PACKET_WORLD_MIN,
  GRAPH_PULSE_PART_OF,
  GRAPH_PULSE_PART_OF_ALPHA_LIFT,
  GRAPH_PULSE_PART_OF_COLOR_MIX,
  GRAPH_PULSE_RELATES,
  GRAPH_PULSE_RELATES_ALPHA_LIFT,
  GRAPH_PULSE_RELATES_COLOR_MIX,
  GRAPH_PULSE_SECOND_PHASE,
  GRAPH_PULSE_SECOND_STRENGTH,
  GRAPH_PULSE_SPEED_PART_OF,
  GRAPH_PULSE_SPEED_RELATES,
  GRAPH_PULSE_STRENGTH_STEPS,
  GRAPH_PULSE_TRAIL_STRENGTH,
  GRAPH_PULSE_TRAIL_UNIT,
  GRAPH_PULSE_TRAIL_WIDTH_SCALE,
  GRAPH_PULSE_WORLD_SPEED,
} from "../core/graph-style";
import { nodeScreenRadius } from "../core/graph-scale";

/** Wave shading style for a link type. */
export type SignalWaveStyle = {
  peakColor: number;
  colorMix: number;
  alphaLift: number;
  /** Multiplier on world packet length (RELATES shorter). */
  packetScale: number;
  speedScale: number;
  /** Second soft beat for hierarchy only. */
  multiPacket: boolean;
};

/** Per-edge geometric context for world-sized packets + flare. */
export type WaveGeomContext = {
  worldLength: number;
  /** Camera zoom (graphContent scale) for screen-coherent packet size. */
  zoom: number;
  /** Node radius at travel start (t=0), world units at bake z=1. */
  fromRadius: number;
  /** Node radius at travel end (t=1). */
  toRadius: number;
};

/**
 * Stable 32-bit hash of a string (FNV-1a).
 */
export function hashEdgeId(edgeId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < edgeId.length; i += 1) {
    h ^= edgeId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pulsePhaseOffset(edgeId: string): number {
  return (hashEdgeId(edgeId) % 10_000) / 10_000;
}

/**
 * Travel duration at **constant world speed** (uniform visual pace).
 */
export function pulseDurationSeconds(
  edgeId: string,
  worldLength: number,
  speedScale = 1
): number {
  const speed =
    GRAPH_PULSE_WORLD_SPEED * (Number.isFinite(speedScale) ? speedScale : 1);
  const len =
    Number.isFinite(worldLength) && worldLength > 1e-6 ? worldLength : 1;
  let duration = len / Math.max(1e-6, speed);

  if (duration < GRAPH_PULSE_DURATION_MIN_S) duration = GRAPH_PULSE_DURATION_MIN_S;
  else if (duration > GRAPH_PULSE_DURATION_MAX_S)
    duration = GRAPH_PULSE_DURATION_MAX_S;

  const j = ((hashEdgeId(edgeId) >>> 16) % 10_000) / 10_000;
  const jitter = 1 + (j * 2 - 1) * GRAPH_PULSE_DURATION_JITTER;
  duration *= jitter;

  if (duration < GRAPH_PULSE_DURATION_MIN_S * 0.9)
    duration = GRAPH_PULSE_DURATION_MIN_S * 0.9;
  else if (duration > GRAPH_PULSE_DURATION_MAX_S * 1.1)
    duration = GRAPH_PULSE_DURATION_MAX_S * 1.1;
  return duration;
}

export function pulseProgress(
  edgeId: string,
  timeSeconds: number,
  worldLength: number,
  speedScale = 1
): number {
  const duration = pulseDurationSeconds(edgeId, worldLength, speedScale);
  if (!(duration > 0) || !Number.isFinite(timeSeconds)) return 0;
  const raw = timeSeconds / duration + pulsePhaseOffset(edgeId);
  return raw - Math.floor(raw);
}

export function pulseEndpoints(
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode
): { fromX: number; fromY: number; toX: number; toY: number } {
  if (edge.type === "PART_OF") {
    return {
      fromX: target.x,
      fromY: target.y,
      toX: source.x,
      toY: source.y,
    };
  }
  return {
    fromX: source.x,
    fromY: source.y,
    toX: target.x,
    toY: target.y,
  };
}

export function pulseTravelLength(
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode
): number {
  const { fromX, fromY, toX, toY } = pulseEndpoints(edge, source, target);
  return Math.hypot(toX - fromX, toY - fromY);
}

/** Bake-z=1 node radii for travel endpoints (PART_OF: parent→child). */
export function pulseEndpointRadii(
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode
): { fromRadius: number; toRadius: number } {
  if (edge.type === "PART_OF") {
    return {
      fromRadius: nodeScreenRadius(target.rank, 1),
      toRadius: nodeScreenRadius(source.rank, 1),
    };
  }
  return {
    fromRadius: nodeScreenRadius(source.rank, 1),
    toRadius: nodeScreenRadius(target.rank, 1),
  };
}

export function waveStyleForType(type: GraphLinkType): SignalWaveStyle {
  if (type === "PART_OF") {
    return {
      peakColor: GRAPH_PULSE_PART_OF,
      colorMix: GRAPH_PULSE_PART_OF_COLOR_MIX,
      alphaLift: GRAPH_PULSE_PART_OF_ALPHA_LIFT,
      packetScale: 1,
      speedScale: GRAPH_PULSE_SPEED_PART_OF,
      multiPacket: true,
    };
  }
  return {
    peakColor: GRAPH_PULSE_RELATES,
    colorMix: GRAPH_PULSE_RELATES_COLOR_MIX,
    alphaLift: GRAPH_PULSE_RELATES_ALPHA_LIFT,
    packetScale: GRAPH_PULSE_PACKET_SCALE_RELATES,
    speedScale: GRAPH_PULSE_SPEED_RELATES,
    multiPacket: false,
  };
}

/**
 * World length of the arrow head packet — screen-coherent via zoom, clamped.
 * Long edges no longer get a huge %t packet.
 */
export function packetHeadWorldLength(
  zoom: number,
  packetScale: number
): number {
  const z = Number.isFinite(zoom) && zoom > 1e-4 ? zoom : 1;
  const fromScreen = GRAPH_PULSE_PACKET_SCREEN_PX / z;
  let w = fromScreen;
  if (w < GRAPH_PULSE_PACKET_WORLD_MIN) w = GRAPH_PULSE_PACKET_WORLD_MIN;
  else if (w > GRAPH_PULSE_PACKET_WORLD_MAX) w = GRAPH_PULSE_PACKET_WORLD_MAX;
  w *= Number.isFinite(packetScale) && packetScale > 0 ? packetScale : 1;
  return w;
}

/**
 * Convert world packet head length → band in t-space, clamped.
 */
export function packetBandT(
  worldLength: number,
  zoom: number,
  packetScale: number
): number {
  const len =
    Number.isFinite(worldLength) && worldLength > 1e-6 ? worldLength : 1;
  const headW = packetHeadWorldLength(zoom, packetScale);
  let t = headW / len;
  if (t < GRAPH_PULSE_BAND_T_MIN) t = GRAPH_PULSE_BAND_T_MIN;
  else if (t > GRAPH_PULSE_BAND_T_MAX) t = GRAPH_PULSE_BAND_T_MAX;
  return t;
}

/**
 * Geometric flare zone in t at one end: ~node flare reach / edge length.
 */
export function geometricFlareT(
  endRadius: number,
  worldLength: number
): number {
  const len =
    Number.isFinite(worldLength) && worldLength > 1e-6 ? worldLength : 1;
  const r = Number.isFinite(endRadius) && endRadius > 0 ? endRadius : 8;
  const world =
    r * GRAPH_PULSE_FLARE_NODE_FRAC + GRAPH_PULSE_FLARE_WORLD_PAD;
  let t = world / len;
  if (t < GRAPH_PULSE_FLARE_T_MIN) t = GRAPH_PULSE_FLARE_T_MIN;
  else if (t > GRAPH_PULSE_FLARE_T_MAX) t = GRAPH_PULSE_FLARE_T_MAX;
  return t;
}

export function circularDistance01(a: number, b: number): number {
  let d = Math.abs(a - b);
  if (d > 0.5) d = 1 - d;
  return d;
}

export function signedCircularDelta01(a: number, b: number): number {
  let d = a - b;
  d = d - Math.round(d);
  return d;
}

function smoothstep01(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

/**
 * Flare widen weight using **per-end geometric zones** (not fixed 22% of edge).
 */
export function flareWidenWeight(
  t: number,
  flareTFrom: number,
  flareTTo: number
): number {
  if (!Number.isFinite(t)) return 0;
  const z0 = Math.max(1e-6, flareTFrom);
  const z1 = Math.max(1e-6, flareTTo);
  if (t <= z0) return 1 - smoothstep01(t / z0);
  if (t >= 1 - z1) return 1 - smoothstep01((1 - t) / z1);
  return 0;
}

function lateralMask(absU: number, halfW: number, soft: number): number {
  if (!(halfW > 1e-8)) return 0;
  const inner = halfW * Math.max(0, 1 - soft);
  if (absU <= inner) return 1;
  if (absU >= halfW) return 0;
  const span = Math.max(1e-6, halfW - inner);
  return 1 - smoothstep01((absU - inner) / span);
}

function arrowHeadStrength(
  dRel: number,
  u: number,
  unitLen: number,
  t: number,
  flareTFrom: number,
  flareTTo: number
): number {
  if (!(unitLen > 1e-8) || !Number.isFinite(dRel) || !Number.isFinite(u)) {
    return 0;
  }
  if (dRel > 0 || dRel < -unitLen) return 0;
  const local = -dRel / unitLen;

  const tipFade = smoothstep01(local / 0.1);
  const baseFade = smoothstep01((1 - local) / 0.12);
  const endFade = tipFade * baseFade;
  if (endFade <= 0) return 0;

  let halfW =
    GRAPH_PULSE_ARROW_TIP_MIN + local * (1 - GRAPH_PULSE_ARROW_TIP_MIN);
  const flareW = flareWidenWeight(t, flareTFrom, flareTTo);
  halfW = Math.min(
    1,
    halfW * (1 + (GRAPH_PULSE_FLARE_WIDEN - 1) * flareW)
  );

  const lat = lateralMask(Math.abs(u), halfW, GRAPH_PULSE_ARROW_SOFTNESS);
  if (lat <= 0) return 0;

  const tipBoost = 0.68 + 0.42 * (1 - local);
  return endFade * lat * tipBoost;
}

/**
 * Rocket trail; slightly stronger when head is compact in t (long edges)
 * so exhaust stays visible after world-sizing shrinks the packet.
 */
function rocketTrailStrength(
  dRel: number,
  u: number,
  headUnitLen: number,
  t: number,
  flareTFrom: number,
  flareTTo: number,
  trailBoost: number
): number {
  const trailLen = headUnitLen * GRAPH_PULSE_TRAIL_UNIT;
  if (!(trailLen > 1e-8) || !Number.isFinite(dRel) || !Number.isFinite(u)) {
    return 0;
  }
  const behind = -dRel - headUnitLen;
  if (behind < 0 || behind > trailLen) return 0;

  const local = behind / trailLen;
  const along = (1 - local) * (1 - local);
  const edgeFade =
    smoothstep01(local / 0.08) * smoothstep01((1 - local) / 0.2);
  if (along * edgeFade <= 0) return 0;

  let halfW =
    (GRAPH_PULSE_ARROW_TIP_MIN + 0.75 * (1 - GRAPH_PULSE_ARROW_TIP_MIN)) *
    GRAPH_PULSE_TRAIL_WIDTH_SCALE;
  halfW *= 1 - 0.35 * local;
  const flareW = flareWidenWeight(t, flareTFrom, flareTTo);
  halfW = Math.min(
    1,
    halfW * (1 + (GRAPH_PULSE_FLARE_WIDEN - 1) * flareW * 0.85)
  );

  const lat = lateralMask(
    Math.abs(u),
    halfW,
    Math.min(0.55, GRAPH_PULSE_ARROW_SOFTNESS + 0.12)
  );
  if (lat <= 0) return 0;

  const strength =
    GRAPH_PULSE_TRAIL_STRENGTH *
    (Number.isFinite(trailBoost) ? trailBoost : 1);
  return along * edgeFade * lat * strength;
}

function singlePacketStrength(
  t: number,
  u: number,
  phase: number,
  bandT: number,
  flareTFrom: number,
  flareTTo: number,
  trailBoost: number
): number {
  if (!(bandT > 0) || !Number.isFinite(t) || !Number.isFinite(phase)) return 0;
  if (!Number.isFinite(u)) return 0;

  const d = signedCircularDelta01(t, phase);
  const unitLen = bandT * GRAPH_PULSE_ARROW_UNIT;
  const trailLen = unitLen * GRAPH_PULSE_TRAIL_UNIT;
  const stackHalf = unitLen + trailLen + bandT * 0.2;

  if (d > bandT * 0.08 || d < -stackHalf) return 0;

  const alongWindow =
    d > 0
      ? smoothstep01(1 - d / Math.max(1e-6, bandT * 0.08))
      : smoothstep01(1 - Math.abs(d) / stackHalf);

  const head = arrowHeadStrength(d, u, unitLen, t, flareTFrom, flareTTo);
  const trail = rocketTrailStrength(
    d,
    u,
    unitLen,
    t,
    flareTFrom,
    flareTTo,
    trailBoost
  );
  const s = head > trail ? head : trail;
  return alongWindow * s;
}

/**
 * Wave strength with world-sized packet + geometric flare.
 * PART_OF may stack a second softer packet.
 */
export function waveStrength(
  t: number,
  u: number,
  phase: number,
  style: SignalWaveStyle,
  geom: WaveGeomContext
): number {
  const bandT = packetBandT(
    geom.worldLength,
    geom.zoom,
    style.packetScale
  );
  const flareTFrom = geometricFlareT(geom.fromRadius, geom.worldLength);
  const flareTTo = geometricFlareT(geom.toRadius, geom.worldLength);

  // Long edges: bandT near min → trail boost so exhaust doesn't disappear.
  const trailBoost =
    1 +
    0.35 *
      smoothstep01(
        (GRAPH_PULSE_BAND_T_MAX - bandT) /
          Math.max(1e-6, GRAPH_PULSE_BAND_T_MAX - GRAPH_PULSE_BAND_T_MIN)
      );

  let s = singlePacketStrength(
    t,
    u,
    phase,
    bandT,
    flareTFrom,
    flareTTo,
    trailBoost
  );

  if (style.multiPacket) {
    const phase2 = phase - GRAPH_PULSE_SECOND_PHASE;
    const p2 = phase2 - Math.floor(phase2);
    const s2 =
      singlePacketStrength(
        t,
        u,
        p2,
        bandT * 0.92,
        flareTFrom,
        flareTTo,
        trailBoost * 0.9
      ) * GRAPH_PULSE_SECOND_STRENGTH;
    if (s2 > s) s = s2;
  }

  return s;
}

export function quantizeWaveStrength(strength: number): number {
  if (!(strength > 0)) return 0;
  if (strength >= 1) return 1;
  const steps = GRAPH_PULSE_STRENGTH_STEPS;
  return Math.round(strength * steps) / steps;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

export function lerpHexColor(base: number, peak: number, t: number): number {
  if (!(t > 0)) return base >>> 0;
  if (t >= 1) return peak >>> 0;
  const br = (base >> 16) & 0xff;
  const bg = (base >> 8) & 0xff;
  const bb = base & 0xff;
  const pr = (peak >> 16) & 0xff;
  const pg = (peak >> 8) & 0xff;
  const pb = peak & 0xff;
  return (
    ((lerpChannel(br, pr, t) & 0xff) << 16) |
    ((lerpChannel(bg, pg, t) & 0xff) << 8) |
    (lerpChannel(bb, pb, t) & 0xff)
  );
}

export function modulateDotAppearance(
  baseColor: number,
  baseAlpha: number,
  t: number,
  u: number,
  phase: number,
  style: SignalWaveStyle,
  geom: WaveGeomContext
): { color: number; alpha: number } {
  const raw = waveStrength(t, u, phase, style, geom);
  const s = quantizeWaveStrength(raw);
  if (s <= 0) {
    return { color: baseColor, alpha: baseAlpha };
  }
  const color = lerpHexColor(baseColor, style.peakColor, s * style.colorMix);
  const alpha = Math.min(1, Math.max(0, baseAlpha + s * style.alphaLift));
  return { color, alpha };
}

export function projectTravelT(
  cx: number,
  cy: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const lenSq = dx * dx + dy * dy;
  if (!(lenSq > 1e-8)) return 0.5;
  let t = ((cx - fromX) * dx + (cy - fromY) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return t;
}

export function projectLateralU(
  cx: number,
  cy: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  halfWidth: number
): number {
  if (!(halfWidth > 1e-8)) return 0;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-8)) return 0;
  const px = -dy / len;
  const py = dx / len;
  const lat = (cx - fromX) * px + (cy - fromY) * py;
  let u = lat / halfWidth;
  if (u < -1) u = -1;
  else if (u > 1) u = 1;
  return u;
}
