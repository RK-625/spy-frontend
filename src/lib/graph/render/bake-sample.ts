/**
 * Core DotStream sampling math for world-space bake (sync + worker shared).
 *
 * Runs on main thread (sync fallback / payload construction) and inside
 * `bake-worker.ts` (Web Worker).
 *
 * NO DOM, Pixi, canvas, or WebGL dependencies in this file.
 */

import { drawEdgeDots, type RimSlot } from "./draw-arrow";
import {
  projectLateralU,
  projectTravelT,
  pulseEndpointRadii,
  pulseEndpoints,
} from "./edge-signal-pulse";
import { edgeBandWidth, nodeScreenRadius } from "../core/graph-scale";

export const FLOATS_PER_DOT = 7;
export const FLOATS_PER_NODE = 3;

export const EDGE_TYPE_PART_OF = 1;
export const EDGE_TYPE_RELATES = 2;

export type BakeEdgeDotRange = {
  edgeId: string;
  startDot: number;
  dotCount: number;
};

export type BakeColorsPayload = {
  partOfColor: number;
  partOfAlpha: number;
  relatesColor: number;
  relatesAlpha: number;
};

export type BakeWorldAabbPayload = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type BakeSamplePayload = BakeColorsPayload & {
  nodeIds: string[];
  /** Packed Float32Array: [x, y, rank] * nodeIds.length */
  nodeXYR: Float32Array;
  edgeIds: string[];
  /** Packed Uint32Array: [sourceIndex, targetIndex] * edgeIds.length */
  edgeEndpoints: Uint32Array;
  /** Packed Uint8Array: [1=PART_OF, 2=RELATES] * edgeIds.length */
  edgeTypes: Uint8Array;
  rimNodeIds: string[];
  rimEdgeIds: string[];
  /** Packed Float32Array: [midAngle, halfSpan] * rimNodeIds.length */
  rimAngles: Float32Array;
  /** Null when baking full graph without spatial cull */
  cullAabb: BakeWorldAabbPayload | null;
};

export type BakeSampleResult = {
  /** Packed Float32Array: [cx, cy, r, color, alpha, t, u] * dotCount */
  dots: Float32Array<ArrayBufferLike>;
  dotCount: number;
  edgeRanges: BakeEdgeDotRange[];
  /** True when sample was canceled mid-stream by shouldAbort. */
  aborted?: boolean;
};

export function emptyBakePayload(
  colors: BakeColorsPayload,
  cullAabb: BakeWorldAabbPayload | null
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
 * Extract transferables from a payload for worker postMessage.
 */
export function bakePayloadTransferList(
  payload: BakeSamplePayload
): Transferable[] {
  const transfers: Transferable[] = [
    payload.nodeXYR.buffer,
    payload.edgeEndpoints.buffer,
    payload.edgeTypes.buffer,
    payload.rimAngles.buffer,
  ];
  return transfers.filter((b) => b && (b as ArrayBuffer).byteLength > 0);
}

function growDotsBuffer(
  buf: Float32Array<ArrayBufferLike>,
  neededFloats: number
): Float32Array<ArrayBufferLike> {
  if (buf.length >= neededFloats) return buf;
  let cap = Math.max(buf.length * 2, 4096);
  while (cap < neededFloats) cap *= 2;
  const next = new Float32Array(cap);
  next.set(buf);
  return next;
}

/**
 * Pure DotStream edge sampling loop over `payload`.
 * Callable on main thread or inside a Worker.
 *
 * @param shouldAbort Optional callback checked after sampling each edge.
 *                    When it returns true, sampling halts immediately and
 *                    returns `{ dots: empty, dotCount: 0, edgeRanges: [], aborted: true }`.
 */
export function sampleGraphEdgeDotsCooperative(
  payload: BakeSamplePayload,
  shouldAbort?: () => boolean
): BakeSampleResult {
  const {
    nodeIds,
    nodeXYR,
    edgeIds,
    edgeEndpoints,
    edgeTypes,
    rimNodeIds,
    rimEdgeIds,
    rimAngles,
    partOfColor,
    partOfAlpha,
    relatesColor,
    relatesAlpha,
  } = payload;

  const nodeCount = nodeIds.length;
  const edgeCount = edgeIds.length;

  if (edgeCount === 0 || nodeCount === 0) {
    return {
      dots: new Float32Array(0),
      dotCount: 0,
      edgeRanges: [],
    };
  }

  // Build RimSlot lookup: Map<nodeIndex, Map<edgeId, RimSlot>>
  const rimByNodeIndex = new Map<number, Map<string, RimSlot>>();
  const nodeIndexById = new Map<string, number>();
  for (let i = 0; i < nodeCount; i++) {
    nodeIndexById.set(nodeIds[i], i);
  }

  for (let i = 0; i < rimNodeIds.length; i++) {
    const ni = nodeIndexById.get(rimNodeIds[i]);
    if (ni === undefined) continue;
    let slotMap = rimByNodeIndex.get(ni);
    if (!slotMap) {
      slotMap = new Map();
      rimByNodeIndex.set(ni, slotMap);
    }
    slotMap.set(rimEdgeIds[i], {
      midAngle: rimAngles[i * 2],
      halfSpan: rimAngles[i * 2 + 1],
    });
  }

  let dotsBuf: Float32Array<ArrayBufferLike> = new Float32Array(
    edgeCount * 128 * FLOATS_PER_DOT
  );
  let totalDots = 0;
  const edgeRanges: BakeEdgeDotRange[] = new Array(edgeCount);

  for (let eIdx = 0; eIdx < edgeCount; eIdx++) {
    // Cooperative yield check: abort immediately if superseding request arrived
    if (shouldAbort && shouldAbort()) {
      return {
        dots: new Float32Array(0),
        dotCount: 0,
        edgeRanges: [],
        aborted: true,
      };
    }

    const edgeId = edgeIds[eIdx];
    const srcIdx = edgeEndpoints[eIdx * 2];
    const tgtIdx = edgeEndpoints[eIdx * 2 + 1];

    if (srcIdx >= nodeCount || tgtIdx >= nodeCount) {
      edgeRanges[eIdx] = { edgeId, startDot: totalDots, dotCount: 0 };
      continue;
    }

    const srcO = srcIdx * FLOATS_PER_NODE;
    const srcX = nodeXYR[srcO];
    const srcY = nodeXYR[srcO + 1];
    const srcRank = nodeXYR[srcO + 2];

    const tgtO = tgtIdx * FLOATS_PER_NODE;
    const tgtX = nodeXYR[tgtO];
    const tgtY = nodeXYR[tgtO + 1];
    const tgtRank = nodeXYR[tgtO + 2];

    const isPartOf = edgeTypes[eIdx] === EDGE_TYPE_PART_OF;
    const color = isPartOf ? partOfColor : relatesColor;
    const alpha = isPartOf ? partOfAlpha : relatesAlpha;
    const density = isPartOf ? "firm" : "soft";
    const kind = isPartOf ? "part_of" : "relates";

    // Compute band at reference zoom 1 (world space)
    const band = edgeBandWidth(1, kind, srcRank, tgtRank);

    const srcRadius = nodeScreenRadius(srcRank, 1);
    const tgtRadius = nodeScreenRadius(tgtRank, 1);

    const srcRim = rimByNodeIndex.get(srcIdx)?.get(edgeId);
    const tgtRim = rimByNodeIndex.get(tgtIdx)?.get(edgeId);

    const dummyEdge = { type: isPartOf ? "PART_OF" : "RELATES" } as const;
    const dummySrc = { rank: srcRank } as const;
    const dummyTgt = { rank: tgtRank } as const;

    const endpoints = pulseEndpoints(
      dummyEdge as never,
      { x: srcX, y: srcY } as never,
      { x: tgtX, y: tgtY } as never
    );
    const radii = pulseEndpointRadii(
      dummyEdge as never,
      dummySrc as never,
      dummyTgt as never
    );

    const startDotForEdge = totalDots;

    drawEdgeDots(
      (cx, cy, r, cVal, aVal) => {
        const needFloats = (totalDots + 1) * FLOATS_PER_DOT;
        dotsBuf = growDotsBuffer(dotsBuf, needFloats);

        const t = projectTravelT(
          cx,
          cy,
          endpoints.fromX,
          endpoints.fromY,
          endpoints.toX,
          endpoints.toY
        );
        const u = projectLateralU(
          cx,
          cy,
          endpoints.fromX,
          endpoints.fromY,
          endpoints.toX,
          endpoints.toY,
          band * 0.5
        );

        const o = totalDots * FLOATS_PER_DOT;
        dotsBuf[o] = cx;
        dotsBuf[o + 1] = cy;
        dotsBuf[o + 2] = r;
        dotsBuf[o + 3] = cVal;
        dotsBuf[o + 4] = aVal;
        dotsBuf[o + 5] = t;
        dotsBuf[o + 6] = u;
        totalDots++;
      },
      { x: srcX, y: srcY },
      { x: tgtX, y: tgtY },
      {
        color,
        alpha,
        density,
        band,
        fromCenter: { x: srcX, y: srcY },
        fromRadius: srcRadius,
        toCenter: { x: tgtX, y: tgtY },
        toRadius: tgtRadius,
        sourceRim: srcRim,
        targetRim: tgtRim,
      }
    );

    const edgeDotCount = totalDots - startDotForEdge;
    edgeRanges[eIdx] = {
      edgeId,
      startDot: startDotForEdge,
      dotCount: edgeDotCount,
    };
  }

  const outDots = dotsBuf.slice(0, totalDots * FLOATS_PER_DOT);

  return {
    dots: outDots,
    dotCount: totalDots,
    edgeRanges,
  };
}

/**
 * Synchronous wrapper around sampleGraphEdgeDotsCooperative.
 */
export function sampleGraphEdgeDots(
  payload: BakeSamplePayload
): BakeSampleResult {
  return sampleGraphEdgeDotsCooperative(payload);
}

/**
 * Pack edge ranges into a Uint32Array for worker transfer.
 * Layout: [rangeCount, stringTableLength, ...packedRanges, ...stringTableCharCodes]
 */
export function packEdgeRanges(ranges: BakeEdgeDotRange[]): Uint32Array {
  const n = ranges.length;
  // Build string table
  let stringTable = "";
  const stringOffsets: number[] = new Array(n);
  const stringLengths: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    stringOffsets[i] = stringTable.length;
    const id = ranges[i].edgeId;
    stringLengths[i] = id.length;
    stringTable += id;
  }

  const strLen = stringTable.length;
  // Layout: header (2) + per-range (4: strOffset, strLen, startDot, dotCount) + strChars (strLen)
  const totalUint32s = 2 + n * 4 + strLen;
  const out = new Uint32Array(totalUint32s);

  out[0] = n;
  out[1] = strLen;

  let cursor = 2;
  for (let i = 0; i < n; i++) {
    out[cursor++] = stringOffsets[i];
    out[cursor++] = stringLengths[i];
    out[cursor++] = ranges[i].startDot;
    out[cursor++] = ranges[i].dotCount;
  }

  for (let i = 0; i < strLen; i++) {
    out[cursor++] = stringTable.charCodeAt(i);
  }

  return out;
}

/**
 * Unpack edge ranges from packed Uint32Array.
 */
export function unpackEdgeRanges(packed: Uint32Array): BakeEdgeDotRange[] {
  if (packed.length < 2) return [];
  const n = packed[0];
  const strLen = packed[1];
  const expectedMin = 2 + n * 4 + strLen;
  if (packed.length < expectedMin) return [];

  const strCharBase = 2 + n * 4;
  const chars: string[] = new Array(strLen);
  for (let i = 0; i < strLen; i++) {
    chars[i] = String.fromCharCode(packed[strCharBase + i]);
  }
  const fullStr = chars.join("");

  const out: BakeEdgeDotRange[] = new Array(n);
  let cursor = 2;
  for (let i = 0; i < n; i++) {
    const strOff = packed[cursor++];
    const strL = packed[cursor++];
    const startDot = packed[cursor++];
    const dotCount = packed[cursor++];
    const edgeId = fullStr.substring(strOff, strOff + strL);
    out[i] = { edgeId, startDot, dotCount };
  }

  return out;
}
