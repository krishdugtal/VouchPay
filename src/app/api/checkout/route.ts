import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import db from '@/lib/db';

// Initialize Razorpay SDK
// We use lazy initialization in the request to log key issues gracefully to the db
let razorpay: Razorpay | null = null;
try {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (keyId && keySecret) {
    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
} catch (error) {
  console.error('Failed to initialize Razorpay SDK:', error);
}

export async function POST(request: Request) {
  let mandateId: number | null = null;
  let productId: number | null = null;
  let parsedAmount = 0;

  try {
    const body = await request.json();
    const { action, product_id, mandate_id, amount, reasoning } = body;

    mandateId = mandate_id ? parseInt(mandate_id) : null;
    productId = product_id ? parseInt(product_id) : null;
    parsedAmount = amount ? parseFloat(amount) : 0;

    // 1. Check Razorpay SDK is initialized
    if (!razorpay) {
      const dbErrReason = 'Razorpay keys are missing or invalid in environment config.';
      await db.run(
        `INSERT INTO agent_actions (mandate_id, action_type, reasoning, amount, status) VALUES (?, 'payment_failed', ?, ?, 'failed')`,
        [mandateId, dbErrReason, parsedAmount]
      );

      return NextResponse.json({ success: false, error: dbErrReason }, { status: 500 });
    }

    // 2. Fetch the Mandate
    if (!mandateId) {
      return NextResponse.json({ success: false, error: 'Mandate ID is required for checkout verification.' }, { status: 400 });
    }

    const mandate: any = await db.get('SELECT * FROM mandates WHERE id = ?', [mandateId]);
    if (!mandate) {
      const dbErrReason = `Mandate with ID ${mandateId} not found in database.`;
      await db.run(
        `INSERT INTO agent_actions (mandate_id, action_type, reasoning, amount, status) VALUES (null, 'purchase_declined', ?, ?, 'declined')`,
        [dbErrReason, parsedAmount]
      );

      return NextResponse.json({ success: false, error: dbErrReason }, { status: 400 });
    }

    // Parse mandate details
    let allowedCategories: string[] = [];
    try {
      allowedCategories = typeof mandate.allowed_categories === 'string' ? JSON.parse(mandate.allowed_categories) : mandate.allowed_categories;
    } catch {
      allowedCategories = [];
    }

    // 3. Fetch Product
    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID is required.' }, { status: 400 });
    }

    const product: any = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      const dbErrReason = `Product with ID ${productId} not found in database.`;
      await db.run(
        `INSERT INTO agent_actions (mandate_id, action_type, reasoning, amount, status) VALUES (?, 'purchase_declined', ?, ?, 'declined')`,
        [mandateId, dbErrReason, parsedAmount]
      );

      return NextResponse.json({ success: false, error: dbErrReason }, { status: 400 });
    }

    // Generate unique transaction group ID to visually link attempt & resolution
    const transactionGroupId = `tx_grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Determine exact transaction price: use exact selected live listing price (parsedAmount)
    const limitPriceBoundary = product.limit_price || product.price || 0;
    const transactionPrice = parsedAmount > 0 ? parsedAmount : limitPriceBoundary;

    // Log the purchase attempt with exact listing price & group ID
    await db.run(
      `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, transaction_group_id)
       VALUES (?, ?, 'purchase_attempt', ?, ?, 'pending', ?)`,
      [
        mandateId,
        mandate.name || `Mandate #${mandateId}`,
        `Attempting to purchase "${product.name}" at selected listing price ₹${transactionPrice.toLocaleString('en-IN')}. Reasoning: ${reasoning || 'None'}`,
        transactionPrice,
        transactionGroupId
      ]
    );

    // 4. Server-side Mandate Validations
    const now = new Date();
    const expiry = new Date(mandate.expires_at);

    // Check expiry
    if (expiry < now) {
      const dbErrReason = `Transaction blocked: Mandate has expired (expired at ${mandate.expires_at}).`;
      await db.run(
        `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, transaction_group_id)
         VALUES (?, ?, 'purchase_declined', ?, ?, 'declined', ?)`,
        [mandateId, mandate.name || `Mandate #${mandateId}`, dbErrReason, transactionPrice, transactionGroupId]
      );

      return NextResponse.json({ success: false, error: dbErrReason }, { status: 400 });
    }

    // Check transaction amount against mandate spend limit
    if (transactionPrice > mandate.max_amount) {
      const dbErrReason = `Transaction blocked: Selected listing price (₹${transactionPrice.toLocaleString('en-IN')}) exceeds mandate spend limit (₹${mandate.max_amount.toLocaleString('en-IN')}).`;
      await db.run(
        `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, transaction_group_id)
         VALUES (?, ?, 'purchase_declined', ?, ?, 'declined', ?)`,
        [mandateId, mandate.name || `Mandate #${mandateId}`, dbErrReason, transactionPrice, transactionGroupId]
      );

      return NextResponse.json({ success: false, error: dbErrReason }, { status: 400 });
    }

    // Check transaction amount against product limit price boundary
    if (limitPriceBoundary > 0 && transactionPrice > limitPriceBoundary) {
      const dbErrReason = `Transaction blocked: Selected listing price (₹${transactionPrice.toLocaleString('en-IN')}) exceeds catalog limit price boundary (₹${limitPriceBoundary.toLocaleString('en-IN')}).`;
      await db.run(
        `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, transaction_group_id)
         VALUES (?, ?, 'purchase_declined', ?, ?, 'declined', ?)`,
        [mandateId, mandate.name || `Mandate #${mandateId}`, dbErrReason, transactionPrice, transactionGroupId]
      );

      return NextResponse.json({ success: false, error: dbErrReason }, { status: 400 });
    }

    // Check category
    if (!allowedCategories.includes(product.category)) {
      const dbErrReason = `Transaction blocked: Product category "${product.category}" is not in the allowed categories list (${allowedCategories.join(', ')}).`;
      await db.run(
        `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, transaction_group_id)
         VALUES (?, ?, 'purchase_declined', ?, ?, 'declined', ?)`,
        [mandateId, mandate.name || `Mandate #${mandateId}`, dbErrReason, transactionPrice, transactionGroupId]
      );

      return NextResponse.json({ success: false, error: dbErrReason }, { status: 400 });
    }

    // 5. Create Razorpay Order with exact listing transactionPrice
    let order;
    try {
      order = await razorpay.orders.create({
        amount: Math.round(transactionPrice * 100), // convert to paise using exact listing price!
        currency: 'INR',
        receipt: `receipt_order_${Date.now()}`,
        notes: {
          product_id: product.id.toString(),
          mandate_id: mandate.id.toString(),
          reasoning: reasoning || 'Manual validation'
        }
      });

      // Update purchase_attempt action with razorpay_order_id now that it is generated
      await db.run(
        `UPDATE agent_actions SET razorpay_order_id = ? WHERE transaction_group_id = ? AND action_type = 'purchase_attempt'`,
        [order.id, transactionGroupId]
      );
    } catch (orderError: any) {
      const errorDetail = orderError?.description || orderError?.error?.description || orderError?.message || JSON.stringify(orderError);
      const dbErrReason = `Razorpay Order Creation Failed: ${errorDetail}`;
      await db.run(
        `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, transaction_group_id)
         VALUES (?, ?, 'payment_failed', ?, ?, 'failed', ?)`,
        [mandateId, mandate.name || `Mandate #${mandateId}`, dbErrReason, transactionPrice, transactionGroupId]
      );

      return NextResponse.json({ success: false, error: dbErrReason }, { status: 500 });
    }

    // 6. Create Razorpay Payment Link with exact listing transactionPrice
    let paymentLink;
    try {
      const origin = request.headers.get('origin') || 'http://localhost:3001';
      paymentLink = await razorpay.paymentLink.create({
        amount: Math.round(transactionPrice * 100), // paise using exact listing price!
        currency: 'INR',
        accept_partial: false,
        reference_id: order.id,
        description: `Purchase of ${product.name} (via VouchPay)`,
        customer: {
          name: 'Agent Shopper',
          email: 'agent-shopper@example.com',
          contact: '+919876543210'
        },
        notify: {
          sms: false,
          email: false
        },
        reminder_enable: false,
        notes: {
          order_id: order.id,
          product_id: product.id.toString(),
          mandate_id: mandate.id.toString()
        },
        callback_url: `${origin}/chat?order_id=${order.id}`,
        callback_method: 'get'
      });
    } catch (linkError: any) {
      const errorDetail = linkError?.description || linkError?.error?.description || linkError?.message || JSON.stringify(linkError);
      const dbErrReason = `Razorpay Payment Link Creation Failed: ${errorDetail}`;
      await db.run(
        `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, razorpay_order_id, transaction_group_id)
         VALUES (?, ?, 'payment_failed', ?, ?, 'failed', ?, ?)`,
        [mandateId, mandate.name || `Mandate #${mandateId}`, dbErrReason, transactionPrice, order.id, transactionGroupId]
      );

      return NextResponse.json({ success: false, error: dbErrReason }, { status: 500 });
    }

    // 7. Log approval in DB with exact listing price & transaction_group_id
    await db.run(
      `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, razorpay_order_id, transaction_group_id)
       VALUES (?, ?, 'purchase_approved', ?, ?, 'pending', ?, ?)`,
      [
        mandateId,
        mandate.name || `Mandate #${mandateId}`,
        `Transaction approved & payment link generated for "${product.name}". Selected Listing Price: ₹${transactionPrice.toLocaleString('en-IN')}.`,
        transactionPrice,
        order.id,
        transactionGroupId
      ]
    );

    return NextResponse.json({
      success: true,
      paymentLinkUrl: paymentLink.short_url,
      orderId: order.id
    });


  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
