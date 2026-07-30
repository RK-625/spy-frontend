/**
 * Pixi v8 graph renderer — A′ world-space bake + B SDF discs + C worker + universal residency.
 *
 * Module map (single file; light-cleanup keep — split only when data adapter lands):
 * - World AABB / overscan helpers
 * - Topology prep (incidence, RimLock, spatial index)
 * - Bake request (payload, worker/sync, resident merge, GPU upload)
 * - Signal wave color pass (throttled rAF)
 * - Camera transform + underlay + nodes
 * - Public handle: setGraphData, render, destroy, setSignalPulsesEnabled
 *
 * Universal residency: all sizes use viewport+overscan+index+worker (+ tile buckets).
 * Absolute cost ∝ visible set, not total graph. Same DotStream look at every scale.
 *
 * HARD RULE: camera stays outside Pixi.
 * - Never pan/zoom with stage.scale / stage.position for world camera.
 * - Bake geometry in world coords (z=1) once per data change (or overscan miss).
 * - Every frame: scale graphContent by camera.zoom and position via RTC formula.
 * - Camera only transforms inside overscan; leave overscan → rebake candidates.
 *
 * A′ (world-space bake):
 * - bake at reference zoom 1: nodeR_world = nodeScreenRadius(rank, 1),
 *   band_world = edgeBandWidth(1, ...)
 * - applyCameraTransform() sets graphContent.scale = z, position = RTC offset.
 * - Low zoom (z < EDGE_VIS_ZOOM_FLOOR): constant-screen-width hairline underlay
 *   so connections stay visible while DotStream is subpixel; mid/high zoom underlay off.
 *   Underlay is world-space under graphContent — pan-decoupled (rebuild on zoom /
 *   graph / overscan residency only, not every camX/camY).
 * - No re-bake on pan/zoom while the tight viewport stays inside baked overscan.
 * - screen stroke width = z * ringWidth(1) ≈ correct under pure scale.
 *
 * B — SDF disc quads (dot-circle-batch.ts):
 * - DotCircleBatch emits 4-vert AA quads + GlProgram fragment disc (fwidth AA).
 * - Fan fallback (MIN_SEGMENTS=32) if Shader/GlProgram init or first Mesh fails.
 *
 * C — Shared bake worker (bake-worker-pool.ts + bake-worker.ts + bake-sample.ts):
 * - Main: recomputeIncidence + RimLock (full or incremental) + spatial index + payload.
 * - Worker: pure DotStream sampling → transferable exact-size dots + packed edgeRanges.
 * - Latest-only: worker pending queue keeps newest seq per client; cooperative
 *   abort mid-sample after each edge when a newer bake supersedes.
 * - Main: partial or full merge into resident + durable merged buffer → GPU.
 * - Sequence numbers drop stale worker results. Worker construct fail → sync forever.
 * - Payload transfers only spatial candidates (edges + endpoint nodes + rim slots).
 *
 * D — Universal product path (all graph sizes):
 * - ALWAYS cullAabb = worldViewportAabb(camera, OVERSCAN_MARGIN) with
 *   OVERSCAN_MARGIN = 2.0 (+200% viewport extent each side — free pan/zoom
 *   inside the overscan without re-sampling DotStream).
 * - ALWAYS bakedOverscan = that finite AABB (never infinite bake-all as product path).
 * - GraphSpatialIndex: rebuild on topology; incremental updateNodePositions when
 *   only a few nodes moved (setGraphData positions-only path). Int cell keys +
 *   edge incidence map for O(moved×degree) position updates.
 * - Node draw: only when nodesDirty (position/set change), not every edge-only partial.
 * - Underlay: O(candidates) via spatial index + O(1) edgesById map.
 * - drawFrame rebakes when tight viewport escapes bakedOverscan (small hysteresis
 *   slack against floating thrash), or when dirtyEdgeIds is set.
 * - FORCE_BAKE_ALL = false debug escape hatch only (tests / diagnostics); default false.
 *
 * E — Partial dirty + rim-coupled expansion (large-KB pure-perf):
 * - dirtyEdgeIds: Set<string> | "all" | null.
 * - After RimLock, expand dirty to **all edges on affected hubs** (moved nodes +
 *   endpoints of caller dirty) so multi-spoke packing never leaves stale sockets.
 * - setGraphData(data, { dirtyEdges, movedNodeIds }) for position-only; topology → "all".
 * - Host: graph-canvas uses diffGraphDirty / layout render options.
 * - Worker mode "partial" | "full"; seq still drops stale results.
 *
 * F — Durable merged buffer + dirty splice (B1):
 * - Packed resident Float32Array (mergedDotBuffer) + per-edge layout (startDot, count).
 * - Partial merge: when dirty edges keep the same dotCount, splice floats in place
 *   without re-walking clean edges into the arena; length change / prune → compact rebuild.
 * - GPU DotCircleBatch still rebuilt from the durable buffer (single tight pass).
 * - Multi-mesh tiles (B3) deferred — one mesh preferred while B1 suffices.
 *
 * G — Tile / multi-region residency (bookkeeping, appearance-neutral):
 * - Edges owned by one tile via midpoint hash into stable world tile grid.
 * - Single merged mesh from union of resident edge chunks; dedupe by edge id.
 * - Far tiles dropped when outside overscan (+ tile margin). OVERSCAN_MARGIN 2.0 kept.
 *
 * Signal wave (ambient weave):
 * - No free-flying pulse discs. Baked DotStream dots store t ∈ [0,1] along travel.
 * - When Signals on: rAF re-uploads DotCircleBatch colors only (base + soft peak mix).
 * - PART_OF parent→child; RELATES quieter. Toggle off restores base edge tokens.
 *
 * Landed (this pure-perf track):
 * - Rim-coupled dirty expansion, host dirty plumbing (settle/ambient emit dirty)
 * - Durable buffer + dirty splice, worker latest-only cancel
 * - Incremental RimLock for moved∪neighbors, spatial incidence + int keys
 * - Node layer redraw only when nodes dirty
 * - Optional createLargeStressGraphData export (not default mock)
 *
 * Deferred / residual risks:
 * - Continuous ambient opt-in only (`?motion=1`; default off; FA2 path removed)
 * - Multi-mesh per-tile GPU (B3) not landed — full mesh rebuild from durable buffer
 * - Server viewport graph slices / hierarchy drill out of scope
 * - Mid-sample worker abort depends on cooperative yield; very short jobs may finish
 *   before a superseding message is processed
 *
 * Never (hard bans):
 * - lodMul, maxDots, skipOuterLats, density LOD, half-res, soft sprites
 * - EDGE_BASE_BAND / alpha / packing-floor / densify / SDF look changes
 * - hierarchy expand-on-drill that silently hides loaded content
 * - setInteractionQuality that lowers quality; scale stage/root (only graphContent)
 * - re-sample DotStream every zoom step (only on overscan leave / dirty)
 */

import { Application, Container, Graphics } from "pixi.js";

import type { RtcCamera } from "../camera/rtc-camera";
import type { GraphData, GraphEdge, GraphNode } from "../core/graph-data";
import { recomputeIncidence } from "../core/graph-data";
import type { RimSlot } from "./draw-arrow";
import { DotCircleBatch } from "./dot-circle-batch";
import {
  EDGE_TYPE_PART_OF,
  EDGE_TYPE_RELATES,
  FLOATS_PER_DOT,
  FLOATS_PER_NODE,
  emptyBakePayload,
  sampleGraphEdgeDots,
  unpackEdgeRanges,
  type BakeEdgeDotRange,
  type BakeSamplePayload,
} from "./bake-sample";
import type {
  BakeWorkerMode,
  BakeWorkerRequest,
  BakeWorkerResponse,
} from "./bake-worker";
import {
  acquireBakeWorker,
  type BakeWorkerLease,
} from "./bake-worker-pool";
import {
  GraphSpatialIndex,
  type WorldAabb,
} from "../layout/spatial-index";
import {
  NODE_BASE_PX,
  NODE_DRAW_MIN_PX,
  edgeBandWidth,
  nodeRingWidth,
  nodeScreenRadius,
  usableZoom,
} from "../core/graph-scale";
import {
  applyRimLock,
  applyRimLockForNodes,
  rimLockNodesForMoves,
} from "../layout/rim-lock";
import { expandDirtyEdgesForHubs } from "../core/graph-diff";
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
  GRAPH_PULSE_UPLOAD_INTERVAL_MS,
} from "../core/graph-style";
import {
  modulateDotAppearance,
  pulseEndpointRadii,
  pulseProgress,
  pulseTravelLength,
  waveStyleForType,
  type WaveGeomContext,
} from "./edge-signal-pulse";

// -----------------------------------------------------------------------
// D — World AABB helpers for overscan cull
// -----------------------------------------------------------------------

/**
 * Overscan margin as a fraction of the viewport size on each side.
 * Universal product path (all graph sizes) — no bake-all default.
 * 2.0 = +200% full viewport extent each side — free pan/zoom inside overscan
 * without re-sampling DotStream; rebake only when tight viewport escapes.
 */
const OVERSCAN_MARGIN = 2.0;

/**
 * Debug-only: bake entire graph with infinite overscan (tests / diagnostics).
 * Product default is false — geometry residency always follows camera.
 * Must never be enabled as a size-threshold product fork.
 */
const FORCE_BAKE_ALL = false;

/** Infinite AABB for FORCE_BAKE_ALL only (tight viewport always "contained"). */
const BAKE_ALL_OVERSCAN: WorldAabb = {
  minX: -1e30,
  minY: -1e30,
  maxX: 1e30,
  maxY: 1e30,
};

/**
 * needsBake hysteresis: treat baked overscan as slightly larger when testing
 * containment so floating camera noise at the boundary does not thrash rebake.
 * Fraction of full viewport extent on each side (same units as OVERSCAN_MARGIN).
 */
const BAKE_ESCAPE_HYSTERESIS = 0.02;

/**
 * Stable world tile size for multi-region residency buckets.
 * Large enough that overscan (margin 2) spans a small tile neighborhood;
 * fixed in world units so pan reuses buckets without zoom thrash.
 */
const RESIDENT_TILE_SIZE = 512;

/** Extra tile rings kept beyond overscan tile AABB (drop farther). */
const TILE_DROP_MARGIN = 1;

/**
 * World-space pad for edge segment AABB — matches bake-sample cull pad
 * (max endpoint radii + band at reference zoom 1).
 */
function edgePadWorld(
  edge: GraphEdge,
  src: GraphNode,
  tgt: GraphNode
): number {
  const sourceRank = src.rank ?? 0;
  const targetRank = tgt.rank ?? 0;
  const radiusSource = nodeScreenRadius(sourceRank, 1);
  const radiusTarget = nodeScreenRadius(targetRank, 1);
  const kind = edge.type === "PART_OF" ? "part_of" : "relates";
  const band = edgeBandWidth(1, kind, sourceRank, targetRank);
  return Math.max(radiusSource, radiusTarget) + band;
}

/**
 * Low-zoom hairline underlay (constant screen width) while DotStream is subpixel.
 * Full strength below FADE_START; linear alpha fade to 0 at FLOOR so mid-zoom
 * (z≈4–7) does not show a solid line on top of emerging DotStream.
 * Does NOT scale edgeLayer (that detaches endpoints). Does NOT fatten band.
 */
const EDGE_UNDERLAY_FADE_START = 2.5;
const EDGE_VIS_ZOOM_FLOOR = 5.5;

/** Screen-space hairline width (px) for low-zoom underlay. */
const EDGE_UNDERLAY_SCREEN_PX = 1.15;

/**
 * World AABB of the camera viewport, optionally expanded by margin fraction
 * of full viewport size on each side.
 *
 * margin 0 → exact visible world rect
 * margin 1 → +100% viewport width/height on every side
 */
function worldViewportAabb(camera: RtcCamera, margin: number): WorldAabb {
  const z = usableZoom(camera.zoom);
  const camX = Number.isFinite(camera.camX) ? camera.camX : 0;
  const camY = Number.isFinite(camera.camY) ? camera.camY : 0;
  const vpW = Number.isFinite(camera.viewportWidth) ? camera.viewportWidth : 0;
  const vpH = Number.isFinite(camera.viewportHeight)
    ? camera.viewportHeight
    : 0;

  const halfW = vpW / (2 * z);
  const halfH = vpH / (2 * z);
  const m = Number.isFinite(margin) && margin > 0 ? margin : 0;
  // Expand each side by m * full world-viewport extent
  const expandX = halfW * 2 * m;
  const expandY = halfH * 2 * m;

  return {
    minX: camX - halfW - expandX,
    maxX: camX + halfW + expandX,
    minY: camY - halfH - expandY,
    maxY: camY + halfH + expandY,
  };
}

/** True when every point of `inner` lies inside `outer`. */
function aabbContains(outer: WorldAabb, inner: WorldAabb): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY
  );
}

/** Expand (pad > 0) or shrink (pad < 0) an AABB uniformly in world units. */
function expandAabb(a: WorldAabb, pad: number): WorldAabb {
  const p = Number.isFinite(pad) ? pad : 0;
  return {
    minX: a.minX - p,
    maxX: a.maxX + p,
    minY: a.minY - p,
    maxY: a.maxY + p,
  };
}

/** Circle (cx,cy,r) completely outside aabb → true (cull). */
function circleOutsideAabb(
  cx: number,
  cy: number,
  r: number,
  aabb: WorldAabb
): boolean {
  const rad = r > 0 ? r : 0;
  return (
    cx + rad < aabb.minX ||
    cx - rad > aabb.maxX ||
    cy + rad < aabb.minY ||
    cy - rad > aabb.maxY
  );
}

function tileIndex(v: number, tileSize: number): number {
  return Math.floor(v / tileSize);
}

function tileKey(ix: number, iy: number): string {
  return `${ix},${iy}`;
}

function midpointTileKey(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tileSize: number
): string {
  const mx = (x0 + x1) * 0.5;
  const my = (y0 + y1) * 0.5;
  return tileKey(tileIndex(mx, tileSize), tileIndex(my, tileSize));
}

/** Packed dots for one resident edge (owned by one tile). */
type ResidentEdgeChunk = {
  edgeId: string;
  tileKey: string;
  /** Packed [cx,cy,r,color,alpha,t] * dotCount */
  dots: Float32Array;
  dotCount: number;
};

export type PerfStats = {
  lastBakeMs: number;
  bakeCount: number;
  p95BakeMs: number;
  mode: "transform" | "bake";
};

export type SetGraphDataOptions = {
  /**
   * Edge dirty scope after this graph swap.
   * - "all" (default): full candidate rebake
   * - Iterable of edge ids: partial merge (positions-only / incident edges)
   * Topology identity change should use "all".
   */
  dirtyEdges?: "all" | Iterable<string>;
  /**
   * When set, spatial index uses updateNodePositions for these nodes instead
   * of full rebuild (same topology, positions only). Ignored when dirty is "all"
   * and moved set is omitted — full rebuild via topologyDirty.
   */
  movedNodeIds?: Iterable<string>;
};

export type PixiRendererHandle = {
  mount: (host: HTMLElement) => void | Promise<void>;
  destroy: () => void;
  setGraphData: (
    graphData: GraphData,
    options?: SetGraphDataOptions
  ) => void;
  /** Merge edge ids into dirty Set (no-op if already "all"). */
  markEdgesDirty: (edgeIds: Iterable<string>) => void;
  setCamera: (camera: RtcCamera) => void;
  render: () => void;
  /** Returns bake timing stats. */
  getPerfStats: () => PerfStats;
  /**
   * Interaction quality toggle (API kept for graph-canvas settle path).
   * No-op: world-bake + GPU vector batches already make interaction cheap.
   */
  setInteractionQuality: (mode: "full" | "fast") => void;
  /**
   * Continuous neural-style signal wave through DotStream edge dots (ambient).
   * When enabled, renderer owns an internal rAF so the wave runs while idle.
   */
  setSignalPulsesEnabled: (enabled: boolean) => void;
  /** Current signal-wave toggle state. */
  getSignalPulsesEnabled: () => boolean;
};

export type CreatePixiRendererOptions = {
  background?: number;
};

/** Max bake timing samples for P95. */
const PERF_SAMPLE_MAX = 64;

export function createPixiRenderer(
  options: CreatePixiRendererOptions = {}
): PixiRendererHandle {
  const background = options.background ?? GRAPH_BG;

  let app: Application | null = null;
  /** Hairline underlay for low-zoom visibility (under DotStream). */
  let edgeUnderlay: Graphics | null = null;
  let edgeLayer: Container | null = null;
  let nodeLayer: Graphics | null = null;
  let root: Container | null = null;
  let graphContent: Container | null = null;
  let graphData: GraphData | null = null;
  let camera: RtcCamera | null = null;
  let nodesByIdCache: Map<string, GraphNode> = new Map();
  /** O(1) edge id → edge for underlay / partial payload (rebuilt on setGraphData). */
  let edgesByIdCache: Map<string, GraphEdge> = new Map();
  let rimSlotCache: Map<string, Map<string, RimSlot>> = new Map();
  /** Broad-phase for viewport+overscan edge residency (rebuilt with topology). */
  const spatialIndex = new GraphSpatialIndex();
  let isMounted = false;
  let isDestroyed = false;

  /**
   * Ambient edge signal wave through DotStream dots (default on).
   * Renderer-owned rAF while enabled so the graph feels alive when idle.
   * Geometry stays fixed; only color/alpha are re-uploaded each frame.
   */
  let signalPulsesEnabled = true;
  let pulseRafId: number | null = null;
  /** Throttle wave color re-uploads (camera transform still every host frame). */
  let lastSignalUploadMs = 0;

  /**
   * Incidence / RimLock / spatial-index dirty. Cleared after main-thread recompute.
   * Separate from edge-dot dirty so we can prepare rim while worker samples.
   */
  let topologyDirty = true;
  /**
   * When topologyDirty and this is set, spatial index uses incremental path.
   * Cleared after ensureTopologyPrepared.
   */
  let pendingMovedNodeIds: Set<string> | null = null;

  /**
   * Edge-dot sample dirty flag.
   * - "all": full rebake (setGraphData default, markAllEdgesDirty, overscan miss)
   * - Set<edgeId>: partial re-sample + merge into resident chunks
   * - null: clean
   */
  let dirtyEdgeIds: Set<string> | "all" | null = "all";
  /**
   * Dirty accumulated while a bake is in flight (cleared dirty on post).
   * Applied after the in-flight result so partial merges do not drop edges.
   */
  let coalescedDirty: Set<string> | "all" | null = null;

  /**
   * Resident edge → packed dots (tile ownership). Single GPU mesh is the
   * merge of these chunks; no double-draw (one entry per edge id).
   */
  const residentEdges = new Map<string, ResidentEdgeChunk>();

  /**
   * Durable packed buffer for GPU feed (B1). Concatenation of resident edges
   * in `mergedEdgeOrder`; layout map gives O(1) dirty splice when counts match.
   */
  let mergedDotBuffer: Float32Array | null = null;
  let mergedDotCount = 0;
  /** edgeId → { startDot, dotCount } inside mergedDotBuffer. */
  const mergedEdgeLayout = new Map<
    string,
    { startDot: number; dotCount: number }
  >();
  /** Stable draw order for merged buffer (Map insertion order of residents). */
  let mergedEdgeOrder: string[] = [];
  /**
   * Node Graphics dirty — redraw only when positions/set change, not on
   * edge-only partial merges (C3).
   */
  let nodesDirty = true;

  /** False until first successful geometry upload (sync or worker). */
  let hasBaked = false;
  /**
   * World AABB used at last *applied* bake (viewport + OVERSCAN_MARGIN).
   * Null until first applied bake. drawFrame rebakes when tight viewport escapes.
   */
  let bakedOverscan: WorldAabb | null = null;

  // -----------------------------------------------------------------------
  // C — async bake state (navigation never blocks)
  // -----------------------------------------------------------------------
  /** Monotonic bake request id; worker results with older seq are ignored. */
  let bakeSeq = 0;
  /** Non-zero while a worker bake is in flight. */
  let inFlightSeq = 0;
  /** Overscan AABB of the in-flight bake (for needsBake suppression). */
  let inFlightOverscan: WorldAabb | null = null;
  /** Cull AABB used when sampling in-flight (nodes redrawn on apply). */
  let inFlightCullAabb: WorldAabb | null = null;
  /** Graph identity at request time — stale if setGraphData swapped mid-flight. */
  let inFlightGraphRef: GraphData | null = null;
  /** Mode of in-flight bake for merge path. */
  let inFlightMode: BakeWorkerMode = "full";
  /** Main-thread t0 for worker bake timing (post → apply). */
  let inFlightT0 = 0;

  /** Shared worker lease (null = sync forever after failure / unavailability). */
  let bakeLease: BakeWorkerLease | null | undefined;

  let edgeDotBatch: DotCircleBatch | null = null;

  /**
   * Lazy-acquire shared module worker. On failure, returns null and uses
   * sync sampleGraphEdgeDots forever after.
   */
  function getBakeLease(): BakeWorkerLease | null {
    if (bakeLease !== undefined) {
      return bakeLease;
    }
    const lease = acquireBakeWorker(onWorkerBakeResult, onWorkerError);
    bakeLease = lease;
    return lease;
  }

  // -----------------------------------------------------------------------
  // Underlay hygiene — world-space geometry under graphContent (pan is free
  // via RTC transform). Rebuild only on graph / zoom-fade-stroke / overscan
  // residency change — NOT every camX/camY pan.
  // -----------------------------------------------------------------------
  let lastUnderlayZoom = Number.NaN;
  let lastUnderlayVpW = Number.NaN;
  let lastUnderlayVpH = Number.NaN;
  let lastUnderlayGraphRef: GraphData | null = null;
  /** Overscan AABB used when last underlay candidates were drawn. */
  let lastUnderlayOverscan: WorldAabb | null = null;
  /** True when last draw left underlay empty (no strokes) — skip clear(). */
  let lastUnderlayEmpty = true;

  // -----------------------------------------------------------------------
  // Perf instrumentation (Phase 1)
  // -----------------------------------------------------------------------
  let lastBakeMs = 0;
  let bakeCount = 0;
  let bakeSamples: number[] = [];
  /** Last drawFrame path — for getPerfStats().mode */
  let lastMode: "transform" | "bake" = "bake";

  function recordBakeTiming(ms: number): void {
    lastBakeMs = ms;
    bakeCount++;
    bakeSamples.push(ms);
    if (bakeSamples.length > PERF_SAMPLE_MAX) {
      bakeSamples.shift();
    }
    if (ms > 8) {
      console.debug(`[graph] bake took ${ms.toFixed(1)}ms (#${bakeCount})`);
    }
  }

  /** P95 from the sorted sample window. */
  function p95BakeMs(): number {
    const n = bakeSamples.length;
    if (n === 0) return 0;
    const sorted = [...bakeSamples].sort((a, b) => a - b);
    const idx = Math.ceil(n * 0.95) - 1;
    return sorted[Math.max(0, Math.min(idx, n - 1))];
  }

  /** Force full edge re-sample on next bake (positions-only updates, etc.). */
  function markAllEdgesDirty(): void {
    dirtyEdgeIds = "all";
    // If a bake is in flight it will clear dirty on post; keep "all" coalesced
    // so flush after apply re-requests a full candidate bake.
    if (inFlightSeq !== 0) {
      coalescedDirty = "all";
    }
  }

  function addDirtyEdgeIds(edgeIds: Iterable<string>): void {
    if (dirtyEdgeIds === "all" || coalescedDirty === "all") return;
    if (inFlightSeq !== 0) {
      // Bake already posted with a snapshot of dirty — accumulate for after apply.
      if (coalescedDirty === null) coalescedDirty = new Set();
      for (const id of edgeIds) coalescedDirty.add(id);
      return;
    }
    if (dirtyEdgeIds === null) {
      dirtyEdgeIds = new Set();
    }
    for (const id of edgeIds) {
      dirtyEdgeIds.add(id);
    }
  }

  /** After apply: promote coalesced mid-flight dirty onto dirtyEdgeIds. */
  function flushCoalescedDirty(): void {
    if (coalescedDirty === null) return;
    if (coalescedDirty === "all") {
      dirtyEdgeIds = "all";
    } else if (coalescedDirty.size > 0 && dirtyEdgeIds !== "all") {
      if (dirtyEdgeIds === null) {
        dirtyEdgeIds = coalescedDirty;
      } else {
        for (const id of coalescedDirty) dirtyEdgeIds.add(id);
      }
    }
    coalescedDirty = null;
  }

  /** Rebuild rimSlotCache from current graphData node rimOccupations. */
  function rebuildRimSlotCache(): void {
    if (!graphData) {
      rimSlotCache = new Map();
      return;
    }
    const map = new Map<string, Map<string, RimSlot>>();
    for (const node of graphData.nodes) {
      const slotMap = new Map<string, RimSlot>();
      for (const occ of node.rimOccupations) {
        slotMap.set(occ.edgeId, {
          midAngle: occ.midAngle,
          halfSpan: occ.halfSpan,
        });
      }
      map.set(node.id, slotMap);
    }
    rimSlotCache = map;
  }

  /**
   * Patch rimSlotCache for a subset of nodes after incremental RimLock.
   */
  function patchRimSlotCache(nodeIds: ReadonlySet<string>): void {
    if (!graphData) return;
    for (const id of nodeIds) {
      const node = nodesByIdCache.get(id);
      if (!node) {
        rimSlotCache.delete(id);
        continue;
      }
      const slotMap = new Map<string, RimSlot>();
      for (const occ of node.rimOccupations) {
        slotMap.set(occ.edgeId, {
          midAngle: occ.midAngle,
          halfSpan: occ.halfSpan,
        });
      }
      rimSlotCache.set(id, slotMap);
    }
  }

  /**
   * After RimLock: expand partial dirty to all edges on affected hubs so
   * multi-spoke packing never leaves stale DotStream vs new sockets (A1).
   * Also expands coalescedDirty (mid-flight) so hub edges are not dropped.
   */
  function expandDirtyAfterRimLock(
    moved: ReadonlySet<string> | null
  ): void {
    if (!graphData) return;
    if (dirtyEdgeIds instanceof Set) {
      dirtyEdgeIds = expandDirtyEdgesForHubs(
        graphData,
        dirtyEdgeIds,
        moved
      );
    }
    if (coalescedDirty instanceof Set) {
      coalescedDirty = expandDirtyEdgesForHubs(
        graphData,
        coalescedDirty,
        moved
      );
    }
  }

  /**
   * Main-thread incidence + RimLock + spatial index when topology dirty.
   * Prefer incremental RimLock + spatial update when only a few nodes moved.
   * Always rim-expands partial dirty after lock (hub correctness).
   */
  function ensureTopologyPrepared(): void {
    if (!graphData || !topologyDirty) return;
    recomputeIncidence(graphData);

    const moved = pendingMovedNodeIds;
    const useIncrementalRim =
      moved !== null &&
      moved.size > 0 &&
      dirtyEdgeIds !== "all" &&
      hasBaked;

    if (useIncrementalRim && moved) {
      // Re-lock movers + neighbors (preferred rays change at both ends).
      const lockSet = rimLockNodesForMoves(graphData, moved);
      applyRimLockForNodes(graphData, lockSet, 1);
      patchRimSlotCache(lockSet);
    } else {
      applyRimLock(graphData, 1);
      rebuildRimSlotCache();
    }

    // A1: rim-coupled dirty expansion (partial only).
    expandDirtyAfterRimLock(moved);

    if (moved && moved.size > 0) {
      spatialIndex.updateNodePositions(graphData, moved, edgePadWorld);
    } else {
      spatialIndex.rebuild(graphData, edgePadWorld);
    }
    pendingMovedNodeIds = null;
    topologyDirty = false;
  }

  /**
   * Ensure spatial index is ready for query. Rebuilds when topology dirty or
   * when the index is empty/stale while the graph still has finite nodes.
   */
  function ensureSpatialIndexReady(): void {
    ensureTopologyPrepared();
    if (!graphData) return;
    if (graphData.nodes.length > 0 && spatialIndex.isEmpty()) {
      spatialIndex.rebuild(graphData, edgePadWorld);
    }
  }

  /**
   * Build packed sample payload for a subset of edges (or all candidates).
   * Product path: spatial candidates for viewport+overscan; FORCE_BAKE_ALL: full.
   * O(candidates) when edgeIdSet/filter known — iterates ids via edgesByIdCache
   * (same pattern as underlay), never scans full graph.edges.
   */
  function buildSamplePayload(
    cullAabb: WorldAabb | null,
    edgeIdFilter: Set<string> | null
  ): BakeSamplePayload {
    const colors = {
      partOfColor: GRAPH_EDGE_PART_OF,
      partOfAlpha: GRAPH_EDGE_PART_OF_ALPHA,
      relatesColor: GRAPH_EDGE_RELATES,
      relatesAlpha: GRAPH_EDGE_RELATES_ALPHA,
    };

    if (!graphData) {
      return emptyBakePayload(colors, null);
    }

    const bakeAll = FORCE_BAKE_ALL || cullAabb === null;

    let edgeIdSet: Set<string> | null = null;
    if (!bakeAll && cullAabb) {
      ensureSpatialIndexReady();
      edgeIdSet = new Set(spatialIndex.queryEdgeIds(cullAabb));
    }

    // Resolve which edge ids to pack — iterate candidates / filter, not all E.
    const selectedEdges: GraphEdge[] = [];
    const nodeIdSet = new Set<string>();

    if (bakeAll && !edgeIdFilter) {
      for (const e of graphData.edges) {
        selectedEdges.push(e);
        nodeIdSet.add(e.source);
        nodeIdSet.add(e.target);
      }
    } else {
      // Candidate ids (or filter-only when bake-all partial).
      let idIter: Iterable<string>;
      if (edgeIdFilter && edgeIdSet) {
        // Intersection without scanning full graph.
        const smaller =
          edgeIdFilter.size <= edgeIdSet.size ? edgeIdFilter : edgeIdSet;
        const larger = smaller === edgeIdFilter ? edgeIdSet : edgeIdFilter;
        const inter: string[] = [];
        for (const id of smaller) {
          if (larger.has(id)) inter.push(id);
        }
        idIter = inter;
      } else if (edgeIdFilter) {
        idIter = edgeIdFilter;
      } else if (edgeIdSet) {
        idIter = edgeIdSet;
      } else {
        idIter = graphData.edges.map((e) => e.id);
      }

      for (const id of idIter) {
        const e = edgesByIdCache.get(id);
        if (!e) continue;
        selectedEdges.push(e);
        nodeIdSet.add(e.source);
        nodeIdSet.add(e.target);
      }
    }

    // Pack nodes (only endpoints + bake-all full set).
    const nodeIds: string[] = [];
    if (bakeAll) {
      for (const n of graphData.nodes) {
        nodeIds.push(n.id);
      }
    } else {
      for (const id of nodeIdSet) {
        if (nodesByIdCache.has(id)) nodeIds.push(id);
      }
    }
    const nodeIndexById = new Map<string, number>();
    const nodeXYR = new Float32Array(nodeIds.length * FLOATS_PER_NODE);
    for (let i = 0; i < nodeIds.length; i++) {
      const n = nodesByIdCache.get(nodeIds[i]);
      if (!n) continue;
      nodeIndexById.set(nodeIds[i], i);
      const o = i * FLOATS_PER_NODE;
      nodeXYR[o] = n.x;
      nodeXYR[o + 1] = n.y;
      nodeXYR[o + 2] = n.rank;
    }

    const edgeCount = selectedEdges.length;
    const edgeIds: string[] = new Array(edgeCount);
    const edgeEndpoints = new Uint32Array(edgeCount * 2);
    const edgeTypes = new Uint8Array(edgeCount);
    for (let i = 0; i < edgeCount; i++) {
      const e = selectedEdges[i];
      edgeIds[i] = e.id;
      const si = nodeIndexById.get(e.source);
      const ti = nodeIndexById.get(e.target);
      edgeEndpoints[i * 2] = si ?? 0xffffffff;
      edgeEndpoints[i * 2 + 1] = ti ?? 0xffffffff;
      edgeTypes[i] =
        e.type === "PART_OF" ? EDGE_TYPE_PART_OF : EDGE_TYPE_RELATES;
    }

    // Rim slots for selected edges / endpoint nodes only.
    const rimNodeIds: string[] = [];
    const rimEdgeIds: string[] = [];
    const rimAngleVals: number[] = [];
    for (const [nodeId, slotMap] of rimSlotCache) {
      if (!bakeAll && !nodeIdSet.has(nodeId)) continue;
      for (const [edgeId, slot] of slotMap) {
        if (edgeIdSet && !edgeIdSet.has(edgeId)) continue;
        if (edgeIdFilter && !edgeIdFilter.has(edgeId)) continue;
        rimNodeIds.push(nodeId);
        rimEdgeIds.push(edgeId);
        rimAngleVals.push(slot.midAngle, slot.halfSpan);
      }
    }
    const rimAngles = new Float32Array(rimAngleVals);

    return {
      nodeIds,
      nodeXYR,
      edgeIds,
      edgeEndpoints,
      edgeTypes,
      rimNodeIds,
      rimEdgeIds,
      rimAngles,
      cullAabb: cullAabb
        ? {
            minX: cullAabb.minX,
            minY: cullAabb.minY,
            maxX: cullAabb.maxX,
            maxY: cullAabb.maxY,
          }
        : null,
      ...colors,
    };
  }

  /**
   * Drop resident edge chunks whose owner tile is far from overscan.
   * Keeps edges whose tiles intersect expanded overscan (tile margin).
   * Candidate edges whose owner is outside overscan but still needed are
   * re-added by full/partial sample paths (not dropped if still candidates).
   */
  function pruneFarTiles(
    overscan: WorldAabb,
    keepEdgeIds: ReadonlySet<string> | null
  ): void {
    if (FORCE_BAKE_ALL) return;
    const ts = RESIDENT_TILE_SIZE;
    const ix0 = tileIndex(overscan.minX, ts) - TILE_DROP_MARGIN;
    const ix1 = tileIndex(overscan.maxX, ts) + TILE_DROP_MARGIN;
    const iy0 = tileIndex(overscan.minY, ts) - TILE_DROP_MARGIN;
    const iy1 = tileIndex(overscan.maxY, ts) + TILE_DROP_MARGIN;

    for (const [edgeId, chunk] of residentEdges) {
      // keepEdgeIds: candidates still needed even if owner tile is far.
      if (keepEdgeIds && keepEdgeIds.has(edgeId)) continue;
      const parts = chunk.tileKey.split(",");
      const tx = Number(parts[0]);
      const ty = Number(parts[1]);
      if (
        !Number.isFinite(tx) ||
        !Number.isFinite(ty) ||
        tx < ix0 ||
        tx > ix1 ||
        ty < iy0 ||
        ty > iy1
      ) {
        residentEdges.delete(edgeId);
      }
    }
  }

  /**
   * Merge sampled edge ranges into resident map (replace per edge id).
   * Copies each edge's floats into a pooled buffer (grow-in-place / reuse when
   * capacity allows) so the worker transferable can be discarded after merge.
   * Same bytes uploaded; avoids Float32Array alloc per edge on every merge.
   * @returns edge ids that were written (for durable-buffer splice).
   */
  function mergeEdgeRangesIntoResident(
    dots: Float32Array,
    ranges: BakeEdgeDotRange[]
  ): string[] {
    if (!graphData) return [];
    const touched: string[] = [];
    for (const range of ranges) {
      const { edgeId, startDot, dotCount } = range;
      if (dotCount <= 0) {
        if (residentEdges.has(edgeId)) {
          residentEdges.delete(edgeId);
          touched.push(edgeId);
        }
        continue;
      }
      const edge = edgesByIdCache.get(edgeId);
      const src = edge ? nodesByIdCache.get(edge.source) : undefined;
      const tgt = edge ? nodesByIdCache.get(edge.target) : undefined;
      const tk =
        src && tgt
          ? midpointTileKey(src.x, src.y, tgt.x, tgt.y, RESIDENT_TILE_SIZE)
          : "0,0";
      const need = dotCount * FLOATS_PER_DOT;
      const existing = residentEdges.get(edgeId);
      let packed: Float32Array;
      if (existing && existing.dots.length >= need) {
        // Reuse capacity; only the first need floats are live.
        packed = existing.dots;
      } else {
        // Grow with small slack so slight sample growth avoids re-alloc.
        const cap = Math.max(need, existing ? existing.dots.length * 2 : need);
        packed = new Float32Array(cap);
      }
      packed.set(
        dots.subarray(
          startDot * FLOATS_PER_DOT,
          (startDot + dotCount) * FLOATS_PER_DOT
        ),
        0
      );
      residentEdges.set(edgeId, {
        edgeId,
        tileKey: tk,
        dots: packed,
        dotCount,
      });
      touched.push(edgeId);
    }
    return touched;
  }

  /**
   * Full replace of resident set from a full-sample result.
   * Drops edges not present in ranges (0-dot ranges remove).
   */
  function replaceResidentFromFullSample(
    dots: Float32Array,
    ranges: BakeEdgeDotRange[],
    candidateIds: ReadonlySet<string> | null
  ): void {
    if (candidateIds) {
      for (const id of [...residentEdges.keys()]) {
        if (!candidateIds.has(id)) {
          residentEdges.delete(id);
        }
      }
    } else {
      residentEdges.clear();
    }
    mergeEdgeRangesIntoResident(dots, ranges);
  }

  /**
   * Rebuild durable mergedDotBuffer from all residentEdges (compact).
   * Used after full sample, prune, or when dirty splice cannot preserve layout.
   */
  function rebuildMergedBufferFromResidents(): void {
    let totalDots = 0;
    const order: string[] = [];
    for (const [edgeId, chunk] of residentEdges) {
      if (chunk.dotCount <= 0) continue;
      order.push(edgeId);
      totalDots += chunk.dotCount;
    }
    mergedEdgeOrder = order;
    mergedEdgeLayout.clear();

    if (totalDots === 0) {
      mergedDotBuffer = null;
      mergedDotCount = 0;
      return;
    }

    const need = totalDots * FLOATS_PER_DOT;
    let buf = mergedDotBuffer;
    if (!buf || buf.length < need) {
      const cap = Math.max(need, buf ? buf.length * 2 : need);
      buf = new Float32Array(cap);
      mergedDotBuffer = buf;
    }

    let cursor = 0;
    for (const edgeId of order) {
      const chunk = residentEdges.get(edgeId);
      if (!chunk || chunk.dotCount <= 0) continue;
      const floatOff = cursor * FLOATS_PER_DOT;
      const nFloats = chunk.dotCount * FLOATS_PER_DOT;
      buf.set(chunk.dots.subarray(0, nFloats), floatOff);
      mergedEdgeLayout.set(edgeId, {
        startDot: cursor,
        dotCount: chunk.dotCount,
      });
      cursor += chunk.dotCount;
    }
    mergedDotCount = cursor;
  }

  /**
   * Try to splice dirty edges into durable buffer without walking clean edges.
   * Returns true if splice succeeded; false → caller should full rebuild.
   */
  function trySpliceDirtyIntoMerged(dirtyEdgeIdsList: readonly string[]): boolean {
    if (!mergedDotBuffer || mergedEdgeLayout.size === 0) return false;

    for (const edgeId of dirtyEdgeIdsList) {
      const chunk = residentEdges.get(edgeId);
      const layout = mergedEdgeLayout.get(edgeId);

      if (!chunk || chunk.dotCount <= 0) {
        // Edge removed from residents — need compact rebuild.
        if (layout) return false;
        continue;
      }

      if (!layout) {
        // New edge not in layout — need rebuild.
        return false;
      }

      if (layout.dotCount !== chunk.dotCount) {
        // Length change — cannot in-place splice.
        return false;
      }

      // Same-size: overwrite floats only for this edge.
      const floatOff = layout.startDot * FLOATS_PER_DOT;
      const nFloats = chunk.dotCount * FLOATS_PER_DOT;
      mergedDotBuffer.set(chunk.dots.subarray(0, nFloats), floatOff);
    }

    // Dropped residents that still have layout → need compact.
    for (const edgeId of mergedEdgeLayout.keys()) {
      if (!residentEdges.has(edgeId)) return false;
    }

    return true;
  }

  /**
   * Sync durable buffer after resident map update.
   * Partial path: splice when possible; else full compact rebuild.
   */
  function syncMergedBuffer(
    mode: BakeWorkerMode,
    touchedEdgeIds: readonly string[]
  ): void {
    if (mode === "full" || mergedDotBuffer === null || mergedEdgeLayout.size === 0) {
      rebuildMergedBufferFromResidents();
      return;
    }
    // After prune, resident set may be smaller — detect via layout keys.
    if (residentEdges.size !== mergedEdgeLayout.size) {
      rebuildMergedBufferFromResidents();
      return;
    }
    if (!trySpliceDirtyIntoMerged(touchedEdgeIds)) {
      rebuildMergedBufferFromResidents();
    }
  }

  /**
   * Feed DotCircleBatch from durable merged buffer (single tight pass).
   * Falls back to resident map walk if buffer missing.
   *
   * When `timeSeconds` is finite and signals are on, modulates color/alpha
   * with the traveling brightness wave (positions/radii unchanged).
   */
  function uploadEdgesFromMergedBuffer(timeSeconds?: number | null): void {
    if (!edgeLayer || !edgeDotBatch) return;
    const batch = edgeDotBatch;
    batch.begin();

    const waveT =
      signalPulsesEnabled &&
      typeof timeSeconds === "number" &&
      Number.isFinite(timeSeconds)
        ? timeSeconds
        : null;

    if (mergedDotBuffer && mergedDotCount > 0) {
      const buf = mergedDotBuffer;
      if (waveT !== null && mergedEdgeOrder.length > 0) {
        const zoom = camera ? usableZoom(camera.zoom) : 1;
        for (const edgeId of mergedEdgeOrder) {
          const layout = mergedEdgeLayout.get(edgeId);
          if (!layout || layout.dotCount <= 0) continue;
          const edge = edgesByIdCache.get(edgeId);
          const style = waveStyleForType(edge?.type ?? "RELATES_TO");
          const src = edge ? nodesByIdCache.get(edge.source) : undefined;
          const tgt = edge ? nodesByIdCache.get(edge.target) : undefined;
          const worldLen =
            edge && src && tgt ? pulseTravelLength(edge, src, tgt) : 80;
          const radii =
            edge && src && tgt
              ? pulseEndpointRadii(edge, src, tgt)
              : { fromRadius: 12, toRadius: 12 };
          const geom: WaveGeomContext = {
            worldLength: worldLen,
            zoom,
            fromRadius: radii.fromRadius,
            toRadius: radii.toRadius,
          };
          const phase = pulseProgress(
            edgeId,
            waveT,
            worldLen,
            style.speedScale
          );
          for (let i = 0; i < layout.dotCount; i++) {
            const o = (layout.startDot + i) * FLOATS_PER_DOT;
            const { color, alpha } = modulateDotAppearance(
              buf[o + 3],
              buf[o + 4],
              buf[o + 5],
              buf[o + 6],
              phase,
              style,
              geom
            );
            batch.add(buf[o], buf[o + 1], buf[o + 2], color, alpha);
          }
        }
      } else {
        for (let i = 0; i < mergedDotCount; i++) {
          const o = i * FLOATS_PER_DOT;
          batch.add(buf[o], buf[o + 1], buf[o + 2], buf[o + 3], buf[o + 4]);
        }
      }
    } else if (waveT !== null) {
      const zoom = camera ? usableZoom(camera.zoom) : 1;
      for (const chunk of residentEdges.values()) {
        const { edgeId, dots, dotCount } = chunk;
        const edge = edgesByIdCache.get(edgeId);
        const style = waveStyleForType(edge?.type ?? "RELATES_TO");
        const src = edge ? nodesByIdCache.get(edge.source) : undefined;
        const tgt = edge ? nodesByIdCache.get(edge.target) : undefined;
        const worldLen =
          edge && src && tgt ? pulseTravelLength(edge, src, tgt) : 80;
        const radii =
          edge && src && tgt
            ? pulseEndpointRadii(edge, src, tgt)
            : { fromRadius: 12, toRadius: 12 };
        const geom: WaveGeomContext = {
          worldLength: worldLen,
          zoom,
          fromRadius: radii.fromRadius,
          toRadius: radii.toRadius,
        };
        const phase = pulseProgress(
          edgeId,
          waveT,
          worldLen,
          style.speedScale
        );
        for (let i = 0; i < dotCount; i++) {
          const o = i * FLOATS_PER_DOT;
          const { color, alpha } = modulateDotAppearance(
            dots[o + 3],
            dots[o + 4],
            dots[o + 5],
            dots[o + 6],
            phase,
            style,
            geom
          );
          batch.add(dots[o], dots[o + 1], dots[o + 2], color, alpha);
        }
      }
    } else {
      for (const chunk of residentEdges.values()) {
        const { dots, dotCount } = chunk;
        for (let i = 0; i < dotCount; i++) {
          const o = i * FLOATS_PER_DOT;
          batch.add(dots[o], dots[o + 1], dots[o + 2], dots[o + 3], dots[o + 4]);
        }
      }
    }
    batch.flush(edgeLayer);
  }

  /** Wall-clock seconds for wave phase (or null when signals off). */
  function signalWaveTimeSeconds(): number | null {
    if (!signalPulsesEnabled) return null;
    if (typeof performance === "undefined") return 0;
    return performance.now() * 0.001;
  }

  /**
   * Redraw node Graphics only when nodesDirty (C3).
   */
  function uploadNodesIfDirty(cullAabb: WorldAabb | null): void {
    if (!nodeLayer || !graphData) return;
    if (!nodesDirty) return;

    const gNode = nodeLayer;
    gNode.clear();

    let nodeIter: Iterable<GraphNode>;
    if (cullAabb && !FORCE_BAKE_ALL) {
      ensureSpatialIndexReady();
      const nodeQuery = expandAabb(cullAabb, NODE_BASE_PX);
      const candidateIds = spatialIndex.queryNodeIds(nodeQuery);
      const list: GraphNode[] = [];
      for (const id of candidateIds) {
        const n = nodesByIdCache.get(id);
        if (n) list.push(n);
      }
      nodeIter = list;
    } else {
      nodeIter = graphData.nodes;
    }

    for (const node of nodeIter) {
      const radius = nodeScreenRadius(node.rank, 1);
      if (!Number.isFinite(radius) || radius < NODE_DRAW_MIN_PX) continue;
      if (
        cullAabb &&
        circleOutsideAabb(node.x, node.y, radius, cullAabb)
      ) {
        continue;
      }

      gNode.circle(node.x, node.y, radius);
      gNode.fill({ color: GRAPH_NODE_FILL, alpha: GRAPH_NODE_FILL_ALPHA });
      gNode.circle(node.x, node.y, radius);
      gNode.stroke({
        width: nodeRingWidth(1),
        color: GRAPH_NODE_RING,
        alpha: GRAPH_NODE_RING_ALPHA,
      });
    }

    nodesDirty = false;
  }

  /**
   * Concatenate resident edge chunks → DotCircleBatch + optional node redraw.
   * Uses durable merged buffer (B1); nodes only when nodesDirty (C3).
   */
  function uploadResidentToGpu(cullAabb: WorldAabb | null): void {
    if (!edgeLayer || !nodeLayer || !graphData || !edgeDotBatch) return;

    uploadEdgesFromMergedBuffer(signalWaveTimeSeconds());
    uploadNodesIfDirty(cullAabb);

    // Overscan escape may need nodes for newly visible area even if not "dirty".
    // When cull changes after overscan full bake, nodesDirty is set true by caller.

    lastUnderlayZoom = Number.NaN;
    lastUnderlayVpW = Number.NaN;
    lastUnderlayVpH = Number.NaN;
    lastUnderlayGraphRef = null;
    lastUnderlayOverscan = null;
    lastUnderlayEmpty = true;
  }

  function applyBakeResult(
    dots: Float32Array,
    _dotCount: number,
    ranges: BakeEdgeDotRange[],
    mode: BakeWorkerMode,
    cullAabb: WorldAabb | null,
    overscan: WorldAabb
  ): void {
    let touched: string[] = [];
    if (mode === "full") {
      let candidateIds: Set<string> | null = null;
      if (cullAabb && !FORCE_BAKE_ALL) {
        ensureSpatialIndexReady();
        candidateIds = new Set(spatialIndex.queryEdgeIds(cullAabb));
      }
      replaceResidentFromFullSample(dots, ranges, candidateIds);
      if (candidateIds) {
        pruneFarTiles(overscan, candidateIds);
      }
      // Full candidate residency change may reveal new nodes in cull.
      nodesDirty = true;
      rebuildMergedBufferFromResidents();
    } else {
      touched = mergeEdgeRangesIntoResident(dots, ranges);
      if (cullAabb && !FORCE_BAKE_ALL) {
        ensureSpatialIndexReady();
        const candidateIds = new Set(spatialIndex.queryEdgeIds(cullAabb));
        const beforeSize = residentEdges.size;
        pruneFarTiles(overscan, candidateIds);
        if (residentEdges.size !== beforeSize) {
          // Prune changed set — force compact.
          rebuildMergedBufferFromResidents();
        } else {
          syncMergedBuffer(mode, touched);
        }
      } else {
        syncMergedBuffer(mode, touched);
      }
    }
    uploadResidentToGpu(cullAabb);
  }

  function onWorkerBakeResult(msg: BakeWorkerResponse): void {
    if (isDestroyed || !isMounted) return;
    if (msg.type !== "bake-result") return;
    if (msg.seq !== bakeSeq) return;
    if (inFlightGraphRef !== graphData) return;

    const mode = msg.mode ?? inFlightMode;
    const overscan = inFlightOverscan ?? BAKE_ALL_OVERSCAN;
    const ranges = msg.edgeRangesPacked
      ? unpackEdgeRanges(msg.edgeRangesPacked)
      : [];
    applyBakeResult(
      msg.dots,
      msg.dotCount,
      ranges,
      mode,
      inFlightCullAabb,
      overscan
    );
    bakedOverscan = inFlightOverscan;
    hasBaked = true;
    dirtyEdgeIds = null;
    inFlightSeq = 0;
    inFlightOverscan = null;
    inFlightCullAabb = null;
    inFlightGraphRef = null;
    flushCoalescedDirty();
    lastMode = "bake";
    recordBakeTiming(performance.now() - inFlightT0);

    applyCameraTransform();
  }

  /**
   * Request edge-dot bake. Sync path samples on main; worker path posts and
   * returns immediately so pan/zoom keep prior geometry + camera transform.
   */
  function requestBake(): void {
    if (
      !edgeLayer ||
      !nodeLayer ||
      !graphData ||
      !edgeDotBatch ||
      !graphContent ||
      !camera
    ) {
      return;
    }

    ensureTopologyPrepared();

    const cullAabb: WorldAabb | null = FORCE_BAKE_ALL
      ? null
      : worldViewportAabb(camera, OVERSCAN_MARGIN);
    const overscan: WorldAabb = FORCE_BAKE_ALL
      ? BAKE_ALL_OVERSCAN
      : (cullAabb as WorldAabb);

    // Resolve bake mode: Set → partial (if we already have resident mesh);
    // "all" / first bake → full.
    let mode: BakeWorkerMode = "full";
    let edgeIdFilter: Set<string> | null = null;

    if (
      dirtyEdgeIds instanceof Set &&
      dirtyEdgeIds.size > 0 &&
      hasBaked &&
      residentEdges.size > 0
    ) {
      mode = "partial";
      // Only re-sample dirty edges that are overscan candidates.
      if (cullAabb && !FORCE_BAKE_ALL) {
        ensureSpatialIndexReady();
        const candidates = new Set(spatialIndex.queryEdgeIds(cullAabb));
        edgeIdFilter = new Set<string>();
        for (const id of dirtyEdgeIds) {
          if (candidates.has(id)) edgeIdFilter.add(id);
        }
        // If nothing to sample, still prune + clear dirty.
        if (edgeIdFilter.size === 0) {
          pruneFarTiles(overscan, candidates);
          uploadResidentToGpu(cullAabb);
          bakedOverscan = overscan;
          dirtyEdgeIds = null;
          lastMode = "transform";
          return;
        }
      } else {
        edgeIdFilter = new Set(dirtyEdgeIds);
      }
    }

    const payload = buildSamplePayload(cullAabb, edgeIdFilter);
    const lease = getBakeLease();

    if (lease) {
      bakeSeq += 1;
      const seq = bakeSeq;
      inFlightSeq = seq;
      inFlightOverscan = overscan;
      inFlightCullAabb = cullAabb;
      inFlightGraphRef = graphData;
      inFlightMode = mode;
      inFlightT0 = performance.now();
      // Snapshot dirty into this request; further dirty while in-flight coalesces.
      dirtyEdgeIds = null;
      if (mode === "full") {
        // Full sample covers all candidates — drop partial coalesce backlog.
        coalescedDirty = null;
      }

      const req: BakeWorkerRequest = {
        type: "bake",
        seq,
        clientId: lease.clientId,
        mode,
        payload,
      };
      lease.postBake(req);
      lastMode = hasBaked ? "transform" : "bake";
      return;
    }

    // ---- Sync fallback (no Worker) ----
    const t0 = performance.now();
    const result = sampleGraphEdgeDots(payload);
    applyBakeResult(
      result.dots,
      result.dotCount,
      result.edgeRanges,
      mode,
      cullAabb,
      overscan
    );
    bakedOverscan = overscan;
    hasBaked = true;
    dirtyEdgeIds = null;
    lastMode = "bake";
    recordBakeTiming(performance.now() - t0);
  }

  function onWorkerError(err: ErrorEvent): void {
    console.warn(
      "[graph] bake worker error, using sync bake forever",
      err.message
    );
    if (bakeLease) {
      try {
        bakeLease.release();
      } catch {
        // ignore
      }
    }
    bakeLease = null;
    inFlightSeq = 0;
    inFlightOverscan = null;
    inFlightCullAabb = null;
    inFlightGraphRef = null;
    markAllEdgesDirty();
  }

  /**
   * Whether we need a new edge sample.
   * While a worker bake is in flight for an overscan that still contains the
   * tight viewport, do not re-request (avoids thrash). Escape or dirty re-requests.
   */
  function needsBake(): boolean {
    if (!camera || !graphData) return false;

    if (dirtyEdgeIds === "all") return true;
    if (dirtyEdgeIds instanceof Set && dirtyEdgeIds.size > 0) return true;

    if (!hasBaked) {
      return inFlightSeq === 0;
    }

    const activeOverscan =
      inFlightSeq !== 0 && inFlightOverscan
        ? inFlightOverscan
        : bakedOverscan;
    if (!activeOverscan) return false;

    // In-flight for containing overscan: wait.
    if (inFlightSeq !== 0 && inFlightOverscan) {
      const tight = worldViewportAabb(camera, 0);
      const z = usableZoom(camera.zoom);
      const vpW = Number.isFinite(camera.viewportWidth)
        ? camera.viewportWidth
        : 0;
      const vpH = Number.isFinite(camera.viewportHeight)
        ? camera.viewportHeight
        : 0;
      const halfW = vpW / (2 * z);
      const halfH = vpH / (2 * z);
      const slack = Math.max(halfW, halfH) * 2 * BAKE_ESCAPE_HYSTERESIS;
      const outer =
        slack > 0 ? expandAabb(inFlightOverscan, slack) : inFlightOverscan;
      if (aabbContains(outer, tight)) {
        return false;
      }
      // Escaped in-flight overscan — need new bake.
      return true;
    }

    const tight = worldViewportAabb(camera, 0);
    const z = usableZoom(camera.zoom);
    const vpW = Number.isFinite(camera.viewportWidth) ? camera.viewportWidth : 0;
    const vpH = Number.isFinite(camera.viewportHeight)
      ? camera.viewportHeight
      : 0;
    const halfW = vpW / (2 * z);
    const halfH = vpH / (2 * z);
    const slack = Math.max(halfW, halfH) * 2 * BAKE_ESCAPE_HYSTERESIS;
    const outer =
      slack > 0 ? expandAabb(activeOverscan, slack) : activeOverscan;

    if (!aabbContains(outer, tight)) {
      return true;
    }

    return false;
  }

  /**
   * Constant-screen-width hairlines when DotStream is subpixel (z < floor).
   * Geometry is world-space under graphContent — pan is free via camera
   * transform. Rebuild only when: graph changes, zoom / fade / stroke params
   * change, or tight viewport escapes last underlay overscan residency.
   * Appearance: same stroke widths, alphas, fade curves as before.
   */
  function updateEdgeUnderlay(z: number): void {
    if (!edgeUnderlay || !graphData || !camera) return;

    const vpW = Number.isFinite(camera.viewportWidth) ? camera.viewportWidth : 0;
    const vpH = Number.isFinite(camera.viewportHeight)
      ? camera.viewportHeight
      : 0;

    // Empty early-out before clear() when underlay should stay empty.
    const wantEmpty =
      !(z > 0) ||
      z >= EDGE_VIS_ZOOM_FLOOR ||
      (() => {
        const span = EDGE_VIS_ZOOM_FLOOR - EDGE_UNDERLAY_FADE_START;
        if (span > 0 && z > EDGE_UNDERLAY_FADE_START) {
          const fade = 1 - (z - EDGE_UNDERLAY_FADE_START) / span;
          return fade <= 0;
        }
        return false;
      })();

    if (wantEmpty) {
      if (
        lastUnderlayEmpty &&
        lastUnderlayGraphRef === graphData &&
        Number.isFinite(lastUnderlayZoom) &&
        Math.abs(lastUnderlayZoom - z) < 1e-9
      ) {
        return;
      }
      if (!lastUnderlayEmpty) {
        edgeUnderlay.clear();
      }
      lastUnderlayEmpty = true;
      lastUnderlayZoom = z;
      lastUnderlayVpW = vpW;
      lastUnderlayVpH = vpH;
      lastUnderlayGraphRef = graphData;
      lastUnderlayOverscan = null;
      return;
    }

    const span = EDGE_VIS_ZOOM_FLOOR - EDGE_UNDERLAY_FADE_START;
    let fade = 1;
    if (span > 0 && z > EDGE_UNDERLAY_FADE_START) {
      fade = 1 - (z - EDGE_UNDERLAY_FADE_START) / span;
      if (fade <= 0) {
        // Defensive: wantEmpty should have caught this.
        if (!lastUnderlayEmpty) edgeUnderlay.clear();
        lastUnderlayEmpty = true;
        lastUnderlayZoom = z;
        lastUnderlayGraphRef = graphData;
        lastUnderlayOverscan = null;
        return;
      }
    }

    const strokeLocal = EDGE_UNDERLAY_SCREEN_PX / z;
    if (!(strokeLocal > 0) || !Number.isFinite(strokeLocal)) {
      if (!lastUnderlayEmpty) edgeUnderlay.clear();
      lastUnderlayEmpty = true;
      lastUnderlayZoom = z;
      lastUnderlayGraphRef = graphData;
      lastUnderlayOverscan = null;
      return;
    }

    // Overscan residency: pan inside last underlay overscan keeps geometry.
    // Zoom / viewport size / graph change still force rebuild (stroke + fade).
    const zoomUnchanged =
      Number.isFinite(lastUnderlayZoom) &&
      Math.abs(lastUnderlayZoom - z) < 1e-9;
    const vpUnchanged =
      Math.abs(lastUnderlayVpW - vpW) < 1e-9 &&
      Math.abs(lastUnderlayVpH - vpH) < 1e-9;
    const graphUnchanged = lastUnderlayGraphRef === graphData;

    if (
      !FORCE_BAKE_ALL &&
      graphUnchanged &&
      zoomUnchanged &&
      vpUnchanged &&
      lastUnderlayOverscan
    ) {
      const tight = worldViewportAabb(camera, 0);
      const halfW = vpW / (2 * z);
      const halfH = vpH / (2 * z);
      const slack = Math.max(halfW, halfH) * 2 * BAKE_ESCAPE_HYSTERESIS;
      const outer =
        slack > 0
          ? expandAabb(lastUnderlayOverscan, slack)
          : lastUnderlayOverscan;
      if (aabbContains(outer, tight)) {
        // Pure pan inside residency — graphContent transform carries underlay
        // (including the empty-candidate case: no clear/redraw thrash).
        return;
      }
    } else if (
      FORCE_BAKE_ALL &&
      graphUnchanged &&
      zoomUnchanged &&
      vpUnchanged
    ) {
      // Full-graph underlay has no pan residency dependency.
      return;
    }

    const underlayAabb = FORCE_BAKE_ALL
      ? null
      : worldViewportAabb(camera, OVERSCAN_MARGIN);

    edgeUnderlay.clear();
    lastUnderlayZoom = z;
    lastUnderlayVpW = vpW;
    lastUnderlayVpH = vpH;
    lastUnderlayGraphRef = graphData;
    lastUnderlayOverscan = underlayAabb;
    lastUnderlayEmpty = true;

    const nodesById = nodesByIdCache;
    const g = edgeUnderlay;

    let edgeList: GraphEdge[];
    if (FORCE_BAKE_ALL || !underlayAabb) {
      edgeList = graphData.edges;
    } else {
      ensureSpatialIndexReady();
      const candidateIds = spatialIndex.queryEdgeIds(underlayAabb);
      if (candidateIds.length === 0) {
        edgeList = [];
      } else if (candidateIds.length >= graphData.edges.length) {
        edgeList = graphData.edges;
      } else {
        // O(candidates) via O(1) edge id map — never scan full list.
        edgeList = [];
        for (const id of candidateIds) {
          const e = edgesByIdCache.get(id);
          if (e) edgeList.push(e);
        }
      }
    }

    for (const edge of edgeList) {
      const src = nodesById.get(edge.source);
      const tgt = nodesById.get(edge.target);
      if (!src || !tgt) continue;

      const isPartOf = edge.type === "PART_OF";
      const color = isPartOf ? GRAPH_EDGE_PART_OF : GRAPH_EDGE_RELATES;
      const base = isPartOf
        ? GRAPH_EDGE_PART_OF_ALPHA
        : GRAPH_EDGE_RELATES_ALPHA;
      const alpha = base * 0.75 * fade;

      g.moveTo(src.x, src.y);
      g.lineTo(tgt.x, tgt.y);
      g.stroke({ width: strokeLocal, color, alpha });
      lastUnderlayEmpty = false;
    }
  }

  /**
   * Transform graphContent to match RTC camera.
   * World geometry baked at z=1; container scale = usableZoom,
   * position = RTC offset so screen(container) ≈ worldToScreen.
   */
  function applyCameraTransform(): void {
    if (!graphContent || !camera) return;

    const z = usableZoom(camera.zoom);
    const camX = Number.isFinite(camera.camX) ? camera.camX : 0;
    const camY = Number.isFinite(camera.camY) ? camera.camY : 0;

    graphContent.scale.set(z, z);
    graphContent.position.set(
      -camX * z + camera.viewportWidth / 2,
      -camY * z + camera.viewportHeight / 2
    );

    if (edgeLayer) edgeLayer.scale.set(1, 1);
    if (nodeLayer) nodeLayer.scale.set(1, 1);

    updateEdgeUnderlay(z);
  }

  /**
   * Re-upload DotStream edge batch with wave-modulated colors for this frame.
   * Positions/radii stay fixed in the durable buffer; only tint/alpha animate.
   */
  function drawSignalWave(nowMs: number, force = false): void {
    if (!signalPulsesEnabled || !edgeDotBatch || !edgeLayer) return;
    if (mergedDotCount <= 0 && residentEdges.size === 0) return;
    // Throttle GPU color rebuild (~30fps); pan/zoom still updates via host render.
    if (
      !force &&
      nowMs - lastSignalUploadMs < GRAPH_PULSE_UPLOAD_INTERVAL_MS
    ) {
      return;
    }
    lastSignalUploadMs = nowMs;
    uploadEdgesFromMergedBuffer(nowMs * 0.001);
  }

  function stopPulseLoop(): void {
    if (pulseRafId !== null) {
      cancelAnimationFrame(pulseRafId);
      pulseRafId = null;
    }
  }

  function startPulseLoop(): void {
    if (pulseRafId !== null) return;
    if (!signalPulsesEnabled || !isMounted || isDestroyed) return;

    const tick = (nowMs: number) => {
      pulseRafId = null;
      if (!signalPulsesEnabled || !isMounted || isDestroyed) return;
      drawSignalWave(nowMs, false);
      // Still render stage so continuous wave is visible without host pan.
      if (app?.renderer && app.stage) {
        app.renderer.render(app.stage);
      }
      pulseRafId = requestAnimationFrame(tick);
    };
    pulseRafId = requestAnimationFrame(tick);
  }

  function drawFrame(): void {
    if (
      !isMounted ||
      isDestroyed ||
      !edgeLayer ||
      !nodeLayer ||
      !camera ||
      !graphData ||
      !graphContent
    ) {
      return;
    }

    if (topologyDirty) {
      ensureTopologyPrepared();
    }

    if (needsBake()) {
      // Overscan escape while clean: mark full dirty so requestBake runs.
      if (dirtyEdgeIds === null) {
        markAllEdgesDirty();
      }
      // If partial dirty but overscan escaped, upgrade to full.
      if (
        dirtyEdgeIds instanceof Set &&
        bakedOverscan &&
        camera
      ) {
        const tight = worldViewportAabb(camera, 0);
        if (!aabbContains(bakedOverscan, tight)) {
          markAllEdgesDirty();
          nodesDirty = true;
        }
      }
      if (dirtyEdgeIds === "all") {
        // Full residency change may reveal new nodes in cull.
        nodesDirty = true;
      }
      requestBake();
    } else if (inFlightSeq === 0) {
      lastMode = "transform";
    }

    applyCameraTransform();

    // Wave rAF owns continuous color modulation while signals are on.
    // Host drawFrame does not re-upload edges unless a bake just applied.
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

      root = new Container();
      graphContent = new Container();

      edgeUnderlay = new Graphics();
      edgeLayer = new Container();
      edgeDotBatch = new DotCircleBatch();
      nodeLayer = new Graphics();

      // Stack: underlay → DotStream edges (wave modulates colors) → nodes
      graphContent.addChild(edgeUnderlay);
      graphContent.addChild(edgeLayer);
      graphContent.addChild(nodeLayer);
      root.addChild(graphContent);
      application.stage.addChild(root);

      isMounted = true;
      if (signalPulsesEnabled) {
        startPulseLoop();
      }
    },

    destroy(): void {
      isDestroyed = true;
      isMounted = false;
      stopPulseLoop();

      if (bakeLease) {
        try {
          bakeLease.release();
        } catch {
          // ignore
        }
      }
      bakeLease = null;

      if (edgeDotBatch) {
        edgeDotBatch.destroy();
        edgeDotBatch = null;
      }

      if (app) {
        app.destroy({ removeView: true }, { children: true });
        app = null;
      }

      edgeUnderlay = null;
      edgeLayer = null;
      nodeLayer = null;
      graphContent = null;
      root = null;
      graphData = null;
      camera = null;
      nodesByIdCache = new Map();
      edgesByIdCache = new Map();
      rimSlotCache = new Map();
      residentEdges.clear();
      mergedDotBuffer = null;
      mergedDotCount = 0;
      mergedEdgeLayout.clear();
      mergedEdgeOrder = [];
      nodesDirty = true;
      spatialIndex.clear();
      topologyDirty = true;
      pendingMovedNodeIds = null;
      dirtyEdgeIds = "all";
      coalescedDirty = null;
      hasBaked = false;
      bakedOverscan = null;
      bakeSeq = 0;
      inFlightSeq = 0;
      inFlightOverscan = null;
      inFlightCullAabb = null;
      inFlightGraphRef = null;
      lastUnderlayZoom = Number.NaN;
      lastUnderlayVpW = Number.NaN;
      lastUnderlayVpH = Number.NaN;
      lastUnderlayGraphRef = null;
      lastUnderlayOverscan = null;
      lastUnderlayEmpty = true;
    },

    setGraphData(
      nextGraphData: GraphData,
      setOptions?: SetGraphDataOptions
    ): void {
      graphData = nextGraphData;
      nodesByIdCache = new Map(nextGraphData.nodes.map((n) => [n.id, n]));
      edgesByIdCache = new Map(nextGraphData.edges.map((e) => [e.id, e]));
      topologyDirty = true;

      const dirtyOpt = setOptions?.dirtyEdges;
      if (dirtyOpt === undefined || dirtyOpt === "all") {
        // Invalidate in-flight: bump seq so stale result is dropped.
        if (inFlightSeq !== 0) {
          bakeSeq += 1;
          inFlightSeq = 0;
          inFlightOverscan = null;
          inFlightCullAabb = null;
          inFlightGraphRef = null;
        }
        dirtyEdgeIds = "all";
        coalescedDirty = null;
        pendingMovedNodeIds = null;
        residentEdges.clear();
        mergedDotBuffer = null;
        mergedDotCount = 0;
        mergedEdgeLayout.clear();
        mergedEdgeOrder = [];
        nodesDirty = true;
      } else {
        const set = new Set<string>();
        for (const id of dirtyOpt) set.add(id);
        // Nodes moved → redraw node layer (C3). Edge-only partial keeps nodes.
        if (setOptions?.movedNodeIds) {
          nodesDirty = true;
        }
        // If we have no resident mesh yet, partial is meaningless → full.
        if (!hasBaked || residentEdges.size === 0) {
          dirtyEdgeIds = "all";
          pendingMovedNodeIds = null;
          nodesDirty = true;
        } else if (inFlightSeq !== 0) {
          addDirtyEdgeIds(set);
          if (setOptions?.movedNodeIds) {
            const nextMoved = new Set(pendingMovedNodeIds ?? []);
            for (const id of setOptions.movedNodeIds) nextMoved.add(id);
            pendingMovedNodeIds = nextMoved;
          }
        } else {
          dirtyEdgeIds = set;
          if (setOptions?.movedNodeIds) {
            pendingMovedNodeIds = new Set(setOptions.movedNodeIds);
          } else {
            pendingMovedNodeIds = null;
          }
        }
      }
    },

    markEdgesDirty(edgeIds: Iterable<string>): void {
      addDirtyEdgeIds(edgeIds);
    },

    setCamera(nextCamera: RtcCamera): void {
      camera = nextCamera;
    },

    render(): void {
      if (!isMounted || isDestroyed) return;
      drawFrame();
    },

    getPerfStats(): PerfStats {
      return {
        lastBakeMs,
        bakeCount,
        p95BakeMs: p95BakeMs(),
        mode: lastMode,
      };
    },

    /**
     * No-op by design. A′ world-bake + GPU vector batches handle perf;
     * resolution downscale or quality toggle is unnecessary.
     */
    setInteractionQuality(_mode: "full" | "fast"): void {
      // intentionally empty — see file header
    },

    setSignalPulsesEnabled(enabled: boolean): void {
      signalPulsesEnabled = enabled;
      if (!enabled) {
        stopPulseLoop();
        // Restore base PART_OF / RELATES edge colors (static DotStream).
        if (isMounted && !isDestroyed && edgeDotBatch && edgeLayer) {
          uploadEdgesFromMergedBuffer(null);
        }
        return;
      }
      if (isMounted && !isDestroyed) {
        startPulseLoop();
      }
    },

    getSignalPulsesEnabled(): boolean {
      return signalPulsesEnabled;
    },
  };
}
