"use client";

import { motion } from "motion/react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import { isThemePreference, THEME_PREFERENCE_OPTIONS, useThemeSwitch } from "@/components/theme";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { MOTION } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_CARD_LABEL_CLASS,
  SettingsPaneHeader,
} from "./settings-pane-chrome";

/** Same track and slot tokens as the sidebar route switcher. */
const THEME_SLOT_CLASS = cn(
  "relative flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[6px] text-[0.8125rem]",
  "transition-[background-color,color] duration-fast ease-chrome outline-none",
  "focus-visible:ring-2 focus-visible:ring-ring",
);

function themeSlotTone(isSelected: boolean): string {
  return isSelected
    ? "text-[var(--secondary-foreground)]"
    : "text-text-secondary hover:bg-[var(--surface-hover)]";
}

export function AppearancePane() {
  const { themePreference, switchTheme } = useThemeSwitch();
  const reducedMotion = usePrefersReducedMotion();

  return (
    <>
      <SettingsPaneHeader
        description="Choose how Spy looks. System follows your OS setting."
        title="Appearance"
      />
      <div className={SETTINGS_CARD_CLASS}>
        <div className={SETTINGS_CARD_LABEL_CLASS} id="appearance-theme-label">
          Theme
        </div>
        {/* Radix radio group: arrow keys move and select, one Tab stop for the whole group. */}
        <RadioGroupPrimitive.Root
          aria-labelledby="appearance-theme-label"
          className="mt-2 flex h-9 w-full items-center gap-1 rounded-[8px] bg-[var(--surface-chat)] p-1"
          loop
          onValueChange={(nextPreference) => {
            if (isThemePreference(nextPreference)) switchTheme(nextPreference);
          }}
          orientation="horizontal"
          // "" until hydrated: no option checked, but the group stays controlled.
          value={themePreference ?? ""}
        >
          {THEME_PREFERENCE_OPTIONS.map((option) => {
            const isSelected = option.id === themePreference;
            const OptionIcon = option.icon;
            return (
              <RadioGroupPrimitive.Item
                className={cn(THEME_SLOT_CLASS, themeSlotTone(isSelected))}
                key={option.id}
                value={option.id}
              >
                {isSelected && (
                  <motion.span
                    className="absolute inset-0 rounded-[6px] bg-[var(--surface-focus)]"
                    layoutId="appearance-theme-highlight"
                    transition={reducedMotion ? { duration: 0 } : MOTION.spring}
                  />
                )}
                <OptionIcon
                  className="relative size-4"
                  size={ICON_GLYPH.inline}
                  strokeWidth={1.5}
                />
                <span className="relative">{option.label}</span>
              </RadioGroupPrimitive.Item>
            );
          })}
        </RadioGroupPrimitive.Root>
      </div>
    </>
  );
}
