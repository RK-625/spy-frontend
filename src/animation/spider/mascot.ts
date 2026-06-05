"use client";

import gsap from "gsap";
import { createSpiderBehaviors } from "./behaviors";

export function initSpiderMascotAnimation({
  container,
  glowEl,
  tickerText = "SPY • WEAVING SIGNAL • SPY • WEAVING SIGNAL",
}: {
  container: HTMLElement;
  glowEl: HTMLElement | null;
  tickerText?: string;
}) {
  // Master group: prefer explicit IDs, but fall back to the first top-level <g>
  // so the animation survives SVG regrouping/renaming.
  const masterGroup =
    (container.querySelector("#Spider") ||
      container.querySelector("#Mascot") ||
      container.querySelector("#Robot\\ spider") ||
      container.querySelector("#Group\\ 1") ||
      container.querySelector("svg > g")) as SVGGElement | null;
  const body = container.querySelector('[id="Body & face"]');
  const visor = container.querySelector("#Visor\\ section");
  const antenna = container.querySelector("#Antenna");
  const leftFang = container.querySelector("#Left\\ Fang");
  const rightFang =
    container.querySelector('[id="Right  Fang"]') ||
    container.querySelector('[id="Right Fang"]') ||
    container.querySelector('[id="Right  Fang mirrored"]');
  const leftEye = container.querySelector('[id="Left eye"]');
  const rightEye = container.querySelector('[id="Right eye"]');

  // Hair tufts
  const leftHair1 = container.querySelector('[id="Left hair 1"]');
  const leftHair2 = container.querySelector('[id="Left hari 2"]');
  const rightHair3 = container.querySelector('[id="Right hair 3"]');
  const rightHair4 = container.querySelector('[id="Right hair 4"]');

  const pick = (...sels: string[]) => {
    for (const sel of sels) {
      const el = container.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  const isEl = (v: Element | null): v is Element => v !== null;

  // Legs: support both the newer clear names ("Left 1st leg", "Right 1st leg", etc.)
  // and the older mirrored exports.
  const frontLegs = [
    pick('[id="Left 1st leg"]', '[id="Left 1st leg mirror"]'),
    pick('[id="Right 1st leg"]', '[id="Left 1st leg mirror_2"]'),
  ].filter(isEl);

  const supportLegs = [
    pick('[id="Left 2nd leg"]', '[id="Left 2nd leg mirror"]'),
    pick('[id="Right 2nd leg"]', '[id="Left 2nd leg mirror_2"]'),
    pick('[id="Left back leg"]', '[id="Left back leg mirror"]'),
    pick('[id="Right back leg"]', '[id="Left back leg mirror_2"]'),
  ].filter(isEl);

  // One array — used everywhere, safe to reference
  const allLegs = [...frontLegs, ...supportLegs];

  // Group everything that should move together as the "body"
  const bodyParts = [
    body,
    visor,
    antenna,
    leftFang,
    rightFang,
    leftEye,
    rightEye,
    leftHair1,
    leftHair2,
    rightHair3,
    rightHair4,
  ].filter(isEl);

  if (!masterGroup || !body || !visor || !antenna || !leftFang) return;

  // ── Eye blip: after landing, eyes collapse inward to reveal visor-grey underneath ──
  const createdNodes: Element[] = [];
  const createdCleanups: Array<() => void> = [];
  const svgEl = container.querySelector("svg") as SVGSVGElement | null;
  const svgNS = "http://www.w3.org/2000/svg";

  const parseViewBox = (svg: SVGSVGElement) => {
    const raw = svg.getAttribute("viewBox")?.trim();
    const parts = raw ? raw.split(/\s+/).map(Number) : null;
    if (!parts || parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
      return { x: 0, y: 0, width: 1000, height: 1000 };
    }
    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  };

  const ensureDefs = (svg: SVGSVGElement) => {
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(svgNS, "defs");
      svg.insertBefore(defs, svg.firstChild);
      createdNodes.push(defs);
    }
    return defs;
  };

  const setupEyeDissolve = (eyeGroup: Element | null, side: "left" | "right") => {
    if (!svgEl || !eyeGroup) return null;

    const bbox = (eyeGroup as SVGGElement).getBBox();
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const baseR = Math.hypot(bbox.width, bbox.height) / 2 + 10;

    const defs = ensureDefs(svgEl);
    const vb = parseViewBox(svgEl);
    const uid = `${side}-eye-dissolve-${Math.random().toString(36).slice(2, 9)}`;
    const maskId = `${uid}-mask`;
    const filterId = `${uid}-blur`;

    const filter = document.createElementNS(svgNS, "filter");
    filter.setAttribute("id", filterId);
    filter.setAttribute("x", "-15%");
    filter.setAttribute("y", "-15%");
    filter.setAttribute("width", "130%");
    filter.setAttribute("height", "130%");
    const blur = document.createElementNS(svgNS, "feGaussianBlur");
    blur.setAttribute("in", "SourceGraphic");
    blur.setAttribute("stdDeviation", "2.5");
    filter.appendChild(blur);
    defs.appendChild(filter);
    createdNodes.push(filter);

    const mask = document.createElementNS(svgNS, "mask");
    mask.setAttribute("id", maskId);
    mask.setAttribute("maskUnits", "userSpaceOnUse");
    mask.setAttribute("maskContentUnits", "userSpaceOnUse");
    mask.setAttribute("x", String(vb.x));
    mask.setAttribute("y", String(vb.y));
    mask.setAttribute("width", String(vb.width));
    mask.setAttribute("height", String(vb.height));

    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", String(vb.x));
    rect.setAttribute("y", String(vb.y));
    rect.setAttribute("width", String(vb.width));
    rect.setAttribute("height", String(vb.height));
    rect.setAttribute("fill", "black");

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", String(baseR));
    circle.setAttribute("fill", "white");
    circle.setAttribute("filter", `url(#${filterId})`);

    mask.appendChild(rect);
    mask.appendChild(circle);
    defs.appendChild(mask);
    createdNodes.push(mask);

    // Shrink-mask the original eye inward (reveals flat visor screen behind).
    const prevMask = eyeGroup.getAttribute("mask");
    createdCleanups.push(() => {
      if (prevMask) eyeGroup.setAttribute("mask", prevMask);
      else eyeGroup.removeAttribute("mask");
    });
    eyeGroup.setAttribute("mask", `url(#${maskId})`);

    return { circle, baseR };
  };

  const leftDissolve = setupEyeDissolve(leftEye, "left");
  const rightDissolve = setupEyeDissolve(rightEye, "right");
  const eyeCircles = [leftDissolve?.circle, rightDissolve?.circle].filter(
    Boolean
  ) as SVGCircleElement[];
  const eyeBaseR: number[] = [];
  if (leftDissolve?.circle) eyeBaseR.push(leftDissolve.baseR);
  if (rightDissolve?.circle) eyeBaseR.push(rightDissolve.baseR);

  // ── Visor ticker (SVG-native; clipped to the actual visor screen path) ──
  const setupVisorTicker = (initialText: string) => {
    if (!svgEl || !visor) return null;

    const screenGroup = visor.querySelector("#Screen") as SVGGElement | null;
    if (!screenGroup) return null;

    // This is the real visible visor screen surface in the SVG.
    // The exported SVG may have multiple identical paths (e.g. solid fill + gradient overlay),
    // so we pick the largest even-odd path within #Screen.
    const candidates = Array.from(
      screenGroup.querySelectorAll('path[fill-rule="evenodd"][clip-rule="evenodd"]')
    ) as SVGPathElement[];
    const screenPath =
      candidates
        .map((p) => {
          try {
            const b = p.getBBox();
            return { p, area: b.width * b.height };
          } catch {
            return { p, area: 0 };
          }
        })
        .sort((a, b) => b.area - a.area)[0]?.p || null;

    if (!screenPath) return null;

    const defs = ensureDefs(svgEl);
    const uid = `visor-ticker-${Math.random().toString(36).slice(2, 9)}`;
    const screenPathId = screenPath.getAttribute("id") || `${uid}-screen-shape`;
    screenPath.setAttribute("id", screenPathId);

    const clipId = `${uid}-clip`;
    const clipPath = document.createElementNS(svgNS, "clipPath");
    clipPath.setAttribute("id", clipId);
    const useEl = document.createElementNS(svgNS, "use");
    // Modern
    useEl.setAttribute("href", `#${screenPathId}`);
    // Safari fallback
    useEl.setAttributeNS(
      "http://www.w3.org/1999/xlink",
      "xlink:href",
      `#${screenPathId}`
    );
    clipPath.appendChild(useEl);
    defs.appendChild(clipPath);
    createdNodes.push(clipPath);

    const glowId = `${uid}-glow`;
    const filter = document.createElementNS(svgNS, "filter");
    filter.setAttribute("id", glowId);
    // Big region so the bloom never gets clipped by the filter box.
    filter.setAttribute("x", "-90%");
    filter.setAttribute("y", "-140%");
    filter.setAttribute("width", "280%");
    filter.setAttribute("height", "380%");

    // Front-lit emissive face (lavender -> violet) for the glyph fill.
    const fillId = `${uid}-fill`;
    const grad = document.createElementNS(svgNS, "linearGradient");
    grad.setAttribute("id", fillId);
    grad.setAttribute("x1", "0");
    grad.setAttribute("y1", "0");
    grad.setAttribute("x2", "0");
    grad.setAttribute("y2", "1");
    const stops: Array<[string, string, string]> = [
      // Reduce white; push the face toward lavender/violet.
      ["0%", "#F6F1FF", "1"],
      ["45%", "#E6D6FF", "1"],
      ["85%", "#B88CFF", "1"],
      ["100%", "#7D43EE", "1"],
    ];
    for (const [off, col, op] of stops) {
      const s = document.createElementNS(svgNS, "stop");
      s.setAttribute("offset", off);
      s.setAttribute("stop-color", col);
      s.setAttribute("stop-opacity", op);
      grad.appendChild(s);
    }
    defs.appendChild(grad);
    createdNodes.push(grad);

    const mkShadow = (
      result: string,
      stdDeviation: number,
      color: string,
      opacity: number
    ) => {
      const ds = document.createElementNS(svgNS, "feDropShadow");
      ds.setAttribute("in", "SourceGraphic");
      ds.setAttribute("dx", "0");
      ds.setAttribute("dy", "0");
      ds.setAttribute("stdDeviation", String(stdDeviation));
      ds.setAttribute("flood-color", color);
      ds.setAttribute("flood-opacity", String(opacity));
      ds.setAttribute("result", result);
      return ds;
    };

    // Front-facing lavender neon glow + electric violet bloom ("front-lit" feel).
    // Dial back white; push glow toward lavender/purple.
    const ds1 = mkShadow("ds1", 0.6, "#F6F1FF", 0.55);
    const ds2 = mkShadow("ds2", 1.3, "#E6D6FF", 0.7);
    const ds3 = mkShadow("ds3", 2.4, "#B88CFF", 0.95);
    const ds4 = mkShadow("ds4", 4.2, "#7D43EE", 0.65);
    const ds5 = mkShadow("ds5", 6.4, "#5220CE", 0.38);

    const merge = document.createElementNS(svgNS, "feMerge");
    ["ds5", "ds4", "ds3", "ds2", "ds1", "SourceGraphic"].forEach((input) => {
      const n = document.createElementNS(svgNS, "feMergeNode");
      n.setAttribute("in", input);
      merge.appendChild(n);
    });

    filter.appendChild(ds1);
    filter.appendChild(ds2);
    filter.appendChild(ds3);
    filter.appendChild(ds4);
    filter.appendChild(ds5);
    filter.appendChild(merge);
    defs.appendChild(filter);
    createdNodes.push(filter);

    const root = document.createElementNS(svgNS, "g");
    root.setAttribute("clip-path", `url(#${clipId})`);
    root.setAttribute("opacity", "0");
    root.setAttribute("pointer-events", "none");

    const move = document.createElementNS(svgNS, "g");
    root.appendChild(move);

    const textA = document.createElementNS(svgNS, "text");
    const textB = document.createElementNS(svgNS, "text");
    [textA, textB].forEach((t) => {
      t.setAttribute("dominant-baseline", "middle");

      // Typography: VT323 (retro terminal), with "front-lit" emissive face + dark wireframe outline.
      t.style.fontFamily =
        "var(--font-terminal), VT323, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
      t.setAttribute("font-weight", "400");
      t.setAttribute("fill", `url(#${fillId})`);
      t.setAttribute("filter", `url(#${glowId})`);
      t.setAttribute("stroke", "#2E1092");
      t.setAttribute("stroke-opacity", "0.75");
      t.setAttribute("stroke-linejoin", "round");
      t.setAttribute("paint-order", "stroke fill");
    });

    move.appendChild(textA);
    move.appendChild(textB);

    screenGroup.appendChild(root);
    createdNodes.push(root);

    const bbox = screenPath.getBBox();
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const padX = 10;
    const xStart = bbox.x + padX;
    // Visor visible height is ~131 units; use it.
    const FONT_SCALE = 1.25;
    const fontSize = Math.max(28, Math.min(110, bbox.height * 0.58 * FONT_SCALE));
    // VT323 reads best with tight tracking; keep a little spacing so it doesn't smear under bloom.
    const letterSpacing = Math.max(0.5, fontSize * 0.02);
    const strokeWidth = Math.max(1.2, Math.min(7.5, fontSize * 0.055));

    textA.setAttribute("y", String(cy));
    textB.setAttribute("y", String(cy));
    textA.setAttribute("font-size", String(fontSize));
    textB.setAttribute("font-size", String(fontSize));
    textA.setAttribute("stroke-width", String(strokeWidth));
    textB.setAttribute("stroke-width", String(strokeWidth));
    textA.style.letterSpacing = `${letterSpacing}px`;
    textB.style.letterSpacing = `${letterSpacing}px`;

    const computeTopTiltDeg = (path: SVGPathElement) => {
      const len = path.getTotalLength();
      const samples = 140;
      const pts: Array<{ x: number; y: number }> = [];
      let minY = Infinity;
      for (let i = 0; i < samples; i++) {
        const p = path.getPointAtLength((len * i) / (samples - 1));
        pts.push({ x: p.x, y: p.y });
        if (p.y < minY) minY = p.y;
      }

      let band = 1.5;
      let top = pts.filter((p) => p.y <= minY + band);
      while (top.length < 10 && band < 12) {
        band *= 1.6;
        top = pts.filter((p) => p.y <= minY + band);
      }
      if (top.length < 2) return 0;

      // Least-squares fit: y = a + b*x
      const n = top.length;
      let sumX = 0,
        sumY = 0,
        sumXX = 0,
        sumXY = 0;
      for (const p of top) {
        sumX += p.x;
        sumY += p.y;
        sumXX += p.x * p.x;
        sumXY += p.x * p.y;
      }
      const denom = n * sumXX - sumX * sumX;
      const b = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
      return (Math.atan(b) * 180) / Math.PI;
    };

    const tiltDeg = computeTopTiltDeg(screenPath);
    // Keep it subtle even if sampling is noisy.
    const clampedTilt = Math.max(-3, Math.min(3, tiltDeg));
    root.setAttribute("transform", `rotate(${clampedTilt} ${cx} ${cy})`);

    // Start the ticker off-screen (to the right) and let it enter the visor,
    // then continue with a seamless infinite loop.
    let tickerTl: gsap.core.Timeline | null = null;
    let rafId: number | null = null;
    let currentText = initialText;
    let started = false;

    createdCleanups.push(() => tickerTl?.kill());
    createdCleanups.push(() => {
      if (rafId != null) cancelAnimationFrame(rafId);
    });

    const buildTimeline = (t: string) => {
      const base = (t || "").trim() || "SPY • WEAVING";

      // Build a long enough string to ensure we never get "multiple copies everywhere"
      // if measurement is briefly wrong (fonts still loading).
      const sep = "   •   ";
      let long = base;
      textA.textContent = long;

      const measureLen = () => {
        const len = textA.getComputedTextLength();
        if (Number.isFinite(len) && len > 1) return len;
        // Fallback estimate in viewBox units.
        const approxPerChar = fontSize * 0.62 + letterSpacing;
        return Math.max(1, long.length * approxPerChar);
      };

      const target = bbox.width * 2;
      let loops = 0;
      let lenA = measureLen();
      while (lenA < target && loops < 12) {
        long += `${sep}${base}`;
        textA.textContent = long;
        loops++;
        lenA = measureLen();
      }
      textB.textContent = long;

      // Keep the gap comfortable but never larger than the screen width (avoids blanking).
      const gap = Math.max(24, Math.min(bbox.width * 0.65, fontSize * 2.2));
      const loopLen = lenA + gap;

      textA.setAttribute("x", "0");
      textB.setAttribute("x", String(loopLen));

      const xIntroStart = bbox.x + bbox.width + 2; // just off the right edge

      tickerTl?.kill();
      gsap.set(move, { x: xIntroStart });

      const pxPerSec = 46; // tuned for this viewBox scale
      const introDist = Math.max(0, xIntroStart - xStart);
      const introDur = Math.max(0.35, introDist / pxPerSec);
      const loopDur = Math.max(6, loopLen / pxPerSec);

      tickerTl = gsap.timeline({ paused: true });
      // 1) Enter from the right edge.
      tickerTl.to(move, {
        x: xStart,
        duration: introDur,
        ease: "none",
      });
      // 2) Seamless loop (jump is invisible because A/B are identical).
      tickerTl.to(move, {
        x: xStart - loopLen,
        duration: loopDur,
        ease: "none",
        repeat: -1,
      });

      return tickerTl;
    };

    const scheduleRebuild = (t: string) => {
      currentText = t;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        buildTimeline(currentText);
      });
    };

    // Build once on the next frame so text measurement is stable.
    scheduleRebuild(initialText);
    // If fonts load after our first measurement, rebuild once with correct metrics
    // but only if we haven't started playing yet (avoids visible jumps).
    if ("fonts" in document) {
      document.fonts.ready.then(() => {
        if (!started) scheduleRebuild(currentText);
      });
    }

    return {
      root,
      play: () => {
        started = true;
        return tickerTl?.play();
      },
      pause: () => tickerTl?.pause(),
      setText: scheduleRebuild,
    };
  };

  const visorTicker = setupVisorTicker(tickerText);

  // ── Leg rotation helpers ──
  //   Mirrored left/right, outer legs rotate more, inner legs less.
  //   Use distribute() from edges so the spread is deterministic and proportional.
  const legSide = (i: number) => (i % 2 === 0 ? 1 : -1);
  const legMag = gsap.utils.distribute({
    base: 12,
    amount: 4,
    from: "edges",
    ease: "power1.out",
  });
  // Returns a rotation function scaled by `multiplier`.
  //  multiplier =  1  → outward spread (crouch, land)
  //  multiplier = -1  → inward tuck
  //  multiplier =  0  → neutral
  const legRotate = (multiplier: number) =>
    (i: number, target: Element, targets: Element[]) =>
      legSide(i) * legMag(i, target, targets) * multiplier;

  // ── Pre-define and pause continuous idle animations ──
  const svgContainer = container.querySelector(".spider-svg-wrapper");

  const floatTween = gsap.to(svgContainer, {
    y: -20,
    duration: 2.5,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
    paused: true,
  });

  const glowTween = glowEl
    ? gsap.to(glowEl, {
        scale: 1.15,
        opacity: 0.2,
        duration: 3.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        paused: true,
      })
    : null;

  const behaviors = createSpiderBehaviors({
    masterGroup,
    bodyParts,
    visor,
    antenna,
    leftFang,
    rightFang: (rightFang as Element | null) ?? null,
    allLegs,
    frontLegs,
    eyeCircles,
    eyeBaseR,
    visorTickerRoot: (visorTicker?.root as SVGGElement | null) ?? null,
    svgContainer,
    glowEl,
  });

  // ── Greeting/Hop sequence (plays once on load) ──
  const hiTl = gsap.timeline({ defaults: { ease: "power2.inOut" } });

  hiTl.addLabel("crouch", 0);

  // 1. Crouch — body lowers by bending the legs, feet stay planted
  //    masterGroup gets a tiny dip for weight, body drifts down, legs compress
  hiTl.to(
    masterGroup,
    {
      y: 4,
      duration: 0.2,
    },
    "crouch"
  );

  hiTl.to(
    bodyParts,
    {
      y: 14,
      scaleY: 0.88,
      duration: 0.2,
    },
    "crouch"
  );

  hiTl.to(
    allLegs,
    {
      y: 4,
      scaleY: 0.84,
      rotation: legRotate(1),
      duration: 0.2,
    },
    "crouch"
  );

  hiTl.addLabel("spring", ">");

  // 2. Spring — the ENTIRE spider jumps upward as one unit via masterGroup
  //    All y movement is on masterGroup. Body/legs reset their crouch offsets together.
  hiTl.to(
    masterGroup,
    {
      y: -220,
      duration: 0.4,
      ease: "power3.out",
    },
    "spring"
  );

  // Body and legs reset crouch y at the same rate — no detachment, no delay
  hiTl.to(
    [bodyParts, ...allLegs],
    {
      y: 0,
      duration: 0.3,
      ease: "power2.out",
    },
    "spring"
  );

  // Body stretches slightly on the way up
  hiTl.to(
    bodyParts,
    {
      scaleY: 1.06,
      duration: 0.4,
      ease: "power3.out",
    },
    "spring"
  );

  // Legs tuck inward as the spider launches
  hiTl.to(
    allLegs,
    {
      scaleY: 0.92,
      rotation: legRotate(-0.5),
      duration: 0.3,
      ease: "power2.out",
    },
    "spring"
  );

  // 3. Hang time / Apex
  hiTl.addLabel("hang", ">");

  // masterGroup drifts to peak
  hiTl.to(
    masterGroup,
    {
      y: -235,
      duration: 0.25,
      ease: "sine.out",
    },
    "hang"
  );

  // Body relaxes to neutral
  hiTl.to(
    bodyParts,
    {
      scaleY: 1.0,
      duration: 0.25,
    },
    "hang"
  );

  // Legs relax outward slightly mid-air
  hiTl.to(
    allLegs,
    {
      scaleY: 1.0,
      rotation: legRotate(-0.2),
      duration: 0.2,
      ease: "sine.inOut",
    },
    "hang"
  );

  // Playful fang wave during the high float
  hiTl.to(
    leftFang,
    {
      rotation: -45,
      svgOrigin: "340 415",
      duration: 0.12,
      ease: "power2.out",
    },
    "hang"
  );

  hiTl.to(leftFang, {
    rotation: -30,
    duration: 0.08,
    repeat: 3,
    yoyo: true,
    ease: "sine.inOut",
  });

  hiTl.to(leftFang, {
    rotation: 0,
    duration: 0.15,
    ease: "power2.inOut",
  });

  // Begin fall — masterGroup descends
  hiTl.to(
    masterGroup,
    {
      y: -140,
      duration: 0.25,
      ease: "sine.in",
    },
    "<"
  );

  // Legs begin reaching down for landing
  hiTl.to(
    allLegs,
    {
      scaleY: 1.04,
      rotation: legRotate(0.6),
      duration: 0.2,
      ease: "power1.in",
    },
    "<"
  );

  hiTl.addLabel("land", ">");

  // 4. Land — masterGroup hits the ground, all parts compress
  hiTl.to(
    masterGroup,
    {
      y: 20,
      duration: 0.2,
      ease: "power2.in",
    },
    "land"
  );

  hiTl.to(
    bodyParts,
    {
      y: 12,
      scaleY: 0.84,
      duration: 0.2,
      ease: "power2.in",
    },
    "land"
  );

  hiTl.to(
    allLegs,
    {
      y: 6,
      scaleY: 0.82,
      rotation: legRotate(1),
      duration: 0.2,
      ease: "power2.in",
    },
    "land"
  );

  hiTl.addLabel("settle", ">");

  // 5. Settle — everything returns to neutral with dampened bounce
  hiTl.to(
    masterGroup,
    {
      y: 0,
      duration: 0.5,
      ease: "back.out(1.4)",
    },
    "settle"
  );

  hiTl.to(
    bodyParts,
    {
      y: 0,
      scaleY: 1,
      duration: 0.5,
      ease: "back.out(1.4)",
    },
    "settle"
  );

  hiTl.to(
    allLegs,
    {
      y: 0,
      scaleY: 1,
      rotation: 0,
      duration: 0.5,
      ease: "back.out(1.2)",
    },
    "settle"
  );

  // ── Post-landing: inward radial "blip" ──
  if (eyeCircles.length) {
    // A slightly delayed, slower inward collapse so it reads as intentional (not a glitch).
    hiTl.addLabel("eyes", "settle+=0.5");
    hiTl.to(
      eyeCircles,
      {
        attr: { r: 0 },
        duration: 1.2,
        ease: "expo.in",
      },
      "eyes"
    );
  }

  // ── Visor ticker reveal ──
  if (visorTicker?.root) {
    // Start AFTER the eye-blip completes, then wait a bit so it reads as a new phase.
    // Eyes label: settle+=0.5, eyes duration: 1.2s  => end at eyes+=1.2
    // Requested delay after eyes: +0.75s => start at eyes+=1.95
    const visorStart = eyeCircles.length ? "eyes+=1.95" : "settle+=0.9";
    hiTl.addLabel("visorText", visorStart);
    hiTl.to(
      visorTicker.root,
      {
        opacity: 1,
        duration: 0.7,
        ease: "power2.out",
      },
      "visorText"
    );
    hiTl.call(() => visorTicker.play(), undefined, "visorText");
  }

  // ── Start idle animations ──
  hiTl.call(() => {
    floatTween.play();
    glowTween?.play();
    behaviors.startIdles();
  });

  // ── Start occasional "cute behavior" micro-animations ──
  const autoStartAt = visorTicker?.root ? "visorText+=2.2" : "settle+=1.2";
  hiTl.call(() => behaviors.startAuto(), undefined, autoStartAt);

  return () => {
    behaviors.cleanup();
    createdCleanups.forEach((fn) => fn());
    createdNodes.forEach((n) => n.remove());
  };
}
