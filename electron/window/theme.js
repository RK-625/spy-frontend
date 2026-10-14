/**
 * Desktop half of the theme. The renderer owns the preference (next-themes); main mirrors it
 * into nativeTheme (native chrome, prefers-color-scheme) and remembers it, so the next launch
 * paints the right window background before the page loads.
 */
const { BrowserWindow, ipcMain, nativeTheme } = require("electron");

const THEME_PREFERENCE_CHANNEL = "spy:theme-preference";
const THEME_PREFERENCES = ["light", "dark", "system"];
const DEFAULT_THEME_PREFERENCE = "dark";
/** Must equal --background in src/styles/tokens/palette-{light,dark}.css (verify:no-raw-colors checks). */
const WINDOW_BACKGROUND = {
  light: "#f7f4ee",
  dark: "#060610",
};

/** @type {import("electron-store").default<{ themePreference: string }> | null} */
let themeStore = null;

/** Restores the last preference into nativeTheme. Call before the first window opens. */
async function restoreThemePreference() {
  // electron-store is ESM-only; main is CommonJS.
  const { default: Store } = await import("electron-store");
  themeStore = new Store({
    name: "theme",
    schema: {
      themePreference: { enum: THEME_PREFERENCES, default: DEFAULT_THEME_PREFERENCE },
    },
  });
  nativeTheme.themeSource = themeStore.get("themePreference");
}

function resolveWindowBackground() {
  return nativeTheme.shouldUseDarkColors ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light;
}

function paintWindowBackgrounds() {
  const background = resolveWindowBackground();
  for (const window of BrowserWindow.getAllWindows()) {
    window.setBackgroundColor(background);
  }
}

/**
 * Accepts preference changes from the app's own main frame only (MCP apps run in subframes).
 * @param {(url: string) => boolean} isAllowedAppUrl
 */
function registerThemeSync(isAllowedAppUrl) {
  // Fires for themeSource changes and for OS appearance changes under "system".
  nativeTheme.on("updated", paintWindowBackgrounds);

  ipcMain.on(THEME_PREFERENCE_CHANNEL, (event, themePreference) => {
    const frame = event.senderFrame;
    if (frame == null || frame !== event.sender.mainFrame || !isAllowedAppUrl(frame.url)) {
      return;
    }
    if (!THEME_PREFERENCES.includes(themePreference) || themeStore == null) {
      return;
    }
    if (themeStore.get("themePreference") !== themePreference) {
      themeStore.set("themePreference", themePreference);
    }
    if (nativeTheme.themeSource !== themePreference) {
      nativeTheme.themeSource = themePreference;
      console.log(
        `[electron] Theme ${themePreference} (window background ${resolveWindowBackground()})`,
      );
    }
  });
}

module.exports = {
  registerThemeSync,
  resolveWindowBackground,
  restoreThemePreference,
};
