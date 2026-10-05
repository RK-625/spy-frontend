import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";

const unbounded = localFont({
  src: "../../node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2",
  variable: "--font-display",
  weight: "200 900",
  display: "swap",
});

const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-sans",
  display: "swap",
});

// Same face as --font-sans; separate variable for product body tokens (chat CoT / prompt).
const interBody = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-body",
  display: "swap",
});

const vt323 = localFont({
  src: "../../node_modules/@fontsource/vt323/files/vt323-latin-400-normal.woff2",
  variable: "--font-terminal",
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
      className={cn(unbounded.variable, vt323.variable, "font-sans", inter.variable, interBody.variable, "dark")}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col bg-background text-text-primary font-sans">
        {children}
      </body>
    </html>
  );
}
