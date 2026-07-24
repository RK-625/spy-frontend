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
 */

import { Application, Container, Graphics } from "pixi.js";

import type { RtcCamera } from "@/lib/graph/rtc-camera";
import type { GraphData } from "@/lib/graph/graph-data";
import { drawEdge, insetSegment } from "@/lib/graph/draw-arrow";
import {
  NODE_DRAW_MIN_PX,
  edgeBandWidth,
  nodeRingWidth,
  nodeScreenRadius,
} from "@/lib/graph/graph-scale";
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

  function drawFrame(): void {
    if (!isMounted || isDestroyed || !graphLayer || !camera || !graphData) {
      return;
    }

    const g = graphLayer;
    g.clear();

    const nodesById = new Map(graphData.nodes.map((n) => [n.id, n]));
    const zoom = camera.zoom;
    const ringWidth = nodeRingWidth(zoom);

    // Edges first — nodes draw after so fills/rings sit on top of streams.
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

      const sourceRank = src.rank ?? 0;
      const targetRank = tgt.rank ?? 0;
      const radiusSource = nodeScreenRadius(sourceRank, zoom);
      const radiusTarget = nodeScreenRadius(targetRank, zoom);

      if (edge.type === "PART_OF") {
        // parent → child; continuous stream meets both rims (flow later via pulse)
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
        drawEdge(g, segment.start, segment.end, {
          color: GRAPH_EDGE_RELATES,
          alpha: GRAPH_EDGE_RELATES_ALPHA,
          density: "soft",
          band,
          fromCenter: screenSource,
          fromRadius: radiusSource,
          toCenter: screenTarget,
          toRadius: radiusTarget,
        });
      }
    }

    // Nodes second — paint on top of edge streams within the same Graphics.
    for (const node of graphData.nodes) {
      const screenPoint = camera.worldToScreen({ x: node.x, y: node.y });
      if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) {
        continue;
      }
      const radius = nodeScreenRadius(node.rank, zoom);
      if (!Number.isFinite(radius) || radius < NODE_DRAW_MIN_PX) continue;
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
    },

    setGraphData(nextGraphData: GraphData): void {
      graphData = nextGraphData;
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
