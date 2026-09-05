'use client';

import React, { useState, useEffect } from 'react';

interface Mandate {
  id: number;
  name?: string;
  max_amount: number;
  allowed_categories: string[];
  expires_at: string;
}

interface Product {
  id: number;
  name: string;
  limit_price: number;
  category: string;
  price?: number;
}

export const PREDEFINED_CATEGORIES = [
  'Fitness',
  'Food',
  'Electronics',
  'Clothing',
  'Books',
  'Software',
  'Beauty & Personal Care',
  'Home & Kitchen',
  'Toys & Games',
  'Sports & Outdoors',
  'Automotive',
  'Stationery & Office',
  'Health & Wellness',
  'Travel & Luggage'
];

export default function CatalogSetup() {
  const [products, setProducts] = useState<Product[]>([]);
  const [mandates, setMandates] = useState<Mandate[]>([]);

  // Mandate Form State
  const [mandateName, setMandateName] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');

  // Product Form State
  const [prodName, setProdName] = useState('');
  const [prodLimitPrice, setProdLimitPrice] = useState('');
  const [prodCategory, setProdCategory] = useState(PREDEFINED_CATEGORIES[0]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    setError(null);
    try {
      const [resProd, resMandate] = await Promise.all([
        fetch('/api/catalog/products'),
        fetch('/api/catalog/mandate')
      ]);

      const dataProd = await resProd.json();
      const dataMandate = await resMandate.json();

      if (dataProd.success) {
        setProducts(dataProd.products);
      } else {
        throw new Error(dataProd.error || 'Failed to fetch products');
      }

      if (dataMandate.success) {
        setMandates(dataMandate.mandates || (dataMandate.mandate ? [dataMandate.mandate] : []));
      } else {
        throw new Error(dataMandate.error || 'Failed to fetch mandates');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching initial data.');
    } finally {
      setLoading(false);
    }
  }

  // Handle Mandate Form Submission
  async function handleSaveMandate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!maxAmount || selectedCategories.length === 0 || !expiresAt) {
      setError('Please fill in all mandate details and select at least one category.');
      return;
    }

    if (parseFloat(maxAmount) > 1000000) {
      setError('Max spend amount cannot exceed ₹10,00,000 (1,000,000).');
      return;
    }

    try {
      const response = await fetch('/api/catalog/mandate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mandateName || undefined,
          max_amount: parseFloat(maxAmount),
          allowed_categories: selectedCategories,
          expires_at: expiresAt
        })
      });

      const data = await response.json();
      if (data.success) {
        setMandates((prev) => [data.mandate, ...prev]);
        setSuccessMsg(`Mandate "${data.mandate.name || 'Spend Mandate'}" created successfully.`);
        setMandateName('');
        setMaxAmount('');
        setSelectedCategories([]);
        setExpiresAt('');
      } else {
        setError(data.error || 'Failed to save mandate.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the mandate.');
    }
  }

  // Handle Mandate Deletion
  async function handleDeleteMandate(mandate: Mandate) {
    const confirmed = window.confirm(
      `Are you sure you want to delete mandate "${mandate.name || `Mandate #${mandate.id}`}"?`
    );
    if (!confirmed) return;

    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(`/api/catalog/mandate?id=${mandate.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        setMandates((prev) => prev.filter((m) => m.id !== mandate.id));
        setSuccessMsg(`Mandate "${mandate.name || `Mandate #${mandate.id}`}" removed.`);
      } else {
        setError(data.error || 'Failed to delete mandate.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting mandate.');
    }
  }

  // Handle Product Form Submission
  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!prodName || !prodLimitPrice || !prodCategory) {
      setError('Please fill in all product details.');
      return;
    }

    try {
      const response = await fetch('/api/catalog/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prodName,
          limit_price: parseFloat(prodLimitPrice),
          category: prodCategory
        })
      });

      const data = await response.json();
      if (data.success) {
        setProducts((prev) => [data.product, ...prev]);
        setSuccessMsg(`Product "${prodName}" registered with max limit ₹${parseFloat(prodLimitPrice).toLocaleString('en-IN')}.`);
        setProdName('');
        setProdLimitPrice('');
      } else {
        setError(data.error || 'Failed to add product.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while adding the product.');
    }
  }

  // Handle Product Deletion
  async function handleDeleteProduct(product: Product) {
    const confirmed = window.confirm(
      `Are you sure you want to delete product "${product.name}" from catalog limits?\n\nHistorical audit trail logs will remain intact.`
    );
    if (!confirmed) return;

    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(`/api/catalog/products?id=${product.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        setSuccessMsg(`Product "${product.name}" removed from catalog.`);
      } else {
        setError(data.error || 'Failed to delete product.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting the product.');
    }
  }

  const handleCategoryCheckboxChange = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const isMandateExpired = (expiry: string) => {
    return new Date(expiry) < new Date();
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-8 flex-1">
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-3xl font-extrabold text-white">Catalog & Mandate Setup</h1>
        <p className="text-zinc-400 mt-2">
          Define spending boundaries and register products for agentic search and transacting.
        </p>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/30 text-red-200 rounded-lg text-sm flex items-start gap-3">
          <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 rounded-lg text-sm flex items-start gap-3">
          <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>{successMsg}</div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12 text-zinc-500 text-sm">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading Catalog and Mandates...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Mandate Management Column */}
          <div className="space-y-6 lg:col-span-2">
            
            {/* Active Mandates Cards Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                Active Spend Mandates ({mandates.length})
              </h2>
            </div>

            {/* List of Active Mandates */}
            {mandates.length === 0 ? (
              <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 text-sm">
                No spend mandates have been created yet. The agent will not be allowed to perform any transactions without an active mandate.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {mandates.map((m) => {
                  const expired = isMandateExpired(m.expires_at);
                  return (
                    <div key={m.id} className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4 shadow-sm hover:border-zinc-700 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base font-bold text-white truncate">
                            {m.name || `Mandate #${m.id}`}
                          </span>
                          {expired ? (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded-full shrink-0">
                              Expired
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full shrink-0 animate-pulse">
                              Active
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteMandate(m)}
                          className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0"
                          title="Delete Mandate"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg">
                          <span className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">Max Spend Limit</span>
                          <span className="text-lg font-bold text-white">₹{m.max_amount?.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg">
                          <span className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">Expires At</span>
                          <span className="text-xs font-medium text-zinc-300">
                            {new Date(m.expires_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg sm:col-span-1">
                          <span className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Allowed Categories</span>
                          <div className="flex flex-wrap gap-1">
                            {m.allowed_categories.map((c) => (
                              <span key={c} className="text-[11px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Create Mandate Form */}
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4 shadow-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Configure New Mandate
              </h2>
              <form onSubmit={handleSaveMandate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Mandate Name / Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Groceries Budget, Electronics - One Time"
                    value={mandateName}
                    onChange={(e) => setMandateName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Max Spend Amount (INR)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="1000000"
                      step="any"
                      placeholder="e.g. 100000"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Expires At</label>
                    <input
                      type="datetime-local"
                      required
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-2">Allowed Categories</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {PREDEFINED_CATEGORIES.map((cat) => {
                      const isChecked = selectedCategories.includes(cat);
                      return (
                        <label
                          key={cat}
                          className={`flex items-center gap-2 text-sm p-2.5 border rounded-lg cursor-pointer select-none transition-all duration-200 ${
                            isChecked
                              ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                              : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleCategoryCheckboxChange(cat)}
                            className="sr-only"
                          />
                          <span className={`w-3 h-3 rounded-full border transition-all ${
                            isChecked ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600'
                          }`}></span>
                          {cat}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition-colors cursor-pointer shadow-lg hover:shadow-indigo-500/10"
                >
                  Create Spend Mandate
                </button>
              </form>
            </div>
          </div>

          {/* Product Management Column */}
          <div className="space-y-6">
            
            {/* Add Product Form */}
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4 shadow-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Add Product to Catalog
              </h2>
              <form onSubmit={handleAddProduct} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Protein Powder 1kg"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Max Limit Price (INR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    placeholder="e.g. 140000"
                    value={prodLimitPrice}
                    onChange={(e) => setProdLimitPrice(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Category</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {PREDEFINED_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-sm transition-colors cursor-pointer shadow-lg hover:shadow-emerald-500/10"
                >
                  Register Product Limit
                </button>
              </form>
            </div>

            {/* Product List */}
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4 shadow-2xl">
              <h2 className="text-lg font-bold text-white flex items-center justify-between">
                <span>Registered Product Limits</span>
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded-full border border-zinc-750">
                  {products.length} Items
                </span>
              </h2>
              <div className="max-h-[360px] overflow-y-auto space-y-2.5 pr-1">
                {products.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-6">No products registered yet.</p>
                ) : (
                  products.map((p) => (
                    <div key={p.id} className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-zinc-900 rounded-lg shrink-0 border border-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-bold">
                          📦
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-white truncate">{p.name}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">{p.category}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Max Acceptable</div>
                          <div className="text-emerald-400 font-bold font-mono text-sm">
                            ₹{(p.limit_price || p.price)?.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                          title={`Delete "${p.name}" from catalog limits`}
                        >
                          <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
