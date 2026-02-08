import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Church Video",
  description: "Church Video Application",
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
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Church Video Archive
            </h1>
            {/* Placeholder for future nav or search */}
            <div className="w-8 h-8 rounded-full bg-zinc-800/50 flex items-center justify-center text-xs text-zinc-500">
              🔎
            </div>
          </div>
        </header>
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="py-8 border-t border-white/5 text-center text-sm text-zinc-500">
          <p>© {new Date().getFullYear()} Church Video Archive</p>
          <p className="mt-1 text-xs text-zinc-600">Powered by Next.js & Synology</p>
        </footer>
      </body>
    </html>
  );
}
