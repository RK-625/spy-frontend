const STEPS = [
  {
    num: "1",
    title: "Throw your thoughts",
    desc: "Dump ideas, notes, fragments. Messy is fine. Spy prefers it raw.",
  },
  {
    num: "2",
    title: "Spy weaves the web",
    desc: "The agent finds connections between your concepts and links them.",
  },
  {
    num: "3",
    title: "Your graph grows",
    desc: "Watch your knowledge connect. Remember more, forget less.",
  },
];

export default function HowItWorks() {
  return (
    <section className="relative z-10 w-full max-w-[720px] mx-auto px-8 pb-24 pt-16">
      <h2 className="font-display font-semibold text-[0.75rem] tracking-[0.08em] text-text-dim text-center mb-12">
        How Spy works
      </h2>
      <div className="flex gap-12 justify-center">
        {STEPS.map((step) => (
          <div
            key={step.num}
            className="flex-1 flex flex-col items-center text-center gap-3 max-w-[200px]"
          >
            <div className="w-8 h-8 border border-border-strong flex items-center justify-center font-display text-[0.65rem] font-medium text-accent">
              {step.num}
            </div>
            <h3 className="font-display font-medium text-[0.8rem] text-text-primary tracking-[0.02em]">
              {step.title}
            </h3>
            <p className="font-sans text-[0.75rem] leading-[1.7] text-text-secondary">
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
