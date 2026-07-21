/**
 * Continuous ForceAtlas2 layout loop (per-cluster local coordinates).
 *
 * Design choice (robust / RTC-friendly):
 * ForceAtlas2 on absolute world coords fails numerically at cluster D (~1e17).
 * We therefore:
 *   1. Split nodes by `cluster` (or treat missing cluster as "A").
 *   2. Build a small undirected graphology Graph per cluster with
 *      **local** attributes: x' = worldX - anchor.x, y' = worldY - anchor.y.
 *   3. Run forceAtlas2.assign(iterationsPerFrame) on each local graph.
 *   4. Write world positions back as world = anchor + local.
 *
 * Cross-cluster edges are ignored for layout (topology is local only).
 * World positions remain near A/B/C/D anchors while nodes “dance” locally —
 * ideal for later RTC camera stress without FA2 NaNs.
 */

import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

import {
  CLUSTER_ANCHORS,
  type ClusterId,
  type GraphEdge,
  type GraphNode,
  type MockGraph,
  createMockGraph,
} from "./mock-graph";

export type LayoutLoopStatus = "idle" | "running" | "stopped";

export type LayoutLoopOptions = {
  /** Initial positions; loop owns a mutable copy + per-cluster graphs. */
  graph?: MockGraph;
  /** FA2 iterations per frame / step. Default 2. */
  iterationsPerFrame?: number;
  onTick?: (snapshot: MockGraph) => void;
};

export type LayoutLoopHandle = {
  start: () => void;
  stop: () => void;
  status: () => LayoutLoopStatus;
  getGraph: () => MockGraph;
  /** Replace underlying positions (e.g. reset). */
  setGraph: (graph: MockGraph) => void;
  /**
   * Synchronous one frame of layout (no rAF).
   * Prefer for Node tests / verify scripts.
   */
  step: () => void;
};

type ClusterGraphs = Map<ClusterId, Graph>;

const FA2_SETTINGS = {
  // Gentle continuous motion — not instant collapse
  gravity: 0.05,
  scalingRatio: 8,
  slowDown: 5,
  barnesHutOptimize: false,
  strongGravityMode: false,
  adjustSizes: false,
  linLogMode: false,
  outboundAttractionDistribution: false,
  edgeWeightInfluence: 1,
} as const;

function cloneGraph(source: MockGraph): MockGraph {
  return {
    nodes: source.nodes.map((n) => ({ ...n })),
    edges: source.edges.map((e) => ({ ...e })),
  };
}

function resolveCluster(node: GraphNode): ClusterId {
  return node.cluster ?? "A";
}

/**
 * Build one undirected graphology graph per cluster using local offsets.
 * Edges that stay within the cluster are included; cross edges skipped.
 */
function buildClusterGraphs(mock: MockGraph): ClusterGraphs {
  const byCluster = new Map<ClusterId, GraphNode[]>();

  for (const node of mock.nodes) {
    const c = resolveCluster(node);
    const list = byCluster.get(c);
    if (list) {
      list.push(node);
    } else {
      byCluster.set(c, [node]);
    }
  }

  const nodeCluster = new Map<string, ClusterId>();
  for (const node of mock.nodes) {
    nodeCluster.set(node.id, resolveCluster(node));
  }

  const graphs: ClusterGraphs = new Map();

  for (const [cluster, nodes] of byCluster) {
    const anchor = CLUSTER_ANCHORS[cluster];
    const g = new Graph({ type: "undirected", multi: false, allowSelfLoops: false });

    for (const node of nodes) {
      g.addNode(node.id, {
        x: node.x - anchor.x,
        y: node.y - anchor.y,
      });
    }

    for (const edge of mock.edges) {
      const sc = nodeCluster.get(edge.source);
      const tc = nodeCluster.get(edge.target);
      if (sc !== cluster || tc !== cluster) continue;
      if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue;
      if (g.hasEdge(edge.source, edge.target) || g.hasEdge(edge.target, edge.source)) {
        continue;
      }
      g.addEdge(edge.source, edge.target);
    }

    graphs.set(cluster, g);
  }

  return graphs;
}

function snapshotFromClusterGraphs(
  edges: GraphEdge[],
  meta: Map<string, { cluster: ClusterId; label?: string }>,
  clusterGraphs: ClusterGraphs
): MockGraph {
  const nodes: GraphNode[] = [];

  for (const [cluster, g] of clusterGraphs) {
    const anchor = CLUSTER_ANCHORS[cluster];
    g.forEachNode((id, attrs) => {
      const localX = typeof attrs.x === "number" ? attrs.x : 0;
      const localY = typeof attrs.y === "number" ? attrs.y : 0;
      const m = meta.get(id);
      nodes.push({
        id,
        x: anchor.x + localX,
        y: anchor.y + localY,
        cluster: m?.cluster ?? cluster,
        label: m?.label,
      });
    });
  }

  return {
    nodes,
    edges: edges.map((e) => ({ ...e })),
  };
}

function buildMeta(mock: MockGraph): Map<string, { cluster: ClusterId; label?: string }> {
  const meta = new Map<string, { cluster: ClusterId; label?: string }>();
  for (const n of mock.nodes) {
    meta.set(n.id, { cluster: resolveCluster(n), label: n.label });
  }
  return meta;
}

/**
 * Creates a layout loop that owns graphology Graphs and emits MockGraph snapshots.
 */
export function createLayoutLoop(
  options: LayoutLoopOptions = {}
): LayoutLoopHandle {
  const iterationsPerFrame = options.iterationsPerFrame ?? 2;
  const onTick = options.onTick;

  let status: LayoutLoopStatus = "idle";
  let rafId: number | null = null;

  let edges: GraphEdge[] = [];
  let meta = new Map<string, { cluster: ClusterId; label?: string }>();
  let clusterGraphs: ClusterGraphs = new Map();
  let latest: MockGraph = { nodes: [], edges: [] };

  function install(mock: MockGraph): void {
    const copy = cloneGraph(mock);
    edges = copy.edges;
    meta = buildMeta(copy);
    clusterGraphs = buildClusterGraphs(copy);
    latest = snapshotFromClusterGraphs(edges, meta, clusterGraphs);
  }

  install(options.graph ?? createMockGraph());

  function runFa2Batch(): void {
    for (const g of clusterGraphs.values()) {
      if (g.order === 0) continue;
      // Single-node graphs have no layout work
      if (g.order === 1) continue;
      forceAtlas2.assign(g, {
        iterations: iterationsPerFrame,
        settings: { ...FA2_SETTINGS },
      });
    }
    latest = snapshotFromClusterGraphs(edges, meta, clusterGraphs);
    onTick?.(cloneGraph(latest));
  }

  function frame(): void {
    if (status !== "running") return;
    runFa2Batch();
    if (typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(frame);
    } else {
      // Node / test environments without rAF — stop after one batch unless start() re-armed
      rafId = null;
      status = "stopped";
    }
  }

  return {
    start(): void {
      if (status === "running") return;
      status = "running";
      if (typeof requestAnimationFrame === "function") {
        rafId = requestAnimationFrame(frame);
      } else {
        // No rAF: run one batch so start() still does work; use step() for multi-step tests
        runFa2Batch();
      }
    },

    stop(): void {
      if (rafId !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId);
      }
      rafId = null;
      status = "stopped";
    },

    status(): LayoutLoopStatus {
      return status;
    },

    getGraph(): MockGraph {
      return cloneGraph(latest);
    },

    setGraph(graph: MockGraph): void {
      const wasRunning = status === "running";
      if (wasRunning) {
        if (rafId !== null && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(rafId);
        }
        rafId = null;
      }
      install(graph);
      if (wasRunning) {
        status = "running";
        if (typeof requestAnimationFrame === "function") {
          rafId = requestAnimationFrame(frame);
        }
      }
    },

    step(): void {
      runFa2Batch();
    },
  };
}
