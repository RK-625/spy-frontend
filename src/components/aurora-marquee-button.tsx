"use client";

import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import styles from "./aurora-marquee-button.module.css";

type MarqueeMode = "auto" | "always" | "never";

export interface AuroraMarqueeButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  marquee?: MarqueeMode;
  marqueeSpeed?: string;
}

export default function AuroraMarqueeButton({
  label,
  marquee = "auto",
  marqueeSpeed,
  className,
  type = "button",
  style,
  ...props
}: AuroraMarqueeButtonProps) {
  const labelId = useId();
  const viewportRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [autoHasOverflow, setAutoHasOverflow] = useState(false);
  const hasOverflow = marquee === "always" || (marquee === "auto" && autoHasOverflow);

  useEffect(() => {
    if (marquee !== "auto") return;

    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    const updateOverflow = () => {
      setAutoHasOverflow(measure.scrollWidth > viewport.clientWidth);
    };

    const animationFrame = requestAnimationFrame(updateOverflow);

    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(viewport);
    resizeObserver.observe(measure);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [label, marquee]);

  const buttonStyle: CSSProperties = {
    ...style,
    ...(marqueeSpeed
      ? ({ "--marquee-speed": marqueeSpeed } as CSSProperties)
      : {}),
  };

  return (
    <button
      type={type}
      className={cn(styles.button, hasOverflow && styles.isMarquee, className)}
      style={buttonStyle}
      aria-labelledby={labelId}
      {...props}
    >
      <span ref={viewportRef} className={styles.viewport} aria-hidden="true">
        {hasOverflow ? (
          <span className={styles.marqueeTrack}>
            <span className={styles.marqueeText}>{label} ·</span>
            <span className={styles.marqueeText}>{label} ·</span>
          </span>
        ) : (
          <span className={styles.staticLabel}>{label}</span>
        )}
        <span ref={measureRef} className={styles.measure}>
          {label}
        </span>
      </span>
      <span id={labelId} className="sr-only">
        {label}
      </span>
    </button>
  );
}
