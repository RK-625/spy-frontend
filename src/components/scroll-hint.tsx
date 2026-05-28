export default function ScrollHint() {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 animate-pulse-subtle">
      <div className="w-px h-8 bg-gradient-to-b from-transparent to-text-dim/20" />
    </div>
  );
}
