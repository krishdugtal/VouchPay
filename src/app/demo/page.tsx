'use client';

import React from 'react';
import Link from 'next/link';

export default function DemoHubPage() {
  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-12 lg:py-16 space-y-10 flex-1 flex flex-col justify-center items-center">
      
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          Interactive Demo Hub
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
          Choose Where to Begin
        </h1>
        <p className="text-zinc-400 text-base sm:text-lg">
          Select an entry point below to explore the VouchPay workflow.
        </p>
      </div>

      {/* 3 Clickable Demo Hub Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl pt-4">
        
        {/* Card 1: Catalog & Mandate Setup */}
        <Link
          href="/catalog-setup"
          className="p-8 bg-zinc-900/90 border border-zinc-800 hover:border-emerald-500/50 backdrop-blur-md rounded-2xl space-y-5 transition-all duration-200 group cursor-pointer shadow-2xl flex flex-col justify-between hover:-translate-y-1"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-bold group-hover:scale-110 transition-transform">
              ⚙️
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                Catalog &amp; Mandate Setup
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Configure spend limits and register products for agentic search and transacting.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold text-emerald-400">
            <span>Configure Limits</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>

        {/* Card 2: AI Chat */}
        <Link
          href="/chat"
          className="p-8 bg-zinc-900/90 border border-zinc-800 hover:border-indigo-500/50 backdrop-blur-md rounded-2xl space-y-5 transition-all duration-200 group cursor-pointer shadow-2xl flex flex-col justify-between hover:-translate-y-1"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl font-bold group-hover:scale-110 transition-transform">
              💬
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                AI Chat
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Make a purchase request in natural language with live web search and Razorpay checkout.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold text-indigo-400">
            <span>Launch Agent</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>

        {/* Card 3: Audit Trail */}
        <Link
          href="/audit-trail"
          className="p-8 bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/50 backdrop-blur-md rounded-2xl space-y-5 transition-all duration-200 group cursor-pointer shadow-2xl flex flex-col justify-between hover:-translate-y-1"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl font-bold group-hover:scale-110 transition-transform">
              📋
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                Audit Trail
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Inspect the complete decision and payment log with live time range filtering and CSV export.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold text-amber-400">
            <span>Inspect Trail</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>

      </div>

    </div>
  );
}
