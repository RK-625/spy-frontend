"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import {
  findNodeColors,
  findNodeRanks,
  findNodeSizes,
} from "@/lib/graph-functions";
import type { MemoryLinkType, MemoryNode } from "@/types/graph-schema";
import type { GraphApiResponse } from "@/types/graph-topology";

import { NodeDetailDialog } from "./node-detail-dialog";

/** Deepest register — same family as former GRAPH_BG (0x0a0a0c). */
const GRAPH_BG = "#0a0a0c";
const POINT_COLOR = "#c8acfb";
const LINK_PARENT_OF = "#8a96b4";
const LINK_RELATES = "#9a7ab8";
const LINK_PARENT_OF_STRENGTH = 1;
const LINK_RELATES_STRENGTH = 0.3;
const SIMULATION_REPULSION = 0.1;
/** Rest length as a multiple of source+target radius. Parent hugs; relates stretches. */
const PARENT_LINK_LENGTH = 1.12;
const RELATES_LINK_LENGTH = 4.4;
const ARROW_SIZE_SCALE = 3;
// Width left to Cosmograph (`linkDefaultWidth`, typically 1).
// const LINK_PARENT_OF_WIDTH = 0.8;
// const LINK_RELATES_WIDTH = 0.35;

/** d3-force many-body is signed (repel = negative). Cosmos repulsion 0.1 ≈ default −30. */
const D3_MANY_BODY_STRENGTH = SIMULATION_REPULSION > 0 ? -30 : 0;

type D3SimNode = SimulationNodeDatum & {
  id: string;
  color: string;
  size: number;
};

type D3SimLink = SimulationLinkDatum<D3SimNode> & {
  type: MemoryLinkType;
  color: string;
  strength: number;
  arrow: boolean;
};

type D3Topology = {
  nodes: Array<{ id: string; color: string; size: number }>;
  links: Array<{
    source: string;
    target: string;
    type: MemoryLinkType;
    color: string;
    strength: number;
    arrow: boolean;
  }>;
};

type DrawnNode = {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
};

type DrawnLink = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  arrow: boolean;
};

type D3Frame = {
  nodes: DrawnNode[];
  links: DrawnLink[];
};

type Camera = {
  tx: number;
  ty: number;
  k: number;
};

function isSimNode(
  value: D3SimNode | string | number,
): value is D3SimNode {
  return typeof value === "object" && value !== null && "id" in value;
}

function copyFrame(nodes: D3SimNode[], links: D3SimLink[]): D3Frame {
  const drawnNodes: DrawnNode[] = [];
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    drawnNodes.push({
      id: node.id,
      x: node.x,
      y: node.y,
      color: node.color,
      size: node.size,
    });
  }

  const drawnLinks: DrawnLink[] = [];
  for (const link of links) {
    if (!isSimNode(link.source) || !isSimNode(link.target)) continue;
    if (
      link.source.x == null ||
      link.source.y == null ||
      link.target.x == null ||
      link.target.y == null
    ) {
      continue;
    }
    drawnLinks.push({
      key: `${link.source.id}->${link.target.id}`,
      x1: link.source.x,
      y1: link.source.y,
      x2: link.target.x,
      y2: link.target.y,
      color: link.color,
      arrow: link.arrow,
    });
  }

  return { nodes: drawnNodes, links: drawnLinks };
}

/** Center + scale so a tiny cluster stays a modest island, not edge-to-edge. */
function fitCamera(
  nodes: D3SimNode[],
  width: number,
  height: number,
): Camera {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    minX = Math.min(minX, node.x - node.size);
    minY = Math.min(minY, node.y - node.size);
    maxX = Math.max(maxX, node.x + node.size);
    maxY = Math.max(maxY, node.y + node.size);
  }
  if (!Number.isFinite(minX) || width <= 0 || height <= 0) {
    return { tx: 0, ty: 0, k: 1 };
  }

  const bw = Math.max(maxX - minX, 1);
  const bh = Math.max(maxY - minY, 1);
  const paddedK = Math.min(width / (bw * 1.35), height / (bh * 1.35));
  const islandK = (Math.min(width, height) * 0.42) / Math.max(bw, bh);
  const k = Math.max(0.05, Math.min(paddedK, islandK, 20));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { tx: width / 2 - k * cx, ty: height / 2 - k * cy, k };
}

function clampZoom(k: number): number {
  return Math.min(20, Math.max(0.05, k));
}

/**
 * Live-only knowledge graph host (D3-force + SVG).
 * GET `/api/d3` → map points/links → D3-force owns layout; SVG owns camera + draw.
 * Empty KB / fetch error → blank canvas (no mock).
 */
export function D3Canvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const memoriesByIdRef = useRef<Map<string, MemoryNode>>(new Map());
  const cameraRef = useRef<Camera>({ tx: 0, ty: 0, k: 1 });
  const userMovedCameraRef = useRef(false);
  const panRef = useRef<{
    pointerId: number;
    px: number;
    py: number;
    tx: number;
    ty: number;
  } | null>(null);

  const [topology, setTopology] = useState<D3Topology | null>(null);
  const [frame, setFrame] = useState<D3Frame | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>({ tx: 0, ty: 0, k: 1 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [selectedNode, setSelectedNode] = useState<MemoryNode | null>(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);

  const applyCamera = useCallback((next: Camera) => {
    cameraRef.current = next;
    setCamera(next);
  }, []);

  const handleNodeDialogOpenChange = (open: boolean) => {
    setNodeDialogOpen(open);
    if (!open) setSelectedNode(null);
  };

  const handlePointClick = useCallback((id: string) => {
    const memory = memoriesByIdRef.current.get(id);
    if (memory == null) return;
    setSelectedNode(memory);
    setNodeDialogOpen(true);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (host == null) return;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      setViewport((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/d3");
        const data = (await res.json()) as GraphApiResponse;
        if (cancelled) return;

        if (!data.ok || data.memories.length === 0) {
          console.warn(
            "[d3] live feed unavailable:",
            data.error ?? res.status,
          );
          setTopology(null);
          setFrame(null);
          return;
        }
        const byId = new Map<string, MemoryNode>();
        for (const memory of data.memories) {
          byId.set(memory.id, memory);
        }
        memoriesByIdRef.current = byId;

        const ids = data.memories.map((memory) => memory.id);
        const hierarchy = findNodeRanks(ids, data.links);
        const colors = findNodeColors(hierarchy);
        const sizes = findNodeSizes(hierarchy);

        const nodes = data.memories.map((memory) => ({
          id: memory.id,
          label: memory.name,
          color: colors.get(memory.id) ?? POINT_COLOR,
          size: sizes.get(memory.id) ?? 1,
        }));
        const links = data.links.map((link) => {
          const isParentOf = link.type === "PARENT_OF";
          return {
            source: link.source,
            target: link.target,
            type: link.type,
            color: isParentOf ? LINK_PARENT_OF : LINK_RELATES,
            strength: isParentOf
              ? LINK_PARENT_OF_STRENGTH
              : LINK_RELATES_STRENGTH,
            arrow: isParentOf,
          };
        });

        setTopology({
          nodes: nodes.map(({ id, color, size }) => ({ id, color, size })),
          links,
        });
      } catch (err: unknown) {
        if (cancelled) return;
        console.warn("[d3] live feed fetch failed:", err);
        setTopology(null);
        setFrame(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (topology == null) {
      setFrame(null);
      return;
    }
    const { width, height } = viewport;
    if (width <= 0 || height <= 0) return;

    const nodes: D3SimNode[] = topology.nodes.map((node) => ({
      id: node.id,
      color: node.color,
      size: node.size,
    }));
    const links: D3SimLink[] = topology.links.map((link) => ({
      source: link.source,
      target: link.target,
      type: link.type,
      color: link.color,
      strength: link.strength,
      arrow: link.arrow,
    }));

    const simulation = forceSimulation<D3SimNode, D3SimLink>(nodes)
      .force(
        "link",
        forceLink<D3SimNode, D3SimLink>(links)
          .id((d) => d.id)
          .distance((link) => {
            const source = isSimNode(link.source) ? link.source.size : 8;
            const target = isSimNode(link.target) ? link.target.size : 8;
            const rest = source + target;
            return (
              rest *
              (link.type === "PARENT_OF"
                ? PARENT_LINK_LENGTH
                : RELATES_LINK_LENGTH)
            );
          })
          .strength((l) => l.strength),
      )
      .force("charge", forceManyBody<D3SimNode>().strength(D3_MANY_BODY_STRENGTH))
      .force(
        "collide",
        forceCollide<D3SimNode>().radius((d) => d.size + 0.6),
      )
      .force("center", forceCenter(width / 2, height / 2));

    userMovedCameraRef.current = false;
    let fittedOnce = false;
    const followLayout = () => {
      if (userMovedCameraRef.current) return;
      applyCamera(fitCamera(nodes, width, height));
    };
    simulation.on("tick", () => {
      setFrame(copyFrame(nodes, links));
      if (!fittedOnce) {
        fittedOnce = true;
        followLayout();
      }
    });
    simulation.on("end", followLayout);

    return () => {
      simulation.on("tick", null);
      simulation.on("end", null);
      simulation.stop();
    };
  }, [topology, viewport, applyCamera]);

  useEffect(() => {
    const host = hostRef.current;
    if (host == null) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = host.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const current = cameraRef.current;
      const nextK = clampZoom(current.k * Math.exp(-event.deltaY * 0.0015));
      const next: Camera = {
        k: nextK,
        tx: mx - ((mx - current.tx) * nextK) / current.k,
        ty: my - ((my - current.ty) * nextK) / current.k,
      };
      userMovedCameraRef.current = true;
      applyCamera(next);
    };

    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [applyCamera]);

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("[data-node-id]") != null
    ) {
      return;
    }
    panRef.current = {
      pointerId: event.pointerId,
      px: event.clientX,
      py: event.clientY,
      tx: cameraRef.current.tx,
      ty: cameraRef.current.ty,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    if (pan == null || pan.pointerId !== event.pointerId) return;
    userMovedCameraRef.current = true;
    applyCamera({
      k: cameraRef.current.k,
      tx: pan.tx + (event.clientX - pan.px),
      ty: pan.ty + (event.clientY - pan.py),
    });
  };

  const endPan = (event: PointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    if (pan == null || pan.pointerId !== event.pointerId) return;
    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPanning(false);
  };

  const { k } = camera;
  const strokeWidth = 1 / k;
  const markerSize = ARROW_SIZE_SCALE / k;

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-background text-text-primary">
      <div
        ref={hostRef}
        className="absolute inset-0"
        aria-label="Knowledge graph canvas. Click a node to inspect. Drag to pan, wheel to zoom."
      >
        {frame != null ? (
          <svg
            ref={svgRef}
            className="h-full w-full"
            style={{
              background: GRAPH_BG,
              cursor: panning ? "grabbing" : "grab",
              touchAction: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            <defs>
              <marker
                id="d3-parent-of-arrow"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerWidth={markerSize}
                markerHeight={markerSize}
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={LINK_PARENT_OF} />
              </marker>
            </defs>
            <g
              transform={`translate(${camera.tx},${camera.ty}) scale(${camera.k})`}
            >
              {frame.links.map((link) => (
                <line
                  key={link.key}
                  x1={link.x1}
                  y1={link.y1}
                  x2={link.x2}
                  y2={link.y2}
                  stroke={link.color}
                  strokeWidth={strokeWidth}
                  markerEnd={
                    link.arrow ? "url(#d3-parent-of-arrow)" : undefined
                  }
                />
              ))}
              {frame.nodes.map((node) => {
                const hovered = node.id === hoveredId;
                return (
                  <g key={node.id} data-node-id={node.id}>
                    {hovered ? (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={(node.size + 3) / k}
                        fill="none"
                        stroke="#e8dff8"
                        strokeWidth={1.5 / k}
                        pointerEvents="none"
                      />
                    ) : null}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.size / k}
                      fill={node.color}
                      style={{ cursor: "pointer" }}
                      onPointerEnter={() => setHoveredId(node.id)}
                      onPointerLeave={() =>
                        setHoveredId((current) =>
                          current === node.id ? null : current,
                        )
                      }
                      onClick={() => handlePointClick(node.id)}
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        ) : null}
      </div>

      <NodeDetailDialog
        node={selectedNode}
        open={nodeDialogOpen}
        onOpenChange={handleNodeDialogOpenChange}
      />

      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-3 sm:p-4"
        style={{ fontFamily: "var(--font-vt323), ui-monospace, monospace" }}
      >
        <div className="pointer-events-none max-w-[min(100%,20rem)] select-none">
          <div className="text-[15px] tracking-wide text-text-primary">
            Spy graph
          </div>
          <div className="mt-1 text-[11px] leading-snug tracking-wide text-text-dim">
            Click a node · drag to pan · wheel to zoom
          </div>
        </div>
      </header>
    </div>
  );
}
