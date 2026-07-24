/**
 * Product-shaped graph spike — public barrel.
 * RTC camera, nearby mock graph, FA2 layout, Pixi renderer.
 */

export {
  RtcCamera,
  createRtcCamera,
  type RtcCameraState,
  type ScreenPoint,
  type WorldPoint,
} from "@/lib/graph/rtc-camera";

export {
  createMockGraphData,
  type GraphNode,
  type GraphEdge,
  type GraphData,
  type GraphLinkType,
} from "@/lib/graph/graph-data";

export {
  createLayoutLoop,
  LAYOUT_SIMULATION_ENABLED,
  type LayoutLoopHandle,
  type LayoutLoopOptions,
  type LayoutLoopStatus,
} from "@/lib/graph/layout-loop";

export {
  createPixiRenderer,
  nodeScreenRadius,
  edgeScreenWidth,
  type CreatePixiRendererOptions,
  type PixiRendererHandle,
} from "@/lib/graph/pixi-renderer";

export {
  drawArrow,
  insetSegment,
  type DrawArrowOptions,
} from "@/lib/graph/draw-arrow";
