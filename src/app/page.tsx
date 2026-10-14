"use client";

import dynamic from "next/dynamic";
import { useThemeTokens } from "@/components/theme";

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

import HeroSection from "@/components/landing/hero-section";

const SPHERE_TOKEN_NAMES = [
  "--landing-sphere-body",
  "--landing-sphere-surface",
  "--landing-sphere-highlight",
] as const;

export default function LandingPage() {
  const sphereTokens = useThemeTokens(SPHERE_TOKEN_NAMES);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Page-colored overlay dissolves slowly — holds near-full opacity for most of the duration */}
      <div className="fixed inset-0 z-50 bg-background pointer-events-none animate-[dissolve-out_2.5s_linear_0.8s_forwards]" />

      <div className="fixed inset-0 -z-10">
        {sphereTokens && (
          <ShaderGradientCanvas>
            <ShaderGradient
              animate="on"
              brightness={1.5}
              cAzimuthAngle={250}
              cDistance={1.5}
              cPolarAngle={140}
              cameraZoom={12.5}
              // Colors are the --landing-sphere-* palette tokens (city env + lightType=3d + reflection=0.5):
              // body = darkest tone, surface = main visible tone, highlight = pastel rim.
              color1={sphereTokens["--landing-sphere-body"]}
              color2={sphereTokens["--landing-sphere-surface"]}
              color3={sphereTokens["--landing-sphere-highlight"]}
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
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <HeroSection />
      </div>
    </div>
  );
}
