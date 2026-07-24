/**
 * Continuous ForceAtlas2 layout loop (single graph, world coordinates).
 *
 * Mock data currently lives near the origin, so FA2 can run on absolute x/y.
 * When multi-scale clusters return, reintroduce local-offset layout if needed.
 *
 * Soft-disable: set LAYOUT_SIMULATION_ENABLED to true to re-enable continuous FA2.
 * When false, createLayoutLoop branches to a pure GraphData store (no Graphology,
 * no FA2) so positions stay at mock/setGraphData values.
 *
 * Graphology / FA2 live only in `layout-loop-sim.ts` so the static default path
 * has no top-level graphology import in this file. The sim module is still
 * statically imported for a sync createLayoutLoop API (verify uses step()).
 *
 * Naming: GraphData = plain DTO; GraphologyGraph = library simulation instance.
 */

import {
  type GraphData,
  createMockGraphData,
} from "./graph-data";
import { createSimulationLayoutLoop } from "./layout-loop-sim";

// ---------------------------------------------------------------------------
// Flag + types
// ---------------------------------------------------------------------------

/**
 * Soft switch — flip to `true` to restore continuous FA2.
 * Keep the rest of this module intact; do not hard-delete FA2 paths.
 */
export const LAYOUT_SIMULATION_ENABLED = false;

export type LayoutLoopStatus = "idle" | "running" | "stopped";

export type LayoutLoopOptions = {
  /** Initial positions; sim path owns a mutable GraphologyGraph for FA2. */
  graphData?: GraphData;
  /** FA2 iterations per frame / step. Default 2. Sim path only. */
  iterationsPerFrame?: number;
  /**
   * Override module soft-disable for this instance only.
   * Default: LAYOUT_SIMULATION_ENABLED.
   */
  simulationEnabled?: boolean;
  /**
   * Receives a graph snapshot. Static setGraphData emits the same object as
   * the internal store (one clone); consumers must not mutate it.
   */
  renderOnGraphData?: (graphData: GraphData) => void;
};

export type LayoutLoopHandle = {
  start: () => void;
  stop: () => void;
  status: () => LayoutLoopStatus;
  getGraphData: () => GraphData;
  setGraphData: (graphData: GraphData) => void;
  /** Synchronous one frame of layout (no rAF). Prefer for Node tests. */
  step: () => void;
};

// ---------------------------------------------------------------------------
// Static path — pure GraphData store (no Graphology, no FA2)
// ---------------------------------------------------------------------------

function cloneGraphData(source: GraphData): GraphData {
  return {
    nodes: source.nodes.map((n) => ({ ...n })),
    edges: source.edges.map((e) => ({ ...e })),
  };
}

function createStaticLayoutLoop(
  options: LayoutLoopOptions
): LayoutLoopHandle {
  const renderOnGraphData = options.renderOnGraphData;
  let status: LayoutLoopStatus = "idle";
  // Clone only — ranks are stored on nodes and ride along.
  let latestGraphData = cloneGraphData(
    options.graphData ?? createMockGraphData()
  );

  function emitGraphData(): void {
    // Clone so start/step snapshots are isolated from later setGraphData.
    renderOnGraphData?.(cloneGraphData(latestGraphData));
  }

  return {
    start(): void {
      emitGraphData();
      status = "stopped";
    },

    stop(): void {
      status = "stopped";
    },

    status(): LayoutLoopStatus {
      return status;
    },

    getGraphData(): GraphData {
      return cloneGraphData(latestGraphData);
    },

    setGraphData(graphData: GraphData): void {
      // One clone into the store; emit that same snapshot (no second clone).
      // Consumers must not mutate the object passed to renderOnGraphData.
      // Ranks are stored fields — not recomputed on install.
      const snap = cloneGraphData(graphData);
      latestGraphData = snap;
      renderOnGraphData?.(snap);
    },

    step(): void {
      // No position change — emit current snapshot only.
      emitGraphData();
    },
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Creates a layout loop. Branches early:
 * - simulation off → pure GraphData store (no Graphology / FA2)
 * - simulation on  → Graphology + ForceAtlas2 + rAF (`layout-loop-sim`)
 */
export function createLayoutLoop(
  options: LayoutLoopOptions = {}
): LayoutLoopHandle {
  const simulationEnabled =
    options.simulationEnabled ?? LAYOUT_SIMULATION_ENABLED;
  if (!simulationEnabled) {
    return createStaticLayoutLoop(options);
  }
  return createSimulationLayoutLoop(options);
}
