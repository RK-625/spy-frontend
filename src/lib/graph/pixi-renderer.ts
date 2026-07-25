/**
 * Pixi v8 graph renderer — A′ world-space bake + B SDF discs + D overscan cull.
 *
 * HARD RULE: camera stays outside Pixi.
 * - Never pan/zoom with stage.scale / stage.position for world camera.
 * - Bake geometry in world coords (z=1) once per data change (or overscan miss).
 * - Every frame: scale graphContent by camera.zoom and position via RTC formula.
 *
 * A′ (world-space bake):
 * - bakeGraphGeometry() draws at reference zoom 1.
 *   nodeR_world = nodeScreenRadius(rank, 1), band_world = edgeBandWidth(1, ...)
 * - applyCameraTransform() sets graphContent.scale = z, position = RTC offset.
 * - Low zoom (z < EDGE_VIS_ZOOM_FLOOR): constant-screen-width hairline underlay
 *   so connections stay visible while DotStream is subpixel; mid/high zoom underlay off.
 * - No re-bake on pan/zoom while the tight viewport stays inside baked overscan.
 * - screen stroke width = z * ringWidth(1) ≈ correct under pure scale.
 *
 * B — SDF disc quads (dot-circle-batch.ts):
 * - DotCircleBatch emits 4-vert AA quads + GlProgram fragment disc (fwidth AA).
 * - Fan fallback (MIN_SEGMENTS=32) if Shader/GlProgram init or first Mesh fails.
 *
 * D — Overscan viewport cull (this file):
 * - On bake: world viewport AABB with margin fraction 1.0 (100% each side).
 * - Cull edges whose segment AABB (pad = max node radii + band at z=1) misses.
 * - Cull nodes outside the expanded AABB (radius-padded).
 * - Store bakedOverscan after bake; drawFrame rebakes when tight viewport
 *   (margin 0) is not contained in bakedOverscan.
 * - Camera transform still applied every frame.
 *
 * C — Worker bake: DEFERRED until p95BakeMs > ~16ms.
 *
 * Red lines (do NOT reintroduce):
 * - half resolution / setInteractionQuality that lowers quality
 * - Particle soft/nearest sprites for edges
 * - lodMul / skipOuterLats
 * - scale stage or root (only graphContent)
 * - screen-px floor on synapse gap (E′)
 * - packing floors of 0.15 (keep 1e-6)
 * - raising EDGE_BASE_BAND for overview (use hairline underlay instead)
 * - non-uniform edgeLayer scale (detaches streams from nodes)
 */

import { Application, Container, Graphics } from "pixi.js";

import type { RtcCamera } from "@/lib/graph/rtc-camera";
import type { GraphData, GraphNode } from "@/lib/graph/graph-data";
import { recomputeIncidence } from "@/lib/graph/graph-data";
import {
  drawEdgeDots,
  insetSegment,
  type DotEmit,
  type RimSlot,
} from "@/lib/graph/draw-arrow";
import { DotCircleBatch } from "@/lib/graph/dot-circle-batch";
import {
  NODE_DRAW_MIN_PX,
  edgeBandWidth,
  nodeRingWidth,
  nodeScreenRadius,
  usableZoom,
} from "@/lib/graph/graph-scale";
import { applyRimLock } from "@/lib/graph/rim-lock";
import {
  GRAPH_BG,
  GRAPH_EDGE_PART_OF,
  GRAPH_EDGE_PART_OF_ALPHA,
  GRAPH_EDGE_RELATES,
  GRAPH_EDGE_RELATES_ALPHA,
  GRAPH_NODE_FILL,
  GRAPH_NODE_FILL_ALPHA,
  GRAPH_NODE_RING,
  GRAPH_NODE_RING_ALPHA,
} from "@/lib/graph/graph-style";

// -----------------------------------------------------------------------
// D — World AABB helpers for overscan cull
// -----------------------------------------------------------------------

/** Axis-aligned bounding box in world coordinates. */
type WorldAabb = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/**
 * Overscan margin as a fraction of the viewport size on each side.
 * Used only when edge count exceeds BAKE_ALL_MAX_EDGES.
 * Larger margin = fewer re-bakes when zooming out aggressively.
 */
const OVERSCAN_MARGIN = 2.0;

/**
 * Below this edge count, bake the entire graph (no spatial cull).
 * Avoids full DotStream re-bake on every aggressive zoom-out for mock/small graphs.
 */
const BAKE_ALL_MAX_EDGES = 256;

/** Infinite AABB for bake-all mode (tight viewport always "contained"). */
const BAKE_ALL_OVERSCAN: WorldAabb = {
  minX: -1e30,
  minY: -1e30,
  maxX: 1e30,
  maxY: 1e30,
};

/**
 * Low-zoom hairline underlay (constant screen width) while DotStream is subpixel.
 * Full strength below FADE_START; linear alpha fade to 0 at FLOOR so mid-zoom
 * (z≈4–7) does not show a solid line on top of emerging DotStream.
 * Does NOT scale edgeLayer (that detaches endpoints). Does NOT fatten band.
 */
const EDGE_UNDERLAY_FADE_START = 2.5;
const EDGE_VIS_ZOOM_FLOOR = 5.5;

/** Screen-space hairline width (px) for low-zoom underlay. */
const EDGE_UNDERLAY_SCREEN_PX = 1.15;

/**
 * World AABB of the camera viewport, optionally expanded by margin fraction
 * of full viewport size on each side.
 *
 * margin 0 → exact visible world rect
 * margin 1 → +100% viewport width/height on every side
 */
function worldViewportAabb(camera: RtcCamera, margin: number): WorldAabb {
  const z = usableZoom(camera.zoom);
  const camX = Number.isFinite(camera.camX) ? camera.camX : 0;
  const camY = Number.isFinite(camera.camY) ? camera.camY : 0;
  const vpW = Number.isFinite(camera.viewportWidth) ? camera.viewportWidth : 0;
  const vpH = Number.isFinite(camera.viewportHeight)
    ? camera.viewportHeight
    : 0;

  const halfW = vpW / (2 * z);
  const halfH = vpH / (2 * z);
  const m = Number.isFinite(margin) && margin > 0 ? margin : 0;
  // Expand each side by m * full world-viewport extent
  const expandX = halfW * 2 * m;
  const expandY = halfH * 2 * m;

  return {
    minX: camX - halfW - expandX,
    maxX: camX + halfW + expandX,
    minY: camY - halfH - expandY,
    maxY: camY + halfH + expandY,
  };
}

/** True when every point of `inner` lies inside `outer`. */
function aabbContains(outer: WorldAabb, inner: WorldAabb): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY
  );
}

/** True when two AABBs overlap (inclusive edges). */
function aabbIntersects(a: WorldAabb, b: WorldAabb): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

/** Segment AABB expanded by pad on every side. */
function segmentAabb(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pad: number
): WorldAabb {
  const p = pad > 0 ? pad : 0;
  return {
    minX: Math.min(x0, x1) - p,
    maxX: Math.max(x0, x1) + p,
    minY: Math.min(y0, y1) - p,
    maxY: Math.max(y0, y1) + p,
  };
}

/** Circle (cx,cy,r) completely outside aabb → true (cull). */
function circleOutsideAabb(
  cx: number,
  cy: number,
  r: number,
  aabb: WorldAabb
): boolean {
  const rad = r > 0 ? r : 0;
  return (
    cx + rad < aabb.minX ||
    cx - rad > aabb.maxX ||
    cy + rad < aabb.minY ||
    cy - rad > aabb.maxY
  );
}

export type PerfStats = {
  lastBakeMs: number;
  bakeCount: number;
  p95BakeMs: number;
  mode: "transform" | "bake";
};

export type PixiRendererHandle = {
  mount: (host: HTMLElement) => void | Promise<void>;
  destroy: () => void;
  setGraphData: (graphData: GraphData) => void;
  setCamera: (camera: RtcCamera) => void;
  render: () => void;
  /** Returns bake timing stats. */
  getPerfStats: () => PerfStats;
  /**
   * Interaction quality toggle (API kept for graph-canvas settle path).
   * No-op: world-bake + GPU vector batches already make interaction cheap.
   */
  setInteractionQuality: (mode: "full" | "fast") => void;
};

export type CreatePixiRendererOptions = {
  background?: number;
};

/** Max bake timing samples for P95. */
const PERF_SAMPLE_MAX = 64;

export function createPixiRenderer(
  options: CreatePixiRendererOptions = {}
): PixiRendererHandle {
  const background = options.background ?? GRAPH_BG;

  let app: Application | null = null;
  /** Hairline underlay for low-zoom visibility (under DotStream). */
  let edgeUnderlay: Graphics | null = null;
  let edgeLayer: Container | null = null;
  let nodeLayer: Graphics | null = null;
  let root: Container | null = null;
  let graphContent: Container | null = null;
  let graphData: GraphData | null = null;
  let camera: RtcCamera | null = null;
  let nodesByIdCache: Map<string, GraphNode> = new Map();
  let rimSlotCache: Map<string, Map<string, RimSlot>> = new Map();
  let isMounted = false;
  let isDestroyed = false;

  let topologyDirty = true;
  /** False until first successful bake. */
  let hasBaked = false;
  /**
   * World AABB used at last bake (viewport + OVERSCAN_MARGIN).
   * Null until first bake. drawFrame rebakes when tight viewport escapes this.
   */
  let bakedOverscan: WorldAabb | null = null;

  let edgeDotBatch: DotCircleBatch | null = null;

  // -----------------------------------------------------------------------
  // Perf instrumentation (Phase 1)
  // -----------------------------------------------------------------------
  let lastBakeMs = 0;
  let bakeCount = 0;
  let bakeSamples: number[] = [];
  /** Last drawFrame path — for getPerfStats().mode */
  let lastMode: "transform" | "bake" = "bake";

  function recordBakeTiming(ms: number): void {
    lastBakeMs = ms;
    bakeCount++;
    bakeSamples.push(ms);
    if (bakeSamples.length > PERF_SAMPLE_MAX) {
      bakeSamples.shift();
    }
    // console.debug only when bake > 8ms (no spam per spec)
    if (ms > 8) {
      console.debug(`[graph] bake took ${ms.toFixed(1)}ms (#${bakeCount})`);
    }
  }

  /** P95 from the sorted sample window. */
  function p95BakeMs(): number {
    const n = bakeSamples.length;
    if (n === 0) return 0;
    const sorted = [...bakeSamples].sort((a, b) => a - b);
    const idx = Math.ceil(n * 0.95) - 1;
    return sorted[Math.max(0, Math.min(idx, n - 1))];
  }

  /** Rebuild rimSlotCache from current graphData node rimOccupations. */
  function rebuildRimSlotCache(): void {
    if (!graphData) {
      rimSlotCache = new Map();
      return;
    }
    const map = new Map<string, Map<string, RimSlot>>();
    for (const node of graphData.nodes) {
      const slotMap = new Map<string, RimSlot>();
      for (const occ of node.rimOccupations) {
        slotMap.set(occ.edgeId, {
          midAngle: occ.midAngle,
          halfSpan: occ.halfSpan,
        });
      }
      map.set(node.id, slotMap);
    }
    rimSlotCache = map;
  }

  /**
   * Bake graph geometry in world coords (z=1) under graphContent.
   *
   * D: only geometry intersecting the overscanned world viewport is baked.
   * Nodes → Graphics at world (x,y) with r_world = nodeScreenRadius(rank, 1).
   * Edges → DotCircleBatch at world positions, band at z=1.
   */
  function bakeGraphGeometry(): void {
    if (
      !edgeLayer ||
      !nodeLayer ||
      !graphData ||
      !edgeDotBatch ||
      !graphContent ||
      !camera
    ) {
      return;
    }

    const t0 = performance.now();

    // Reset container to identity before baking in world coords.
    graphContent.scale.set(1, 1);
    graphContent.position.set(0, 0);
    edgeLayer.scale.set(1, 1);
    nodeLayer.scale.set(1, 1);
    if (edgeUnderlay) edgeUnderlay.clear();

    const gNode = nodeLayer;
    gNode.clear();

    const batch = edgeDotBatch;
    batch.begin();

    const nodesById = nodesByIdCache;

    // recomputeIncidence + RimLock at reference zoom 1 (world-coordinate sizes)
    recomputeIncidence(graphData);
    applyRimLock(graphData, 1);
    rebuildRimSlotCache();
    topologyDirty = false;

    const rimSlotsByNode = rimSlotCache;

    // Small graphs: bake everything so aggressive zoom never re-samples DotStream.
    // Large graphs: spatial overscan cull (rebake only when leaving overscan).
    const bakeAll = graphData.edges.length <= BAKE_ALL_MAX_EDGES;
    const cullAabb = bakeAll
      ? null
      : worldViewportAabb(camera, OVERSCAN_MARGIN);
    bakedOverscan = bakeAll ? BAKE_ALL_OVERSCAN : cullAabb;

    const emit: DotEmit = (cx, cy, r, color, alpha) => {
      batch.add(cx, cy, r, color, alpha);
    };

    // Edges — optional cull by segment AABB + pad (max radii + band at z=1)
    for (const edge of graphData.edges) {
      const src = nodesById.get(edge.source);
      const tgt = nodesById.get(edge.target);
      if (!src || !tgt) continue;

      const sourceRank = src.rank ?? 0;
      const targetRank = tgt.rank ?? 0;
      const radiusSource = nodeScreenRadius(sourceRank, 1);
      const radiusTarget = nodeScreenRadius(targetRank, 1);

      if (edge.type === "PART_OF") {
        const band = edgeBandWidth(1, "part_of", sourceRank, targetRank);
        if (cullAabb) {
          const pad = Math.max(radiusSource, radiusTarget) + band;
          const edgeBox = segmentAabb(src.x, src.y, tgt.x, tgt.y, pad);
          if (!aabbIntersects(edgeBox, cullAabb)) continue;
        }

        const segment = insetSegment(
          { x: tgt.x, y: tgt.y },
          { x: src.x, y: src.y },
          radiusTarget,
          radiusSource
        );
        if (!segment) continue;
        const srcSlots = rimSlotsByNode.get(src.id);
        const tgtSlots = rimSlotsByNode.get(tgt.id);
        drawEdgeDots(emit, segment.start, segment.end, {
          color: GRAPH_EDGE_PART_OF,
          alpha: GRAPH_EDGE_PART_OF_ALPHA,
          density: "firm",
          band,
          fromCenter: { x: tgt.x, y: tgt.y },
          fromRadius: radiusTarget,
          toCenter: { x: src.x, y: src.y },
          toRadius: radiusSource,
          sourceRim: tgtSlots?.get(edge.id),
          targetRim: srcSlots?.get(edge.id),
        });
      } else {
        const band = edgeBandWidth(1, "relates", sourceRank, targetRank);
        if (cullAabb) {
          const pad = Math.max(radiusSource, radiusTarget) + band;
          const edgeBox = segmentAabb(src.x, src.y, tgt.x, tgt.y, pad);
          if (!aabbIntersects(edgeBox, cullAabb)) continue;
        }

        const segment = insetSegment(
          { x: src.x, y: src.y },
          { x: tgt.x, y: tgt.y },
          radiusSource,
          radiusTarget
        );
        if (!segment) continue;
        const srcSlots = rimSlotsByNode.get(src.id);
        const tgtSlots = rimSlotsByNode.get(tgt.id);
        drawEdgeDots(emit, segment.start, segment.end, {
          color: GRAPH_EDGE_RELATES,
          alpha: GRAPH_EDGE_RELATES_ALPHA,
          density: "soft",
          band,
          fromCenter: { x: src.x, y: src.y },
          fromRadius: radiusSource,
          toCenter: { x: tgt.x, y: tgt.y },
          toRadius: radiusTarget,
          sourceRim: srcSlots?.get(edge.id),
          targetRim: tgtSlots?.get(edge.id),
        });
      }
    }

    batch.flush(edgeLayer);

    // Nodes — optional cull outside expanded AABB (radius-padded)
    for (const node of graphData.nodes) {
      const radius = nodeScreenRadius(node.rank, 1);
      if (!Number.isFinite(radius) || radius < NODE_DRAW_MIN_PX) continue;
      if (
        cullAabb &&
        circleOutsideAabb(node.x, node.y, radius, cullAabb)
      ) {
        continue;
      }

      gNode.circle(node.x, node.y, radius);
      gNode.fill({ color: GRAPH_NODE_FILL, alpha: GRAPH_NODE_FILL_ALPHA });
      gNode.circle(node.x, node.y, radius);
      gNode.stroke({
        width: nodeRingWidth(1),
        color: GRAPH_NODE_RING,
        alpha: GRAPH_NODE_RING_ALPHA,
      });
    }

    hasBaked = true;
    lastMode = "bake";
    recordBakeTiming(performance.now() - t0);
  }

  /**
   * Constant-screen-width hairlines when DotStream is subpixel (z < floor).
   * Drawn in world space under graphContent: local stroke = screenPx / z
   * so after parent scale z, screen width ≈ EDGE_UNDERLAY_SCREEN_PX.
   * Endpoints stay on node centers — no detachment.
   */
  function updateEdgeUnderlay(z: number): void {
    if (!edgeUnderlay || !graphData) return;
    edgeUnderlay.clear();
    if (!(z > 0) || z >= EDGE_VIS_ZOOM_FLOOR) return;

    // Fade out as DotStream becomes readable — avoid solid line + dots dual.
    const span = EDGE_VIS_ZOOM_FLOOR - EDGE_UNDERLAY_FADE_START;
    let fade = 1;
    if (span > 0 && z > EDGE_UNDERLAY_FADE_START) {
      fade = 1 - (z - EDGE_UNDERLAY_FADE_START) / span;
      if (fade <= 0) return;
    }

    const strokeLocal = EDGE_UNDERLAY_SCREEN_PX / z;
    if (!(strokeLocal > 0) || !Number.isFinite(strokeLocal)) return;

    const nodesById = nodesByIdCache;
    const g = edgeUnderlay;

    for (const edge of graphData.edges) {
      const src = nodesById.get(edge.source);
      const tgt = nodesById.get(edge.target);
      if (!src || !tgt) continue;

      const isPartOf = edge.type === "PART_OF";
      const color = isPartOf ? GRAPH_EDGE_PART_OF : GRAPH_EDGE_RELATES;
      const base = isPartOf
        ? GRAPH_EDGE_PART_OF_ALPHA
        : GRAPH_EDGE_RELATES_ALPHA;
      const alpha = base * 0.75 * fade;

      g.moveTo(src.x, src.y);
      g.lineTo(tgt.x, tgt.y);
      g.stroke({ width: strokeLocal, color, alpha });
    }
  }

  /**
   * Transform graphContent to match RTC camera.
   * World geometry baked at z=1; container scale = usableZoom,
   * position = RTC offset so screen(container) ≈ worldToScreen.
   *
   *   screen = (world - cam) * z + vp/2
   *   ⇒ container tx = -cam * z + vp/2, scale = z
   *
   * Low-zoom overview: hairline underlay (constant screen width) when
   * z < EDGE_VIS_ZOOM_FLOOR. DotStream scale matches nodes always.
   */
  function applyCameraTransform(): void {
    if (!graphContent || !camera) return;

    const z = usableZoom(camera.zoom);
    const camX = Number.isFinite(camera.camX) ? camera.camX : 0;
    const camY = Number.isFinite(camera.camY) ? camera.camY : 0;

    graphContent.scale.set(z, z);
    graphContent.position.set(
      -camX * z + camera.viewportWidth / 2,
      -camY * z + camera.viewportHeight / 2
    );

    // Never non-uniform scale edgeLayer vs nodes — that detaches streams.
    if (edgeLayer) edgeLayer.scale.set(1, 1);
    if (nodeLayer) nodeLayer.scale.set(1, 1);

    updateEdgeUnderlay(z);
  }

  function drawFrame(): void {
    if (
      !isMounted ||
      isDestroyed ||
      !edgeLayer ||
      !nodeLayer ||
      !camera ||
      !graphData ||
      !graphContent
    ) {
      return;
    }

    // Bake on data change, first frame, or when tight viewport escapes overscan
    if (topologyDirty || !hasBaked) {
      bakeGraphGeometry();
    } else if (
      bakedOverscan &&
      !aabbContains(bakedOverscan, worldViewportAabb(camera, 0))
    ) {
      bakeGraphGeometry();
    } else {
      lastMode = "transform";
    }

    // Apply camera transform every frame
    applyCameraTransform();
  }

  return {
    async mount(host: HTMLElement): Promise<void> {
      if (isDestroyed) return;
      if (isMounted) return;

      const application = new Application();
      await application.init({
        background,
        backgroundAlpha: 1,
        resizeTo: host,
        antialias: true,
        autoDensity: true,
        resolution:
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        preference: "webgl",
      });

      if (isDestroyed) {
        application.destroy({ removeView: true }, { children: true });
        return;
      }

      app = application;
      host.appendChild(application.canvas);

      // stage → root → graphContent → [edgeUnderlay, edgeLayer, nodeLayer]
      root = new Container();
      graphContent = new Container();

      edgeUnderlay = new Graphics();
      edgeLayer = new Container();
      edgeDotBatch = new DotCircleBatch();
      nodeLayer = new Graphics();

      graphContent.addChild(edgeUnderlay);
      graphContent.addChild(edgeLayer);
      graphContent.addChild(nodeLayer);
      root.addChild(graphContent);
      application.stage.addChild(root);

      isMounted = true;
    },

    destroy(): void {
      isDestroyed = true;
      isMounted = false;

      if (edgeDotBatch) {
        edgeDotBatch.destroy();
        edgeDotBatch = null;
      }

      if (app) {
        app.destroy({ removeView: true }, { children: true });
        app = null;
      }

      edgeUnderlay = null;
      edgeLayer = null;
      nodeLayer = null;
      graphContent = null;
      root = null;
      graphData = null;
      camera = null;
      nodesByIdCache = new Map();
      rimSlotCache = new Map();
      topologyDirty = true;
      hasBaked = false;
      bakedOverscan = null;
    },

    setGraphData(nextGraphData: GraphData): void {
      graphData = nextGraphData;
      nodesByIdCache = new Map(nextGraphData.nodes.map((n) => [n.id, n]));
      topologyDirty = true;
    },

    setCamera(nextCamera: RtcCamera): void {
      camera = nextCamera;
    },

    render(): void {
      if (!isMounted || isDestroyed) return;
      drawFrame();
    },

    getPerfStats(): PerfStats {
      return {
        lastBakeMs,
        bakeCount,
        p95BakeMs: p95BakeMs(),
        mode: lastMode,
      };
    },

    /**
     * No-op by design. A′ world-bake + GPU vector batches handle perf;
     * resolution downscale or quality toggle is unnecessary.
     */
    setInteractionQuality(_mode: "full" | "fast"): void {
      // intentionally empty — see file header
    },
  };
}
