"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { createContext, memo, useContext, useMemo } from "react";
import { DotMatrixIcon } from "@/components/chat/ai-elements/dot-matrix-icons";
import type { DotMatrixIconName } from "@/components/chat/ai-elements/dot-matrix-icons";
import { Shimmer } from "./shimmer";

// ─── Context ──────────────────────────────────────────────────────────────────

interface ChainOfThoughtContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(
  null,
);

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext);
  if (!context) {
    throw new Error(
      "ChainOfThought components must be used within ChainOfThought",
    );
  }
  return context;
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export type ChainOfThoughtProps = ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  isStreaming?: boolean;
  /** Total steps count for the header badge */
  stepCount?: number;
};

export const ChainOfThought = memo(
  ({
    className,
    open,
    defaultOpen = false,
    onOpenChange,
    isStreaming = false,
    stepCount,
    children,
    ...props
  }: ChainOfThoughtProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      defaultProp: defaultOpen,
      onChange: onOpenChange,
      prop: open,
    });

    const ctx = useMemo(
      () => ({ isOpen: isOpen ?? defaultOpen, setIsOpen }),
      [isOpen, setIsOpen, defaultOpen],
    );

    return (
      <ChainOfThoughtContext.Provider value={ctx}>
        <div className={cn("not-prose mb-2 w-full", className)} {...props}>
          {/* Header trigger */}
          <ChainOfThoughtHeader
            isStreaming={isStreaming}
            stepCount={stepCount}
          />
          {/* Steps body */}
          <ChainOfThoughtContent>{children}</ChainOfThoughtContent>
        </div>
      </ChainOfThoughtContext.Provider>
    );
  },
);

// ─── Header ───────────────────────────────────────────────────────────────────

type ChainOfThoughtHeaderProps = {
  isStreaming?: boolean;
  stepCount?: number;
  className?: string;
};

const ChainOfThoughtHeader = memo(
  ({ isStreaming, stepCount, className }: ChainOfThoughtHeaderProps) => {
    const { isOpen, setIsOpen } = useChainOfThought();

    return (
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "group relative flex w-full items-center gap-3 text-sm transition-colors",
          "text-[#9a8cc0] hover:text-[#e8dff8]",
          className,
        )}
      >
        {/* Pixel brain icon */}
        <div className="relative flex w-5 flex-col items-center justify-center">
          <DotMatrixIcon name="bulb" size={14} className="shrink-0 opacity-70" />
          {isOpen && (
            <div className="absolute top-[20px] -bottom-[12px] w-px bg-[rgba(200,172,251,0.15)]" />
          )}
        </div>

        <span className="text-left font-[family-name:var(--font-terminal)] text-[0.9rem] tracking-widest uppercase transition-colors">
          Reasoning
        </span>

        {stepCount !== undefined && stepCount > 0 && (
          <span className="rounded-full bg-[rgba(200,172,251,0.12)] px-2 py-0.5 font-[family-name:var(--font-terminal)] text-[0.6rem] text-[#C8ACFB] tracking-widest">
            {stepCount} steps
          </span>
        )}

        <DotMatrixIcon
          name="chevronDown"
          size={12}
          className={cn(
            "shrink-0 transition-transform duration-200 opacity-50",
            isOpen ? "rotate-180" : "rotate-0",
          )}
        />
      </button>
    );
  },
);

// ─── Content wrapper ──────────────────────────────────────────────────────────

export type ChainOfThoughtContentProps = ComponentProps<
  typeof CollapsibleContent
>;

export const ChainOfThoughtContent = memo(
  ({ className, children, ...props }: ChainOfThoughtContentProps) => {
    const { isOpen } = useChainOfThought();

    return (
      <Collapsible open={isOpen}>
        <CollapsibleContent
          className={cn(
            "space-y-0",
            "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
            className,
          )}
          {...props}
        >
          {children}
        </CollapsibleContent>
      </Collapsible>
    );
  },
);

// ─── Step ─────────────────────────────────────────────────────────────────────

export type ChainOfThoughtStepStatus = "active" | "complete" | "pending";

export type ChainOfThoughtStepProps = ComponentProps<"div"> & {
  icon?: DotMatrixIconName;
  label: ReactNode;
  description?: ReactNode;
  status?: ChainOfThoughtStepStatus;
  isLast?: boolean;
};

const stepIconColors: Record<ChainOfThoughtStepStatus, string> = {
  active: "text-[#C8ACFB]",
  complete: "text-[#7a7685]",
  pending: "text-[#4a4658]",
};

const stepLabelColors: Record<ChainOfThoughtStepStatus, string> = {
  active: "text-[#e8dff8]",
  complete: "text-[#9a8cc0]",
  pending: "text-[#4a4658]",
};

export const ChainOfThoughtStep = memo(
  ({
    className,
    icon = "cornerDownLeft",
    label,
    description,
    status = "complete",
    isLast = false,
    children,
    ...props
  }: ChainOfThoughtStepProps) => (
    <div
      className={cn(
        "relative flex gap-3 text-sm",
        "fade-in-0 slide-in-from-top-2 animate-in duration-300",
        className,
      )}
      {...props}
    >
      {/* Icon + connector line */}
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full",
            "border border-[rgba(200,172,251,0.15)] bg-[rgba(14,7,32,0.8)]",
            stepIconColors[status],
          )}
        >
          <DotMatrixIcon name={icon} size={10} />
        </div>
        {/* Vertical connector — always draw unless isLast */}
        {!isLast && (
          <div className="w-px flex-1 bg-[rgba(200,172,251,0.15)]" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex-1 space-y-2 overflow-hidden pb-4",
          isLast && "pb-0",
        )}
      >
        <div className={cn("leading-snug", stepLabelColors[status])}>
          {label}
        </div>
        {description && (
          <div className="text-[0.7rem] text-[#4a4658]">{description}</div>
        )}
        {children}
      </div>
    </div>
  ),
);

// ─── Search Results (URL badges) ──────────────────────────────────────────────

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">;

export const ChainOfThoughtSearchResults = memo(
  ({ className, ...props }: ChainOfThoughtSearchResultsProps) => (
    <div
      className={cn("flex flex-wrap items-center gap-1.5 mt-1.5", className)}
      {...props}
    />
  ),
);

export type ChainOfThoughtSearchResultProps = ComponentProps<"a"> & {
  favicon?: string;
};

export const ChainOfThoughtSearchResult = memo(
  ({
    className,
    children,
    href,
    favicon,
    ...props
  }: ChainOfThoughtSearchResultProps) => {
    const domain = href
      ? new URL(href).hostname.replace("www.", "")
      : undefined;

    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1",
          "border border-[rgba(200,172,251,0.12)] bg-[rgba(200,172,251,0.06)]",
          "font-[family-name:var(--font-body)] text-[0.65rem] text-[#9a8cc0]",
          "transition-colors hover:border-[rgba(200,172,251,0.25)] hover:text-[#e8dff8]",
          className,
        )}
        {...props}
      >
        {favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={favicon} alt="" className="size-3 rounded-full" />
        ) : (
          <DotMatrixIcon name="globe" size={9} className="opacity-60" />
        )}
        <span>{children ?? domain}</span>
      </a>
    );
  },
);

// ─── Done indicator ───────────────────────────────────────────────────────────

export const ChainOfThoughtDone = memo(
  ({ className }: { className?: string }) => (
    <div
      className={cn(
        "flex items-center gap-3 text-[0.7rem] text-[#7a7685] font-[family-name:var(--font-terminal)] tracking-widest uppercase",
        "fade-in-0 animate-in duration-500",
        className,
      )}
    >
      <div className="relative flex w-5 flex-col items-center justify-center">
        <DotMatrixIcon name="check" size={10} className="text-[#C8ACFB] z-10 bg-[rgba(14,7,32,0.8)] rounded-full" />
      </div>
      Done
    </div>
  ),
);

// ─── Display names ────────────────────────────────────────────────────────────

ChainOfThought.displayName = "ChainOfThought";
ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader";
ChainOfThoughtContent.displayName = "ChainOfThoughtContent";
ChainOfThoughtStep.displayName = "ChainOfThoughtStep";
ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults";
ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult";
ChainOfThoughtDone.displayName = "ChainOfThoughtDone";
