"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import forceAtlas2 from "graphology-layout-forceatlas2";
import Sigma from "sigma";
import { drawDiscNodeHover } from "sigma/rendering";
import { SlidersHorizontal } from "lucide-react";
import { motion } from "motion/react";

import {
  buildLayoutGraph,
  paintLayoutGraph,
  type SigmaEdgeAttrs,
  type SigmaNodeAttrs,
} from "@/lib/graph-functions";
import { useGraphTopology } from "@/contexts/GraphTopologyContext";
import { Button } from "@/components/ui/actions/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/overlays/dropdown-menu";
import { MOTION } from "@/lib/motion";

import { Editor } from "./editor/editor";
import { useGraphPalette } from "./graph-palette";

/** Settle the layout before Sigma draws its first frame. */
const FA2_ITERATIONS = 360;
const MotionButton = motion.create(Button);

type GraphRenderer = Sigma<SigmaNodeAttrs, SigmaEdgeAttrs>;

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
 * Shared topology feed → settled FA2 layout → Sigma draw.
 * Empty KB / initial fetch error → blank canvas (no mock).
 */
export function SigmaCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GraphRenderer | null>(null);
  const relatesToVisibleRef = useRef(false);
  const [relatesToVisible, setRelatesToVisible] = useState(false);
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

  const graphPalette = useGraphPalette();
  const graphPaletteRef = useRef(graphPalette);
  const isGraphPaletteReady = graphPalette !== null;

  // Theme change: recolor the mounted graph in place, keeping its settled layout.
  useEffect(() => {
    graphPaletteRef.current = graphPalette;
    const renderer = rendererRef.current;
    if (renderer == null || graphPalette == null) return;
    paintLayoutGraph(renderer.getGraph(), graphPalette);
    renderer.setSetting("defaultNodeColor", graphPalette.node);
    renderer.refresh();
  }, [graphPalette]);

  useEffect(() => {
    relatesToVisibleRef.current = relatesToVisible;
    rendererRef.current?.refresh();
  }, [relatesToVisible]);

  useEffect(() => {
    const host = hostRef.current;
    if (host == null || topology == null || topology.memories.length === 0) return;
    if (!isGraphPaletteReady) return;

    let cancelled = false;
    let renderer: GraphRenderer | null = null;

    const mount = () => {
      if (cancelled || renderer != null) return;
      const palette = graphPaletteRef.current;
      if (!hostHasPositiveBox(host) || palette == null) return;

      const graph = buildLayoutGraph(topology.memories, topology.links, palette);
      forceAtlas2.assign(graph, {
        iterations: FA2_ITERATIONS,
        getEdgeWeight: "weight",
        settings: {
          ...forceAtlas2.inferSettings(graph),
          adjustSizes: true,
          edgeWeightInfluence: 1,
        },
      });
      const instance = new Sigma(graph, host, {
        defaultNodeColor: palette.node,
        renderLabels: false,
        defaultDrawNodeHover: (context, data, settings) =>
          drawDiscNodeHover(context, { ...data, label: null }, settings),
        itemSizesReference: "screen",
        minEdgeThickness: 0,
        autoRescale: true,
        autoCenter: true,
        minCameraRatio: 0.3,
        defaultEdgeType: "line",
        edgeReducer: (_edge, attributes) => ({
          ...attributes,
          hidden: attributes.relationType === "RELATES_TO" && !relatesToVisibleRef.current,
        }),
        allowInvalidContainer: false,
      });
      instance.on("clickNode", ({ node }) => {
        const memory = memoriesById.get(node);
        if (memory == null) return;
        setSelectedMemoryId(memory.id);
      });
      renderer = instance;
      rendererRef.current = instance;

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
      observer.disconnect();
      renderer?.kill();
      rendererRef.current = null;
    };
  }, [topology, memoriesById, isGraphPaletteReady]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-text-primary">
      <div
        ref={hostRef}
        className="absolute inset-0 bg-[var(--graph-canvas)]"
        aria-label="Knowledge graph canvas. Click a node to inspect. Drag to pan, wheel to zoom."
      />

      {selectedNode ? (
        <Editor
          key={selectedNode.id}
          node={selectedNode}
          onClose={() => setSelectedMemoryId(null)}
        />
      ) : null}

      <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <MotionButton
              variant="outline"
              size="icon-sm"
              aria-label="Graph display options"
              title="Graph display options"
              whileTap={{ opacity: 0.7 }}
              transition={MOTION.chrome}
            >
              <SlidersHorizontal strokeWidth={1.5} />
            </MotionButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuCheckboxItem
                checked={relatesToVisible}
                onCheckedChange={setRelatesToVisible}
              >
                Show related connections
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
