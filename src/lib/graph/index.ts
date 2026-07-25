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
  recomputeIncidence,
  emptyNodeIncidence,
  type GraphNode,
  type GraphEdge,
  type GraphData,
  type GraphLinkType,
  type RimOccupation,
  type RimOccupationKind,
} from "@/lib/graph/graph-data";

export {
  applyRimLock,
  findRimSlot,
  RIM_FILL_FRAC,
} from "@/lib/graph/rim-lock";

export {
  createLayoutLoop,
  LAYOUT_SIMULATION_ENABLED,
  type LayoutLoopHandle,
  type LayoutLoopOptions,
  type LayoutLoopStatus,
} from "@/lib/graph/layout-loop";

export {
  createPixiRenderer,
  type CreatePixiRendererOptions,
  type PerfStats,
  type PixiRendererHandle,
} from "@/lib/graph/pixi-renderer";

/** Scale hub — tokens + pure formulas (single place to tune size). */
export {
  NODE_BASE_PX,
  NODE_RANK_Q,
  EDGE_BASE_BAND,
  EDGE_BASE_CELL,
  EDGE_COLS_FIRM,
  EDGE_COLS_SOFT,
  EDGE_RELATES_WIDTH_SCALE,
  EDGE_RIM_FILL_FRAC,
  DOT_RADIUS_FRAC,
  DOT_STEP_FRAC,
  NODE_DRAW_MIN_PX,
  EDGE_SYNAPSE_GAP_MIN,
  EDGE_SYNAPSE_GAP_FRAC,
  EDGE_DOT_FLARE_GAIN,
  EDGE_DOT_DENSIFY_GAIN,
  EDGE_DOT_RADIUS_GROW,
  EDGE_DOT_MORPH_ZONE_BAND_MULT,
  EDGE_DOT_MORPH_ZONE_CELL_MULT,
  EDGE_DOT_MORPH_ZONE_NODE_FRAC,
  EDGE_DOT_AXIAL_FAN,
  usableZoom,
  edgeCellSize,
  edgeBandWidth,
  edgeRankFactor,
  edgeColumnCount,
  edgeStripLayout,
  nodeScreenRadius,
  edgeScreenWidth,
  nodeRingWidth,
} from "@/lib/graph/graph-scale";

export {
  drawEdge,
  drawEdgeDots,
  insetSegment,
  type DotEmit,
  type DrawEdgeOptions,
  type RimSlot,
  type ScreenPoint as EdgeScreenPoint,
} from "@/lib/graph/draw-arrow";

export {
  DotCircleBatch,
  circleSegmentCount,
} from "@/lib/graph/dot-circle-batch";

/** Palette only — hex colors / alphas. */
export {
  GRAPH_BG,
  GRAPH_NODE_FILL,
  GRAPH_NODE_FILL_ALPHA,
  GRAPH_NODE_RING,
  GRAPH_NODE_RING_ALPHA,
  GRAPH_EDGE_PART_OF,
  GRAPH_EDGE_PART_OF_ALPHA,
  GRAPH_EDGE_RELATES,
  GRAPH_EDGE_RELATES_ALPHA,
} from "@/lib/graph/graph-style";
