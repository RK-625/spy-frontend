"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const PIXEL = 6;
const W = 40;
const H = 40;

// Each frame is a 2D grid. 0 = transparent, 1 = body (dark), 2 = accent (amber), 3 = eye (white)
type Frame = number[][];

const IDLE: Frame = (() => {
  const g: Frame = Array.from({ length: H }, () => Array(W).fill(0));

  function set(x: number, y: number, v: number) {
    if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = v;
  }

  // --- ABDOMEN (back segment) ---
  for (let y = 20; y <= 34; y++) {
    const row = y - 20;
    const halfW = Math.round(6 + Math.sin((row / 14) * Math.PI) * 5);
    for (let x = W / 2 - halfW; x <= W / 2 + halfW; x++) {
      if (x >= 0 && x < W) set(x, y, 1);
    }
  }

  // --- CEPHALOTHORAX (front segment) ---
  for (let y = 12; y <= 22; y++) {
    const row = y - 12;
    const halfW = Math.round(5 + Math.sin((row / 10) * Math.PI) * 4);
    for (let x = W / 2 - halfW; x <= W / 2 + halfW; x++) {
      if (x >= 0 && x < W) set(x, y, 1);
    }
  }

  // --- LEGS ---
  const legPoints = [
    // L1 (back left)
    [14, 22, 8, 16],
    [8, 16, 4, 10],
    // L2 (mid-back left)
    [14, 26, 6, 22],
    [6, 22, 2, 18],
    // L3 (mid-front left)
    [14, 30, 6, 30],
    [6, 30, 2, 28],
    // L4 (front left)
    [14, 34, 8, 36],
    [8, 36, 4, 38],
    // R1 (back right)
    [26, 22, 32, 16],
    [32, 16, 36, 10],
    // R2 (mid-back right)
    [26, 26, 34, 22],
    [34, 22, 38, 18],
    // R3 (mid-front right)
    [26, 30, 34, 30],
    [34, 30, 38, 28],
    // R4 (front right)
    [26, 34, 32, 36],
    [32, 36, 36, 38],
  ];

  for (let i = 0; i < legPoints.length; i += 2) {
    const [x1, y1, x2, y2] = legPoints[i];
    // Simple line interpolation
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let s = 0; s <= steps; s++) {
      const t = steps > 0 ? s / steps : 0;
      const x = Math.round(x1 + (x2 - x1) * t);
      const y = Math.round(y1 + (y2 - y1) * t);
      set(x, y, 1);
    }
  }

  // --- PEDIPALPS (front feelers) ---
  const pedipalps = [
    [16, 12, 14, 8],
    [14, 8, 13, 5],
    [24, 12, 26, 8],
    [26, 8, 27, 5],
  ];
  for (let i = 0; i < pedipalps.length; i += 2) {
    const [x1, y1, x2, y2] = pedipalps[i];
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let s = 0; s <= steps; s++) {
      const t = steps > 0 ? s / steps : 0;
      const x = Math.round(x1 + (x2 - x1) * t);
      const y = Math.round(y1 + (y2 - y1) * t);
      set(x, y, 1);
    }
  }

  // --- EYES (just tiny dots) ---
  set(18, 14, 3);
  set(22, 14, 3);
  set(18, 15, 2);
  set(22, 15, 2);

  // --- ABDOMEN PATTERN (subtle accent stripes) ---
  set(19, 26, 2);
  set(20, 26, 2);
  set(21, 26, 2);
  set(19, 30, 2);
  set(20, 30, 2);
  set(21, 30, 2);

  return g;
})();

const FRAMES: Frame[] = [IDLE];

interface PixelSpiderProps {
  onReady?: () => void;
}

export default function PixelSpider({ onReady }: PixelSpiderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    onReady?.();
  }, [onReady]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: W * PIXEL,
        height: H * PIXEL,
        imageRendering: "pixelated",
      }}
    >
      {IDLE.flatMap((row, y) =>
        row.map((val, x) => {
          if (val === 0) return null;
          let bg = "#1a1a2e";
          if (val === 2) bg = "#c9952a";
          if (val === 3) bg = "#e8e4df";
          return (
            <div
              key={`${x}-${y}`}
              className="absolute"
              style={{
                left: x * PIXEL,
                top: y * PIXEL,
                width: PIXEL,
                height: PIXEL,
                backgroundColor: bg,
              }}
            />
          );
        })
      )}
    </div>
  );
}
