/**
 * Product graph paint store (filename legacy: layout-loop-d3).
 *
 * No d3-force / force-recipe import — settle lives in placement/force-recipe
 * via placeTopology. Dynamic-imported by `/graph` host so placement d3 stays
 * out of the static host chunk until needed.
 *
 * Product path:
 *   start() paints the empty/initial graph store;
 *   setGraphData(graph) paints poses from placeTopology (hit/miss + settle
 *   owned by placement — this loop never settles).
 *
 * Always emits full GraphData via `renderOnGraphData`.
 * One deep clone per setGraphData/start store update; emit shares that snapshot
 * (product renderer treats GraphData as read-only).
 * Ambient continuous layout: not present (stop is a no-op).
 */

import { cloneGraphData, type GraphData } from "../core/graph-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayoutLoopOptions = {
  graphData?: GraphData;
  renderOnGraphData?: (graphData: GraphData) => void;
};

/** Minimal paint handle — product host uses start / setGraphData / stop only. */
export type LayoutLoopHandle = {
  start: () => void;
  stop: () => void;
  setGraphData: (graphData: GraphData) => void;
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
    start(): void {
      renderOnGraphData?.(latestGraphData);
    },

    stop(): void {
      // no ambient timers / simulation to tear down
    },

    setGraphData(graphData: GraphData): void {
      latestGraphData = cloneGraphData(graphData);
      renderOnGraphData?.(latestGraphData);
    },
  };
}
