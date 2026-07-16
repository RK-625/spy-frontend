import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { DotMatrixIcon } from "@/components/dotmatrix/icons";
import { WIDGET, WIDGET_TYPE } from "@/deprecated/ask-user-question-widget/widget-layout";

export interface InteractiveQuestionProps {
  question: string;
  options: string[];
  allowCustomInput?: boolean;
  onSelect: (value: string) => void;
}

// -----------------------------------------------------------------------------
// Variant A: Stacked Minimal
// Vertically stacked ghost buttons, numbers (1, 2, 3) in VT323 font aligned left.
// Minimal borders.
// -----------------------------------------------------------------------------
export function InteractiveQuestionVariantA({
  question,
  options,
  allowCustomInput,
  onSelect,
}: InteractiveQuestionProps) {
  const [customValue, setCustomValue] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customValue.trim()) {
      onSelect(customValue.trim());
    }
  };

  return (
    <div 
      className="flex flex-col w-full max-w-md font-sans"
      style={{ gap: WIDGET.STACK_GAP }}
    >
      <h3 className={WIDGET_TYPE.question} style={{ paddingLeft: WIDGET.PAD_X }}>{question}</h3>
      <div className="flex flex-col" style={{ gap: WIDGET.STACK_GAP }}>
        {options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(option)}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="group relative flex items-center w-full bg-transparent hover:bg-accent/10 border border-[rgba(200,172,251,0.08)] hover:border-[rgba(200,172,251,0.2)] rounded-[var(--radius)] transition-all duration-200"
            style={{
              paddingLeft: WIDGET.PAD_X,
              paddingRight: WIDGET.PAD_X,
              paddingTop: WIDGET.ROW_PAD_Y,
              paddingBottom: WIDGET.ROW_PAD_Y,
              gap: WIDGET.ROW_GAP,
            }}
          >
            <span 
              className={cn(WIDGET_TYPE.number, "flex items-center justify-center group-hover:text-[#e8dff8] flex-shrink-0")}
              style={{ width: WIDGET.BADGE, height: WIDGET.BADGE }}
            >
              {idx + 1}
            </span>
            <span className={cn(WIDGET_TYPE.option, "group-hover:text-[#f0eaff] text-left flex-grow min-w-0")}>
              {option}
            </span>
            <div
              className={cn(
                "ml-auto transition-opacity duration-200 text-[#e8dff8] flex-shrink-0",
                hoveredIndex === idx ? "opacity-100" : "opacity-0"
              )}
            >
              <DotMatrixIcon name="arrowUp" size={16} className="rotate-90" />
            </div>
          </button>
        ))}
      </div>
      {allowCustomInput && (
        <form onSubmit={handleCustomSubmit} className="relative hover:bg-accent/10 rounded-[var(--radius)] transition-colors" style={{ paddingLeft: WIDGET.PAD_X, paddingRight: WIDGET.PAD_X, paddingTop: WIDGET.ROW_PAD_Y, paddingBottom: WIDGET.ROW_PAD_Y }}>
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Or type your own..."
            className={cn(
              WIDGET_TYPE.input,
              "w-full bg-transparent placeholder:text-[#7a7685] focus:outline-none"
            )}
          />
          {customValue.trim() && (
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#150c28] bg-[#e8dff8] p-1.5 rounded-[var(--radius)] hover:bg-[#f0eaff] transition-colors"
            >
              <DotMatrixIcon name="arrowUp" size={14} />
            </button>
          )}
        </form>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Variant B: Alien Terminal
// High-contrast borders, more aggressive VT323 styling, input field looks like
// a command prompt.
// -----------------------------------------------------------------------------
export function InteractiveQuestionVariantB({
  question,
  options,
  allowCustomInput,
  onSelect,
}: InteractiveQuestionProps) {
  const [customValue, setCustomValue] = useState("");

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customValue.trim()) {
      onSelect(customValue.trim());
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-md bg-[#150c28] p-5 border border-[rgba(200,172,251,0.2)] rounded-[var(--radius)] shadow-[0_0_15px_rgba(200,172,251,0.05)]">
      <div className="flex items-start gap-2 mb-2">
        <DotMatrixIcon name="chevronRight" size={16} className="text-[#c8acfb] mt-0.5" />
        <h3 className="font-vt323 text-[#ded4f0] text-lg leading-tight uppercase tracking-wide">
          {question}
        </h3>
      </div>
      <div className="flex flex-col gap-2 pl-6">
        {options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(option)}
            className="group flex items-center gap-3 w-full px-3 py-2 text-left bg-[rgba(10,5,22,0.8)] border border-[rgba(200,172,251,0.1)] hover:border-[rgba(200,172,251,0.4)] hover:bg-[rgba(200,172,251,0.05)] rounded-[var(--radius)] transition-all duration-150"
          >
            <span className="font-vt323 text-[#7a7685] group-hover:text-[#c8acfb] text-base">
              [{idx + 1}]
            </span>
            <span className="font-vt323 text-[#e8e4df] group-hover:text-[#e8dff8] text-lg tracking-wide">
              {option}
            </span>
          </button>
        ))}
      </div>
      {allowCustomInput && (
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 pl-6 mt-2 relative">
          <span className="font-vt323 text-[#c8acfb] text-lg">_&gt;</span>
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="INPUT COMMAND..."
            className="w-full bg-transparent font-vt323 text-[#e8dff8] text-lg tracking-wide placeholder:text-[#4a4658] focus:outline-none border-b border-dashed border-[rgba(200,172,251,0.2)] focus:border-[#e8dff8] transition-colors pb-1"
          />
          {customValue.trim() && (
            <button
              type="submit"
              className="absolute right-0 text-[#e8dff8] hover:text-[#f0eaff] transition-colors"
            >
              <DotMatrixIcon name="cornerDownLeft" size={16} />
            </button>
          )}
        </form>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Variant C: Horizontal / Compact
// A wrap layout for shorter options, feeling more like suggestion chips but
// with distinct selection states.
// -----------------------------------------------------------------------------
export function InteractiveQuestionVariantC({
  question,
  options,
  allowCustomInput,
  onSelect,
}: InteractiveQuestionProps) {
  const [customValue, setCustomValue] = useState("");

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customValue.trim()) {
      onSelect(customValue.trim());
    }
  };

  return (
    <div 
      className="flex flex-col w-full max-w-lg font-sans"
      style={{ gap: WIDGET.STACK_GAP }}
    >
      <div className="flex items-center gap-2 px-1">
        <DotMatrixIcon name="bulb" size={14} className="text-[#9a8cc0]" />
        <h3 className={WIDGET_TYPE.question}>{question}</h3>
      </div>
      <div className="flex flex-wrap" style={{ gap: WIDGET.STACK_GAP }}>
        {options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(option)}
            className="flex items-center bg-[rgba(14,7,32,0.5)] border border-[rgba(200,172,251,0.1)] hover:border-[rgba(232,223,248,0.3)] hover:bg-[rgba(232,223,248,0.06)] rounded-[var(--radius)] transition-all duration-200"
            style={{
              paddingLeft: WIDGET.PAD_X,
              paddingRight: WIDGET.PAD_X,
              paddingTop: WIDGET.ROW_PAD_Y,
              paddingBottom: WIDGET.ROW_PAD_Y,
            }}
          >
            <span className={cn(WIDGET_TYPE.option, "hover:text-[#f0eaff]")}>
              {option}
            </span>
          </button>
        ))}
      </div>
      {allowCustomInput && (
        <form onSubmit={handleCustomSubmit} className="relative max-w-sm">
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Other..."
            className={cn(
              WIDGET_TYPE.input,
              "w-full bg-[rgba(14,7,32,0.3)] placeholder:text-[#7a7685] rounded-[var(--radius)] border border-[rgba(200,172,251,0.1)] focus:border-[#e8dff8] focus:bg-[rgba(14,7,32,0.6)] focus:outline-none transition-all duration-200"
            )}
            style={{
              paddingLeft: WIDGET.PAD_X,
              paddingRight: WIDGET.PAD_X,
              paddingTop: WIDGET.ROW_PAD_Y,
              paddingBottom: WIDGET.ROW_PAD_Y,
            }}
          />
          {customValue.trim() && (
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#e8dff8] hover:text-[#f0eaff]"
            >
              <DotMatrixIcon name="arrowUp" size={14} className="rotate-90" />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
