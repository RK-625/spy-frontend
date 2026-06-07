import type { Metadata } from "next";
import { Unbounded, Inter, VT323 } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const unbounded = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const vt323 = VT323({
  variable: "--font-terminal",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Spy — An alien sent to organize your chaos.",
  description:
    "Spy is an agent-first knowledge base. Throw messy information at Spy, and it weaves a knowledge graph for you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(unbounded.variable, vt323.variable, "font-sans", inter.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col bg-background text-text-primary font-sans">
        {children}
      </body>
    </html>
  );
}
