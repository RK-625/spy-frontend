interface LogoProps {
  className?: string;
}

export default function Logo({ className = "" }: LogoProps) {
  return (
    <span className={`font-display font-semibold text-[0.7rem] tracking-[0.4em] text-text-secondary select-none ${className}`}>
      S P Y
    </span>
  );
}
