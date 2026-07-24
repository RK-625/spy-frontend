"use client";

import { useEffect, useRef, useState } from "react";

import {
  createLayoutLoop,
  createPixiRenderer,
  createRtcCamera,
  type EdgeVisualStyle,
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
 * Full-viewport graph host: RTC camera + layout + Pixi + edge style A/B demo.
 */
export function GraphCanvas() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ReturnType<typeof createPixiRenderer> | null>(
    null
  );
  const [hud, setHud] = useState<HudState>({
    camX: 0,
    camY: 0,
    zoom: 1,
  });
  const [edgeStyle, setEdgeStyle] = useState<EdgeVisualStyle>("pixel-strip");

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
      edgeVisualStyle: edgeStyle,
    });
    renderer.setCamera(camera);
    rendererRef.current = renderer;

    let hudFrameId: number | null = null;

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
      renderer.render();
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
      renderer.render();
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
        renderer.render();
      }
    });
    resizeObserver.observe(canvasHost);

    const layoutLoop = createLayoutLoop({
      renderOnGraphData: (graphData) => {
        if (isCanvasDisposed) return;
        renderer.setGraphData(graphData);
        renderer.render();
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
      rendererRef.current = null;
      layoutLoop.stop();
      if (hudFrameId !== null) cancelAnimationFrame(hudFrameId);
      resizeObserver.disconnect();
      canvasHost.removeEventListener("pointerdown", handlePointerDown);
      canvasHost.removeEventListener("pointermove", handlePointerMove);
      canvasHost.removeEventListener("pointerup", handlePointerUp);
      canvasHost.removeEventListener("pointercancel", handlePointerUp);
      canvasHost.removeEventListener("wheel", handleWheel);
      renderer.destroy();
    };
    // Mount once; edge style applied via setEdgeVisualStyle below.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- demo host lifecycle
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setEdgeVisualStyle(edgeStyle);
  }, [edgeStyle]);

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
        <div className="text-[#ded4f0]">Spy graph — edge style demo</div>
        <div className="mt-0.5 text-[#7a7685]">
          camX {formatHudNumber(hud.camX)} · camY {formatHudNumber(hud.camY)}
        </div>
        <div className="text-[#7a7685]">
          zoom {formatHudNumber(hud.zoom)}
        </div>
        <div className="mt-2 text-[#4a4658]">drag pan · wheel zoom</div>
      </div>

      {/* A/B picker — product chrome, lavender utility */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
        <div className="text-[11px] text-[#7a7685]">
          Pick edge language (PART_OF firm · RELATES soft)
        </div>
        <div
          className="flex overflow-hidden border border-[rgba(200,172,251,0.2)] bg-[rgba(10,5,22,0.85)] backdrop-blur-md"
          style={{ borderRadius: "var(--radius)" }}
          role="group"
          aria-label="Edge visual style"
        >
          <button
            type="button"
            onClick={() => setEdgeStyle("pixel-strip")}
            className={`px-4 py-2 text-[12px] transition-colors ${
              edgeStyle === "pixel-strip"
                ? "bg-[rgba(200,172,251,0.18)] text-[#e8dff8]"
                : "text-[#7a7685] hover:text-[#ded4f0]"
            }`}
          >
            A · Pixel strip
          </button>
          <button
            type="button"
            onClick={() => setEdgeStyle("dot-matrix")}
            className={`border-l border-[rgba(200,172,251,0.15)] px-4 py-2 text-[12px] transition-colors ${
              edgeStyle === "dot-matrix"
                ? "bg-[rgba(200,172,251,0.18)] text-[#e8dff8]"
                : "text-[#7a7685] hover:text-[#ded4f0]"
            }`}
          >
            B · Dot matrix
          </button>
        </div>
        <div className="max-w-sm text-center text-[10px] leading-snug text-[#4a4658]">
          {edgeStyle === "pixel-strip"
            ? "A: square cells · continuous ribbon + chevron head (one material)"
            : "B: circular dots only · denser chevron at tip (halftone arrow)"}
        </div>
      </div>
    </div>
  );
}
