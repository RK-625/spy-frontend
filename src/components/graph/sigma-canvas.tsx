"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import forceAtlas2 from "graphology-layout-forceatlas2";
import Sigma from "sigma";
import { createEdgeArrowProgram, drawDiscNodeHover } from "sigma/rendering";

import { buildLayoutGraph, POINT_COLOR } from "@/lib/graph-functions";
import { useGraphTopology } from "@/contexts/GraphTopologyContext";

import { Editor } from "./editor/editor";

/** Deepest register — same family as former GRAPH_BG (0x0a0a0c). */
const GRAPH_BG = "#0a0a0c";
/** PARENT_OF heads only — 4× Sigma default (2.5 / 2). Shaft stays EDGE_SIZE. */
const PARENT_ARROW_PROGRAM = createEdgeArrowProgram({
  lengthToThicknessRatio: 10,
  widenessToThicknessRatio: 8,
});
/** Live FA2 budget: 360 steps × 2/frame ≈ 180 frames (~3s at 60fps). */
const FA2_ITERATIONS = 360;
const FA2_STEPS_PER_FRAME = 2;

/** Sigma `resize()`/`refresh()` throw when the host has no layout box. */
function hostHasPositiveBox(host: HTMLElement): boolean {
  const { width, height } = host.getBoundingClientRect();
  return (
    width > 0 &&
    height > 0 &&
    host.offsetWidth > 0 &&
    host.offsetHeight > 0
  );
}

/**
 * Live-only knowledge graph host (graphology FA2 + Sigma).
 * Shared topology feed → circle seed → Sigma draw + live FA2 (rAF).
 * Empty KB / initial fetch error → blank canvas (no mock).
 */
export function SigmaCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const { topology } = useGraphTopology();
  const memoriesById = useMemo(
    () => new Map(topology?.memories.map((memory) => [memory.id, memory])),
    [topology],
  );
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const selectedNode = selectedMemoryId === null
    ? null : memoriesById.get(selectedMemoryId) ?? null;

  if (topology !== null && selectedMemoryId !== null && selectedNode === null) {
    setSelectedMemoryId(null);
  }

  useEffect(() => {
    const host = hostRef.current;
    if (host == null || topology == null || topology.memories.length === 0) return;

    let cancelled = false;
    let renderer: Sigma | null = null;
    let fa2Frame = 0;

    const mount = () => {
      if (cancelled || renderer != null) return;
      if (!hostHasPositiveBox(host)) return;

      const graph = buildLayoutGraph(topology.memories, topology.links);
      const instance = new Sigma(graph, host, {
        defaultNodeColor: POINT_COLOR,
        renderLabels: false,
        defaultDrawNodeHover: (context, data, settings) =>
          drawDiscNodeHover(context, { ...data, label: null }, settings),
        itemSizesReference: "screen",
        minEdgeThickness: 0,
        autoRescale: true,
        autoCenter: true,
        minCameraRatio: 0.3,
        defaultEdgeType: "line",
        edgeProgramClasses: { arrow: PARENT_ARROW_PROGRAM },
        allowInvalidContainer: false,
      });
      instance.on("clickNode", ({ node }) => {
        const memory = memoriesById.get(node);
        if (memory == null) return;
        setSelectedMemoryId(memory.id);
      });
      renderer = instance;

      const fa2Settings = {
        ...forceAtlas2.inferSettings(graph),
        adjustSizes: true,
        edgeWeightInfluence: 1,
      };
      let remaining = FA2_ITERATIONS;

      const stepFa2 = () => {
        if (cancelled || remaining <= 0) return;
        if (hostHasPositiveBox(host)) {
          const iterations = Math.min(FA2_STEPS_PER_FRAME, remaining);
          forceAtlas2.assign(graph, {
            iterations,
            getEdgeWeight: "weight",
            settings: fa2Settings,
          });
          instance.refresh();
          remaining -= iterations;
        }
        if (remaining > 0) {
          fa2Frame = requestAnimationFrame(stepFa2);
        }
      };
      fa2Frame = requestAnimationFrame(stepFa2);
    };

    const syncSigmaToHostBox = () => {
      if (cancelled) return;
      if (renderer != null) {
        if (!hostHasPositiveBox(host)) return;
        renderer.resize();
        renderer.refresh();
        return;
      }
      mount();
    };

    syncSigmaToHostBox();
    const observer = new ResizeObserver(syncSigmaToHostBox);
    observer.observe(host);

    return () => {
      cancelled = true;
      cancelAnimationFrame(fa2Frame);
      observer.disconnect();
      renderer?.kill();
    };
  }, [topology, memoriesById]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-text-primary">
      <div
        ref={hostRef}
        className="absolute inset-0"
        style={{ background: GRAPH_BG }}
        aria-label="Knowledge graph canvas. Click a node to inspect. Drag to pan, wheel to zoom."
      />

      {selectedNode ? (
        <Editor
          key={selectedNode.id}
          node={selectedNode}
          onClose={() => setSelectedMemoryId(null)}
        />
      ) : null}

      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-3 sm:p-4"
        style={{ fontFamily: "var(--font-vt323), ui-monospace, monospace" }}
      >
        <div className="pointer-events-none max-w-[min(100%,20rem)] select-none">
          <div className="text-[15px] tracking-wide text-text-primary">
            Spy graph
          </div>
          <div className="mt-1 text-[11px] leading-snug tracking-wide text-text-dim">
            Click a node · drag to pan · wheel to zoom
          </div>
        </div>
      </header>
    </div>
  );
}
