"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { FRAMES, WAVE_FRAMES, FRAME_W, FRAME_H, COLORS } from "@/lib/spider-frames";

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

  useGSAP(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = FRAME_W;
    canvas.height = FRAME_H;

    function drawFrame(frameData: number[][]) {
      if (!ctx) return;
      ctx.clearRect(0, 0, FRAME_W, FRAME_H);
      for (let y = 0; y < FRAME_H; y++) {
        for (let x = 0; x < FRAME_W; x++) {
          const val = frameData[y][x];
          if (val !== 0) {
            ctx.fillStyle = COLORS[val];
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    // Start with the first frame of the wave
    drawFrame(WAVE_FRAMES[0]);

    // Create a master timeline
    const masterTl = gsap.timeline();

    // 1. Play the Wave Sequence
    const waveTl = gsap.timeline();
    WAVE_FRAMES.forEach((frame, i) => {
      // 0.1 seconds per wave frame makes it snappy
      waveTl.call(() => drawFrame(frame), [], i * 0.1);
    });
    
    // Also give the container a little squash/stretch physics during the wave
    waveTl.to(containerRef.current, { scaleY: 0.85, y: 10, duration: 0.1, ease: "power1.inOut" }, 0.1) // match squash frame
          .to(containerRef.current, { scaleY: 1.05, y: -5, duration: 0.2, ease: "power2.out" }, 0.2) // spring up
          .to(containerRef.current, { scaleY: 1, y: 0, duration: 0.4, ease: "bounce.out" }, 0.9); // land

    masterTl.add(waveTl);

    // 2. Transition to Idle loop
    masterTl.call(() => {
      onReady?.();
      
      // GSAP timeline cycling through idle frames
      const idleTl = gsap.timeline({ repeat: -1, ease: "none" });
      FRAMES.forEach((frame, i) => {
        idleTl.call(() => drawFrame(frame), [], i * FRAME_DURATION);
      });

      // Gentle float on the container
      if (containerRef.current) {
        gsap.to(containerRef.current, {
          y: -4,
          duration: 2.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
    });

    // 3. Glow pulse (starts immediately, independent of timeline)
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

  }, { scope: containerRef, dependencies: [onReady] });

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
