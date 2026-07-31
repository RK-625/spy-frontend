/**
 * Pure d3-force placement recipe for GraphData (Slice 0 + client placement cache).
 *
 * One-shot / short settle only — not continuous ambient motion.
 * Mutates / outputs world `x` / `y` only. Never writes `rank` (topology-owned).
 * No Pixi, React, Falkor, or layout-loop imports.
 *
 * Edge semantics:
 *   PART_OF     — stiff, short links (hierarchy)
 *   RELATES_TO  — soft, longer springs (associative mesh)
 *
 * Collide radii read `nodeScreenRadius(rank, 1)` so spacing tracks visual size.
 *
 * Placement cache (client-placement-cache MVP):
 * - Product cold path seeds via adapter `seedNodePosition` (spread, not origin).
 * - Adapter exposes `needsLayout` (fingerprint / full-cache-hit); the host
 *   decides whether to call `settleIfNeeded` (cache miss) or paint as-is (hit).
 * - `settleIfNeeded` always cold-starts + settles when called (no dual gate).
 * - Full settle always writes client placement cache under this graph's
 *   fingerprint when browser storage exists (`typeof window !== "undefined"`).
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type ForceLink,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import type { GraphData, GraphLinkType, GraphNode, GraphEdge } from "../core/graph-data";
import { nodeScreenRadius } from "../core/graph-scale";
import {
  computeTopoFingerprint,
  savePlacementCache,
  type CachedPlacementNode,
} from "./placement-cache";

// ---------------------------------------------------------------------------
// Tunable knobs (verify / later product — not UI)
// ---------------------------------------------------------------------------

/** Hierarchy spacing (matches client pose helper PARENT_CHILD_RADIUS). */
export const PART_OF_DISTANCE = 56;
export const PART_OF_STRENGTH = 0.9;

export const RELATES_TO_DISTANCE = 90;
export const RELATES_TO_STRENGTH = 0.15;

/** Collide = nodeScreenRadius(rank, 1) * pad (world units). */
export const COLLIDE_PAD = 3;

/** Mild charge — avoid blowing the web apart. */
export const MANY_BODY_STRENGTH = -45;

/** Weak origin pull (replaces FA2 recenter drift fix for settle). */
export const CENTER_STRENGTH = 0.03;

/** Sync ticks when caller does not pass `ticks`. */
export const DEFAULT_SETTLE_TICKS = 300;

/** Near-origin epsilon for collapse / cold-start detection (world units). */
export const ORIGIN_EPSILON = 1e-3;

/**
 * Deterministic cold-start jitter magnitude (world units).
 * Large enough to break (0,0) symmetry; tiny vs link distances.
 */
export const COLD_START_JITTER = 0.01;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ForceSimNode = SimulationNodeDatum & {
  id: string;
  rank: number;
  label?: string;
};

export type ForceSimLink = SimulationLinkDatum<ForceSimNode> & {
  id: string;
  type: GraphLinkType;
};

export type ForceRecipeOptions = {
  /** Override collide pad (default COLLIDE_PAD). */
  collidePad?: number;
  /** Override many-body strength (default MANY_BODY_STRENGTH). */
  manyBodyStrength?: number;
  /** Override center strength (default CENTER_STRENGTH). */
  centerStrength?: number;
  /** PART_OF link distance (default PART_OF_DISTANCE). */
  partOfDistance?: number;
  /** RELATES_TO link distance (default RELATES_TO_DISTANCE). */
  relatesDistance?: number;
};

export type SettleGraphOptions = ForceRecipeOptions & {
  /** Sync Verlet ticks (default DEFAULT_SETTLE_TICKS). */
  ticks?: number;
};

// ---------------------------------------------------------------------------
// Clone / seed helpers
// ---------------------------------------------------------------------------

function seedXY(n: GraphNode): { x: number; y: number } {
  const x = typeof n.x === "number" && Number.isFinite(n.x) ? n.x : 0;
  const y = typeof n.y === "number" && Number.isFinite(n.y) ? n.y : 0;
  return { x, y };
}

/** Shallow-clone nodes/edges so settle does not mutate the caller's GraphData. */
export function cloneGraphData(graph: GraphData): GraphData {
  return {
    nodes: graph.nodes.map((n) => ({
      ...n,
      childIds: [...n.childIds],
      parentIds: [...n.parentIds],
      relateIds: [...n.relateIds],
      rimOccupations: n.rimOccupations.map((r) => ({ ...r })),
    })),
    edges: graph.edges.map((e) => ({ ...e })),
  };
}

function toSimNodes(nodes: GraphNode[]): ForceSimNode[] {
  return nodes.map((n) => {
    const { x, y } = seedXY(n);
    return {
      id: n.id,
      rank: n.rank,
      label: n.label,
      x,
      y,
      vx: 0,
      vy: 0,
    };
  });
}

function toSimLinks(edges: GraphEdge[]): ForceSimLink[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type,
  }));
}

function linkDistance(
  link: ForceSimLink,
  partOf: number,
  relates: number
): number {
  return link.type === "PART_OF" ? partOf : relates;
}

function linkStrength(link: ForceSimLink): number {
  return link.type === "PART_OF" ? PART_OF_STRENGTH : RELATES_TO_STRENGTH;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a stopped d3 simulation wired with the Spy force recipe.
 * Caller may `sim.tick(n)` or resume with alpha; does not run ticks itself.
 */
export function buildForceSimulation(
  graph: GraphData,
  options?: ForceRecipeOptions
): {
  simulation: Simulation<ForceSimNode, ForceSimLink>;
  nodes: ForceSimNode[];
  links: ForceSimLink[];
} {
  const collidePad = options?.collidePad ?? COLLIDE_PAD;
  const manyBody = options?.manyBodyStrength ?? MANY_BODY_STRENGTH;
  const centerStr = options?.centerStrength ?? CENTER_STRENGTH;
  const partOfDist = options?.partOfDistance ?? PART_OF_DISTANCE;
  const relatesDist = options?.relatesDistance ?? RELATES_TO_DISTANCE;

  const nodes = toSimNodes(graph.nodes);
  const links = toSimLinks(graph.edges);

  const linkForce: ForceLink<ForceSimNode, ForceSimLink> = forceLink<
    ForceSimNode,
    ForceSimLink
  >(links)
    .id((d) => d.id)
    .distance((d) => linkDistance(d, partOfDist, relatesDist))
    .strength((d) => linkStrength(d));

  const simulation = forceSimulation<ForceSimNode, ForceSimLink>(nodes)
    .force("link", linkForce)
    .force(
      "collide",
      forceCollide<ForceSimNode>().radius(
        (d) => nodeScreenRadius(d.rank, 1) * collidePad
      )
    )
    .force("charge", forceManyBody<ForceSimNode>().strength(manyBody))
    .force("center", forceCenter<ForceSimNode>(0, 0).strength(centerStr))
    .stop();

  return { simulation, nodes, links };
}

/**
 * One-shot settle: clone graph → run sync ticks → write finite x/y.
 * Preserves id, label, rank, and incidence fields; only positions change.
 *
 * After settle, when `window` is defined, writes client placement cache under
 * **this** graph’s fingerprint (nodes + edges — same filtered edge set the
 * adapter uses when mapping from topology; see `filterTopologyLinks`).
 */
export function settleGraphData(
  graph: GraphData,
  options?: SettleGraphOptions
): GraphData {
  const out = cloneGraphData(graph);
  const ticks = options?.ticks ?? DEFAULT_SETTLE_TICKS;
  const { simulation, nodes } = buildForceSimulation(out, options);

  simulation.tick(Math.max(0, Math.floor(ticks)));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const node of out.nodes) {
    const sim = byId.get(node.id);
    if (!sim) continue;
    const x = sim.x;
    const y = sim.y;
    node.x = typeof x === "number" && Number.isFinite(x) ? x : 0;
    node.y = typeof y === "number" && Number.isFinite(y) ? y : 0;
  }

  if (typeof window !== "undefined") {
    const ranks = new Map(out.nodes.map((n) => [n.id, n.rank]));
    const fingerprint = computeTopoFingerprint(out.nodes, out.edges, ranks);
    const cachedNodes: Record<string, CachedPlacementNode> = {};
    for (const node of out.nodes) {
      cachedNodes[node.id] = {
        x: node.x,
        y: node.y,
        rank: node.rank,
      };
    }
    savePlacementCache(fingerprint, cachedNodes);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Cold-start (Slice 2)
// ---------------------------------------------------------------------------

/** Stable 32-bit hash of a node id (for deterministic jitter). */
function hashNodeId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Tiny deterministic xy offsets so an all-at-origin stack can separate under
 * many-body / link / collide. Does not change rank. Magnitude = COLD_START_JITTER.
 */
export function applyColdStartJitter(
  nodes: GraphNode[],
  magnitude: number = COLD_START_JITTER
): void {
  for (const n of nodes) {
    const h = hashNodeId(n.id);
    const angle = ((h % 3600) / 3600) * Math.PI * 2;
    const radius = magnitude * (0.5 + (h % 1000) / 1000);
    n.x = (Number.isFinite(n.x) ? n.x : 0) + Math.cos(angle) * radius;
    n.y = (Number.isFinite(n.y) ? n.y : 0) + Math.sin(angle) * radius;
  }
}

/**
 * Always settles: clone → cold-start jitter → `settleGraphData`.
 * Host owns hit/miss (adapter `needsLayout`); call only when layout is needed.
 * Ranks are never modified. Placement cache write is browser-only (see settle).
 */
export function settleIfNeeded(
  graph: GraphData,
  options?: SettleGraphOptions
): GraphData {
  const seeded = cloneGraphData(graph);
  applyColdStartJitter(seeded.nodes);
  return settleGraphData(seeded, options);
}
