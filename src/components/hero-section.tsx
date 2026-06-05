"use client";

import { useRef } from "react";
import gsap from "gsap";
import SpiderMascot from "@/components/spider-mascot";
import Logo from "@/components/logo";
import Tagline from "@/components/tagline";
import CtaButton from "@/components/cta-button";
import AmbientGlow from "@/components/ambient-glow";

export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleReady = () => {
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        "--accent-glow-amount": "1",
        duration: 0.01,
      } as gsap.TweenVars);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative z-10 flex flex-col items-center text-center px-6 pt-[15vh]"
    >
      <AmbientGlow />
      <SpiderMascot onReady={handleReady} />
      <Logo className="mt-6 mb-6" />
      <Tagline className="mb-10" />
      <CtaButton />
    </div>
  );
}
