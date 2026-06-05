import KnowledgeGraph from "@/components/knowledge-graph";
import HeroSection from "@/components/hero-section";
import ScrollHint from "@/components/scroll-hint";
import HowItWorks from "@/components/how-it-works";
import NoiseFieldBg from "@/components/noise-field-bg";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col items-center overflow-hidden">
      // TODO: Makeing motion based home page here with transiction int eh backgrond here and other animations inclding the mascot here
      <NoiseFieldBg /> 
      {/* <KnowledgeGraph />
      <HeroSection />
      <ScrollHint />
      <HowItWorks /> */}
    </div>
  );
}
