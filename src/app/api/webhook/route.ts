import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import db from '@/lib/db';

// Initialize Razorpay SDK for creating retry orders
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
  console.error('Failed to initialize Razorpay SDK in webhook:', error);
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature) {
      return NextResponse.json({ success: false, error: 'Missing x-razorpay-signature header' }, { status: 400 });
    }

    if (!secret) {
      const errMsg = 'RAZORPAY_WEBHOOK_SECRET is not configured in .env.local. Webhook signature verification cannot proceed.';
      console.error(errMsg);
      return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
    }

    // Verify webhook signature (MUST NOT skip)
    const isValid = Razorpay.validateWebhookSignature(rawBody, signature, secret);
    if (!isValid) {
      console.error('[Webhook] Invalid webhook signature detected.');
      return NextResponse.json({ success: false, error: 'Signature verification failed' }, { status: 400 });
    }

    console.log('[Webhook] Signature verified successfully.');

    // Parse event payload
    const eventData = JSON.parse(rawBody);
    const event = eventData.event;
    const paymentEntity = eventData.payload?.payment?.entity;

    if (!paymentEntity) {
      return NextResponse.json({ success: false, error: 'Invalid payload structure: missing payment entity' }, { status: 400 });
    }

    const orderId = paymentEntity.order_id;
    if (!orderId) {
      console.log('[Webhook] Warning: Payment entity does not have an order_id. Skipping database log.');
      return NextResponse.json({ success: true, message: 'Skipped: No order_id present' });
    }

    // ----------------------------------------------------
    // CASE A: Payment Captured (Success Path)
    // ----------------------------------------------------
    if (event === 'payment.captured') {
      console.log(`[Webhook] Processing payment.captured for Order ID: ${orderId}`);

      // Check if this captured payment has already been logged as success (Idempotency)
      const existingSuccess = await db.get(
        `SELECT * FROM agent_actions 
         WHERE razorpay_order_id = ? AND (action_type = 'purchase_approved' OR action_type = 'retry_attempt') AND status = 'success'`,
        [orderId]
      );

      if (existingSuccess) {
        console.log(`[Webhook] Idempotency check: Order ${orderId} has already been logged as successful. Skipping duplicate log.`);
        return NextResponse.json({ success: true, message: 'Already processed as successful.' });
      }

      // 1. Try finding existing pending action for exact orderId
      const existingAction: any = await db.get(
        `SELECT * FROM agent_actions 
         WHERE razorpay_order_id = ? AND (action_type = 'purchase_approved' OR action_type = 'retry_attempt')
         ORDER BY id DESC LIMIT 1`,
        [orderId]
      );

      if (existingAction) {
        // Keep original reasoning with product details intact!
        const updatedReasoning = `${existingAction.reasoning} (Payment Captured: ${paymentEntity.id})`;
        await db.run(
          `UPDATE agent_actions SET status = 'success', reasoning = ? WHERE id = ?`,
          [updatedReasoning, existingAction.id]
        );
        console.log(`[Webhook] Updated existing action #${existingAction.id} to success.`);
      } else {
        // 2. Try finding recent pending purchase_approved action (in case orderId mismatch occurred)
        const fallbackAction: any = await db.get(
          `SELECT * FROM agent_actions 
           WHERE action_type = 'purchase_approved' AND status = 'pending'
           ORDER BY id DESC LIMIT 1`
        );

        if (fallbackAction) {
          const updatedReasoning = `${fallbackAction.reasoning} (Payment Captured: ${paymentEntity.id})`;
          await db.run(
            `UPDATE agent_actions SET status = 'success', razorpay_order_id = ?, reasoning = ? WHERE id = ?`,
            [orderId, updatedReasoning, fallbackAction.id]
          );
          console.log(`[Webhook] Updated fallback action #${fallbackAction.id} to success with order ${orderId}.`);
        } else {
          // 3. Fallback: Create new success action log with product details if available in notes
          const prodId = paymentEntity.notes?.product_id;
          const mandateId = paymentEntity.notes?.mandate_id ? parseInt(paymentEntity.notes.mandate_id) : null;
          let prodName = '';
          if (prodId) {
            const prod: any = await db.get('SELECT name, category FROM products WHERE id = ?', [prodId]);
            if (prod) prodName = ` "${prod.name}" (${prod.category})`;
          }

          let mandateName: string | null = null;
          if (mandateId) {
            const m: any = await db.get('SELECT name FROM mandates WHERE id = ?', [mandateId]);
            if (m) mandateName = m.name;
          }

          const reasoning = `Payment captured successfully${prodName}. Payment ID: ${paymentEntity.id}`;
          const paidAmount = (paymentEntity.amount || 0) / 100;

          await db.run(
            `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, razorpay_order_id)
             VALUES (?, ?, 'purchase_approved', ?, ?, 'success', ?)`,
            [mandateId, mandateName, reasoning, paidAmount, orderId]
          );
          console.log('[Webhook] Created new success action log for order', orderId);
        }
      }
    }
    // ----------------------------------------------------
    // CASE B: Payment Failed (Recovery Path)
    // ----------------------------------------------------
    else if (event === 'payment.failed') {
      console.log(`[Webhook] Processing payment.failed for Order ID: ${orderId}`);
      const failureReason = paymentEntity.error_description || paymentEntity.error_reason || 'Unknown payment failure';

      // 1. Check if the failed order was already a retry attempt
      const wasRetry: any = await db.get(
        `SELECT * FROM agent_actions WHERE razorpay_order_id = ? AND action_type = 'retry_attempt'`,
        [orderId]
      );

      if (wasRetry) {
        // Already retried once. Abandon gracefully.
        console.log(`[Webhook] Order ${orderId} was already a retry attempt. Abandoning recovery flow.`);
        await db.run(
          `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, razorpay_order_id)
           VALUES (?, ?, 'recovery_abandoned', ?, ?, 'failed', ?)`,
          [
            wasRetry.mandate_id,
            wasRetry.mandate_name,
            `Payment failed on retry attempt. Abandoning gracefully. Failure Reason: ${failureReason}`,
            wasRetry.amount,
            orderId
          ]
        );

        await db.run(
          `UPDATE agent_actions SET status = 'failed' WHERE razorpay_order_id = ? AND action_type = 'retry_attempt'`,
          [orderId]
        );

        return NextResponse.json({ success: true, message: 'Recovery abandoned' });
      }

      // 2. Find the original purchase_approved record for this order (only if not already marked success)
      const originalAction: any = await db.get(
        `SELECT * FROM agent_actions 
         WHERE razorpay_order_id = ? AND action_type = 'purchase_approved' AND status != 'success'
         LIMIT 1`,
        [orderId]
      );

      if (!originalAction) {
        const logMsg = `Payment failed for order ${orderId}: ${failureReason}. No matching approval found, cannot determine recovery path.`;
        console.warn(`[Webhook] ${logMsg}`);

        await db.run(
          `INSERT INTO agent_actions (mandate_id, action_type, reasoning, amount, status, razorpay_order_id)
           VALUES (null, 'payment_failed', ?, ?, 'failed', ?)`,
          [logMsg, paymentEntity.amount / 100, orderId]
        );

        return NextResponse.json({ success: true, message: 'Unmatched failed payment logged gracefully' });
      }

      // Update original action status to failed
      await db.run(`UPDATE agent_actions SET status = 'failed' WHERE id = ?`, [originalAction.id]);

      // 3. Automated Retry Recovery Logic
      if (!razorpay) {
        await db.run(
          `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, razorpay_order_id)
           VALUES (?, ?, 'recovery_abandoned', ?, ?, 'failed', ?)`,
          [
            originalAction.mandate_id,
            originalAction.mandate_name,
            `Payment failed: ${failureReason}. Cannot attempt automated retry because Razorpay SDK is uninitialized.`,
            originalAction.amount,
            orderId
          ]
        );

        return NextResponse.json({ success: true, message: 'SDK missing, retry skipped' });
      }

      // Re-verify Mandate before retrying
      if (originalAction.mandate_id) {
        const mandate: any = await db.get('SELECT * FROM mandates WHERE id = ?', [originalAction.mandate_id]);

        if (!mandate || new Date(mandate.expires_at) < new Date()) {
          const abandonReason = `Automated retry blocked: Mandate ${originalAction.mandate_id} is expired or invalid.`;
          console.warn(`[Webhook] ${abandonReason}`);
          await db.run(
            `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, razorpay_order_id)
             VALUES (?, ?, 'recovery_abandoned', ?, ?, 'failed', ?)`,
            [
              originalAction.mandate_id,
              originalAction.mandate_name,
              abandonReason,
              originalAction.amount,
              orderId
            ]
          );
          return NextResponse.json({ success: true, message: 'Mandate expired, retry abandoned' });
        }
      }

      // Create new retry order with Razorpay
      try {
        const newOrder = await razorpay.orders.create({
          amount: Math.round(originalAction.amount * 100),
          currency: 'INR',
          receipt: `receipt_retry_${Date.now()}`,
          notes: {
            original_order_id: orderId,
            reason: 'automated_payment_recovery_retry'
          }
        });

        console.log(`[Webhook] Recovery Retry Order created: ${newOrder.id}`);

        await db.run(
          `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, razorpay_order_id)
           VALUES (?, ?, 'retry_attempt', ?, ?, 'pending', ?)`,
          [
            originalAction.mandate_id,
            originalAction.mandate_name,
            `Initiated automated payment recovery retry. Original Order ${orderId} failed: ${failureReason}. New Order: ${newOrder.id}`,
            originalAction.amount,
            newOrder.id
          ]
        );

        return NextResponse.json({
          success: true,
          message: 'Automated retry order generated',
          new_order_id: newOrder.id
        });
      } catch (retryErr: any) {
        console.error('[Webhook] Failed to create retry order:', retryErr);
        await db.run(
          `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status, razorpay_order_id)
           VALUES (?, ?, 'recovery_abandoned', ?, ?, 'failed', ?)`,
          [
            originalAction.mandate_id,
            originalAction.mandate_name,
            `Failed to create automated retry order: ${retryErr.message || retryErr}`,
            originalAction.amount,
            orderId
          ]
        );
        return NextResponse.json({ success: false, error: 'Failed to create retry order' }, { status: 500 });
      }
    }


    return NextResponse.json({ success: true, message: `Event ${event} acknowledged.` });
  } catch (error: any) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
