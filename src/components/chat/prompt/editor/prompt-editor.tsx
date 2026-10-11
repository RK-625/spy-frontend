"use client";

import dynamic from "next/dynamic";
import { PromptInputTextarea } from "../body/textarea";

// The fallback uses the same draft, so text typed while loading is retained.
export const PromptEditor = dynamic(() => import("./markdown-editor"), {
  ssr: false,
  loading: () => <PromptInputTextarea />,
});
