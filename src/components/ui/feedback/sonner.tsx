"use client";

import type { CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";
import { Check, Lightbulb, X } from "lucide-react";
import { Spinner } from "./spinner";
import { ICON_GLYPH } from "@/lib/icon-tokens";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <Check
            size={ICON_GLYPH.inline}
            strokeWidth={1.5}
            className="size-4"
          />
        ),
        info: (
          <Lightbulb
            size={ICON_GLYPH.inline}
            strokeWidth={1.5}
            className="size-4"
          />
        ),
        warning: (
          <Lightbulb
            size={ICON_GLYPH.inline}
            strokeWidth={1.5}
            className="size-4"
          />
        ),
        error: (
          <X size={ICON_GLYPH.inline} strokeWidth={1.5} className="size-4" />
        ),
        loading: <Spinner className="size-4" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

/** Product toast host name — prefer over package `Toaster`. */
const AppToaster = Toaster;

export { Toaster, AppToaster, toast };
