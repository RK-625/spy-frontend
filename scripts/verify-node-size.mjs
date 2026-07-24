/**
 * verify-node-size.mjs — rank × zoom screen radius formula (no Pixi Application).
 *
 * Run: npm run verify:node-size
 *   → npx tsx scripts/verify-node-size.mjs
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed += 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

async function main() {
  const url = pathToFileURL(
    path.join(root, "src/lib/graph/pixi-renderer.ts")
  ).href;
  const mod = await import(url);
  const { nodeScreenRadius } = mod;

  const MIN = 2;
  const MAX = 28;

  const r0z1 = nodeScreenRadius(0, 1);
  const r2z1 = nodeScreenRadius(2, 1);
  const r0z2 = nodeScreenRadius(0, 2);
  const r0zTiny = nodeScreenRadius(0, 0.1);
  const r0zHuge = nodeScreenRadius(0, 1e6);

  assert(r0z1 > r2z1, `rank 0 zoom 1 > rank 2 zoom 1 (${r0z1} > ${r2z1})`);
  assert(r0z2 > r0z1, `rank 0 zoom 2 > rank 0 zoom 1 (${r0z2} > ${r0z1})`);
  assert(r0zTiny >= MIN, `tiny zoom still >= MIN (${r0zTiny} >= ${MIN})`);
  assert(r0zHuge <= MAX, `huge zoom still <= MAX (${r0zHuge} <= ${MAX})`);

  // At zoom 1, root is BASE (8) before clamp
  assert(Math.abs(r0z1 - 8) < 1e-9, `rank 0 zoom 1 ≈ 8 (got ${r0z1})`);
  // rank 2: 8 * 0.75^2 = 4.5
  assert(Math.abs(r2z1 - 4.5) < 1e-9, `rank 2 zoom 1 ≈ 4.5 (got ${r2z1})`);

  // Non-finite / zero zoom treated as 1
  assert(
    Math.abs(nodeScreenRadius(0, NaN) - r0z1) < 1e-9,
    "NaN zoom falls back to |z|=1"
  );
  assert(
    Math.abs(nodeScreenRadius(0, 0) - r0z1) < 1e-9,
    "zero zoom falls back to |z|=1"
  );

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll node-size checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
