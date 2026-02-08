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
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <header className="p-4 border-b">
          <h1 className="text-xl font-bold">Church Video App</h1>
        </header>
        <main className="flex-grow">
          {children}
        </main>
        <footer className="p-4 border-t text-center text-sm text-gray-500">
          Powered by Next.js & Vercel
        </footer>
      </body>
    </html>
  );
}
