/**
 * Pixi v8 graph renderer.
 *
 * HARD RULE: camera stays outside Pixi.
 * - Never pan/zoom with stage.scale / stage.position for world camera.
 * - Project world → screen via RtcCamera each frame, then place graphics in
 *   screen space.
 *
 * Phase 0 perf:
 * - topologyDirty / zoomDirty: skip recomputeIncidence + applyRimLock on pure pan
 * - world AABB viewport culling for nodes and edges (still full clear/redraw)
 *
 * Phase 1 perf:
 * - Pan cache (A): pure-pan frames skip clear/redraw by translating graphContent
 *   container via -(cam-drawnCam)*zoom. Full redraw only when zoom changes,
 *   topology changes, overscan exhausted, or viewport resized (~5-20× pan).
 * - Frame hygiene (C): nodesById cache across frames; rimSlotCache built after
 *   RimLock; edgeLayer + nodeLayer split under graphContent container.
 *
 * Phase 2b (quality-first GPU vector circles):
 * - Edge DotStream uses DotCircleBatch: triangle-list circle meshes grouped by
 *   (color, quantized alpha) → few GPU draws, smooth at any zoom (adaptive
 *   segment count). No ParticleContainer / fixed bitmap sprites for edges.
 * - Interaction quality (B): setInteractionQuality is intentionally a no-op.
 *   Pan is already cheap via graphContent pan-cache; edge meshes only rebuild
 *   on full redraw (not on pure pan). Resolution downscale is not used.
 * - Scene graph: stage → root → graphContent → [edgeLayer, nodeLayer]
 *
 * Quality policy: do not cut visual quality for perf (no soft textures, no
 * 0.6× resolution, no sparse LOD that thins streams). Perf via batching +
 * pan-cache + viewport cull.
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

export type PixiRendererHandle = {
  mount: (host: HTMLElement) => void | Promise<void>;
  destroy: () => void;
  setGraphData: (graphData: GraphData) => void;
  setCamera: (camera: RtcCamera) => void;
  render: () => void;
  /**
   * Interaction quality toggle (API kept for graph-canvas settle path).
   * No-op: pan-cache + GPU vector batches already make interaction cheap;
   * resolution downscale hurt edge sharpness without meaningful gain.
   */
  setInteractionQuality: (mode: "full" | "fast") => void;
};

export type CreatePixiRendererOptions = {
  background?: number;
};

/** World-space axis-aligned bounds (inclusive). */
type WorldAabb = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Relative zoom change that forces RimLock (band/radius scale with zoom). */
const RIM_ZOOM_REL_EPS = 0.02;

/** Expand viewport by this fraction of span on each side (~20%). */
const VIEWPORT_CULL_MARGIN = 0.2;

/** Wider cull margin during full-rebuild for pan cache (~50%). */
const VIEWPORT_CULL_MARGIN_PAN_CACHE = 0.5;

/**
 * Max pan translation as fraction of min viewport dimension before forced
 * full redraw (~25%). Reduces risk of culling artifacts at large offsets.
 */
const PAN_REDRAW_THRESHOLD = 0.35;

/** Tiny epsilon for zoom comparison in pan cache. */
const ZOOM_EPS = 1e-9;

/**
 * World AABB of the visible viewport from camera inverse + margin.
 * @param camera The camera.
 * @param margin Overscan fraction on each side (default ~20%).
 */
function viewportWorldBounds(
  camera: RtcCamera,
  margin: number = VIEWPORT_CULL_MARGIN
): WorldAabb | null {
  const w = camera.viewportWidth;
  const h = camera.viewportHeight;
  if (!(w > 0) || !(h > 0)) return null;

  const tl = camera.screenToWorld({ x: 0, y: 0 });
  const tr = camera.screenToWorld({ x: w, y: 0 });
  const bl = camera.screenToWorld({ x: 0, y: h });
  const br = camera.screenToWorld({ x: w, y: h });

  let minX = Math.min(tl.x, tr.x, bl.x, br.x);
  let maxX = Math.max(tl.x, tr.x, bl.x, br.x);
  let minY = Math.min(tl.y, tr.y, bl.y, br.y);
  let maxY = Math.max(tl.y, tr.y, bl.y, br.y);

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const padX = spanX * margin;
  const padY = spanY * margin;

  return {
    minX: minX - padX,
    maxX: maxX + padX,
    minY: minY - padY,
    maxY: maxY + padY,
  };
}

function circleOutsideAabb(
  cx: number,
  cy: number,
  radius: number,
  bounds: WorldAabb
): boolean {
  return (
    cx + radius < bounds.minX ||
    cx - radius > bounds.maxX ||
    cy + radius < bounds.minY ||
    cy - radius > bounds.maxY
  );
}

/** Segment AABB (endpoints ± pad) misses viewport. */
function segmentAabbMisses(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  pad: number,
  bounds: WorldAabb
): boolean {
  const minX = Math.min(ax, bx) - pad;
  const maxX = Math.max(ax, bx) + pad;
  const minY = Math.min(ay, by) - pad;
  const maxY = Math.max(ay, by) + pad;
  return (
    maxX < bounds.minX ||
    minX > bounds.maxX ||
    maxY < bounds.minY ||
    minY > bounds.maxY
  );
}

function zoomChangedEnoughForRim(
  zoom: number,
  lastRimZoom: number | null
): boolean {
  if (lastRimZoom === null) return true;
  if (!Number.isFinite(zoom) || !Number.isFinite(lastRimZoom)) return true;
  if (lastRimZoom === 0) return zoom !== 0;
  return Math.abs(zoom - lastRimZoom) / Math.abs(lastRimZoom) > RIM_ZOOM_REL_EPS;
}

export function createPixiRenderer(
  options: CreatePixiRendererOptions = {}
): PixiRendererHandle {
  const background = options.background ?? GRAPH_BG;

  let app: Application | null = null;
  /** Edge DotStream layer: Container of GPU-batched vector circle meshes. */
  let edgeLayer: Container | null = null;
  let nodeLayer: Graphics | null = null;
  let root: Container | null = null;
  /** graphContent holds edgeLayer + nodeLayer; position is set to pan offset (A). */
  let graphContent: Container | null = null;
  let graphData: GraphData | null = null;
  let camera: RtcCamera | null = null;
  /** nodesById built once after setGraphData, reused every frame. */
  let nodesByIdCache: Map<string, GraphNode> = new Map();
  /** rimOccupations pre-indexed by nodeId→edgeId after RimLock. */
  let rimSlotCache: Map<string, Map<string, RimSlot>> = new Map();
  let isMounted = false;
  let isDestroyed = false;

  /**
   * True after setGraphData — incidence lists + rim sockets need rebuild.
   * Cleared after recomputeIncidence + applyRimLock in drawFrame.
   */
  let topologyDirty = true;
  /**
   * Zoom used for the last RimLock pass. Pure pan leaves this unchanged so we
   * skip incidence + rimlock; meaningful zoom change re-runs RimLock only.
   */
  let lastRimZoom: number | null = null;

  // -----------------------------------------------------------------------
  // Pan cache (A): snapshot of camera state at last full redraw.
  // -----------------------------------------------------------------------
  let drawnCamX = 0;
  let drawnCamY = 0;
  let drawnZoom = 1;
  let drawnViewportW = 0;
  let drawnViewportH = 0;
  let lastDrawForPanCache = false;
  let panAccumX = 0;
  let panAccumY = 0;

  /**
   * Phase 2b: GPU vector circle batch for edge dots.
   * begin → emit via drawEdgeDots → flush into edgeLayer each fullRedraw.
   */
  let edgeDotBatch: DotCircleBatch | null = null;

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
   * Full clear + redraw of both edgeLayer and nodeLayer. Resets pan cache
   * state and positions graphContent at (0,0). Uses expanded cull margin
   * when lastDrawForPanCache is set so subsequent pan frames have more
   * overscan before geometry gaps appear.
   *
   * Phase 2b: edges emit into DotCircleBatch (vector meshes), then flush
   * into edgeLayer. Nodes remain Graphics.
   */
  function fullRedraw(): void {
    if (!edgeLayer || !nodeLayer || !camera || !graphData || !edgeDotBatch) {
      return;
    }

    const gNode = nodeLayer;
    gNode.clear();

    const batch = edgeDotBatch;
    batch.begin();

    const nodesById = nodesByIdCache;
    const zoom = camera.zoom;
    const ringWidth = nodeRingWidth(zoom);

    if (topologyDirty) {
      recomputeIncidence(graphData);
      applyRimLock(graphData, zoom);
      rebuildRimSlotCache();
      topologyDirty = false;
      lastRimZoom = zoom;
    } else if (zoomChangedEnoughForRim(zoom, lastRimZoom)) {
      applyRimLock(graphData, zoom);
      rebuildRimSlotCache();
      lastRimZoom = zoom;
    }

    // Use wide cull margin so subsequent pan frames have overscan before gaps appear.
    const cullMargin = VIEWPORT_CULL_MARGIN_PAN_CACHE;
    const worldBounds = viewportWorldBounds(camera, cullMargin);
    const invZoom =
      Number.isFinite(zoom) && zoom !== 0 ? 1 / Math.abs(zoom) : 0;

    const rimSlotsByNode = rimSlotCache;

    const emit: DotEmit = (cx, cy, r, color, alpha) => {
      batch.add(cx, cy, r, color, alpha);
    };

    // Edges (edgeLayer) — lower z-order. Emit into GPU vector batch.
    for (const edge of graphData.edges) {
      const src = nodesById.get(edge.source);
      const tgt = nodesById.get(edge.target);
      if (!src || !tgt) continue;

      const sourceRank = src.rank ?? 0;
      const targetRank = tgt.rank ?? 0;
      const radiusSource = nodeScreenRadius(sourceRank, zoom);
      const radiusTarget = nodeScreenRadius(targetRank, zoom);

      if (worldBounds && invZoom > 0) {
        const isPartOf = edge.type === "PART_OF";
        const band = edgeBandWidth(
          zoom,
          isPartOf ? "part_of" : "relates",
          sourceRank,
          targetRank
        );
        const padWorld =
          Math.max(radiusSource, radiusTarget, band) * invZoom;
        if (
          segmentAabbMisses(src.x, src.y, tgt.x, tgt.y, padWorld, worldBounds)
        ) {
          continue;
        }
      }

      const screenSource = camera.worldToScreen({ x: src.x, y: src.y });
      const screenTarget = camera.worldToScreen({ x: tgt.x, y: tgt.y });
      if (
        !Number.isFinite(screenSource.x) ||
        !Number.isFinite(screenSource.y)
      ) continue;
      if (
        !Number.isFinite(screenTarget.x) ||
        !Number.isFinite(screenTarget.y)
      ) continue;

      if (edge.type === "PART_OF") {
        const segment = insetSegment(
          screenTarget,
          screenSource,
          radiusTarget,
          radiusSource
        );
        if (!segment) continue;
        const band = edgeBandWidth(zoom, "part_of", sourceRank, targetRank);
        const srcSlots = rimSlotsByNode.get(src.id);
        const tgtSlots = rimSlotsByNode.get(tgt.id);
        drawEdgeDots(emit, segment.start, segment.end, {
          color: GRAPH_EDGE_PART_OF,
          alpha: GRAPH_EDGE_PART_OF_ALPHA,
          density: "firm",
          band,
          fromCenter: screenTarget,
          fromRadius: radiusTarget,
          toCenter: screenSource,
          toRadius: radiusSource,
          sourceRim: tgtSlots?.get(edge.id),
          targetRim: srcSlots?.get(edge.id),
        });
      } else {
        const segment = insetSegment(
          screenSource,
          screenTarget,
          radiusSource,
          radiusTarget
        );
        if (!segment) continue;
        const band = edgeBandWidth(zoom, "relates", sourceRank, targetRank);
        const srcSlots = rimSlotsByNode.get(src.id);
        const tgtSlots = rimSlotsByNode.get(tgt.id);
        drawEdgeDots(emit, segment.start, segment.end, {
          color: GRAPH_EDGE_RELATES,
          alpha: GRAPH_EDGE_RELATES_ALPHA,
          density: "soft",
          band,
          fromCenter: screenSource,
          fromRadius: radiusSource,
          toCenter: screenTarget,
          toRadius: radiusTarget,
          sourceRim: srcSlots?.get(edge.id),
          targetRim: tgtSlots?.get(edge.id),
        });
      }
    }

    batch.flush(edgeLayer);

    // Nodes (nodeLayer) — higher z-order.
    for (const node of graphData.nodes) {
      const radius = nodeScreenRadius(node.rank, zoom);
      if (!Number.isFinite(radius) || radius < NODE_DRAW_MIN_PX) continue;

      if (worldBounds && invZoom > 0) {
        const radiusWorld = radius * invZoom;
        if (circleOutsideAabb(node.x, node.y, radiusWorld, worldBounds))
          continue;
      }

      const screenPoint = camera.worldToScreen({ x: node.x, y: node.y });
      if (
        !Number.isFinite(screenPoint.x) ||
        !Number.isFinite(screenPoint.y)
      ) continue;
      gNode.circle(screenPoint.x, screenPoint.y, radius);
      gNode.fill({ color: GRAPH_NODE_FILL, alpha: GRAPH_NODE_FILL_ALPHA });
      gNode.circle(screenPoint.x, screenPoint.y, radius);
      gNode.stroke({
        width: ringWidth,
        color: GRAPH_NODE_RING,
        alpha: GRAPH_NODE_RING_ALPHA,
      });
    }

    // Update pan cache snapshot.
    drawnCamX = camera.camX;
    drawnCamY = camera.camY;
    drawnZoom = camera.zoom;
    drawnViewportW = camera.viewportWidth;
    drawnViewportH = camera.viewportHeight;
    panAccumX = 0;
    panAccumY = 0;

    if (graphContent) {
      graphContent.position.set(0, 0);
    }
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

    // --- Pan cache (A): pure-pan shortcut ---
    if (
      !topologyDirty &&
      camera.zoom > 0 &&
      drawnZoom > 0 &&
      Number.isFinite(camera.zoom) &&
      Number.isFinite(drawnZoom) &&
      Math.abs(camera.zoom - drawnZoom) < ZOOM_EPS &&
      Math.round(camera.viewportWidth) === Math.round(drawnViewportW) &&
      Math.round(camera.viewportHeight) === Math.round(drawnViewportH) &&
      Number.isFinite(camera.camX) &&
      Number.isFinite(camera.camY)
    ) {
      // Pure pan: screen moves by -(cam - drawnCam) * zoom.
      const tx = -(camera.camX - drawnCamX) * camera.zoom;
      const ty = -(camera.camY - drawnCamY) * camera.zoom;
      graphContent.position.set(tx, ty);
      panAccumX = tx;
      panAccumY = ty;

      // If accumulated pan exhausts overscan, force full redraw with expanded
      // cull margin so next pan cycle has more room.
      const minDim = Math.min(camera.viewportWidth, camera.viewportHeight, 1);
      const threshold = minDim * PAN_REDRAW_THRESHOLD;
      if (
        Math.abs(panAccumX) > threshold ||
        Math.abs(panAccumY) > threshold
      ) {
        lastDrawForPanCache = true;
        fullRedraw();
      }
      return; // skip clear/redraw
    }

    // --- Full redraw (zoom change, topology change, resize, or first frame) ---
    lastDrawForPanCache = false;
    fullRedraw();
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

      // stage → root → graphContent → [edgeLayer, nodeLayer]
      root = new Container();
      graphContent = new Container();

      // Edge vector-mesh layer — DotCircleBatch flushes Mesh children here.
      edgeLayer = new Container();
      edgeDotBatch = new DotCircleBatch();

      nodeLayer = new Graphics();
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

      edgeLayer = null;
      nodeLayer = null;
      graphContent = null;
      root = null;
      graphData = null;
      camera = null;
      nodesByIdCache = new Map();
      rimSlotCache = new Map();
      topologyDirty = true;
      lastRimZoom = null;
      drawnZoom = 1;
      drawnViewportW = 0;
      drawnViewportH = 0;
      drawnCamX = 0;
      drawnCamY = 0;
      panAccumX = 0;
      panAccumY = 0;
      lastDrawForPanCache = false;
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

    /**
     * No-op by design. Phase 1 pan-cache (graphContent translate) + Phase 2b
     * GPU vector batches already keep pan/zoom cheap without touching resolution.
     * API retained so graph-canvas settle path stays stable.
     */
    setInteractionQuality(_mode: "full" | "fast"): void {
      // intentionally empty — see file header Phase 2b
    },
  };
}
