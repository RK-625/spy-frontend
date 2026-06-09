"use client";

import { useState, useCallback, useRef } from "react";
import { useScramble } from "use-scramble";

const PHASE_1 = "KNOWLEDGE UNSTRUCTURED IS JUST NOISE !!!";
const PHASE_2 = "MANAGE THE CHAOS";
const PHASE_3_A = "MEET";
const PHASE_3_B = "SYPDER";

export default function HeroSection() {
  const [text, setText] = useState(PHASE_1);
  const [phase2A, setPhase2A] = useState("");
  const [phase2B, setPhase2B] = useState("");
  const [currentPhase, setCurrentPhase] = useState(1);
  const [sweepActive, setSweepActive] = useState(false);
  const replayARef = useRef<(() => void) | null>(null);
  const replayBRef = useRef<(() => void) | null>(null);

  const handleAnimationEnd = useCallback(() => {
    if (currentPhase === 1) {
      setTimeout(() => {
        setCurrentPhase(2);
        setText(PHASE_2);
      }, 1000);
    } else if (currentPhase === 2) {
      setTimeout(() => {
        setCurrentPhase(3);
        setText("");
        setPhase2A(PHASE_3_A);
        setPhase2B(PHASE_3_B);
        setTimeout(() => {
          replayARef.current?.();
          replayBRef.current?.();
        }, 50);
      }, 1000);
    }
  }, [currentPhase]);

  const { ref, replay } = useScramble({
    text,
    speed: 0.35,
    tick: 2,
    step: 1,
    scramble: 2,
    chance: 0.7,
    overflow: true,
    playOnMount: true,
    range: [65, 125],
    onAnimationEnd: handleAnimationEnd,
  });
  const replayMainRef = useRef<(() => void) | null>(null);
  replayMainRef.current = replay;

  // Second scramble for "MEET" — synced with phase 3
  const { ref: refA, replay: replayA } = useScramble({
    text: phase2A,
    speed: 0.35,
    tick: 2,
    step: 1,
    scramble: 2,
    chance: 0.7,
    overflow: true,
    playOnMount: false,
    range: [65, 125],
  });
  replayARef.current = replayA;

  // "SYPDER" scramble — separate ref for glossy purple styling
  const { ref: refB, replay: replayB } = useScramble({
    text: phase2B,
    speed: 0.35,
    tick: 2,
    step: 1,
    scramble: 2,
    chance: 0.7,
    overflow: true,
    playOnMount: false,
    range: [65, 125],
    onAnimationEnd: () => {
      setTimeout(() => setSweepActive(true), 200);
    },
  });
  replayBRef.current = replayB;

  const whiteGlow =
    "[text-shadow:2px_2px_0_rgba(6,6,16,0.9),4px_4px_0_rgba(6,6,16,0.7),0_0_12px_rgba(222,212,240,0.15)]";
  const purpleGlow = "";

  const isPhase3 = currentPhase === 3;

  return (
    <div className="flex items-center justify-center min-h-screen">
      {isPhase3 ? (
        <div className="flex gap-[2em]">
          <span
            ref={refA}
            className={`font-[family-name:var(--font-terminal)] font-bold text-[#ded4f0] text-[clamp(1.5rem,4vw,3.5rem)] uppercase tracking-[0.15em] select-none ${whiteGlow}`}
          />
          <span
            ref={refB}
            className={`font-[family-name:var(--font-terminal)] font-bold text-[clamp(1.5rem,4vw,3.5rem)] uppercase tracking-[0.15em] select-none relative inline-block glossy-text ${sweepActive ? "sweep" : ""}`}
          />
        </div>
      ) : (
        <h1
          ref={ref}
          className={`font-[family-name:var(--font-terminal)] font-bold text-[#ded4f0] text-[clamp(1.5rem,4vw,3.5rem)] uppercase tracking-[0.15em] select-none ${whiteGlow}`}
        />
      )}
    </div>
  );
}
