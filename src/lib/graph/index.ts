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
  type ArrowShaftStyle,
  type ArrowHeadStyle,
} from "@/lib/graph/draw-arrow";

export {
  GRAPH_BG,
  GRAPH_NODE_FILL,
  GRAPH_NODE_FILL_ALPHA,
  GRAPH_NODE_RING,
  GRAPH_NODE_RING_ALPHA,
  GRAPH_NODE_RING_WIDTH,
  GRAPH_EDGE_PART_OF,
  GRAPH_EDGE_PART_OF_ALPHA,
  GRAPH_EDGE_RELATES,
  GRAPH_EDGE_RELATES_ALPHA,
  GRAPH_EDGE_RELATES_WIDTH_SCALE,
  GRAPH_DOT_PITCH,
} from "@/lib/graph/graph-style";
