/**
 * Packaged Finder launches do not see the repo `.env`.
 * Load a user file without overriding variables already set, and never log values.
 * Must run before startNextServer so the Next child inherits the keys.
 */
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  const body = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length).trim()
    : trimmed;
  const eq = body.indexOf("=");
  if (eq <= 0) {
    return null;
  }
  const key = body.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }
  let value = body.slice(eq + 1).trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function applyEnvText(text) {
  let applied = 0;
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
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
