"use client";

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
        "transition-opacity duration-150 ease-out [@media(pointer:fine)]:pointer-events-none [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover/bubble:pointer-events-auto [@media(pointer:fine)]:group-hover/bubble:opacity-100",
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
  icon: LucideIcon;
};

export const ChatActionButton = ({
  label,
  icon: Icon,
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
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={Icon.displayName ?? label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            <Icon
              size={ICON_GLYPH.badge}
              strokeWidth={1.5}
              className="cursor-default"
            />
          </motion.span>
        </AnimatePresence>
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom">{label}</TooltipContent>
  </Tooltip>
);
