/**
 * Pure GraphData dirty diff — position-only vs topology / replace.
 *
 * Used by graph-canvas and layout paths to pass `{ dirtyEdges, movedNodeIds }`
 * into Pixi setGraphData so partial DotStream merge is safe (with rim expansion).
 * Topology change → `"all"`. Same identity + coords → empty dirty (no-op paint).
 */

import type { GraphData, GraphEdge } from "./graph-data";

export type GraphDirtyDiff =
  | {
      kind: "all";
      movedNodeIds: string[];
      dirtyEdges: "all";
    }
  | {
      kind: "position";
      movedNodeIds: string[];
      /** Incident edges of moved nodes (caller may rim-expand further). */
      dirtyEdges: string[];
    }
  | {
      kind: "none";
      movedNodeIds: string[];
      dirtyEdges: string[];
    };

/**
 * Collect edge ids incident to any of `nodeIds` (O(E) scan).
 */
export function incidentEdgeIds(
  graph: GraphData,
  nodeIds: ReadonlySet<string>
): string[] {
  if (nodeIds.size === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    if (nodeIds.has(edge.source) || nodeIds.has(edge.target)) {
      if (!seen.has(edge.id)) {
        seen.add(edge.id);
        out.push(edge.id);
      }
    }
  }
  return out;
}

/**
 * Expand dirty edges to **all** edges incident to any hub that touches a dirty
 * edge or a moved node. Hub multi-spoke partial must re-sample every socket on
 * affected rims (rim-coupled dirty).
 */
export function expandDirtyEdgesForHubs(
  graph: GraphData,
  dirtyEdgeIds: ReadonlySet<string>,
  movedNodeIds?: ReadonlySet<string> | null
): Set<string> {
  const expanded = new Set<string>(dirtyEdgeIds);
  const affectedNodes = new Set<string>();

  if (movedNodeIds) {
    for (const id of movedNodeIds) affectedNodes.add(id);
  }

  // Endpoints of caller dirty edges.
  for (const edge of graph.edges) {
    if (dirtyEdgeIds.has(edge.id)) {
      affectedNodes.add(edge.source);
      affectedNodes.add(edge.target);
    }
  }

  if (affectedNodes.size === 0) return expanded;

  for (const edge of graph.edges) {
    if (affectedNodes.has(edge.source) || affectedNodes.has(edge.target)) {
      expanded.add(edge.id);
    }
  }
  return expanded;
}

function edgeIdentityKey(e: GraphEdge): string {
  return `${e.id}\0${e.source}\0${e.target}\0${e.type}`;
}

/**
 * Diff previous vs next GraphData.
 * - No prev / different node or edge identity / edge endpoint-type change → all
 * - Same topology, some x/y changed → position + moved + incident dirty edges
 * - Identical positions → none
 */
export function diffGraphDirty(
  prev: GraphData | null,
  next: GraphData
): GraphDirtyDiff {
  if (!prev) {
    return { kind: "all", movedNodeIds: [], dirtyEdges: "all" };
  }

  if (
    prev.nodes.length !== next.nodes.length ||
    prev.edges.length !== next.edges.length
  ) {
    return { kind: "all", movedNodeIds: [], dirtyEdges: "all" };
  }

  const prevNodeIds = new Set(prev.nodes.map((n) => n.id));
  for (const n of next.nodes) {
    if (!prevNodeIds.has(n.id)) {
      return { kind: "all", movedNodeIds: [], dirtyEdges: "all" };
    }
  }
  if (prevNodeIds.size !== next.nodes.length) {
    return { kind: "all", movedNodeIds: [], dirtyEdges: "all" };
  }

  const prevEdgeKeys = new Set(prev.edges.map(edgeIdentityKey));
  for (const e of next.edges) {
    if (!prevEdgeKeys.has(edgeIdentityKey(e))) {
      return { kind: "all", movedNodeIds: [], dirtyEdges: "all" };
    }
  }
  if (prevEdgeKeys.size !== next.edges.length) {
    return { kind: "all", movedNodeIds: [], dirtyEdges: "all" };
  }

  const prevById = new Map(prev.nodes.map((n) => [n.id, n]));
  const movedNodeIds: string[] = [];
  for (const n of next.nodes) {
    const p = prevById.get(n.id);
    if (!p) {
      return { kind: "all", movedNodeIds: [], dirtyEdges: "all" };
    }
    if (p.x !== n.x || p.y !== n.y || p.rank !== n.rank) {
      movedNodeIds.push(n.id);
    }
  }

  if (movedNodeIds.length === 0) {
    return { kind: "none", movedNodeIds: [], dirtyEdges: [] };
  }

  const movedSet = new Set(movedNodeIds);
  const dirtyEdges = incidentEdgeIds(next, movedSet);
  return { kind: "position", movedNodeIds, dirtyEdges };
}
