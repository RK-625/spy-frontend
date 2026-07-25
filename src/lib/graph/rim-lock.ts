/**
 * RimLock — pure allocation of non-overlapping angular sockets on each node rim.
 *
 * For every node, incident edges get a preferred direction (atan2 to neighbor)
 * and a natural half-span from edge band / node radius. Spans are scaled by
 * EDGE_RIM_FILL_FRAC, compressed if they overflow 2π, then packed in preferred
 * order with equal residual gaps. Writes `node.rimOccupations` sorted by midAngle.
 *
 * No Pixi. World positions from GraphNode.x/y. Band/radius at the same zoom
 * (default 1) so η is rank-stable under isotropic zoom.
 */

import type { GraphData, GraphNode, RimOccupation, RimOccupationKind } from "./graph-data";
import type { RimSlot } from "./draw-arrow";
import {
  EDGE_RIM_FILL_FRAC,
  edgeBandWidth,
  nodeScreenRadius,
  usableZoom,
} from "./graph-scale";

/** Re-export fill token for callers that import from rim-lock. */
export const RIM_FILL_FRAC = EDGE_RIM_FILL_FRAC;

const TWO_PI = Math.PI * 2;
const EPS_R = 1e-6;

function normalizeAngle(radians: number): number {
  let a = radians % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
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

      const srcNode = byId.get(edge.source);
      const tgtNode = byId.get(edge.target);
      const sourceRank = srcNode?.rank ?? 0;
      const targetRank = tgtNode?.rank ?? 0;

      const band = edgeBandWidth(z, bandKind, sourceRank, targetRank);
      const radius = Math.max(nodeScreenRadius(node.rank, z), EPS_R);
      const etaNat = band / (2 * radius);
      const eta = etaNat * RIM_FILL_FRAC;

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

    // Proportional compress if total full spans exceed 2π.
    let sumFull = 0;
    for (const p of pending) sumFull += 2 * p.eta;
    if (sumFull > TWO_PI && sumFull > 0) {
      const scale = TWO_PI / sumFull;
      for (const p of pending) p.eta *= scale;
    }

    // Preferred angular order (lockstep pack).
    pending.sort((a, b) => a.preferred - b.preferred);

    const d = pending.length;
    let totalOcc = 0;
    for (const p of pending) totalOcc += 2 * p.eta;
    const free = Math.max(0, TWO_PI - totalOcc);
    const gap = free / Math.max(d, 1);

    let cursor = pending[0].preferred - pending[0].eta - gap / 2;
    const occupations: RimOccupation[] = [];

    for (const p of pending) {
      const mid = normalizeAngle(cursor + p.eta);
      occupations.push({
        edgeId: p.edgeId,
        midAngle: mid,
        halfSpan: p.eta,
        kind: p.kind,
      });
      cursor += 2 * p.eta + gap;
    }

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
