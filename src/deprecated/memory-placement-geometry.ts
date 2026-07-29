/**
 * DEPRECATED — fan/spiral place* geometry (pre–Slice 6).
 *
 * Product placement SoT is d3 settle (`settleGraphData` /
 * `settleAndPersistMemoryPlacements`). Do not import from production paths.
 * Kept only as a recoverable snapshot of the retired geometry helpers.
 */

export type WorldPoint = {
  x: number;
  y: number;
};

export type OccupiedNode = WorldPoint & {
  id?: string;
};

export type ParentAnchor = WorldPoint & {
  rank: number;
};

export type PlaceMemoryInput = {
  parent?: ParentAnchor | null;
  related?: WorldPoint[];
  occupied: OccupiedNode[];
  excludeId?: string;
  minSeparation?: number;
};

export type PlaceMemoryResult = {
  x: number;
  y: number;
  rank: number;
};

export const DEFAULT_MIN_SEPARATION = 48;
export const PARENT_CHILD_RADIUS = 56;
export const PARENT_FAN_HALF_ANGLE = (55 * Math.PI) / 180;
export const PARENT_FAN_SLOTS = 11;
export const PARENT_FAN_RINGS = 3;

const MAX_SPIRAL_RINGS = 48;

function isFinitePoint(p: WorldPoint): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
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
      const t = slots === 1 ? 0 : (i / (slots - 1)) * 2 - 1;
      const spread = t * halfAngle;
      raw.push({
        x: parent.x + Math.sin(spread) * radius,
        y: parent.y + Math.cos(spread) * radius,
        absT: Math.abs(t),
        ring,
      });
    }
  }
  raw.sort((a, b) => a.ring - b.ring || a.absT - b.absT);
  return raw.map(({ x, y }) => ({ x, y }));
}

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

function rankAfterParent(parentRank: number): number {
  const base = Number.isFinite(parentRank) ? Math.floor(parentRank) : 0;
  return Math.max(0, base) + 1;
}

/** @deprecated Use settleAndPersistMemoryPlacements (P-A). */
export function placeAsRoot(
  input: Omit<PlaceMemoryInput, "parent">,
): PlaceMemoryResult {
  return placeMemoryNode({ ...input, parent: null });
}

/** @deprecated Use settleAndPersistMemoryPlacements (P-A). */
export function placeAsChild(
  input: PlaceMemoryInput & { parent: ParentAnchor },
): PlaceMemoryResult {
  return placeMemoryNode(input);
}

/** @deprecated Use settleAndPersistMemoryPlacements (P-A). */
export function placeForRelates(
  input: Omit<PlaceMemoryInput, "parent"> & {
    related: WorldPoint[];
  },
): PlaceMemoryResult {
  return placeMemoryNode({ ...input, parent: null });
}

/** @deprecated Durable geometry is d3 settle. */
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

    const fanHit = findFreeFanSlot(parent, occupied, minSeparation);
    if (fanHit != null) {
      point = fanHit;
    } else {
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
