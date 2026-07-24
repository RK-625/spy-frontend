/**
 * verify-rtc-camera.mjs — math checks for RtcCamera.
 * Imports the TypeScript source (single source of truth) via tsx.
 *
 * Run: npm run verify:rtc-camera
 *   → npx tsx scripts/verify-rtc-camera.mjs
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

function approx(a, b, eps, msg) {
  const d = Math.abs(a - b);
  ok(d <= eps, `${msg} (|${a} - ${b}| = ${d} <= ${eps})`);
}

function approxRel(a, b, relEps, absEps, msg) {
  const d = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  ok(d <= absEps || d / scale <= relEps, `${msg} (a=${a} b=${b} d=${d})`);
}

async function main() {
  const camUrl = pathToFileURL(
    path.join(root, "src/lib/graph/rtc-camera.ts")
  ).href;
  const { createRtcCamera } = await import(camUrl);

  // 1. Viewport 800×600, cam 0,0 zoom 1: world (0,0) → screen (400, 300)
  {
    const cam = createRtcCamera({
      camX: 0,
      camY: 0,
      zoom: 1,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const s = cam.worldToScreen({ x: 0, y: 0 });
    approx(s.x, 400, 1e-12, "1) world(0,0) → screen x=400");
    approx(s.y, 300, 1e-12, "1) world(0,0) → screen y=300");
  }

  // 2. Round-trip near origin
  {
    const cam = createRtcCamera({
      camX: 12.5,
      camY: -7,
      zoom: 2.5,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const w = { x: 3.14159, y: -2.71828 };
    const s = cam.worldToScreen(w);
    const w2 = cam.screenToWorld(s);
    approx(w2.x, w.x, 1e-9, "2) round-trip world.x");
    approx(w2.y, w.y, 1e-9, "2) round-trip world.y");
  }

  // 3. Huge coords: world & cam both 1e17, zoom 1 → screen ≈ center; round-trip
  {
    const H = 1e17;
    const cam = createRtcCamera({
      camX: H,
      camY: H,
      zoom: 1,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const s = cam.worldToScreen({ x: H, y: H });
    approx(s.x, 400, 1e-6, "3) huge world@cam → screen center x");
    approx(s.y, 300, 1e-6, "3) huge world@cam → screen center y");
    const w = { x: H + 100, y: H - 50 };
    const s2 = cam.worldToScreen(w);
    const w2 = cam.screenToWorld(s2);
    approxRel(w2.x, w.x, 1e-6, 1e-3, "3) huge round-trip x");
    approxRel(w2.y, w.y, 1e-6, 1e-3, "3) huge round-trip y");
    approx(
      s2.x,
      400 + (w.x - H),
      1e-6,
      "3) huge offset screen x matches RTC delta"
    );
    approx(
      s2.y,
      300 + (w.y - H),
      1e-6,
      "3) huge offset screen y matches RTC delta"
    );
    ok(
      Math.abs(s2.x - 400) < 200 && Math.abs(s2.y - 300) < 200,
      "3) huge nearby world still near viewport center (not exploded)"
    );
  }

  // 4. panByScreen(10, 0): drag-to-pan
  {
    const cam = createRtcCamera({
      camX: 0,
      camY: 0,
      zoom: 1,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const world = { x: 50, y: 20 };
    const before = cam.worldToScreen(world);
    cam.panByScreen(10, 0);
    const after = cam.worldToScreen(world);
    approx(
      after.x - before.x,
      10,
      1e-9,
      "4) panByScreen(10,0) screen.x += 10 (drag-to-pan)"
    );
    approx(after.y - before.y, 0, 1e-9, "4) panByScreen y unchanged");
    approx(cam.camX, -10, 1e-9, "4) camX moved left by 10/zoom");
  }

  // 5. zoomAt: world under screen point stable
  {
    const cam = createRtcCamera({
      camX: 10,
      camY: 20,
      zoom: 1,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const sx = 120;
    const sy = 80;
    const worldUnder = cam.screenToWorld({ x: sx, y: sy });
    const screenBefore = cam.worldToScreen(worldUnder);
    cam.zoomAt(sx, sy, 2);
    ok(cam.zoom === 2, "5) zoom became 2");
    const screenAfter = cam.worldToScreen(worldUnder);
    approx(screenAfter.x, screenBefore.x, 1e-9, "5) zoomAt keeps screen.x");
    approx(screenAfter.y, screenBefore.y, 1e-9, "5) zoomAt keeps screen.y");
    const worldAfter = cam.screenToWorld({ x: sx, y: sy });
    approx(worldAfter.x, worldUnder.x, 1e-9, "5) world under cursor stable x");
    approx(worldAfter.y, worldUnder.y, 1e-9, "5) world under cursor stable y");
  }

  // 6. zoom *= 1e6 several times still finite when cam co-located with cluster
  {
    const H = 1e17;
    const cam = createRtcCamera({
      camX: H,
      camY: H,
      zoom: 1,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    for (let i = 0; i < 4; i++) {
      cam.zoomAt(400, 300, 1e6);
    }
    ok(Number.isFinite(cam.zoom), "6) zoom still finite after 1e6^4");
    ok(
      Number.isFinite(cam.camX) && Number.isFinite(cam.camY),
      "6) cam finite"
    );
    const s = cam.worldToScreen({ x: H, y: H });
    ok(
      Number.isFinite(s.x) && Number.isFinite(s.y),
      "6) screen projection finite"
    );
    approx(s.x, 400, 1e-3, "6) cluster center still at viewport center x");
    approx(s.y, 300, 1e-3, "6) cluster center still at viewport center y");
  }

  // Guard: reject bad factor
  {
    const cam = createRtcCamera({
      zoom: 1,
      viewportWidth: 100,
      viewportHeight: 100,
    });
    cam.zoomAt(50, 50, NaN);
    ok(cam.zoom === 1, "guard: NaN factor ignored");
    cam.zoomAt(50, 50, 0);
    ok(cam.zoom === 1, "guard: zero factor ignored");
    cam.zoomAt(50, 50, Infinity);
    ok(cam.zoom === 1, "guard: Infinity factor ignored");
  }

  // 7. RTC preserves local offset at huge coords (subtract-before-scale)
  {
    const H = 1e17;
    const cam = createRtcCamera({
      camX: H,
      camY: H,
      zoom: 2,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    // Use offset large enough to survive float64 ULP at 1e17 (~16)
    const offset = 1024;
    const rtc = cam.worldToScreen({ x: H + offset, y: H });
    ok(Number.isFinite(rtc.x) && Number.isFinite(rtc.y), "7) RTC finite at 1e17");
    // RTC: (offset)*zoom + center — representable delta survives
    const expectedRtcX = 400 + offset * 2;
    approx(rtc.x, expectedRtcX, 1, "7) RTC preserves local offset at 1e17");
  }

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nAll rtc-camera checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
