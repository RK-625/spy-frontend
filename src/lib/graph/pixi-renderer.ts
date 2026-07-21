/**
 * Pixi v8 graph renderer.
 *
 * HARD RULE: camera stays outside Pixi.
 * - Never pan/zoom with stage.scale / stage.position for world camera.
 * - Project world → screen via RtcCamera each frame, then place graphics in
 *   screen space.
 */

import { Application, Container, Graphics } from "pixi.js";

import type { RtcCamera } from "@/lib/graph/rtc-camera";
import type { ClusterId, MockGraph } from "@/lib/graph/mock-graph";

const BG = 0x0a0a0c;
const EDGE_COLOR = 0x5a5470;
const NODE_DEFAULT = 0xc8acfb;

/** Light cluster tints (lavender family — not pure white). */
const CLUSTER_FILL: Record<ClusterId, number> = {
  A: 0xc8acfb,
  B: 0xb89af0,
  C: 0xa888e0,
  D: 0x9a78d0,
};

const NODE_RADIUS = 3.5;
const EDGE_WIDTH = 1;

export type PixiRendererHandle = {
  /** Attach to a host element (async: Application.init). */
  mount: (host: HTMLElement) => void | Promise<void>;
  /** Tear down WebGL / listeners / stage children. */
  destroy: () => void;
  /** Push latest graph snapshot before draw. */
  setGraph: (graph: MockGraph) => void;
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
  const background = options.background ?? BG;

  let app: Application | null = null;
  let hostEl: HTMLElement | null = null;
  let edgeLayer: Graphics | null = null;
  let nodeLayer: Graphics | null = null;
  let root: Container | null = null;
  let graph: MockGraph | null = null;
  let camera: RtcCamera | null = null;
  let mounted = false;
  let destroyed = false;

  function syncViewportFromHost(): void {
    if (!hostEl || !camera) return;
    const w = hostEl.clientWidth;
    const h = hostEl.clientHeight;
    if (w > 0 && h > 0) {
      camera.setViewport(w, h);
    }
  }

  function drawFrame(): void {
    if (!mounted || destroyed || !edgeLayer || !nodeLayer || !camera || !graph) {
      return;
    }

    const edges = edgeLayer;
    const nodes = nodeLayer;
    edges.clear();
    nodes.clear();

    const byId = new Map(graph.nodes.map((n) => [n.id, n]));

    // Edges — screen-space segments
    for (const edge of graph.edges) {
      const src = byId.get(edge.source);
      const tgt = byId.get(edge.target);
      if (!src || !tgt) continue;
      const a = camera.worldToScreen({ x: src.x, y: src.y });
      const b = camera.worldToScreen({ x: tgt.x, y: tgt.y });
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) continue;
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      edges.moveTo(a.x, a.y);
      edges.lineTo(b.x, b.y);
    }
    edges.stroke({ width: EDGE_WIDTH, color: EDGE_COLOR, alpha: 0.55 });

    // Nodes — small circles at projected positions
    for (const node of graph.nodes) {
      const p = camera.worldToScreen({ x: node.x, y: node.y });
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const fill =
        node.cluster !== undefined
          ? CLUSTER_FILL[node.cluster]
          : NODE_DEFAULT;
      nodes.circle(p.x, p.y, NODE_RADIUS);
      nodes.fill({ color: fill, alpha: 0.95 });
    }
  }

  return {
    async mount(host: HTMLElement): Promise<void> {
      if (destroyed) return;
      if (mounted) return;

      hostEl = host;
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

      if (destroyed) {
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

      mounted = true;
      syncViewportFromHost();
      // Viewport resize is owned by GraphCanvas ResizeObserver (single source).
      // Pixi still uses resizeTo: host for canvas/buffer size.
      drawFrame();
    },

    destroy(): void {
      destroyed = true;
      mounted = false;

      if (app) {
        try {
          app.ticker.stop();
        } catch {
          // ignore
        }
        // removeView: let Pixi detach the canvas; avoid double DOM removal.
        app.destroy({ removeView: true }, { children: true });
        app = null;
      }

      edgeLayer = null;
      nodeLayer = null;
      root = null;
      hostEl = null;
      graph = null;
      camera = null;
    },

    setGraph(next: MockGraph): void {
      graph = next;
    },

    setCamera(next: RtcCamera): void {
      camera = next;
      syncViewportFromHost();
    },

    render(): void {
      if (!mounted || destroyed) return;
      drawFrame();
    },
  };
}
