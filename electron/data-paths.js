/**
 * Desktop data locations under Electron userData.
 * Product code already honors CHATS_DB_PATH and FALKOR_PATH — no Next changes.
 *
 * Existing env wins (e.g. FALKOR_PATH=/tmp/falkor for deep worktrees).
 */
const path = require("node:path");
const { app } = require("electron");

const DEFAULT_PATHS = {
  CHATS_DB_PATH: "chats.db",
  FALKOR_PATH: "falkor",
};

/**
 * Apply resolved data paths directly onto process.env.
 * Inherited automatically by child processes.
 */
function applyElectronDataEnv() {
  const userData = app.getPath("userData");
  console.log(`[electron] userData=${userData}`);

  for (const [key, subPath] of Object.entries(DEFAULT_PATHS)) {
    process.env[key] = process.env[key] || path.join(userData, subPath);
    console.log(`[electron] ${key}=${process.env[key]}`);
  }
}

module.exports = {
  applyElectronDataEnv,
};
