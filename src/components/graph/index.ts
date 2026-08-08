/**
 * Graph React host barrel — product surface for `/graph`.
 *
 * Prefer: `import { GraphCanvas, NodeDetailDialog } from "@/components/graph"`.
 * Inside graph/* use relative imports (never this barrel — avoids cycles).
 *
 * Pure graph logic lives under `@/lib/graph` — this package is React host only
 * (Pixi mount, RTC camera chrome, node inspect dialog).
 */

export { GraphCanvas } from "./graph-canvas";
export { NodeDetailDialog } from "./node-detail-dialog";
