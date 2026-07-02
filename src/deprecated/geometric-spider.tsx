"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

interface GeometricSpiderProps {
  onReady?: () => void;
}

const SVG_MARKUP = `<svg width="160" height="180" viewBox="0 0 160 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="relative z-10">
  <path d="M 60,80 L 50,90 L 48,100 L 50,110 L 55,118 L 65,122 L 75,124 L 85,124 L 95,122 L 105,118 L 110,110 L 112,100 L 110,90 L 100,80 L 90,76 L 80,74 L 70,76 Z" fill="#1c1c2e" stroke="rgba(200,195,184,0.08)" stroke-width="1"/>
  <path d="M 62,72 L 58,62 L 58,52 L 62,44 L 70,40 L 80,38 L 90,40 L 98,44 L 102,52 L 102,62 L 98,72 L 90,74 L 80,75 L 70,74 Z" fill="#1c1c2e" stroke="rgba(200,195,184,0.08)" stroke-width="1"/>
  <polyline class="leg" points="62,80 44,90 30,82 16,74" fill="none" stroke="#1c1c2e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline class="leg" points="58,92 36,96 20,94 6,88" fill="none" stroke="#1c1c2e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline class="leg" points="60,104 36,108 18,110 4,116" fill="none" stroke="#1c1c2e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline class="leg" points="64,114 42,124 26,130 12,138" fill="none" stroke="#1c1c2e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline class="leg" points="98,80 116,90 130,82 144,74" fill="none" stroke="#1c1c2e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline class="leg" points="102,92 124,96 140,94 154,88" fill="none" stroke="#1c1c2e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline class="leg" points="100,104 124,108 142,110 156,116" fill="none" stroke="#1c1c2e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline class="leg" points="96,114 118,124 134,130 148,138" fill="none" stroke="#1c1c2e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="68,58 60,46 56,36" fill="none" stroke="#1c1c2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="92,58 100,46 104,36" fill="none" stroke="#1c1c2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="60" y1="104" x2="100" y2="104" stroke="#c9952a" stroke-width="2" opacity="0.3"/>
  <line x1="62" y1="112" x2="98" y2="112" stroke="#c9952a" stroke-width="2" opacity="0.2"/>
  <circle cx="44" cy="90" r="2" fill="rgba(200,195,184,0.1)"/>
  <circle cx="116" cy="90" r="2" fill="rgba(200,195,184,0.1)"/>
  <circle cx="36" cy="96" r="2" fill="rgba(200,195,184,0.1)"/>
  <circle cx="124" cy="96" r="2" fill="rgba(200,195,184,0.1)"/>
  <circle cx="36" cy="108" r="2" fill="rgba(200,195,184,0.1)"/>
  <circle cx="124" cy="108" r="2" fill="rgba(200,195,184,0.1)"/>
  <circle cx="42" cy="124" r="2" fill="rgba(200,195,184,0.1)"/>
  <circle cx="118" cy="124" r="2" fill="rgba(200,195,184,0.1)"/>
</svg>`;

export default function GeometricSpider({ onReady }: GeometricSpiderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !glowRef.current) return;

    const container = containerRef.current;
    const svgEl = container.querySelector("svg");
    if (!svgEl) return;

    const tl = gsap.timeline({ repeat: -1, yoyo: true, ease: "sine.inOut" });

    tl.to(container, { y: -4, duration: 2.5 })
      .to(container, { y: 0, duration: 2.5 });

    gsap.to(glowRef.current, {
      scale: 1.15,
      opacity: 0.15,
      duration: 3,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });

    const legs = svgEl.querySelectorAll(".leg");
    if (legs.length) {
      gsap.to(legs, {
        rotation: (i) => (i % 2 === 0 ? 2 : -2),
        transformOrigin: "center",
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.2,
      });
    }

    onReady?.();

    return () => {
      tl.kill();
    };
  }, [onReady]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center justify-center">
      <div
        ref={glowRef}
        className="absolute  bg-neutral-400/5"
        style={{ width: 220, height: 220 }}
      />
      <div
        className="relative z-10 leading-none"
        dangerouslySetInnerHTML={{ __html: SVG_MARKUP }}
      />
    </div>
  );
}
