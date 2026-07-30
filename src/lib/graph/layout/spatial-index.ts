/**
 * Spatial broad-phase index for GraphData nodes and edges (Slice 0 & universal residency).
 *
 * Invariants & optimization (Phase 2):
 * - Int cell keys `(ix, iy)` packed as `(iy << 16) | (ix & 0xffff)` — no string concat.
 * - `rebuild(graph, edgePad)` populates grid and internal node/edge incidence index.
 * - `updateNodePositions(graph, movedNodeIds, edgePad)` updates moved nodes and their
 *   incident edges in `O(moved × degree)` time without clearing or rebuilding the full grid.
 */

import type { GraphData, GraphEdge, GraphNode } from "../core/graph-data.ts";

export type WorldAabb = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Default grid cell size in world units. */
export const DEFAULT_CELL_SIZE = 256;

export function packCellKey(ix: number, iy: number): number {
  return ((iy & 0xffff) << 16) | (ix & 0xffff);
}

export type EdgePadResolver = (
  edge: GraphEdge,
  sourceNode: GraphNode,
  targetNode: GraphNode
) => number;

function edgeBoundingBox(
  src: GraphNode,
  tgt: GraphNode,
  pad: number
): WorldAabb {
  const minX = Math.min(src.x, tgt.x) - pad;
  const maxX = Math.max(src.x, tgt.x) + pad;
  const minY = Math.min(src.y, tgt.y) - pad;
  const maxY = Math.max(src.y, tgt.y) + pad;
  return { minX, minY, maxX, maxY };
}

export class GraphSpatialIndex {
  private cellSize: number;
  private nodeGrid = new Map<number, Set<string>>();
  private edgeGrid = new Map<number, Set<string>>();
  /** Node ID → cell keys it currently occupies */
  private nodeCells = new Map<string, Set<number>>();
  /** Edge ID → cell keys it currently occupies */
  private edgeCells = new Map<string, Set<number>>();
  /** Node ID → incident Edge IDs for fast incremental update */
  private incidentEdges = new Map<string, Set<string>>();

  constructor(cellSize = DEFAULT_CELL_SIZE) {
    this.cellSize = Math.max(16, cellSize);
  }

  clear(): void {
    this.nodeGrid.clear();
    this.edgeGrid.clear();
    this.nodeCells.clear();
    this.edgeCells.clear();
    this.incidentEdges.clear();
  }

  isEmpty(): boolean {
    return this.nodeGrid.size === 0 && this.edgeGrid.size === 0;
  }

  private cellRange(aabb: WorldAabb): {
    minIx: number;
    maxIx: number;
    minIy: number;
    maxIy: number;
  } {
    const cs = this.cellSize;
    return {
      minIx: Math.floor(aabb.minX / cs),
      maxIx: Math.floor(aabb.maxX / cs),
      minIy: Math.floor(aabb.minY / cs),
      maxIy: Math.floor(aabb.maxY / cs),
    };
  }

  private insertNode(node: GraphNode, pad = 16): void {
    const aabb: WorldAabb = {
      minX: node.x - pad,
      maxX: node.x + pad,
      minY: node.y - pad,
      maxY: node.y + pad,
    };
    const { minIx, maxIx, minIy, maxIy } = this.cellRange(aabb);
    const keys = new Set<number>();

    for (let ix = minIx; ix <= maxIx; ix++) {
      for (let iy = minIy; iy <= maxIy; iy++) {
        const key = packCellKey(ix, iy);
        keys.add(key);
        let cell = this.nodeGrid.get(key);
        if (!cell) {
          cell = new Set();
          this.nodeGrid.set(key, cell);
        }
        cell.add(node.id);
      }
    }
    this.nodeCells.set(node.id, keys);
  }

  private removeNode(nodeId: string): void {
    const keys = this.nodeCells.get(nodeId);
    if (!keys) return;
    for (const key of keys) {
      const cell = this.nodeGrid.get(key);
      if (cell) {
        cell.delete(nodeId);
        if (cell.size === 0) this.nodeGrid.delete(key);
      }
    }
    this.nodeCells.delete(nodeId);
  }

  private insertEdge(
    edge: GraphEdge,
    nodesById: Map<string, GraphNode>,
    padResolver?: EdgePadResolver
  ): void {
    const src = nodesById.get(edge.source);
    const tgt = nodesById.get(edge.target);
    if (!src || !tgt) return;

    const pad = padResolver ? padResolver(edge, src, tgt) : 32;
    const aabb = edgeBoundingBox(src, tgt, pad);
    const { minIx, maxIx, minIy, maxIy } = this.cellRange(aabb);
    const keys = new Set<number>();

    for (let ix = minIx; ix <= maxIx; ix++) {
      for (let iy = minIy; iy <= maxIy; iy++) {
        const key = packCellKey(ix, iy);
        keys.add(key);
        let cell = this.edgeGrid.get(key);
        if (!cell) {
          cell = new Set();
          this.edgeGrid.set(key, cell);
        }
        cell.add(edge.id);
      }
    }
    this.edgeCells.set(edge.id, keys);
  }

  private removeEdge(edgeId: string): void {
    const keys = this.edgeCells.get(edgeId);
    if (!keys) return;
    for (const key of keys) {
      const cell = this.edgeGrid.get(key);
      if (cell) {
        cell.delete(edgeId);
        if (cell.size === 0) this.edgeGrid.delete(key);
      }
    }
    this.edgeCells.delete(edgeId);
  }

  /**
   * Full rebuild of spatial index from GraphData.
   */
  rebuild(graph: GraphData, edgePadResolver?: EdgePadResolver): void {
    this.clear();

    const nodesById = new Map<string, GraphNode>();
    for (const node of graph.nodes) {
      nodesById.set(node.id, node);
      this.insertNode(node);
      this.incidentEdges.set(node.id, new Set());
    }

    for (const edge of graph.edges) {
      this.insertEdge(edge, nodesById, edgePadResolver);
      this.incidentEdges.get(edge.source)?.add(edge.id);
      this.incidentEdges.get(edge.target)?.add(edge.id);
    }
  }

  /**
   * Incremental position update for a set of moved node IDs.
   * Updates grid cells for moved nodes and their incident edges in O(moved × degree).
   */
  updateNodePositions(
    graph: GraphData,
    movedNodeIds: ReadonlySet<string>,
    edgePadResolver?: EdgePadResolver
  ): void {
    if (movedNodeIds.size === 0) return;

    const nodesById = new Map<string, GraphNode>();
    for (const n of graph.nodes) {
      nodesById.set(n.id, n);
    }

    const edgesById = new Map<string, GraphEdge>();
    for (const e of graph.edges) {
      edgesById.set(e.id, e);
    }

    const affectedEdgeIds = new Set<string>();

    for (const nodeId of movedNodeIds) {
      const node = nodesById.get(nodeId);
      if (!node) continue;
      this.removeNode(nodeId);
      this.insertNode(node);

      const incident = this.incidentEdges.get(nodeId);
      if (incident) {
        for (const eId of incident) {
          affectedEdgeIds.add(eId);
        }
      }
    }

    for (const edgeId of affectedEdgeIds) {
      const edge = edgesById.get(edgeId);
      if (!edge) continue;
      this.removeEdge(edgeId);
      this.insertEdge(edge, nodesById, edgePadResolver);
    }
  }

  /**
   * Query candidate node IDs intersecting an AABB.
   */
  queryNodeIds(aabb: WorldAabb): string[] {
    const { minIx, maxIx, minIy, maxIy } = this.cellRange(aabb);
    const result = new Set<string>();

    for (let ix = minIx; ix <= maxIx; ix++) {
      for (let iy = minIy; iy <= maxIy; iy++) {
        const key = packCellKey(ix, iy);
        const cell = this.nodeGrid.get(key);
        if (cell) {
          for (const id of cell) result.add(id);
        }
      }
    }
    return Array.from(result);
  }

  /**
   * Query candidate edge IDs intersecting an AABB.
   */
  queryEdgeIds(aabb: WorldAabb): string[] {
    const { minIx, maxIx, minIy, maxIy } = this.cellRange(aabb);
    const result = new Set<string>();

    for (let ix = minIx; ix <= maxIx; ix++) {
      for (let iy = minIy; iy <= maxIy; iy++) {
        const key = packCellKey(ix, iy);
        const cell = this.edgeGrid.get(key);
        if (cell) {
          for (const id of cell) result.add(id);
        }
      }
    }
    return Array.from(result);
  }
}
