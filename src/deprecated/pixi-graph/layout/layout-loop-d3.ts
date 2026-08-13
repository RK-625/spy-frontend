/**
 * Product graph paint store (filename legacy: layout-loop-d3).
 *
 * No d3-force / force-recipe import — settle lives in placement/force-recipe
 * via placeTopology. Dynamic-imported by `/graph` host so placement d3 stays
 * out of the static host chunk until needed.
 *
 * Product path: only `setGraph` + `stop`.
 *   setGraph(graph) replaces the paint store (clone) and emits full GraphData
 *   via renderOnGraphData — poses come from placeTopology (hit/miss + settle
 *   owned by placement; this store never settles, no ambient layout).
 *
 * Always emits full GraphData via `renderOnGraphData`.
 * One deep clone per setGraph store update; emit shares that snapshot
 * (product renderer treats GraphData as read-only).
 * Ambient continuous layout: not present (stop is a no-op for lifecycle symmetry).
 */

import { cloneGraphData, type GraphData } from "../core/graph-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayoutLoopOptions = {
  graphData?: GraphData;
  renderOnGraphData?: (graphData: GraphData) => void;
};

/** Minimal paint handle — product host uses setGraph / stop only. */
export type LayoutLoopHandle = {
  /** Replace paint store (clone) and emit full GraphData via renderOnGraphData. */
  setGraph: (graphData: GraphData) => void;
  /** Lifecycle symmetry / dispose; no ambient timers to tear down. */
  stop: () => void;
};

// ---------------------------------------------------------------------------
// Product entry
// ---------------------------------------------------------------------------

export function createGraphPaintLoop(
  options: LayoutLoopOptions = {}
): LayoutLoopHandle {
  const { renderOnGraphData } = options;

  let latestGraphData: GraphData = options.graphData
    ? cloneGraphData(options.graphData)
    : { nodes: [], edges: [] };

  return {
    setGraph(graphData: GraphData): void {
      latestGraphData = cloneGraphData(graphData);
      renderOnGraphData?.(latestGraphData);
    },

    stop(): void {
      // no ambient timers / simulation to tear down
    },
  };
}
