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
 * Crowding: if sum(2·eta) > 2π, scale all etas proportionally. Adjacent intervals
 * that still overlap shrink eta further (mids fixed). Only then is halfSpan tighter
 * than natural flare — draw-arrow clamps/culls only in that constrained case.
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

type PendingSlot = {
  edgeId: string;
  preferred: number;
  eta: number;
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
 * Shrink adjacent etas until [mid±eta] intervals no longer overlap.
 * Keeps midAngles fixed (geometric preferred rays). Multiple passes for chains.
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
      // Forward arc to next preferred (circle wrap on last→first).
      const gap =
        i + 1 < n
          ? normalizeAngle(b.preferred - a.preferred)
          : normalizeAngle(b.preferred + TWO_PI - a.preferred);
      // Two slots: only the shorter arc is meaningful for interval overlap.
      const sep = n === 2 ? angularSep(a.preferred, b.preferred) : gap;
      const need = a.eta + b.eta;
      if (need > sep && need > 0) {
        const scale = (sep / need) * OVERLAP_CLEAR;
        a.eta *= scale;
        b.eta *= scale;
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
      const eta = naturalFlareHalfSpan(band, density, radius);

      if (!Number.isFinite(eta) || eta <= 0) continue;

      pending.push({
        edgeId: edge.id,
        preferred,
        eta,
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
