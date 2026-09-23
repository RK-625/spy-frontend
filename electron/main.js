/**
 * Electron main process — thin shell around the Spy Next.js app.
 *
 * Modes:
 * - SPY_NEXT_MODE=dev|start → spawn Next, wait ready, load /chat, kill on quit
 * - unset → assume Next is already running (Sprint 1 launcher behavior)
 *
 * Env:
 * - SPY_ELECTRON_PORT (default 3000)
 * - SPY_ELECTRON_PATH (default /chat)
 * - SPY_ELECTRON_URL  (full URL override; skips path join)
 */
const { app, BrowserWindow } = require("electron");
const { startNextServer } = require("./next-server");

const PORT = Number(process.env.SPY_ELECTRON_PORT ?? 3000);
const START_PATH = process.env.SPY_ELECTRON_PATH ?? "/chat";
const NEXT_MODE = process.env.SPY_NEXT_MODE; // 'dev' | 'start' | undefined

/** @type {import('./next-server').NextServerHandle | null} */
let nextServer = null;
let isShuttingDown = false;

/**
 * @returns {string}
 */
function resolveLoadUrl() {
  if (process.env.SPY_ELECTRON_URL) {
    return process.env.SPY_ELECTRON_URL;
  }
  const origin = nextServer?.origin ?? `http://localhost:${PORT}`;
  const pathPart = START_PATH.startsWith("/") ? START_PATH : `/${START_PATH}`;
  return `${origin}${pathPart}`;
}

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

  const loadUrl = resolveLoadUrl();
  mainWindow.loadURL(loadUrl).catch((error) => {
    console.error(
      `[electron] Failed to load ${loadUrl}. Is Next running?`,
      error,
    );
  });

  return mainWindow;
}

async function bootstrap() {
  if (NEXT_MODE === "dev" || NEXT_MODE === "start") {
    console.log(`[electron] Starting Next (${NEXT_MODE}) on port ${PORT}…`);
    nextServer = await startNextServer({
      mode: NEXT_MODE,
      port: PORT,
    });
    console.log(`[electron] Next ready at ${nextServer.origin}`);
  }

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

app.whenReady().then(() => {
  bootstrap().catch((error) => {
    console.error("[electron] Bootstrap failed:", error);
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (isShuttingDown || !nextServer) {
    return;
  }
  isShuttingDown = true;
  event.preventDefault();
  const handle = nextServer;
  nextServer = null;
  handle
    .stop()
    .catch((error) => {
      console.error("[electron] Failed to stop Next:", error);
    })
    .finally(() => {
      app.quit();
    });
});
