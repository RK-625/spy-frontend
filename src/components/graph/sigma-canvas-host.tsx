"use client";

import dynamic from "next/dynamic";

/**
 * Client-only Sigma mount. `ssr: false` — Sigma touches WebGL at import time
 * (`WebGL2RenderingContext`), which does not exist in the Node RSC evaluate.
 */
const SigmaCanvas = dynamic(
  () =>
    import("./sigma-canvas").then((mod) => ({
      default: mod.SigmaCanvas,
    })),
  {
    ssr: false,
    loading: () => <div className="h-dvh w-dvw bg-background" />,
  },
);

export function SigmaCanvasHost() {
  return <SigmaCanvas />;
}
