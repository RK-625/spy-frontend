interface TaglineProps {
  className?: string;
}

export default function Tagline({ className = "" }: TaglineProps) {
  return (
    <h1 className={`font-sans font-normal text-[1.25rem] leading-[1.6] text-text-primary max-w-[420px] tracking-[-0.01em] ${className}`}>
      An alien sent to organize your chaos.
    </h1>
  );
}
