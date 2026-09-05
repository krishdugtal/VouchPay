# VouchPay 🛒⚡
> **Track**: AI Growth & Agentic Commerce | **Hackathon**: Razorpay AI Buildathon 2026

An agentic commerce layer that makes merchants transactable by AI agents (or humans via chat). Every purchase is bounded by a pre-set spend mandate, fully logged in an explainable audit trail, and automatically recovered if a payment fails. Built using Next.js 14+ (App Router), TypeScript, Tailwind CSS, Turso / LibSQL via `@libsql/client`, Razorpay Test Mode SDK, and Google Gemini API (`gemini-3.6-flash`).

---

## 🌟 Key Features & Architecture

1. **Spend Mandates (Boundaries & Safety)**:
   - Merchants/Users define a active spend mandate: `max_amount` (up to ₹10,00,000), `allowed_categories` (multi-select), and `expires_at` date.
   - Dual-layer compliance validation: verified both by Gemini AI agent reasoning AND enforced server-side before Razorpay Order creation.

2. **Natural Language AI Chat (`/chat`)**:
   - Natural language shopping interface powered by Google Gemini AI (`gemini-3.6-flash`) with structured JSON mode (`responseSchema`).
   - Generates instant payment checkout links for approved items, or displays explainable decline reasons.

3. **Autonomous Payment Failure Recovery**:
   - Razorpay Webhook listener with HMAC-SHA256 signature verification (`x-razorpay-signature`).
   - On `payment.captured`: logs success idempotently.
   - On `payment.failed`:
     - **Path (a) Auto-Retry**: Automatically creates a new Razorpay order & payment link if mandate is still valid.
     - **Path (b) Re-authorization Required**: Blocks retries if the mandate is expired or spending limit would be exceeded.
     - **Path (c) Abandon Gracefully**: Prevents infinite loops by abandoning after 1 retry attempt.
     - **Unmatched Orders**: Gracefully logs failures for unlinked test orders with `200 OK` responses.

4. **Live Audit Trail Dashboard (`/audit-trail`)**:
   - Real-time audit dashboard polling `/api/audit` every 3 seconds.
   - Shows action types (`purchase_approved`, `purchase_declined`, `payment_failed`, `retry_attempt`, `recovery_abandoned`, `system_error`), reasoning, amounts, status, and linked Razorpay Order IDs.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14+ (App Router), React 19, TypeScript
- **Styling**: Vanilla Tailwind CSS v4 (Dark-mode, glassmorphism, responsive grid)
- **Database**: Turso / LibSQL via `@libsql/client` (Serverless hosted SQLite database compatible with Vercel)

- **Payments**: Razorpay Node SDK (Test Mode Orders, Payment Links, Webhooks)
- **AI Agent**: Google Gemini API (`@google/generative-ai` SDK, `gemini-3.6-flash`)

---

## 📋 Prerequisites & Environment Setup

Create a `.env.local` file in the workspace root with the following variables:

```env
# Razorpay Test Mode API Credentials (from Razorpay Dashboard > Settings > API Keys)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Razorpay Webhook Secret (configured when setting up Webhooks in Razorpay Dashboard)
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Google Gemini API Key (from Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key
```

> **Note**: `.env.local` is listed in `.gitignore` and must never be committed.

---

## 🚀 Running the Application Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the Next.js development server**:
   ```bash
   npm run dev
   ```
   The app will run at `http://localhost:3001` (or `http://localhost:3000` / `3002`).

3. **(Optional) Run Webhook via ngrok for Live Payment Events**:
   ```bash
   ngrok http 3001
   ```
   Add the ngrok URL to your Razorpay Dashboard under **Webhooks**:
   `https://<your-ngrok-subdomain>.ngrok-free.app/api/webhook`
   Set the secret to match `RAZORPAY_WEBHOOK_SECRET` and subscribe to `payment.captured` and `payment.failed` events.

---

## 📖 Pages Included

1. `/catalog-setup`
   - Form to register catalog items (Name, Price, Category).
   - Form to configure active spend mandate (`max_amount` up to ₹10,00,000, `allowed_categories`, `expires_at`).
   - Includes a sandbox checkout testing card.

2. `/chat`
   - Interactive AI agent chat interface.
   - Displays active mandate bounds in header.
   - Supports 1-click demo prompts.
   - Generates Razorpay Sandbox Payment Links inside chat bubbles.

3. `/audit-trail`
   - Real-time audit timeline and metrics cards.
   - Searchable, filterable by status and action type.

---

## 🧪 Demo Walkthrough Guide for Judges

1. **Step 1: Setup Mandate & Catalog**
   - Go to `/catalog-setup`.
   - Add a product: `Earphones` | Price: `₹850` | Category: `Electronics`.
   - Set a mandate: Max Amount: `₹5,000` | Allowed Categories: Check `Electronics`, `Fitness` | Expiry: Future date.

2. **Step 2: Test AI Agent Reasoning (`/chat`)**
   - Click `"buy me earphones under ₹1000"`.
   - Observe Gemini agent approval: `PURCHASE APPROVED` badge + reasoning + Razorpay payment link.
   - Click `"buy a luxury watch for ₹50,000"`.
   - Observe decline: `TRANSACTION DECLINED` badge + reasoning explaining budget breach.

3. **Step 3: Test Payment & Webhooks**
   - Click **"Pay via Razorpay Sandbox"** on an approved item.
   - Complete payment using Razorpay Test Mode (Netbanking / Cards).
   - Return to `/chat` and navigate to `/audit-trail` to verify the `payment.captured` event transition to `SUCCESS`.

4. **Step 4: Inspect Audit Trail (`/audit-trail`)**
   - View live logs showing every decision, mandate check, payment link, and webhook event.
