/**
 * Pixi v8 graph renderer — world-space bake + SDF discs + worker + overscan residency.
 *
 * Product path (only path):
 * - setGraphData(graph) — always full install → full dirty → full bake → full resident replace
 * - Finite overscan residency (OVERSCAN_MARGIN=2.0); no bake-all dual path
 * - Worker bake (onerror → sync forever); seq drops stale results
 * - Full RimLock + spatial rebuild on topology; durable merged buffer full rebuild
 * - Nodes paint independent of bake; signal wave colors via rAF
 *
 * Module map (single file):
 * - World AABB / overscan helpers
 * - Topology prep (full RimLock, rim slot cache, spatial index; incidence from caller)
 * - Bake request (payload, worker/sync, full resident replace, GPU upload)
 * - Signal wave color pass (throttled rAF)
 * - Camera transform + underlay + nodes
 * - Public handle: setGraphData, render, destroy, setSignalPulsesEnabled, setCamera
 *
 * HARD RULE: camera stays outside Pixi.
 * - Never pan/zoom with stage.scale / stage.position for world camera.
 * - Bake geometry in world coords (z=1) once per data change (or overscan miss).
 * - Every frame: scale graphContent by camera.zoom and position via RTC formula.
 * - Camera only transforms inside overscan; leave overscan → rebake candidates.
 *
 * A' (world-space bake):
 * - bake at reference zoom 1: nodeR_world = nodeScreenRadius(rank, 1),
 *   band_world = edgeBandWidth(1, ...)
 * - applyCameraTransform() sets graphContent.scale = z, position = RTC offset.
 * - Low zoom (z < EDGE_VIS_ZOOM_FLOOR): constant-screen-width hairline underlay
 *   so connections stay visible while DotStream is subpixel; mid/high zoom underlay off.
 *   Underlay is world-space under graphContent — pan-decoupled (rebuild on zoom /
 *   graph / overscan residency only, not every camX/camY).
 * - No re-bake on pan/zoom while the tight viewport stays inside baked overscan.
 *
 * B — SDF disc quads (dot-circle-batch.ts):
 * - DotCircleBatch emits 4-vert AA quads + GlProgram fragment disc (fwidth AA).
 * - Fan fallback (MIN_SEGMENTS=32) if Shader/GlProgram init or first Mesh fails.
 *
 * C — Shared bake worker (bake-worker-pool.ts + bake-worker.ts + bake-sample.ts):
 * - Main: full RimLock + spatial rebuild + candidate payload (incidence owned by placement/fixtures).
 * - Worker: pure DotStream sampling → transferable exact-size dots + packed edgeRanges.
 * - Latest-only: worker pending queue keeps newest seq per client; cooperative
 *   abort mid-sample after each edge when a newer bake supersedes.
 * - Main: full replace of residents + rebuild durable merged buffer → GPU.
 * - Sequence numbers drop stale worker results. Worker onerror / construct fail → sync forever.
 *
 * D — Universal residency (all graph sizes):
 * - ALWAYS cullAabb = worldViewportAabb(camera, OVERSCAN_MARGIN)
 * - ALWAYS bakedOverscan = that finite AABB (never bake-all / null cull)
 * - GraphSpatialIndex: full rebuild on topology
 * - Underlay: O(candidates) via spatial index + O(1) edgesById map
 * - drawFrame rebakes when tight viewport escapes bakedOverscan (hysteresis),
 *   or when edges are dirty (setGraphData / markAllEdgesDirty)
 *
 * E — Durable merged buffer:
 * - Packed resident Float32Array (mergedDotBuffer) rebuilt fully after each bake apply.
 * - GPU DotCircleBatch fed from the durable buffer (single tight pass).
 *
 * F — Tile / multi-region residency (bookkeeping, appearance-neutral):
 * - Edges owned by one tile via midpoint hash into stable world tile grid.
 * - Single merged mesh from union of resident edge chunks; dedupe by edge id.
 * - Far tiles dropped when outside overscan (+ tile margin).
 *
 * Signal wave (ambient weave):
 * - No free-flying pulse discs. Baked DotStream dots store t ∈ [0,1] along travel.
 * - When Signals on: rAF re-uploads DotCircleBatch colors only (base + soft peak mix).
 * - PART_OF parent→child; RELATES quieter. Toggle off restores base edge tokens.
 *
 * Never (hard bans):
 * - lodMul, maxDots, skipOuterLats, density LOD, half-res, soft sprites
 * - EDGE_BASE_BAND / alpha / packing-floor / densify / SDF look changes
 * - hierarchy expand-on-drill that silently hides loaded content
 * - scale stage/root for world camera (only graphContent)
 * - re-sample DotStream every zoom step (only on overscan leave / dirty)
 */
import { Application, Container, Graphics } from "pixi.js";

import type { RtcCamera } from "../camera/rtc-camera";
import type { GraphData, GraphEdge, GraphNode } from "../core/graph-data";
import type { RimSlot } from "./draw-arrow";
import { DotCircleBatch } from "./dot-circle-batch";
import {
  EDGE_TYPE_PART_OF,
  EDGE_TYPE_RELATES,
  FLOATS_PER_DOT,
  FLOATS_PER_NODE,
  sampleGraphEdgeDots,
  unpackEdgeRanges,
  type BakeEdgeDotRange,
  type BakeSamplePayload,
} from "./bake-sample";
import type {
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
import { applyRimLock } from "../layout/rim-lock";
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

export type PixiRendererHandle = {
  mount: (host: HTMLElement) => void | Promise<void>;
  destroy: () => void;
  setGraphData: (graphData: GraphData) => void;
  setCamera: (camera: RtcCamera) => void;
  render: () => void;
  /**
   * Continuous neural-style signal wave through DotStream edge dots (ambient).
   * When enabled, renderer owns an internal rAF so the wave runs while idle.
   */
  setSignalPulsesEnabled: (enabled: boolean) => void;
};

export type CreatePixiRendererOptions = {
  background?: number;
};

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
  /** O(1) edge id → edge for underlay / bake payload (rebuilt on setGraphData). */
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
   * Edge-dot sample dirty: "all" needs full candidate rebake; null is clean.
   * Product path is full-only (setGraphData, markAllEdgesDirty, overscan miss).
   */
  let dirtyEdgeIds: "all" | null = "all";
  /**
   * Full dirty requested while a bake is in flight (dirty cleared on post).
   * Promoted after apply so mid-flight invalidations are not dropped.
   */
  let dirtyWhileInFlight = false;

  /**
   * Resident edge → packed dots (tile ownership). Single GPU mesh is the
   * merge of these chunks; no double-draw (one entry per edge id).
   */
  const residentEdges = new Map<string, ResidentEdgeChunk>();

  /**
   * Durable packed buffer for GPU feed. Concatenation of resident edges
   * in `mergedEdgeOrder`; rebuilt fully after each full bake apply.
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
   * Node Graphics dirty — redraw when positions/set change (full setGraphData).
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

  /** Force full edge re-sample on next bake. */
  function markAllEdgesDirty(): void {
    dirtyEdgeIds = "all";
    // If a bake is in flight it will clear dirty on post; remember full redirty
    // so flush after apply re-requests a full candidate bake.
    if (inFlightSeq !== 0) {
      dirtyWhileInFlight = true;
    }
  }

  /** After apply: promote mid-flight full dirty onto dirtyEdgeIds. */
  function flushDirtyWhileInFlight(): void {
    if (!dirtyWhileInFlight) return;
    dirtyEdgeIds = "all";
    dirtyWhileInFlight = false;
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
   * Full RimLock + rim slot cache + spatial rebuild when topology dirty.
   * Incidence (childIds/parentIds/relateIds) is owned by placement/fixtures —
   * callers must `recomputeIncidence` before paint (product: placeTopology).
   * Spatial index's internal incidentEdges is a separate structure rebuilt here.
   * Product path always full (no incremental / positions-only partial).
   */
  function ensureTopologyPrepared(): void {
    if (!graphData || !topologyDirty) return;
    applyRimLock(graphData, 1);
    rebuildRimSlotCache();
    spatialIndex.rebuild(graphData, edgePadWorld);
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
   * Build packed sample payload for overscan spatial candidates.
   * Caller always passes worldViewportAabb(camera, OVERSCAN_MARGIN).
   * O(candidates) via edgesByIdCache — never full-E bake-all.
   */
  function buildSamplePayload(cullAabb: WorldAabb): BakeSamplePayload {
    const colors = {
      partOfColor: GRAPH_EDGE_PART_OF,
      partOfAlpha: GRAPH_EDGE_PART_OF_ALPHA,
      relatesColor: GRAPH_EDGE_RELATES,
      relatesAlpha: GRAPH_EDGE_RELATES_ALPHA,
    };

    // requestBake already requires graphData; topology must be ready.
    ensureSpatialIndexReady();
    const edgeIdSet = new Set(spatialIndex.queryEdgeIds(cullAabb));

    const selectedEdges: GraphEdge[] = [];
    const nodeIdSet = new Set<string>();
    for (const id of edgeIdSet) {
      const e = edgesByIdCache.get(id);
      if (!e) continue;
      selectedEdges.push(e);
      nodeIdSet.add(e.source);
      nodeIdSet.add(e.target);
    }

    // Pack endpoint nodes only (overscan candidates).
    const nodeIds: string[] = [];
    for (const id of nodeIdSet) {
      if (nodesByIdCache.has(id)) nodeIds.push(id);
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
      if (!nodeIdSet.has(nodeId)) continue;
      for (const [edgeId, slot] of slotMap) {
        if (!edgeIdSet.has(edgeId)) continue;
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
      cullAabb: {
        minX: cullAabb.minX,
        minY: cullAabb.minY,
        maxX: cullAabb.maxX,
        maxY: cullAabb.maxY,
      },
      ...colors,
    };
  }

  /**
   * Drop resident edge chunks whose owner tile is far from overscan.
   * Keeps edges whose tiles intersect expanded overscan (tile margin).
   * Candidate edges whose owner is outside overscan but still needed are
   * re-added by full sample path (not dropped if still candidates).
   */
  function pruneFarTiles(
    overscan: WorldAabb,
    keepEdgeIds: ReadonlySet<string> | null
  ): void {
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
   * Drops edges outside the overscan candidate set; merges sampled ranges.
   */
  function replaceResidentFromFullSample(
    dots: Float32Array,
    ranges: BakeEdgeDotRange[],
    candidateIds: ReadonlySet<string>
  ): void {
    for (const id of [...residentEdges.keys()]) {
      if (!candidateIds.has(id)) {
        residentEdges.delete(id);
      }
    }
    mergeEdgeRangesIntoResident(dots, ranges);
  }

  /**
   * Rebuild durable mergedDotBuffer from all residentEdges (compact).
   * Used after every full bake apply (and when residents are cleared).
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
   * Redraw node Graphics only when nodesDirty (overscan candidates).
   */
  function uploadNodesIfDirty(cullAabb: WorldAabb): void {
    if (!nodeLayer || !graphData) return;
    if (!nodesDirty) return;

    const gNode = nodeLayer;
    gNode.clear();

    ensureSpatialIndexReady();
    const nodeQuery = expandAabb(cullAabb, NODE_BASE_PX);
    const candidateIds = spatialIndex.queryNodeIds(nodeQuery);
    const nodeIter: GraphNode[] = [];
    for (const id of candidateIds) {
      const n = nodesByIdCache.get(id);
      if (n) nodeIter.push(n);
    }

    for (const node of nodeIter) {
      const radius = nodeScreenRadius(node.rank, 1);
      if (!Number.isFinite(radius) || radius < NODE_DRAW_MIN_PX) continue;
      if (circleOutsideAabb(node.x, node.y, radius, cullAabb)) {
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
   * Uses durable merged buffer; nodes only when nodesDirty.
   */
  function uploadResidentToGpu(cullAabb: WorldAabb): void {
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
    ranges: BakeEdgeDotRange[],
    cullAabb: WorldAabb,
    overscan: WorldAabb
  ): void {
    ensureSpatialIndexReady();
    const candidateIds = new Set(spatialIndex.queryEdgeIds(cullAabb));
    replaceResidentFromFullSample(dots, ranges, candidateIds);
    pruneFarTiles(overscan, candidateIds);
    // Full candidate residency change may reveal new nodes in cull.
    nodesDirty = true;
    rebuildMergedBufferFromResidents();
    uploadResidentToGpu(cullAabb);
  }

  function onWorkerBakeResult(msg: BakeWorkerResponse): void {
    if (isDestroyed || !isMounted) return;
    if (msg.type !== "bake-result") return;
    if (msg.seq !== bakeSeq) return;
    if (inFlightGraphRef !== graphData) return;

    // Finite overscan only — never infinite AABB. Prefer in-flight snapshot;
    // fall back to current camera overscan if the snapshot was cleared.
    const overscan =
      inFlightOverscan ??
      (camera ? worldViewportAabb(camera, OVERSCAN_MARGIN) : null);
    const cullAabb =
      inFlightCullAabb ??
      (camera ? worldViewportAabb(camera, OVERSCAN_MARGIN) : null);
    if (!overscan || !cullAabb) {
      inFlightSeq = 0;
      inFlightOverscan = null;
      inFlightCullAabb = null;
      inFlightGraphRef = null;
      flushDirtyWhileInFlight();
      return;
    }
    const ranges = msg.edgeRangesPacked
      ? unpackEdgeRanges(msg.edgeRangesPacked)
      : [];
    applyBakeResult(msg.dots, ranges, cullAabb, overscan);
    bakedOverscan = overscan;
    hasBaked = true;
    dirtyEdgeIds = null;
    inFlightSeq = 0;
    inFlightOverscan = null;
    inFlightCullAabb = null;
    inFlightGraphRef = null;
    flushDirtyWhileInFlight();

    applyCameraTransform();
    // Worker results arrive off the host rAF path — paint immediately.
    if (app?.renderer && app.stage) {
      app.renderer.render(app.stage);
    }
  }

  /**
   * Request full edge-dot bake. Sync path samples on main; worker path posts and
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

    const cullAabb = worldViewportAabb(camera, OVERSCAN_MARGIN);
    const overscan = cullAabb;

    const payload = buildSamplePayload(cullAabb);
    const lease = getBakeLease();

    if (lease) {
      bakeSeq += 1;
      const seq = bakeSeq;
      inFlightSeq = seq;
      inFlightOverscan = overscan;
      inFlightCullAabb = cullAabb;
      inFlightGraphRef = graphData;
      // Snapshot dirty into this request; further full dirty while in-flight
      // is tracked by dirtyWhileInFlight / markAllEdgesDirty.
      dirtyEdgeIds = null;
      dirtyWhileInFlight = false;

      const req: BakeWorkerRequest = {
        type: "bake",
        seq,
        clientId: lease.clientId,
        mode: "full",
        payload,
      };
      lease.postBake(req);
      return;
    }

    // ---- Sync fallback (no Worker) ----
    const result = sampleGraphEdgeDots(payload);
    applyBakeResult(result.dots, result.edgeRanges, cullAabb, overscan);
    bakedOverscan = overscan;
    hasBaked = true;
    dirtyEdgeIds = null;
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
    }

    const underlayAabb = worldViewportAabb(camera, OVERSCAN_MARGIN);

    edgeUnderlay.clear();
    lastUnderlayZoom = z;
    lastUnderlayVpW = vpW;
    lastUnderlayVpH = vpH;
    lastUnderlayGraphRef = graphData;
    lastUnderlayOverscan = underlayAabb;
    lastUnderlayEmpty = true;

    const nodesById = nodesByIdCache;
    const g = edgeUnderlay;

    // Overscan residency: O(candidates) via spatial index + O(1) edge id map.
    let edgeList: GraphEdge[];
    ensureSpatialIndexReady();
    const candidateIds = spatialIndex.queryEdgeIds(underlayAabb);
    if (candidateIds.length === 0) {
      edgeList = [];
    } else if (candidateIds.length >= graphData.edges.length) {
      edgeList = graphData.edges;
    } else {
      edgeList = [];
      for (const id of candidateIds) {
        const e = edgesByIdCache.get(id);
        if (e) edgeList.push(e);
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
      // Full residency change may reveal new nodes in cull.
      nodesDirty = true;
      requestBake();
    }

    // Nodes are independent of DotStream bake — paint even while worker is in-flight
    // so a failed worker never leaves underlay-only (wireframe) UI.
    if (nodesDirty) {
      uploadNodesIfDirty(worldViewportAabb(camera, OVERSCAN_MARGIN));
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
      dirtyEdgeIds = "all";
      dirtyWhileInFlight = false;
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

    /**
     * Full graph install. Callers must supply GraphData with incidence already
     * consistent with edges (product: placeTopology; fixtures: mock recompute).
     * Renderer does not re-derive childIds/parentIds/relateIds.
     */
    setGraphData(nextGraphData: GraphData): void {
      graphData = nextGraphData;
      nodesByIdCache = new Map(nextGraphData.nodes.map((n) => [n.id, n]));
      edgesByIdCache = new Map(nextGraphData.edges.map((e) => [e.id, e]));
      topologyDirty = true;

      // Full invalidate: drop in-flight bake, clear residents, full dirty.
      if (inFlightSeq !== 0) {
        bakeSeq += 1;
        inFlightSeq = 0;
        inFlightOverscan = null;
        inFlightCullAabb = null;
        inFlightGraphRef = null;
      }
      dirtyEdgeIds = "all";
      dirtyWhileInFlight = false;
      residentEdges.clear();
      mergedDotBuffer = null;
      mergedDotCount = 0;
      mergedEdgeLayout.clear();
      mergedEdgeOrder = [];
      nodesDirty = true;
    },

    setCamera(nextCamera: RtcCamera): void {
      camera = nextCamera;
    },

    render(): void {
      if (!isMounted || isDestroyed) return;
      drawFrame();
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
  };
}
