/**
 * Product graph paint store (layout-loop).
 *
 * Dynamic-imported by `/graph` host so d3-force stays out of the static chunk
 * of unrelated modules (this file does not import force-recipe).
 *
 * Product path:
 *   start() paints the empty/initial graph store;
 *   setGraphData(graph) paints poses from placeTopology (hit/miss + settle
 *   owned by placement — this loop never settles).
 *
 * Always emits full GraphData via `renderOnGraphData`.
 * One deep clone per setGraphData/start store update; emit shares that snapshot
 * (product renderer treats GraphData as read-only).
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
