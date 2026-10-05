import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureDirectory = mkdtempSync("/private/tmp/spy-graph-wiring-");
const resourcesDirectory = join(fixtureDirectory, "Resources");
const { load } = require("js-yaml");
const configuration = load(readFileSync(join(projectRoot, "electron-builder.yml"), "utf8"));
const resource = configuration.extraResources.find((entry) => entry.to === "graph-binaries");
assert.ok(resource, "Electron must include the staged graph resource directory");

// Supply a packaged Electron context while keeping the real path resolver and backend.
const Module = require("node:module");
const originalLoad = Module._load;
const originalResourcesPath = process.resourcesPath;
const environmentNames = ["SPY_REDIS_SERVER_PATH", "SPY_FALKOR_MODULE_PATH", "FALKOR_PATH", "CHATS_DB_PATH"];
const originalEnvironment = Object.fromEntries(environmentNames.map((name) => [name, process.env[name]]));

try {
  cpSync(join(projectRoot, resource.from), join(resourcesDirectory, resource.to), { recursive: true });
  process.resourcesPath = resourcesDirectory;
  for (const name of environmentNames) delete process.env[name];
  Module._load = function (request, ...args) {
    if (request === "electron") return { app: { isPackaged: true, getPath: () => fixtureDirectory } };
    return originalLoad.call(this, request, ...args);
  };
  const { applyElectronDataEnv, applyElectronGraphBinaryEnv } = require(join(projectRoot, "electron/data-paths.js"));
  Module._load = originalLoad;
  applyElectronDataEnv();
  applyElectronGraphBinaryEnv();
  assert.equal(process.env.SPY_REDIS_SERVER_PATH, join(resourcesDirectory, resource.to, "redis-server"));
  assert.equal(process.env.SPY_FALKOR_MODULE_PATH, join(resourcesDirectory, resource.to, "falkordb.so"));

  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", `
    const assert = require('node:assert/strict');
    const { getDb } = require('./src/lib/graph/falkor.ts');
    (async () => {
      try {
        const graph = await getDb();
        await graph.query("CREATE (:Memory {name: 'packaging probe'})");
        const result = await graph.query('MATCH (m:Memory) RETURN m.name AS name');
        assert.equal(result.data[0].name, 'packaging probe');
        console.log('PASS: packaged resource paths reach the real graph backend; query and vector-index initialization succeed.');
      } finally {
        if (globalThis.__spyFalkor?.client) await globalThis.__spyFalkor.client.close();
      }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `], {
    cwd: projectRoot,
    env: { ...process.env, PATH: "/usr/bin:/bin:/usr/sbin:/sbin" },
    encoding: "utf8",
    timeout: 30_000,
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "The actual graph backend must work with the bundled resource paths");
} finally {
  Module._load = originalLoad;
  process.resourcesPath = originalResourcesPath;
  for (const name of environmentNames) {
    if (originalEnvironment[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnvironment[name];
  }
  rmSync(fixtureDirectory, { recursive: true, force: true });
}
