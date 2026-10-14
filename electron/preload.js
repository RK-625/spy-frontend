/**
 * Sandboxed preload: the page gets one narrow function, never ipcRenderer itself.
 * Sandboxed preloads cannot require local files, so the channel and allowed values
 * are repeated from electron/theme.js.
 */
const { contextBridge, ipcRenderer } = require("electron");

const THEME_PREFERENCE_CHANNEL = "spy:theme-preference";
const THEME_PREFERENCES = ["light", "dark", "system"];

contextBridge.exposeInMainWorld("spyDesktop", {
  /** Mirrors the in-app theme into the native window chrome. */
  setThemePreference(themePreference) {
    if (!THEME_PREFERENCES.includes(themePreference)) return;
    ipcRenderer.send(THEME_PREFERENCE_CHANNEL, themePreference);
  },
});
