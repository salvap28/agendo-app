import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { FocusOverlay } from "@/components/focus/FocusOverlay";
import { FloatingFocusPrompt } from "@/components/focus/FloatingFocusPrompt";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agendo",
  description: "Web app premium de productividad construida con Next.js.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background font-sans text-foreground antialiased overflow-x-hidden`}
      >
        {children}
        <FocusOverlay />
        <FloatingFocusPrompt />
      </body>
    </html>
  );
}
