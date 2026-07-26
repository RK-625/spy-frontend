/**
 * Server-side canvas placement for Memory nodes.
 * The LLM never chooses x/y or rank — this module (and toolset callers) do.
 *
 * =============================================================================
 * POLICY (system-owned layout) — locked
 * =============================================================================
 *
 * Design locks:
 *  - x, y are system-owned — never on tool input schemas; never LLM-authored.
 *  - rank is system-derived: PART_OF child = parent.rank + 1; roots / orphans = 0.
 *  - PART_OF: only the **child** repositions near parent; parent stays put.
 *  - PART_OF link: always re-place child when linking (caller uses shouldPlaceOnLink).
 *  - Content-only upsert: **do not call place** if finite x/y exist (shouldPlaceOnUpsert).
 *  - Overlap: min separation + fan (children) + spiral; never stack.
 *
 * Geometry (this file only — no graph walk, no edge delete, no Falkor I/O):
 *
 * | Case                         | Behavior                                              |
 * |------------------------------|-------------------------------------------------------|
 * | Empty graph                  | seed (0,0), rank 0                                    |
 * | Root / orphan                | cluster centroid bias + spiral                        |
 * | Child with parent            | **fan arc under parent** (±55°), then spiral; rank+1  |
 * | Related-only (no parent)     | seed near related centroid, rank 0                    |
 * | Dense / crowded              | spiral rings until free; fallback far if max rings    |
 * | excludeId                    | don’t collide with self when re-placing               |
 * | Invalid / non-finite coords  | filtered out of occupied / related / parent           |
 *
 * Not handled here (caller / DB / toolset topology):
 *  - Intermediate insert / reparent edge surgery
 *  - Subtree re-rank walk
 *  - Moving parents and dragging children with them
 *
 * Intermediate / reparent (caller policy):
 *  1) Fix edges in DB (PART_OF child→parent; drop wrong old PART_OF when allowed).
 *  2) placeAsChild for the child with new parent; parent never moved.
 *  3) Optional subtree re-rank later via rankAfterParent per node.
 *
 * Seed priority inside placeMemoryNode:
 *  1. PART_OF parent → fan under parent
 *  2. Related centroid
 *  3. Cluster centroid
 *  4. Origin (0, 0)
 */

export type WorldPoint = {
  x: number;
  y: number;
};

export type OccupiedNode = WorldPoint & {
  id?: string;
};

export type ParentAnchor = WorldPoint & {
  /** Parent hierarchy depth; child rank becomes parent.rank + 1 */
  rank: number;
};

export type PlaceMemoryInput = {
  /** PART_OF parent position + rank when known */
  parent?: ParentAnchor | null;
  /** Other nodes this memory should sit near (e.g. RELATES_TO ends) */
  related?: WorldPoint[];
  /** All nodes that already have layout (for collision) */
  occupied: OccupiedNode[];
  /** Skip self when re-placing an existing id */
  excludeId?: string;
  /** Minimum world-space distance between node centers */
  minSeparation?: number;
};

export type PlaceMemoryResult = {
  x: number;
  y: number;
  /** 0 = root; parent.rank + 1 when parent provided */
  rank: number;
};

export type LayoutCoords = {
  x?: number | null;
  y?: number | null;
};

export type LayoutWithRank = LayoutCoords & {
  rank?: number | null;
};

/** Default spacing — roughly matches mock-graph tree gaps (~55–60). */
export const DEFAULT_MIN_SEPARATION = 48;

/** Preferred distance from parent to first fan ring (world units). */
export const PARENT_CHILD_RADIUS = 56;

/**
 * Half-angle of the child fan under parent (radians).
 * ±55° ≈ gentle tree look (not a flat 180° bar).
 */
export const PARENT_FAN_HALF_ANGLE = (55 * Math.PI) / 180;

/** Candidate slots on the first fan ring under parent. */
export const PARENT_FAN_SLOTS = 11;

/** Extra fan rings (larger radius) before falling back to full spiral. */
export const PARENT_FAN_RINGS = 3;

/** Max spiral rings before far-below fallback (dense graphs). */
const MAX_SPIRAL_RINGS = 48;

function isFinitePoint(p: WorldPoint): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

function hasFiniteLayout(layout: LayoutCoords | null | undefined): boolean {
  if (layout == null) return false;
  return (
    layout.x != null &&
    layout.y != null &&
    Number.isFinite(layout.x) &&
    Number.isFinite(layout.y)
  );
}

function dist(a: WorldPoint, b: WorldPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function centroid(points: WorldPoint[]): WorldPoint | null {
  const valid = points.filter(isFinitePoint);
  if (valid.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const p of valid) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / valid.length, y: sy / valid.length };
}

function isClear(
  candidate: WorldPoint,
  occupied: WorldPoint[],
  minSeparation: number,
): boolean {
  for (const o of occupied) {
    if (dist(candidate, o) < minSeparation) return false;
  }
  return true;
}

/**
 * Spiral outward from seed until a free slot is found.
 * Ring 0 tries the seed; then rings of increasing radius with more samples.
 * If all rings fail (extremely dense), place far below seed — never stack.
 */
export function findFreeSlot(
  seed: WorldPoint,
  occupied: WorldPoint[],
  minSeparation: number,
): WorldPoint {
  if (isClear(seed, occupied, minSeparation)) {
    return seed;
  }

  for (let ring = 1; ring <= MAX_SPIRAL_RINGS; ring++) {
    const radius = minSeparation * ring;
    const steps = Math.max(8, ring * 6);
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const candidate = {
        x: seed.x + Math.cos(angle) * radius,
        y: seed.y + Math.sin(angle) * radius,
      };
      if (isClear(candidate, occupied, minSeparation)) {
        return candidate;
      }
    }
  }

  return {
    x: seed.x,
    y: seed.y + minSeparation * (MAX_SPIRAL_RINGS + 1),
  };
}

/**
 * Fan candidates under a parent (screen-style +y down).
 * spread=0 → straight below; ±halfAngle spreads left/right.
 * Exported for unit tests / callers that want to inspect slots.
 */
export function fanSlotsUnderParent(
  parent: WorldPoint,
  options?: {
    radius?: number;
    halfAngle?: number;
    slots?: number;
    rings?: number;
  },
): WorldPoint[] {
  const radius0 = options?.radius ?? PARENT_CHILD_RADIUS;
  const halfAngle = options?.halfAngle ?? PARENT_FAN_HALF_ANGLE;
  const slots = Math.max(3, options?.slots ?? PARENT_FAN_SLOTS);
  const rings = Math.max(1, options?.rings ?? PARENT_FAN_RINGS);

  type Cand = { x: number; y: number; absT: number; ring: number };
  const raw: Cand[] = [];
  for (let ring = 0; ring < rings; ring++) {
    const radius = radius0 + ring * (radius0 * 0.55);
    for (let i = 0; i < slots; i++) {
      const t = slots === 1 ? 0 : (i / (slots - 1)) * 2 - 1; // -1..1 left→right
      const spread = t * halfAngle;
      // +y is down: cos(spread) keeps primary offset downward.
      raw.push({
        x: parent.x + Math.sin(spread) * radius,
        y: parent.y + Math.cos(spread) * radius,
        absT: Math.abs(t),
        ring,
      });
    }
  }
  // Prefer straight-below (absT≈0), then inner rings, then outer fan.
  raw.sort((a, b) => a.ring - b.ring || a.absT - b.absT);
  return raw.map(({ x, y }) => ({ x, y }));
}

/**
 * First free fan slot under parent, or null if all fan candidates blocked.
 */
export function findFreeFanSlot(
  parent: WorldPoint,
  occupied: WorldPoint[],
  minSeparation: number,
): WorldPoint | null {
  const candidates = fanSlotsUnderParent(parent, {
    radius: Math.max(PARENT_CHILD_RADIUS, minSeparation * 1.15),
  });
  for (const c of candidates) {
    if (isClear(c, occupied, minSeparation)) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rank & place policy helpers (pure; for toolset / callers)
// ---------------------------------------------------------------------------

/**
 * Child hierarchy depth given parent rank.
 */
export function rankAfterParent(parentRank: number): number {
  const base = Number.isFinite(parentRank) ? Math.floor(parentRank) : 0;
  return Math.max(0, base) + 1;
}

/** Alias: child rank = parent.rank + 1. */
export function recomputeRankFromParent(parentRank: number): number {
  return rankAfterParent(parentRank);
}

/**
 * Whether layout should be written on upsert.
 * true only if create OR existing row is missing finite x/y.
 */
export function shouldPlaceOnUpsert(args: {
  isCreate: boolean;
  existing: LayoutCoords | null;
}): boolean {
  if (args.isCreate) return true;
  return !hasFiniteLayout(args.existing);
}

/**
 * @deprecated Prefer shouldPlaceOnUpsert.
 */
export function shouldReplaceLayout(
  existing: LayoutCoords | null,
  isCreate: boolean,
): boolean {
  return shouldPlaceOnUpsert({ isCreate, existing });
}

/**
 * Whether linkMemories should re-place the **source** node.
 * - PART_OF: always re-place child when linking (caller still requires parent layout).
 * - RELATES_TO: only if source is missing finite x/y.
 */
export function shouldPlaceOnLink(args: {
  type: "PART_OF" | "RELATES_TO";
  sourceLayout: LayoutWithRank | null;
}): boolean {
  if (args.type === "PART_OF") return true;
  return !hasFiniteLayout(args.sourceLayout);
}

/**
 * Build collision list from raw layout rows (filters non-finite; optional exclude).
 */
export function buildOccupiedFromLayouts(
  layouts: Array<{ id: string; x?: number | null; y?: number | null }>,
  excludeId?: string,
): OccupiedNode[] {
  const out: OccupiedNode[] = [];
  for (const n of layouts) {
    if (excludeId != null && n.id === excludeId) continue;
    if (n.x == null || n.y == null) continue;
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
    out.push({ id: n.id, x: n.x, y: n.y });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Thin placement wrappers (clarity for toolset)
// ---------------------------------------------------------------------------

/** Root / orphan / empty-graph: no parent; optional related bias. */
export function placeAsRoot(
  input: Omit<PlaceMemoryInput, "parent">,
): PlaceMemoryResult {
  return placeMemoryNode({ ...input, parent: null });
}

/** PART_OF child: fan under parent, rank parent+1. */
export function placeAsChild(
  input: PlaceMemoryInput & { parent: ParentAnchor },
): PlaceMemoryResult {
  return placeMemoryNode(input);
}

/**
 * RELATES_TO placement when source has no layout yet.
 */
export function placeForRelates(
  input: Omit<PlaceMemoryInput, "parent"> & {
    related: WorldPoint[];
  },
): PlaceMemoryResult {
  return placeMemoryNode({ ...input, parent: null });
}

/**
 * Compute world x/y (and rank) for a new or re-placed Memory.
 * Pure — no I/O; caller loads occupied/parent from Falkor.
 *
 * Do not call for content-only upserts that already have x/y
 * (see shouldPlaceOnUpsert).
 */
export function placeMemoryNode(input: PlaceMemoryInput): PlaceMemoryResult {
  const minSeparation = input.minSeparation ?? DEFAULT_MIN_SEPARATION;
  const occupied = input.occupied
    .filter((n) => isFinitePoint(n))
    .filter((n) => (input.excludeId != null ? n.id !== input.excludeId : true))
    .map((n) => ({ x: n.x, y: n.y }));

  const parent =
    input.parent != null && isFinitePoint(input.parent) ? input.parent : null;
  const related = (input.related ?? []).filter(isFinitePoint);

  let rank = 0;
  let point: WorldPoint;

  if (parent != null) {
    rank = rankAfterParent(parent.rank);

    // 1) Prefer gentle fan under parent (siblings spread, not one seed pile).
    const fanHit = findFreeFanSlot(parent, occupied, minSeparation);
    if (fanHit != null) {
      point = fanHit;
    } else {
      // 2) Spiral from straight-below seed if fan is saturated.
      const relatedBias = centroid(related);
      const seed = {
        x: relatedBias != null ? (parent.x + relatedBias.x) / 2 : parent.x,
        y: parent.y + PARENT_CHILD_RADIUS,
      };
      point = findFreeSlot(seed, occupied, minSeparation);
    }
  } else {
    const relatedCenter = centroid(related);
    const clusterCenter = centroid(occupied);
    let seed: WorldPoint;
    if (relatedCenter != null) {
      seed = {
        x: relatedCenter.x,
        y: relatedCenter.y + PARENT_CHILD_RADIUS * 0.5,
      };
    } else if (clusterCenter != null) {
      seed = {
        x: clusterCenter.x + minSeparation,
        y: clusterCenter.y,
      };
    } else {
      seed = { x: 0, y: 0 };
    }
    rank = 0;
    point = findFreeSlot(seed, occupied, minSeparation);
  }

  return { x: point.x, y: point.y, rank };
}
