/**
 * Spawn Next with system node (not Electron's binary) so native modules match
 * the Node ABI. The child is its own process group and is not unref'd: quit
 * signals the group, which is what reaps embedded redis.
 * Ready means this child's log said so and it is still alive. An HTTP response
 * from some other server on the port is not ready.
 */
const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const READY_TIMEOUT_MS = 120_000;
const STOP_GRACE_MS = 5_000;

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandPath(command, args, timeout) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout,
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    return null;
  }
  const line = String(result.stdout || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean);
  return line && isExecutable(line) ? line : null;
}

function resolveNodeBinary() {
  if (process.env.SPY_NODE_BINARY) {
    if (!isExecutable(process.env.SPY_NODE_BINARY)) {
      throw new Error(
        `SPY_NODE_BINARY is not executable: ${process.env.SPY_NODE_BINARY}`,
      );
    }
    return process.env.SPY_NODE_BINARY;
  }

  const fromPath = commandPath("/bin/sh", ["-c", "command -v node"], 2_000);
  if (fromPath) {
    return fromPath;
  }

  const fromLogin = commandPath(
    "/bin/zsh",
    ["-lic", "command -v node"],
    5_000,
  );
  if (fromLogin) {
    return fromLogin;
  }

  for (const candidate of ["/opt/homebrew/bin/node", "/usr/local/bin/node"]) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Could not find node. Set SPY_NODE_BINARY to an executable node binary.",
  );
}

function getProjectRoot() {
  try {
    const { app } = require("electron");
    if (app?.isPackaged) {
      return app.getAppPath();
    }
  } catch {
    // Plain node (syntax checks) has no electron module.
  }
  return path.join(__dirname, "..");
}

function resolveWorkingDirectory(projectRoot) {
  // System node cannot use a cwd inside an asar archive.
  if (projectRoot.endsWith(".asar")) {
    const unpacked = projectRoot.replace(/\.asar$/i, ".asar.unpacked");
    if (fs.existsSync(unpacked)) {
      return unpacked;
    }
  }
  return projectRoot;
}

function resolveNextBin(projectRoot) {
  const relativeNext = path.join("node_modules", "next", "dist", "bin", "next");
  const candidates = [
    path.join(resolveWorkingDirectory(projectRoot), relativeNext),
    path.join(projectRoot, relativeNext),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return require.resolve("next/dist/bin/next");
}

/**
 * @typedef {object} NextServerHandle
 * @property {import('node:child_process').ChildProcess} child
 * @property {number} port
 * @property {string} origin
 * @property {() => Promise<void>} stop
 */

function signalGroup(child, signal) {
  if (!child.pid) {
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error && error.code === "ESRCH") {
      return;
    }
    try {
      child.kill(signal);
    } catch (inner) {
      if (!inner || inner.code !== "ESRCH") {
        throw inner;
      }
    }
  }
}

function groupAlive(child) {
  if (!child.pid) {
    return false;
  }
  try {
    process.kill(-child.pid, 0);
    return true;
  } catch (error) {
    return !(error && error.code === "ESRCH");
  }
}

/**
 * SIGTERM the process group, then SIGKILL it if it is still alive after 5s.
 * ESRCH is success. The direct child exiting is not enough: redis may remain.
 * @param {import('node:child_process').ChildProcess} child
 * @returns {Promise<void>}
 */
function stopChild(child) {
  return new Promise((resolve) => {
    if (!child.pid || !groupAlive(child)) {
      resolve();
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled && groupAlive(child)) {
        try {
          signalGroup(child, "SIGKILL");
        } catch {
          // already gone
        }
      }
      settled = true;
      resolve();
    }, STOP_GRACE_MS);

    const finishIfGone = () => {
      if (settled || groupAlive(child)) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve();
    };

    child.once("exit", finishIfGone);
    try {
      signalGroup(child, "SIGTERM");
    } catch {
      settled = true;
      clearTimeout(timer);
      resolve();
      return;
    }
    finishIfGone();
  });
}

function childIsDead(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

/**
 * @param {import('node:child_process').ChildProcess} child
 * @param {string} origin
 * @param {{ readyLog: boolean, addrInUse: boolean, exitError: Error | null }} state
 */
function waitForOwnNextReady(child, origin, state) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;

    const finish = (fn, value) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      fn(value);
    };

    const deadError = () => {
      if (state.addrInUse) {
        return new Error(
          `Port already in use at ${origin}. Refusing to attach to a server this process did not start.`,
        );
      }
      if (state.exitError || childIsDead(child)) {
        return (
          state.exitError ??
          new Error(`Next exited before it was ready at ${origin}`)
        );
      }
      return null;
    };

    const tick = () => {
      const dead = deadError();
      if (dead) {
        finish(reject, dead);
        return;
      }
      if (!state.readyLog) {
        if (Date.now() - startedAt >= READY_TIMEOUT_MS) {
          finish(
            reject,
            new Error(`Next did not log ready at ${origin} within ${READY_TIMEOUT_MS}ms`),
          );
          return;
        }
        timer = setTimeout(tick, 200);
        return;
      }

      const req = http.get(origin, (res) => {
        res.resume();
        const after = deadError();
        if (after) {
          finish(reject, after);
          return;
        }
        finish(resolve, undefined);
      });
      req.on("error", () => {
        const after = deadError();
        if (after) {
          finish(reject, after);
          return;
        }
        if (Date.now() - startedAt >= READY_TIMEOUT_MS) {
          finish(
            reject,
            new Error(
              `Next did not accept HTTP at ${origin} within ${READY_TIMEOUT_MS}ms`,
            ),
          );
          return;
        }
        timer = setTimeout(tick, 200);
      });
      req.setTimeout(2_000, () => {
        req.destroy();
      });
    };

    tick();
  });
}

/**
 * Callers must set data env before this. The child inherits process.env at spawn.
 * @param {{ mode: 'dev' | 'start', port: number }} options
 * @returns {Promise<NextServerHandle>}
 */
async function startNextServer(options) {
  const { mode, port } = options;
  const projectRoot = getProjectRoot();
  const cwd = resolveWorkingDirectory(projectRoot);
  const nextBin = resolveNextBin(projectRoot);
  const nodeBinary = resolveNodeBinary();
  const args =
    mode === "dev"
      ? ["dev", "--port", String(port)]
      : ["start", "--port", String(port)];

  console.log(
    `[electron] Spawning ${nodeBinary} ${path.basename(nextBin)} ${args.join(" ")}`,
  );

  const child = spawn(nodeBinary, [nextBin, ...args], {
    cwd,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  const state = {
    exitError: null,
    readyLog: false,
    addrInUse: false,
    tail: "",
  };

  const note = (chunk) => {
    const text = String(chunk);
    state.tail = (state.tail + text).slice(-160);
    if (/\bready\b/i.test(state.tail) || /started server/i.test(state.tail)) {
      state.readyLog = true;
    }
    if (/EADDRINUSE/i.test(text)) {
      state.addrInUse = true;
      if (!state.exitError) {
        state.exitError = new Error(
          "Next reported EADDRINUSE. Refusing to attach to a server this process did not start.",
        );
      }
    }
  };

  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[next] ${chunk}`);
    note(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[next] ${chunk}`);
    note(chunk);
  });
  child.once("error", (error) => {
    state.exitError = error;
  });
  child.once("exit", (code, signal) => {
    if (!state.exitError && (code || signal)) {
      state.exitError = new Error(`Next exited (code=${code}, signal=${signal})`);
    }
  });

  const origin = `http://localhost:${port}`;
  try {
    await waitForOwnNextReady(child, origin, state);
  } catch (error) {
    await stopChild(child);
    throw state.exitError ?? error;
  }

  if (state.exitError || state.addrInUse || childIsDead(child)) {
    await stopChild(child);
    throw (
      state.exitError ??
      new Error("Next exited before the window opened")
    );
  }

  return {
    child,
    port,
    origin,
    stop: () => stopChild(child),
  };
}

module.exports = {
  startNextServer,
  getProjectRoot,
  resolveNextBin,
  resolveWorkingDirectory,
};
