/**
 * Graph React host barrel — product surface for `/graph` via SigmaCanvas
 * (graphology FA2 + Sigma).
 *
 * Prefer: `import { SigmaCanvas, NodeDetailDialog } from "@/components/graph"`.
 * Inside graph/* use relative imports (never this barrel — avoids cycles).
 *
 * `/graph` is Sigma. Sigma + graphology FA2 own layout + camera + draw.
 */

export { SigmaCanvas } from "./sigma-canvas";
export { NodeDetailDialog } from "./node-detail-dialog";
