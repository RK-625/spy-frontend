/** Shared pulse ring state — updated by NoiseFieldBg, read by NoiseField each frame. */

export const RING_HALF_WIDTH = 75 / 2

export interface PulseRingState {
  /** Pulse sweep has started (after PULSE_DELAY). */
  active: boolean
  /** Pulse animation finished. */
  complete: boolean
  /** Current ring centerline radius from screen center (px). */
  ringRadius: number
  /** Outer edge of ring band (ringRadius + half band width). */
  outerR: number
  /** Ring start radius (diagonal × 0.6). */
  startRing: number
  cx: number
  cy: number
}

export const INITIAL_PULSE_RING_STATE: PulseRingState = {
  active: false,
  complete: false,
  ringRadius: Infinity,
  outerR: Infinity,
  startRing: Infinity,
  cx: 0,
  cy: 0,
}
