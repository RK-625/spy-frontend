"use client";

import { useCallback, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import {
  isResolvedTheme,
  isThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme-preference";

const subscribeToNothing = () => () => {};

/** False on the server and during hydration: the stored theme only exists in the browser. */
function useIsThemeReadable(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

export interface ThemeSwitch {
  /** Undefined until hydrated. */
  themePreference: ThemePreference | undefined;
  /** Undefined until hydrated. */
  resolvedTheme: ResolvedTheme | undefined;
  switchTheme: (nextPreference: ThemePreference) => void;
}

/** Reads and changes the theme; the change crossfades the whole page when motion is allowed. */
export function useThemeSwitch(): ThemeSwitch {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isThemeReadable = useIsThemeReadable();
  const reducedMotion = usePrefersReducedMotion();

  const switchTheme = useCallback(
    (nextPreference: ThemePreference) => {
      if (reducedMotion || typeof document.startViewTransition !== "function") {
        setTheme(nextPreference);
        return;
      }
      // The snapshot of the new state is taken when the callback returns, so the theme class
      // must be applied synchronously inside it.
      const transition = document.startViewTransition(() => {
        flushSync(() => setTheme(nextPreference));
      });
      // A skipped transition (hidden tab, another one starting) still applies the theme; only
      // the crossfade is lost, so its rejection is not an error.
      transition.ready.catch(() => {});
    },
    [reducedMotion, setTheme],
  );

  return {
    themePreference: isThemeReadable && isThemePreference(theme) ? theme : undefined,
    resolvedTheme:
      isThemeReadable && isResolvedTheme(resolvedTheme) ? resolvedTheme : undefined,
    switchTheme,
  };
}
