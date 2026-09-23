/**
 * Desktop data locations under Electron userData.
 * Product code already honors CHATS_DB_PATH and FALKOR_PATH — no Next changes.
 *
 * Existing env wins (e.g. FALKOR_PATH=/tmp/falkor for deep worktrees).
 */
const path = require("node:path");
const { app } = require("electron");

/**
 * @returns {{ CHATS_DB_PATH?: string, FALKOR_PATH?: string, userData: string }}
 */
function resolveElectronDataEnv() {
  const userData = app.getPath("userData");
  /** @type {{ CHATS_DB_PATH?: string, FALKOR_PATH?: string, userData: string }} */
  const resolved = { userData };

  if (!process.env.CHATS_DB_PATH) {
    resolved.CHATS_DB_PATH = path.join(userData, "chats.db");
  }
  if (!process.env.FALKOR_PATH) {
    resolved.FALKOR_PATH = path.join(userData, "falkor");
  }

  return resolved;
}

/**
 * Apply resolved paths onto process.env (and return spawn-ready env slice).
 * @returns {NodeJS.ProcessEnv}
 */
function applyElectronDataEnv() {
  const resolved = resolveElectronDataEnv();
  /** @type {NodeJS.ProcessEnv} */
  const spawnEnv = {};

  if (resolved.CHATS_DB_PATH) {
    process.env.CHATS_DB_PATH = resolved.CHATS_DB_PATH;
    spawnEnv.CHATS_DB_PATH = resolved.CHATS_DB_PATH;
  }
  if (resolved.FALKOR_PATH) {
    process.env.FALKOR_PATH = resolved.FALKOR_PATH;
    spawnEnv.FALKOR_PATH = resolved.FALKOR_PATH;
  }

  console.log(`[electron] userData=${resolved.userData}`);
  console.log(
    `[electron] CHATS_DB_PATH=${process.env.CHATS_DB_PATH ?? "(unset)"}`,
  );
  console.log(
    `[electron] FALKOR_PATH=${process.env.FALKOR_PATH ?? "(unset)"}`,
  );

  return spawnEnv;
}

module.exports = {
  resolveElectronDataEnv,
  applyElectronDataEnv,
};
