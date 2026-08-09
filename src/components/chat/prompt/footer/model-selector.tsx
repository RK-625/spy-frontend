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
      "w-[170px] p-0 outline-hidden! border border-[var(--border-subtle)] bg-popover/80 backdrop-blur-[16px] shadow-2xl rounded-[var(--radius)]",
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
  <CommandInput className={cn("h-auto", className)} {...props} />
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

export const ModelSelectorGroup = (props: ModelSelectorGroupProps) => (
  <CommandGroup {...props} />
);

export type ModelSelectorItemProps = ComponentProps<typeof CommandItem>;

export const ModelSelectorItem = (props: ModelSelectorItemProps) => (
  <CommandItem {...props} />
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
  const commonClasses = cn("size-2.5", className);

  return <Icon className={commonClasses} {...props} />;
};

export type ModelSelectorNameProps = ComponentProps<"span">;

export const ModelSelectorName = ({
  className,
  ...props
}: ModelSelectorNameProps) => (
  <span className={cn("flex-1 truncate text-left", className)} {...props} />
);
