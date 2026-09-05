'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface ProductOption {
  id: number;
  name: string;
  limit_price: number;
  category: string;
  price?: number;
  image_url?: string | null;
  reference_link?: string | null;
}

interface MarketReference {
  title: string;
  price: string;
  numeric_price: number;
  source: string;
  link: string;
  thumbnail: string | null;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  status?: 'approved' | 'declined' | 'error' | 'pending';
  decision?: {
    action: 'purchase' | 'decline';
    product_id: number | null;
    amount: number;
    reasoning: string;
  };
  matchingProducts?: ProductOption[];
  targetProduct?: ProductOption;
  marketReferences?: MarketReference[];
  marketSearchError?: string;
  paymentLinkUrl?: string;
  orderId?: string;
}

// Helper to extract numeric budget requested by user (e.g. "under ₹500" -> 500)
function extractUserBudget(text: string): number | null {
  const match = text.match(/(?:under|below|max|within|less than|for|<=|<)\s*₹?\s*([0-9]+(?:,[0-9]+)*)/i);
  if (match && match[1]) {
    const num = parseInt(match[1].replace(/,/g, ''), 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}

// Helper to extract unit & weight variants (e.g., "1kg" -> ["1kg", "1 kg", "1.0kg", "1000g", "1000 g"])
function getUnitVariants(query: string): string[] {
  const norm = query.toLowerCase().replace(/(\d+)\s*(kg|g|lb|lbs|ml|l|gb|tb)\b/gi, '$1$2');
  const matches = norm.match(/\b\d+(?:\.\d+)?(?:kg|g|lb|lbs|ml|l|gb|tb)\b/gi) || [];
  const variants = new Set<string>();

  matches.forEach((unit) => {
    variants.add(unit);
    const numMatch = unit.match(/^(\d+(?:\.\d+)?)([a-z]+)$/i);
    if (!numMatch) return;
    const val = parseFloat(numMatch[1]);
    const type = numMatch[2].toLowerCase();

    variants.add(`${val} ${type}`);
    variants.add(`${val.toFixed(1)} ${type}`);
    variants.add(`${val.toFixed(1)}${type}`);

    if (type === 'kg') {
      const gVal = Math.round(val * 1000);
      variants.add(`${gVal}g`);
      variants.add(`${gVal} g`);
    } else if (type === 'g') {
      const kgVal = val / 1000;
      variants.add(`${kgVal}kg`);
      variants.add(`${kgVal} kg`);
    }
  });

  return Array.from(variants);
}

function ChatContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [mandates, setMandates] = useState<any[]>([]);
  const [selectedMandateId, setSelectedMandateId] = useState<number | null>(null);
  const [paymentSuccessNotice, setPaymentSuccessNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active selected mandate derived from state
  const activeMandate = mandates.find((m) => m.id === selectedMandateId) || mandates[0] || null;

  // Check URL params for Razorpay return redirect
  useEffect(() => {
    const orderId = searchParams.get('order_id');
    const paymentId = searchParams.get('razorpay_payment_id');
    const linkStatus = searchParams.get('razorpay_payment_link_status');

    if (paymentId || linkStatus === 'paid') {
      setPaymentSuccessNotice(
        `Payment Successful! Payment ID: ${paymentId || 'Captured'}. Order ID: ${orderId || 'N/A'}`
      );
      if (orderId) {
        fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, payment_id: paymentId })
        }).catch(() => {});
      }
    }
  }, [searchParams]);

  // Load active mandates on mount
  useEffect(() => {
    fetchMandates();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function fetchMandates() {
    try {
      const res = await fetch('/api/catalog/mandate');
      const data = await res.json();
      if (data.success && Array.isArray(data.mandates)) {
        setMandates(data.mandates);
        if (data.mandates.length > 0) {
          setSelectedMandateId((prev) => {
            if (prev && data.mandates.some((m: any) => m.id === prev)) return prev;
            return data.mandates[0].id;
          });
        } else {
          setSelectedMandateId(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch active mandates:', err);
    }
  }

  async function handleSelectLiveCard(product: ProductOption, card: MarketReference) {
    if (loading) return;
    setLoading(true);

    try {
      const realAmount = card.numeric_price;
      const reasoningText = `Selected live market listing from ${card.source} for ₹${realAmount?.toLocaleString('en-IN')} (Item: "${card.title}", registered limit price: ₹${product.limit_price?.toLocaleString('en-IN')})`;

      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purchase',
          product_id: product.id,
          mandate_id: activeMandate?.id,
          amount: realAmount,
          reasoning: reasoningText
        })
      });

      const checkoutData = await checkoutRes.json();

      if (!checkoutData.success) {
        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          text: `Mandate Check Failed: ${checkoutData.error}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'declined'
        };
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          text: `Approved purchase for "${card.title}" at real market price ₹${realAmount?.toLocaleString('en-IN')} from ${card.source}. Click below to complete payment via Razorpay.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'approved',
          decision: {
            action: 'purchase',
            product_id: product.id,
            amount: realAmount,
            reasoning: reasoningText
          },
          paymentLinkUrl: checkoutData.paymentLinkUrl,
          orderId: checkoutData.orderId
        };
        setMessages((prev) => [...prev, agentMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `agent-err-${Date.now()}`,
        sender: 'agent',
        text: `Error processing checkout: ${err.message || 'Checkout failed'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'error'
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(promptText?: string) {
    const messageToSend = promptText || inputMessage;
    if (!messageToSend.trim() || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: messageToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!promptText) setInputMessage('');
    setLoading(true);

    try {
      // Step 1: Call Gemini Agent API
      const agentRes = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          mandate_id: activeMandate?.id
        })
      });

      const agentData = await agentRes.json();

      if (!agentData.success) {
        throw new Error(agentData.error || 'Agent reasoning error');
      }

      const { decision, mandates: fetchedMandates, matching_products } = agentData;

      if (Array.isArray(fetchedMandates) && fetchedMandates.length > 0) {
        setMandates(fetchedMandates);
      }

      // Identify target matched product
      const primaryProduct: ProductOption | undefined = matching_products && matching_products.length > 0 ? matching_products[0] : undefined;

      let marketRefs: MarketReference[] = [];
      let marketError: string | undefined = undefined;

      // If catalog product matched, search live market for real listings
      if (primaryProduct) {
        try {
          // Use user's prompt text (e.g. "I want to buy Sony Headphones") to capture brand/intent specificity
          const searchQuery = messageToSend.trim() || primaryProduct.name;
          const searchRes = await fetch('/api/product-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: searchQuery })
          });
          const searchData = await searchRes.json();

          if (searchData.success && Array.isArray(searchData.results) && searchData.results.length > 0) {
            const catalogLimit = (primaryProduct.limit_price && primaryProduct.limit_price > 0 ? primaryProduct.limit_price : primaryProduct.price) || 0;
            const promptBudget = extractUserBudget(messageToSend);
            // Effective limit price is the stricter constraint between user prompt budget and catalog limit
            const effectiveLimitPrice = promptBudget && catalogLimit > 0 ? Math.min(catalogLimit, promptBudget) : (promptBudget || catalogLimit);

            // Update primary product limit price for display
            primaryProduct.limit_price = effectiveLimitPrice;

            // Extract model & year spec tokens from user prompt
            const promptLower = messageToSend.toLowerCase();
            const specTokens = promptLower.match(/\b([a-z0-9]+-[a-z0-9]+|202[0-9]|199[0-9]|[a-z]+[0-9]+|[0-9]+[a-z]+)\b/gi) || [];

            // STRICT FILTERING: Keep items strictly <= effectiveLimitPrice
            let filtered = searchData.results.filter(
              (r: MarketReference) => r.numeric_price > 0 && (effectiveLimitPrice <= 0 || r.numeric_price <= effectiveLimitPrice)
            );

            // UNIT & WEIGHT MATCHING: If user specified weight/unit (e.g. 1kg, 500g, 128gb), filter to matching titles
            const unitVariants = getUnitVariants(messageToSend);
            if (unitVariants.length > 0) {
              const unitMatched = filtered.filter((item: MarketReference) => {
                const titleLower = (item.title || '').toLowerCase();
                return unitVariants.some((v) => titleLower.includes(v.toLowerCase()));
              });
              if (unitMatched.length > 0) {
                filtered = unitMatched;
              }
            }

            // SPEC MATCHING: If user prompt contains model/year specs, prioritize items matching specs
            if (specTokens.length > 0) {
              const specMatched = filtered.filter((item: MarketReference) => {
                const itemTitle = (item.title || '').toLowerCase();
                return specTokens.some((token: string) => itemTitle.includes(token.toLowerCase()));
              });
              if (specMatched.length > 0) {
                filtered = specMatched;
              }
            }

            // DEDUPLICATE BY SELLER WEBSITE: Display specified item across different sell websites
            const uniqueMerchants = new Map<string, MarketReference>();
            for (const item of filtered) {
              const sourceKey = (item.source || 'Store').toLowerCase().trim();
              if (!uniqueMerchants.has(sourceKey)) {
                uniqueMerchants.set(sourceKey, item);
              }
            }

            const merchantOptions = Array.from(uniqueMerchants.values())
              .sort((a, b) => b.numeric_price - a.numeric_price)
              .slice(0, 6);

            if (merchantOptions.length > 0) {
              marketRefs = merchantOptions;
            } else {
              marketError = `No live options found under your limit price of ₹${effectiveLimitPrice.toLocaleString('en-IN')} for ${primaryProduct.name}.`;
            }
          } else {
            marketError = searchData.error || 'Live market pricing unavailable right now';
          }
        } catch {
          marketError = 'Live market search timed out or unavailable right now';
        }
      }

      // Handle Agent Decision Response
      if (decision.action === 'decline') {
        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          text: decision.reasoning,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'declined',
          decision,
          targetProduct: primaryProduct,
          matchingProducts: matching_products || [],
          marketReferences: marketRefs,
          marketSearchError: marketError
        };
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        // Purchase path: Prompt user to select from filtered live cards
        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          text: marketRefs.length > 0
            ? `Matched product "${primaryProduct?.name}" (Max Limit: ₹${primaryProduct?.limit_price?.toLocaleString('en-IN')}). Found ${marketRefs.length} live market option(s) under your limit. Select a listing below to complete checkout.`
            : `Matched catalog product "${primaryProduct?.name}" within mandate limits (Max Limit: ₹${primaryProduct?.limit_price?.toLocaleString('en-IN')}). ${marketError || decision.reasoning}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: marketRefs.length > 0 ? 'pending' : 'approved',
          decision,
          targetProduct: primaryProduct,
          matchingProducts: matching_products || [],
          marketReferences: marketRefs,
          marketSearchError: marketError
        };
        setMessages((prev) => [...prev, agentMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `agent-err-${Date.now()}`,
        sender: 'agent',
        text: `Error processing request: ${err.message || 'Unknown agent failure'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'error'
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col flex-1">
      {/* Header & Mandate Selector */}
      <div className="border-b border-zinc-800 pb-5 mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            VouchPay AI Agent Chat
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-normal">
              VouchPay Agent Active
            </span>
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Transact with pre-set spend mandates. Select an active mandate below to govern purchase requests.
          </p>
        </div>

        {/* Mandate Selection Tabs / Pills */}
        {mandates.length > 0 ? (
          <div className="bg-zinc-950/80 border border-zinc-850 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Active Mandate:</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {mandates.map((m) => {
                const isSelected = activeMandate?.id === m.id;
                const mName = m.name || `Mandate #${m.id}`;
                const mCats = Array.isArray(m.allowed_categories)
                  ? m.allowed_categories.join(', ')
                  : JSON.parse(m.allowed_categories || '[]').join(', ');

                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMandateId(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 border ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                        : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                    title={`Max Limit: ₹${m.max_amount?.toLocaleString('en-IN')} | Allowed: ${mCats}`}
                  >
                    <span>{mName}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${isSelected ? 'bg-emerald-400/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>
                      ₹{m.max_amount?.toLocaleString('en-IN')}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Mandate Quick Details Badge */}
            {activeMandate && (
              <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-zinc-800 text-[11px]">
                <div>
                  <span className="text-zinc-500 font-semibold block uppercase tracking-wider">Allowed</span>
                  <span className="text-emerald-400 font-medium">
                    {Array.isArray(activeMandate.allowed_categories)
                      ? activeMandate.allowed_categories.join(', ')
                      : JSON.parse(activeMandate.allowed_categories || '[]').join(', ')}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3.5 py-2 rounded-xl flex items-center gap-2">
            <span>⚠️</span>
            <span>No active spend mandate found. Please configure a mandate in Catalog Setup.</span>
          </div>
        )}
      </div>

      {/* Payment Success Notice Banner */}
      {paymentSuccessNotice && (
        <div className="mb-4 p-4 bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 rounded-xl text-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-semibold">{paymentSuccessNotice}</span>
          </div>
          <button
            onClick={() => setPaymentSuccessNotice(null)}
            className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Chat Container */}
      <div className="flex-1 min-h-[480px] bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between shadow-2xl">
        <div className="space-y-4 overflow-y-auto max-h-[520px] p-2 pr-3">
          {messages.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center space-y-4 py-12">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-lg">
                B
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">How can the Bounded Agent help you?</h3>
                <p className="text-zinc-400 text-sm max-w-sm mt-1">
                  Type a purchase request below. The agent will match catalog items and enforce active spend mandates.
                </p>
              </div>

              {/* Sample Prompts */}
              <div className="pt-4 space-y-2 w-full max-w-md">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Try a demo prompt:</span>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleSendMessage('buy me earphones under ₹1000')}
                    className="p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-xs text-zinc-300 text-left transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <span>"buy me earphones under ₹1000"</span>
                    <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage('order me a protein shake under ₹500')}
                    className="p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-xs text-zinc-300 text-left transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <span>"order me a protein shake under ₹500"</span>
                    <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage('buy a luxury watch for ₹50000')}
                    className="p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-xs text-zinc-300 text-left transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <span>"buy a luxury watch for ₹50,000" (Triggers Decline)</span>
                    <span className="text-red-400 group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${
                  msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div className="text-[10px] text-zinc-500 mb-1 px-1">{msg.timestamp}</div>
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-tl-none space-y-3'
                  }`}
                >
                  <div>{msg.text}</div>

                  {/* Agent Decision Badge & Action Box */}
                  {msg.sender === 'agent' && msg.status && (
                    <div className="pt-2 border-t border-zinc-850/80 space-y-3">
                      <div className="flex items-center gap-2">
                        {msg.status === 'approved' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            PURCHASE APPROVED
                          </span>
                        )}
                        {msg.status === 'declined' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                            TRANSACTION DECLINED
                          </span>
                        )}
                        {msg.status === 'error' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            AGENT ERROR
                          </span>
                        )}
                      </div>

                      {/* Payment Link Card */}
                      {msg.paymentLinkUrl && (
                        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-400 font-semibold">Approved Amount:</span>
                            <span className="text-emerald-400 font-bold font-mono text-sm">₹{msg.decision?.amount}</span>
                          </div>
                          <a
                            href={msg.paymentLinkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold rounded-lg text-sm transition-all shadow-lg hover:shadow-emerald-500/20"
                          >
                            Pay via Razorpay Sandbox
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      )}



                      {/* Live Filtered Market Options Section (SerpAPI Google Shopping <= limit_price) */}
                      {((msg.marketReferences && msg.marketReferences.length > 0) || msg.marketSearchError) && (
                        <div className="pt-3 border-t border-zinc-850/80 space-y-2.5">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Live Options Under Max Limit (₹{msg.targetProduct?.limit_price?.toLocaleString('en-IN')})
                            </span>
                            <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-mono">
                              SerpAPI Live Search
                            </span>
                          </div>

                          {msg.marketReferences && msg.marketReferences.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2.5">
                              {msg.marketReferences.map((refItem, idx) => (
                                <div key={idx} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition-colors">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {refItem.thumbnail ? (
                                      <img src={refItem.thumbnail} alt={refItem.title} className="w-12 h-12 object-cover rounded-lg shrink-0 border border-zinc-800 bg-white/5" />
                                    ) : (
                                      <div className="w-12 h-12 bg-zinc-950 rounded-lg shrink-0 border border-zinc-800 flex items-center justify-center text-xs text-zinc-500">
                                        🛍️
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="font-semibold text-white text-xs sm:text-sm truncate" title={refItem.title}>{refItem.title}</div>
                                      <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                                        <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px]">{refItem.source}</span>
                                        <span className="text-emerald-400 font-mono font-bold text-xs">{refItem.price}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                    {refItem.link && (
                                      <a
                                        href={refItem.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-750 text-indigo-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                                        title={`View live merchant listing on ${refItem.source}`}
                                      >
                                        View listing ↗
                                      </a>
                                    )}
                                    {msg.targetProduct && (
                                      <button
                                        onClick={() => handleSelectLiveCard(msg.targetProduct!, refItem)}
                                        disabled={loading}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                      >
                                        Select & Purchase for ₹{refItem.numeric_price?.toLocaleString('en-IN') || refItem.price}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 bg-amber-950/30 border border-amber-500/20 rounded-xl text-xs text-amber-300 font-medium">
                              ⚠️ {msg.marketSearchError || 'No options found under your limit price.'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex items-center gap-3 p-4 bg-zinc-950 border border-zinc-800 rounded-2xl rounded-tl-none max-w-[85%] mr-auto">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
              </div>
              <span className="text-xs text-zinc-400 font-medium">Gemini Agent reasoning & checking mandate...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="mt-4 pt-4 border-t border-zinc-800 flex gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={loading}
            placeholder="Type your purchase request (e.g., 'buy earphones under ₹1000')..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold px-6 rounded-xl text-sm transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500 text-sm">Loading Chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}
