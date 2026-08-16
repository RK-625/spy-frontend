/**
 * Graph React host barrel — product surface for `/graph` via SigmaCanvasHost
 * (dynamic, client-only; Sigma never evaluates in Node).
 *
 * Prefer: `import { SigmaCanvasHost, NodeDetailDialog } from "@/components/graph"`.
 * Inside graph/* use relative imports (never this barrel — avoids cycles).
 * Do not re-export SigmaCanvas here — that pulls WebGL into the RSC graph.
 *
 * `/graph` is Sigma. Sigma + graphology FA2 own layout + camera + draw.
 */

export { SigmaCanvasHost } from "./sigma-canvas-host";
export { NodeDetailDialog } from "./node-detail-dialog";
