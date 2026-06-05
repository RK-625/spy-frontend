"use client";

import gsap from "gsap";

export type SpiderBehaviorName =
  | "idleHoverBreath"
  | "antennaPerk"
  | "antennaWag"
  | "curiousLean"
  | "legToeTap"
  | "legShuffle"
  | "crouchPeek"
  | "fangWave"
  | "eyeBlink"
  | "visorBootFlash"
  | "webPluck"
  | "happyBounce";

export type SpiderBehaviorContext = {
  masterGroup: SVGGElement;
  bodyParts: Element[];
  visor: Element;
  antenna: Element;
  leftFang: Element;
  rightFang: Element | null;
  allLegs: Element[];
  frontLegs: Element[];
  eyeCircles: SVGCircleElement[];
  eyeBaseR: number[];
  visorTickerRoot: SVGGElement | null;
  svgContainer: Element | null;
  glowEl: HTMLElement | null;
};

export function createSpiderBehaviors(ctx: SpiderBehaviorContext) {
  let microTl: gsap.core.Timeline | null = null;
  let loopCall: gsap.core.Tween | null = null;
  let idleBreathTl: gsap.core.Timeline | null = null;
  let idleWagTl: gsap.core.Timeline | null = null;

  const killMicro = () => {
    microTl?.kill();
    microTl = null;
  };

  const mk = (builder: () => gsap.core.Timeline) => builder();

  const idleHoverBreath = () =>
    mk(() => {
      const tl = gsap.timeline({ paused: true });
      // Hover is handled by the wrapper float tween; this is a subtle body "breath".
      tl.to(
        ctx.bodyParts,
        {
          scaleY: 1.012,
          scaleX: 0.996,
          duration: 3.6,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        0
      );
      return tl;
    });

  const antennaWag = () =>
    mk(() => {
      const tl = gsap.timeline({ paused: true });
      tl.to(ctx.antenna, {
        rotation: 12,
        svgOrigin: "740 142",
        duration: 0.12,
        repeat: -1,
        yoyo: true,
        repeatDelay: 3.5,
        ease: "power2.inOut",
      });
      return tl;
    });

  const antennaPerk = () =>
    mk(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });
      tl.to(ctx.antenna, { rotation: 22, duration: 0.12, svgOrigin: "740 142" }, 0);
      tl.to(ctx.antenna, { rotation: 8, duration: 0.18, ease: "sine.inOut" });
      tl.to(ctx.antenna, { rotation: 0, duration: 0.35, ease: "power2.inOut" });
      return tl;
    });

  const curiousLean = () =>
    mk(() => {
      const dir = gsap.utils.random([-1, 1]);
      const tl = gsap.timeline({ paused: true, defaults: { ease: "sine.inOut" } });
      tl.to(ctx.masterGroup, { rotation: 1.8 * dir, x: 7 * dir, duration: 0.22 }, 0);
      tl.to(ctx.visor, { x: 2 * dir, duration: 0.22 }, 0);
      tl.to(ctx.masterGroup, { rotation: -0.8 * dir, x: 3 * dir, duration: 0.18 });
      tl.to(ctx.masterGroup, { rotation: 0, x: 0, duration: 0.28, ease: "power2.out" });
      tl.to(ctx.visor, { x: 0, duration: 0.28, ease: "power2.out" }, "<");
      return tl;
    });

  const legToeTap = () =>
    mk(() => {
      const leg = (ctx.frontLegs[gsap.utils.random(0, Math.max(0, ctx.frontLegs.length - 1), 1)] ||
        ctx.allLegs[0]) as Element | undefined;
      if (!leg) return gsap.timeline({ paused: true });

      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
      tl.to(leg, { y: 2, rotation: "+=6", duration: 0.12 }, 0);
      tl.to(leg, { y: 0, rotation: "-=6", duration: 0.12 });
      tl.to(leg, { y: 1.5, rotation: "+=5", duration: 0.1 });
      tl.to(leg, { y: 0, rotation: "-=5", duration: 0.12 });
      return tl;
    });

  const legShuffle = () =>
    mk(() => {
      const tl = gsap.timeline({ paused: true });
      // Tiny alternating stance adjustments.
      tl.to(ctx.allLegs, {
        rotation: (i: number) => (i % 2 === 0 ? 4 : -4),
        duration: 0.14,
        ease: "sine.inOut",
        stagger: { each: 0.02, from: "center" },
      });
      tl.to(ctx.allLegs, {
        rotation: (i: number) => (i % 2 === 0 ? -3 : 3),
        duration: 0.16,
        ease: "sine.inOut",
        stagger: { each: 0.02, from: "center" },
      });
      tl.to(ctx.allLegs, {
        rotation: 0,
        duration: 0.22,
        ease: "power2.out",
        stagger: { each: 0.015, from: "edges" },
      });
      return tl;
    });

  const crouchPeek = () =>
    mk(() => {
      const dir = gsap.utils.random([-1, 1]);
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
      tl.to(ctx.masterGroup, { y: 4, duration: 0.12 }, 0);
      tl.to(ctx.bodyParts, { y: 10, scaleY: 0.92, duration: 0.12 }, 0);
      tl.to(ctx.allLegs, { scaleY: 0.9, duration: 0.12 }, 0);
      tl.to(ctx.masterGroup, { rotation: 1.2 * dir, x: 5 * dir, duration: 0.18, ease: "sine.inOut" });
      tl.to(ctx.masterGroup, { rotation: 0, x: 0, y: 0, duration: 0.28, ease: "back.out(1.4)" });
      tl.to(ctx.bodyParts, { y: 0, scaleY: 1, duration: 0.28, ease: "back.out(1.2)" }, "<");
      tl.to(ctx.allLegs, { scaleY: 1, duration: 0.28, ease: "back.out(1.2)" }, "<");
      return tl;
    });

  const fangWave = () =>
    mk(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: "sine.inOut" } });
      tl.to(ctx.leftFang, { rotation: -35, svgOrigin: "340 415", duration: 0.12, ease: "power2.out" }, 0);
      if (ctx.rightFang) tl.to(ctx.rightFang, { rotation: 35, duration: 0.12, ease: "power2.out" }, 0);
      tl.to([ctx.leftFang, ctx.rightFang].filter(Boolean), {
        rotation: (i: number) => (i === 0 ? -26 : 26),
        duration: 0.08,
        repeat: 3,
        yoyo: true,
      });
      tl.to([ctx.leftFang, ctx.rightFang].filter(Boolean), {
        rotation: 0,
        duration: 0.18,
        ease: "power2.inOut",
      });
      return tl;
    });

  const eyeBlink = () =>
    mk(() => {
      if (!ctx.eyeCircles.length) return gsap.timeline({ paused: true });
      const tl = gsap.timeline({ paused: true, defaults: { ease: "sine.inOut" } });

      // If eyes are currently "off" (r=0), this becomes a quick flicker-on then blink shut.
      ctx.eyeCircles.forEach((c, i) => {
        const base = (ctx.eyeBaseR[i] ?? Number(c.getAttribute("r") || 0)) || 18;
        const mid = Math.max(1, base * 0.22);
        tl.set(c, { attr: { r: base } }, 0);
        tl.to(c, { attr: { r: mid }, duration: 0.08 }, 0);
        tl.to(c, { attr: { r: base }, duration: 0.1 }, 0.09);
        tl.to(c, { attr: { r: 0 }, duration: 0.14, ease: "power2.in" }, 0.22);
      });
      return tl;
    });

  const visorBootFlash = () =>
    mk(() => {
      if (!ctx.visorTickerRoot) return gsap.timeline({ paused: true });
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });
      tl.to(ctx.visorTickerRoot, { opacity: 0.15, duration: 0.05 }, 0);
      tl.to(ctx.visorTickerRoot, { opacity: 1, duration: 0.12 }, 0.06);
      tl.to(ctx.visorTickerRoot, { opacity: 0.35, duration: 0.05 }, 0.22);
      tl.to(ctx.visorTickerRoot, { opacity: 1, duration: 0.18 }, 0.28);
      return tl;
    });

  const webPluck = () =>
    mk(() => {
      const dir = gsap.utils.random([-1, 1]);
      const tl = gsap.timeline({ paused: true });
      tl.to(ctx.masterGroup, { x: 6 * dir, duration: 0.06, ease: "power2.out" }, 0);
      tl.to(ctx.antenna, { rotation: "+=10", duration: 0.06, ease: "power2.out", svgOrigin: "740 142" }, 0);
      tl.to(ctx.masterGroup, { x: -3 * dir, duration: 0.08, ease: "sine.inOut" });
      tl.to(ctx.masterGroup, { x: 0, duration: 0.22, ease: "power2.out" });
      tl.to(ctx.antenna, { rotation: "-=10", duration: 0.22, ease: "power2.out" }, "<");
      return tl;
    });

  const happyBounce = () =>
    mk(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
      tl.to(ctx.masterGroup, { y: 6, duration: 0.12 }, 0);
      tl.to(ctx.bodyParts, { scaleY: 0.9, duration: 0.12 }, 0);
      tl.to(ctx.masterGroup, { y: -80, duration: 0.22, ease: "power3.out" });
      tl.to(ctx.bodyParts, { scaleY: 1.05, duration: 0.22, ease: "power3.out" }, "<");
      tl.to(ctx.masterGroup, { y: 0, duration: 0.26, ease: "power2.in" });
      tl.to(ctx.bodyParts, { scaleY: 1.0, duration: 0.26, ease: "power2.in" }, "<");
      tl.to(ctx.masterGroup, { y: 0, duration: 0.35, ease: "back.out(1.6)" });
      return tl;
    });

  const animations: Record<SpiderBehaviorName, () => gsap.core.Timeline> = {
    idleHoverBreath,
    antennaPerk,
    antennaWag,
    curiousLean,
    legToeTap,
    legShuffle,
    crouchPeek,
    fangWave,
    eyeBlink,
    visorBootFlash,
    webPluck,
    happyBounce,
  };


  const play = (name: SpiderBehaviorName) => {
    if (!animations[name]) return;
    if (microTl && microTl.isActive()) return;

    // Pause continuous idles while a micro-action plays (prevents transform fights).
    idleBreathTl?.pause();
    idleWagTl?.pause();

    killMicro();
    microTl = animations[name]();
    microTl.eventCallback("onComplete", () => {
      killMicro();
      idleBreathTl?.play();
      idleWagTl?.play();
    });
    microTl.play(0);
  };

  const startAuto = () => {
    if (loopCall) return;
    const tick = () => {
      // Only one micro action at a time.
      if (!microTl || !microTl.isActive()) {
        // Weighted-ish choice: happyBounce is rarer.
        const roll = Math.random();
        const name =
          roll < 0.08
            ? "happyBounce"
            : roll < 0.16
              ? "legShuffle"
              : roll < 0.28
                ? "legToeTap"
                : roll < 0.4
                  ? "curiousLean"
                  : roll < 0.52
                    ? "webPluck"
                    : roll < 0.64
                      ? "fangWave"
                      : roll < 0.76
                        ? "antennaPerk"
                        : roll < 0.88
                          ? "visorBootFlash"
                          : "eyeBlink";
        play(name);
      }

      const next = gsap.utils.random(3.5, 8.5);
      loopCall = gsap.delayedCall(next, tick);
    };

    loopCall = gsap.delayedCall(4.0, tick);
  };

  const stopAuto = () => {
    loopCall?.kill();
    loopCall = null;
  };

  const startIdles = () => {
    // Start continuous idles if the caller wants.
    // Note: hover/bob is handled by the wrapper float tween in the main init.
    idleBreathTl?.kill();
    idleWagTl?.kill();

    idleBreathTl = animations.idleHoverBreath();
    idleWagTl = animations.antennaWag();

    idleBreathTl.play(0);
    idleWagTl.play(0);
  };

  const cleanup = () => {
    stopAuto();
    killMicro();
    idleBreathTl?.kill();
    idleWagTl?.kill();
    idleBreathTl = null;
    idleWagTl = null;
  };

  return {
    list: () => Object.keys(animations) as SpiderBehaviorName[],
    play,
    startAuto,
    stopAuto,
    startIdles,
    cleanup,
  };
}
