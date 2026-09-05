'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface ActivityDay {
  date: string;
  label: string;
  count: number;
  amount: number;
}

interface AnalyticsData {
  totalSpent: number;
  successfulCount: number;
  declinedCount: number;
  totalDecisions: number;
  approvalRate: number;
  activity7Days: ActivityDay[];
}

export default function Home() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<ActivityDay | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      const res = await fetch('/api/analytics');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load telemetry for homepage:', err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate coordinates for 7-day SVG Line Chart
  const days = data?.activity7Days || [
    { date: '1', label: 'Day 1', count: 0, amount: 0 },
    { date: '2', label: 'Day 2', count: 0, amount: 0 },
    { date: '3', label: 'Day 3', count: 0, amount: 0 },
    { date: '4', label: 'Day 4', count: 0, amount: 0 },
    { date: '5', label: 'Day 5', count: 0, amount: 0 },
    { date: '6', label: 'Day 6', count: 0, amount: 0 },
    { date: '7', label: 'Day 7', count: 0, amount: 0 }
  ];

  const maxVal = Math.max(...days.map((d) => d.count), 4);
  const svgWidth = 400;
  const svgHeight = 110;
  const paddingX = 25;
  const paddingY = 20;

  const points = days.map((d, idx) => {
    const x = paddingX + idx * ((svgWidth - paddingX * 2) / (days.length - 1));
    const y = svgHeight - paddingY - (d.count / maxVal) * (svgHeight - paddingY * 2);
    return { x, y, day: d };
  });

  const pathD = points.length > 0
    ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - 10} L ${points[0].x} ${svgHeight - 10} Z`
    : '';

  return (
    <div id="product" className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8 space-y-12 lg:space-y-14 flex-1">
      
      {/* 2. HERO SECTION — TWO COLUMN LAYOUT */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-2">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-6 space-y-7">
          
          {/* Buildathon Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
            <span>⚡</span>
            <span>Built for Razorpay&apos;s AI Buildathon</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
            <span className="text-emerald-400">Vouch</span><span className="text-white">Pay</span>
          </h1>

          {/* Subtitle Tagline */}
          <p className="text-base sm:text-lg text-zinc-300 font-normal leading-relaxed">
            AI agents that can buy on your behalf — <span className="text-emerald-400 font-medium">vouched</span>, <span className="text-zinc-200 font-medium">bounded</span>, and transparent.
          </p>

          {/* Three Short Inline Feature Bullets */}
          <div className="flex flex-wrap gap-4 pt-1">
            <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/80 border border-zinc-800/80 px-3.5 py-2 rounded-lg">
              <span className="p-1 rounded bg-emerald-500/10 text-emerald-400 text-xs">🔒</span>
              <div>
                <span className="font-semibold text-white block">Safe &amp; Controlled</span>
                <span className="text-zinc-400 text-[11px]">Pre-set limits &amp; mandates</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/80 border border-zinc-800/80 px-3.5 py-2 rounded-lg">
              <span className="p-1 rounded bg-indigo-500/10 text-indigo-400 text-xs">⚡</span>
              <div>
                <span className="font-semibold text-white block">Explainable Decisions</span>
                <span className="text-zinc-400 text-[11px]">Clear reasons for every action</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/80 border border-zinc-800/80 px-3.5 py-2 rounded-lg">
              <span className="p-1 rounded bg-amber-500/10 text-amber-400 text-xs">🛡️</span>
              <div>
                <span className="font-semibold text-white block">Transparent &amp; Audited</span>
                <span className="text-zinc-400 text-[11px]">Complete audit trail &amp; logs</span>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-4 pt-2">
            <Link
              href="/demo"
              className="px-6 py-3 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-extrabold text-sm rounded-lg transition-colors cursor-pointer shadow-lg shadow-emerald-400/10 flex items-center gap-2"
            >
              <span>Try the Demo</span>
              <span>→</span>
            </Link>

            <Link
              href="/docs"
              className="px-5 py-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 font-semibold text-sm rounded-lg transition-colors cursor-pointer"
            >
              View Documentation
            </Link>
          </div>

          {/* Trust Line */}
          <p className="text-xs text-zinc-500 font-medium">
            Trusted by builders • Secure by design • Powered by Razorpay
          </p>

        </div>

        {/* RIGHT COLUMN: LIVE OVERVIEW CARD */}
        <div className="lg:col-span-6">
          <div className="p-6 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
            
            {/* Live Overview Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <span className="font-bold text-white text-base">Live Overview</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live
                </span>
              </div>

              <div className="text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 px-3 py-1 rounded-md font-medium">
                Last 7 Days
              </div>
            </div>

            {/* 4 Stat Tiles in a Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              
              {/* Tile 1: Total Actions */}
              <div className="p-3.5 bg-zinc-950/80 border border-zinc-850 rounded-xl space-y-1">
                <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Total Actions</span>
                <div className="text-xl font-extrabold text-white font-mono">
                  {loading ? '...' : (data?.totalDecisions || 0)}
                </div>
              </div>

              {/* Tile 2: Payments */}
              <div className="p-3.5 bg-zinc-950/80 border border-zinc-850 rounded-xl space-y-1">
                <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Payments</span>
                <div className="text-xl font-extrabold text-white font-mono">
                  {loading ? '...' : `₹${(data?.totalSpent || 0).toLocaleString('en-IN')}`}
                </div>
              </div>

              {/* Tile 3: Blocks Enforced */}
              <div className="p-3.5 bg-zinc-950/80 border border-zinc-850 rounded-xl space-y-1">
                <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Blocks Enforced</span>
                <div className="text-xl font-extrabold text-white font-mono">
                  {loading ? '...' : (data?.declinedCount || 0)}
                </div>
              </div>

              {/* Tile 4: Success Rate */}
              <div className="p-3.5 bg-zinc-950/80 border border-zinc-850 rounded-xl space-y-1">
                <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Success Rate</span>
                <div className="text-xl font-extrabold text-emerald-400 font-mono">
                  {loading ? '...' : `${data?.approvalRate || 100}%`}
                </div>
              </div>

            </div>

            {/* 7-Day Agent Activity SVG Line Chart */}
            <div className="p-4 bg-zinc-950/80 border border-zinc-850 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Agent Activity Trend</span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {hoveredDay ? `${hoveredDay.label}: ${hoveredDay.count} actions (₹${hoveredDay.amount.toLocaleString('en-IN')})` : 'Hover chart points for details'}
                </span>
              </div>

              <div className="w-full overflow-hidden">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-24 overflow-visible">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Area fill */}
                  <path d={areaD} fill="url(#chartGradient)" />

                  {/* Line */}
                  <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Data Points */}
                  {points.map((p, idx) => (
                    <g key={idx} className="cursor-pointer group" onMouseEnter={() => setHoveredDay(p.day)} onMouseLeave={() => setHoveredDay(null)}>
                      <circle cx={p.x} cy={p.y} r="4" className="fill-emerald-400 stroke-zinc-950 stroke-2 group-hover:r-6 transition-all" />
                    </g>
                  ))}
                </svg>
              </div>
            </div>

          </div>
        </div>

      </section>

      {/* 3. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="space-y-6 pt-4 border-t border-zinc-800/60">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            How VouchPay Works
          </h2>
          <p className="text-sm text-zinc-400">
            A three-step architecture ensuring total safety, explainability, and transparency for agentic payments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-lg">
              1
            </div>
            <h3 className="font-bold text-white text-base">Spend Mandate Definition</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Users set maximum transaction limits, allowed product categories, and mandate expiration timestamps.
            </p>
          </div>

          <div className="p-6 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-lg">
              2
            </div>
            <h3 className="font-bold text-white text-base">Agent Evaluation &amp; Search</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When a request is submitted, the AI agent performs real-time market search and checks catalog limits.
            </p>
          </div>

          <div className="p-6 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-lg">
              3
            </div>
            <h3 className="font-bold text-white text-base">Razorpay Execution &amp; Audit</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              If approved, a Razorpay order link is generated. If declined, the exact violation reason is logged into the audit trail.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
