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
 */

import { Application, Container, Graphics } from "pixi.js";

import type { RtcCamera } from "@/lib/graph/rtc-camera";
import type { GraphData } from "@/lib/graph/graph-data";

const BACKGROUND_COLOR = 0x0a0a0c;
const EDGE_COLOR = 0x5a5470;
/** Lavender node fill (brief palette). */
const NODE_FILL = 0xc8acfb;

const NODE_RADIUS = 3.5;
const EDGE_WIDTH = 1;

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

  // Draws the nodes and the edges in the edges and nodes Graphics
  function drawFrame(): void {
    if (!isMounted || isDestroyed || !edgeLayer || !nodeLayer || !camera || !graphData) {
      return;
    }

    const edges = edgeLayer;
    const nodes = nodeLayer;
    edges.clear();
    nodes.clear();

    const nodesById = new Map(graphData.nodes.map((n) => [n.id, n]));

    // Edges — screen-space segments
    for (const edge of graphData.edges) {
      const src = nodesById.get(edge.source);
      const tgt = nodesById.get(edge.target);
      if (!src || !tgt) continue;
      const screenA = camera.worldToScreen({ x: src.x, y: src.y });
      const screenB = camera.worldToScreen({ x: tgt.x, y: tgt.y });
      if (!Number.isFinite(screenA.x) || !Number.isFinite(screenA.y)) continue;
      if (!Number.isFinite(screenB.x) || !Number.isFinite(screenB.y)) continue;
      edges.moveTo(screenA.x, screenA.y);
      edges.lineTo(screenB.x, screenB.y);
    }
    edges.stroke({ width: EDGE_WIDTH, color: EDGE_COLOR, alpha: 0.55 });

    // Nodes — small circles at projected positions
    for (const node of graphData.nodes) {
      const screenPoint = camera.worldToScreen({ x: node.x, y: node.y });
      if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) continue;
      nodes.circle(screenPoint.x, screenPoint.y, NODE_RADIUS);
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
