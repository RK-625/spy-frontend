"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type GraphPaneContextValue = {
  open: boolean;
  toggle: () => void;
  close: () => void;
};

const GraphPaneContext = createContext<GraphPaneContextValue | null>(null);

export function GraphPaneProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") {
        return;
      }
      if (target.closest("[data-graph-pane]")) {
        return;
      }
      if (
        target.closest(
          'button, a, input, textarea, select, [role="button"], [contenteditable="true"]',
        )
      ) {
        return;
      }
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [open ]);

  const value = useMemo(
    () => ({ open, toggle, close }),
    [open, toggle, close],
  );

  return (
    <GraphPaneContext.Provider value={value}>
      {children}
    </GraphPaneContext.Provider>
  );
}

export function useGraphPane(): GraphPaneContextValue {
  const value = useContext(GraphPaneContext);
  if (!value) {
    throw new Error("useGraphPane must be used within GraphPaneProvider");
  }
  return value;
}
