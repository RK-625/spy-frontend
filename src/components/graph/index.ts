/**
 * Graph React host barrel — product surface for `/graph` via SigmaCanvasHost
 * (dynamic, client-only; Sigma never evaluates in Node).
 *
 * Prefer: `import { SigmaCanvasHost } from "@/components/graph"`.
 * Inside graph/* use relative imports (never this barrel — avoids cycles).
 * Do not re-export SigmaCanvas or Editor here — that pulls WebGL / CodeMirror
 * into the RSC graph route.
 *
 * `/graph` is Sigma. Sigma + graphology FA2 own layout + camera + draw.
 */

export { SigmaCanvasHost } from "./sigma-canvas-host";
