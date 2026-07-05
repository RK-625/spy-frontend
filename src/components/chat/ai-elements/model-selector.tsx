import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { Openai } from "@/components/ui/svgs/openai";
import { AnthropicWhite } from "@/components/ui/svgs/anthropicWhite";
import { Google } from "@/components/ui/svgs/google";
import { Deepseek } from "@/components/ui/svgs/deepseek";


export type ModelSelectorProps = ComponentProps<typeof Popover>;

export const ModelSelector = (props: ModelSelectorProps) => (
  <Popover {...props} />
);

export type ModelSelectorTriggerProps = ComponentProps<typeof PopoverTrigger>;

export const ModelSelectorTrigger = (props: ModelSelectorTriggerProps) => (
  <PopoverTrigger {...props} />
);

export type ModelSelectorContentProps = ComponentProps<
  typeof PopoverContent
> & {
  title?: ReactNode;
};

export const ModelSelectorContent = ({
  className,
  children,
  title = "Model Selector",
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

export type ModelSelectorDialogProps = ComponentProps<typeof Popover>; // Fallback

export const ModelSelectorDialog = (props: ModelSelectorDialogProps) => (
  <Popover {...props} />
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

export type ModelSelectorShortcutProps = ComponentProps<typeof CommandShortcut>;

export const ModelSelectorShortcut = (props: ModelSelectorShortcutProps) => (
  <CommandShortcut {...props} />
);

export type ModelSelectorSeparatorProps = ComponentProps<
  typeof CommandSeparator
>;

export const ModelSelectorSeparator = (props: ModelSelectorSeparatorProps) => (
  <CommandSeparator {...props} />
);

export type ModelSelectorLogoProps = {
  icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  className?: string;
} & React.SVGProps<SVGSVGElement>;

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
