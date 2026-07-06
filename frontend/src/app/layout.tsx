import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Local Media Brain - 100% Offline AI",
  description: "Offline semantic index, speaker transcript diarization, knowledge graph visualizer and RAG notebook running locally.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex text-zinc-100 font-sans bg-[#060608] relative overflow-x-hidden">
        {/* Ambient background glow blobs for glassmorphism refraction */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-900/10 blur-[130px] pointer-events-none z-0" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-indigo-900/8 blur-[130px] pointer-events-none z-0" />
        <div className="absolute top-[30%] left-[30%] w-[40vw] h-[40vw] rounded-full bg-purple-950/15 blur-[120px] pointer-events-none z-0" />
        <div className="absolute bottom-[20%] left-[-10%] w-[35vw] h-[35vw] rounded-full bg-violet-900/5 blur-[100px] pointer-events-none z-0" />

        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Global Layout Wrapper */}
        <div className="flex-1 flex flex-col min-h-screen ml-64 overflow-hidden relative z-10">
          {/* Global Header */}
          <Header />
          
          {/* Main Content Workspace with transparent background to allow glows to pass through */}
          <main className="flex-1 p-8 overflow-y-auto bg-transparent">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
