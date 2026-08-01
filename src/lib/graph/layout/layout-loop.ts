/**
 * Layout loop dispatcher — static store + one-shot d3 settle.
 *
 * Product host (`/graph`, live-only — `plans/graph-live-only-pivot.md`) always
 * uses `createLayoutLoopAsync({ layoutEngine: "d3-settle", ambientMotion: false })`.
 * That path dynamic-imports `layout-loop-d3.ts` (keeps d3-force out of the
 * static-only chunk used by verify/labs).
 *
 * Optional ambient: `ambientMotion: true` — continuous low-alpha ticks after
 * settle; product keeps this **off** (option only; no product URL flag).
 *
 * FA2 / graphology path removed (Slice 7). Engines are only `"static"` |
 * `"d3-settle"` — no continuous-sim soft-switch.
 *
 * API:
 * - createLayoutLoop() — sync; static store only. Throws for d3-settle.
 * - createLayoutLoopAsync() — dynamic-imports layout-loop-d3 when requested.
 */

import { type GraphData } from "../core/graph-data";

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
 * - `"static"` — passthrough store (verify/labs only; not product host)
 * - `"d3-settle"` — one-shot d3 settle on install/start ± optional ambient
 *   (product host always uses this with ambientMotion false)
 */
export type LayoutEngine = "static" | "d3-settle";

export type LayoutLoopOptions = {
  graphData?: GraphData;
  layoutEngine?: LayoutEngine;
  /** When true, keeps low-alpha rAF ticks after settle (default false). */
  ambientMotion?: boolean;
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
  setGraphData: (
    graphData: GraphData,
    options?: { settle?: boolean }
  ) => void;
  step: () => void;
};

function cloneGraphData(source: GraphData): GraphData {
  return {
    nodes: source.nodes.map((n) => ({ ...n })),
    edges: source.edges.map((e) => ({ ...e })),
  };
}

// ---------------------------------------------------------------------------
// Pure static store engine
// ---------------------------------------------------------------------------

export function createStaticLayoutLoop(
  options: LayoutLoopOptions = {}
): LayoutLoopHandle {
  const { renderOnGraphData } = options;
  let status: LayoutLoopStatus = "idle";
  let latestGraphData: GraphData = options.graphData
    ? cloneGraphData(options.graphData)
    : { nodes: [], edges: [] };

  function emitGraphData(): void {
    if (!renderOnGraphData) return;
    renderOnGraphData(cloneGraphData(latestGraphData));
  }

  return {
    start(): void {
      status = "running";
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
