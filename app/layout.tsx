import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { FocusOverlay } from "@/components/focus/FocusOverlay";
import { LanguageSync } from "@/components/providers/LanguageSync";
import { getServerLanguage } from "@/lib/i18n/server";
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
  description: "Premium personal clarity system built with Next.js.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getServerLanguage();

  return (
    <html lang={language} className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background font-sans text-foreground antialiased overflow-x-hidden`}
        suppressHydrationWarning
      >
        <LanguageSync />
        {children}
        <FocusOverlay />
      </body>
    </html>
  );
}
