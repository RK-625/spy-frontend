import KnowledgeGraph from "@/components/knowledge-graph";
import HeroSection from "@/components/hero-section";
import ScrollHint from "@/components/scroll-hint";
import HowItWorks from "@/components/how-it-works";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col items-center overflow-hidden">
      <KnowledgeGraph />
      <HeroSection />
      <ScrollHint />
      <HowItWorks />
    </div>
  );
}
