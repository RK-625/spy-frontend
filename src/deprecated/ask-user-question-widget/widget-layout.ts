export const WIDGET = {
  PAD_X: 10,
  ROW_PAD_Y: 4,
  STACK_GAP: 8,
  ROW_GAP: 12,
  BADGE: 28,
  FIELD_MIN_H: 20,
  CHAT_MIN_H: 36,
} as const;

export const WIDGET_TYPE = {
  question: "text-base font-semibold text-text-primary",
  option: "text-sm text-text-primary",
  number: "font-vt323 text-lg text-[#9a8cc0]",
  placeholder: "text-sm text-text-secondary",
  input: "text-sm text-text-primary",
} as const;
