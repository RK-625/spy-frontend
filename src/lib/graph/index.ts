/**
 * Product-shaped graph spike — public barrel.
 * Steps 1–4 fill rtc-camera, mock-graph clusters, layout-loop, pixi-renderer.
 */

export {
  RtcCamera,
  createRtcCamera,
  type ProjectionMode,
  type RtcCameraState,
  type ScreenPoint,
  type WorldPoint,
} from "@/lib/graph/rtc-camera";

export {
  createMockGraph,
  CLUSTER_ANCHORS,
  type ClusterId,
  type GraphNode,
  type GraphEdge,
  type MockGraph,
} from "@/lib/graph/mock-graph";

export {
  createLayoutLoop,
  type LayoutLoopHandle,
  type LayoutLoopOptions,
  type LayoutLoopStatus,
} from "@/lib/graph/layout-loop";

export {
  createPixiRenderer,
  type CreatePixiRendererOptions,
  type PixiRendererHandle,
} from "@/lib/graph/pixi-renderer";
