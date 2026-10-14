"use client";

import { useEffect } from "react";
import { useThemeSwitch } from "./hooks/use-theme-switch";
import type { ThemePreference } from "./theme-preference";

/** Exposed by electron/preload.js; absent in a normal browser. */
interface SpyDesktopBridge {
  setThemePreference: (themePreference: ThemePreference) => void;
}

declare global {
  interface Window {
    spyDesktop?: SpyDesktopBridge;
  }
}

/** Mirrors the theme preference into the Electron window (native chrome, launch background). */
export function DesktopThemeSync() {
  const { themePreference } = useThemeSwitch();

  useEffect(() => {
    if (themePreference === undefined) return;
    window.spyDesktop?.setThemePreference(themePreference);
  }, [themePreference]);

  return null;
}
