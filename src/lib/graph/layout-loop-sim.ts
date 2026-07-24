/**
 * Simulation layout path — Graphology + ForceAtlas2 + recenter + rAF.
 *
 * Loaded only when createLayoutLoop enables simulation. Static default path
 * never needs this module for runtime work (verify/tests use simulationEnabled).
 */

import GraphologyGraph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

import {
  type GraphData,
  createMockGraphData,
} from "./graph-data";
import type {
  LayoutLoopHandle,
  LayoutLoopOptions,
  LayoutLoopStatus,
} from "./layout-loop";

const FORCE_ATLAS_SETTINGS = {
  // Stronger pull to origin so the blob settles instead of sliding as a pack
  gravity: 1,
  scalingRatio: 10,
  slowDown: 8,
  barnesHutOptimize: false,
  strongGravityMode: true,
  adjustSizes: false,
  linLogMode: false,
  outboundAttractionDistribution: false,
  edgeWeightInfluence: 1,
} as const;

/**
 * Pin the graph's center of mass at the origin after each FA2 batch.
 * Continuous FA2 can translate the whole component together (reads as
 * "everything drifts right/up"); relative motion is what we want for the spike.
 */
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

function cloneGraphData(source: GraphData): GraphData {
  return {
    nodes: source.nodes.map((n) => ({ ...n })),
    edges: source.edges.map((e) => ({ ...e })),
  };
}

function graphDataToGraphology(graphData: GraphData): GraphologyGraph {
  const simGraph = new GraphologyGraph({
    type: "undirected",
    multi: false,
    allowSelfLoops: false,
  });

  for (const node of graphData.nodes) {
    simGraph.addNode(node.id, {
      x: node.x,
      y: node.y,
      label: node.label,
    });
  }

  for (const edge of graphData.edges) {
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

  return simGraph;
}

/**
 * Write FA2 positions from simGraph back into latestGraphData nodes by id.
 * Only x/y — preserve rank, label, and other DTO fields.
 */
function syncPositionsFromSim(
  latestGraphData: GraphData,
  simGraph: GraphologyGraph
): void {
  for (const node of latestGraphData.nodes) {
    if (!simGraph.hasNode(node.id)) continue;
    const x = simGraph.getNodeAttribute(node.id, "x");
    const y = simGraph.getNodeAttribute(node.id, "y");
    node.x = typeof x === "number" ? x : 0;
    node.y = typeof y === "number" ? y : 0;
  }
}

export function createSimulationLayoutLoop(
  options: LayoutLoopOptions
): LayoutLoopHandle {
  const iterationsPerFrame = options.iterationsPerFrame ?? 2;
  const renderOnGraphData = options.renderOnGraphData;
  let status: LayoutLoopStatus = "idle";
  let animationFrameId: number | null = null;
  // Clone only — ranks are stored on nodes and ride along; FA2 only mutates x/y.
  let latestGraphData = cloneGraphData(
    options.graphData ?? createMockGraphData()
  );
  let simGraph = graphDataToGraphology(latestGraphData);

  function installGraphData(graphData: GraphData): void {
    latestGraphData = cloneGraphData(graphData);
    simGraph = graphDataToGraphology(latestGraphData);
  }

  function emitGraphData(): void {
    syncPositionsFromSim(latestGraphData, simGraph);
    renderOnGraphData?.(cloneGraphData(latestGraphData));
  }

  function runForceAtlasBatch(): void {
    if (simGraph.order >= 2) {
      forceAtlas2.assign(simGraph, {
        iterations: iterationsPerFrame,
        settings: { ...FORCE_ATLAS_SETTINGS },
      });
      recenterToOrigin(simGraph);
    }
    emitGraphData();
  }

  function onAnimationFrame(): void {
    if (status !== "running") return;
    runForceAtlasBatch();
    animationFrameId = requestAnimationFrame(onAnimationFrame);
  }

  function start(): void {
    if (status === "running") return;
    status = "running";
    // Emit current positions immediately so the first paint does not wait a frame;
    // rAF continues with FA2 batches after that.
    emitGraphData();
    animationFrameId = requestAnimationFrame(onAnimationFrame);
  }

  function stop(): void {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = null;
    status = "stopped";
  }

  return {
    start,
    stop,

    status(): LayoutLoopStatus {
      return status;
    },

    getGraphData(): GraphData {
      return cloneGraphData(latestGraphData);
    },

    /**
     * Swap in new topology/positions.
     *
     * Must not run FA2 on the old simGraph while installing, so we always
     * stop the rAF chain first. Remember whether we were running so we can
     * resume after install (stop() alone would leave the sim permanently off).
     *
     * - was running → stop → install → start (resume continuous layout)
     * - was idle/stopped → install → emit once (UI updates, no rAF)
     */
    setGraphData(graphData: GraphData): void {
      const wasSimulationRunning = status === "running";
      stop();
      installGraphData(graphData);
      if (wasSimulationRunning) {
        start();
      } else {
        emitGraphData();
      }
    },

    step(): void {
      // One FA2 batch — Node verify / no continuous rAF.
      runForceAtlasBatch();
    },
  };
}
