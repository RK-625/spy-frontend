/**
 * Electron main process — thin shell around the Spy Next.js app.
 * Sprint 1: open a BrowserWindow pointed at a running Next server.
 *
 * Dev (Next already running):
 *   npm run dev   # terminal 1
 *   npm run electron   # terminal 2
 *
 * Later sprints start/stop Next from this process.
 */
const { app, BrowserWindow } = require("electron");

/** Default Next origin; override with SPY_ELECTRON_URL. */
const NEXT_ORIGIN = process.env.SPY_ELECTRON_URL ?? "http://localhost:3000";

/**
 * @returns {import('electron').BrowserWindow}
 */
function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "Spy",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.loadURL(NEXT_ORIGIN).catch((error) => {
    console.error(
      `[electron] Failed to load ${NEXT_ORIGIN}. Is Next running?`,
      error,
    );
  });

  return mainWindow;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
