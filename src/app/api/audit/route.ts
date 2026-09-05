import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const actions = await db.all('SELECT * FROM agent_actions ORDER BY id DESC');
    return NextResponse.json({ success: true, actions });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch audit log' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { order_id, payment_id } = await request.json();
    if (!order_id) {
      return NextResponse.json({ success: false, error: 'order_id is required' }, { status: 400 });
    }

    const existing: any = await db.get(
      "SELECT * FROM agent_actions WHERE razorpay_order_id = ? AND (status = 'pending' OR status IS NULL)",
      [order_id]
    );

    if (existing) {
      const updatedReasoning = `${existing.reasoning} (Payment Captured: ${payment_id || 'Redirect'})`;
      await db.run("UPDATE agent_actions SET status = 'success', reasoning = ? WHERE id = ?", [updatedReasoning, existing.id]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await db.run('DELETE FROM agent_actions');
    try {
      await db.run("DELETE FROM sqlite_sequence WHERE name='agent_actions'");
    } catch {}

    return NextResponse.json({ success: true, message: 'All audit trail records cleared successfully.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to clear audit trail' }, { status: 500 });
  }
}

