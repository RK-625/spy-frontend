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
