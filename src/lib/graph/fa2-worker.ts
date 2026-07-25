/**
 * ForceAtlas2 off-main-thread worker (used only when layout simulation is on).
 *
 * Product path keeps LAYOUT_SIMULATION_ENABLED = false — this worker is not
 * constructed unless createSimulationLayoutLoop runs with simulation enabled.
 *
 * Protocol:
 *   Request:  { type: "step", seq, nodes, edges, iterations, settings }
 *   Response: { type: "step-result", seq, positions: Float32Array }
 *             positions layout: [x0,y0, x1,y1, ...] in same order as nodes[]
 *             transfer: [positions.buffer]
 *
 * Physics settings are passed from main so they stay in sync with
 * layout-loop-sim FORCE_ATLAS_SETTINGS (no silent param drift).
 */

import GraphologyGraph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

export type Fa2WorkerNodeIn = {
  id: string;
  x: number;
  y: number;
};

export type Fa2WorkerEdgeIn = {
  source: string;
  target: string;
};

/** Serializable FA2 settings subset (matches graphology-layout-forceatlas2). */
export type Fa2WorkerSettings = {
  gravity: number;
  scalingRatio: number;
  slowDown: number;
  barnesHutOptimize: boolean;
  strongGravityMode: boolean;
  adjustSizes: boolean;
  linLogMode: boolean;
  outboundAttractionDistribution: boolean;
  edgeWeightInfluence: number;
};

export type Fa2WorkerRequest = {
  type: "step";
  seq: number;
  nodes: Fa2WorkerNodeIn[];
  edges: Fa2WorkerEdgeIn[];
  iterations: number;
  settings: Fa2WorkerSettings;
};

export type Fa2WorkerResponse = {
  type: "step-result";
  seq: number;
  /** Interleaved x,y per input node order. */
  positions: Float32Array;
  nodeIds: string[];
};

type Fa2WorkerScope = {
  onmessage: ((ev: MessageEvent<Fa2WorkerRequest>) => void) | null;
  postMessage: (message: Fa2WorkerResponse, transfer?: Transferable[]) => void;
};

const ctx = self as unknown as Fa2WorkerScope;

function recenterToOrigin(simGraph: GraphologyGraph): void {
  const nodeCount = simGraph.order;
  if (nodeCount === 0) return;

  let sumX = 0;
  let sumY = 0;
  simGraph.forEachNode((_id, attrs) => {
    sumX += typeof attrs.x === "number" ? attrs.x : 0;
    sumY += typeof attrs.y === "number" ? attrs.y : 0;
  });
  const meanX = sumX / nodeCount;
  const meanY = sumY / nodeCount;
  if (meanX === 0 && meanY === 0) return;

  simGraph.forEachNode((id, attrs) => {
    const x = typeof attrs.x === "number" ? attrs.x : 0;
    const y = typeof attrs.y === "number" ? attrs.y : 0;
    simGraph.setNodeAttribute(id, "x", x - meanX);
    simGraph.setNodeAttribute(id, "y", y - meanY);
  });
}

ctx.onmessage = (ev: MessageEvent<Fa2WorkerRequest>) => {
  const msg = ev.data;
  if (!msg || msg.type !== "step") return;

  const simGraph = new GraphologyGraph({
    type: "undirected",
    multi: false,
    allowSelfLoops: false,
  });

  for (const node of msg.nodes) {
    simGraph.addNode(node.id, { x: node.x, y: node.y });
  }
  for (const edge of msg.edges) {
    if (!simGraph.hasNode(edge.source) || !simGraph.hasNode(edge.target)) {
      continue;
    }
    if (
      simGraph.hasEdge(edge.source, edge.target) ||
      simGraph.hasEdge(edge.target, edge.source)
    ) {
      continue;
    }
    simGraph.addEdge(edge.source, edge.target);
  }

  if (simGraph.order >= 2 && msg.iterations > 0) {
    forceAtlas2.assign(simGraph, {
      iterations: msg.iterations,
      settings: { ...msg.settings },
    });
    recenterToOrigin(simGraph);
  }

  const nodeIds: string[] = msg.nodes.map((n) => n.id);
  const positions = new Float32Array(nodeIds.length * 2);
  for (let i = 0; i < nodeIds.length; i++) {
    const id = nodeIds[i];
    const x = simGraph.hasNode(id)
      ? (simGraph.getNodeAttribute(id, "x") as number)
      : 0;
    const y = simGraph.hasNode(id)
      ? (simGraph.getNodeAttribute(id, "y") as number)
      : 0;
    positions[i * 2] = typeof x === "number" ? x : 0;
    positions[i * 2 + 1] = typeof y === "number" ? y : 0;
  }

  const response: Fa2WorkerResponse = {
    type: "step-result",
    seq: msg.seq,
    positions,
    nodeIds,
  };
  ctx.postMessage(response, [positions.buffer]);
};
