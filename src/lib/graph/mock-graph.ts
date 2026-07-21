/**
 * Mock multi-cluster graph fixture for the graph spike.
 *
 * Clusters sit at vastly different world scales (0 → ~1e17) so RTC camera
 * can be stress-tested. Layout (Step 2) runs FA2 on **local offsets** only;
 * world position is always `anchor + local` so D stays near 1e17 without
 * FA2 blowing up on absolute coords.
 */

export type ClusterId = "A" | "B" | "C" | "D";

/** World-space cluster origins (RTC-friendly extreme scales). */
export const CLUSTER_ANCHORS: Record<ClusterId, { x: number; y: number }> = {
  A: { x: 0, y: 0 },
  B: { x: 1e6, y: 5e5 },
  C: { x: 1e12, y: -2e11 },
  D: { x: 1e17, y: 5e16 },
};

export type GraphNode = {
  id: string;
  x: number;
  y: number;
  cluster?: ClusterId;
  label?: string;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type MockGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const CLUSTER_IDS: readonly ClusterId[] = ["A", "B", "C", "D"];

/** Nodes per cluster (deterministic, 6–12 range). */
const NODES_PER_CLUSTER = 8;

/**
 * Deterministic pseudo-random in [0, 1) from integer seed.
 * Avoids Math.random so fixtures are stable across runs.
 */
function hashUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Local offset within roughly ±spread (cluster-local coords for FA2).
 */
function localOffset(
  clusterIndex: number,
  nodeIndex: number,
  axis: 0 | 1,
  spread: number
): number {
  const u = hashUnit(clusterIndex * 1000 + nodeIndex * 17 + axis * 3 + 1);
  return (u * 2 - 1) * spread;
}

function buildClusterNodes(
  cluster: ClusterId,
  clusterIndex: number,
  spread: number
): GraphNode[] {
  const anchor = CLUSTER_ANCHORS[cluster];
  const nodes: GraphNode[] = [];

  for (let i = 0; i < NODES_PER_CLUSTER; i++) {
    const lx = localOffset(clusterIndex, i, 0, spread);
    const ly = localOffset(clusterIndex, i, 1, spread);
    nodes.push({
      id: `${cluster}-${i}`,
      x: anchor.x + lx,
      y: anchor.y + ly,
      cluster,
      label: `${cluster}-${i}`,
    });
  }

  return nodes;
}

/**
 * Ring + a few chords within one cluster (local topology only).
 */
function buildClusterEdges(cluster: ClusterId, count: number): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    edges.push({
      id: `${cluster}-ring-${i}`,
      source: `${cluster}-${i}`,
      target: `${cluster}-${next}`,
    });
  }

  // Chords (every 2nd / 3rd node) for a denser local graph
  for (let i = 0; i < count; i += 2) {
    const j = (i + 2) % count;
    if (i !== j) {
      edges.push({
        id: `${cluster}-chord2-${i}`,
        source: `${cluster}-${i}`,
        target: `${cluster}-${j}`,
      });
    }
  }
  for (let i = 0; i < Math.min(3, count); i++) {
    const j = (i + 3) % count;
    edges.push({
      id: `${cluster}-chord3-${i}`,
      source: `${cluster}-${i}`,
      target: `${cluster}-${j}`,
    });
  }

  return edges;
}

/**
 * Full multi-cluster fixture.
 * Local spreads stay small (±50–150) so FA2-per-cluster is numerically safe;
 * world coords still land at A/B/C/D anchors for RTC.
 */
export function createMockGraph(): MockGraph {
  const spreads: Record<ClusterId, number> = {
    A: 120,
    B: 100,
    C: 90,
    D: 80,
  };

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  CLUSTER_IDS.forEach((cluster, index) => {
    nodes.push(...buildClusterNodes(cluster, index, spreads[cluster]));
    edges.push(...buildClusterEdges(cluster, NODES_PER_CLUSTER));
  });

  // Optional single cross-cluster bridge (A→B) — keeps jumps rare/clean
  edges.push({
    id: "cross-A-B",
    source: "A-0",
    target: "B-0",
  });

  return { nodes, edges };
}
