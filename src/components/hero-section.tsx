"use client";

import { useScramble } from "use-scramble";

export default function HeroSection() {
  const { ref } = useScramble({
    text: "KNOWLEDGE UNSTRTUCTED IS JUST NOISE !!!",
    speed: 0.35,
    tick: 2,
    step: 1,
    scramble: 2,
    chance: 0.7,
    overflow: true,
    playOnMount: true,
    range: [65, 125],
  });

  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1
        ref={ref}
        className="font-[family-name:var(--font-terminal)] font-bold text-[#ded4f0] text-[clamp(1.5rem,4vw,3.5rem)] uppercase tracking-[0.15em] select-none [text-shadow:2px_2px_0_rgba(6,6,16,0.9),4px_4px_0_rgba(6,6,16,0.7),0_0_12px_rgba(222,212,240,0.15)]"
      />
    </div>
  );
}
