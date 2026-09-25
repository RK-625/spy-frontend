const { app, BrowserWindow, dialog, shell } = require("electron");

app.setName("Spy");
const { startNextServer } = require("./next-server");
const { applyElectronDataEnv, assertFalkorPath } = require("./data-paths");
const { loadUserEnv } = require("./user-env");
const { installApplicationMenu } = require("./menu");

function resolveNextMode() {
  const fromEnv = process.env.SPY_NEXT_MODE;
  if (fromEnv === "dev" || fromEnv === "start") {
    return fromEnv;
  }
  if (app.isPackaged) {
    return "start";
  }
  return undefined;
}

let PORT = null;
let START_PATH = null;
let NEXT_MODE = null;

/** @type {import('./next-server').NextServerHandle | null} */
let nextServer = null;
/** @type {"idle" | "stopping" | "done"} */
let quitState = "idle";

function isAllowedAppUrl(url) {
  try {
    const { origin, protocol } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") {
      return false;
    }
    const localOrigin = nextServer?.origin ?? `http://localhost:${PORT}`;
    if (origin === localOrigin) {
      return true;
    }
    if (process.env.SPY_ELECTRON_URL) {
      try {
        return origin === new URL(process.env.SPY_ELECTRON_URL).origin;
      } catch {
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function openExternalHttp(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return;
  }
  shell.openExternal(url).catch((error) => {
    console.error("[electron] openExternal failed:", error);
  });
}

function resolveLoadUrl() {
  if (process.env.SPY_ELECTRON_URL) {
    return process.env.SPY_ELECTRON_URL;
  }
  const origin = nextServer?.origin ?? `http://localhost:${PORT}`;
  const pathPart = START_PATH.startsWith("/") ? START_PATH : `/${START_PATH}`;
  return `${origin}${pathPart}`;
}

function attachNavigationGuards(mainWindow) {
  const contents = mainWindow.webContents;

  contents.setWindowOpenHandler(({ url }) => {
    openExternalHttp(url);
    return { action: "deny" };
  });

  const guardNavigation = (event, url) => {
    if (isAllowedAppUrl(url)) {
      return;
    }
    event.preventDefault();
    openExternalHttp(url);
  };

  contents.on("will-navigate", guardNavigation);
  contents.on("will-redirect", guardNavigation);

  // will-navigate is main-frame only. MCP app iframes run third-party HTML,
  // so subframes stay on the app origin or inline docs. Blocked silently:
  // a frame navigating itself is not a user click.
  contents.on("will-frame-navigate", (event) => {
    if (event.isMainFrame) {
      return;
    }
    if (event.url === "about:blank" || event.url === "about:srcdoc") {
      return;
    }
    if (isAllowedAppUrl(event.url)) {
      return;
    }
    console.warn(`[electron] Blocked subframe navigation to ${event.url}`);
    event.preventDefault();
  });
}

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

  attachNavigationGuards(mainWindow);

  // A failed load never fires ready-to-show, and macOS keeps the app alive
  // with no windows. Report it and quit instead of idling hidden.
  // -3 is ERR_ABORTED: a cancelled navigation, not a failure.
  let reportedLoadFailure = false;
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3 || reportedLoadFailure) {
        return;
      }
      if (quitState !== "idle") {
        return;
      }
      reportedLoadFailure = true;
      console.error(
        `[electron] Main frame failed to load ${validatedURL}: ${errorDescription} (${errorCode})`,
      );
      dialog.showErrorBox(
        "Spy couldn't load",
        `${validatedURL}\n${errorDescription} (${errorCode})\n\nIs Next running?`,
      );
      app.quit();
    },
  );

  const loadUrl = resolveLoadUrl();
  mainWindow.loadURL(loadUrl).catch((error) => {
    console.error(
      `[electron] Failed to load ${loadUrl}. Is Next running?`,
      error,
    );
  });

  return mainWindow;
}

function destroyWindows() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.destroy();
  }
}

async function bootstrap() {
  installApplicationMenu();

  // User env, then data paths, both before startNextServer.
  // The child inherits process.env at spawn; already-set vars win.
  loadUserEnv();
  applyElectronDataEnv();
  PORT = Number(process.env.SPY_ELECTRON_PORT ?? 3000);
  START_PATH = process.env.SPY_ELECTRON_PATH ?? "/chat";
  NEXT_MODE = resolveNextMode();
  if (NEXT_MODE === "dev" || NEXT_MODE === "start") {
    assertFalkorPath();
    console.log(`[electron] Starting Next (${NEXT_MODE}) on port ${PORT}…`);
    const started = await startNextServer({
      mode: NEXT_MODE,
      port: PORT,
      onSpawn(spawned) {
        if (quitState !== "idle") {
          void spawned.stop();
          return;
        }
        nextServer = spawned;
      },
    });
    if (quitState !== "idle") {
      return;
    }
    nextServer = started;
    console.log(`[electron] Next ready at ${nextServer.origin}`);
  }

  if (quitState !== "idle") {
    return;
  }

  createMainWindow();

  app.on("activate", () => {
    if (quitState !== "idle") {
      return;
    }
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

app.whenReady().then(() => {
  bootstrap().catch((error) => {
    console.error("[electron] Bootstrap failed:", error);
    // Finder launches have no terminal; the log alone is invisible.
    if (quitState === "idle") {
      const message = error instanceof Error ? error.message : String(error);
      dialog.showErrorBox("Spy couldn't start", message);
    }
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (quitState === "done") {
    return;
  }
  if (quitState === "stopping") {
    event.preventDefault();
    return;
  }
  // Window-only mode, or spawn has not returned a child yet.
  if (!nextServer) {
    quitState = "done";
    return;
  }

  quitState = "stopping";
  event.preventDefault();
  destroyWindows();
  const handle = nextServer;
  nextServer = null;
  handle
    .stop()
    .catch((error) => {
      console.error("[electron] Failed to stop Next:", error);
    })
    .finally(() => {
      quitState = "done";
      app.quit();
    });
});
