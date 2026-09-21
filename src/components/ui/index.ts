/**
 * Design-system barrel — role folders only (no flat dual-export shims).
 * Product code: import from `@/components/ui` only.
 * Inside ui/* modules: use relative imports (never this barrel — avoids cycles).
 * AppToaster / toast ship from `./feedback/sonner`.
 */
export * from "./actions/button";
export * from "./actions/button-group";
export * from "./forms/input";
export * from "./forms/textarea";
export * from "./forms/input-group";
export * from "./overlays/dialog";
export * from "./overlays/popover";
export * from "./overlays/dropdown-menu";
export * from "./overlays/tooltip";
export * from "./feedback/sonner";
export * from "./feedback/spinner";
export * from "./layout/card";
export * from "./layout/separator";
export * from "./layout/collapsible";
export * from "./navigation/command";
