/**
 * RimLock — pure allocation of non-overlapping angular sockets on each node rim.
 *
 * For every node, incident edges get a preferred direction (atan2 to neighbor)
 * and a natural half-span matching the DotStream terminal flare (capacity reserve):
 *
 *   halfBand = floor((cols - 1) / 2)
 *   latMaxNat = halfBand * (1 + EDGE_DOT_FLARE_GAIN)
 *   etaFlare  = (latMaxNat * cell / radius) * 1.15   // + crescent margin
 *
 * When uncrowded, halfSpan stays at etaFlare so draw-arrow can paint full flare +
 * axial crescent without clamping. midAngle stays on the geometric preferred ray.
 *
 * Crowding:
 *   1) if sum(2·eta) > 2π, scale all etas proportionally
 *   2) adjacent overlaps: shrink with **RELATES first** (PART_OF keeps more share)
 *   3) **gap fairness**: leftover free arc between neighbors is redistributed,
 *      preferring PART_OF, up to each slot's natural etaNat
 *
 * Only when halfSpan is tighter than natural flare does draw-arrow clamp/cull.
 *
 * No Pixi. World positions from GraphNode.x/y. Band/radius at the same zoom
 * (default 1) so η is rank-stable under isotropic zoom.
 */

import type { GraphData, GraphNode, RimOccupation, RimOccupationKind } from "./graph-data";
import type { RimSlot } from "./draw-arrow";
import {
  EDGE_DOT_FLARE_GAIN,
  EDGE_RIM_FILL_FRAC,
  edgeBandWidth,
  edgeStripLayout,
  nodeScreenRadius,
  usableZoom,
} from "./graph-scale";

/** Re-export fill token for callers that import from rim-lock. */
export const RIM_FILL_FRAC = EDGE_RIM_FILL_FRAC;

const TWO_PI = Math.PI * 2;
const EPS_R = 1e-6;
/** Extra angular margin so axial-fan crescent columns fit inside the socket. */
const CRESCENT_MARGIN = 1.15;
/** Tiny clearance when resolving adjacent arc overlaps (avoid exact touch glitches). */
const OVERLAP_CLEAR = 0.999;
/** PART_OF weight vs RELATES when splitting a shared angular gap (shrink + grow). */
const WEIGHT_PART_OF = 3;
const WEIGHT_RELATES = 2;

function normalizeAngle(radians: number): number {
  let a = radians % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
}

/** Shortest absolute angular separation on the circle, in [0, π]. */
function angularSep(a: number, b: number): number {
  let d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  if (d > Math.PI) d = TWO_PI - d;
  return d;
}

/** Forward arc length from angle a to b on the circle, in [0, 2π). */
function forwardArc(from: number, to: number): number {
  return normalizeAngle(to - from);
}

type PendingSlot = {
  edgeId: string;
  preferred: number;
  /** Current half-span (may shrink under crowding). */
  eta: number;
  /** Natural flare half-span (growth cap for gap fairness). */
  etaNat: number;
  kind: RimOccupationKind;
};

function occupationKind(
  edgeType: "PART_OF" | "RELATES_TO",
  nodeId: string,
  sourceId: string,
  targetId: string
): RimOccupationKind {
  if (edgeType === "PART_OF") {
    if (targetId === nodeId) return "part_of_child";
    if (sourceId === nodeId) return "part_of_parent";
  }
  return "relates";
}

function bandKindForOccupation(
  kind: RimOccupationKind
): "part_of" | "relates" {
  return kind === "relates" ? "relates" : "part_of";
}

/** firm strip for PART_OF sockets; soft for RELATES_TO. */
function densityForOccupation(kind: RimOccupationKind): "firm" | "soft" {
  return kind === "relates" ? "soft" : "firm";
}

function slotWeight(kind: RimOccupationKind): number {
  return kind === "relates" ? WEIGHT_RELATES : WEIGHT_PART_OF;
}

/**
 * Natural flare half-span (radians) at the rim — capacity reserve matching
 * DotStream latMax at full widen, plus crescent margin for axial fan.
 */
function naturalFlareHalfSpan(
  band: number,
  density: "firm" | "soft",
  radius: number
): number {
  const { cols, cell } = edgeStripLayout(band, density);
  const halfBand = Math.floor((cols - 1) / 2);
  const latMaxNat = halfBand * (1 + EDGE_DOT_FLARE_GAIN);
  const r = Math.max(radius, EPS_R);
  return (latMaxNat * cell / r) * CRESCENT_MARGIN;
}

/**
 * Angular separation budget between two consecutive preferred rays (circle).
 */
function consecutiveSep(
  a: PendingSlot,
  b: PendingSlot,
  n: number,
  i: number
): number {
  if (n === 2) return angularSep(a.preferred, b.preferred);
  return i + 1 < n
    ? forwardArc(a.preferred, b.preferred)
    : forwardArc(a.preferred, b.preferred);
}

/**
 * Shrink adjacent etas until [mid±eta] intervals no longer overlap.
 * midAngles stay fixed. When shrinking, **RELATES yield first** (lower weight)
 * so PART_OF hierarchy sockets keep more flare.
 */
function resolveAdjacentOverlaps(pending: PendingSlot[]): void {
  if (pending.length < 2) return;

  const n = pending.length;
  pending.sort((a, b) => a.preferred - b.preferred);

  for (let pass = 0; pass < n + 2; pass++) {
    let any = false;
    for (let i = 0; i < n; i++) {
      const a = pending[i];
      const b = pending[(i + 1) % n];
      const sep = consecutiveSep(a, b, n, i);
      const need = a.eta + b.eta;
      if (need <= sep || need <= 0) continue;

      const budget = sep * OVERLAP_CLEAR;
      const wA = slotWeight(a.kind);
      const wB = slotWeight(b.kind);
      const wSum = wA + wB;
      // Higher weight keeps a larger share of the tight gap (PART_OF > RELATES).
      let tA = (budget * wA) / wSum;
      let tB = (budget * wB) / wSum;
      // Only shrink, never grow in this pass.
      tA = Math.min(a.eta, tA);
      tB = Math.min(b.eta, tB);
      // If still over (both already at floor of weighted share), scale the pair.
      if (tA + tB > budget && tA + tB > 0) {
        const s = budget / (tA + tB);
        tA *= s;
        tB *= s;
      }
      if (tA < a.eta - 1e-12 || tB < b.eta - 1e-12) {
        a.eta = tA;
        b.eta = tB;
        any = true;
      }
    }
    if (!any) break;
  }
}

/**
 * After overlaps are resolved, leftover free arc between neighbors is given
 * back to sockets (up to etaNat), preferring PART_OF so hierarchy terminals
 * recover flare when a soft RELATES had forced a squeeze.
 */
function gapFairnessRedistribute(pending: PendingSlot[]): void {
  if (pending.length < 2) return;

  const n = pending.length;
  pending.sort((a, b) => a.preferred - b.preferred);

  for (let pass = 0; pass < n + 2; pass++) {
    let any = false;
    for (let i = 0; i < n; i++) {
      const a = pending[i];
      const b = pending[(i + 1) % n];
      const sep = consecutiveSep(a, b, n, i);
      const free = sep - a.eta - b.eta;
      if (free <= 1e-9) continue;

      const roomA = Math.max(0, a.etaNat - a.eta);
      const roomB = Math.max(0, b.etaNat - b.eta);
      if (roomA <= 0 && roomB <= 0) continue;

      const wA = slotWeight(a.kind);
      const wB = slotWeight(b.kind);
      // Prefer expanding PART_OF: allocate free by weight, then remainder to other.
      let giveA = 0;
      let giveB = 0;
      if (roomA > 0 && roomB > 0) {
        const wSum = wA + wB;
        giveA = Math.min(roomA, (free * wA) / wSum);
        giveB = Math.min(roomB, free - giveA);
        // If B still has room and free left (A hit cap), feed B.
        if (giveA + giveB < free - 1e-12) {
          giveB = Math.min(roomB, free - giveA);
        }
      } else if (roomA > 0) {
        giveA = Math.min(roomA, free);
      } else {
        giveB = Math.min(roomB, free);
      }

      if (giveA > 1e-12) {
        a.eta += giveA;
        any = true;
      }
      if (giveB > 1e-12) {
        b.eta += giveB;
        any = true;
      }
    }
    if (!any) break;
  }
}

/**
 * Full rewrite of `node.rimOccupations` for every node in the graph.
 * @param zoom Optional camera zoom for screen-consistent halfSpan; default 1.
 */
export function applyRimLock(graph: GraphData, zoom?: number): void {
  const z = usableZoom(zoom ?? 1);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const node of graph.nodes) {
    const pending: PendingSlot[] = [];

    for (const edge of graph.edges) {
      if (edge.source !== node.id && edge.target !== node.id) continue;

      const otherId = edge.source === node.id ? edge.target : edge.source;
      const other = byId.get(otherId);
      if (!other) continue;

      const preferred = normalizeAngle(
        Math.atan2(other.y - node.y, other.x - node.x)
      );
      const kind = occupationKind(edge.type, node.id, edge.source, edge.target);
      const bandKind = bandKindForOccupation(kind);
      const density = densityForOccupation(kind);

      const srcNode = byId.get(edge.source);
      const tgtNode = byId.get(edge.target);
      const sourceRank = srcNode?.rank ?? 0;
      const targetRank = tgtNode?.rank ?? 0;

      const band = edgeBandWidth(z, bandKind, sourceRank, targetRank);
      const radius = Math.max(nodeScreenRadius(node.rank, z), EPS_R);
      // Capacity reserve = natural terminal flare (+ crescent), not band/(2R).
      const etaNat = naturalFlareHalfSpan(band, density, radius);

      if (!Number.isFinite(etaNat) || etaNat <= 0) continue;

      pending.push({
        edgeId: edge.id,
        preferred,
        eta: etaNat,
        etaNat,
        kind,
      });
    }

    if (pending.length === 0) {
      node.rimOccupations = [];
      continue;
    }

    // Proportional compress only when natural flares overflow the full rim.
    let sumFull = 0;
    for (const p of pending) sumFull += 2 * p.eta;
    if (sumFull > TWO_PI && sumFull > 0) {
      const scale = TWO_PI / sumFull;
      for (const p of pending) p.eta *= scale;
    }

    // Keep mid on geometric preferred ray — never lockstep-repack away from aim.
    resolveAdjacentOverlaps(pending);
    // Give leftover free arc back (PART_OF first) up to natural flare.
    gapFairnessRedistribute(pending);

    const occupations: RimOccupation[] = pending.map((p) => ({
      edgeId: p.edgeId,
      midAngle: normalizeAngle(p.preferred),
      halfSpan: p.eta,
      kind: p.kind,
    }));

    occupations.sort((a, b) => a.midAngle - b.midAngle);
    node.rimOccupations = occupations;
  }
}

/** Map a node's occupation for `edgeId` to a draw-arrow RimSlot. */
export function findRimSlot(
  node: GraphNode,
  edgeId: string
): RimSlot | undefined {
  const occ = node.rimOccupations.find((o) => o.edgeId === edgeId);
  if (!occ) return undefined;
  return { midAngle: occ.midAngle, halfSpan: occ.halfSpan };
}
