/**
 * Graph React host barrel — product surface for `/graph`.
 *
 * Prefer: `import { GraphCanvas, NodeDetailDialog } from "@/components/graph"`.
 * Inside graph/* use relative imports (never this barrel — avoids cycles).
 *
 * Cosmograph owns layout + camera + draw. Pixi engine snapshot:
 * `src/deprecated/pixi-graph/` (not imported from product).
 */

export { GraphCanvas } from "./graph-canvas";
export { NodeDetailDialog } from "./node-detail-dialog";
