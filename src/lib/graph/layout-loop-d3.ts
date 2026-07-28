/**
 * One-shot d3-force settle layout loop (Slice 1).
 *
 * Loaded only via `createLayoutLoopAsync({ layoutEngine: "d3-settle" })`.
 * Static product path must NOT import this module (keeps d3-force out of the
 * default chunk). Not continuous ambient motion — settle once on start /
 * setGraphData, then idle.
 *
 * Emits `renderOnGraphData` with `movedNodeIds` + incident `dirtyEdges` when
 * positions change so Pixi can partial-merge DotStream.
 */

import {
  type GraphData,
  createMockGraphData,
} from "./graph-data";
import { incidentEdgeIds } from "./graph-diff";
import { settleGraphData } from "./force-recipe";
import type {
  LayoutLoopHandle,
  LayoutLoopOptions,
  LayoutLoopStatus,
  LayoutRenderOptions,
} from "./layout-loop";

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
  const prev = new Map(before.nodes.map((n) => [n.id, n]));
  const moved: string[] = [];
  for (const n of after.nodes) {
    const p = prev.get(n.id);
    if (!p) {
      moved.push(n.id);
      continue;
    }
    if (p.x !== n.x || p.y !== n.y) moved.push(n.id);
  }
  return moved;
}

function dirtyOptionsForMove(
  graph: GraphData,
  movedNodeIds: string[]
): LayoutRenderOptions | undefined {
  if (movedNodeIds.length === 0) return undefined;
  const dirtyEdges = incidentEdgeIds(graph, new Set(movedNodeIds));
  return {
    movedNodeIds,
    dirtyEdges: dirtyEdges.length > 0 ? dirtyEdges : "all",
  };
}

/**
 * Create a one-shot d3 settle layout loop.
 * `start` / `setGraphData` run `settleGraphData` then emit; `step` re-emits.
 */
export function createD3SettleLayoutLoop(
  options: LayoutLoopOptions = {}
): LayoutLoopHandle {
  const renderOnGraphData = options.renderOnGraphData;
  let status: LayoutLoopStatus = "idle";
  let latestGraphData = cloneGraphData(
    options.graphData ?? createMockGraphData()
  );

  function installAndSettle(input: GraphData, emitDirty: boolean): void {
    const before = cloneGraphData(input);
    const settled = settleGraphData(before);
    latestGraphData = settled;

    if (!renderOnGraphData) return;

    if (!emitDirty) {
      renderOnGraphData(cloneGraphData(settled));
      return;
    }

    const moved = collectMovedNodeIds(before, settled);
    const opts = dirtyOptionsForMove(settled, moved);
    renderOnGraphData(cloneGraphData(settled), opts);
  }

  return {
    start(): void {
      // First paint: full install (host treats omitted dirty as full / diff).
      installAndSettle(latestGraphData, false);
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
      installAndSettle(graphData, true);
    },

    step(): void {
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
