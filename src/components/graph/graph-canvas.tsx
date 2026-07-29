"use client";

import { useEffect, useRef, useState } from "react";

import {
  createLayoutLoopAsync,
  createPixiRenderer,
  createRtcCamera,
  createLargeStressGraphData,
  createMockGraphData,
  memoryGraphToGraphDataWithMeta,
  nodeScreenRadius,
  type GraphData,
  type GraphNode,
  type LayoutEngine,
  type LayoutRenderOptions,
  type PixiRendererHandle,
  type RtcCamera,
} from "@/lib/graph";
import { diffGraphDirty } from "@/lib/graph/graph-diff";
import { DotMatrixIcon } from "@/components/dotmatrix/icons";
import {
  NodeDetailDialog,
  type NodeDetail,
} from "@/components/graph/node-detail-dialog";
import type { Links } from "@/types/graph-schema";

type HudState = {
  camX: number;
  camY: number;
  zoom: number;
};

type GraphApiResponse = {
  ok?: boolean;
  empty?: boolean;
  /** Topology only — placement lives in client localStorage cache. */
  memories?: Array<{
    id: string;
    name: string;
    content?: string;
    impression?: string;
    confidence?: number;
  }>;
  links?: Links[];
  error?: string;
};

/** Max pointer travel (screen px) still treated as a click, not a pan. */
const CLICK_MOVE_THRESHOLD_PX = 6;
/** Extra hit slop around the visual node radius (screen px). */
const NODE_HIT_PAD_PX = 6;

function toNodeDetail(node: GraphNode): NodeDetail {
  return {
    id: node.id,
    label: node.label,
    content: node.content,
    impression: node.impression,
    confidence: node.confidence,
    rank: node.rank,
    childIds: node.childIds,
    parentIds: node.parentIds,
    relateIds: node.relateIds,
  };
}

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
 * Resolve initial fixture from query:
 * - `?stress=1` → large stress fixture (wins)
 * - `?source=mock` / default paint seed → mock (default may swap to live after fetch)
 * Explicit live starts empty until fetch (see GraphCanvas effect).
 */
function initialGraphFromSearch(search: string): GraphData {
  const params = new URLSearchParams(search);
  if (params.has("stress")) {
    const hubs = Number(params.get("hubs") ?? "40");
    const spokes = Number(params.get("spokes") ?? "12");
    return createLargeStressGraphData({
      hubCount: Number.isFinite(hubs) ? hubs : 40,
      spokesPerHub: Number.isFinite(spokes) ? spokes : 12,
    });
  }
  return createMockGraphData();
}

/**
 * Full-viewport graph host: RTC camera + layout + Pixi DotStream edges.
 * Header chrome: ambient signal-pulse toggle (product weave metaphor).
 *
 * Data source (Slice 3 + product default live):
 * - Default `/graph` → GET `/api/graph` first; non-empty → live; empty or
 *   fetch/DB error → keep mock (offline / empty DB still works).
 * - `?source=mock` → mock only (no live fetch).
 * - `?stress=1` → stress fixture (wins over live).
 * - `?source=live` → GET `/api/graph`; empty DB → empty canvas; fetch/DB
 *   error → fall back to mock so the page is not blank.
 * - Client **never** writes Falkor placement. Poses live in browser
 *   `localStorage` (`placement-cache.ts` / `plans/client-placement-cache.md`).
 *
 * Layout (client placement cache MVP — C3):
 * - Default → static positions after install (no continuous sim).
 * - Live topology: adapter loads cache by topo fingerprint.
 *   - Cache hit → paint cached poses; skip settle (also for `?layout=d3`).
 *   - Cache miss → seedNodePosition + one-shot settle (saves cache).
 * - `?layout=d3` → miss settles via d3 engine; hit still paints cache (no force recompute).
 * - `?motion=1` → opt-in continuous ambient (S8; separate from settle; default off).
 * - Progressive BFS growth (invisible-until-posed) deferred as C3b.
 * - Engines: static (default) or opt-in d3-settle; no continuous FA2 sim.
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
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    if (!canvasHost) return;

    let isCanvasDisposed = false;

    const camera = createRtcCamera({ zoom: 1 });
    const viewportWidth = canvasHost.clientWidth || 1;
    const viewportHeight = canvasHost.clientHeight || 1;
    camera.setViewport(viewportWidth, viewportHeight);
    camera.lookAt(0, 0);

    const renderer = createPixiRenderer({
      background: 0x0a0a0c,
    });
    renderer.setCamera(camera);
    renderer.setSignalPulsesEnabled(true);
    rendererRef.current = renderer;

    let hudFrameId: number | null = null;
    /** Coalesce Pixi draws to at most one per animation frame (pan/wheel flood). */
    let renderFrameId: number | null = null;
    /** Latest graph snapshot for hit-testing (updated on every renderOnGraphData). */
    let currentGraph: GraphData = { nodes: [], edges: [] };

    const flushHudState = () => {
      hudFrameId = null;
      setHud({
        camX: camera.camX,
        camY: camera.camY,
        zoom: camera.zoom,
      });
    };

    const queueHudUpdate = () => {
      if (hudFrameId !== null) return;
      hudFrameId = requestAnimationFrame(flushHudState);
    };

    const flushRender = () => {
      renderFrameId = null;
      if (isCanvasDisposed) return;
      renderer.render();
    };

    const queueRender = () => {
      if (renderFrameId !== null) return;
      renderFrameId = requestAnimationFrame(flushRender);
    };

    let isPanning = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let pointerTravel = 0;

    // setInteractionQuality is a no-op on the renderer (world-bake + GPU batches);
    // do not schedule settle timers / extra rAFs for quality toggles. Pan/zoom
    // still queueRender so the camera transform applies every frame.

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
      const hit = hitTestNode(currentGraph, camera, screenX, screenY);
      if (!hit) return;
      setSelectedNode(toNodeDetail(hit));
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

    /**
     * Optional stress fixture via `?stress=1` (or hub/spoke counts).
     * Default `/graph` attempts live KB then falls back to mock.
     * Overrides: `?source=mock`, `?source=live`, `?stress=1` (wins).
     * One-shot settle: `?layout=d3` (S1/S4; dynamic import, default stays static).
     * Ambient motion: `?motion=1` (S8; implies d3 path; default off).
     */
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);
    const sourceParam = params.get("source");
    const forceLive = sourceParam === "live";
    const forceMock = sourceParam === "mock";
    // Default + explicit live attempt Falkor; mock/stress skip fetch.
    const wantLive =
      !params.has("stress") && !forceMock && (forceLive || sourceParam == null);
    const wantLayoutD3 = params.get("layout") === "d3";
    const wantMotion = params.get("motion") === "1";
    // motion=1 loads d3 settle path (ambient ticks after settle); layout=d3 alone is one-shot.
    const layoutEngine: LayoutEngine =
      wantLayoutD3 || wantMotion ? "d3-settle" : "static";
    // Explicit live starts empty (no mock flash). Default seeds mock until
    // fetch proves a non-empty KB (empty/error keep mock).
    const initialGraph = forceLive
      ? { nodes: [], edges: [] }
      : initialGraphFromSearch(search);
    currentGraph = initialGraph;

    let prevGraphForDirty: GraphData | null = null;

    const renderOnGraphData = (
      graphData: GraphData,
      renderOpts?: LayoutRenderOptions
    ) => {
      if (isCanvasDisposed) return;

      currentGraph = graphData;

      // Prefer explicit dirty from layout/sim; else diff against previous snapshot.
      if (renderOpts?.dirtyEdges !== undefined) {
        renderer.setGraphData(graphData, {
          dirtyEdges: renderOpts.dirtyEdges,
          movedNodeIds: renderOpts.movedNodeIds,
        });
      } else {
        const diff = diffGraphDirty(prevGraphForDirty, graphData);
        if (diff.kind === "all") {
          renderer.setGraphData(graphData);
        } else if (diff.kind === "position") {
          renderer.setGraphData(graphData, {
            dirtyEdges: diff.dirtyEdges,
            movedNodeIds: diff.movedNodeIds,
          });
        } else {
          // Identical positions — skip setGraphData (no topology/dirty work).
          prevGraphForDirty = graphData;
          queueRender();
          queueHudUpdate();
          return;
        }
      }
      prevGraphForDirty = graphData;
      queueRender();
      queueHudUpdate();
    };

    let layoutLoop: Awaited<ReturnType<typeof createLayoutLoopAsync>> | null =
      null;

    void (async () => {
      layoutLoop = await createLayoutLoopAsync({
        graphData: initialGraph,
        layoutEngine,
        ambientMotion: wantMotion,
        renderOnGraphData,
      });
      if (isCanvasDisposed) {
        layoutLoop.stop();
        return;
      }

      await renderer.mount(canvasHost);
      if (isCanvasDisposed) {
        layoutLoop.stop();
        renderer.destroy();
        return;
      }
      layoutLoop.start();
      queueHudUpdate();

      // Live topology (read-only). Default attempts live; empty/error → mock.
      // Explicit ?source=live + empty DB → empty canvas.
      // Placement: client localStorage cache (fingerprint hit → paint; miss → settle+save).
      // Client never writes Falkor x/y/rank.
      if (!wantLive) return;

      try {
        const res = await fetch("/api/graph");
        const data = (await res.json()) as GraphApiResponse;
        if (isCanvasDisposed || !layoutLoop) return;

        if (data.ok && Array.isArray(data.memories)) {
          if (data.memories.length === 0) {
            // Explicit live → empty canvas (already empty). Default → keep mock seed.
            return;
          }
          const { graph, needsLayout } = memoryGraphToGraphDataWithMeta({
            memories: data.memories,
            links: Array.isArray(data.links) ? data.links : [],
          });

          if (!needsLayout) {
            // Full cache hit — paint without re-settle (including layout=d3).
            layoutLoop.setGraphData(graph, { settle: false });
            return;
          }

          // Cache miss MVP: seed poses already on GraphData; one-shot settle
          // writes localStorage via settleGraphData. No Falkor placement writes.
          // Progressive BFS reveal is C3b (deferred).
          if (layoutEngine === "d3-settle") {
            // Engine settle on install (also saves placement cache).
            layoutLoop.setGraphData(graph);
            return;
          }

          const { settleIfNeeded } = await import("@/lib/graph/force-recipe");
          if (isCanvasDisposed || !layoutLoop) return;
          layoutLoop.setGraphData(
            settleIfNeeded(graph, { needsLayout: true }),
          );
          return;
        }

        // Non-ok payload — fall back to mock so the page is not blank.
        // Default already showing mock; explicit live may still be empty.
        console.warn(
          "[graph] live feed unavailable, using mock:",
          data.error ?? res.status,
        );
        layoutLoop.setGraphData(createMockGraphData());
      } catch (err) {
        if (isCanvasDisposed || !layoutLoop) return;
        console.warn("[graph] live feed fetch failed, using mock:", err);
        layoutLoop.setGraphData(createMockGraphData());
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
