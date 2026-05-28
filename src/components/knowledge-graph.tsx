"use client";

import { useEffect, useRef } from "react";

const CONCEPTS = [
  "memory", "learning", "patterns", "ideas", "knowledge",
  "connections", "recall", "insight", "context", "structure",
];

interface Node {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  r: number;
  opacity: number;
  phase: number;
  label: string | null;
  isCore: boolean;
}

interface Edge {
  from: number;
  to: number;
  baseOpacity: number;
  phase: number;
}

export default function KnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    let time = 0;
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let animId: number;

    function resize() {
      w = canvas!.width = window.innerWidth;
      h = canvas!.height = window.innerHeight;
    }

    function init() {
      resize();
      nodes = [];
      edges = [];

      const count = Math.min(28, Math.floor((w * h) / 50000));
      for (let i = 0; i < count; i++) {
        const isCore = i < 3;
        nodes.push({
          x: isCore ? w / 2 + (Math.random() - 0.5) * 180 : Math.random() * w,
          y: isCore ? h / 2 + (Math.random() - 0.5) * 180 : Math.random() * h,
          baseX: 0,
          baseY: 0,
          r: isCore ? 2.5 + Math.random() * 1.5 : 1.2 + Math.random() * 2,
          opacity: 0.15 + Math.random() * 0.25,
          phase: Math.random() * Math.PI * 2,
          label: i < 6 ? CONCEPTS[i] : null,
          isCore,
        });
        nodes[i].baseX = nodes[i].x;
        nodes[i].baseY = nodes[i].y;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const threshold = Math.min(280, w * 0.18);
          if (dist < threshold) {
            edges.push({
              from: i,
              to: j,
              baseOpacity: 0.03 + (1 - dist / threshold) * 0.08,
              phase: Math.random() * Math.PI * 2,
            });
          }
        }
      }
    }

    function draw() {
      time += 0.006;
      ctx!.clearRect(0, 0, w, h);

      // gradient bg
      const grad = ctx!.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
      grad.addColorStop(0, "#0a0a16");
      grad.addColorStop(1, "#060610");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, w, h);

      // update positions (gentle drift)
      for (const node of nodes) {
        node.x = node.baseX + Math.sin(time * 0.4 + node.phase) * 12;
        node.y = node.baseY + Math.cos(time * 0.35 + node.phase * 1.2) * 8;
      }

      // edges
      for (const edge of edges) {
        const a = nodes[edge.from];
        const b = nodes[edge.to];
        const pulse = Math.sin(time * 0.7 + edge.phase) * 0.5 + 0.5;
        const opacity = edge.baseOpacity * (0.4 + pulse * 0.6);

        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.strokeStyle = `rgba(200, 195, 184, ${opacity})`;
        ctx!.lineWidth = 0.6;
        ctx!.stroke();
      }

      // nodes
      for (const node of nodes) {
        const pulse = Math.sin(time * 1.1 + node.phase) * 0.5 + 0.5;
        const opacity = node.opacity * (0.5 + pulse * 0.5);

        // glow
        if (node.r > 1.5) {
          const glowR = node.r * 5;
          const glow = ctx!.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
          glow.addColorStop(0, `rgba(232, 197, 106, ${opacity * 0.15})`);
          glow.addColorStop(1, "rgba(232, 197, 106, 0)");
          ctx!.fillStyle = glow;
          ctx!.beginPath();
          ctx!.arc(node.x, node.y, glowR, 0, Math.PI * 2);
          ctx!.fill();
        }

        // dot
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx!.fillStyle = node.isCore
          ? `rgba(232, 197, 106, ${opacity})`
          : `rgba(200, 195, 184, ${opacity})`;
        ctx!.fill();

        // label
        if (node.label) {
          ctx!.font = "400 9px Inter, system-ui, sans-serif";
          ctx!.textAlign = "center";
          ctx!.fillStyle = `rgba(200, 195, 184, ${opacity * 0.5})`;
          ctx!.fillText(node.label, node.x, node.y + node.r + 11);
        }
      }

      // occasional flash
      if (Math.random() < 0.0015 && edges.length > 0) {
        const edge = edges[Math.floor(Math.random() * edges.length)];
        const a = nodes[edge.from];
        const b = nodes[edge.to];
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.strokeStyle = "rgba(232, 197, 106, 0.25)";
        ctx!.lineWidth = 1.2;
        ctx!.stroke();
        setTimeout(() => {}, 100);
      }

      animId = requestAnimationFrame(draw);
    }

    init();
    draw();

    const handleResize = () => {
      resize();
      for (const node of nodes) {
        node.baseX = (node.baseX / w) * canvas!.width;
        node.baseY = (node.baseY / h) * canvas!.height;
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
