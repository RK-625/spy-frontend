import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

/** What the user picked. `system` follows the OS `prefers-color-scheme`. */
export type ThemePreference = "light" | "dark" | "system";
/** What is actually painted once `system` is resolved. */
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const THEME_STORAGE_KEY = "spy-theme";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "dark";
/** What is painted before the stored preference is readable (server render, hydration). */
export const DEFAULT_RESOLVED_THEME: ResolvedTheme = "dark";

export interface ThemePreferenceOption {
  id: ThemePreference;
  label: string;
  icon: LucideIcon;
  keywords: string[];
}

export const THEME_PREFERENCE_OPTIONS: readonly ThemePreferenceOption[] = [
  { id: "light", label: "Light", icon: Sun, keywords: ["light", "bright", "white", "day"] },
  { id: "dark", label: "Dark", icon: Moon, keywords: ["dark", "night", "black"] },
  { id: "system", label: "System", icon: Monitor, keywords: ["system", "auto", "os", "default"] },
];

export const RESOLVED_THEME_LABEL: Record<ResolvedTheme, string> = {
  light: "Light",
  dark: "Dark",
};

export const RESOLVED_THEME_ICON: Record<ResolvedTheme, LucideIcon> = {
  light: Sun,
  dark: Moon,
};

export function isThemePreference(value: string | undefined): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function isResolvedTheme(value: string | undefined): value is ResolvedTheme {
  return value === "light" || value === "dark";
}

/** The theme a one-click toggle moves to. Unknown (pre-hydration) counts as the dark default. */
export function findOppositeTheme(resolvedTheme: ResolvedTheme | undefined): ResolvedTheme {
  return resolvedTheme === "light" ? "dark" : "light";
}
