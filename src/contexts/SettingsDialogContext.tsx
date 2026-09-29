"use client";

/**
 * Lets any workspace surface (sidebar, model picker) open Settings on a
 * given pane. The dialog itself is rendered once, by the sidebar.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SettingsPaneId } from "@/components/chat/overlays/settings";

interface SettingsDialogContextValue {
  isSettingsOpen: boolean;
  settingsPaneId: SettingsPaneId;
  openSettings: (paneId?: SettingsPaneId) => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsPaneId: (paneId: SettingsPaneId) => void;
}

const SettingsDialogContext = createContext<SettingsDialogContextValue | null>(null);

export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [settingsPaneId, setSettingsPaneId] = useState<SettingsPaneId>("general");

  const openSettings = useCallback((paneId?: SettingsPaneId) => {
    if (paneId) setSettingsPaneId(paneId);
    setSettingsOpen(true);
  }, []);

  const value = useMemo(
    () => ({ isSettingsOpen, settingsPaneId, openSettings, setSettingsOpen, setSettingsPaneId }),
    [isSettingsOpen, settingsPaneId, openSettings],
  );

  return <SettingsDialogContext.Provider value={value}>{children}</SettingsDialogContext.Provider>;
}

export function useSettingsDialog(): SettingsDialogContextValue {
  const value = useContext(SettingsDialogContext);
  if (!value) {
    throw new Error("useSettingsDialog must be used within a SettingsDialogProvider");
  }
  return value;
}
