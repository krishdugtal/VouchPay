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

interface DemoSimPrompt {
  label: string;
  prompt: string;
  product: string;
  price: number;
  mandateName: string;
  mandateLimit: number;
  category: string;
  allowed: boolean;
  reason: string;
}

const DEMO_SIM_PROMPTS: DemoSimPrompt[] = [
  {
    label: 'Nike Shoes (₹7,595)',
    prompt: 'Find and buy Nike running shoes under ₹10,000',
    product: 'Nike Winflo 12 Running Shoes',
    price: 7595,
    mandateName: 'Sports & Shoes',
    mandateLimit: 10000,
    category: 'Sports & Outdoors',
    allowed: true,
    reason: 'Product price ₹7,595 is within the ₹10,000 mandate limit and category "Sports & Outdoors" is permitted.'
  },
  {
    label: 'H&M T-Shirt (₹999)',
    prompt: 'Purchase a cotton T-shirt under ₹1,000',
    product: 'H&M Relaxed Fit T-Shirt',
    price: 999,
    mandateName: 'Tshirts Mandate',
    mandateLimit: 1000,
    category: 'Clothing',
    allowed: true,
    reason: 'Price ₹999 fits within the ₹1,000 spend cap for category "Clothing".'
  },
  {
    label: 'iPhone 16 Pro (Over Limit)',
    prompt: 'Buy iPhone 16 Pro for ₹1,90,000',
    product: 'iPhone 16 Pro (128GB)',
    price: 190000,
    mandateName: 'Gadget Budget',
    mandateLimit: 150000,
    category: 'Electronics',
    allowed: false,
    reason: 'Transaction blocked: Product price (₹1,90,000) exceeds mandate limit (₹1,50,000).'
  }
];

const FAQ_ITEMS = [
  {
    q: "How does VouchPay guarantee AI agents won't overspend or buy unauthorized items?",
    a: "VouchPay uses a dual-layer compliance protocol. First, Google Gemini AI (gemini-3.6-flash in structured JSON mode) evaluates the request against active spend mandate rules. Second, VouchPay's server-side checkout engine re-verifies max_amount, allowed_categories, and expires_at before creating any Razorpay order. If any rule is violated, the transaction is immediately blocked and logged."
  },
  {
    q: "How does Autonomous Payment Failure Recovery work?",
    a: "When a payment fails (e.g. card error or bank timeout), Razorpay fires a payment.failed webhook signed with HMAC-SHA256. VouchPay verifies the signature, inspects the failure reason, checks if the spend mandate is still valid, and automatically creates a new Razorpay retry order without requiring human intervention."
  },
  {
    q: "How does VouchPay connect to hosted databases like Turso?",
    a: "VouchPay is powered by @libsql/client (LibSQL / Turso). In production on Vercel, it communicates asynchronously over HTTP/WebSockets to hosted Turso SQLite instances. In local development, it falls back seamlessly to local SQLite."
  },
  {
    q: "Are merchant API keys and webhook secrets secure?",
    a: "Yes. All Razorpay key credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET) and Gemini API keys reside exclusively in server-side environment variables (.env.local / Vercel Environment Variables). No keys are ever exposed to client browsers."
  }
];

export default function Home() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<ActivityDay | null>(null);
  const [activeTab, setActiveTab] = useState<'telemetry' | 'simulator'>('telemetry');
  
  // Simulator state
  const [selectedSim, setSelectedSim] = useState<DemoSimPrompt>(DEMO_SIM_PROMPTS[0]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);

  // FAQ state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

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

  const runSimulation = (promptItem: DemoSimPrompt) => {
    setSelectedSim(promptItem);
    setIsSimulating(true);
    setSimStep(1);
    
    setTimeout(() => {
      setSimStep(2);
      setTimeout(() => {
        setSimStep(3);
        setIsSimulating(false);
      }, 800);
    }, 700);
  };

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
  const svgWidth = 420;
  const svgHeight = 120;
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
    <div id="product" className="w-full max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-12 py-10 lg:py-16 space-y-24 lg:space-y-28 flex-1">
      
      {/* 1. HERO SECTION — TWO COLUMN LAYOUT */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center pt-2">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-6 space-y-8">
          
          {/* Buildathon Pill Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm font-bold shadow-sm shadow-emerald-500/10">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Built for Razorpay&apos;s AI Buildathon 2026</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 drop-shadow-[0_0_40px_rgba(16,185,129,0.35)]">
              VouchPay
            </span>
          </h1>

          {/* Subtitle Tagline & Full Description */}
          <div className="space-y-4">
            <p className="text-xl sm:text-2xl text-zinc-200 font-semibold leading-snug">
              AI agents that can buy on your behalf — <span className="text-emerald-400 font-extrabold">vouched</span>, <span className="text-cyan-300 font-extrabold">bounded</span>, and 100% transparent.
            </p>
            <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed">
              VouchPay is an agentic commerce infrastructure layer designed for the autonomous era. It enables merchants to accept purchases initiated by AI agents while giving consumers total control through custom spend mandates, real-time catalog verification, and automated payment failure recovery.
            </p>
          </div>

          {/* Three Feature Bullets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="flex items-center gap-3 text-sm text-zinc-200 bg-zinc-900/90 border border-zinc-800/90 p-4 rounded-2xl shadow-lg">
              <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-lg shrink-0">🔒</span>
              <div>
                <span className="font-bold text-white block text-sm sm:text-base">Safe &amp; Bounded</span>
                <span className="text-zinc-400 text-xs">Pre-set spend limits</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-zinc-200 bg-zinc-900/90 border border-zinc-800/90 p-4 rounded-2xl shadow-lg">
              <span className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 text-lg shrink-0">⚡</span>
              <div>
                <span className="font-bold text-white block text-sm sm:text-base">Explainable AI</span>
                <span className="text-zinc-400 text-xs">Clear reasoning logs</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-zinc-200 bg-zinc-900/90 border border-zinc-800/90 p-4 rounded-2xl shadow-lg">
              <span className="p-2 rounded-xl bg-amber-500/15 text-amber-400 text-lg shrink-0">🛡️</span>
              <div>
                <span className="font-bold text-white block text-sm sm:text-base">Transparent</span>
                <span className="text-zinc-400 text-xs">Complete audit trail</span>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-5 pt-3">
            <Link
              href="/demo"
              className="px-8 py-4 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-zinc-950 font-black text-base rounded-2xl transition-all cursor-pointer shadow-xl shadow-emerald-500/25 flex items-center gap-3 hover:scale-[1.03]"
            >
              <span>Try the Demo</span>
              <span className="text-lg">→</span>
            </Link>

            <Link
              href="/docs"
              className="px-7 py-4 bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 text-zinc-100 font-bold text-base rounded-2xl transition-all cursor-pointer hover:border-zinc-700 shadow-md"
            >
              View Documentation
            </Link>
          </div>

          {/* Trust Line */}
          <p className="text-sm text-zinc-500 font-medium pt-1">
            Trusted by builders • Secure by design • Powered by Razorpay &amp; Google Gemini
          </p>

        </div>

        {/* RIGHT COLUMN: MULTI-TAB LIVE SHOWCASE CARD */}
        <div className="lg:col-span-6">
          <div className="p-7 bg-zinc-900/95 border border-zinc-800/90 rounded-3xl space-y-7 shadow-2xl relative overflow-hidden backdrop-blur-xl hover:border-zinc-700/80 transition-colors">
            
            {/* Header with Switcher Tabs */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('telemetry')}
                  className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-all cursor-pointer ${
                    activeTab === 'telemetry'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Live Telemetry
                </button>
                <button
                  onClick={() => setActiveTab('simulator')}
                  className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-all cursor-pointer ${
                    activeTab === 'simulator'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Agent Simulator
                </button>
              </div>

              <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center gap-2 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Active System
              </div>
            </div>

            {/* TAB 1: TELEMETRY */}
            {activeTab === 'telemetry' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* 4 Stat Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-zinc-950/90 border border-zinc-850 rounded-2xl space-y-1">
                    <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Actions</span>
                    <div className="text-2xl font-black text-white font-mono">
                      {loading ? '...' : (data?.totalDecisions || 0)}
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950/90 border border-zinc-850 rounded-2xl space-y-1">
                    <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Payments</span>
                    <div className="text-2xl font-black text-white font-mono">
                      {loading ? '...' : `₹${(data?.totalSpent || 0).toLocaleString('en-IN')}`}
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950/90 border border-zinc-850 rounded-2xl space-y-1">
                    <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Blocks Enforced</span>
                    <div className="text-2xl font-black text-white font-mono">
                      {loading ? '...' : (data?.declinedCount || 0)}
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950/90 border border-zinc-850 rounded-2xl space-y-1">
                    <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Success Rate</span>
                    <div className="text-2xl font-black text-emerald-400 font-mono">
                      {loading ? '...' : `${data?.approvalRate || 100}%`}
                    </div>
                  </div>
                </div>

                {/* 7-Day Agent Activity SVG Line Chart */}
                <div className="p-5 bg-zinc-950/90 border border-zinc-850 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-200">Agent Activity Trend</span>
                    <span className="text-xs text-zinc-400 font-mono">
                      {hoveredDay ? `${hoveredDay.label}: ${hoveredDay.count} actions (₹${hoveredDay.amount.toLocaleString('en-IN')})` : 'Hover chart points for details'}
                    </span>
                  </div>

                  <div className="w-full overflow-hidden">
                    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-28 overflow-visible">
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      <path d={areaD} fill="url(#chartGradient)" />
                      <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                      {points.map((p, idx) => (
                        <g key={idx} className="cursor-pointer group" onMouseEnter={() => setHoveredDay(p.day)} onMouseLeave={() => setHoveredDay(null)}>
                          <circle cx={p.x} cy={p.y} r="5" className="fill-emerald-400 stroke-zinc-950 stroke-2 group-hover:r-7 transition-all" />
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: AGENT SIMULATOR */}
            {activeTab === 'simulator' && (
              <div className="space-y-5 animate-in fade-in duration-300">
                <div className="text-sm text-zinc-300 font-medium">
                  Click a test prompt below to simulate live Gemini reasoning against spend mandates:
                </div>

                {/* Prompt Chips */}
                <div className="flex flex-wrap gap-2.5">
                  {DEMO_SIM_PROMPTS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => runSimulation(p)}
                      disabled={isSimulating}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                        selectedSim.label === p.label
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Simulation Display Screen */}
                <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4 text-xs sm:text-sm font-mono">
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                    <span className="text-zinc-400 font-bold">User Request:</span>
                    <span className="text-zinc-100 font-semibold truncate max-w-[240px]">&quot;{selectedSim.prompt}&quot;</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${simStep >= 1 ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-700'}`}></span>
                      <span className={simStep >= 1 ? 'text-cyan-300 font-semibold' : 'text-zinc-500'}>
                        {simStep >= 1 ? `Matched Catalog Item: ${selectedSim.product} (₹${selectedSim.price.toLocaleString('en-IN')})` : 'Catalog search pending...'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${simStep >= 2 ? 'bg-amber-400 animate-pulse' : 'bg-zinc-700'}`}></span>
                      <span className={simStep >= 2 ? 'text-amber-300 font-semibold' : 'text-zinc-500'}>
                        {simStep >= 2 ? `Mandate Checked: ${selectedSim.mandateName} (Limit: ₹${selectedSim.mandateLimit.toLocaleString('en-IN')})` : 'Mandate evaluation pending...'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 pt-2 border-t border-zinc-850">
                      <span className={`w-2.5 h-2.5 rounded-full ${simStep >= 3 ? (selectedSim.allowed ? 'bg-emerald-400' : 'bg-rose-400') : 'bg-zinc-700'}`}></span>
                      <span className={simStep >= 3 ? (selectedSim.allowed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold') : 'text-zinc-500'}>
                        {simStep >= 3
                          ? (selectedSim.allowed ? 'ACTION: PURCHASE APPROVED (Razorpay Link Created)' : 'ACTION: PURCHASE DECLINED (Spend Limit Exceeded)')
                          : 'Final decision pending...'}
                      </span>
                    </div>
                  </div>

                  {simStep >= 3 && (
                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 leading-relaxed font-sans mt-3">
                      <span className="font-bold text-white block mb-1">Reasoning Log:</span>
                      {selectedSim.reason}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </section>

      {/* NEW POINT 3: LIVE SYSTEM INFRASTRUCTURE STATUS BAR */}
      <section className="p-6 bg-zinc-900/90 border border-zinc-800 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Live System Infrastructure &amp; Security Status</span>
          <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            ALL SYSTEMS OPERATIONAL
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-zinc-950/80 border border-zinc-850 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">Razorpay SDK</span>
              <span className="text-[11px] text-zinc-400 font-mono">Test Mode Orders</span>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">ACTIVE</span>
          </div>

          <div className="p-4 bg-zinc-950/80 border border-zinc-850 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">AI Reasoning Engine</span>
              <span className="text-[11px] text-zinc-400 font-mono">Gemini 3.6 Flash</span>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">ACTIVE</span>
          </div>

          <div className="p-4 bg-zinc-950/80 border border-zinc-850 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">Database Engine</span>
              <span className="text-[11px] text-zinc-400 font-mono">Turso Hosted LibSQL</span>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">ACTIVE</span>
          </div>

          <div className="p-4 bg-zinc-950/80 border border-zinc-850 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">Webhook Security</span>
              <span className="text-[11px] text-zinc-400 font-mono">HMAC-SHA256 Signed</span>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">ACTIVE</span>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS ARCHITECTURE GRID */}
      <section id="how-it-works" className="space-y-8 pt-6 border-t border-zinc-800/60">
        <div className="space-y-3">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            How VouchPay Works
          </h2>
          <p className="text-base sm:text-lg text-zinc-300">
            A three-step architecture ensuring total safety, explainability, and transparency for agentic payments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 bg-zinc-900/90 border border-zinc-800 rounded-3xl space-y-5 hover:border-zinc-700 transition-colors relative overflow-hidden group shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-black text-emerald-400 text-xl group-hover:scale-105 transition-transform">
              1
            </div>
            <h3 className="font-extrabold text-white text-xl">1. Spend Mandate Definition</h3>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              Users set maximum transaction limits, allowed product categories, and mandate expiration timestamps in Catalog Setup.
            </p>
            <div className="pt-3 border-t border-zinc-850 font-mono text-xs text-zinc-400">
              max_amount: ₹2,00,000 • expires: 2026-12-31
            </div>
          </div>

          <div className="p-8 bg-zinc-900/90 border border-zinc-800 rounded-3xl space-y-5 hover:border-zinc-700 transition-colors relative overflow-hidden group shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-black text-indigo-400 text-xl group-hover:scale-105 transition-transform">
              2
            </div>
            <h3 className="font-extrabold text-white text-xl">2. Agent Evaluation &amp; Search</h3>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              When a request is submitted, Google Gemini API evaluates live market listings against the active mandate rules.
            </p>
            <div className="pt-3 border-t border-zinc-850 font-mono text-xs text-zinc-400">
              gemini-3.6-flash • responseSchema JSON
            </div>
          </div>

          <div className="p-8 bg-zinc-900/90 border border-zinc-800 rounded-3xl space-y-5 hover:border-zinc-700 transition-colors relative overflow-hidden group shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-black text-amber-400 text-xl group-hover:scale-105 transition-transform">
              3
            </div>
            <h3 className="font-extrabold text-white text-xl">3. Razorpay Execution &amp; Audit</h3>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              If approved, a Razorpay order link is generated. If declined, the exact violation reason is logged into the audit trail.
            </p>
            <div className="pt-3 border-t border-zinc-850 font-mono text-xs text-zinc-400">
              status: success • razorpay_order_id
            </div>
          </div>
        </div>
      </section>

      {/* NEW POINT 2: INTERACTIVE FAQ & SECURITY ACCORDION */}
      <section className="space-y-8 pt-6 border-t border-zinc-800/60">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-extrabold">
            Frequently Asked Questions
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Security, Compliance &amp; Architecture FAQ
          </h2>
          <p className="text-base sm:text-lg text-zinc-300 max-w-2xl">
            Everything you need to know about VouchPay&apos;s dual-layer verification protocol and merchant safety.
          </p>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="bg-zinc-900/90 border border-zinc-800 rounded-3xl overflow-hidden transition-all shadow-md"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-white text-base sm:text-lg cursor-pointer hover:bg-zinc-850/50 transition-colors"
                >
                  <span>{item.q}</span>
                  <span className={`text-xl transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-400' : 'text-zinc-500'}`}>
                    ▼
                  </span>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-2 text-sm sm:text-base text-zinc-300 leading-relaxed border-t border-zinc-850">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. BOTTOM GLASSMORPHIC CTA BANNER */}
      <section className="p-10 sm:p-14 lg:p-16 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800/80 rounded-[2.5rem] relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-3 text-center md:text-left">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Ready to test autonomous AI commerce?
          </h2>
          <p className="text-base sm:text-lg text-zinc-300 max-w-xl">
            Experience AI agents bounded by spending mandates with live Razorpay checkout execution and explainable audit logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 shrink-0">
          <Link
            href="/demo"
            className="px-8 py-4 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-black text-base rounded-2xl transition-all cursor-pointer shadow-xl shadow-emerald-400/25 hover:scale-105"
          >
            Launch Demo Hub →
          </Link>
          <Link
            href="/catalog-setup"
            className="px-7 py-4 bg-zinc-800 hover:bg-zinc-750 text-zinc-100 font-bold text-base rounded-2xl transition-all cursor-pointer border border-zinc-700 shadow-md"
          >
            Setup Catalog
          </Link>
        </div>
      </section>

    </div>
  );
}
