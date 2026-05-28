"use client";

import { useRef, useState, useCallback } from "react";
import gsap from "gsap";

interface CtaButtonProps {
  className?: string;
}

export default function CtaButton({ className = "" }: CtaButtonProps) {
  const [showResponse, setShowResponse] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setShowResponse(true);

    if (btnRef.current) {
      gsap.fromTo(
        btnRef.current,
        { scale: 1 },
        {
          scale: 1.03,
          duration: 0.15,
          yoyo: true,
          repeat: 1,
          ease: "power2.out",
        }
      );
    }

    setTimeout(() => {
      setShowResponse(false);
      setIsAnimating(false);
    }, 3500);
  }, [isAnimating]);

  return (
    <div className={`flex flex-col items-center gap-5 ${className}`}>
      <button
        ref={btnRef}
        onClick={handleClick}
        className="relative font-display font-medium text-[0.75rem] tracking-[0.08em] text-background bg-accent hover:bg-accent-hover px-10 py-3.5 rounded-none transition-all duration-300 ease-out focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4 min-w-[200px] cursor-pointer"
      >
        Start weaving
      </button>

      <p
        className={`font-sans text-[0.8rem] text-text-dim transition-opacity duration-500 ${
          showResponse ? "opacity-100" : "opacity-0"
        }`}
      >
        The spider is preparing your web...
      </p>
    </div>
  );
}
