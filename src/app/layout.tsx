import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import BackgroundVideo from '@/components/BackgroundVideo';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'VouchPay | Razorpay AI Buildathon',
  description: 'AI-gated transacting agent with spend mandates, audit trails, and payment recovery.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-[#090d12] text-zinc-50 font-sans selection:bg-emerald-500/30 selection:text-white relative">
        {/* Full-viewport cover looping background video */}
        <BackgroundVideo />

        {/* Semi-transparent dark overlay between video and content */}
        <div className="fixed inset-0 bg-black/75 pointer-events-none z-10"></div>

        {/* Content Wrapper */}
        <div className="relative z-20 flex-1 flex flex-col min-h-screen">
          <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-[#090d12]/90 backdrop-blur-md">
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-4">
              
              {/* Logo + Subtitle */}
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-zinc-950 text-base shadow-md group-hover:scale-105 transition-transform duration-200">
                  V
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold tracking-tight text-white text-base leading-tight group-hover:text-emerald-400 transition-colors">
                    VouchPay
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium tracking-normal leading-tight">
                    AI Commerce, Vouched &amp; Bounded
                  </span>
                </div>
              </Link>

              {/* Navigation Links */}
              <nav className="hidden lg:flex items-center gap-7 lg:gap-8 text-sm font-semibold text-zinc-400">
                <Link href="/#product" className="hover:text-white transition-colors">
                  About
                </Link>
                <Link href="/catalog-setup" className="hover:text-white transition-colors">
                  Catalog Setup
                </Link>
                <Link href="/chat" className="hover:text-white transition-colors">
                  AI Chat
                </Link>
                <Link href="/audit-trail" className="hover:text-white transition-colors">
                  Audit Trail
                </Link>
                <Link href="/analytics" className="hover:text-white transition-colors">
                  Analytics
                </Link>
                <Link href="/docs" className="hover:text-white transition-colors">
                  Docs
                </Link>
                <Link href="/#how-it-works" className="hover:text-white transition-colors">
                  Working
                </Link>
              </nav>

              {/* Right Controls: System Status + Get Started CTA */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>System Status</span>
                </div>

                <Link
                  href="/demo"
                  className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-extrabold text-xs rounded-lg transition-colors cursor-pointer shadow-lg shadow-emerald-400/10 flex items-center gap-1.5"
                >
                  <span>Get Started</span>
                </Link>
              </div>

            </div>
          </header>
          <main className="flex-1 flex flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}
