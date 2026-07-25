/**
 * Uniform-grid spatial index for graph edge/node culling (no external deps).
 *
 * Used by the Pixi renderer so geometry residency follows the camera
 * (viewport + overscan) instead of baking the whole graph by default.
 *
 * **Cell size:** `max(span / 32, 1)` where `span` is the larger side of the
 * node-center AABB (width/height). Empty or zero-span graphs use cell size 1.
 * This keeps ~32 cells along the long axis — coarse enough for cheap inserts
 * and queries, fine enough that overscan queries do not return the whole graph
 * on medium fixtures. Median edge length is a reasonable alternative for very
 * sparse layouts; span/32 is simpler and stable for nearby mock + hub graphs.
 *
 * **Insert:** each node into the cell of its center; each edge into every cell
 * overlapping its segment AABB (endpoints ± `edgePad`).
 *
 * **Query:** union of ids in all cells overlapping the query AABB (deduped).
 * Results are candidates — caller may exact-filter with segment/circle tests.
 *
 * **Incremental:** `updateNodePositions` reindexes a small set of nodes and
 * their incident edges without a full rebuild when the graph span (cell size)
 * is still valid. Topology change → always `rebuild`.
 *
 * **Cell keys:** packed int keys (not `"ix,iy"` strings) for Map lookups.
 * **Incidence:** `edgeIdsByNode` avoids full edge scan on position updates.
 *
 * Pure TS; no Pixi.
 */

import type { GraphData, GraphEdge, GraphNode } from "./graph-data";

/** Axis-aligned bounding box in world coordinates. */
export type WorldAabb = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/**
 * Pack cell indices into a single number key.
 * Offset keeps negative ix/iy representable; stride bounds each axis to ±131072
 * cells — far beyond practical graph spans at cellSize ≥ 1.
 */
const CELL_KEY_OFFSET = 0x20000;
const CELL_KEY_STRIDE = 0x40000;

function cellKey(ix: number, iy: number): number {
  return (ix + CELL_KEY_OFFSET) * CELL_KEY_STRIDE + (iy + CELL_KEY_OFFSET);
}

function cellIndex(v: number, cellSize: number): number {
  return Math.floor(v / cellSize);
}

/**
 * Uniform grid over world space. Sparse cell map — only occupied cells exist.
 */
export class GraphSpatialIndex {
  private cellSize = 1;
  /** cellKey → node ids whose centers fall in this cell */
  private nodeCells = new Map<number, string[]>();
  /** cellKey → edge ids whose padded segment AABB overlaps this cell */
  private edgeCells = new Map<number, string[]>();
  /** Reverse: nodeId → single cell key (center). */
  private nodeCellOf = new Map<string, number>();
  /** Reverse: edgeId → cell keys currently holding this edge. */
  private edgeCellsOf = new Map<string, number[]>();
  /**
   * Edge incidence by node id (edge ids, graph.edges order per endpoint).
   * Built on rebuild; maintained on incremental edge reindex.
   */
  private edgeIdsByNode = new Map<string, string[]>();
  /** Last rebuild node-center span (for incremental cell-size validity). */
  private spanMinX = 0;
  private spanMinY = 0;
  private spanMaxX = 0;
  private spanMaxY = 0;
  private hasSpan = false;

  /**
   * Rebuild from graph. `edgePad(edge, src, tgt)` expands the segment AABB
   * (world units) so broad-phase matches bake-sample pad (radii + band).
   */
  rebuild(
    graph: GraphData,
    edgePad: (e: GraphEdge, src: GraphNode, tgt: GraphNode) => number
  ): void {
    this.clear();

    const nodes = graph.nodes;
    if (nodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    if (!Number.isFinite(minX)) {
      // All non-finite positions — nothing to index.
      return;
    }

    this.spanMinX = minX;
    this.spanMinY = minY;
    this.spanMaxX = maxX;
    this.spanMaxY = maxY;
    this.hasSpan = true;

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const span = Math.max(spanX, spanY, 0);
    // Adaptive: ~32 cells along the long axis; floor at 1 world unit.
    this.cellSize = Math.max(span / 32, 1);

    const byId = new Map<string, GraphNode>();
    for (const n of nodes) {
      byId.set(n.id, n);
    }

    for (const n of nodes) {
      this.insertNode(n);
    }

    // Incidence + edges in graph order.
    for (const edge of graph.edges) {
      this.addEdgeIncidence(edge);
      const src = byId.get(edge.source);
      const tgt = byId.get(edge.target);
      if (!src || !tgt) continue;
      this.insertEdge(edge, src, tgt, edgePad);
    }
  }

  /**
   * Cheap path when only a few node positions changed (same topology).
   * Reindexes those nodes and every edge incident to them via incidence map.
   *
   * Falls back to full `rebuild` when:
   * - index empty / no prior span
   * - any moved node leaves the previous span enough that cell size should grow
   * - moved set is huge relative to graph (cheaper to rebuild)
   *
   * Query semantics unchanged — results remain broad-phase candidates.
   */
  updateNodePositions(
    graph: GraphData,
    movedNodeIds: ReadonlySet<string>,
    edgePad: (e: GraphEdge, src: GraphNode, tgt: GraphNode) => number
  ): void {
    if (movedNodeIds.size === 0) return;
    if (!this.hasSpan || this.isEmpty()) {
      this.rebuild(graph, edgePad);
      return;
    }

    // Large move sets → full rebuild is simpler and often faster.
    if (movedNodeIds.size > 64 && movedNodeIds.size > graph.nodes.length * 0.25) {
      this.rebuild(graph, edgePad);
      return;
    }

    const byId = new Map<string, GraphNode>();
    for (const n of graph.nodes) {
      byId.set(n.id, n);
    }

    // If any moved node is far outside prior span, cell size may be wrong.
    const margin =
      Math.max(
        this.spanMaxX - this.spanMinX,
        this.spanMaxY - this.spanMinY,
        this.cellSize
      ) * 0.05;
    for (const id of movedNodeIds) {
      const n = byId.get(id);
      if (!n || !Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      if (
        n.x < this.spanMinX - margin ||
        n.x > this.spanMaxX + margin ||
        n.y < this.spanMinY - margin ||
        n.y > this.spanMaxY + margin
      ) {
        this.rebuild(graph, edgePad);
        return;
      }
    }

    // Collect incident edges via incidence map (O(moved × degree), not O(E)).
    // Fall back to full edge scan if incidence was never built (defensive).
    const dirtyEdges: GraphEdge[] = [];
    const dirtyEdgeIds = new Set<string>();
    if (this.edgeIdsByNode.size > 0) {
      for (const nodeId of movedNodeIds) {
        const ids = this.edgeIdsByNode.get(nodeId);
        if (!ids) continue;
        for (const eid of ids) {
          if (dirtyEdgeIds.has(eid)) continue;
          dirtyEdgeIds.add(eid);
          // Resolve edge from graph — O(E) worst if no map; prefer edgesById later.
        }
      }
      // Resolve GraphEdge objects once.
      if (dirtyEdgeIds.size > 0) {
        for (const edge of graph.edges) {
          if (dirtyEdgeIds.has(edge.id)) dirtyEdges.push(edge);
        }
      }
    } else {
      for (const edge of graph.edges) {
        if (
          movedNodeIds.has(edge.source) ||
          movedNodeIds.has(edge.target)
        ) {
          if (!dirtyEdgeIds.has(edge.id)) {
            dirtyEdgeIds.add(edge.id);
            dirtyEdges.push(edge);
          }
        }
      }
    }

    for (const id of movedNodeIds) {
      const n = byId.get(id);
      if (!n) {
        this.removeNode(id);
        continue;
      }
      this.removeNode(id);
      this.insertNode(n);
    }

    for (const edge of dirtyEdges) {
      this.removeEdge(edge.id);
      const src = byId.get(edge.source);
      const tgt = byId.get(edge.target);
      if (!src || !tgt) continue;
      this.insertEdge(edge, src, tgt, edgePad);
    }
  }

  /**
   * Edge ids incident to a node (empty if unknown). O(1) map lookup.
   */
  getIncidentEdgeIds(nodeId: string): readonly string[] {
    return this.edgeIdsByNode.get(nodeId) ?? [];
  }

  /**
   * Edge ids that may intersect `query` (broad-phase candidates).
   * Caller may re-filter with exact segment AABB.
   */
  queryEdgeIds(query: WorldAabb): string[] {
    return this.queryIds(this.edgeCells, query);
  }

  /**
   * Node ids whose centers may lie in `query` (optional helper for node cull).
   * Centers only — does not expand by node radius; caller should pad query or
   * re-test with circleOutsideAabb.
   */
  queryNodeIds(query: WorldAabb): string[] {
    return this.queryIds(this.nodeCells, query);
  }

  clear(): void {
    this.cellSize = 1;
    this.nodeCells.clear();
    this.edgeCells.clear();
    this.nodeCellOf.clear();
    this.edgeCellsOf.clear();
    this.edgeIdsByNode.clear();
    this.hasSpan = false;
    this.spanMinX = 0;
    this.spanMinY = 0;
    this.spanMaxX = 0;
    this.spanMaxY = 0;
  }

  /**
   * True when neither node nor edge cells are occupied.
   * Callers rebuild when empty while the graph still has finite geometry.
   */
  isEmpty(): boolean {
    return this.nodeCells.size === 0 && this.edgeCells.size === 0;
  }

  private addEdgeIncidence(edge: GraphEdge): void {
    let srcList = this.edgeIdsByNode.get(edge.source);
    if (!srcList) {
      srcList = [];
      this.edgeIdsByNode.set(edge.source, srcList);
    }
    if (!srcList.includes(edge.id)) srcList.push(edge.id);

    if (edge.target !== edge.source) {
      let tgtList = this.edgeIdsByNode.get(edge.target);
      if (!tgtList) {
        tgtList = [];
        this.edgeIdsByNode.set(edge.target, tgtList);
      }
      if (!tgtList.includes(edge.id)) tgtList.push(edge.id);
    }
  }

  private insertNode(n: GraphNode): void {
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return;
    const ix = cellIndex(n.x, this.cellSize);
    const iy = cellIndex(n.y, this.cellSize);
    const key = cellKey(ix, iy);
    let list = this.nodeCells.get(key);
    if (!list) {
      list = [];
      this.nodeCells.set(key, list);
    }
    list.push(n.id);
    this.nodeCellOf.set(n.id, key);
  }

  private removeNode(nodeId: string): void {
    const key = this.nodeCellOf.get(nodeId);
    if (key === undefined) return;
    this.nodeCellOf.delete(nodeId);
    const list = this.nodeCells.get(key);
    if (!list) return;
    const idx = list.indexOf(nodeId);
    if (idx >= 0) list.splice(idx, 1);
    if (list.length === 0) this.nodeCells.delete(key);
  }

  private insertEdge(
    edge: GraphEdge,
    src: GraphNode,
    tgt: GraphNode,
    edgePad: (e: GraphEdge, src: GraphNode, tgt: GraphNode) => number
  ): void {
    if (
      !Number.isFinite(src.x) ||
      !Number.isFinite(src.y) ||
      !Number.isFinite(tgt.x) ||
      !Number.isFinite(tgt.y)
    ) {
      return;
    }

    const pad = edgePad(edge, src, tgt);
    const p = Number.isFinite(pad) && pad > 0 ? pad : 0;
    const eMinX = Math.min(src.x, tgt.x) - p;
    const eMaxX = Math.max(src.x, tgt.x) + p;
    const eMinY = Math.min(src.y, tgt.y) - p;
    const eMaxY = Math.max(src.y, tgt.y) + p;

    const ix0 = cellIndex(eMinX, this.cellSize);
    const ix1 = cellIndex(eMaxX, this.cellSize);
    const iy0 = cellIndex(eMinY, this.cellSize);
    const iy1 = cellIndex(eMaxY, this.cellSize);

    const keys: number[] = [];
    for (let iy = iy0; iy <= iy1; iy++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const key = cellKey(ix, iy);
        let list = this.edgeCells.get(key);
        if (!list) {
          list = [];
          this.edgeCells.set(key, list);
        }
        list.push(edge.id);
        keys.push(key);
      }
    }
    this.edgeCellsOf.set(edge.id, keys);
  }

  private removeEdge(edgeId: string): void {
    const keys = this.edgeCellsOf.get(edgeId);
    if (!keys) return;
    this.edgeCellsOf.delete(edgeId);
    for (const key of keys) {
      const list = this.edgeCells.get(key);
      if (!list) continue;
      const idx = list.indexOf(edgeId);
      if (idx >= 0) list.splice(idx, 1);
      if (list.length === 0) this.edgeCells.delete(key);
    }
  }

  private queryIds(
    cells: Map<number, string[]>,
    query: WorldAabb
  ): string[] {
    if (cells.size === 0) return [];

    const cs = this.cellSize > 0 ? this.cellSize : 1;
    const ix0 = cellIndex(query.minX, cs);
    const ix1 = cellIndex(query.maxX, cs);
    const iy0 = cellIndex(query.minY, cs);
    const iy1 = cellIndex(query.maxY, cs);

    const seen = new Set<string>();
    const out: string[] = [];

    for (let iy = iy0; iy <= iy1; iy++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const list = cells.get(cellKey(ix, iy));
        if (!list) continue;
        for (const id of list) {
          if (seen.has(id)) continue;
          seen.add(id);
          out.push(id);
        }
      }
    }

    return out;
  }
}
