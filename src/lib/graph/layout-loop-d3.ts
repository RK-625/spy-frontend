/**
 * One-shot d3-force settle layout loop (Slice 1) + optional ambient (Slice 8).
 *
 * Loaded only via `createLayoutLoopAsync({ layoutEngine: "d3-settle" })`.
 * Static product path must NOT import this module (keeps d3-force out of the
 * default chunk).
 *
 * Placement: settle once on start / setGraphData, then idle (default).
 * Ambient (`ambientMotion: true` / `?motion=1`): after settle, continuous
 * low-alpha rAF ticks — separate from placement; default off.
 *
 * Emits `renderOnGraphData` with `movedNodeIds` + incident `dirtyEdges` when
 * positions change so Pixi can partial-merge DotStream.
 */

import {
  type GraphData,
  createMockGraphData,
} from "./graph-data";
import { incidentEdgeIds } from "./graph-diff";
import {
  buildForceSimulation,
  settleGraphData,
  type ForceSimLink,
  type ForceSimNode,
} from "./force-recipe";
import type {
  LayoutLoopHandle,
  LayoutLoopOptions,
  LayoutLoopStatus,
  LayoutRenderOptions,
} from "./layout-loop";
import type { Simulation } from "d3-force";

/** Ambient alpha target — subtle drift, not placement settle. */
const AMBIENT_ALPHA = 0.02;
const AMBIENT_ALPHA_DECAY = 0;
const AMBIENT_VELOCITY_DECAY = 0.6;

function cloneGraphData(source: GraphData): GraphData {
  return {
    nodes: source.nodes.map((n) => ({ ...n })),
    edges: source.edges.map((e) => ({ ...e })),
  };
}

function collectMovedNodeIds(
  before: GraphData,
  after: GraphData
): string[] {
  const prev = new Map(before.nodes.map((n) => [n.id, n]));
  const moved: string[] = [];
  for (const n of after.nodes) {
    const p = prev.get(n.id);
    if (!p) {
      moved.push(n.id);
      continue;
    }
    if (p.x !== n.x || p.y !== n.y) moved.push(n.id);
  }
  return moved;
}

function dirtyOptionsForMove(
  graph: GraphData,
  movedNodeIds: string[]
): LayoutRenderOptions | undefined {
  if (movedNodeIds.length === 0) return undefined;
  const dirtyEdges = incidentEdgeIds(graph, new Set(movedNodeIds));
  return {
    movedNodeIds,
    dirtyEdges: dirtyEdges.length > 0 ? dirtyEdges : "all",
  };
}

function writeSimPositions(
  graph: GraphData,
  nodes: ForceSimNode[]
): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const node of graph.nodes) {
    const sim = byId.get(node.id);
    if (!sim) continue;
    const x = sim.x;
    const y = sim.y;
    node.x = typeof x === "number" && Number.isFinite(x) ? x : 0;
    node.y = typeof y === "number" && Number.isFinite(y) ? y : 0;
  }
}

/**
 * Create a one-shot d3 settle layout loop (± opt-in ambient).
 * `start` / `setGraphData` run `settleGraphData` then emit; `step` re-settles
 * (verify) or advances one ambient tick when ambient is on.
 */
export function createD3SettleLayoutLoop(
  options: LayoutLoopOptions = {}
): LayoutLoopHandle {
  const renderOnGraphData = options.renderOnGraphData;
  const ambientMotion = options.ambientMotion === true;
  let status: LayoutLoopStatus = "idle";
  let latestGraphData = cloneGraphData(
    options.graphData ?? createMockGraphData()
  );
  let rafId: number | null = null;
  let ambientSim: Simulation<ForceSimNode, ForceSimLink> | null = null;
  let ambientNodes: ForceSimNode[] = [];

  function cancelAmbient(): void {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (ambientSim) {
      ambientSim.stop();
      ambientSim = null;
    }
    ambientNodes = [];
  }

  function emitSettled(before: GraphData, settled: GraphData, emitDirty: boolean): void {
    latestGraphData = settled;
    if (!renderOnGraphData) return;

    if (!emitDirty) {
      renderOnGraphData(cloneGraphData(settled));
      return;
    }

    const moved = collectMovedNodeIds(before, settled);
    const opts = dirtyOptionsForMove(settled, moved);
    renderOnGraphData(cloneGraphData(settled), opts);
  }

  function installAndSettle(input: GraphData, emitDirty: boolean): void {
    cancelAmbient();
    const before = cloneGraphData(input);
    const settled = settleGraphData(before);
    emitSettled(before, settled, emitDirty);

    if (ambientMotion && status === "running") {
      startAmbient();
    }
  }

  function ambientFrame(): void {
    rafId = null;
    if (status !== "running" || !ambientSim || ambientNodes.length === 0) {
      return;
    }

    const before = cloneGraphData(latestGraphData);
    ambientSim.alpha(AMBIENT_ALPHA).tick(1);
    writeSimPositions(latestGraphData, ambientNodes);

    const moved = collectMovedNodeIds(before, latestGraphData);
    if (moved.length > 0) {
      renderOnGraphData?.(
        cloneGraphData(latestGraphData),
        dirtyOptionsForMove(latestGraphData, moved)
      );
    }

    if (status === "running" && typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(ambientFrame);
    }
  }

  function startAmbient(): void {
    cancelAmbient();
    if (!ambientMotion) return;
    if (typeof requestAnimationFrame !== "function") return;

    const { simulation, nodes } = buildForceSimulation(latestGraphData);
    simulation
      .alpha(AMBIENT_ALPHA)
      .alphaDecay(AMBIENT_ALPHA_DECAY)
      .velocityDecay(AMBIENT_VELOCITY_DECAY)
      .stop();
    ambientSim = simulation;
    ambientNodes = nodes;
    rafId = requestAnimationFrame(ambientFrame);
  }

  return {
    start(): void {
      status = "running";
      // First paint: full install (host treats omitted dirty as full / diff).
      installAndSettle(latestGraphData, false);
      if (!ambientMotion) {
        status = "stopped";
      }
    },

    stop(): void {
      cancelAmbient();
      status = "stopped";
    },

    status(): LayoutLoopStatus {
      return status;
    },

    getGraphData(): GraphData {
      return cloneGraphData(latestGraphData);
    },

    setGraphData(graphData: GraphData): void {
      installAndSettle(graphData, true);
      if (!ambientMotion) {
        status = "stopped";
      }
    },

    step(): void {
      if (ambientMotion && ambientSim && ambientNodes.length > 0) {
        const before = cloneGraphData(latestGraphData);
        ambientSim.alpha(AMBIENT_ALPHA).tick(1);
        writeSimPositions(latestGraphData, ambientNodes);
        const moved = collectMovedNodeIds(before, latestGraphData);
        renderOnGraphData?.(
          cloneGraphData(latestGraphData),
          dirtyOptionsForMove(latestGraphData, moved)
        );
        return;
      }

      // Re-settle from current store (verify / manual tick).
      const before = cloneGraphData(latestGraphData);
      const settled = settleGraphData(before);
      latestGraphData = settled;
      const moved = collectMovedNodeIds(before, settled);
      renderOnGraphData?.(
        cloneGraphData(settled),
        dirtyOptionsForMove(settled, moved)
      );
    },
  };
}
