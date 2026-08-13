/**
 * Graph library barrel — product-shaped `/graph` spike.
 *
 * Sub-domain structure:
 * - core/       (graph-data, graph-scale, graph-style, graph-diff)
 * - placement/  (place-topology, placement-cache, force-recipe)
 * - render/     (pixi-renderer, dot-circle-batch, draw-arrow, edge-signal-pulse, bake-*)
 * - camera/     (rtc-camera)
 * - layout/     (layout-loop-d3 paint store, rim-lock, spatial-index)
 *
 * Live topology via `/api/graph`; `placeTopology` owns hit/miss + settle + cache.
 * Force knobs / settle / placement-cache helpers: import subpaths (verify only).
 * Layout factory: dynamic-import `createGraphPaintLoop` from `@/lib/graph/layout/layout-loop-d3`.
 * Fixtures (mock / stress): deep-import `@/lib/graph/fixtures/mock-graph` — verify scripts
 * only; never re-exported here (no product mock path).
 */

// --- Domain DTO -----------------------------------------------------------
export {
  recomputeIncidence,
  emptyNodeIncidence,
  cloneGraphData,
  type GraphNode,
  type GraphEdge,
  type GraphData,
  type GraphLinkType,
  type RimOccupation,
  type RimOccupationKind,
} from "./core/graph-data";

// --- MemoryNode / Links → GraphData (hit/miss + settle; no Falkor) --------
export { placeTopology } from "./placement/place-topology";

// --- Shared wire / topology types (GET /api/graph; client-safe SoT) --------
export type {
  GraphApiResponse,
  GraphTopology,
  MemoryNode,
} from "@/types/graph-topology";

// --- Diff / dirty for partial bake ----------------------------------------
export {
  diffGraphDirty,
  expandDirtyEdgesForHubs,
  incidentEdgeIds,
  type GraphDirtyDiff,
} from "./core/graph-diff";

// --- Camera ---------------------------------------------------------------
export {
  RtcCamera,
  createRtcCamera,
  type RtcCameraState,
  type ScreenPoint,
  type WorldPoint,
} from "./camera/rtc-camera";

// --- Layout paint types (factory: createGraphPaintLoop via dynamic import) -
export type {
  LayoutLoopHandle,
  LayoutLoopOptions,
} from "./layout/layout-loop-d3";

// --- Rim packing + spatial residency --------------------------------------
export {
  applyRimLock,
  applyRimLockForNodes,
  rimLockNodesForMoves,
  computeRimLockForNode,
  angleToPoint,
  DEFAULT_RIM_HALF_SPAN,
} from "./layout/rim-lock";

export {
  GraphSpatialIndex,
  packCellKey,
  DEFAULT_CELL_SIZE,
  type WorldAabb,
  type EdgePadResolver,
} from "./layout/spatial-index";

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
} from "./core/graph-scale";

// --- DotStream sampling / batch / arrow -----------------------------------
export {
  drawEdge,
  drawEdgeDots,
  type DotEmit,
  type DrawEdgeOptions,
  type RimSlot,
  type ScreenPoint as EdgeScreenPoint,
} from "./render/draw-arrow";

export {
  DotCircleBatch,
  circleSegmentCount,
} from "./render/dot-circle-batch";

// --- Pixi host ------------------------------------------------------------
export {
  createPixiRenderer,
  type CreatePixiRendererOptions,
  type PixiRendererHandle,
} from "./render/pixi-renderer";

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
} from "./core/graph-style";

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
} from "./render/edge-signal-pulse";
