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
 * Nearby mock fixture only. Multi-scale clusters (A–D / RTC extremes)
 * are deferred — reintroduce later without changing GraphNode/Edge shape.
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

/**
 * Mock fixture for the graph spike (two clusters).
 *
 * **Left — small tree** (origin) for hierarchy + sparse sockets:
 *   root (0)
 *   ├── child-a (1) → leaf-a1, leaf-a2
 *   ├── child-b (1) → leaf-b1
 *   └── child-c (1) → leaf-c1
 *   + a few RELATES_TO chords
 *
 * **Right — multi-edge hub** for RimLock stress (zoom/pan to ~x=220):
 *   hub (0) with HUB_SPOKE_COUNT PART_OF children on a ring
 *   + ring RELATES between adjacent spokes
 *   + a few long RELATES from hub to tree leaves
 *
 * Name still says "mock" because the fixture data is mock — not live graph I/O.
 */
/** Spokes on the hub ring — enough to force rim sharing / non-overlap. */
export const HUB_SPOKE_COUNT = 14;

export function createMockGraphData(): GraphData {
  const nodes: GraphNode[] = [
    { id: "root", x: 0, y: 0, label: "root", rank: 0, ...emptyNodeIncidence() },
    {
      id: "child-a",
      x: -60,
      y: 55,
      label: "child-a",
      rank: 1,
      ...emptyNodeIncidence(),
    },
    {
      id: "child-b",
      x: 60,
      y: 55,
      label: "child-b",
      rank: 1,
      ...emptyNodeIncidence(),
    },
    {
      id: "child-c",
      x: 0,
      y: 70,
      label: "child-c",
      rank: 1,
      ...emptyNodeIncidence(),
    },
    {
      id: "leaf-a1",
      x: -95,
      y: 110,
      label: "leaf-a1",
      rank: 2,
      ...emptyNodeIncidence(),
    },
    {
      id: "leaf-a2",
      x: -25,
      y: 115,
      label: "leaf-a2",
      rank: 2,
      ...emptyNodeIncidence(),
    },
    {
      id: "leaf-b1",
      x: 70,
      y: 120,
      label: "leaf-b1",
      rank: 2,
      ...emptyNodeIncidence(),
    },
    {
      id: "leaf-c1",
      x: 5,
      y: 135,
      label: "leaf-c1",
      rank: 2,
      ...emptyNodeIncidence(),
    },
  ];

  const edges: GraphEdge[] = [
    // PART_OF tree (source = child, target = parent)
    { id: "po-a", source: "child-a", target: "root", type: "PART_OF" },
    { id: "po-b", source: "child-b", target: "root", type: "PART_OF" },
    { id: "po-c", source: "child-c", target: "root", type: "PART_OF" },
    { id: "po-a1", source: "leaf-a1", target: "child-a", type: "PART_OF" },
    { id: "po-a2", source: "leaf-a2", target: "child-a", type: "PART_OF" },
    { id: "po-b1", source: "leaf-b1", target: "child-b", type: "PART_OF" },
    { id: "po-c1", source: "leaf-c1", target: "child-c", type: "PART_OF" },
    // RELATES_TO chords — associative only
    { id: "rt-ab", source: "child-a", target: "child-b", type: "RELATES_TO" },
    { id: "rt-a1b1", source: "leaf-a1", target: "leaf-b1", type: "RELATES_TO" },
    { id: "rt-root-a2", source: "root", target: "leaf-a2", type: "RELATES_TO" },
  ];

  // --- Multi-edge hub cluster (right of origin) for RimLock / socket stress ---
  const hubX = 220;
  const hubY = 0;
  const spokeR = 95;
  nodes.push({
    id: "hub",
    x: hubX,
    y: hubY,
    label: "hub",
    rank: 0,
    ...emptyNodeIncidence(),
  });

  for (let i = 0; i < HUB_SPOKE_COUNT; i++) {
    const ang = (i / HUB_SPOKE_COUNT) * Math.PI * 2 - Math.PI / 2;
    const id = `spoke-${i}`;
    nodes.push({
      id,
      x: hubX + Math.cos(ang) * spokeR,
      y: hubY + Math.sin(ang) * spokeR,
      label: id,
      rank: 1,
      ...emptyNodeIncidence(),
    });
    // PART_OF: child → parent (spoke → hub)
    edges.push({
      id: `po-hub-${i}`,
      source: id,
      target: "hub",
      type: "PART_OF",
    });
    // Ring RELATES between adjacent spokes (softer density)
    const next = `spoke-${(i + 1) % HUB_SPOKE_COUNT}`;
    edges.push({
      id: `rt-spoke-${i}`,
      source: id,
      target: next,
      type: "RELATES_TO",
    });
  }

  // A few long RELATES: hub ↔ tree (cross-cluster, not for rank)
  edges.push(
    { id: "rt-hub-root", source: "hub", target: "root", type: "RELATES_TO" },
    { id: "rt-hub-a2", source: "hub", target: "leaf-a2", type: "RELATES_TO" },
    { id: "rt-spoke0-b1", source: "spoke-0", target: "leaf-b1", type: "RELATES_TO" }
  );

  const graph: GraphData = { nodes, edges };
  recomputeIncidence(graph);
  return graph;
}
