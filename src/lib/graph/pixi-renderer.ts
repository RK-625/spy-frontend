/**
 * Pixi v8 graph renderer.
 *
 * HARD RULE: camera stays outside Pixi.
 * - Never pan/zoom with stage.scale / stage.position for world camera.
 * - Project world → screen via RtcCamera each frame, then place graphics in
 *   screen space.
 *
 * Viewport size is owned by GraphCanvas (initial setViewport + ResizeObserver).
 * Pixi uses resizeTo: host only for canvas/buffer size.
 *
 * Edges: directed arrows via draw-arrow (PART_OF solid, RELATES_TO dashed).
 * Width scales with zoom; stroke safety floor 0.25 only.
 */

import { Application, Container, Graphics } from "pixi.js";

import type { RtcCamera } from "@/lib/graph/rtc-camera";
import type { GraphData } from "@/lib/graph/graph-data";
import { drawArrow, insetSegment } from "@/lib/graph/draw-arrow";

const BACKGROUND_COLOR = 0x0a0a0c;
/** PART_OF hierarchy edges — muted purple-gray. */
const EDGE_PART_OF_COLOR = 0x5a5470;
/** RELATES_TO associative edges — slightly dimmer secondary text gray. */
const EDGE_RELATES_TO_COLOR = 0x7a7685;
/** Lavender node fill (brief palette). */
const NODE_FILL = 0xc8acfb;

/**
 * Independent node sizing: each radius depends ONLY on that node's stored
 * rank and current camera.zoom. Neighbors, degree, mass, density do not affect
 * size. Same zoom scales everyone; Q keeps relative hierarchy.
 *
 * r = BASE * (Q ** rank) * |zoom|
 *   BASE = root px at zoom 1; Q = parent→child size ratio
 *   Pure linear zoom — no floor, no shared MAX, no soft-K.
 */
const NODE_BASE_PX = 8;
/** Each +1 rank multiplies size by Q (hierarchy chain). */
const NODE_RANK_Q = 0.8;
/** Skip drawing nodes smaller than this (subpixel cull; formula itself has no MIN). */
const NODE_DRAW_MIN_PX = 0.25;
const EDGE_BASE_PX = 1;
/** Stroke safety only — keeps Pixi from zero-width strokes; not a hierarchy floor. */
const EDGE_STROKE_MIN_PX = 0.25;

/**
 * Pure screen-pixel radius for a node given stored rank and camera zoom.
 * No floor/ceiling so deep hierarchy ratios stay true at all zooms.
 */
export function nodeScreenRadius(
  rank: number | undefined,
  zoom: number
): number {
  const depth = rank ?? 0;
  const z = Number.isFinite(zoom) && zoom !== 0 ? Math.abs(zoom) : 1;
  return NODE_BASE_PX * NODE_RANK_Q ** depth * z;
}

/**
 * Edge stroke width from zoom (linear). Safety floor only for stroke stability.
 */
export function edgeScreenWidth(zoom: number): number {
  const z = Number.isFinite(zoom) && zoom !== 0 ? Math.abs(zoom) : 1;
  return Math.max(EDGE_STROKE_MIN_PX, EDGE_BASE_PX * z);
}

export type PixiRendererHandle = {
  /** Attach to a host element (async: Application.init). */
  mount: (host: HTMLElement) => void | Promise<void>;
  /** Tear down WebGL / listeners / stage children. */
  destroy: () => void;
  /** Push latest graph snapshot before draw. */
  setGraphData: (graphData: GraphData) => void;
  /** Bind external RTC camera (never owned by Pixi). */
  setCamera: (camera: RtcCamera) => void;
  /** One frame draw: project + redraw screen-space graphics. */
  render: () => void;
};

export type CreatePixiRendererOptions = {
  background?: number;
};

/**
 * Factory for the Pixi surface. Import only from client components.
 */
export function createPixiRenderer(
  options: CreatePixiRendererOptions = {}
): PixiRendererHandle {
  const background = options.background ?? BACKGROUND_COLOR;

  let app: Application | null = null;
  let edgeLayer: Graphics | null = null;
  let nodeLayer: Graphics | null = null;
  let root: Container | null = null;
  let graphData: GraphData | null = null;
  let camera: RtcCamera | null = null;
  let isMounted = false;
  let isDestroyed = false;

  function drawFrame(): void {
    if (!isMounted || isDestroyed || !edgeLayer || !nodeLayer || !camera || !graphData) {
      return;
    }

    const edges = edgeLayer;
    const nodes = nodeLayer;
    edges.clear();
    nodes.clear();

    const nodesById = new Map(graphData.nodes.map((n) => [n.id, n]));
    const zoom = camera.zoom;
    const strokeWidth = edgeScreenWidth(zoom);

    // Edges — directed arrows in screen space (inset to node rims)
    for (const edge of graphData.edges) {
      const src = nodesById.get(edge.source);
      const tgt = nodesById.get(edge.target);
      if (!src || !tgt) continue;
      const screenSource = camera.worldToScreen({ x: src.x, y: src.y });
      const screenTarget = camera.worldToScreen({ x: tgt.x, y: tgt.y });
      if (!Number.isFinite(screenSource.x) || !Number.isFinite(screenSource.y)) {
        continue;
      }
      if (!Number.isFinite(screenTarget.x) || !Number.isFinite(screenTarget.y)) {
        continue;
      }

      const radiusSource = nodeScreenRadius(src.rank, zoom);
      const radiusTarget = nodeScreenRadius(tgt.rank, zoom);

      if (edge.type === "PART_OF") {
        // Data: source=child, target=parent → visual flow parent → child
        const segment = insetSegment(
          screenTarget,
          screenSource,
          radiusTarget,
          radiusSource
        );
        if (!segment) continue;
        drawArrow(edges, segment.start, segment.end, {
          width: strokeWidth,
          color: EDGE_PART_OF_COLOR,
          alpha: 0.55,
        });
      } else {
        // RELATES_TO: dashed + arrow along stored source → target
        const segment = insetSegment(
          screenSource,
          screenTarget,
          radiusSource,
          radiusTarget
        );
        if (!segment) continue;
        drawArrow(edges, segment.start, segment.end, {
          width: strokeWidth,
          color: EDGE_RELATES_TO_COLOR,
          alpha: 0.45,
          dashed: true,
        });
      }
    }

    // Nodes — screen-space circles: rank × linear zoom (not stage.scale)
    for (const node of graphData.nodes) {
      const screenPoint = camera.worldToScreen({ x: node.x, y: node.y });
      if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) continue;
      const radius = nodeScreenRadius(node.rank, zoom);
      if (!Number.isFinite(radius) || radius < NODE_DRAW_MIN_PX) continue;
      nodes.circle(screenPoint.x, screenPoint.y, radius);
      nodes.fill({ color: NODE_FILL, alpha: 0.95 });
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
        resolution: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        preference: "webgl",
      });

      if (isDestroyed) {
        application.destroy(
          { removeView: true },
          { children: true }
        );
        return;
      }

      app = application;
      host.appendChild(application.canvas);

      root = new Container();
      // HARD RULE: never set root.scale / root.position as world camera
      edgeLayer = new Graphics();
      nodeLayer = new Graphics();
      root.addChild(edgeLayer);
      root.addChild(nodeLayer);
      application.stage.addChild(root);

      isMounted = true;
      // No drawFrame here — graphData is usually null until layoutLoop.start().
    },

    destroy(): void {
      isDestroyed = true;
      isMounted = false;

      if (app) {
        // removeView: let Pixi detach the canvas; avoid double DOM removal.
        app.destroy({ removeView: true }, { children: true });
        app = null;
      }

      edgeLayer = null;
      nodeLayer = null;
      root = null;
      graphData = null;
      camera = null;
    },

    setGraphData(nextGraphData: GraphData): void {
      graphData = nextGraphData;
    },

    setCamera(nextCamera: RtcCamera): void {
      // Viewport size is owned by GraphCanvas (setViewport + ResizeObserver).
      camera = nextCamera;
    },

    render(): void {
      if (!isMounted || isDestroyed) return;
      drawFrame();
    },
  };
}
