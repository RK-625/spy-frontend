"use client";

import { useEffect, useRef, useState } from "react";

import {
  createLayoutLoop,
  createPixiRenderer,
  createRtcCamera,
  createLargeStressGraphData,
  createMockGraphData,
  type GraphData,
  type LayoutRenderOptions,
  type PixiRendererHandle,
} from "@/lib/graph";
import { diffGraphDirty } from "@/lib/graph/graph-diff";
import { DotMatrixIcon } from "@/components/dotmatrix/icons";

type HudState = {
  camX: number;
  camY: number;
  zoom: number;
};

function formatHudNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1e6 || abs < 1e-4) return n.toExponential(4);
  return n.toPrecision(12).replace(/\.?0+$/, "");
}

/**
 * Full-viewport graph host: RTC camera + layout + Pixi DotStream edges.
 * Header chrome: ambient signal-pulse toggle (product weave metaphor).
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

    // setInteractionQuality is a no-op on the renderer (world-bake + GPU batches);
    // do not schedule settle timers / extra rAFs for quality toggles. Pan/zoom
    // still queueRender so the camera transform applies every frame.

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isPanning = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      canvasHost.setPointerCapture(e.pointerId);
    };
    const handlePointerMove = (e: PointerEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      camera.panByScreen(dx, dy);
      queueRender();
      queueHudUpdate();
    };
    const handlePointerUp = (e: PointerEvent) => {
      isPanning = false;
      try {
        canvasHost.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
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
     * Default remains createMockGraphData from the layout loop.
     */
    let initialGraph: GraphData | undefined;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("stress")) {
        const hubs = Number(params.get("hubs") ?? "40");
        const spokes = Number(params.get("spokes") ?? "12");
        initialGraph = createLargeStressGraphData({
          hubCount: Number.isFinite(hubs) ? hubs : 40,
          spokesPerHub: Number.isFinite(spokes) ? spokes : 12,
        });
      }
    }

    let prevGraphForDirty: GraphData | null = null;

    const layoutLoop = createLayoutLoop({
      graphData: initialGraph ?? createMockGraphData(),
      renderOnGraphData: (
        graphData: GraphData,
        renderOpts?: LayoutRenderOptions
      ) => {
        if (isCanvasDisposed) return;

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
      },
    });

    void (async () => {
      await renderer.mount(canvasHost);
      if (isCanvasDisposed) {
        renderer.destroy();
        return;
      }
      layoutLoop.start();
      queueHudUpdate();
    })();

    return () => {
      isCanvasDisposed = true;
      layoutLoop.stop();
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

  return (
    <div
      className="relative h-dvh w-dvw overflow-hidden bg-black text-[#ded4f0]"
      data-graph-spike="step-3"
    >
      <div
        ref={canvasHostRef}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        aria-hidden
      />

      {/* Product chrome — dark utility register; HUD is secondary, Signals is primary control */}
      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-3 sm:p-4"
        style={{ fontFamily: "var(--font-vt323), ui-monospace, monospace" }}
      >
        <div className="pointer-events-none max-w-[min(100%,20rem)] select-none">
          <div className="text-[15px] tracking-wide text-[#ded4f0]">
            Spy graph
          </div>
          <div className="mt-1 text-[11px] leading-snug tracking-wide text-[#4a4658]">
            Drag to pan · wheel to zoom
          </div>
          {/* Compact camera readout — product-secondary, not debug dump */}
          <div
            className="mt-2 font-mono text-[10px] tabular-nums tracking-wide text-[#4a4658]/90"
            aria-hidden
          >
            <span className="text-[#7a7685]">z</span>{" "}
            {hud.zoom.toFixed(2)}
            <span className="mx-1.5 text-[#4a4658]">·</span>
            <span className="text-[#7a7685]">xy</span>{" "}
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
              "focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0c]",
              pulsesOn
                ? "border-[#c8acfb]/50 bg-[#c8acfb]/14 text-[#e8dff8] shadow-[0_0_0_1px_rgba(200,172,251,0.08)]"
                : "border-[#4a4658]/90 bg-[#0a0a0c]/85 text-[#7a7685] hover:border-[#7a7685] hover:text-[#ded4f0]",
            ].join(" ")}
          >
            <DotMatrixIcon
              name="bulb"
              size={15}
              className={pulsesOn ? "text-[#c8acfb]" : "text-[#7a7685]"}
            />
            <span className="font-medium">Signals</span>
            <span
              className={[
                "rounded-[calc(var(--radius)-2px)] px-1.5 py-0.5 text-[11px] uppercase tracking-wider",
                pulsesOn
                  ? "bg-[#c8acfb]/20 text-[#c8acfb]"
                  : "bg-[#4a4658]/25 text-[#4a4658]",
              ].join(" ")}
            >
              {pulsesOn ? "on" : "off"}
            </span>
          </button>
          <p className="max-w-[11rem] text-right text-[10px] leading-snug tracking-wide text-[#4a4658]">
            {pulsesOn
              ? "Pulse along the web"
              : "Turn on edge weave"}
          </p>
        </div>
      </header>
    </div>
  );
}
