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

  // falkordblite writes the socket path into its Redis config unquoted,
  // so whitespace breaks graph operations at runtime. Fail fast instead.
  if (/\s/.test(process.env.FALKOR_PATH)) {
    throw new Error(
      `[electron] FALKOR_PATH contains whitespace, which the embedded graph store cannot use: ${process.env.FALKOR_PATH}. ` +
        `Set FALKOR_PATH to a path without spaces (e.g. /tmp/falkor).`,
    );
  }

  console.log(`[electron] CHATS_DB_PATH=${process.env.CHATS_DB_PATH}`);
  console.log(`[electron] FALKOR_PATH=${process.env.FALKOR_PATH}`);
}

module.exports = {
  applyElectronDataEnv,
};
