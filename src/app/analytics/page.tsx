'use client';

import React, { useState, useEffect } from 'react';

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

interface TimelineItem {
  date: string;
  amount: number;
  count: number;
}

interface AnalyticsData {
  totalSpent: number;
  successfulCount: number;
  declinedCount: number;
  totalDecisions: number;
  approvalRate: number;
  avgTransactionSize: number;
  categoryBreakdown: CategoryBreakdown[];
  timeline: TimelineItem[];
  recentActions: any[];
}

const CATEGORY_COLORS = [
  'bg-emerald-500',
  'bg-indigo-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-blue-500',
  'bg-teal-500',
  'bg-pink-500',
  'bg-orange-500'
];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Failed to load analytics data.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading analytics.');
    } finally {
      setLoading(false);
    }
  }

  const maxTimelineAmount = data?.timeline?.length
    ? Math.max(...data.timeline.map((t) => t.amount), 1)
    : 1;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-8 flex-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white">Spend Analytics Dashboard</h1>
            <span className="px-3 py-0.5 text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              Live Agent Telemetry
            </span>
          </div>
          <p className="text-zinc-400 text-sm mt-1">
            Real-time breakdown of autonomous agent spend, approval metrics, category allocations, and historical trends.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Analytics
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/30 text-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20 text-zinc-500 text-sm gap-3">
          <svg className="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading analytics metrics...
        </div>
      ) : data ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Total Amount Spent */}
            <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2 relative overflow-hidden shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Spent</span>
                <span className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <div className="text-3xl font-extrabold text-white">
                ₹{data.totalSpent.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-emerald-400/80 font-medium">Successful payments only</p>
            </div>

            {/* Average Transaction Size */}
            <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Avg Transaction Size</span>
                <span className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
              <div className="text-3xl font-extrabold text-white">
                ₹{data.avgTransactionSize.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-zinc-500 font-medium">Across {data.successfulCount} approved orders</p>
            </div>

            {/* Approved vs Declined Ratio */}
            <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Approval Ratio</span>
                <span className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-3xl font-extrabold text-white">{data.approvalRate}%</div>
                <div className="text-xs font-semibold text-zinc-400">
                  <span className="text-emerald-400 font-bold">{data.successfulCount}</span> / <span className="text-red-400 font-bold">{data.declinedCount}</span>
                </div>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${data.approvalRate}%` }}
                ></div>
                <div
                  className="bg-red-500 h-full transition-all duration-500"
                  style={{ width: `${100 - data.approvalRate}%` }}
                ></div>
              </div>
            </div>

            {/* Total Decisions Evaluated */}
            <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Agent Actions</span>
                <span className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </span>
              </div>
              <div className="text-3xl font-extrabold text-white">
                {data.totalDecisions}
              </div>
              <p className="text-xs text-zinc-500 font-medium">Evaluated against active spend mandates</p>
            </div>

          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Category Spend Breakdown */}
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Spend by Category</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Joined from agent reasoning and registered product limits</p>
                </div>
                <span className="text-xs font-mono font-semibold bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-md">
                  {data.categoryBreakdown.length} Categories
                </span>
              </div>

              {data.categoryBreakdown.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-sm">
                  No successful purchases logged yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.categoryBreakdown.map((cat, idx) => {
                    const colorClass = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                    return (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${colorClass}`}></span>
                            <span className="font-semibold text-zinc-200">{cat.category}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-zinc-400 text-xs">{cat.percentage}%</span>
                            <span className="font-mono font-bold text-white">₹{cat.amount.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                        <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-zinc-850">
                          <div
                            className={`h-full rounded-full ${colorClass} transition-all duration-500`}
                            style={{ width: `${Math.max(cat.percentage, 4)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Spend Over Time Chart */}
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-5 flex flex-col justify-between shadow-2xl">
              <div className="border-b border-zinc-850 pb-4">
                <h2 className="text-lg font-bold text-white">Spend Over Time</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Daily aggregated spend volume for successful agent transactions</p>
              </div>

              {data.timeline.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-sm">
                  No time series spend data available.
                </div>
              ) : (
                <div className="space-y-6 pt-4">
                  <div className="h-44 flex items-end justify-between gap-3 px-2 border-b border-zinc-800 pb-2">
                    {data.timeline.map((t) => {
                      const heightPercent = Math.max(Math.round((t.amount / maxTimelineAmount) * 100), 12);
                      return (
                        <div key={t.date} className="flex-1 flex flex-col items-center gap-2 group relative">
                          {/* Tooltip */}
                          <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950 text-white text-[11px] font-mono px-2 py-1 rounded border border-zinc-700 shadow-xl pointer-events-none whitespace-nowrap z-10">
                            ₹{t.amount.toLocaleString('en-IN')} ({t.count} txns)
                          </div>
                          <div
                            className="w-full bg-gradient-to-t from-indigo-600 to-emerald-400 rounded-t-md hover:brightness-125 transition-all cursor-pointer"
                            style={{ height: `${heightPercent}%` }}
                          ></div>
                          <span className="text-[10px] font-mono text-zinc-500 truncate w-full text-center">
                            {t.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
                    <span>Total Active Days: <strong className="text-white">{data.timeline.length}</strong></span>
                    <span>Peak Daily Spend: <strong className="text-emerald-400 font-mono">₹{maxTimelineAmount.toLocaleString('en-IN')}</strong></span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Recent Activity Section */}
          <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>⚡ Recent Agent Action Logs</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-950 text-zinc-400 font-semibold text-xs uppercase tracking-wider border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Reasoning</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Mandate Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {data.recentActions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-zinc-500 text-xs">No recent actions logged.</td>
                    </tr>
                  ) : (
                    data.recentActions.map((a: any) => (
                      <tr key={a.id} className="hover:bg-zinc-850/40 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-zinc-500 whitespace-nowrap">
                          {new Date(a.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                            a.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {a.action_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-300 max-w-sm truncate">
                          {a.reasoning}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-white whitespace-nowrap">
                          ₹{(a.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-xs text-indigo-300 font-medium whitespace-nowrap">
                          {a.mandate_name || (a.mandate_id ? `Mandate #${a.mandate_id}` : '-')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
