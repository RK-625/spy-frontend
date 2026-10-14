export interface SettingsPaneHeaderProps {
  title: string;
  description: string;
}

export function SettingsPaneHeader({ title, description }: SettingsPaneHeaderProps) {
  return (
    <div>
      <h3 className="text-base font-medium text-text-primary">{title}</h3>
      <p className="mt-0.5 text-sm text-lavender-muted">{description}</p>
    </div>
  );
}

/** Bordered card that groups one setting or readout inside a pane. */
export const SETTINGS_CARD_CLASS =
  "rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3";
export const SETTINGS_CARD_LABEL_CLASS =
  "mb-1 text-[0.7rem] tracking-wider text-text-secondary uppercase";
