/**
 * Env must be set before startNextServer because the child inherits process.env at spawn,
 * and these paths are the same store the web app uses.
 */
const path = require("node:path");
const fs = require("node:fs");
const { app } = require("electron");

function applyElectronDataEnv() {
  const spyDir = path.join(app.getPath("home"), ".spy");

  if (!process.env.CHATS_DB_PATH) {
    process.env.CHATS_DB_PATH = path.join(spyDir, "chats.db");
  }
  if (!process.env.FALKOR_PATH) {
    process.env.FALKOR_PATH = path.join(spyDir, "falkor");
  }

  console.log(`[electron] CHATS_DB_PATH=${process.env.CHATS_DB_PATH}`);
  console.log(`[electron] FALKOR_PATH=${process.env.FALKOR_PATH}`);
}

/** Packaged binaries live outside the app code, alongside their native libraries. */
function applyElectronGraphBinaryEnv() {
  if (!app.isPackaged) return;

  const binaryDir = path.join(process.resourcesPath, "graph-binaries");
  const binaryPaths = {
    SPY_REDIS_SERVER_PATH: path.join(binaryDir, "redis-server"),
    SPY_FALKOR_MODULE_PATH: path.join(binaryDir, "falkordb.so"),
  };
  for (const [name, bundledPath] of Object.entries(binaryPaths)) {
    process.env[name] ??= bundledPath;
    try {
      fs.accessSync(process.env[name], fs.constants.R_OK | fs.constants.X_OK);
    } catch {
      throw new Error(`[electron] Graph binary is missing or inaccessible: ${process.env[name]}. Rebuild Spy with npm run electron:pack.`);
    }
    // Lite emits these paths unquoted into redis.conf.
    if (/\s/.test(process.env[name])) {
      throw new Error(`[electron] ${name} contains whitespace, which the embedded graph store cannot use: ${process.env[name]}. Move Spy to a path without spaces.`);
    }
  }
}

/**
 * falkordblite writes the socket path into its Redis config unquoted,
 * so whitespace breaks graph operations at runtime. Call only when this
 * process spawns Next: window-only launches never start the graph store.
 */
function assertFalkorPath() {
  if (/\s/.test(process.env.FALKOR_PATH ?? "")) {
    throw new Error(
      `[electron] FALKOR_PATH contains whitespace, which the embedded graph store cannot use: ${process.env.FALKOR_PATH}. ` +
        `Set FALKOR_PATH to a path without spaces (e.g. /tmp/falkor).`,
    );
  }
}

module.exports = {
  applyElectronDataEnv,
  applyElectronGraphBinaryEnv,
  assertFalkorPath,
};
