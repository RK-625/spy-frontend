/**
 * Pure d3-force placement recipe for GraphData.
 *
 * One-shot settle only — not continuous ambient motion.
 * Writes world `x` / `y` only. Never writes `rank` (topology-owned via deriveRanks).
 * No Pixi, React, Falkor, layout-loop, or localStorage.
 *
 * Edge semantics:
 *   PART_OF     — stiff, short links (hierarchy)
 *   RELATES_TO  — soft, longer springs (associative mesh)
 *
 * Collide radii read `nodeScreenRadius(rank, 1)` so spacing tracks visual size.
 *
 * Product path: `placeTopology` calls settle on cache miss, then saves poses.
 * Layout paint loop does not settle.
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

import {
  cloneGraphData,
  type GraphData,
  type GraphLinkType,
  type GraphNode,
  type GraphEdge,
} from "../core/graph-data";
import { nodeScreenRadius } from "../core/graph-scale";

// ---------------------------------------------------------------------------
// Tunable knobs (verify / later product — not UI)
// ---------------------------------------------------------------------------

/** Hierarchy spacing (preferred PART_OF link distance, world units). */
export const PART_OF_DISTANCE = 56;
export const PART_OF_STRENGTH = 0.9;

export const RELATES_TO_DISTANCE = 90;
export const RELATES_TO_STRENGTH = 0.15;

/** Collide = nodeScreenRadius(rank, 1) * pad (world units). */
export const COLLIDE_PAD = 3;

/** Mild charge — avoid blowing the web apart. */
export const MANY_BODY_STRENGTH = -45;

/** Weak origin pull for settle stability. */
export const CENTER_STRENGTH = 0.03;

/** Sync ticks when caller does not pass `ticks`. */
export const DEFAULT_SETTLE_TICKS = 300;

/** Near-origin epsilon for collapse / near-origin asserts (world units). */
export const ORIGIN_EPSILON = 1e-3;

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
// Internals
// ---------------------------------------------------------------------------

function toSimNodes(nodes: GraphNode[]): ForceSimNode[] {
  return nodes.map((n) => ({
    id: n.id,
    rank: n.rank,
    label: n.label,
    x: n.x,
    y: n.y,
    vx: 0,
    vy: 0,
  }));
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
 * One-shot settle: deep-clone graph → run sync ticks → write finite x/y.
 * Preserves id, label, rank, and incidence fields; only positions change.
 *
 * Pure — no localStorage. `placeTopology` saves poses after miss-path settle.
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

  return out;
}
