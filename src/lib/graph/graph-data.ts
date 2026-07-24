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
 * Nearby mock fixture only. Multi-scale clusters (A–D / RTC extremes)
 * are deferred — reintroduce later without changing GraphNode/Edge shape.
 */

/** Aligns with Links.type in `src/types/graph-schema.ts`. */
export type GraphLinkType = "PART_OF" | "RELATES_TO";

export type GraphNode = {
  id: string;
  x: number;
  y: number;
  label?: string;
  /** Stored hierarchy depth: 0 at roots (no PART_OF parent). */
  rank: number;
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

/**
 * Small local hierarchy around the origin for the graph spike.
 *
 * Tree (PART_OF, child → parent) with stored ranks:
 *   root (0)
 *   ├── child-a (1)
 *   │   ├── leaf-a1 (2)
 *   │   └── leaf-a2 (2)
 *   └── child-b (1)
 *       └── leaf-b1 (2)
 *
 * Plus RELATES_TO chords (do not affect stored rank).
 *
 * Name still says "mock" because the fixture data is mock — not live graph I/O.
 */
export function createMockGraphData(): GraphData {
  const nodes: GraphNode[] = [
    { id: "root", x: 0, y: 0, label: "root", rank: 0 },
    { id: "child-a", x: -60, y: 55, label: "child-a", rank: 1 },
    { id: "child-b", x: 60, y: 55, label: "child-b", rank: 1 },
    { id: "leaf-a1", x: -95, y: 110, label: "leaf-a1", rank: 2 },
    { id: "leaf-a2", x: -25, y: 115, label: "leaf-a2", rank: 2 },
    { id: "leaf-b1", x: 70, y: 120, label: "leaf-b1", rank: 2 },
  ];

  const edges: GraphEdge[] = [
    // PART_OF tree (source = child, target = parent)
    { id: "po-a", source: "child-a", target: "root", type: "PART_OF" },
    { id: "po-b", source: "child-b", target: "root", type: "PART_OF" },
    { id: "po-a1", source: "leaf-a1", target: "child-a", type: "PART_OF" },
    { id: "po-a2", source: "leaf-a2", target: "child-a", type: "PART_OF" },
    { id: "po-b1", source: "leaf-b1", target: "child-b", type: "PART_OF" },
    // RELATES_TO chords — associative only
    { id: "rt-ab", source: "child-a", target: "child-b", type: "RELATES_TO" },
    { id: "rt-a1b1", source: "leaf-a1", target: "leaf-b1", type: "RELATES_TO" },
    { id: "rt-root-a2", source: "root", target: "leaf-a2", type: "RELATES_TO" },
  ];

  return { nodes, edges };
}
