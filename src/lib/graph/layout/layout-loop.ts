/**
 * Layout loop — product-only d3 one-shot settle via async dynamic import.
 *
 * Production always uses:
 *   createLayoutLoopAsync({ graphData, renderOnGraphData })
 *     → dynamic import ./layout-loop-d3
 *     → createD3SettleLayoutLoop(options)
 *     → setGraphData(g, { settle: needsLayout })
 *
 * No static engine, no ambient motion, no sync factory. Keeps d3-force out of
 * the main layout-loop chunk until the product host awaits this module.
 * renderOnGraphData receives full GraphData only (no partial-dirty opts).
 */

import { type GraphData } from "../core/graph-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayoutLoopStatus = "idle" | "running" | "stopped";

export type LayoutLoopOptions = {
  graphData?: GraphData;
  renderOnGraphData?: (graphData: GraphData) => void;
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
};

// ---------------------------------------------------------------------------
// Product entry
// ---------------------------------------------------------------------------

/**
 * Creates the product layout loop (one-shot d3 settle).
 * Always dynamic-imports layout-loop-d3 so d3-force stays out of the static chunk.
 */
export async function createLayoutLoopAsync(
  options: LayoutLoopOptions = {}
): Promise<LayoutLoopHandle> {
  const { createD3SettleLayoutLoop } = await import("./layout-loop-d3");
  return createD3SettleLayoutLoop(options);
}
