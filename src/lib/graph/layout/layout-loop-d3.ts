/**
 * One-shot d3-force settle layout loop (Slice 1) + optional ambient (Slice 8).
 *
 * Loaded only via `createLayoutLoopAsync({ layoutEngine: "d3-settle" })`.
 * Product `/graph` always uses this engine with `ambientMotion: false`
 * (`plans/graph-live-only-pivot.md`). Static verify/lab path must NOT import
 * this module (keeps d3-force out of the static-only chunk).
 *
 * Placement: settle once on start / setGraphData, then idle (default).
 * Ambient (`ambientMotion: true` option only): after settle, continuous
 * low-alpha rAF ticks — separate from placement; product keeps ambient off
 * (no URL flag).
 *
 * Emits `renderOnGraphData` with `movedNodeIds` + incident `dirtyEdges` when
 * positions change so Pixi can partial-merge DotStream.
 */

import { type GraphData } from "../core/graph-data";
import { incidentEdgeIds } from "../core/graph-diff";
import {
  buildForceSimulation,
  settleGraphData,
  type ForceSimLink,
  type ForceSimNode,
} from "../placement/force-recipe";
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
  const byId = new Map(before.nodes.map((n) => [n.id, n]));
  const moved: string[] = [];
  for (const n of after.nodes) {
    const prev = byId.get(n.id);
    if (!prev) {
      moved.push(n.id);
      continue;
    }
    if (Math.abs(n.x - prev.x) > 1e-4 || Math.abs(n.y - prev.y) > 1e-4) {
      moved.push(n.id);
    }
  }
  return moved;
}

function dirtyOptionsForMove(
  graph: GraphData,
  movedNodeIds: string[]
): LayoutRenderOptions {
  if (movedNodeIds.length === 0) {
    return { dirtyEdges: [], movedNodeIds: [] };
  }
  const incident = incidentEdgeIds(graph, new Set(movedNodeIds));
  return {
    dirtyEdges: incident,
    movedNodeIds,
  };
}

function writeSimPositions(
  target: GraphData,
  simNodes: ForceSimNode[]
): void {
  const byId = new Map(simNodes.map((n) => [n.id, n]));
  for (const n of target.nodes) {
    const s = byId.get(n.id);
    if (!s) continue;
    const x = typeof s.x === "number" && Number.isFinite(s.x) ? s.x : 0;
    const y = typeof s.y === "number" && Number.isFinite(s.y) ? s.y : 0;
    n.x = x;
    n.y = y;
  }
}

export function createD3SettleLayoutLoop(
  options: LayoutLoopOptions = {}
): LayoutLoopHandle {
  const { renderOnGraphData, ambientMotion = false } = options;

  let status: LayoutLoopStatus = "idle";
  let latestGraphData: GraphData = options.graphData
    ? cloneGraphData(options.graphData)
    : { nodes: [], edges: [] };

  let ambientSim: Simulation<ForceSimNode, ForceSimLink> | null = null;
  let ambientNodes: ForceSimNode[] = [];
  let ambientRafId: number | null = null;

  function cancelAmbient(): void {
    if (ambientRafId !== null) {
      cancelAnimationFrame(ambientRafId);
      ambientRafId = null;
    }
    if (ambientSim) {
      ambientSim.stop();
      ambientSim = null;
    }
    ambientNodes = [];
  }

  function startAmbientIfNeeded(graph: GraphData): void {
    cancelAmbient();
    if (!ambientMotion || graph.nodes.length < 2) return;

    const { simulation, nodes } = buildForceSimulation(graph, {
      centerStrength: 0.015,
    });
    ambientSim = simulation;
    ambientNodes = nodes;
    ambientSim
      .alpha(AMBIENT_ALPHA)
      .alphaDecay(AMBIENT_ALPHA_DECAY)
      .velocityDecay(AMBIENT_VELOCITY_DECAY)
      .restart();

    scheduleAmbientTick();
  }

  function scheduleAmbientTick(): void {
    if (!ambientMotion || !ambientSim) return;

    const ambientFrame = () => {
      ambientRafId = null;
      if (status !== "running" || !ambientSim) return;

      const before = cloneGraphData(latestGraphData);
      ambientSim.tick(1);
      writeSimPositions(latestGraphData, ambientNodes);
      const moved = collectMovedNodeIds(before, latestGraphData);

      if (moved.length > 0) {
        renderOnGraphData?.(
          cloneGraphData(latestGraphData),
          dirtyOptionsForMove(latestGraphData, moved)
        );
      }
      ambientRafId = requestAnimationFrame(ambientFrame);
    };

    ambientRafId = requestAnimationFrame(ambientFrame);
  }

  function installAndSettle(
    graph: GraphData,
    isUpdate = false,
    doSettle = true
  ): void {
    cancelAmbient();
    const input = cloneGraphData(graph);

    if (doSettle) {
      const before = cloneGraphData(input);
      const settled = settleGraphData(input);
      latestGraphData = settled;
      const moved = collectMovedNodeIds(before, settled);

      if (!isUpdate || moved.length > 0) {
        renderOnGraphData?.(
          cloneGraphData(settled),
          isUpdate ? dirtyOptionsForMove(settled, moved) : undefined
        );
      }
    } else {
      latestGraphData = input;
      renderOnGraphData?.(cloneGraphData(input));
    }

    if (ambientMotion && status === "running") {
      startAmbientIfNeeded(latestGraphData);
    }
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

    setGraphData(
      graphData: GraphData,
      options?: { settle?: boolean }
    ): void {
      const doSettle = options?.settle !== false;
      installAndSettle(graphData, true, doSettle);
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
