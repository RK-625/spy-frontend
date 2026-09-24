/**
 * Env must be set before startNextServer because the child inherits process.env at spawn,
 * and these paths are the same store the web app uses.
 */
const path = require("node:path");
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

module.exports = {
  applyElectronDataEnv,
};
