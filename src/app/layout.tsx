import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Link from "next/link";
import SearchHeader from "@/components/SearchHeader";
import AdBanner from "@/components/AdBanner";
import PWAInstall from "@/components/PWAInstall";
import LoadingScreen from "@/components/LoadingScreen";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JBCH Word of Life Hub",
  description: "Church video archive designed and developed by haebomsoft",
  manifest: "/manifest.json",
  themeColor: "#09090b",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JBCH Hub",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-zinc-950 text-zinc-100 selection:bg-blue-500/30`}
      >
        <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-zinc-950/70 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                JBCH Word of Life Hub
              </h1>
            </Link>
            <Suspense fallback={<div className="w-8 h-8 rounded-full bg-zinc-800/50" />}>
              <SearchHeader />
            </Suspense>
          </div>
        </header>
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <AdBanner />
        <PWAInstall />
        <LoadingScreen />
        <footer className="py-8 border-t border-white/5 text-center text-sm text-zinc-500">
          <p>© {new Date().getFullYear()} JBCH Word of Life Hub</p>
          <p className="mt-1 text-xs text-zinc-600">Designed & Developed by haebomsoft</p>
        </footer>
      </body>
    </html>
  );
}
