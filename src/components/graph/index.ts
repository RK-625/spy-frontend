/**
 * Graph React host barrel — product surface for `/graph` (Cosmograph)
 * and `/d3` (D3-force SVG host).
 *
 * Prefer: `import { GraphCanvas, D3Canvas, NodeDetailDialog } from "@/components/graph"`.
 * Inside graph/* use relative imports (never this barrel — avoids cycles).
 *
 * `/graph` is Cosmograph; D3Canvas is the `/d3` host.
 * Cosmograph owns layout + camera + draw on `/graph`.
 */

export { GraphCanvas } from "./graph-canvas";
export { D3Canvas } from "./d3-canvas";
export { NodeDetailDialog } from "./node-detail-dialog";
