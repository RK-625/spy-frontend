"use client";

import { DotMatrixIcon, type DotMatrixIconName } from "@/components/dotmatrix";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { cn } from "@/lib/utils";
import type { ComponentProps, HTMLAttributes } from "react";

export type ChatActionRailProps = HTMLAttributes<HTMLDivElement> & {
  reveal?: "always" | "hover";
};

export const ChatActionRail = ({
  reveal = "always",
  className,
  ...props
}: ChatActionRailProps) => (
  <div
    role="group"
    aria-label="Message actions"
    className={cn(
      "flex h-6 w-fit items-center gap-0.5 bg-transparent",
      reveal === "hover" &&
        "opacity-0 pointer-events-none transition-opacity duration-150 ease-out [@media(pointer:fine)]:group-hover/bubble:pointer-events-auto [@media(pointer:fine)]:group-hover/bubble:opacity-100",
      className,
    )}
    {...props}
  />
);

export type ChatActionButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "size" | "variant"
> & {
  label: string;
  icon: DotMatrixIconName;
};

export const ChatActionButton = ({
  label,
  icon,
  className,
  type = "button",
  ...props
}: ChatActionButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        aria-label={label}
        className={cn(
          "text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground",
          className,
        )}
        size="icon-xs"
        type={type}
        variant="ghost"
        {...props}
        tabIndex={-1}
      >
        <DotMatrixIcon
          className="cursor-default"
          name={icon}
          size={ICON_GLYPH.badge}
        />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom">{label}</TooltipContent>
  </Tooltip>
);
