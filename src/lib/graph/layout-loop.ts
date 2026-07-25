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
 * Graphology / FA2 live only in `layout-loop-sim.ts`. The product static path
 * must NOT pull that module (or graphology) into the default chunk — sim is
 * loaded only via dynamic import when simulationEnabled is true.
 *
 * Naming: GraphData = plain DTO; GraphologyGraph = library simulation instance.
 *
 * --- FA2 off main thread (when LAYOUT_SIMULATION_ENABLED is true) ---
 * Implemented in layout-loop-sim + fa2-worker.ts:
 *   1. Main posts { type: "step", nodes, edges, iterations, settings } to fa2-worker.
 *   2. Worker runs forceAtlas2.assign + recenter; posts positions Float32Array.
 *   3. Main writes x/y into GraphData and calls renderOnGraphData (rAF-paced).
 *   4. Pixi: setGraphData with dirtyEdges + movedNodeIds from sim emit
 *      (renderOnGraphData second arg) for partial DotStream merge.
 * LAYOUT_SIMULATION_ENABLED remains false in product — enabling changes motion.
 * step() stays sync on main for verify.
 *
 * API:
 * - createLayoutLoop() — sync; always static store when simulation is off
 *   (product path). If simulationEnabled is true, throws — use createLayoutLoopAsync.
 * - createLayoutLoopAsync() — dynamic-imports layout-loop-sim when simulation on.
 */

import {
  type GraphData,
  createMockGraphData,
} from "./graph-data";

// ---------------------------------------------------------------------------
// Flag + types
// ---------------------------------------------------------------------------

/**
 * Soft switch — flip to `true` to restore continuous FA2.
 * Keep the rest of this module intact; do not hard-delete FA2 paths.
 * Product must keep this false (static path must not load graphology).
 */
export const LAYOUT_SIMULATION_ENABLED = false;

export type LayoutLoopStatus = "idle" | "running" | "stopped";

/**
 * Optional second arg for renderOnGraphData — position-only partial dirty.
 * Shape matches Pixi SetGraphDataOptions (kept local to avoid layout→renderer import).
 * Sim path passes dirtyEdges + movedNodeIds after FA2; static first paint
 * omits options (host treats as full / uses diffGraphDirty).
 */
export type LayoutRenderOptions = {
  dirtyEdges?: "all" | Iterable<string>;
  movedNodeIds?: Iterable<string>;
};

export type LayoutLoopOptions = {
  /** Initial positions; sim path owns a mutable GraphologyGraph for FA2. */
  graphData?: GraphData;
  /** FA2 iterations per frame / step. Default 2. Sim path only. */
  iterationsPerFrame?: number;
  /**
   * Override module soft-disable for this instance only.
   * Default: LAYOUT_SIMULATION_ENABLED.
   * When true, callers must use createLayoutLoopAsync (dynamic sim load).
   */
  simulationEnabled?: boolean;
  /**
   * Receives a graph snapshot (+ optional dirty scope).
   * Static setGraphData emits the same object as the internal store (one clone);
   * consumers must not mutate it. Sim path passes partial dirty when positions move.
   */
  renderOnGraphData?: (
    graphData: GraphData,
    options?: LayoutRenderOptions
  ) => void;
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
 * Creates a layout loop (sync). Product / static path only:
 * - simulation off → pure GraphData store (no Graphology / FA2, no sim import)
 * - simulation on  → throws; use createLayoutLoopAsync so layout-loop-sim
 *   loads only when needed (keeps graphology out of the default module graph)
 */
export function createLayoutLoop(
  options: LayoutLoopOptions = {}
): LayoutLoopHandle {
  const simulationEnabled =
    options.simulationEnabled ?? LAYOUT_SIMULATION_ENABLED;
  if (!simulationEnabled) {
    return createStaticLayoutLoop(options);
  }
  throw new Error(
    "createLayoutLoop: simulationEnabled requires createLayoutLoopAsync " +
      "(dynamic import of layout-loop-sim / graphology)"
  );
}

/**
 * Creates a layout loop; dynamic-imports layout-loop-sim only when simulation
 * is enabled. Prefer this for tests / tools that pass simulationEnabled: true.
 * Static product callers can keep using createLayoutLoop (sync).
 */
export async function createLayoutLoopAsync(
  options: LayoutLoopOptions = {}
): Promise<LayoutLoopHandle> {
  const simulationEnabled =
    options.simulationEnabled ?? LAYOUT_SIMULATION_ENABLED;
  if (!simulationEnabled) {
    return createStaticLayoutLoop(options);
  }
  const { createSimulationLayoutLoop } = await import("./layout-loop-sim");
  return createSimulationLayoutLoop(options);
}
