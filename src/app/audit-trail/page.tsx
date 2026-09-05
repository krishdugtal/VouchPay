'use client';

import React, { useState, useEffect } from 'react';

interface AgentAction {
  id: number;
  mandate_id: number | null;
  mandate_name?: string | null;
  action_type: 'purchase_attempt' | 'purchase_approved' | 'purchase_declined' | 'payment_failed' | 'retry_attempt' | 'recovery_abandoned' | 'system_error';
  reasoning: string;
  amount: number;
  status: 'success' | 'pending' | 'declined' | 'failed';
  razorpay_order_id: string | null;
  transaction_group_id?: string | null;
  timestamp: string;
}

export default function AuditTrailPage() {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Reset Dev Tool State
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  useEffect(() => {
    fetchAuditTrail();
  }, []);

  // Auto-refresh interval (every 3s for live demoing)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchAuditTrail(true);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  async function fetchAuditTrail(isBackground = false) {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      if (data.success) {
        setActions(data.actions);
      } else {
        throw new Error(data.error || 'Failed to fetch audit records.');
      }
    } catch (err: any) {
      if (!isBackground) setError(err.message || 'Failed to load audit logs.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  // Clear all test data handler (DEV ONLY full reset)
  async function handleClearAllTestData() {
    const confirmed = window.confirm(
      '⚠️ PERMANENT DEV RESET WARNING:\n\nAre you sure you want to delete ALL agent audit trail logs?\n\nThis will completely reset the database audit log to a fresh slate for live demo prep. This action CANNOT be undone!'
    );
    if (!confirmed) return;

    setIsResetting(true);
    setResetSuccessMsg(null);
    setResetErrorMsg(null);

    try {
      const res = await fetch('/api/audit', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setActions([]);
        setResetSuccessMsg('All audit trail test records cleared successfully. Database reset to clean state.');
      } else {
        setResetErrorMsg(data.error || 'Failed to clear audit trail.');
      }
    } catch (err: any) {
      setResetErrorMsg(err.message || 'An error occurred while clearing audit trail.');
    } finally {
      setIsResetting(false);
    }
  }

  // Download CSV Statement handler
  function handleDownloadStatement() {
    if (!filteredActions.length) return;

    const headers = ['timestamp', 'action_type', 'reasoning', 'amount', 'status', 'razorpay_order_id', 'mandate_name'];

    const rows = filteredActions.map((a) => {
      const timestamp = a.timestamp || '';
      const actionType = a.action_type || '';
      const reasoning = `"${(a.reasoning || '').replace(/"/g, '""')}"`;
      const amount = a.amount !== undefined && a.amount !== null ? a.amount : 0;
      const status = a.status || '';
      const razorpayOrderId = a.razorpay_order_id || '';
      const mandateName = `"${(a.mandate_name || '').replace(/"/g, '""')}"`;

      return [timestamp, actionType, reasoning, amount, status, razorpayOrderId, mandateName].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transaction_statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Filtered dataset
  const filteredActions = actions.filter((action) => {
    const matchesType = typeFilter === 'all' || action.action_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || action.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      action.reasoning.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (action.razorpay_order_id && action.razorpay_order_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (action.mandate_name && action.mandate_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTimeRange = (() => {
      if (timeRangeFilter === 'all') return true;
      const actionTime = new Date(action.timestamp).getTime();
      const now = Date.now();

      if (timeRangeFilter === 'last_1h') {
        return actionTime >= now - 3600 * 1000;
      }
      if (timeRangeFilter === 'today') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        return actionTime >= startOfToday.getTime();
      }
      if (timeRangeFilter === 'last_24h') {
        return actionTime >= now - 24 * 3600 * 1000;
      }
      if (timeRangeFilter === 'custom') {
        const start = customStartDate ? new Date(customStartDate).getTime() : 0;
        const end = customEndDate ? new Date(customEndDate).getTime() : Infinity;
        return actionTime >= start && actionTime <= end;
      }
      return true;
    })();

    return matchesType && matchesStatus && matchesSearch && matchesTimeRange;
  });

  // Compute pairing between PURCHASE ATTEMPT and its resolution row
  const pairMap = React.useMemo(() => {
    const map: Record<number, { pairedId: number; type: 'attempt' | 'resolution'; groupId: string }> = {};

    const sorted = [...actions].sort((a, b) => a.id - b.id);
    const attempts = sorted.filter((a) => a.action_type === 'purchase_attempt');
    const resolutions = sorted.filter((a) => a.action_type !== 'purchase_attempt');
    const usedResolutions = new Set<number>();

    attempts.forEach((att) => {
      const match = resolutions.find((res) => {
        if (usedResolutions.has(res.id)) return false;

        if (att.transaction_group_id && res.transaction_group_id && att.transaction_group_id === res.transaction_group_id) {
          return true;
        }
        if (att.razorpay_order_id && res.razorpay_order_id && att.razorpay_order_id === res.razorpay_order_id) {
          return true;
        }
        const amtMatch = Math.abs(att.amount - res.amount) < 0.01;
        const mandateMatch = att.mandate_id === res.mandate_id || (!att.mandate_id && !res.mandate_id);
        const tDiff = Math.abs(new Date(res.timestamp).getTime() - new Date(att.timestamp).getTime());
        const timeMatch = tDiff <= 120000;

        if (amtMatch && mandateMatch && timeMatch) {
          return true;
        }
        return false;
      });

      if (match) {
        usedResolutions.add(match.id);
        const grpId = att.transaction_group_id || match.transaction_group_id || att.razorpay_order_id || match.razorpay_order_id || `pair_${att.id}_${match.id}`;
        map[att.id] = { pairedId: match.id, type: 'attempt', groupId: grpId };
        map[match.id] = { pairedId: att.id, type: 'resolution', groupId: grpId };
      }
    });

    return map;
  }, [actions]);

  const getGroupBorderClass = (actionId: number) => {
    const pairInfo = pairMap[actionId];
    if (!pairInfo) return '';
    const grp = pairInfo.groupId;
    const borderColors = [
      'border-l-4 border-l-indigo-500 bg-indigo-500/[0.02]',
      'border-l-4 border-l-emerald-500 bg-emerald-500/[0.02]',
      'border-l-4 border-l-cyan-500 bg-cyan-500/[0.02]',
      'border-l-4 border-l-purple-500 bg-purple-500/[0.02]',
      'border-l-4 border-l-amber-500 bg-amber-500/[0.02]',
      'border-l-4 border-l-blue-500 bg-blue-500/[0.02]',
    ];
    let hash = 0;
    for (let i = 0; i < grp.length; i++) hash = (hash << 5) - hash + grp.charCodeAt(i);
    return borderColors[Math.abs(hash) % borderColors.length];
  };

  // Summary Metrics
  const totalLogs = actions.length;
  const successCaptures = actions.filter((a) => a.status === 'success').length;
  const declinedPurchases = actions.filter((a) => a.action_type === 'purchase_declined').length;
  const recoveryRetries = actions.filter((a) => a.action_type === 'retry_attempt').length;

  const getActionTypeBadge = (type: string) => {
    switch (type) {
      case 'purchase_approved':
        return <span className="px-2.5 py-1 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-md">PURCHASE APPROVED</span>;
      case 'purchase_declined':
        return <span className="px-2.5 py-1 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/25 rounded-md">PURCHASE DECLINED</span>;
      case 'payment_failed':
        return <span className="px-2.5 py-1 text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/25 rounded-md">PAYMENT FAILED</span>;
      case 'retry_attempt':
        return <span className="px-2.5 py-1 text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/25 rounded-md">RETRY ATTEMPT</span>;
      case 'recovery_abandoned':
        return <span className="px-2.5 py-1 text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-md">RECOVERY ABANDONED</span>;
      case 'purchase_attempt':
        return <span className="px-2.5 py-1 text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 rounded-md">PURCHASE ATTEMPT</span>;
      case 'system_error':
        return <span className="px-2.5 py-1 text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/25 rounded-md">SYSTEM ERROR</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold bg-zinc-800 text-zinc-300 rounded-md">{type}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            SUCCESS
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            PENDING
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
            DECLINED
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            FAILED
          </span>
        );
      default:
        return <span className="text-xs font-semibold text-zinc-400">{status}</span>;
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-8 flex-1">
      {/* Header & Live Status Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white">Agent Audit Trail</h1>
            <span className="px-3 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Audit Logging Active
            </span>
          </div>
          <p className="text-zinc-400 text-sm mt-1">
            Complete, immutable log of agent decision reasoning, spend mandate checks, and payment recovery events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg cursor-pointer select-none hover:border-zinc-700">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-zinc-950 border-zinc-700 text-emerald-500 focus:ring-0"
            />
            Auto-refresh (3s)
          </label>

          <button
            onClick={() => fetchAuditTrail()}
            className="px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Logs
          </button>

          <button
            onClick={handleDownloadStatement}
            disabled={filteredActions.length === 0}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10"
            title="Download Statement as CSV"
          >
            <svg className="w-4 h-4 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download Statement (CSV)</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1 shadow-lg">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Audit Logs</span>
          <div className="text-2xl font-extrabold text-white">{totalLogs}</div>
        </div>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1 shadow-lg">
          <span className="text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Successful Payments</span>
          <div className="text-2xl font-extrabold text-emerald-400">{successCaptures}</div>
        </div>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1 shadow-lg">
          <span className="text-xs font-semibold text-red-400/90 uppercase tracking-wider">Mandate Blocked</span>
          <div className="text-2xl font-extrabold text-red-400">{declinedPurchases}</div>
        </div>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1 shadow-lg">
          <span className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider">Payment Retries</span>
          <div className="text-2xl font-extrabold text-amber-400">{recoveryRetries}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-lg">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Time Range View Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-emerald-400 mb-1">Time Range (View Filter)</label>
            <select
              value={timeRangeFilter}
              onChange={(e) => setTimeRangeFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-medium rounded-lg p-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Time (Full History)</option>
              <option value="last_1h">Last 1 Hour</option>
              <option value="today">Today (Since Midnight)</option>
              <option value="last_24h">Last 24 Hours</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>

          {/* Custom Date Pickers */}
          {timeRangeFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-zinc-500 mb-1">From</label>
                <input
                  type="datetime-local"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-lg p-1.5 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-zinc-500 mb-1">To</label>
                <input
                  type="datetime-local"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-lg p-1.5 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Action Type Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-zinc-500 mb-1">Action Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-lg p-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Action Types</option>
              <option value="purchase_approved">purchase_approved</option>
              <option value="purchase_declined">purchase_declined</option>
              <option value="payment_failed">payment_failed</option>
              <option value="retry_attempt">retry_attempt</option>
              <option value="recovery_abandoned">recovery_abandoned</option>
              <option value="purchase_attempt">purchase_attempt</option>
              <option value="system_error">system_error</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-zinc-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-lg p-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="success">success</option>
              <option value="pending">pending</option>
              <option value="declined">declined</option>
              <option value="failed">failed</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="w-full md:w-64">
          <label className="block text-[10px] font-semibold uppercase text-zinc-500 mb-1">Search Reasoning / Order ID</label>
          <input
            type="text"
            placeholder="Search reasoning, order_id, mandate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Main Audit Trail Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 text-sm flex items-center justify-center gap-3">
            <svg className="animate-spin h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading live audit logs...
          </div>
        ) : filteredActions.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">
            No agent action logs match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 font-semibold text-xs uppercase tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4">ID / Timestamp</th>
                  <th className="px-6 py-4">Action Type</th>
                  <th className="px-6 py-4">Agent Reasoning / Context</th>
                  <th className="px-6 py-4">Mandate Name</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Razorpay Order ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/70">
                {filteredActions.map((action) => {
                  const pairInfo = pairMap[action.id];
                  const borderClass = getGroupBorderClass(action.id);

                  return (
                    <tr key={action.id} className={`hover:bg-zinc-850/40 transition-colors ${borderClass}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-white">#{action.id}</span>
                          {pairInfo && (
                            <span
                              className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60"
                              title={`Group ID: ${pairInfo.groupId}`}
                            >
                              LINKED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                          {new Date(action.timestamp).toLocaleString()}
                        </div>

                        {/* Visual Link Cues */}
                        {pairInfo?.type === 'attempt' && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md w-fit">
                            <span>↳</span>
                            <span>Resolved by #{pairInfo.pairedId}</span>
                          </div>
                        )}
                        {pairInfo?.type === 'resolution' && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 rounded-md w-fit">
                            <span>↳</span>
                            <span>Resolution for Attempt #{pairInfo.pairedId}</span>
                          </div>
                        )}
                        {/* Unresolved Pending Attempt Cue */}
                        {!pairInfo && action.action_type === 'purchase_attempt' && (
                          <div
                            className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md w-fit"
                            title="Order created, awaiting webhook payment.captured confirmation"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            <span>⏳ Awaiting confirmation</span>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {getActionTypeBadge(action.action_type)}
                      </td>

                      <td className="px-6 py-4 max-w-md text-xs leading-relaxed text-zinc-300">
                        <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-850 font-mono text-[11px]">
                          {action.reasoning}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-indigo-300">
                        {action.mandate_name || (action.mandate_id ? `Mandate #${action.mandate_id}` : '-')}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-sm text-white">
                        ₹{action.amount ? action.amount.toLocaleString('en-IN') : 0}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(action.status)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-zinc-400">
                        {action.razorpay_order_id ? (
                          <div className="flex flex-col gap-1">
                            <span className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-indigo-300 font-semibold w-fit">
                              {action.razorpay_order_id}
                            </span>
                            {action.transaction_group_id && (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                Grp: {action.transaction_group_id}
                              </span>
                            )}
                          </div>
                        ) : action.transaction_group_id ? (
                          <span className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-zinc-400 font-mono text-[10px]">
                            Grp: {action.transaction_group_id}
                          </span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dev Tools Collapsible Panel for Demo Prep & Full Reset */}
      <div className="pt-4 border-t border-zinc-850">
        <details className="group bg-zinc-950/80 border border-zinc-850 rounded-xl overflow-hidden transition-all">
          <summary className="px-4 py-3 text-xs font-bold text-zinc-400 cursor-pointer select-none flex items-center justify-between hover:bg-zinc-900 hover:text-white transition-colors">
            <span className="flex items-center gap-2">
              <span>⚙️</span>
              <span>Dev Tools — Demo Prep & Data Reset</span>
              <span className="text-[10px] font-normal text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                Demo Prep Tool Only
              </span>
            </span>
            <span className="text-zinc-600 group-open:rotate-180 transition-transform">▼</span>
          </summary>

          <div className="p-4 border-t border-zinc-850 bg-zinc-950 space-y-3">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Use this tool prior to live demoing to clear all previous test logs and start with a completely fresh audit log. Normal operation logs are complete, immutable, and trust-verified.
            </p>

            {resetSuccessMsg && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 rounded-lg text-xs flex items-center justify-between">
                <span>{resetSuccessMsg}</span>
                <button onClick={() => setResetSuccessMsg(null)} className="text-zinc-400 hover:text-white underline cursor-pointer">Dismiss</button>
              </div>
            )}

            {resetErrorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-200 rounded-lg text-xs flex items-center justify-between">
                <span>{resetErrorMsg}</span>
                <button onClick={() => setResetErrorMsg(null)} className="text-zinc-400 hover:text-white underline cursor-pointer">Dismiss</button>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
              <span className="text-[11px] text-zinc-500 italic">
                Requires confirmation. Irreversibly deletes all records in agent_actions table.
              </span>

              <button
                onClick={handleClearAllTestData}
                disabled={isResetting || actions.length === 0}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-red-600/10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {isResetting ? 'Clearing Test Data...' : 'CLEAR ALL TEST DATA (DEV RESET)'}
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
