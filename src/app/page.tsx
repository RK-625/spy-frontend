'use client'

import dynamic from "next/dynamic"

const ShaderGradientCanvas = dynamic(
  () => import("@shadergradient/react").then((mod) => ({ default: mod.ShaderGradientCanvas })),
  { ssr: false }
)
const ShaderGradient = dynamic(
  () => import("@shadergradient/react").then((mod) => ({ default: mod.ShaderGradient })),
  { ssr: false }
)

import HeroSection from "@/components/hero-section";
import ScrollHint from "@/components/scroll-hint";
import HowItWorks from "@/components/how-it-works";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <ShaderGradientCanvas>
          <ShaderGradient
            animate="on"
            brightness={1.5}
            cAzimuthAngle={250}
            cDistance={1.5}
            cPolarAngle={140}
            cameraZoom={12.5}
            color1="#809bd6"
            color2="#910aff"
            color3="#af38ff"
            envPreset="city"
            grain="on"
            lightType="3d"
            positionX={0}
            positionY={0}
            positionZ={0}
            reflection={0.5}
            rotationX={0}
            rotationY={0}
            rotationZ={140}
            shader="defaults"
            type="sphere"
            uAmplitude={7}
            uDensity={0.8}
            uFrequency={5.5}
            uSpeed={0.3}
            uStrength={0.4}
            uTime={0}
            wireframe={false}
          />
        </ShaderGradientCanvas>
      </div>
      <div className="relative z-10 flex flex-col items-center">
        {/* <HeroSection />
        <ScrollHint />
        <HowItWorks /> */}
      </div>
    </div>
  );
}
