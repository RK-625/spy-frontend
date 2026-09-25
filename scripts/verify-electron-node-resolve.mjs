#!/usr/bin/env node
/**
 * Verifies Electron node selection (version-gated, banner-tolerant).
 * - commandPath skips login-shell banners, taking the first executable line.
 * - pickCompatibleNode returns the first candidate on Node >= 22.
 * - resolveNodeBinary honors SPY_NODE_BINARY and rejects old pinned binaries.
 * Run: node scripts/verify-electron-node-resolve.mjs
 */
import { strict as assert } from "node:assert";
import { chmodSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");

const OLD_NODE = join(tmpdir(), "spy-verify-old-node");
const GOOD_NODE = join(tmpdir(), "spy-verify-good-node");
for (const file of [OLD_NODE, GOOD_NODE]) {
  writeFileSync(file, "#!/bin/sh\n");
  chmodSync(file, 0o755);
}

const VERSIONS = { [OLD_NODE]: "v20.11.0\n", [GOOD_NODE]: "v22.5.0\n" };

const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "node:child_process") {
    const real = origLoad.call(this, request, ...rest);
    return {
      ...real,
      spawnSync: (binary, args) => {
        if (binary === "/bin/sh") {
          // Banner first; GOOD_NODE is a real executable temp file so the
          // isExecutable check passes honestly.
          return { stdout: `fnm banner line\n${GOOD_NODE}\n`, status: 0 };
        }
        if (args?.[0] === "--version" && VERSIONS[binary]) {
          return { stdout: VERSIONS[binary], status: 0 };
        }
        return { stdout: "", status: 1 };
      },
    };
  }
  return origLoad.call(this, request, ...rest);
};

const {
  commandPath,
  nodeMajor,
  pickCompatibleNode,
  resolveNodeBinary,
} = require("../electron/next-server.js");

// Quiet the expected skip warnings; failures still throw.
console.warn = () => {};

// Banner lines are skipped, first executable line wins.
assert.equal(
  commandPath("/bin/sh", ["-c", "command -v node"], 1_000),
  GOOD_NODE,
);

// Version parsing.
assert.equal(nodeMajor(GOOD_NODE), 22);
assert.equal(nodeMajor(OLD_NODE), 20);
assert.equal(nodeMajor("/tmp/does-not-exist"), null);

// First compatible candidate wins; all-old yields null.
assert.equal(pickCompatibleNode([OLD_NODE, GOOD_NODE]).binary, GOOD_NODE);
assert.equal(pickCompatibleNode([OLD_NODE]).binary, null);
assert.equal(pickCompatibleNode([]).binary, null);

// Explicit override: good binary returned, old binary rejected spelled out.
process.env.SPY_NODE_BINARY = GOOD_NODE;
assert.equal(resolveNodeBinary(), GOOD_NODE);
process.env.SPY_NODE_BINARY = OLD_NODE;
assert.throws(() => resolveNodeBinary(), /requires Node >= 22/);
delete process.env.SPY_NODE_BINARY;

console.log("verify-electron-node-resolve: PASS");
