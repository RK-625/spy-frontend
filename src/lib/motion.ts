export const MOTION = {
  chrome: { duration: 0.15, ease: "easeOut" as const },
  spring: { type: "spring" as const, stiffness: 320, damping: 32 },
} as const;

export const CHROME_FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;
