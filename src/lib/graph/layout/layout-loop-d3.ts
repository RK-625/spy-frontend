/**
 * One-shot d3-force settle layout loop (product engine).
 *
 * Loaded only via `createLayoutLoopAsync` (dynamic import from layout-loop.ts).
 * Product `/graph`: start() paints the seed store (usually empty) without
 * settling; live `setGraphData(g, { settle: needsLayout })` does one-shot
 * settle when needed, then status → "stopped". No ambient motion.
 *
 * Always emits full GraphData via `renderOnGraphData` (no partial dirty opts —
 * product host paints full setGraphData).
 */

import { type GraphData } from "../core/graph-data";
import { settleGraphData } from "../placement/force-recipe";
import type {
  LayoutLoopHandle,
  LayoutLoopOptions,
  LayoutLoopStatus,
} from "./layout-loop";

function cloneGraphData(source: GraphData): GraphData {
  return {
    nodes: source.nodes.map((n) => ({ ...n })),
    edges: source.edges.map((e) => ({ ...e })),
  };
}

export function createD3SettleLayoutLoop(
  options: LayoutLoopOptions = {}
): LayoutLoopHandle {
  const { renderOnGraphData } = options;

  let status: LayoutLoopStatus = "idle";
  let latestGraphData: GraphData = options.graphData
    ? cloneGraphData(options.graphData)
    : { nodes: [], edges: [] };

  return {
    start(): void {
      status = "running";
      // Paint seed only — product settles via setGraphData({ settle: needsLayout }).
      latestGraphData = cloneGraphData(latestGraphData);
      renderOnGraphData?.(cloneGraphData(latestGraphData));
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

    setGraphData(
      graphData: GraphData,
      options?: { settle?: boolean }
    ): void {
      const doSettle = options?.settle !== false;
      // settleGraphData clones internally; no-settle clones once into the store.
      const next = doSettle
        ? settleGraphData(graphData)
        : cloneGraphData(graphData);
      latestGraphData = next;
      // Defensive emit clone so host/renderer cannot mutate the store.
      renderOnGraphData?.(cloneGraphData(next));
      status = "stopped";
    },
  };
}
