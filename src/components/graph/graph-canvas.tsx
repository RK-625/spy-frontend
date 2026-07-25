"use client";

import { useEffect, useRef, useState } from "react";

import {
  createLayoutLoop,
  createPixiRenderer,
  createRtcCamera,
} from "@/lib/graph";

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
 */
export function GraphCanvas() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [hud, setHud] = useState<HudState>({
    camX: 0,
    camY: 0,
    zoom: 1,
  });

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

    const layoutLoop = createLayoutLoop({
      renderOnGraphData: (graphData) => {
        if (isCanvasDisposed) return;
        renderer.setGraphData(graphData);
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
    };
  }, []);

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

      <div
        className="pointer-events-none absolute left-3 top-3 z-10 max-w-[min(100%,24rem)] font-mono text-[12px] leading-relaxed tracking-wide"
        style={{ fontFamily: "var(--font-vt323), ui-monospace, monospace" }}
      >
        <div className="text-[#ded4f0]">Spy graph</div>
        <div className="mt-0.5 text-[#7a7685]">
          camX {formatHudNumber(hud.camX)} · camY {formatHudNumber(hud.camY)}
        </div>
        <div className="text-[#7a7685]">
          zoom {formatHudNumber(hud.zoom)}
        </div>
        <div className="mt-2 text-[#4a4658]">drag pan · wheel zoom</div>
      </div>
    </div>
  );
}
