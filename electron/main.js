const { app, BrowserWindow, shell } = require("electron");

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
    nextServer = await startNextServer({
      mode: NEXT_MODE,
      port: PORT,
    });
    console.log(`[electron] Next ready at ${nextServer.origin}`);
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
