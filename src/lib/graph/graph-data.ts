/**
 * Plain serializable graph DTO — nodes/edges arrays for render + I/O.
 *
 * `GraphData` is our domain type (plain objects). Graphology lives only in
 * the layout module for ForceAtlas2 simulation — never treat a Graphology
 * instance as GraphData or vice versa.
 *
 * Nearby mock fixture only. Multi-scale clusters (A–D / RTC extremes)
 * are deferred — reintroduce later without changing GraphNode/Edge shape.
 */

export type GraphNode = {
  id: string;
  x: number;
  y: number;
  label?: string;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

/** Plain nodes/edges for render + I/O (not a Graphology instance). */
export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/**
 * Small local graph around the origin: nodes sit close together with
 * edges linking neighbors (ring + a few chords). FA2 can run on absolute
 * coords safely at this scale.
 *
 * Name still says "mock" because the fixture data is mock — not live graph I/O.
 */
export function createMockGraphData(): GraphData {
  const nodes: GraphNode[] = [
    { id: "n0", x: 0, y: 0, label: "n0" },
    { id: "n1", x: 80, y: 20, label: "n1" },
    { id: "n2", x: 40, y: 90, label: "n2" },
    { id: "n3", x: -50, y: 70, label: "n3" },
    { id: "n4", x: -70, y: -30, label: "n4" },
    { id: "n5", x: 30, y: -80, label: "n5" },
  ];

  const edges: GraphEdge[] = [
    // Ring of neighbors
    { id: "e0", source: "n0", target: "n1" },
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n3" },
    { id: "e3", source: "n3", target: "n4" },
    { id: "e4", source: "n4", target: "n5" },
    { id: "e5", source: "n5", target: "n0" },
    // A few nearby chords
    { id: "e6", source: "n0", target: "n2" },
    { id: "e7", source: "n1", target: "n3" },
    { id: "e8", source: "n2", target: "n4" },
  ];

  return { nodes, edges };
}
