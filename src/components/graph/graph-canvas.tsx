"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cosmograph,
  prepareCosmographData,
  type CosmographConfig,
  type CosmographData,
  type CosmographDataPrepResult,
  type CosmographRef,
} from "@cosmograph/react";

import {
  findNodeColors,
  findNodeRanks,
  findNodeSizes,
} from "@/lib/graph-functions";
import type { MemoryNode } from "@/types/graph-schema";
import type { GraphApiResponse } from "@/types/graph-topology";
import { NodeDetailDialog } from "./node-detail-dialog";

/** Deepest register — same family as former GRAPH_BG (0x0a0a0c). */
const GRAPH_BG = "#0a0a0c";
const POINT_COLOR = "#c8acfb";
const LINK_PARENT_OF = "#8a96b4";
const LINK_RELATES = "#9a7ab8";
const LINK_PARENT_OF_STRENGTH = 1;
const LINK_RELATES_STRENGTH = 0.05;
// Width left to Cosmograph (`linkDefaultWidth`, typically 1).
// const LINK_PARENT_OF_WIDTH = 0.8;
// const LINK_RELATES_WIDTH = 0.35;

/**
 * Live-only knowledge graph host (Cosmograph).
 * GET `/api/graph` → prepare points/links → Cosmograph owns layout + camera + draw.
 * Empty KB / fetch error → blank canvas (no mock).
 */
export function GraphCanvas() {
  const cosmographRef = useRef<CosmographRef>(undefined);
  const memoriesByIdRef = useRef<Map<string, MemoryNode>>(new Map());
  const [preparedGraph, setPreparedGraph] = useState<
    CosmographDataPrepResult<CosmographData> | null
  >(null);
  const [selectedNode, setSelectedNode] = useState<MemoryNode | null>(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const handlePointClick = useCallback((index: number | undefined) => {
    if (index == null) return;
    const instance = cosmographRef.current;
    if (instance == null) return;

    void instance.getPointIdsByIndices([index]).then((ids) => {
      const id = ids?.[0];
      if (id == null) return;
      const memory = memoriesByIdRef.current.get(id);
      if (memory == null) return;
      setSelectedNode(memory);
      setNodeDialogOpen(true);
    });
  }, []);
  // extra configurations for the cosmograph instance
  const cosmographExtras = useMemo(
    (): Partial<CosmographConfig> => ({
      enableSimulation: true,
      backgroundColor: GRAPH_BG,
      pointDefaultColor: POINT_COLOR,
      pointColorBy: "color",
      pointColorStrategy: "direct",
      pointSizeBy: "size",
      pointSizeStrategy: "direct",
      // Fit-zoom on a small graph multiplies world sizes. Keep both
      // points and links in screen pixels (cosmos defaults: false).
      scalePointsOnZoom: false,
      scaleLinksOnZoom: false,
      hoveredPointCursor: "pointer",
      pointLabelBy: "label",
      showDynamicLabels: true,
      showHoveredPointLabel: true,
      renderHoveredPointRing: true,
      hoveredPointRingColor: "#e8dff8",
      selectPointOnClick: false,
      focusPointOnClick: false,
      focusPointOnLabelClick: false,
      linkColorBy: "color",
      linkColorStrategy: "direct",
      // linkWidthBy / linkWidthStrategy omitted — Cosmograph default width
      linkStrengthBy: "strength",
      simulationLinkDistance: 20,
      linkVisibilityDistanceRange: [50, 150],
      linkVisibilityMinTransparency: 0.25,
      linkDefaultArrows: false,
      linkArrowBy: "arrow",
      linkArrowsSizeScale: 1,
      onPointClick: handlePointClick,
      statusIndicatorMode: false,
    }),
    [handlePointClick],
  );

  const handleNodeDialogOpenChange = (open: boolean) => {
    setNodeDialogOpen(open);
    if (!open) setSelectedNode(null);
  };
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/graph");
        const data = (await res.json()) as GraphApiResponse;
        if (cancelled) return;

        if (!data.ok || data.memories.length === 0) {
          console.warn(
            "[graph] live feed unavailable:",
            data.error ?? res.status,
          );
          setPreparedGraph(null);
          return;
        }
        const byId = new Map<string, MemoryNode>();
        for (const memory of data.memories) {
          byId.set(memory.id, memory);
        }
        memoriesByIdRef.current = byId;

        const ids = data.memories.map((memory) => memory.id);
        const hierarchy = findNodeRanks(ids, data.links);
        const colors = findNodeColors(hierarchy);
        const sizes = findNodeSizes(hierarchy);

        const points = data.memories.map((memory) => ({
          id: memory.id,
          label: memory.name,
          color: colors.get(memory.id) ?? POINT_COLOR,
          size: sizes.get(memory.id) ?? 1,
        }));
        const links = data.links.map((link) => {
          const isParentOf = link.type === "PARENT_OF";
          return {
            source: link.source,
            target: link.target,
            type: link.type,
            color: isParentOf ? LINK_PARENT_OF : LINK_RELATES,
            strength: isParentOf
              ? LINK_PARENT_OF_STRENGTH
              : LINK_RELATES_STRENGTH,
            arrow: isParentOf,
          };
        });

        const result = await prepareCosmographData(
          {
            points: {
              pointIdBy: "id",
              pointColorBy: "color",
              pointSizeBy: "size",
            },
            links: {
              linkSourceBy: "source",
              linkTargetsBy: ["target"],
              linkColorBy: "color",
              linkStrengthBy: "strength",
              linkArrowBy: "arrow",
            },
          },
          points,
          links,
        );
        if (cancelled || result == null) return;

        setPreparedGraph(result);
      } catch (err) {
        if (cancelled) return;
        console.warn("[graph] live feed fetch failed:", err);
        setPreparedGraph(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-background text-text-primary">
      <div
        className="absolute inset-0"
        aria-label="Knowledge graph canvas. Click a node to inspect. Drag to pan, wheel to zoom."
      >
        {preparedGraph != null ? (
          <Cosmograph
            ref={cosmographRef}
            className="h-full w-full"
            points={preparedGraph.points}
            links={preparedGraph.links}
            {...preparedGraph.cosmographConfig}
            {...cosmographExtras}
          />
        ) : null}
      </div>

      <NodeDetailDialog
        node={selectedNode}
        open={nodeDialogOpen}
        onOpenChange={handleNodeDialogOpenChange}
      />

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
