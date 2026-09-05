'use client';

import React from 'react';
import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-10 flex-1 text-zinc-300">
      
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          Documentation &amp; Reference
        </div>
        <h1 className="text-4xl font-extrabold text-white">VouchPay Documentation</h1>
        <p className="text-zinc-400 text-base">
          System architecture, spend mandate specifications, and Razorpay payment integration guide.
        </p>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/catalog-setup" className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-emerald-500/40 transition-colors">
          <div className="text-emerald-400 font-bold text-sm mb-1">Mandate Setup →</div>
          <div className="text-xs text-zinc-400">Configure spend limits and product catalogs.</div>
        </Link>
        <Link href="/chat" className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-indigo-500/40 transition-colors">
          <div className="text-indigo-400 font-bold text-sm mb-1">AI Chat Agent →</div>
          <div className="text-xs text-zinc-400">Interact with Gemini AI agentic web search.</div>
        </Link>
        <Link href="/audit-trail" className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-amber-500/40 transition-colors">
          <div className="text-amber-400 font-bold text-sm mb-1">Audit Log &amp; CSV →</div>
          <div className="text-xs text-zinc-400">Download complete transaction statements.</div>
        </Link>
      </div>

      {/* Specs Content */}
      <div className="space-y-8">
        
        {/* Core Concepts */}
        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4 shadow-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            1. Architecture &amp; Mandate Governance
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            VouchPay acts as an autonomous shopping delegate operating within human-configured guardrails. Before any purchase link is created, the server evaluates candidate transactions against active spend mandates.
          </p>
          <ul className="space-y-2 text-xs font-mono text-zinc-300 bg-[#121214]/90 p-4 rounded-xl border border-white/10">
            <li>• Maximum Spend Limit: Prevents checkout amounts exceeding mandate budget.</li>
            <li>• Category Allowlist: Enforces allowed product categories (e.g. Fitness, Electronics).</li>
            <li>• Mandate Scope Tightness: Auto-selects mandate with tightest matching scope.</li>
            <li>• Expiry Boundaries: Expired mandates automatically block transaction generation.</li>
          </ul>
        </div>

        {/* Razorpay Integration */}
        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4 shadow-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
            2. Razorpay Payment Links &amp; Webhooks
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Upon mandate approval, the server initiates an order and payment link via the official Razorpay Node.js SDK. Payment completion is captured via Razorpay webhooks (`payment.captured`) or return URL redirects.
          </p>
          <div className="bg-[#121214]/90 p-4 rounded-xl border border-white/10 font-mono text-xs text-emerald-400">
            POST /api/checkout &rarr; Razorpay.orders.create() &rarr; Razorpay.paymentLink.create()
          </div>
        </div>

        {/* Audit & CSV Export */}
        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4 shadow-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            3. Immutable Audit Trails &amp; Export Statements
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Every agent action (attempt, approval, decline, retry) is recorded in SQLite (`agent_actions`). Users can filter actions by time range or status, and export statements to CSV.
          </p>
        </div>

      </div>

    </div>
  );
}
