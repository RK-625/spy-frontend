import type { Metadata } from "next";
import { Unbounded, Inter } from "next/font/google";
import "./globals.css";

const unbounded = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
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
    <html lang="en" className={`${unbounded.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-background text-text-primary font-sans">
        {children}
      </body>
    </html>
  );
}
