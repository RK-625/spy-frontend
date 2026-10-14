"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { DesktopThemeSync } from "./desktop-theme-sync";
import { DEFAULT_THEME_PREFERENCE, THEME_STORAGE_KEY } from "./theme-preference";

// next-themes 0.4.6 renders an inline <script> that React 19 flags when it renders on the
// client (pacocoursey/next-themes#387). The server HTML keeps the executable script, so the
// theme class lands before first paint; the client copy is inert JSON. next-themes already
// sets suppressHydrationWarning on that element, so the differing `type` is not reported.
const THEME_SCRIPT_PROPS =
  typeof window === "undefined" ? undefined : ({ type: "application/json" } as const);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={DEFAULT_THEME_PREFERENCE}
      // Palettes set `color-scheme` themselves (src/styles/tokens).
      enableColorScheme={false}
      enableSystem
      // The theme switch crossfades the whole page instead; per-element transitions would
      // animate each surface at its own pace.
      disableTransitionOnChange
      scriptProps={THEME_SCRIPT_PROPS}
      storageKey={THEME_STORAGE_KEY}
    >
      <DesktopThemeSync />
      {children}
    </ThemeProvider>
  );
}
