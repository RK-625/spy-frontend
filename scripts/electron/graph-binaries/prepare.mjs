import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const outputDirectory = join(projectRoot, "build/graph-binaries/darwin-arm64");
const cacheDirectory = join(projectRoot, "node_modules/.cache/spy-graph-binaries");
const bottles = JSON.parse(await readFile(new URL("./bottles.json", import.meta.url), "utf8"));
const falkorModule = {
  version: "4.18.3",
  url: "https://github.com/FalkorDB/FalkorDB/releases/download/v4.18.3/falkordb-macos-arm64v8.so",
  sha256: "53aa98e66dc52cf4d95628d1144ab4f3233cadf951faf81e76d5a7c44483541a",
};

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

async function fetchResponse(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return response;
}

async function downloadBottle(bottle) {
  const archivePath = join(cacheDirectory, `${bottle.sha256}.tar.gz`);
  let archive;
  try {
    archive = await readFile(archivePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const tokenUrl = new URL("https://ghcr.io/token");
    tokenUrl.searchParams.set("service", "ghcr.io");
    tokenUrl.searchParams.set("scope", `repository:${bottle.repository}:pull`);
    const { token } = await (await fetchResponse(tokenUrl)).json();
    if (typeof token !== "string") throw new Error("Registry returned no download token");
    const response = await fetchResponse(
      `https://ghcr.io/v2/${bottle.repository}/blobs/sha256:${bottle.sha256}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    archive = Buffer.from(await response.arrayBuffer());
  }
  const checksum = createHash("sha256").update(archive).digest("hex");
  if (checksum !== bottle.sha256) throw new Error(`Checksum mismatch for ${bottle.name}`);
  await writeFile(archivePath, archive);
  return archivePath;
}

async function stageBottle(bottle, stagingDirectory) {
  console.log(`Staging ${bottle.name} ${bottle.version} (macOS Sequoia ARM64 bottle)`);
  const archivePath = await downloadBottle(bottle);
  const extractionDirectory = await mkdtemp(join(tmpdir(), "spy-bottle-"));
  try {
    run("/usr/bin/tar", ["-xzf", archivePath, "-C", extractionDirectory]);
    const bottleRoot = join(extractionDirectory, bottle.name, bottle.version);
    for (const library of bottle.libraries) {
      await copyFile(join(bottleRoot, "lib", library), join(stagingDirectory, library));
    }
    for (const executable of bottle.executables ?? []) {
      await copyFile(join(bottleRoot, "bin", executable), join(stagingDirectory, executable));
    }
    const licenseDirectory = join(stagingDirectory, "licenses", bottle.name);
    await mkdir(licenseDirectory, { recursive: true });
    const files = await readdir(bottleRoot);
    const licenseFiles = files.filter((name) => /^(LICENSE|COPYING|NOTICE)/i.test(name));
    if (licenseFiles.length === 0) throw new Error(`No license notice found for ${bottle.name}`);
    for (const license of licenseFiles) {
      await copyFile(join(bottleRoot, license), join(licenseDirectory, license));
    }
  } finally {
    await rm(extractionDirectory, { recursive: true, force: true });
  }
}

async function stageFalkorModule(stagingDirectory) {
  const cachePath = join(cacheDirectory, `${falkorModule.sha256}.so`);
  let binary;
  try {
    binary = await readFile(cachePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    binary = Buffer.from(await (await fetchResponse(falkorModule.url)).arrayBuffer());
  }
  if (createHash("sha256").update(binary).digest("hex") !== falkorModule.sha256) {
    throw new Error("Checksum mismatch for FalkorDB module");
  }
  await writeFile(cachePath, binary);
  const modulePath = join(stagingDirectory, "falkordb.so");
  await writeFile(modulePath, binary);
  await chmod(modulePath, 0o755);
}

function linkedLibraries(binaryPath) {
  return run("/usr/bin/otool", ["-L", binaryPath]).split("\n").slice(1)
    .map((line) => line.trim().split(" (compatibility version")[0]);
}

async function relocateLibraries(stagingDirectory) {
  const files = await readdir(stagingDirectory);
  const binaryNames = files.filter((name) => name.endsWith(".dylib") || name.endsWith(".so") || name === "redis-server");
  for (const name of binaryNames) {
    const binaryPath = join(stagingDirectory, name);
    if (run("/usr/bin/lipo", ["-archs", binaryPath]) !== "arm64") {
      throw new Error(`Expected an ARM64 binary: ${name}`);
    }
    // Only staged copies are modified; npm dependencies remain untouched.
    if (name.endsWith(".dylib") || name.endsWith(".so")) {
      run("/usr/bin/install_name_tool", ["-id", `@loader_path/${name}`, binaryPath]);
    }
    for (const dependency of linkedLibraries(binaryPath)) {
      const dependencyName = basename(dependency);
      if (binaryNames.includes(dependencyName)) {
        run("/usr/bin/install_name_tool", ["-change", dependency, `@loader_path/${dependencyName}`, binaryPath]);
      } else if (!dependency.startsWith("/usr/lib/") && !dependency.startsWith("/System/Library/")) {
        throw new Error(`Unbundled native dependency in ${name}: ${dependency}`);
      }
    }
    run("/usr/bin/codesign", ["--force", "--sign", "-", binaryPath]);
    run("/usr/bin/codesign", ["--verify", binaryPath]);
  }
}

async function prepareGraphBinaries() {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("Graph binary preparation currently supports macOS ARM64 only");
  }
  const majorVersion = Number(run("/usr/bin/sw_vers", ["-productVersion"]).split(".")[0]);
  if (majorVersion < 15) throw new Error("These pinned native libraries require macOS 15 or newer");
  await mkdir(cacheDirectory, { recursive: true });
  await mkdir(dirname(outputDirectory), { recursive: true });
  const stagingDirectory = await mkdtemp(join(dirname(outputDirectory), "staging-"));
  try {
    await stageFalkorModule(stagingDirectory);
    for (const bottle of bottles) await stageBottle(bottle, stagingDirectory);
    await relocateLibraries(stagingDirectory);
    await writeFile(join(stagingDirectory, "sources.json"), JSON.stringify({
      platform: "darwin-arm64", minimumMacOS: "15.0", bottles, falkorModule,
    }, null, 2) + "\n");
    await rm(outputDirectory, { recursive: true, force: true });
    await mkdir(outputDirectory, { recursive: true });
    // cp preserves the staged license directory and executable permissions.
    run("/bin/cp", ["-R", `${stagingDirectory}/.`, outputDirectory]);
    console.log(`Graph binaries prepared at ${outputDirectory}`);
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
}

await prepareGraphBinaries();
