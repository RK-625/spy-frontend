"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CLUSTER_ANCHORS,
  createLayoutLoop,
  createPixiRenderer,
  createRtcCamera,
  type ClusterId,
  type ProjectionMode,
  type RtcCamera,
} from "@/lib/graph";

type HudState = {
  camX: number;
  camY: number;
  zoom: number;
  fps: number;
  projectionMode: ProjectionMode;
};

const CLUSTER_JUMPS: readonly ClusterId[] = ["A", "B", "C", "D"];

const btnClass =
  "pointer-events-auto rounded-[var(--radius)] border border-[#C8ACFB]/45 bg-black/60 px-2 py-0.5 text-[11px] text-[#ded4f0] transition-colors hover:border-[#C8ACFB] hover:bg-[#C8ACFB]/12 hover:text-[#e8dff8] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8ACFB]/70";

function formatCam(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  // Extreme cluster scales (1e15+): compact scientific for HUD readability
  if (abs >= 1e15) return n.toExponential(4);
  if (abs >= 1e6 || abs < 1e-4) return n.toExponential(4);
  return n.toPrecision(12).replace(/\.?0+$/, "");
}

/**
 * Full-viewport graph host: RTC camera + FA2 layout + Pixi draw + HUD.
 */
export function GraphCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<RtcCamera | null>(null);
  const [hud, setHud] = useState<HudState>({
    camX: 0,
    camY: 0,
    zoom: 1,
    fps: 0,
    projectionMode: "rtc",
  });

  const renderRef = useRef<(() => void) | null>(null);

  const jumpTo = useCallback((id: ClusterId) => {
    const cam = cameraRef.current;
    if (!cam) return;
    const a = CLUSTER_ANCHORS[id];
    cam.lookAt(a.x, a.y);
    renderRef.current?.();
    setHud((h) => ({
      ...h,
      camX: cam.camX,
      camY: cam.camY,
      zoom: cam.zoom,
    }));
  }, []);

  const toggleProjection = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const next: ProjectionMode =
      cam.projectionMode === "rtc" ? "naive" : "rtc";
    cam.setProjectionMode(next);
    renderRef.current?.();
    setHud((h) => ({ ...h, projectionMode: next }));
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const camera = createRtcCamera({ zoom: 1, projectionMode: "rtc" });
    cameraRef.current = camera;

    const w0 = host.clientWidth || 1;
    const h0 = host.clientHeight || 1;
    camera.setViewport(w0, h0);
    // Start on cluster A
    camera.lookAt(CLUSTER_ANCHORS.A.x, CLUSTER_ANCHORS.A.y);

    const renderer = createPixiRenderer({ background: 0x0a0a0c });
    renderer.setCamera(camera);
    renderRef.current = () => renderer.render();

    // Pointer pan
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      host.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      camera.panByScreen(dx, dy);
      renderer.render();
      scheduleHud();
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      try {
        host.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
    };

    // FPS + HUD throttle (declared before handlers that call scheduleHud)
    let frames = 0;
    let fpsWindowStart = performance.now();
    let lastFps = 0;
    let hudRaf: number | null = null;
    let pendingHud = false;

    const pushHud = () => {
      pendingHud = false;
      hudRaf = null;
      setHud({
        camX: camera.camX,
        camY: camera.camY,
        zoom: camera.zoom,
        fps: lastFps,
        projectionMode: camera.projectionMode,
      });
    };

    const scheduleHud = () => {
      if (pendingHud) return;
      pendingHud = true;
      hudRaf = requestAnimationFrame(pushHud);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.001);
      camera.zoomAt(sx, sy, factor);
      renderer.render();
      scheduleHud();
    };

    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    host.addEventListener("wheel", onWheel, { passive: false });

    const layout = createLayoutLoop({
      onTick: (g) => {
        if (cancelled) return;
        renderer.setGraph(g);
        renderer.render();

        frames += 1;
        const now = performance.now();
        const elapsed = now - fpsWindowStart;
        if (elapsed >= 500) {
          lastFps = Math.round((frames * 1000) / elapsed);
          frames = 0;
          fpsWindowStart = now;
        }
        scheduleHud();
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w > 0 && h > 0) {
        camera.setViewport(w, h);
        renderer.render();
      }
    });
    resizeObserver.observe(host);

    void (async () => {
      await renderer.mount(host);
      if (cancelled) {
        renderer.destroy();
        return;
      }
      // Initial graph draw before first layout tick
      renderer.setGraph(layout.getGraph());
      renderer.render();
      layout.start();
      scheduleHud();
    })();

    return () => {
      cancelled = true;
      layout.stop();
      if (hudRaf !== null) cancelAnimationFrame(hudRaf);
      resizeObserver.disconnect();
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerUp);
      host.removeEventListener("wheel", onWheel);
      renderer.destroy();
      cameraRef.current = null;
      renderRef.current = null;
    };
  }, []);

  const rtcOn = hud.projectionMode === "rtc";

  return (
    <div
      className="relative h-dvh w-dvw overflow-hidden bg-black text-[#ded4f0]"
      data-graph-spike="step-3"
    >
      <div
        ref={hostRef}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute left-3 top-3 z-10 max-w-[min(100%,22rem)] font-mono text-[12px] leading-relaxed tracking-wide"
        style={{ fontFamily: "var(--font-vt323), ui-monospace, monospace" }}
      >
        <div className="text-[#ded4f0]">Spy graph spike — Step 3</div>
        <div className="mt-0.5 text-[#7a7685]">
          camX {formatCam(hud.camX)} · camY {formatCam(hud.camY)}
        </div>
        <div className="text-[#7a7685]">
          zoom {formatCam(hud.zoom)} · fps {hud.fps || "—"}
        </div>
        <div className="text-[#4a4658]">
          projection {rtcOn ? "RTC" : "naive"}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {CLUSTER_JUMPS.map((id) => (
            <button
              key={id}
              type="button"
              className={btnClass}
              onClick={() => jumpTo(id)}
            >
              Jump {id}
            </button>
          ))}
          <button
            type="button"
            className={btnClass}
            onClick={toggleProjection}
            aria-pressed={rtcOn}
          >
            RTC {rtcOn ? "ON" : "OFF"}
          </button>
        </div>

        <div className="mt-2 text-[#4a4658]">drag pan · wheel zoom</div>
      </div>
    </div>
  );
}
