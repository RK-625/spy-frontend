/**
 * Plain serializable graph DTO — nodes/edges arrays for render + I/O.
 *
 * `GraphData` is our domain type (plain objects). Graphology lives only in
 * the layout module for ForceAtlas2 simulation — never treat a Graphology
 * instance as GraphData or vice versa.
 *
 * Hierarchy: PART_OF edges define parent (source=child, target=parent).
 * `GraphNode.rank` is derived by `assignRanks` (roots = 0).
 *
 * Nearby mock fixture only. Multi-scale clusters (A–D / RTC extremes)
 * are deferred — reintroduce later without changing GraphNode/Edge shape.
 */

import { assignRanks } from "./hierarchy";

/** Aligns with Links.type in `src/types/graph-schema.ts`. */
export type GraphLinkType = "PART_OF" | "RELATES_TO";

export type GraphNode = {
  id: string;
  x: number;
  y: number;
  label?: string;
  /** Hierarchy depth: 0 at roots; filled by assignRanks (derived, not stored in Falkor). */
  rank?: number;
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
 * Tree (PART_OF, child → parent):
 *   root
 *   ├── child-a
 *   │   ├── leaf-a1
 *   │   └── leaf-a2
 *   └── child-b
 *       └── leaf-b1
 *
 * Plus RELATES_TO chords that must not affect rank.
 * Ranks are filled via assignRanks before return.
 *
 * Name still says "mock" because the fixture data is mock — not live graph I/O.
 */
export function createMockGraphData(): GraphData {
  const nodes: GraphNode[] = [
    { id: "root", x: 0, y: 0, label: "root" },
    { id: "child-a", x: -60, y: 55, label: "child-a" },
    { id: "child-b", x: 60, y: 55, label: "child-b" },
    { id: "leaf-a1", x: -95, y: 110, label: "leaf-a1" },
    { id: "leaf-a2", x: -25, y: 115, label: "leaf-a2" },
    { id: "leaf-b1", x: 70, y: 120, label: "leaf-b1" },
  ];

  const edges: GraphEdge[] = [
    // PART_OF tree (source = child, target = parent)
    { id: "po-a", source: "child-a", target: "root", type: "PART_OF" },
    { id: "po-b", source: "child-b", target: "root", type: "PART_OF" },
    { id: "po-a1", source: "leaf-a1", target: "child-a", type: "PART_OF" },
    { id: "po-a2", source: "leaf-a2", target: "child-a", type: "PART_OF" },
    { id: "po-b1", source: "leaf-b1", target: "child-b", type: "PART_OF" },
    // RELATES_TO chords — must not change rank
    { id: "rt-ab", source: "child-a", target: "child-b", type: "RELATES_TO" },
    { id: "rt-a1b1", source: "leaf-a1", target: "leaf-b1", type: "RELATES_TO" },
    { id: "rt-root-a2", source: "root", target: "leaf-a2", type: "RELATES_TO" },
  ];

  return assignRanks({ nodes, edges });
}
