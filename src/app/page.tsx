"use client";

import dynamic from "next/dynamic";

const ShaderGradientCanvas = dynamic(
  () =>
    import("@shadergradient/react").then((mod) => ({
      default: mod.ShaderGradientCanvas,
    })),
  { ssr: false },
);
const ShaderGradient = dynamic(
  () =>
    import("@shadergradient/react").then((mod) => ({
      default: mod.ShaderGradient,
    })),
  { ssr: false },
);

import HeroSection from "@/components/hero-section";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Black overlay dissolves slowly — holds near-full opacity for most of the duration */}
      <div className="fixed inset-0 z-50 bg-[#060610] pointer-events-none animate-[dissolve-out_2.5s_linear_0.8s_forwards]" />

      <div className="fixed inset-0 -z-10">
        <ShaderGradientCanvas>
          <ShaderGradient
            animate="on"
            brightness={1.5}
            cAzimuthAngle={250}
            cDistance={1.5}
            cPolarAngle={140}
            cameraZoom={12.5}
            // COLOR NOTES (ShaderGradient with city env + lightType=3d + reflection=0.5):
            // color1=dark body — lower hex = darker (e.g. #4A1280), raise R/G for lighter
            // color2=mid purple — the main visible surface tone
            // color3=lavender highlight — lighter = more pastel/lavender
            // To lighten overall: raise all R/G values relative to B
            // To darken: lower R/G, keep B dominant
            // Target feel: deep purple body fading to lavender highlight
            color1="#4A1280"
            color2="#8838DE"
            color3="#DDB8F8"
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
        <HeroSection />
      </div>
    </div>
  );
}
