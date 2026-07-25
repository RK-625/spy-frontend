/**
 * Graph library barrel — product-shaped `/graph` spike.
 *
 * Layout (dependency-friendly sections):
 * 1. Domain DTO + fixtures
 * 2. Camera + layout loop
 * 3. Spatial / rim / bake pipeline
 * 4. Pixi renderer + DotStream batch
 * 5. Style tokens + signal wave
 *
 * Live Falkor → GraphData adapter is not here yet (server + layout positions).
 */

// --- Domain DTO -----------------------------------------------------------
export {
  recomputeIncidence,
  emptyNodeIncidence,
  type GraphNode,
  type GraphEdge,
  type GraphData,
  type GraphLinkType,
  type RimOccupation,
  type RimOccupationKind,
} from "@/lib/graph/graph-data";

// --- Fixtures (mock / stress; not live DB) --------------------------------
export {
  createMockGraphData,
  createLargeStressGraphData,
  HUB_SPOKE_COUNT,
  type LargeStressFixtureOptions,
} from "@/lib/graph/fixtures/mock-graph";

// --- Diff / dirty for partial bake ----------------------------------------
export {
  diffGraphDirty,
  expandDirtyEdgesForHubs,
  incidentEdgeIds,
  type GraphDirtyDiff,
} from "@/lib/graph/graph-diff";

// --- Camera ---------------------------------------------------------------
export {
  RtcCamera,
  createRtcCamera,
  type RtcCameraState,
  type ScreenPoint,
  type WorldPoint,
} from "@/lib/graph/rtc-camera";

// --- Layout (static default; FA2 via createLayoutLoopAsync) ----------------
export {
  createLayoutLoop,
  createLayoutLoopAsync,
  LAYOUT_SIMULATION_ENABLED,
  type LayoutLoopHandle,
  type LayoutLoopOptions,
  type LayoutLoopStatus,
  type LayoutRenderOptions,
} from "@/lib/graph/layout-loop";

// --- Rim packing + spatial residency --------------------------------------
export {
  applyRimLock,
  applyRimLockForNodes,
  rimLockNodesForMoves,
  findRimSlot,
  RIM_FILL_FRAC,
} from "@/lib/graph/rim-lock";

export {
  GraphSpatialIndex,
  type WorldAabb,
} from "@/lib/graph/spatial-index";

// --- Scale formulas -------------------------------------------------------
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

// --- DotStream sampling / batch / arrow -----------------------------------
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

// --- Pixi host ------------------------------------------------------------
export {
  createPixiRenderer,
  type CreatePixiRendererOptions,
  type PerfStats,
  type PixiRendererHandle,
  type SetGraphDataOptions,
} from "@/lib/graph/pixi-renderer";

// --- Palette + signal tokens ----------------------------------------------
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
  GRAPH_PULSE_PART_OF,
  GRAPH_PULSE_PART_OF_COLOR_MIX,
  GRAPH_PULSE_PART_OF_ALPHA_LIFT,
  GRAPH_PULSE_RELATES,
  GRAPH_PULSE_RELATES_COLOR_MIX,
  GRAPH_PULSE_RELATES_ALPHA_LIFT,
  GRAPH_PULSE_PACKET_SCREEN_PX,
  GRAPH_PULSE_PACKET_WORLD_MIN,
  GRAPH_PULSE_PACKET_WORLD_MAX,
  GRAPH_PULSE_BAND_T_MIN,
  GRAPH_PULSE_BAND_T_MAX,
  GRAPH_PULSE_PACKET_SCALE_RELATES,
  GRAPH_PULSE_ARROW_TIP_MIN,
  GRAPH_PULSE_ARROW_UNIT,
  GRAPH_PULSE_ARROW_SOFTNESS,
  GRAPH_PULSE_TRAIL_UNIT,
  GRAPH_PULSE_TRAIL_STRENGTH,
  GRAPH_PULSE_TRAIL_WIDTH_SCALE,
  GRAPH_PULSE_FLARE_WIDEN,
  GRAPH_PULSE_FLARE_NODE_FRAC,
  GRAPH_PULSE_FLARE_WORLD_PAD,
  GRAPH_PULSE_FLARE_T_MIN,
  GRAPH_PULSE_FLARE_T_MAX,
  GRAPH_PULSE_SECOND_PHASE,
  GRAPH_PULSE_SECOND_STRENGTH,
  GRAPH_PULSE_STRENGTH_STEPS,
  GRAPH_PULSE_WORLD_SPEED,
  GRAPH_PULSE_DURATION_MIN_S,
  GRAPH_PULSE_DURATION_MAX_S,
  GRAPH_PULSE_DURATION_JITTER,
  GRAPH_PULSE_SPEED_PART_OF,
  GRAPH_PULSE_SPEED_RELATES,
  GRAPH_PULSE_UPLOAD_INTERVAL_MS,
} from "@/lib/graph/graph-style";

// --- Signal wave helpers --------------------------------------------------
export {
  hashEdgeId,
  pulsePhaseOffset,
  pulseDurationSeconds,
  pulseProgress,
  pulseEndpoints,
  pulseTravelLength,
  pulseEndpointRadii,
  waveStyleForType,
  packetHeadWorldLength,
  packetBandT,
  geometricFlareT,
  circularDistance01,
  signedCircularDelta01,
  waveStrength,
  flareWidenWeight,
  quantizeWaveStrength,
  lerpHexColor,
  modulateDotAppearance,
  projectTravelT,
  projectLateralU,
  type SignalWaveStyle,
  type WaveGeomContext,
} from "@/lib/graph/edge-signal-pulse";
