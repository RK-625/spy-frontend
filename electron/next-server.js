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
// Keep in sync with package.json engines.
const REQUIRED_NODE_MAJOR = 22;

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
  // Login shells and version managers can print banners before the path,
  // so check every line and take the first executable one.
  const lines = String(result.stdout || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return lines.find((line) => isExecutable(line)) ?? null;
}

/**
 * Major version of a node binary, or null when it cannot be determined.
 * @param {string} binary
 * @returns {number | null}
 */
function nodeMajor(binary) {
  try {
    const result = spawnSync(binary, ["--version"], {
      encoding: "utf8",
      timeout: 5_000,
    });
    if (result.error || result.status !== 0) {
      return null;
    }
    const match = /^v(\d+)\./.exec(String(result.stdout || "").trim());
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function resolveNodeBinary() {
  if (process.env.SPY_NODE_BINARY) {
    if (!isExecutable(process.env.SPY_NODE_BINARY)) {
      throw new Error(
        `SPY_NODE_BINARY is not executable: ${process.env.SPY_NODE_BINARY}`,
      );
    }
    const major = nodeMajor(process.env.SPY_NODE_BINARY);
    if (major === null || major < REQUIRED_NODE_MAJOR) {
      throw new Error(
        major === null
          ? `SPY_NODE_BINARY version could not be read: ${process.env.SPY_NODE_BINARY}. Spy requires Node >= ${REQUIRED_NODE_MAJOR}.`
          : `SPY_NODE_BINARY is Node v${major}, but Spy requires Node >= ${REQUIRED_NODE_MAJOR}.`,
      );
    }
    return process.env.SPY_NODE_BINARY;
  }

  // Active PATH first: natives are built with this Node, so spawning any
  // other one risks an ABI mismatch. Homebrew spots are Finder fallbacks.
  // Each candidate must also meet the engines version; rejects are skipped
  // with a warning instead of blocking startup outright.
  const candidates = [];
  const fromPath = commandPath("/bin/sh", ["-c", "command -v node"], 1_000);
  if (fromPath) {
    candidates.push(fromPath);
  }
  for (const candidate of ["/opt/homebrew/bin/node", "/usr/local/bin/node"]) {
    if (isExecutable(candidate)) {
      candidates.push(candidate);
    }
  }

  const { binary, seen } = pickCompatibleNode(candidates);
  if (binary) {
    return binary;
  }

  throw new Error(
    `Could not find node >= ${REQUIRED_NODE_MAJOR}. ` +
      `Set SPY_NODE_BINARY to a compatible node binary.` +
      (seen.length ? ` Found: ${seen.join(", ")}.` : ""),
  );
}

/**
 * First candidate meeting the engines version, warn-skipping the rest.
 * @param {string[]} candidates
 * @returns {{ binary: string | null, seen: string[] }}
 */
function pickCompatibleNode(candidates) {
  const seen = [];
  for (const candidate of candidates) {
    const major = nodeMajor(candidate);
    seen.push(`${candidate} (v${major ?? "unknown"})`);
    if (major !== null && major >= REQUIRED_NODE_MAJOR) {
      return { binary: candidate, seen };
    }
    console.warn(
      `[electron] Skipping node ${candidate}: ` +
        `version v${major ?? "unknown"} does not meet >= ${REQUIRED_NODE_MAJOR}.`,
    );
  }
  return { binary: null, seen };
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
async function stopChild(child) {
  if (!child.pid || !groupAlive(child)) {
    return;
  }

  signalGroup(child, "SIGTERM");

  const start = Date.now();
  while (Date.now() - start < STOP_GRACE_MS) {
    if (!groupAlive(child)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  try {
    signalGroup(child, "SIGKILL");
  } catch {
    // already dead
  }
}

function probeHttp(origin) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(val);
    };

    const req = http.get(origin, { agent: false }, (res) => {
      res.resume();
      done(true);
    });

    req.on("error", () => done(false));

    req.setTimeout(2_000, () => {
      req.destroy();
      done(false);
    });
  });
}

/**
 * @param {import('node:child_process').ChildProcess} child
 * @param {string} origin
 * @param {{ readyLog: boolean, addrInUse: boolean, exitError: Error | null }} state
 */
async function waitForOwnNextReady(child, origin, state) {
  const startedAt = Date.now();

  const checkDead = () => {
    if (state.addrInUse) {
      return new Error(
        `Port already in use at ${origin}. Refusing to attach to a server this process did not start.`,
      );
    }
    if (state.exitError || child.exitCode !== null || child.signalCode !== null) {
      return (
        state.exitError ??
        new Error(`Next exited before it was ready at ${origin}`)
      );
    }
    return null;
  };

  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    const dead = checkDead();
    if (dead) {
      throw dead;
    }

    if (state.readyLog) {
      const accepted = await probeHttp(origin);
      const deadAfter = checkDead();
      if (deadAfter) {
        throw deadAfter;
      }
      if (accepted) {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    state.readyLog
      ? `Next did not accept HTTP at ${origin} within ${READY_TIMEOUT_MS}ms`
      : `Next did not log ready at ${origin} within ${READY_TIMEOUT_MS}ms`,
  );
}

/**
 * Callers must set data env before this. The child inherits process.env at spawn.
 * `onSpawn` runs after the child exists and before the ready wait, so quit can
 * stop a server that is not ready yet.
 * @param {{ mode: 'dev' | 'start', port: number, onSpawn?: (handle: NextServerHandle) => void }} options
 * @returns {Promise<NextServerHandle>}
 */
async function startNextServer(options) {
  const { mode, port, onSpawn } = options;
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
  const handle = {
    child,
    port,
    origin,
    stop: () => stopChild(child),
  };
  onSpawn?.(handle);
  try {
    await waitForOwnNextReady(child, origin, state);
  } catch (error) {
    await stopChild(child);
    throw state.exitError ?? error;
  }

  return handle;
}

module.exports = {
  startNextServer,
  getProjectRoot,
  resolveNextBin,
  resolveWorkingDirectory,
  commandPath,
  resolveNodeBinary,
  nodeMajor,
  pickCompatibleNode,
};
