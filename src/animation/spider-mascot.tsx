"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { initSpiderMascotAnimation } from "./spider/mascot";

export default function SpiderMascot({ onReady }: { onReady?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");

  useEffect(() => {
    fetch("/mascot-3d.svg")
      .then((res) => res.text())
      .then((text) => {
        setSvgContent(text);
        onReady?.();
      });
  }, [onReady]);

  useGSAP(
    () => {
      if (!svgContent || !containerRef.current) return;

      return initSpiderMascotAnimation({
        container: containerRef.current,
        glowEl: glowRef.current,
      });
    },
    { scope: containerRef, dependencies: [svgContent] }
  );


  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center justify-center select-none"
      style={{
        width: "300px",
        height: "300px",
      }}
    >
      {/* White canvas behind the mascot (sharp edges; component-local only). */}
      <div
        className="absolute inset-0"
        style={{
          background: "#ffffff",
          pointerEvents: "none",
        }}
      />

      {/* Purple ambient glow behind the spider */}
      <div
        ref={glowRef}
        className="absolute"
        style={{
          width: "450px",
          height: "450px",
          background:
            "radial-gradient(circle, rgba(98,42,221,0.15) 0%, transparent 65%)",
          pointerEvents: "none",
          transformOrigin: "center",
        }}
      />

      <div
        className="spider-svg-wrapper relative z-10 w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:overflow-visible"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
