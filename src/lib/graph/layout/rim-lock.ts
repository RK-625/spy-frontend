/**
 * Rim-locking allocation for multi-spoke packing (Slice 0).
 *
 * Distributes incident edges around a node's rim to prevent overlapping
 * sockets and maintain clean DotStream entry/exit angles.
 *
 * Incremental RimLock (B2):
 * - `rimLockNodesForMoves(graph, movedNodeIds)` expands moved set to their 1-hop
 *   neighbors so preferred rays update cleanly at both ends of touched edges.
 * - `applyRimLockForNodes(graph, nodeIds)` locks only that subset of nodes in O(k).
 */

import type { GraphData, GraphNode } from "../core/graph-data";
import type { RimSlot } from "../render/draw-arrow";
import { nodeScreenRadius } from "../core/graph-scale";

/** Half-span allocation per edge socket (radians). */
export const DEFAULT_RIM_HALF_SPAN = Math.PI / 12;

/**
 * Compute preferred departure angle from node center toward target point.
 */
export function angleToPoint(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): number {
  return Math.atan2(toY - fromY, toX - fromX);
}

/**
 * Minimum angular gap between adjacent rim slots (radians).
 */
const MIN_SLOT_GAP = Math.PI / 36;

/** Normalize angle to [-π, π]. */
function normaliseAngle(a: number): number {
  let x = a % (2 * Math.PI);
  if (x > Math.PI) x -= 2 * Math.PI;
  if (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

/**
 * Rim-lock allocation for a single node's incident edges.
 * Sorts edges by preferred angle, then spreads slots around the rim if crowded.
 */
export function computeRimLockForNode(
  node: GraphNode,
  nodesById: Map<string, GraphNode>,
  edgesById: Map<string, { id: string; source: string; target: string }>,
  _zoom = 1
): RimSlot[] {
  const incidentIds = new Set([
    ...node.childIds,
    ...node.parentIds,
    ...node.relateIds,
  ]);
  if (incidentIds.size === 0) return [];

  type PendingSlot = {
    edgeId: string;
    preferredAngle: number;
    assignedAngle: number;
    halfSpan: number;
  };

  const slots: PendingSlot[] = [];
  const nodeRadius = nodeScreenRadius(node.rank, 1);

  for (const edgeId of incidentIds) {
    const edge = edgesById.get(edgeId);
    if (!edge) continue;
    const otherId = edge.source === node.id ? edge.target : edge.source;
    const other = nodesById.get(otherId);
    if (!other) continue;

    const prefAngle = angleToPoint(node.x, node.y, other.x, other.y);
    // Half-span tracks cell width vs rim circumference
    const halfSpan = Math.min(
      DEFAULT_RIM_HALF_SPAN,
      Math.max(Math.PI / 24, (12 * 0.5) / Math.max(1, nodeRadius))
    );

    slots.push({
      edgeId,
      preferredAngle: prefAngle,
      assignedAngle: prefAngle,
      halfSpan,
    });
  }

  if (slots.length <= 1) {
    return slots.map((s) => ({
      midAngle: s.assignedAngle,
      halfSpan: s.halfSpan,
    }));
  }

  // Sort by preferred angle
  slots.sort((a, b) => a.preferredAngle - b.preferredAngle);

  // Check for crowding / overlap and push apart
  const count = slots.length;
  for (let i = 0; i < count; i++) {
    const nextIdx = (i + 1) % count;
    const curr = slots[i];
    const next = slots[nextIdx];

    let diff = next.preferredAngle - curr.preferredAngle;
    if (nextIdx === 0) {
      diff += Math.PI * 2;
    }

    const minSpace = curr.halfSpan + next.halfSpan + MIN_SLOT_GAP;
    if (diff < minSpace) {
      // Shift next slightly outward
      const shift = (minSpace - diff) / 2;
      next.assignedAngle = normaliseAngle(next.assignedAngle + shift);
      curr.assignedAngle = normaliseAngle(curr.assignedAngle - shift);
    }
  }

  return slots.map((s) => ({
    midAngle: s.assignedAngle,
    halfSpan: s.halfSpan,
  }));
}

/**
 * Expand a set of moved node ids to include their 1-hop neighbors in graph.
 * Required so RimLock updates preferred angles at both ends of touched edges (B2).
 */
export function rimLockNodesForMoves(
  graph: GraphData,
  movedNodeIds: ReadonlySet<string>
): Set<string> {
  const out = new Set<string>(movedNodeIds);
  if (movedNodeIds.size === 0) return out;

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const id of movedNodeIds) {
    const n = nodesById.get(id);
    if (!n) continue;
    for (const edgeId of [...n.childIds, ...n.parentIds, ...n.relateIds]) {
      // Find edge endpoints
      const edge = graph.edges.find((e) => e.id === edgeId);
      if (edge) {
        out.add(edge.source);
        out.add(edge.target);
      }
    }
  }
  return out;
}

/**
 * Lock rim slots for a specific subset of nodes in-place (B2 incremental path).
 */
export function applyRimLockForNodes(
  graph: GraphData,
  nodeIds: ReadonlySet<string>,
  zoom = 1
): void {
  if (nodeIds.size === 0) return;
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgesById = new Map(graph.edges.map((e) => [e.id, e]));

  for (const id of nodeIds) {
    const node = nodesById.get(id);
    if (!node) continue;

    const slots = computeRimLockForNode(node, nodesById, edgesById, zoom);
    const incidentIds = [
      ...node.childIds,
      ...node.parentIds,
      ...node.relateIds,
    ];

    const childSet = new Set(node.childIds);
    const parentSet = new Set(node.parentIds);

    node.rimOccupations = slots.map((s, idx) => {
      const edgeId = incidentIds[idx] ?? "";
      const kind = childSet.has(edgeId)
        ? ("part_of_child" as const)
        : parentSet.has(edgeId)
        ? ("part_of_parent" as const)
        : ("relates" as const);
      return {
        edgeId,
        midAngle: s.midAngle,
        halfSpan: s.halfSpan,
        kind,
      };
    });
  }
}

/**
 * Runs rim-lock allocation for all nodes in the graph in-place.
 */
export function applyRimLock(graph: GraphData, zoom = 1): void {
  const allIds = new Set(graph.nodes.map((n) => n.id));
  applyRimLockForNodes(graph, allIds, zoom);
}
