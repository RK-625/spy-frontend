/**
 * Layout loop dispatcher — static store + opt-in one-shot d3 settle.
 *
 * Product default: static GraphData passthrough (no force).
 * Opt-in: `createLayoutLoopAsync({ layoutEngine: "d3-settle" })` dynamic-imports
 * `layout-loop-d3.ts` (keeps d3-force out of the default chunk).
 * Optional ambient: `ambientMotion: true` (or `/graph?motion=1`) — continuous
 * low-alpha ticks after settle; default off (Slice 8).
 *
 * FA2 / graphology path removed (Slice 7). Engines are only `"static"` |
 * `"d3-settle"` — no continuous-sim soft-switch.
 *
 * API:
 * - createLayoutLoop() — sync; static store only. Throws for d3-settle.
 * - createLayoutLoopAsync() — dynamic-imports layout-loop-d3 when requested.
 */

import {
  type GraphData,
  createMockGraphData,
} from "./graph-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayoutLoopStatus = "idle" | "running" | "stopped";

/**
 * Optional second arg for renderOnGraphData — position-only partial dirty.
 * Shape matches Pixi SetGraphDataOptions (kept local to avoid layout→renderer import).
 */
export type LayoutRenderOptions = {
  dirtyEdges?: "all" | Iterable<string>;
  movedNodeIds?: Iterable<string>;
};

/**
 * Layout engine selection for createLayoutLoopAsync.
 * - `"static"` — passthrough store (default product path)
 * - `"d3-settle"` — one-shot settle via layout-loop-d3 (+ optional ambient)
 */
export type LayoutEngine = "static" | "d3-settle";

export type LayoutLoopOptions = {
  /** Initial positions. */
  graphData?: GraphData;
  /**
   * One-shot settle engine (Slice 1). Default: `"static"`.
   * Requires createLayoutLoopAsync for `"d3-settle"`.
   */
  layoutEngine?: LayoutEngine;
  /**
   * Opt-in continuous ambient ticks after settle (Slice 8). Default false.
   * Only meaningful with layoutEngine `"d3-settle"`; ignored on static path.
   * Separate from placement settle — product default stays off (`?motion=1`).
   */
  ambientMotion?: boolean;
  /**
   * Receives a graph snapshot (+ optional dirty scope).
   * Static setGraphData emits the same object as the internal store (one clone);
   * consumers must not mutate it. Settle/ambient paths pass partial dirty when
   * positions move.
   */
  renderOnGraphData?: (
    graphData: GraphData,
    options?: LayoutRenderOptions
  ) => void;
};

/** Optional flags for setGraphData (d3-settle path). */
export type SetGraphDataOptions = {
  /**
   * When false, install poses without re-settling (warm placement-cache hit).
   * Default true for d3-settle (cold / force recompute). Ignored on static path.
   */
  settle?: boolean;
};

export type LayoutLoopHandle = {
  start: () => void;
  stop: () => void;
  status: () => LayoutLoopStatus;
  getGraphData: () => GraphData;
  setGraphData: (graphData: GraphData, options?: SetGraphDataOptions) => void;
  /** Synchronous one frame of layout (no rAF). Prefer for Node tests. */
  step: () => void;
};

// ---------------------------------------------------------------------------
// Static path — pure GraphData store (no d3-force)
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

    setGraphData(graphData: GraphData, _options?: SetGraphDataOptions): void {
      // One clone into the store; emit that same snapshot (no second clone).
      // Consumers must not mutate the object passed to renderOnGraphData.
      // Ranks are stored fields — not recomputed on install. settle option ignored (static).
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
 * - static engine → pure GraphData store (no heavy imports)
 * - d3-settle → throws; use createLayoutLoopAsync
 */
export function createLayoutLoop(
  options: LayoutLoopOptions = {}
): LayoutLoopHandle {
  const layoutEngine = options.layoutEngine ?? "static";
  if (layoutEngine === "d3-settle") {
    throw new Error(
      'createLayoutLoop: layoutEngine "d3-settle" requires createLayoutLoopAsync ' +
        "(dynamic import of layout-loop-d3)"
    );
  }
  return createStaticLayoutLoop(options);
}

/**
 * Creates a layout loop; dynamic-imports d3 settle only when requested.
 * - layoutEngine `"d3-settle"` → layout-loop-d3 (one-shot settle ± ambient)
 * - else → static store
 */
export async function createLayoutLoopAsync(
  options: LayoutLoopOptions = {}
): Promise<LayoutLoopHandle> {
  const layoutEngine = options.layoutEngine ?? "static";

  if (layoutEngine === "d3-settle") {
    const { createD3SettleLayoutLoop } = await import("./layout-loop-d3");
    return createD3SettleLayoutLoop(options);
  }

  return createStaticLayoutLoop(options);
}
