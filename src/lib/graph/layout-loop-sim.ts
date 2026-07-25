/**
 * Simulation layout path — Graphology + ForceAtlas2 + recenter + rAF.
 *
 * Loaded only via createLayoutLoopAsync when simulation is enabled
 * (dynamic import). Static default path never pulls this module or graphology
 * into the product chunk (verify/tests: createLayoutLoopAsync + simulationEnabled).
 *
 * LAYOUT_SIMULATION_ENABLED is currently false — this path is dead in product.
 * Enabling it does not change FA2 physics params (FORCE_ATLAS_SETTINGS).
 *
 * FA2 worker (landed, sim-only):
 * - When `typeof Worker !== "undefined"`, forceAtlas2.assign + recenter run in
 *   fa2-worker.ts; main applies positions on message and emits renderOnGraphData.
 * - Fail-open: worker construct/error → main-thread FA2 (same settings).
 * - Emit throttled via rAF chain; each position emit passes
 *   `{ dirtyEdges, movedNodeIds }` to renderOnGraphData for partial Pixi merge.
 * - First paint / topology install still omits options (host → "all").
 * - step() (verify) stays synchronous on main for deterministic tests.
 *
 * Do not enable LAYOUT_SIMULATION_ENABLED until product wants continuous layout
 * motion; enabling changes node positions over time (UI behavior, not style).
 * This module only preps dirty plumbing — product flag stays false.
 */

import GraphologyGraph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

import {
  type GraphData,
  createMockGraphData,
} from "./graph-data";
import { incidentEdgeIds } from "./graph-diff";
import type {
  LayoutLoopHandle,
  LayoutLoopOptions,
  LayoutLoopStatus,
  LayoutRenderOptions,
} from "./layout-loop";
import type {
  Fa2WorkerRequest,
  Fa2WorkerResponse,
  Fa2WorkerSettings,
} from "./fa2-worker";

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
} as const satisfies Fa2WorkerSettings;

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

function applyPositionsBuffer(
  latestGraphData: GraphData,
  nodeIds: string[],
  positions: Float32Array
): void {
  const byId = new Map(latestGraphData.nodes.map((n) => [n.id, n]));
  for (let i = 0; i < nodeIds.length; i++) {
    const node = byId.get(nodeIds[i]);
    if (!node) continue;
    node.x = positions[i * 2] ?? 0;
    node.y = positions[i * 2 + 1] ?? 0;
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

  // FA2 worker (optional) — fail-open to main-thread assign.
  let fa2Worker: Worker | null | undefined;
  let fa2Seq = 0;
  let fa2InFlight = false;
  let fa2MessageHandler:
    | ((ev: MessageEvent<Fa2WorkerResponse>) => void)
    | null = null;

  function getFa2Worker(): Worker | null {
    if (fa2Worker !== undefined) return fa2Worker;
    if (typeof Worker === "undefined") {
      fa2Worker = null;
      return null;
    }
    try {
      const w = new Worker(new URL("./fa2-worker.ts", import.meta.url), {
        type: "module",
      });
      fa2MessageHandler = (ev: MessageEvent<Fa2WorkerResponse>) => {
        const msg = ev.data;
        if (!msg || msg.type !== "step-result") return;
        if (msg.seq !== fa2Seq) return;
        fa2InFlight = false;
        applyPositionsBuffer(latestGraphData, msg.nodeIds, msg.positions);
        // Keep simGraph in sync for subsequent main-thread step() / install.
        for (let i = 0; i < msg.nodeIds.length; i++) {
          const id = msg.nodeIds[i];
          if (!simGraph.hasNode(id)) continue;
          simGraph.setNodeAttribute(id, "x", msg.positions[i * 2] ?? 0);
          simGraph.setNodeAttribute(id, "y", msg.positions[i * 2 + 1] ?? 0);
        }
        emitGraphDataFromSim(msg.nodeIds);
      };
      w.addEventListener("message", fa2MessageHandler);
      w.addEventListener("error", () => {
        // Permanent fail-open to main-thread FA2.
        try {
          if (fa2MessageHandler) {
            w.removeEventListener("message", fa2MessageHandler);
          }
          w.terminate();
        } catch {
          // ignore
        }
        fa2Worker = null;
        fa2InFlight = false;
      });
      fa2Worker = w;
      return w;
    } catch {
      fa2Worker = null;
      return null;
    }
  }

  function installGraphData(graphData: GraphData): void {
    latestGraphData = cloneGraphData(graphData);
    simGraph = graphDataToGraphology(latestGraphData);
  }

  /**
   * Emit positions to the host. When `movedIds` is provided (FA2 step result),
   * pass partial dirtyEdges + movedNodeIds so Pixi can rim-expand + partial bake.
   * Topology install / first paint omit options → host uses full dirty.
   */
  function emitGraphDataFromSim(movedIds?: readonly string[]): void {
    syncPositionsFromSim(latestGraphData, simGraph);
    const snap = cloneGraphData(latestGraphData);
    if (movedIds && movedIds.length > 0) {
      const movedSet = new Set(movedIds);
      const dirty = incidentEdgeIds(latestGraphData, movedSet);
      const opts: LayoutRenderOptions = {
        dirtyEdges: dirty,
        movedNodeIds: movedIds,
      };
      renderOnGraphData?.(snap, opts);
      return;
    }
    // No moved list: treat as full (first paint / install).
    renderOnGraphData?.(snap);
  }

  /** After main-thread FA2, every sim node may have moved. */
  function emitAllNodesMoved(): void {
    const ids = latestGraphData.nodes.map((n) => n.id);
    emitGraphDataFromSim(ids);
  }

  function runForceAtlasBatchMain(): void {
    if (simGraph.order >= 2) {
      forceAtlas2.assign(simGraph, {
        iterations: iterationsPerFrame,
        settings: { ...FORCE_ATLAS_SETTINGS },
      });
      recenterToOrigin(simGraph);
    }
    emitAllNodesMoved();
  }

  function runForceAtlasBatch(): void {
    const w = getFa2Worker();
    if (!w) {
      runForceAtlasBatchMain();
      return;
    }
    // Skip overlapping worker steps (rAF faster than FA2) — keep last result.
    if (fa2InFlight) return;

    fa2Seq += 1;
    const seq = fa2Seq;
    fa2InFlight = true;

    const nodes = latestGraphData.nodes.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
    }));
    // Prefer live simGraph positions if present.
    for (const n of nodes) {
      if (simGraph.hasNode(n.id)) {
        const x = simGraph.getNodeAttribute(n.id, "x");
        const y = simGraph.getNodeAttribute(n.id, "y");
        n.x = typeof x === "number" ? x : n.x;
        n.y = typeof y === "number" ? y : n.y;
      }
    }
    const edges = latestGraphData.edges.map((e) => ({
      source: e.source,
      target: e.target,
    }));

    const req: Fa2WorkerRequest = {
      type: "step",
      seq,
      nodes,
      edges,
      iterations: iterationsPerFrame,
      settings: { ...FORCE_ATLAS_SETTINGS },
    };
    w.postMessage(req);
  }

  function onAnimationFrame(): void {
    if (status !== "running") return;
    runForceAtlasBatch();
    animationFrameId = requestAnimationFrame(onAnimationFrame);
  }

  function start(): void {
    if (status === "running") return;
    status = "running";
    // First paint: no dirty options → host full bake (topology residency).
    emitGraphDataFromSim();
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
     */
    setGraphData(graphData: GraphData): void {
      const wasSimulationRunning = status === "running";
      stop();
      fa2InFlight = false;
      fa2Seq += 1; // invalidate in-flight worker results
      installGraphData(graphData);
      if (wasSimulationRunning) {
        start();
      } else {
        emitGraphDataFromSim();
      }
    },

    step(): void {
      // Synchronous one FA2 batch — Node verify / no continuous rAF.
      // Always main-thread so tests do not depend on Worker.
      runForceAtlasBatchMain();
    },
  };
}
