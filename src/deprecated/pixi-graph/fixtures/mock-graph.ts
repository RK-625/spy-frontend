/**
 * Local mock / stress fixtures for verify scripts and layout labs — not live
 * Falkor I/O. Product `/graph` is live-only (GET `/api/graph`); these fixtures
 * are not mounted by `graph-canvas` and are **not** re-exported from the
 * product barrel `@/lib/graph`. Deep-import this module from tests/scripts only:
 *   `@/lib/graph/fixtures/mock-graph` or a file URL under `src/lib/graph/fixtures/`.
 */

import {
  emptyNodeIncidence,
  recomputeIncidence,
  type GraphData,
  type GraphEdge,
  type GraphNode,
} from "../core/graph-data";

/**
 * Mock fixture for the graph spike (two clusters).
 *
 * **Left — small tree** (origin) for hierarchy + sparse sockets:
 *   root (0)
 *   ├── child-a (1) → leaf-a1, leaf-a2
 *   ├── child-b (1) → leaf-b1
 *   └── child-c (1) → leaf-c1
 *   + a few RELATES_TO chords
 *
 * **Right — multi-edge hub** for RimLock stress (zoom/pan to ~x=220):
 *   hub (0) with HUB_SPOKE_COUNT PART_OF children on a ring
 *   + ring RELATES between adjacent spokes
 *   + a few long RELATES from hub to tree leaves
 */
/** Spokes on the hub ring — enough to force rim sharing / non-overlap. */
export const HUB_SPOKE_COUNT = 14;

/** Fixture body text for node-inspect (mock only — not live Memory). */
function mockContent(label: string, blurb: string): string {
  return `${blurb}\n\n(Fixture node “${label}” — live KB rows carry real Memory content.)`;
}

export function createMockGraphData(): GraphData {
  const nodes: GraphNode[] = [
    {
      id: "root",
      x: 0,
      y: 0,
      label: "root",
      content: mockContent(
        "root",
        "Origin of the left tree — hierarchy root for the mock knowledge cluster.",
      ),
      rank: 0,
      ...emptyNodeIncidence(),
    },
    {
      id: "child-a",
      x: -60,
      y: 55,
      label: "child-a",
      content: mockContent(
        "child-a",
        "Left branch under root. Holds leaf-a1 and leaf-a2.",
      ),
      rank: 1,
      ...emptyNodeIncidence(),
    },
    {
      id: "child-b",
      x: 60,
      y: 55,
      label: "child-b",
      content: mockContent(
        "child-b",
        "Right branch under root. Relates across to child-a.",
      ),
      rank: 1,
      ...emptyNodeIncidence(),
    },
    {
      id: "child-c",
      x: 0,
      y: 70,
      label: "child-c",
      content: mockContent(
        "child-c",
        "Center branch under root — sparse path into leaf-c1.",
      ),
      rank: 1,
      ...emptyNodeIncidence(),
    },
    {
      id: "leaf-a1",
      x: -95,
      y: 110,
      label: "leaf-a1",
      content: mockContent("leaf-a1", "Deep leaf on the A branch."),
      rank: 2,
      ...emptyNodeIncidence(),
    },
    {
      id: "leaf-a2",
      x: -25,
      y: 115,
      label: "leaf-a2",
      content: mockContent("leaf-a2", "Sibling leaf on the A branch."),
      rank: 2,
      ...emptyNodeIncidence(),
    },
    {
      id: "leaf-b1",
      x: 70,
      y: 120,
      label: "leaf-b1",
      content: mockContent("leaf-b1", "Leaf under child-b."),
      rank: 2,
      ...emptyNodeIncidence(),
    },
    {
      id: "leaf-c1",
      x: 5,
      y: 135,
      label: "leaf-c1",
      content: mockContent("leaf-c1", "Leaf under child-c."),
      rank: 2,
      ...emptyNodeIncidence(),
    },
  ];

  const edges: GraphEdge[] = [
    { id: "po-a", source: "child-a", target: "root", type: "PART_OF" },
    { id: "po-b", source: "child-b", target: "root", type: "PART_OF" },
    { id: "po-c", source: "child-c", target: "root", type: "PART_OF" },
    { id: "po-a1", source: "leaf-a1", target: "child-a", type: "PART_OF" },
    { id: "po-a2", source: "leaf-a2", target: "child-a", type: "PART_OF" },
    { id: "po-b1", source: "leaf-b1", target: "child-b", type: "PART_OF" },
    { id: "po-c1", source: "leaf-c1", target: "child-c", type: "PART_OF" },
    { id: "rt-ab", source: "child-a", target: "child-b", type: "RELATES_TO" },
    { id: "rt-a1b1", source: "leaf-a1", target: "leaf-b1", type: "RELATES_TO" },
    { id: "rt-root-a2", source: "root", target: "leaf-a2", type: "RELATES_TO" },
  ];

  const hubX = 220;
  const hubY = 0;
  const spokeR = 95;
  nodes.push({
    id: "hub",
    x: hubX,
    y: hubY,
    label: "hub",
    content: mockContent(
      "hub",
      "Multi-edge hub for RimLock stress — many PART_OF children on a ring.",
    ),
    rank: 0,
    ...emptyNodeIncidence(),
  });

  for (let i = 0; i < HUB_SPOKE_COUNT; i++) {
    const ang = (i / HUB_SPOKE_COUNT) * Math.PI * 2 - Math.PI / 2;
    const id = `spoke-${i}`;
    nodes.push({
      id,
      x: hubX + Math.cos(ang) * spokeR,
      y: hubY + Math.sin(ang) * spokeR,
      label: id,
      content: mockContent(id, `Spoke ${i} of the hub ring.`),
      rank: 1,
      ...emptyNodeIncidence(),
    });
    edges.push({
      id: `po-hub-${i}`,
      source: id,
      target: "hub",
      type: "PART_OF",
    });
    const next = `spoke-${(i + 1) % HUB_SPOKE_COUNT}`;
    edges.push({
      id: `rt-spoke-${i}`,
      source: id,
      target: next,
      type: "RELATES_TO",
    });
  }

  edges.push(
    { id: "rt-hub-root", source: "hub", target: "root", type: "RELATES_TO" },
    { id: "rt-hub-a2", source: "hub", target: "leaf-a2", type: "RELATES_TO" },
    {
      id: "rt-spoke0-b1",
      source: "spoke-0",
      target: "leaf-b1",
      type: "RELATES_TO",
    }
  );

  const graph: GraphData = { nodes, edges };
  recomputeIncidence(graph);
  return graph;
}

/**
 * Optional large stress fixture for A/B perf validation — **not** the default
 * `/graph` mock. Import explicitly or opt in via query (host wiring).
 */
export type LargeStressFixtureOptions = {
  hubCount?: number;
  spokesPerHub?: number;
  hubSpacing?: number;
  spokeRadius?: number;
};

export function createLargeStressGraphData(
  options: LargeStressFixtureOptions = {}
): GraphData {
  const hubCount = Math.max(1, options.hubCount ?? 40);
  const spokesPerHub = Math.max(1, options.spokesPerHub ?? 12);
  const hubSpacing = options.hubSpacing ?? 280;
  const spokeRadius = options.spokeRadius ?? 90;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const cols = Math.ceil(Math.sqrt(hubCount));

  for (let h = 0; h < hubCount; h++) {
    const col = h % cols;
    const row = Math.floor(h / cols);
    const hubX = (col - (cols - 1) / 2) * hubSpacing;
    const hubY = (row - (cols - 1) / 2) * hubSpacing;
    const hubId = `stress-hub-${h}`;
    nodes.push({
      id: hubId,
      x: hubX,
      y: hubY,
      label: hubId,
      rank: 0,
      ...emptyNodeIncidence(),
    });

    for (let s = 0; s < spokesPerHub; s++) {
      const ang = (s / spokesPerHub) * Math.PI * 2 - Math.PI / 2;
      const spokeId = `stress-spoke-${h}-${s}`;
      nodes.push({
        id: spokeId,
        x: hubX + Math.cos(ang) * spokeRadius,
        y: hubY + Math.sin(ang) * spokeRadius,
        label: spokeId,
        rank: 1,
        ...emptyNodeIncidence(),
      });
      edges.push({
        id: `stress-po-${h}-${s}`,
        source: spokeId,
        target: hubId,
        type: "PART_OF",
      });
      const nextSpoke = `stress-spoke-${h}-${(s + 1) % spokesPerHub}`;
      edges.push({
        id: `stress-rt-${h}-${s}`,
        source: spokeId,
        target: nextSpoke,
        type: "RELATES_TO",
      });
    }
  }

  const graph: GraphData = { nodes, edges };
  recomputeIncidence(graph);
  return graph;
}
