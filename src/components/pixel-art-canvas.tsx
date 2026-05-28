"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { FRAMES, FRAME_W, FRAME_H, COLORS } from "@/lib/spider-frames";

const PIXEL_SIZE = 8; // each pixel = 8px on screen
const FRAME_DURATION = 0.25; // seconds per frame

interface PixelArtCanvasProps {
  scale?: number;
  onReady?: () => void;
}

export default function PixelArtCanvas({
  scale = PIXEL_SIZE,
  onReady,
}: PixelArtCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const frameIndex = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = FRAME_W;
    canvas.height = FRAME_H;

    function drawFrame(idx: number) {
      if (!ctx) return;
      const frame = FRAMES[idx];
      ctx.clearRect(0, 0, FRAME_W, FRAME_H);
      for (let y = 0; y < FRAME_H; y++) {
        for (let x = 0; x < FRAME_W; x++) {
          const val = frame[y][x];
          if (val !== 0) {
            ctx.fillStyle = COLORS[val];
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    // Draw first frame
    drawFrame(0);

    // GSAP timeline cycling through frames
    const tl = gsap.timeline({ repeat: -1, ease: "none" });
    FRAMES.forEach((_, i) => {
      tl.call(() => {
        frameIndex.current = i;
        drawFrame(i);
      }, [], i * FRAME_DURATION);
    });

    // Gentle float on the container
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        y: -3,
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }

    // Glow pulse
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        scale: 1.15,
        opacity: 0.12,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }

    onReady?.();

    return () => {
      tl.kill();
    };
  }, [onReady]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center justify-center">
      {/* Glow ring */}
      <div
        ref={glowRef}
        className="absolute rounded-full"
        style={{
          width: FRAME_W * scale * 1.8,
          height: FRAME_H * scale * 1.8,
          background:
            "radial-gradient(circle, rgba(201,149,42,0.06) 0%, transparent 70%)",
        }}
      />
      {/* Canvas — native 32x32, scaled up with pixelated rendering */}
      <canvas
        ref={canvasRef}
        className="relative z-10"
        style={{
          width: FRAME_W * scale,
          height: FRAME_H * scale,
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}
