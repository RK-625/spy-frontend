/**
 * GPU-batched vector circle meshes for DotStream edges.
 *
 * Phase 2b (quality-first):
 * - True geometric circles as triangle-list meshes (not bitmap particles).
 * - Adaptive segment count so dots stay smooth when deeply zoomed.
 * - Group by (color, quantized alpha) → one Mesh per group → few GPU draws.
 * - Grow/reuse position/uv/index capacity; pool Mesh instances across frames.
 *
 * Quality-gated P0 (agent consensus — DeepSeek V4 Pro / MiMo V2.5 Pro / MiniMax M3):
 * - In-place GroupBuffers: begin() resets counters only; never discard TypedArray
 *   capacity via groups.clear() each frame. Durable map reuses Float32/Uint32.
 * - flush pools Mesh + assigns geometry subarray views (capacity kept).
 *
 * B — SDF quad discs (this file):
 * - Each dot = axis-aligned quad (4 verts, 6 indices) with UVs (0,0)-(1,1).
 * - Custom Shader + GlProgram draws filled circles via fragment SDF on quad:
 *     d = length(vUv - 0.5) * 2.0; if (d > 1.0) discard; fwidth AA.
 * - Color from mesh.tint / mesh.alpha (uColor × uWorldColorAlpha → vColor).
 * - Fallback: if Shader/GlProgram construction throws at module init or first
 *   Mesh create, set useSdf=false and fall back to triangle fan (MIN_SEGMENTS=32).
 * - circleSegmentCount kept only for fallback path.
 *
 * Red lines (do NOT reintroduce):
 * - No soft/nearest particle sprites for edges
 * - No half-res / setInteractionQuality downscale
 * - No LOD thinning (lodMul / skipOuterLats)
 * - No DotStream density LOD thinning
 * - Same DotStream samples (drawEdgeDots / sampleDivergingStream unchanged math)
 * Do not thin via LOD or soft nearest sprites — batching + pan-cache handle perf.
 */

import {
  GlProgram,
  Mesh,
  MeshGeometry,
  Shader,
  Texture,
  type TextureShader,
} from "pixi.js";

// -----------------------------------------------------------------------
// Custom SDF disc shader — GLSL (WebGL 1 compatible, ES 1.00)
// -----------------------------------------------------------------------
// Declares ALL uniforms from the MeshPipe global (group 100) + local
// (group 101) BindGroups so the GL uniform resolver finds them by name.
// -----------------------------------------------------------------------

const SDF_VERTEX = `
    attribute vec2 aPosition;
    attribute vec2 aUV;
    varying vec4 vColor;
    varying vec2 vUV;

    uniform mat3 uProjectionMatrix;
    uniform mat3 uWorldTransformMatrix;
    uniform vec4 uWorldColorAlpha;
    uniform vec2 uResolution;
    uniform mat3 uTransformMatrix;
    uniform vec4 uColor;
    uniform float uRound;

    vec2 roundPixels(vec2 position, vec2 targetSize) {
        return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;
    }

    void main() {
        vUV = aUV;
        vColor = uColor * uWorldColorAlpha;

        mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
        gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);

        if (uRound == 1.0) {
            gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
        }
    }
`;

/**
 * Fragment disc — WebGL1-safe (no fwidth).
 *
 * fwidth() needs GL_OES_standard_derivatives / WebGL2; Pixi runs this as
 * GLSL ES 1.00 without that extension → compile fail + fan fallback spam.
 * Tight UV-space smoothstep (~4% of radius) keeps edges sharp without
 * looking like soft bitmap spray.
 */
const SDF_FRAGMENT = `
    varying vec4 vColor;
    varying vec2 vUV;

    void main() {
        float d = length(vUV - 0.5) * 2.0;
        // Fixed tight AA band in UV-distance units (not soft spray).
        float a = 1.0 - smoothstep(0.96, 1.0, d);
        if (a < 0.004) discard;
        gl_FragColor = vec4(vColor.rgb, vColor.a * a);
    }
`;

/** Singleton SDF shader, null if construction failed (fallback to fan). */
let sdfShader: Shader | null = null;
/** Whether module-level (or first-use) SDF init has been attempted. */
let sdfInitAttempted = false;
/** Permanent kill switch after runtime compile/link failure. */
let sdfPermanentlyDisabled = false;

/**
 * Build the SDF disc Shader once. Safe to call repeatedly.
 * Returns null and leaves useSdf callers on fan path if construction throws
 * or if runtime disable was requested.
 */
function ensureSdfShader(): Shader | null {
  if (sdfPermanentlyDisabled) return null;
  if (sdfInitAttempted) return sdfShader;
  sdfInitAttempted = true;
  try {
    const sdfProgram = new GlProgram({
      vertex: SDF_VERTEX,
      fragment: SDF_FRAGMENT,
      name: "sdf-disc",
    });
    sdfShader = new Shader({ glProgram: sdfProgram });
  } catch (err) {
    sdfShader = null;
    sdfPermanentlyDisabled = true;
    console.warn(
      "[graph] SDF disc shader init failed, falling back to triangle fan",
      err
    );
  }
  return sdfShader;
}

/** Soft alpha quantize steps — keeps group count low without visible banding. */
const ALPHA_QUANT_STEPS = 12;

/**
 * Minimum rim segments — raised to 32 for A′ world-bake quality.
 * World dots scale up under zoom-in; 32 ensures they stay smooth at
 * deep zoom without faceting. Max 64 unchanged.
 * Used only in fallback fan path.
 */
const MIN_SEGMENTS = 32;

/** Maximum rim segments (large / deeply zoomed dots stay smooth). */
const MAX_SEGMENTS = 64;

/** SDF quad: 4 verts per dot */
const QUAD_VERTS = 4;

/** SDF quad: 6 indices per dot (2 triangles) */
const QUAD_INDICES = 6;

type GroupKey = string;

type GroupBuffers = {
  color: number;
  alpha: number;
  /** Growing capacity: x,y pairs — retained across frames */
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

/** Mesh may use custom SDF Shader or default TextureShader — both are Mesh. */
type PooledMesh = {
  mesh: Mesh<MeshGeometry, Shader | TextureShader>;
  geometry: MeshGeometry;
};

function groupKey(color: number, qAlpha: number): GroupKey {
  return `${color}_${Math.round(qAlpha * ALPHA_QUANT_STEPS)}`;
}

function quantizeAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) return 1;
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  return Math.round(a * ALPHA_QUANT_STEPS) / ALPHA_QUANT_STEPS;
}

/**
 * Adaptive segment count for quality:
 * segments = clamp(ceil(r * π), MIN_SEGMENTS, MAX_SEGMENTS)
 * Used only in fallback fan path.
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
 * Uses SDF disc shader (quad per dot) or falls back to triangle fan.
 */
export class DotCircleBatch {
  /** Durable group buffers — TypedArray capacity survives across frames. */
  private groups = new Map<GroupKey, GroupBuffers>();
  private meshPool = new Map<GroupKey, PooledMesh>();
  /**
   * true when SDF shader is available. Mutable: first Mesh create failure
   * flips to false so subsequent adds use fan geometry.
   */
  private useSdf: boolean = ensureSdfShader() !== null;

  /**
   * Start a new emit pass. Resets use counters only — does NOT discard
   * TypedArray capacity (quality-gated P0: zero quality risk, less GC).
   */
  begin(): void {
    for (const g of this.groups.values()) {
      g.posFloats = 0;
      g.idxCount = 0;
      g.vertCount = 0;
    }
  }

  /**
   * Append a filled circle.
   *
   * Primary path (SDF): axis-aligned quad (4 verts, 6 indices) with UVs for
   * fragment SDF rendering. Fallback path (fan): triangle fan (N+1 verts).
   *
   * Geometry is screen-space; regenerate each full redraw.
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

    if (this.useSdf) {
      // ---------------------------------------------------------------
      // SDF quad path: 4 verts, 6 indices per dot
      // ---------------------------------------------------------------
      const floatsToAdd = QUAD_VERTS * 2;
      const indicesToAdd = QUAD_INDICES;
      const nextPos = g.posFloats + floatsToAdd;
      const nextIdx = g.idxCount + indicesToAdd;
      g.positions = growFloat32(g.positions, nextPos);
      g.uvs = growFloat32(g.uvs, nextPos);
      g.indices = growUint32(g.indices, nextIdx);

      const baseVert = g.vertCount;
      let pi = g.posFloats;

      // Four corners of axis-aligned quad (cx±r, cy±r)
      const x0 = cx - r;
      const x1 = cx + r;
      const y0 = cy - r;
      const y1 = cy + r;

      // Bottom-left
      g.positions[pi] = x0;
      g.positions[pi + 1] = y0;
      g.uvs[pi] = 0;
      g.uvs[pi + 1] = 0;
      pi += 2;

      // Bottom-right
      g.positions[pi] = x1;
      g.positions[pi + 1] = y0;
      g.uvs[pi] = 1;
      g.uvs[pi + 1] = 0;
      pi += 2;

      // Top-right
      g.positions[pi] = x1;
      g.positions[pi + 1] = y1;
      g.uvs[pi] = 1;
      g.uvs[pi + 1] = 1;
      pi += 2;

      // Top-left
      g.positions[pi] = x0;
      g.positions[pi + 1] = y1;
      g.uvs[pi] = 0;
      g.uvs[pi + 1] = 1;
      pi += 2;

      // Two triangles: (0,1,2) and (0,2,3)
      let ii = g.idxCount;
      g.indices[ii] = baseVert;
      g.indices[ii + 1] = baseVert + 1;
      g.indices[ii + 2] = baseVert + 2;
      g.indices[ii + 3] = baseVert;
      g.indices[ii + 4] = baseVert + 2;
      g.indices[ii + 5] = baseVert + 3;

      g.posFloats = pi;
      g.idxCount = ii + QUAD_INDICES;
      g.vertCount = baseVert + QUAD_VERTS;
    } else {
      // ---------------------------------------------------------------
      // Fallback fan path (MIN_SEGMENTS=32)
      // ---------------------------------------------------------------
      const n = circleSegmentCount(r);
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
  }

  /**
   * Permanently disable SDF path after init/first-use failure.
   * Clears the mesh pool so the next flush rebuilds with Texture.WHITE.
   * (Geometry already emitted this frame may still be quads; next begin uses fans.)
   */
  private disableSdf(reason: string | null): void {
    this.useSdf = false;
    sdfShader = null;
    sdfPermanentlyDisabled = true;
    if (reason) console.warn(reason);
    for (const { mesh, geometry } of this.meshPool.values()) {
      if (!mesh.destroyed) {
        mesh.parent?.removeChild(mesh);
        mesh.destroy({ children: true });
      }
      geometry.destroy();
    }
    this.meshPool.clear();
    // Drop any partial SDF quad emit so the next begin()/add uses fans only.
    for (const g of this.groups.values()) {
      g.posFloats = 0;
      g.idxCount = 0;
      g.vertCount = 0;
    }
  }

  /**
   * Create a pooled Mesh for a group. On SDF Mesh construction failure,
   * permanently disable SDF and use Texture.WHITE fan-compatible path.
   * (Geometry already emitted this frame may be quads — next begin() uses fans.)
   */
  private createPooledMesh(
    parent: import("pixi.js").Container,
    geometry: MeshGeometry,
    color: number,
    alpha: number
  ): PooledMesh {
    if (this.useSdf) {
      const shader = ensureSdfShader();
      if (shader) {
        try {
          const mesh = new Mesh({
            geometry,
            shader,
          });
          mesh.tint = color;
          mesh.alpha = alpha;
          mesh.visible = true;
          parent.addChild(mesh);
          return { mesh, geometry };
        } catch {
          this.disableSdf(
            "[graph] SDF disc mesh create failed, falling back to triangle fan"
          );
        }
      } else {
        this.disableSdf(null);
      }
    }

    const mesh = new Mesh({
      geometry,
      texture: Texture.WHITE,
    });
    mesh.tint = color;
    mesh.alpha = alpha;
    mesh.visible = true;
    parent.addChild(mesh);
    return { mesh, geometry };
  }

  /**
   * Upload each non-empty group into a pooled Mesh and attach under parent.
   * Unused pooled meshes are hidden (not destroyed) for reuse next frame.
   * GroupBuffers stay in the durable map (capacity retained for next begin).
   */
  flush(parent: import("pixi.js").Container): void {
    const usedKeys = new Set<GroupKey>();

    for (const [key, g] of this.groups) {
      if (g.idxCount === 0 || g.posFloats === 0) continue;
      usedKeys.add(key);

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
        pooled = this.createPooledMesh(parent, geometry, g.color, g.alpha);
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

    for (const [k, pooled] of this.meshPool) {
      if (!usedKeys.has(k)) {
        pooled.mesh.visible = false;
      }
    }
    // Intentionally no groups.clear() — TypedArray capacity is durable.
    // Empty groups (posFloats=0 after begin) are skipped above; keys stay for reuse.
  }

  /** Destroy pooled meshes/geometry. Safe if parent already tore down. */
  destroy(): void {
    for (const { mesh, geometry } of this.meshPool.values()) {
      if (!mesh.destroyed) {
        mesh.parent?.removeChild(mesh);
        mesh.destroy({ children: true });
      }
      geometry.destroy();
    }
    this.meshPool.clear();
    this.groups.clear();
  }
}
