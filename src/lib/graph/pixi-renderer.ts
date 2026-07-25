/**
 * Pixi v8 graph renderer.
 *
 * HARD RULE: camera stays outside Pixi.
 * - Never pan/zoom with stage.scale / stage.position for world camera.
 * - Project world → screen via RtcCamera each frame, then place graphics in
 *   screen space.
 *
 * Single layer: one Graphics (`graphLayer`) draws DotStream edges then node
 * fills/rings (edges first so nodes paint on top within the same Graphics).
 * Scale: graph-scale (shared zoom for nodes, cell, band). Camera remains
 * outside Pixi.
 *
 * Phase 0 perf:
 * - topologyDirty / zoomDirty: skip recomputeIncidence + applyRimLock on pure pan
 * - world AABB viewport culling for nodes and edges (still full clear/redraw)
 */

import { Application, Container, Graphics } from "pixi.js";

import type { RtcCamera } from "@/lib/graph/rtc-camera";
import type { GraphData } from "@/lib/graph/graph-data";
import { recomputeIncidence } from "@/lib/graph/graph-data";
import { drawEdge, insetSegment } from "@/lib/graph/draw-arrow";
import {
  NODE_DRAW_MIN_PX,
  edgeBandWidth,
  nodeRingWidth,
  nodeScreenRadius,
} from "@/lib/graph/graph-scale";
import { applyRimLock, findRimSlot } from "@/lib/graph/rim-lock";
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

/**
 * World AABB of the visible viewport from camera inverse + margin.
 * Margin is ~20% of span so partially-visible flares near the edge still draw.
 */
function viewportWorldBounds(camera: RtcCamera): WorldAabb | null {
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
  const padX = spanX * VIEWPORT_CULL_MARGIN;
  const padY = spanY * VIEWPORT_CULL_MARGIN;

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
  /** One Graphics for DotStream edges + node fills/rings (edges then nodes). */
  let graphLayer: Graphics | null = null;
  let root: Container | null = null;
  let graphData: GraphData | null = null;
  let camera: RtcCamera | null = null;
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

  function drawFrame(): void {
    if (!isMounted || isDestroyed || !graphLayer || !camera || !graphData) {
      return;
    }

    const g = graphLayer;
    g.clear();

    const nodesById = new Map(graphData.nodes.map((n) => [n.id, n]));
    const zoom = camera.zoom;
    const ringWidth = nodeRingWidth(zoom);

    // Topology or meaningful zoom change → rebuild sockets.
    // Pure pan: skip recomputeIncidence + applyRimLock entirely (Phase 0).
    if (topologyDirty) {
      recomputeIncidence(graphData);
      applyRimLock(graphData, zoom);
      topologyDirty = false;
      lastRimZoom = zoom;
    } else if (zoomChangedEnoughForRim(zoom, lastRimZoom)) {
      // Incidence lists unchanged; rim band/radius scale with zoom only.
      applyRimLock(graphData, zoom);
      lastRimZoom = zoom;
    }

    const worldBounds = viewportWorldBounds(camera);
    // Screen → world pad for radii: r_world = r_screen / zoom
    const invZoom =
      Number.isFinite(zoom) && zoom !== 0 ? 1 / Math.abs(zoom) : 0;

    // Edges first — nodes draw after so fills/rings sit on top of streams.
    for (const edge of graphData.edges) {
      const src = nodesById.get(edge.source);
      const tgt = nodesById.get(edge.target);
      if (!src || !tgt) continue;

      const sourceRank = src.rank ?? 0;
      const targetRank = tgt.rank ?? 0;
      const radiusSource = nodeScreenRadius(sourceRank, zoom);
      const radiusTarget = nodeScreenRadius(targetRank, zoom);

      // World AABB cull before world→screen projection / DotStream.
      if (worldBounds && invZoom > 0) {
        const isPartOf = edge.type === "PART_OF";
        const band = edgeBandWidth(
          zoom,
          isPartOf ? "part_of" : "relates",
          sourceRank,
          targetRank
        );
        // Expand by max endpoint radius and band (flare roughly within this pad).
        const padWorld =
          Math.max(radiusSource, radiusTarget, band) * invZoom;
        if (
          segmentAabbMisses(
            src.x,
            src.y,
            tgt.x,
            tgt.y,
            padWorld,
            worldBounds
          )
        ) {
          continue;
        }
      }

      const screenSource = camera.worldToScreen({ x: src.x, y: src.y });
      const screenTarget = camera.worldToScreen({ x: tgt.x, y: tgt.y });
      if (!Number.isFinite(screenSource.x) || !Number.isFinite(screenSource.y)) {
        continue;
      }
      if (!Number.isFinite(screenTarget.x) || !Number.isFinite(screenTarget.y)) {
        continue;
      }

      if (edge.type === "PART_OF") {
        // parent → child; continuous stream meets both rims (flow later via pulse)
        // drawEdge sourceRim = from end = parent (tgt); targetRim = child (src)
        const segment = insetSegment(
          screenTarget,
          screenSource,
          radiusTarget,
          radiusSource
        );
        if (!segment) continue;
        const band = edgeBandWidth(zoom, "part_of", sourceRank, targetRank);
        drawEdge(g, segment.start, segment.end, {
          color: GRAPH_EDGE_PART_OF,
          alpha: GRAPH_EDGE_PART_OF_ALPHA,
          density: "firm",
          band,
          fromCenter: screenTarget,
          fromRadius: radiusTarget,
          toCenter: screenSource,
          toRadius: radiusSource,
          sourceRim: findRimSlot(tgt, edge.id),
          targetRim: findRimSlot(src, edge.id),
        });
      } else {
        // RELATES: source → target
        const segment = insetSegment(
          screenSource,
          screenTarget,
          radiusSource,
          radiusTarget
        );
        if (!segment) continue;
        const band = edgeBandWidth(zoom, "relates", sourceRank, targetRank);
        drawEdge(g, segment.start, segment.end, {
          color: GRAPH_EDGE_RELATES,
          alpha: GRAPH_EDGE_RELATES_ALPHA,
          density: "soft",
          band,
          fromCenter: screenSource,
          fromRadius: radiusSource,
          toCenter: screenTarget,
          toRadius: radiusTarget,
          sourceRim: findRimSlot(src, edge.id),
          targetRim: findRimSlot(tgt, edge.id),
        });
      }
    }

    // Nodes second — paint on top of edge streams within the same Graphics.
    for (const node of graphData.nodes) {
      const radius = nodeScreenRadius(node.rank, zoom);
      if (!Number.isFinite(radius) || radius < NODE_DRAW_MIN_PX) continue;

      if (worldBounds && invZoom > 0) {
        const radiusWorld = radius * invZoom;
        if (circleOutsideAabb(node.x, node.y, radiusWorld, worldBounds)) {
          continue;
        }
      }

      const screenPoint = camera.worldToScreen({ x: node.x, y: node.y });
      if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) {
        continue;
      }
      g.circle(screenPoint.x, screenPoint.y, radius);
      g.fill({ color: GRAPH_NODE_FILL, alpha: GRAPH_NODE_FILL_ALPHA });
      g.circle(screenPoint.x, screenPoint.y, radius);
      g.stroke({
        width: ringWidth,
        color: GRAPH_NODE_RING,
        alpha: GRAPH_NODE_RING_ALPHA,
      });
    }
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

      // stage → root → graphLayer (single Graphics; future overlays under root)
      root = new Container();
      graphLayer = new Graphics();
      root.addChild(graphLayer);
      application.stage.addChild(root);

      isMounted = true;
    },

    destroy(): void {
      isDestroyed = true;
      isMounted = false;

      if (app) {
        app.destroy({ removeView: true }, { children: true });
        app = null;
      }

      graphLayer = null;
      root = null;
      graphData = null;
      camera = null;
      topologyDirty = true;
      lastRimZoom = null;
    },

    setGraphData(nextGraphData: GraphData): void {
      graphData = nextGraphData;
      topologyDirty = true;
    },

    setCamera(nextCamera: RtcCamera): void {
      camera = nextCamera;
    },

    render(): void {
      if (!isMounted || isDestroyed) return;
      drawFrame();
    },
  };
}
