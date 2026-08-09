/**
 * Dot-matrix package barrel — import from `@/components/dotmatrix`.
 *
 * Public surface only. Core utilities, DotMatrixBase, path-wave factories,
 * and internal hooks stay package-private (import via relative paths inside
 * this package — never through this barrel).
 */

// Icons
export {
  DotMatrixIcon,
  type DotMatrixIconName,
  type DotMatrixIconProps,
} from "./icons";

// Loaders
export {
  DotmHex9,
  type DotmHex9Props,
  DotmSquare18,
  type DotmSquare18Props,
  DotmTriangle16,
  type DotmTriangle16Props,
} from "./loaders";

// Shared hooks used outside the package
export { usePrefersReducedMotion } from "./core";

// Shared prop / token types for loader consumers
export type {
  DotMatrixCommonProps,
  DotMatrixColorPreset,
  DotShape,
  DotMatrixPhase,
  MatrixPattern,
} from "./core";
