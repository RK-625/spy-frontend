/**
 * Pure DotStream edge sampling for world-space bake (main thread + worker).
 *
 * Appearance-neutral: identical math to the former inline bakeGraphGeometry
 * edge loop (insetSegment + drawEdgeDots). No Pixi, no DOM, no mutation of
 * graph objects beyond reading the serializable payload.
 *
 * Used by:
 * - bake-worker.ts (off main thread)
 * - pixi-renderer sync fallback when Worker is unavailable
 *
 * Wave-2 packing: BakeSamplePayload uses parallel typed arrays for numeric
 * fields so the worker postMessage can transfer ArrayBuffers instead of
 * structured-cloning deep object trees. String ids stay as arrays (unavoidable).
 */

import {
  drawEdgeDots,
  insetSegment,
  type DotEmit,
  type RimSlot,
} from "@/lib/graph/draw-arrow";
import {
  projectLateralU,
  projectTravelT,
} from "@/lib/graph/edge-signal-pulse";
import {
  EDGE_DOT_FLARE_GAIN,
  edgeBandWidth,
  nodeScreenRadius,
} from "@/lib/graph/graph-scale";

/**
 * Packed floats per emitted dot:
 *   [cx, cy, r, color, alpha, t, u]
 * `t` ∈ [0,1] along travel direction (PART_OF parent→child / RELATES source→target)
 * `u` ∈ [-1,1] lateral offset across the stream (0 = centerline)
 * for flare-aware classic-arrow signal shading without free-flying discs.
 */
export const FLOATS_PER_DOT = 7;

/** Floats per node in nodeXYR: x, y, rank. */
export const FLOATS_PER_NODE = 3;

/** Floats per rim slot in rimAngles: midAngle, halfSpan. */
export const FLOATS_PER_RIM = 2;

/** edgeTypes codes (must match pack/unpack). */
export const EDGE_TYPE_PART_OF = 0;
export const EDGE_TYPE_RELATES = 1;

export type BakeCullAabb = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null;

/**
 * Packed bake input. Numeric fields live in transferable typed arrays;
 * string ids remain parallel string arrays (structured-cloned once).
 *
 * Product path: main thread pre-filters edges via GraphSpatialIndex candidates
 * and packs only those. Worker samples only payload edges.
 * `cullAabb: null` is debug bake-all only (FORCE_BAKE_ALL).
 */
export type BakeSamplePayload = {
  /** Parallel to nodeXYR (length = nodeCount). */
  nodeIds: string[];
  /** Packed [x, y, rank] * nodeCount — transferable. */
  nodeXYR: Float32Array;
  /** Parallel to edgeEndpoints / edgeTypes (length = edgeCount). */
  edgeIds: string[];
  /**
   * Packed [srcNodeIdx, tgtNodeIdx] * edgeCount — indices into nodeIds.
   * Transferable Uint32Array.
   */
  edgeEndpoints: Uint32Array;
  /** 0 = PART_OF, 1 = RELATES_TO — transferable. */
  edgeTypes: Uint8Array;
  /** Parallel to rimAngles (length = rimCount). */
  rimNodeIds: string[];
  rimEdgeIds: string[];
  /** Packed [midAngle, halfSpan] * rimCount — transferable. */
  rimAngles: Float32Array;
  /**
   * Exact segment AABB cull after broad-phase. null → no spatial cull
   * (debug bake-all only). Product always passes a finite overscan AABB.
   */
  cullAabb: BakeCullAabb;
  partOfColor: number;
  partOfAlpha: number;
  relatesColor: number;
  relatesAlpha: number;
};

/** Contiguous range of dots for one edge (object form — sync / local merge). */
export type BakeEdgeDotRange = {
  edgeId: string;
  /** Index of first dot (not float) for this edge. */
  startDot: number;
  /** Number of dots for this edge (0 if culled / no segment). */
  dotCount: number;
};

/**
 * Packed edge ranges for worker response transfer.
 * Parallel arrays; startDots/dotCounts are transferable.
 */
export type BakeEdgeRangesPacked = {
  edgeIds: string[];
  startDots: Uint32Array;
  dotCounts: Uint32Array;
};

export type BakeSampleResult = {
  /**
   * Packed [cx, cy, r, color, alpha, t, u] * dotCount.
   * Exact-length buffer (dotCount * FLOATS_PER_DOT) for zero-copy transfer.
   */
  dots: Float32Array;
  dotCount: number;
  /**
   * Per-edge ranges in emission order (payload edge order, skipping missing
   * endpoints). Enables partial mesh merge without re-sampling clean edges.
   */
  edgeRanges: BakeEdgeDotRange[];
  /** Packed form of edgeRanges (same data) for worker postMessage transfer. */
  edgeRangesPacked: BakeEdgeRangesPacked;
  /** True when sampling stopped early via shouldAbort — do not apply. */
  aborted?: boolean;
};

function aabbIntersects(
  a: NonNullable<BakeCullAabb>,
  b: NonNullable<BakeCullAabb>
): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

function segmentAabb(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pad: number
): NonNullable<BakeCullAabb> {
  const p = pad > 0 ? pad : 0;
  return {
    minX: Math.min(x0, x1) - p,
    maxX: Math.max(x0, x1) + p,
    minY: Math.min(y0, y1) - p,
    maxY: Math.max(y0, y1) + p,
  };
}

/** Empty packed payload (no edges/nodes). */
export function emptyBakePayload(
  colors: Pick<
    BakeSamplePayload,
    | "partOfColor"
    | "partOfAlpha"
    | "relatesColor"
    | "relatesAlpha"
  >,
  cullAabb: BakeCullAabb = null
): BakeSamplePayload {
  return {
    nodeIds: [],
    nodeXYR: new Float32Array(0),
    edgeIds: [],
    edgeEndpoints: new Uint32Array(0),
    edgeTypes: new Uint8Array(0),
    rimNodeIds: [],
    rimEdgeIds: [],
    rimAngles: new Float32Array(0),
    cullAabb,
    ...colors,
  };
}

/**
 * ArrayBuffers to transfer with a bake request (payload ownership moves).
 * Call only once per postMessage; main must not reuse the payload arrays.
 */
export function bakePayloadTransferList(
  payload: BakeSamplePayload
): Transferable[] {
  const list: Transferable[] = [];
  // Only transfer ArrayBuffer views we own (skip empty / SharedArrayBuffer).
  const pushBuf = (buf: ArrayBufferLike): void => {
    if (buf instanceof ArrayBuffer && buf.byteLength > 0) {
      list.push(buf);
    }
  };
  pushBuf(payload.nodeXYR.buffer);
  pushBuf(payload.edgeEndpoints.buffer);
  pushBuf(payload.edgeTypes.buffer);
  pushBuf(payload.rimAngles.buffer);
  return list;
}

/** Unpack edgeRangesPacked → object ranges (main-thread merge). */
export function unpackEdgeRanges(
  packed: BakeEdgeRangesPacked
): BakeEdgeDotRange[] {
  const n = packed.edgeIds.length;
  const out: BakeEdgeDotRange[] = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = {
      edgeId: packed.edgeIds[i],
      startDot: packed.startDots[i],
      dotCount: packed.dotCounts[i],
    };
  }
  return out;
}

/** Optional cooperative cancel for worker latest-only bake. */
export type SampleGraphEdgeDotsOptions = {
  /**
   * Called between edges. When true, sampling aborts early and returns
   * `{ aborted: true, dots: empty, … }` so the worker can drop the job.
   */
  shouldAbort?: () => boolean;
};

function emptyAbortResult(): BakeSampleResult {
  return {
    dots: new Float32Array(0),
    dotCount: 0,
    edgeRanges: [],
    edgeRangesPacked: {
      edgeIds: [],
      startDots: new Uint32Array(0),
      dotCounts: new Uint32Array(0),
    },
    aborted: true,
  };
}

function finalizeSampleResult(
  dots: Float32Array,
  dotCount: number,
  edgeRanges: BakeEdgeDotRange[]
): BakeSampleResult {
  const usedFloats = dotCount * FLOATS_PER_DOT;
  const exactDots =
    usedFloats === 0
      ? new Float32Array(0)
      : usedFloats === dots.length
        ? dots
        : dots.slice(0, usedFloats);

  const nRanges = edgeRanges.length;
  const startDots = new Uint32Array(nRanges);
  const rangeDotCounts = new Uint32Array(nRanges);
  const rangeEdgeIds = new Array<string>(nRanges);
  for (let i = 0; i < nRanges; i++) {
    const r = edgeRanges[i];
    rangeEdgeIds[i] = r.edgeId;
    startDots[i] = r.startDot;
    rangeDotCounts[i] = r.dotCount;
  }

  return {
    dots: exactDots,
    dotCount,
    edgeRanges,
    edgeRangesPacked: {
      edgeIds: rangeEdgeIds,
      startDots,
      dotCounts: rangeDotCounts,
    },
  };
}

type SampleLoopState = {
  nodeIds: string[];
  nodeXYR: Float32Array;
  edgeIds: string[];
  edgeEndpoints: Uint32Array;
  edgeTypes: Uint8Array;
  cullAabb: BakeCullAabb;
  partOfColor: number;
  partOfAlpha: number;
  relatesColor: number;
  relatesAlpha: number;
  nodeCount: number;
  rimSlotsByNode: Map<string, Map<string, RimSlot>>;
  dots: Float32Array;
  dotCount: number;
  edgeRanges: BakeEdgeDotRange[];
};

function createSampleLoopState(payload: BakeSamplePayload): SampleLoopState {
  const {
    nodeIds,
    nodeXYR,
    edgeIds,
    edgeEndpoints,
    edgeTypes,
    rimNodeIds,
    rimEdgeIds,
    rimAngles,
    cullAabb,
    partOfColor,
    partOfAlpha,
    relatesColor,
    relatesAlpha,
  } = payload;

  const rimSlotsByNode = new Map<string, Map<string, RimSlot>>();
  const rimCount = rimNodeIds.length;
  for (let i = 0; i < rimCount; i++) {
    const nodeId = rimNodeIds[i];
    let m = rimSlotsByNode.get(nodeId);
    if (!m) {
      m = new Map();
      rimSlotsByNode.set(nodeId, m);
    }
    const o = i * FLOATS_PER_RIM;
    m.set(rimEdgeIds[i], {
      midAngle: rimAngles[o],
      halfSpan: rimAngles[o + 1],
    });
  }

  return {
    nodeIds,
    nodeXYR,
    edgeIds,
    edgeEndpoints,
    edgeTypes,
    cullAabb,
    partOfColor,
    partOfAlpha,
    relatesColor,
    relatesAlpha,
    nodeCount: nodeIds.length,
    rimSlotsByNode,
    dots: new Float32Array(4096 * FLOATS_PER_DOT),
    dotCount: 0,
    edgeRanges: [],
  };
}

function sampleOneEdge(state: SampleLoopState, ei: number): void {
  const {
    nodeIds,
    nodeXYR,
    edgeIds,
    edgeEndpoints,
    edgeTypes,
    cullAabb,
    partOfColor,
    partOfAlpha,
    relatesColor,
    relatesAlpha,
    nodeCount,
    rimSlotsByNode,
  } = state;

  const edgeId = edgeIds[ei];
  const srcIdx = edgeEndpoints[ei * 2];
  const tgtIdx = edgeEndpoints[ei * 2 + 1];
  if (
    srcIdx >= nodeCount ||
    tgtIdx >= nodeCount ||
    !Number.isFinite(srcIdx) ||
    !Number.isFinite(tgtIdx)
  ) {
    return;
  }

  const sx = nodeXYR[srcIdx * FLOATS_PER_NODE];
  const sy = nodeXYR[srcIdx * FLOATS_PER_NODE + 1];
  const sourceRank = nodeXYR[srcIdx * FLOATS_PER_NODE + 2] ?? 0;
  const tx = nodeXYR[tgtIdx * FLOATS_PER_NODE];
  const ty = nodeXYR[tgtIdx * FLOATS_PER_NODE + 1];
  const targetRank = nodeXYR[tgtIdx * FLOATS_PER_NODE + 2] ?? 0;
  const srcId = nodeIds[srcIdx];
  const tgtId = nodeIds[tgtIdx];

  const startDot = state.dotCount;
  const radiusSource = nodeScreenRadius(sourceRank, 1);
  const radiusTarget = nodeScreenRadius(targetRank, 1);
  const isPartOf = edgeTypes[ei] === EDGE_TYPE_PART_OF;

  /**
   * Travel axis for signal-wave `t` / lateral `u` (set once the inset segment is known).
   * PART_OF: parent (target) → child (source). RELATES: source → target.
   */
  let axisFromX = 0;
  let axisFromY = 0;
  let axisToX = 0;
  let axisToY = 0;
  /** Half stream span for u normalization (≈ band/2). */
  let lateralHalfWidth = 1;

  const emit: DotEmit = (cx, cy, r, color, alpha) => {
    const need = (state.dotCount + 1) * FLOATS_PER_DOT;
    if (need > state.dots.length) {
      let nextCap = state.dots.length * 2;
      while (nextCap < need) nextCap *= 2;
      const next = new Float32Array(nextCap);
      next.set(state.dots);
      state.dots = next;
    }
    const o = state.dotCount * FLOATS_PER_DOT;
    state.dots[o] = cx;
    state.dots[o + 1] = cy;
    state.dots[o + 2] = r;
    state.dots[o + 3] = color;
    state.dots[o + 4] = alpha;
    state.dots[o + 5] = projectTravelT(
      cx,
      cy,
      axisFromX,
      axisFromY,
      axisToX,
      axisToY
    );
    state.dots[o + 6] = projectLateralU(
      cx,
      cy,
      axisFromX,
      axisFromY,
      axisToX,
      axisToY,
      lateralHalfWidth
    );
    state.dotCount += 1;
  };

  if (isPartOf) {
    const band = edgeBandWidth(1, "part_of", sourceRank, targetRank);
    if (cullAabb) {
      const pad = Math.max(radiusSource, radiusTarget) + band;
      const edgeBox = segmentAabb(sx, sy, tx, ty, pad);
      if (!aabbIntersects(edgeBox, cullAabb)) {
        state.edgeRanges.push({ edgeId, startDot, dotCount: 0 });
        return;
      }
    }

    const segment = insetSegment(
      { x: tx, y: ty },
      { x: sx, y: sy },
      radiusTarget,
      radiusSource
    );
    if (!segment) {
      state.edgeRanges.push({ edgeId, startDot, dotCount: 0 });
      return;
    }
    axisFromX = segment.start.x;
    axisFromY = segment.start.y;
    axisToX = segment.end.x;
    axisToY = segment.end.y;
    // Normalize u by max flared half-span so outer flare columns stay in (-1,1)
    // (not clamped to ±1 at mid-band width). Flares use ~1+EDGE_DOT_FLARE_GAIN.
    lateralHalfWidth = Math.max(band * 0.5 * (1 + EDGE_DOT_FLARE_GAIN), 1e-6);
    const srcSlots = rimSlotsByNode.get(srcId);
    const tgtSlots = rimSlotsByNode.get(tgtId);
    drawEdgeDots(emit, segment.start, segment.end, {
      color: partOfColor,
      alpha: partOfAlpha,
      density: "firm",
      band,
      fromCenter: { x: tx, y: ty },
      fromRadius: radiusTarget,
      toCenter: { x: sx, y: sy },
      toRadius: radiusSource,
      sourceRim: tgtSlots?.get(edgeId),
      targetRim: srcSlots?.get(edgeId),
    });
  } else {
    const band = edgeBandWidth(1, "relates", sourceRank, targetRank);
    if (cullAabb) {
      const pad = Math.max(radiusSource, radiusTarget) + band;
      const edgeBox = segmentAabb(sx, sy, tx, ty, pad);
      if (!aabbIntersects(edgeBox, cullAabb)) {
        state.edgeRanges.push({ edgeId, startDot, dotCount: 0 });
        return;
      }
    }

    const segment = insetSegment(
      { x: sx, y: sy },
      { x: tx, y: ty },
      radiusSource,
      radiusTarget
    );
    if (!segment) {
      state.edgeRanges.push({ edgeId, startDot, dotCount: 0 });
      return;
    }
    axisFromX = segment.start.x;
    axisFromY = segment.start.y;
    axisToX = segment.end.x;
    axisToY = segment.end.y;
    lateralHalfWidth = Math.max(band * 0.5 * (1 + EDGE_DOT_FLARE_GAIN), 1e-6);
    const srcSlots = rimSlotsByNode.get(srcId);
    const tgtSlots = rimSlotsByNode.get(tgtId);
    drawEdgeDots(emit, segment.start, segment.end, {
      color: relatesColor,
      alpha: relatesAlpha,
      density: "soft",
      band,
      fromCenter: { x: sx, y: sy },
      fromRadius: radiusSource,
      toCenter: { x: tx, y: ty },
      toRadius: radiusTarget,
      sourceRim: srcSlots?.get(edgeId),
      targetRim: tgtSlots?.get(edgeId),
    });
  }

  state.edgeRanges.push({
    edgeId,
    startDot,
    dotCount: state.dotCount - startDot,
  });
}

/**
 * Sample edges in the payload into a packed Float32Array of dots.
 * Same edge loop / cull pad as pixi-renderer bake (z=1 world sizes).
 * When `payload.edgeIds` is already candidate-filtered, only those are sampled;
 * `cullAabb` still exact-filters padded segment AABBs for correctness.
 *
 * When `options.shouldAbort` returns true mid-loop, result has `aborted: true`
 * and incomplete ranges — callers must not apply those results.
 */
export function sampleGraphEdgeDots(
  payload: BakeSamplePayload,
  options?: SampleGraphEdgeDotsOptions
): BakeSampleResult {
  const shouldAbort = options?.shouldAbort;
  const state = createSampleLoopState(payload);
  const edgeCount = state.edgeIds.length;

  for (let ei = 0; ei < edgeCount; ei++) {
    if (shouldAbort && shouldAbort()) {
      return emptyAbortResult();
    }
    sampleOneEdge(state, ei);
  }

  return finalizeSampleResult(state.dots, state.dotCount, state.edgeRanges);
}

/**
 * Async cooperative sampler for workers: yields every `yieldEvery` edges so
 * onmessage can raise latestSeq and shouldAbort can cancel mid-job.
 * Appearance-identical to sampleGraphEdgeDots when not aborted.
 */
export async function sampleGraphEdgeDotsCooperative(
  payload: BakeSamplePayload,
  options: SampleGraphEdgeDotsOptions & {
    yieldEvery?: number;
    yieldFn: () => Promise<void>;
  }
): Promise<BakeSampleResult> {
  const shouldAbort = options.shouldAbort;
  const yieldEvery = Math.max(1, options.yieldEvery ?? 16);
  const state = createSampleLoopState(payload);
  const edgeCount = state.edgeIds.length;

  for (let ei = 0; ei < edgeCount; ei++) {
    if (shouldAbort && shouldAbort()) {
      return emptyAbortResult();
    }
    sampleOneEdge(state, ei);
    if ((ei + 1) % yieldEvery === 0) {
      await options.yieldFn();
      if (shouldAbort && shouldAbort()) {
        return emptyAbortResult();
      }
    }
  }

  return finalizeSampleResult(state.dots, state.dotCount, state.edgeRanges);
}
