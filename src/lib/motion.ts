import type { TargetAndTransition } from "motion/react";

export const MOTION = {
  chrome: { duration: 0.15, ease: "easeOut" as const },
  familySlide: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const },
  spring: { type: "spring" as const, stiffness: 320, damping: 32 },
} as const;

export const CHROME_FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

/** Scale-fade swap for glyphs and small status marks (icon ↔ loader ↔ tick). */
export const GLYPH_SWAP = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
} as const;

/** Short horizontal shake for a rejected input. */
export const ERROR_SHAKE: TargetAndTransition = {
  x: [0, -4, 4, -3, 3, 0],
  transition: { duration: 0.3, ease: "easeOut" },
};

/** Forward families enter from the right; Back reverses the same movement. */
export const FAMILY_SLIDE = {
  initial: (direction: number) => ({ opacity: 0, x: direction * 8 }),
  animate: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -8 }),
};
