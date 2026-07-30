/**
 * Plain serializable graph DTO — nodes/edges arrays for render + I/O.
 *
 * `GraphData` is our domain type (plain objects). Graphology lives only in
 * the layout module for ForceAtlas2 simulation — never treat a Graphology
 * instance as GraphData or vice versa.
 *
 * Hierarchy: PART_OF edges define parent (source=child, target=parent).
 * `GraphNode.rank` is a **stored** field on the node (mock now; DB later).
 * Roots (no PART_OF parent) have rank 0. Child = parent.rank + 1 is a
 * write-time rule on the authoring path — not recomputed on the canvas.
 *
 * Incidence lists (`childIds` / `parentIds` / `relateIds`) are derived from
 * `edges[]` via `recomputeIncidence`. `rimOccupations` is filled by RimLock
 * (angles need radii/bands) — not by incidence recompute.
 *
 * Fixtures (mock / stress) live in `../fixtures/mock-graph` — re-exported below
 * for stable import paths used by layout + verify scripts.
 */

/** Aligns with Links.type in `src/types/graph-schema.ts`. */
export type GraphLinkType = "PART_OF" | "RELATES_TO";

/** How an edge sits on a node rim (incidence role at that endpoint). */
export type RimOccupationKind = "part_of_child" | "part_of_parent" | "relates";

/** Snapshot of one edge's allocated arc on a node rim (after RimLock). */
export type RimOccupation = {
  edgeId: string;
  /** World-space radians in [0, 2π) after normalize. */
  midAngle: number;
  halfSpan: number;
  kind: RimOccupationKind;
};

export type GraphNode = {
  id: string;
  x: number;
  y: number;
  label?: string;
  /**
   * Memory body for node-inspect UI (not used by bake/render).
   * Live `/api/graph` rows carry this; mock fixtures may omit.
   */
  content?: string;
  /** Optional Memory impression for node-inspect UI. */
  impression?: string;
  /** Optional Memory confidence [0,1] for node-inspect UI. */
  confidence?: number;
  /** Stored hierarchy depth: 0 at roots (no PART_OF parent). */
  rank: number;
  /** PART_OF where target=me (I'm parent). */
  childIds: string[];
  /** PART_OF where source=me (I'm child). */
  parentIds: string[];
  /** RELATES_TO other endpoint ids. */
  relateIds: string[];
  /** Snapshot after RimLock; sorted by midAngle. */
  rimOccupations: RimOccupation[];
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  /** PART_OF: source=child, target=parent. RELATES_TO: associative only. */
  type: GraphLinkType;
};

/** Plain nodes/edges for render + I/O (not a Graphology instance). */
export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/** Empty incidence + rim fields for a new node (edges remain topology SoT). */
export function emptyNodeIncidence(): Pick<
  GraphNode,
  "childIds" | "parentIds" | "relateIds" | "rimOccupations"
> {
  return {
    childIds: [],
    parentIds: [],
    relateIds: [],
    rimOccupations: [],
  };
}

/**
 * Clears and rebuilds childIds / parentIds / relateIds from `graph.edges`.
 * Does **not** run RimLock (angles need radii / bands / zoom).
 */
export function recomputeIncidence(graph: GraphData): void {
  for (const node of graph.nodes) {
    node.childIds = [];
    node.parentIds = [];
    node.relateIds = [];
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const edge of graph.edges) {
    const src = byId.get(edge.source);
    const tgt = byId.get(edge.target);
    if (!src || !tgt) continue;

    if (edge.type === "PART_OF") {
      // source = child, target = parent
      if (!tgt.childIds.includes(src.id)) tgt.childIds.push(src.id);
      if (!src.parentIds.includes(tgt.id)) src.parentIds.push(tgt.id);
    } else {
      if (!src.relateIds.includes(tgt.id)) src.relateIds.push(tgt.id);
      if (!tgt.relateIds.includes(src.id)) tgt.relateIds.push(src.id);
    }
  }
}

/** Fixtures — stable re-exports (prefer `@/lib/graph/fixtures/mock-graph`). */
export {
  HUB_SPOKE_COUNT,
  createMockGraphData,
  createLargeStressGraphData,
  type LargeStressFixtureOptions,
} from "../fixtures/mock-graph";
