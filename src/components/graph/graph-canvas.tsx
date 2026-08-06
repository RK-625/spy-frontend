"use client";

import { useEffect, useRef, useState } from "react";

import {
  createPixiRenderer,
  createRtcCamera,
  placeTopology,
  nodeScreenRadius,
  type GraphData,
  type GraphNode,
  type LayoutLoopHandle,
  type PixiRendererHandle,
  type RtcCamera,
} from "@/lib/graph";
import { DotMatrixIcon } from "@/components/dotmatrix";
import { NodeDetailDialog } from "@/components/graph/node-detail-dialog";
import type { GraphApiResponse } from "@/types/graph-topology";

type HudState = {
  camX: number;
  camY: number;
  zoom: number;
};

/** Max pointer travel (screen px) still treated as a click, not a pan. */
const CLICK_MOVE_THRESHOLD_PX = 6;
/** Extra hit slop around the visual node radius (screen px). */
const NODE_HIT_PAD_PX = 6;

/**
 * Closest node under the pointer (world hit using bake-space radii × zoom).
 * Returns null when the pointer is outside every padded disc.
 */
function hitTestNode(
  graph: GraphData,
  camera: RtcCamera,
  screenX: number,
  screenY: number,
): GraphNode | null {
  const world = camera.screenToWorld({ x: screenX, y: screenY });
  const zoom = Math.abs(camera.zoom);
  if (!Number.isFinite(zoom) || zoom === 0) return null;

  const padWorld = NODE_HIT_PAD_PX / zoom;
  let best: GraphNode | null = null;
  let bestDist2 = Infinity;

  for (const node of graph.nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
    const radius = nodeScreenRadius(node.rank, 1) + padWorld;
    const dx = node.x - world.x;
    const dy = node.y - world.y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= radius * radius && dist2 < bestDist2) {
      best = node;
      bestDist2 = dist2;
    }
  }
  return best;
}

function formatHudNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1e6 || abs < 1e-4) return n.toExponential(4);
  return n.toPrecision(12).replace(/\.?0+$/, "");
}

/**
 * Full-viewport graph host: RTC camera + paint store + Pixi DotStream edges.
 * Header chrome: ambient signal-pulse toggle (product weave metaphor).
 *
 * Product path (live-only — `plans/graph-live-only-pivot.md`):
 * - Single URL `/graph` — no `?stress` / `?source` / `?layout` / `?motion`.
 * - Always GET `/api/graph` on mount (topology: memories[] + links[]).
 * - Client maps via `placeTopology` (never GraphNode from API).
 * - Placement: `placeTopology` owns fingerprint hit/miss + settle + cache save.
 *   - Hit → assemble cached poses; miss → (0,0) settle + save.
 *   - Host only `setGraphData(graph)` (paint store; no settle option).
 * - Layout: dynamic-import `layout-loop-d3` paint handle (no ambient).
 * - Empty KB / fetch error → blank canvas (`console.warn` on error; no mock).
 * - Mock/stress fixtures stay under `lib/graph/fixtures/` for verify only.
 */
export function GraphCanvas() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<PixiRendererHandle | null>(null);
  const [hud, setHud] = useState<HudState>({
    camX: 0,
    camY: 0,
    zoom: 1,
  });
  /** Default on — ambient life on the web (not a loud lab dashboard). */
  const [pulsesOn, setPulsesOn] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    if (!canvasHost) return;

    let isCanvasDisposed = false;
    // setup the camera
    const camera = createRtcCamera({ zoom: 1 });
    const viewportWidth = canvasHost.clientWidth || 1;
    const viewportHeight = canvasHost.clientHeight || 1;
    camera.setViewport(viewportWidth, viewportHeight);
    camera.lookAt(0, 0);

    // setup the renderer
    const renderer = createPixiRenderer({
      background: 0x0a0a0c,
    });
    renderer.setCamera(camera);
    renderer.setSignalPulsesEnabled(pulsesOn);
    rendererRef.current = renderer;

    let hudFrameId: number | null = null;
    /** Coalesce Pixi draws to at most one per animation frame (pan/wheel flood). */
    let renderFrameId: number | null = null;
    /** Latest graph snapshot for hit-testing (updated on every renderOnGraphData). */
    let currentGraph: GraphData = { nodes: [], edges: [] };

    // flush and set the hud state
    const flushHudState = () => {
      hudFrameId = null;
      setHud({
        camX: camera.camX,
        camY: camera.camY,
        zoom: camera.zoom,
      });
    };
    // queue the hud update
    const queueHudUpdate = () => {
      if (hudFrameId !== null) return;
      hudFrameId = requestAnimationFrame(flushHudState);
    };

    // flush the render frame and call the renderer.render()
    const flushRender = () => {
      renderFrameId = null;
      if (isCanvasDisposed) return;
      renderer.render();
    };

    // queue the render
    const queueRender = () => {
      if (renderFrameId !== null) return;
      renderFrameId = requestAnimationFrame(flushRender);
    };

    // setup the pointer variables
    let isPanning = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let pointerTravel = 0;

    // Pan/zoom queueRender so the camera transform applies every frame.

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isPanning = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
      pointerTravel = 0;
      canvasHost.setPointerCapture(e.pointerId);
    };
    const handlePointerMove = (e: PointerEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      pointerTravel = Math.max(
        pointerTravel,
        Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY),
      );
      camera.panByScreen(dx, dy);
      queueRender();
      queueHudUpdate();
    };
    const handlePointerUp = (e: PointerEvent) => {
      const wasPanning = isPanning;
      isPanning = false;
      try {
        canvasHost.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
      if (!wasPanning || isCanvasDisposed) return;
      // Click = short travel; pan = drag. Open inspect modal on node hit.
      if (pointerTravel > CLICK_MOVE_THRESHOLD_PX) return;
      const rect = canvasHost.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const node = hitTestNode(currentGraph, camera, screenX, screenY);
      if (!node) return;
      setSelectedNode(node);
      setNodeDialogOpen(true);
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvasHost.getBoundingClientRect();
      const pointerScreenX = e.clientX - rect.left;
      const pointerScreenY = e.clientY - rect.top;
      const zoomFactor = Math.exp(-e.deltaY * 0.001);
      camera.zoomAt(pointerScreenX, pointerScreenY, zoomFactor);
      queueRender();
      queueHudUpdate();
    };

    canvasHost.addEventListener("pointerdown", handlePointerDown);
    canvasHost.addEventListener("pointermove", handlePointerMove);
    canvasHost.addEventListener("pointerup", handlePointerUp);
    canvasHost.addEventListener("pointercancel", handlePointerUp);
    canvasHost.addEventListener("wheel", handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
      const w = canvasHost.clientWidth;
      const h = canvasHost.clientHeight;
      if (w > 0 && h > 0) {
        camera.setViewport(w, h);
        queueRender();
      }
    });
    resizeObserver.observe(canvasHost);

    // Product starts empty until live topology arrives (no mock/stress seed).
    const initialGraph: GraphData = { nodes: [], edges: [] };
    currentGraph = initialGraph;

    /** Always full setGraphData (partial dirty host unplugged on product path). */
    const renderOnGraphData = (graphData: GraphData) => {
      if (isCanvasDisposed) return;
      currentGraph = graphData;
      renderer.setGraphData(graphData);
      queueRender();
      queueHudUpdate();
    };

    let layoutLoop: LayoutLoopHandle | null = null;

    void (async () => {
      const { createGraphPaintLoop } = await import(
        "@/lib/graph/layout/layout-loop-d3"
      );
      layoutLoop = createGraphPaintLoop({
        graphData: initialGraph,
        renderOnGraphData,
      });
      if (isCanvasDisposed) {
        layoutLoop.stop();
        return;
      }

      await renderer.mount(canvasHost);
      if (isCanvasDisposed) {
        layoutLoop.stop();
        return;
      }
      layoutLoop.start();
      queueHudUpdate();

      // Always live topology. Client never writes Falkor placement.
      // Poses: localStorage fingerprint cache (hit → paint; miss → settle+save).
      try {
        const res = await fetch("/api/graph");
        const data = (await res.json()) as GraphApiResponse;
        if (isCanvasDisposed || !layoutLoop) return;

        if (data.ok) {
          if (data.memories.length === 0) {
            // Empty KB → blank canvas (already empty).
            return;
          }
          const graph = placeTopology({
            memories: data.memories,
            links: data.links,
          });
          // placeTopology already settled on miss; paint only.
          layoutLoop.setGraphData(graph);
          return;
        }

        console.warn(
          "[graph] live feed unavailable:",
          data.error ?? res.status,
        );
      } catch (err) {
        if (isCanvasDisposed || !layoutLoop) return;
        console.warn("[graph] live feed fetch failed:", err);
      }
    })();

    return () => {
      isCanvasDisposed = true;
      layoutLoop?.stop();
      if (hudFrameId !== null) cancelAnimationFrame(hudFrameId);
      if (renderFrameId !== null) cancelAnimationFrame(renderFrameId);
      resizeObserver.disconnect();
      canvasHost.removeEventListener("pointerdown", handlePointerDown);
      canvasHost.removeEventListener("pointermove", handlePointerMove);
      canvasHost.removeEventListener("pointerup", handlePointerUp);
      canvasHost.removeEventListener("pointercancel", handlePointerUp);
      canvasHost.removeEventListener("wheel", handleWheel);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  const handlePulseToggle = () => {
    const next = !pulsesOn;
    setPulsesOn(next);
    rendererRef.current?.setSignalPulsesEnabled(next);
  };

  const handleNodeDialogOpenChange = (open: boolean) => {
    setNodeDialogOpen(open);
    if (!open) setSelectedNode(null);
  };

  return (
    <div
      className="relative h-dvh w-dvw overflow-hidden bg-background text-text-primary"
      data-graph-spike="step-3"
    >
      <div
        ref={canvasHostRef}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        aria-label="Knowledge graph canvas. Click a node to inspect. Drag to pan, wheel to zoom."
      />

      <NodeDetailDialog
        node={selectedNode}
        open={nodeDialogOpen}
        onOpenChange={handleNodeDialogOpenChange}
      />

      {/* Product chrome — dark utility register; HUD is secondary, Signals is primary control */}
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
          {/* Compact camera readout — product-secondary, not debug dump */}
          <div
            className="mt-2 font-mono text-[10px] tabular-nums tracking-wide text-text-dim/90"
            aria-hidden
          >
            <span className="text-text-secondary">z</span>{" "}
            {hud.zoom.toFixed(2)}
            <span className="mx-1.5 text-text-dim">·</span>
            <span className="text-text-secondary">xy</span>{" "}
            {formatHudNumber(hud.camX)}, {formatHudNumber(hud.camY)}
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={handlePulseToggle}
            aria-pressed={pulsesOn}
            aria-label={pulsesOn ? "Signals on" : "Signals off"}
            title={
              pulsesOn
                ? "Signals on — neural weave along edges"
                : "Signals off"
            }
            className={[
              "inline-flex items-center gap-2 rounded-[var(--radius)] border px-3 py-1.5",
              "text-[14px] tracking-wide transition-[color,background-color,border-color] duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              "focus-visible:ring-offset-2 focus-visible:ring-offset-accent-ink",
              pulsesOn
                ? "border-lavender/50 bg-lavender/14 text-primary shadow-[0_0_0_1px_var(--border-subtle)]"
                : "border-text-dim/90 bg-accent-ink/85 text-text-secondary hover:border-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <DotMatrixIcon
              name="bulb"
              size={15}
              className={pulsesOn ? "text-lavender" : "text-text-secondary"}
            />
            <span className="font-medium">Signals</span>
            <span
              className={[
                "rounded-[calc(var(--radius)-2px)] px-1.5 py-0.5 text-[11px] uppercase tracking-wider",
                pulsesOn
                  ? "bg-lavender/20 text-lavender"
                  : "bg-text-dim/25 text-text-dim",
              ].join(" ")}
            >
              {pulsesOn ? "on" : "off"}
            </span>
          </button>
          <p className="max-w-[11rem] text-right text-[10px] leading-snug tracking-wide text-text-dim">
            {pulsesOn
              ? "Pulse along the web"
              : "Turn on edge weave"}
          </p>
        </div>
      </header>
    </div>
  );
}
