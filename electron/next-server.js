/**
 * Spawn, wait-for-ready, and shut down the Next.js server as an Electron child.
 * Uses system `node` on PATH (not Electron's binary) so Next/native modules work.
 */
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const PROJECT_ROOT = path.join(__dirname, "..");

/**
 * @typedef {object} NextServerHandle
 * @property {import('node:child_process').ChildProcess} child
 * @property {number} port
 * @property {string} origin
 * @property {() => Promise<void>} stop
 */

/**
 * HTTP probe until Next accepts connections (any status = ready enough to load).
 * @param {string} origin
 * @param {{ timeoutMs?: number, intervalMs?: number }} [options]
 * @returns {Promise<void>}
 */
function waitForNextReady(origin, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 400;
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(origin, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(
            new Error(
              `Next did not become ready at ${origin} within ${timeoutMs}ms`,
            ),
          );
          return;
        }
        setTimeout(attempt, intervalMs);
      });
      req.setTimeout(2_000, () => {
        req.destroy();
      });
    };
    attempt();
  });
}

/**
 * @param {{ mode: 'dev' | 'start', port: number, env?: NodeJS.ProcessEnv }} options
 * @returns {Promise<NextServerHandle>}
 */
async function startNextServer(options) {
  const { mode, port, env: extraEnv = {} } = options;
  const nextBin = require.resolve("next/dist/bin/next");
  const args =
    mode === "dev"
      ? ["dev", "--port", String(port)]
      : ["start", "--port", String(port)];

  const child = spawn("node", [nextBin, ...args], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      ...extraEnv,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[next] ${chunk}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[next] ${chunk}`);
  });

  let exitError = null;
  child.once("exit", (code, signal) => {
    if (code && code !== 0) {
      exitError = new Error(
        `Next exited early (code=${code}, signal=${signal})`,
      );
    }
  });
  child.once("error", (error) => {
    exitError = error;
  });

  const origin = `http://localhost:${port}`;

  try {
    await waitForNextReady(origin);
  } catch (error) {
    await stopChild(child);
    throw exitError ?? error;
  }

  if (exitError) {
    throw exitError;
  }

  return {
    child,
    port,
    origin,
    stop: () => stopChild(child),
  };
}

/**
 * @param {import('node:child_process').ChildProcess} child
 * @returns {Promise<void>}
 */
function stopChild(child) {
  return new Promise((resolve) => {
    if (!child.pid || child.killed || child.exitCode !== null) {
      resolve();
      return;
    }

    const finish = () => resolve();
    child.once("exit", finish);

    try {
      child.kill("SIGTERM");
    } catch {
      resolve();
      return;
    }

    const forceTimer = setTimeout(() => {
      try {
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      } catch {
        // ignore
      }
      resolve();
    }, 5_000);

    child.once("exit", () => clearTimeout(forceTimer));
  });
}

module.exports = {
  startNextServer,
  waitForNextReady,
  PROJECT_ROOT,
};
