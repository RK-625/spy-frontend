/**
 * Model / mode selector primitives for the prompt footer.
 * Thin Popover + Command wrappers — product wiring lives in PromptInputWorkspace.
 */

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import type {
  ComponentProps,
  FunctionComponent,
  SVGProps,
} from "react";
import { cn } from "@/lib/utils";

export type ModelSelectorProps = ComponentProps<typeof Popover>;

export const ModelSelector = (props: ModelSelectorProps) => (
  <Popover {...props} />
);

export type ModelSelectorTriggerProps = ComponentProps<typeof PopoverTrigger>;

export const ModelSelectorTrigger = (props: ModelSelectorTriggerProps) => (
  <PopoverTrigger {...props} />
);

export type ModelSelectorContentProps = ComponentProps<typeof PopoverContent>;

export const ModelSelectorContent = ({
  className,
  children,
  ...props
}: ModelSelectorContentProps) => (
  <PopoverContent
    className={cn(
      "w-[220px] p-0 outline-hidden! border border-[var(--border-subtle)] bg-popover/80 backdrop-blur-[16px] shadow-2xl rounded-[var(--radius)]",
      "[&_[data-slot=command-input]]:text-sm [&_[data-slot=command-empty]]:text-sm",
      "[&_[data-slot=command-input-wrapper]_svg]:!size-4",
      className,
    )}
    sideOffset={12}
    {...props}
  >
    <Command className="**:data-[slot=command-input-wrapper]:h-auto bg-transparent">
      {children}
    </Command>
  </PopoverContent>
);

export type ModelSelectorInputProps = ComponentProps<typeof CommandInput>;

export const ModelSelectorInput = ({
  className,
  ...props
}: ModelSelectorInputProps) => (
  <CommandInput className={cn("h-auto text-sm", className)} {...props} />
);

export type ModelSelectorListProps = ComponentProps<typeof CommandList>;

export const ModelSelectorList = (props: ModelSelectorListProps) => (
  <CommandList {...props} />
);

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

export const ModelSelectorEmpty = (props: ModelSelectorEmptyProps) => (
  <CommandEmpty {...props} />
);

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>;

export const ModelSelectorGroup = ({
  className,
  ...props
}: ModelSelectorGroupProps) => (
  <CommandGroup
    className={cn(
      "**:[[cmdk-group-heading]]:!text-xs",
      className,
    )}
    {...props}
  />
);

export type ModelSelectorItemProps = ComponentProps<typeof CommandItem>;

export const ModelSelectorItem = ({
  className,
  ...props
}: ModelSelectorItemProps) => (
  <CommandItem
    className={cn(
      "text-sm [&_svg:not([class*='size-'])]:size-4",
      className,
    )}
    {...props}
  />
);

export type ModelSelectorLogoProps = {
  icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  className?: string;
} & SVGProps<SVGSVGElement>;

export const ModelSelectorLogo = ({
  icon: Icon,
  className,
  ...props
}: ModelSelectorLogoProps) => {
  const commonClasses = cn("size-4", className);

  return <Icon className={commonClasses} {...props} />;
};

export type ModelSelectorNameProps = ComponentProps<"span">;

export const ModelSelectorName = ({
  className,
  ...props
}: ModelSelectorNameProps) => (
  <span className={cn("flex-1 truncate text-left", className)} {...props} />
);
