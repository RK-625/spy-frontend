"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cosmograph,
  prepareCosmographData,
  type CosmographConfig,
  type CosmographRef,
} from "@cosmograph/react";

import type { MemoryNode } from "@/types/graph-schema";
import type { GraphApiResponse } from "@/types/graph-topology";
import { NodeDetailDialog } from "./node-detail-dialog";

/** Deepest register — same family as former GRAPH_BG (0x0a0a0c). */
const GRAPH_BG = "#0a0a0c";
const POINT_COLOR = "#c8acfb";
const LINK_PART_OF = "#4e5a72";
const LINK_RELATES = "#6a5870";

type PreparedGraph = {
  points: CosmographConfig["points"];
  links: CosmographConfig["links"];
  cosmographConfig: CosmographConfig;
};

/**
 * Live-only knowledge graph host (Cosmograph).
 * GET `/api/graph` → prepare points/links → Cosmograph owns layout + camera + draw.
 * Empty KB / fetch error → blank canvas (no mock).
 */
export function GraphCanvas() {
  const cosmographRef = useRef<CosmographRef>(undefined);
  const memoriesByIdRef = useRef<Map<string, MemoryNode>>(new Map());

  const [prepared, setPrepared] = useState<PreparedGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<MemoryNode | null>(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/graph");
        const data = (await res.json()) as GraphApiResponse;
        if (cancelled) return;

        if (!data.ok) {
          console.warn(
            "[graph] live feed unavailable:",
            data.error ?? res.status,
          );
          setPrepared(null);
          return;
        }

        if (data.memories.length === 0) {
          setPrepared(null);
          return;
        }

        const byId = new Map<string, MemoryNode>();
        for (const memory of data.memories) {
          byId.set(memory.id, memory);
        }
        memoriesByIdRef.current = byId;

        const points = data.memories.map((memory) => ({
          id: memory.id,
          label: memory.name,
        }));
        const links = data.links.map((link) => ({
          source: link.source,
          target: link.target,
          type: link.type,
        }));

        const result = await prepareCosmographData(
          {
            points: { pointIdBy: "id" },
            links: {
              linkSourceBy: "source",
              linkTargetsBy: ["target"],
            },
          },
          points,
          links,
        );
        if (cancelled || result == null) return;

        setPrepared({
          points: result.points,
          links: result.links,
          cosmographConfig: result.cosmographConfig,
        });
      } catch (err) {
        if (cancelled) return;
        console.warn("[graph] live feed fetch failed:", err);
        setPrepared(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const cosmographExtras = useMemo(
    (): Partial<CosmographConfig> => ({
      enableSimulation: true,
      backgroundColor: GRAPH_BG,
      pointDefaultColor: POINT_COLOR,
      pointLabelBy: "label",
      showDynamicLabels: true,
      selectPointOnClick: "single",
      focusPointOnClick: true,
      linkColorBy: "type",
      linkColorByFn: (value: unknown) =>
        value === "PART_OF" ? LINK_PART_OF : LINK_RELATES,
      linkDefaultArrows: true,
      onPointClick: handlePointClick,
      statusIndicatorMode: false,
    }),
    [handlePointClick],
  );

  const handleNodeDialogOpenChange = (open: boolean) => {
    setNodeDialogOpen(open);
    if (!open) setSelectedNode(null);
  };

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-background text-text-primary">
      <div
        className="absolute inset-0"
        aria-label="Knowledge graph canvas. Click a node to inspect. Drag to pan, wheel to zoom."
      >
        {prepared != null ? (
          <Cosmograph
            ref={cosmographRef}
            className="h-full w-full"
            points={prepared.points}
            links={prepared.links}
            {...prepared.cosmographConfig}
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
