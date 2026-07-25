/**
 * GPU-batched vector circle meshes for DotStream edges.
 *
 * Phase 2b (quality-first):
 * - True geometric circles as triangle-list meshes (not bitmap particles).
 * - Adaptive segment count so dots stay smooth when deeply zoomed.
 * - Group by (color, quantized alpha) → one Mesh per group → few GPU draws.
 * - Grow/reuse position/uv/index capacity; pool Mesh instances across frames.
 *
 * Do not thin via LOD or soft nearest sprites — batching + pan-cache handle perf.
 */

import { Container, Mesh, MeshGeometry, Texture } from "pixi.js";

/** Soft alpha quantize steps — keeps group count low without visible banding. */
const ALPHA_QUANT_STEPS = 12;

/** Minimum rim segments (small dots still look circular). */
const MIN_SEGMENTS = 16;

/** Maximum rim segments (large / deeply zoomed dots stay smooth). */
const MAX_SEGMENTS = 64;

type GroupKey = string;

type GroupBuffers = {
  color: number;
  alpha: number;
  /** Growing capacity: x,y pairs */
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  /** Used float count in positions/uvs */
  posFloats: number;
  /** Used index count */
  idxCount: number;
  /** Used vertex count (for index base offsets) */
  vertCount: number;
};

type PooledMesh = {
  mesh: Mesh;
  geometry: MeshGeometry;
};

function groupKey(color: number, qAlpha: number): GroupKey {
  // qAlpha is already stepped; encode as integer for stable keys
  return `${color}_${Math.round(qAlpha * ALPHA_QUANT_STEPS)}`;
}

function quantizeAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) return 1;
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  return Math.round(a * ALPHA_QUANT_STEPS) / ALPHA_QUANT_STEPS;
}

/**
 * Adaptive segment count for quality:
 * segments = clamp(ceil(r * π), 16, 64)
 */
export function circleSegmentCount(r: number): number {
  if (!(r > 0) || !Number.isFinite(r)) return MIN_SEGMENTS;
  return Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, Math.ceil(r * Math.PI)));
}

function growFloat32(buf: Float32Array, needed: number): Float32Array {
  if (buf.length >= needed) return buf;
  let cap = Math.max(buf.length * 2, 256);
  while (cap < needed) cap *= 2;
  const next = new Float32Array(cap);
  next.set(buf);
  return next;
}

function growUint32(buf: Uint32Array, needed: number): Uint32Array {
  if (buf.length >= needed) return buf;
  let cap = Math.max(buf.length * 2, 384);
  while (cap < needed) cap *= 2;
  const next = new Uint32Array(cap);
  next.set(buf);
  return next;
}

/**
 * Batches filled circles into few Mesh draws grouped by color + quantized alpha.
 */
export class DotCircleBatch {
  private groups = new Map<GroupKey, GroupBuffers>();
  private meshPool = new Map<GroupKey, PooledMesh>();

  /** Clear per-frame group buffers (mesh pool is retained). */
  begin(): void {
    this.groups.clear();
  }

  /**
   * Append a filled circle as a triangle fan (triangle list topology).
   * Geometry is screen-space; regenerate each full redraw for adaptive quality.
   */
  add(cx: number, cy: number, r: number, color: number, alpha: number): void {
    if (!(r > 0) || !Number.isFinite(r)) return;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
    if (!Number.isFinite(color)) return;

    const qAlpha = quantizeAlpha(alpha);
    const key = groupKey(color, qAlpha);

    let g = this.groups.get(key);
    if (!g) {
      g = {
        color,
        alpha: qAlpha,
        positions: new Float32Array(256),
        uvs: new Float32Array(256),
        indices: new Uint32Array(384),
        posFloats: 0,
        idxCount: 0,
        vertCount: 0,
      };
      this.groups.set(key, g);
    }

    const n = circleSegmentCount(r);
    // Shared center + N rim vertices; N triangles as index triples
    const vertsToAdd = n + 1;
    const floatsToAdd = vertsToAdd * 2;
    const indicesToAdd = n * 3;

    const nextPos = g.posFloats + floatsToAdd;
    const nextIdx = g.idxCount + indicesToAdd;
    g.positions = growFloat32(g.positions, nextPos);
    g.uvs = growFloat32(g.uvs, nextPos);
    g.indices = growUint32(g.indices, nextIdx);

    const baseVert = g.vertCount;
    let pi = g.posFloats;

    // Center vertex
    g.positions[pi] = cx;
    g.positions[pi + 1] = cy;
    g.uvs[pi] = 0.5;
    g.uvs[pi + 1] = 0.5;
    pi += 2;

    // Rim vertices
    const twoPi = Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * twoPi;
      g.positions[pi] = cx + Math.cos(a) * r;
      g.positions[pi + 1] = cy + Math.sin(a) * r;
      g.uvs[pi] = 0.5;
      g.uvs[pi + 1] = 0.5;
      pi += 2;
    }

    // Triangle list: center, rim(i), rim(i+1)
    let ii = g.idxCount;
    for (let i = 0; i < n; i++) {
      const rim0 = baseVert + 1 + i;
      const rim1 = baseVert + 1 + ((i + 1) % n);
      g.indices[ii++] = baseVert;
      g.indices[ii++] = rim0;
      g.indices[ii++] = rim1;
    }

    g.posFloats = pi;
    g.idxCount = ii;
    g.vertCount = baseVert + vertsToAdd;
  }

  /**
   * Upload each non-empty group into a pooled Mesh and attach under parent.
   * Unused pooled meshes are hidden (not destroyed) for reuse next frame.
   */
  flush(parent: Container): void {
    const usedKeys = new Set<GroupKey>();

    for (const [key, g] of this.groups) {
      if (g.idxCount === 0 || g.posFloats === 0) continue;
      usedKeys.add(key);

      // Exact-length views so draw count = indices.length (Pixi MeshPipe).
      const positions = g.positions.subarray(0, g.posFloats);
      const uvs = g.uvs.subarray(0, g.posFloats);
      const indices = g.indices.subarray(0, g.idxCount);

      let pooled = this.meshPool.get(key);
      if (!pooled) {
        const geometry = new MeshGeometry({
          positions,
          uvs,
          indices,
          shrinkBuffersToFit: false,
        });
        const mesh = new Mesh({
          geometry,
          texture: Texture.WHITE,
        });
        mesh.tint = g.color;
        mesh.alpha = g.alpha;
        mesh.visible = true;
        parent.addChild(mesh);
        pooled = { mesh, geometry };
        this.meshPool.set(key, pooled);
      } else {
        pooled.geometry.positions = positions;
        pooled.geometry.uvs = uvs;
        pooled.geometry.indices = indices;
        pooled.mesh.tint = g.color;
        pooled.mesh.alpha = g.alpha;
        pooled.mesh.visible = true;
        if (pooled.mesh.parent !== parent) {
          parent.addChild(pooled.mesh);
        }
      }
    }

    for (const [key, pooled] of this.meshPool) {
      if (!usedKeys.has(key)) {
        pooled.mesh.visible = false;
      }
    }

    this.groups.clear();
  }

  /** Destroy pooled meshes/geometry. Safe if parent already tore down. */
  destroy(): void {
    for (const { mesh, geometry } of this.meshPool.values()) {
      if (!mesh.destroyed) {
        mesh.parent?.removeChild(mesh);
        // Mesh.destroy nulls geometry ref but does not destroy the Geometry.
        mesh.destroy({ children: true });
      }
      geometry.destroy();
    }
    this.meshPool.clear();
    this.groups.clear();
  }
}
