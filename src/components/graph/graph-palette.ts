"use client";

import { useMemo } from "react";
import { useThemeTokens } from "@/components/theme";
import type { GraphPalette } from "@/lib/graph-functions";

const GRAPH_TOKEN_NAMES = [
  "--graph-node",
  "--graph-link-parent",
  "--graph-link-relates",
  "--graph-node-lightness-root",
  "--graph-node-lightness-step",
  "--graph-node-lightness-limit",
] as const;

/** The active theme's graph colors (WebGL cannot read CSS variables). Null until hydrated. */
export function useGraphPalette(): GraphPalette | null {
  const graphTokens = useThemeTokens(GRAPH_TOKEN_NAMES);
  return useMemo(() => {
    if (graphTokens === null) return null;
    return {
      node: graphTokens["--graph-node"],
      linkParentOf: graphTokens["--graph-link-parent"],
      linkRelatesTo: graphTokens["--graph-link-relates"],
      nodeLightnessRoot: Number(graphTokens["--graph-node-lightness-root"]),
      nodeLightnessStep: Number(graphTokens["--graph-node-lightness-step"]),
      nodeLightnessLimit: Number(graphTokens["--graph-node-lightness-limit"]),
    };
  }, [graphTokens]);
}
