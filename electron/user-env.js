/**
 * Packaged Finder launches do not see the repo `.env`.
 * Load a user file without overriding variables already set, and never log values.
 * Must run before startNextServer so the Next child inherits the keys.
 */
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");
const dotenv = require("dotenv");

function applyEnvText(text) {
  const parsed = dotenv.parse(text);
  let applied = 0;
  for (const [key, value] of Object.entries(parsed)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
      applied += 1;
    }
  }
  return applied;
}

function resolveUserEnvPath() {
  if (process.env.SPY_ENV_FILE) {
    return process.env.SPY_ENV_FILE;
  }
  return path.join(app.getPath("home"), ".spy", ".env");
}

function loadUserEnv() {
  const filePath = resolveUserEnvPath();
  if (!fs.existsSync(filePath)) {
    console.log(`[electron] No user env file at ${filePath} (optional)`);
    return;
  }
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read user env file ${filePath}: ${message}`);
  }
  const applied = applyEnvText(text);
  console.log(
    `[electron] Applied ${applied} unset vars from user env file (values not logged)`,
  );
}

module.exports = {
  loadUserEnv,
};
