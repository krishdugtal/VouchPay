import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const rawMandates: any[] = await db.all('SELECT * FROM mandates ORDER BY id DESC');

    const mandates = rawMandates.map((m) => {
      let parsedCategories: string[] = [];
      try {
        parsedCategories = typeof m.allowed_categories === 'string' ? JSON.parse(m.allowed_categories) : m.allowed_categories;
      } catch {
        parsedCategories = [];
      }
      return {
        ...m,
        name: m.name || `Mandate #${m.id}`,
        allowed_categories: parsedCategories
      };
    });

    const primaryMandate = mandates.length > 0 ? mandates[0] : null;

    return NextResponse.json({
      success: true,
      mandate: primaryMandate,
      mandates
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, max_amount, allowed_categories, expires_at } = body;

    if (max_amount === undefined || !allowed_categories || !expires_at) {
      return NextResponse.json(
        { success: false, error: 'Missing max_amount, allowed_categories, or expires_at' },
        { status: 400 }
      );
    }

    const maxAmtNum = parseFloat(max_amount);
    if (isNaN(maxAmtNum) || maxAmtNum <= 0) {
      return NextResponse.json({ success: false, error: 'max_amount must be a positive number' }, { status: 400 });
    }

    if (maxAmtNum > 1000000) {
      return NextResponse.json(
        { success: false, error: 'Max spend amount cannot exceed ₹10,00,000 (1,000,000).' },
        { status: 400 }
      );
    }

    if (!Array.isArray(allowed_categories)) {
      return NextResponse.json({ success: false, error: 'allowed_categories must be an array of strings' }, { status: 400 });
    }

    const allowedCatsJson = JSON.stringify(allowed_categories);
    const mandateName = (name || '').trim() || `Spend Mandate (${allowed_categories.slice(0, 2).join(', ')})`;

    const info = await db.run(
      'INSERT INTO mandates (name, max_amount, allowed_categories, expires_at) VALUES (?, ?, ?, ?)',
      [mandateName, maxAmtNum, allowedCatsJson, expires_at]
    );

    const newMandate = {
      id: Number(info.lastInsertRowid),
      name: mandateName,
      max_amount: maxAmtNum,
      allowed_categories,
      expires_at
    };

    return NextResponse.json({
      success: true,
      mandate: newMandate
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Mandate ID is required' }, { status: 400 });
    }

    if (id === 'all') {
      await db.run('UPDATE agent_actions SET mandate_id = NULL');
      await db.run('DELETE FROM mandates');
      try {
        await db.run("DELETE FROM sqlite_sequence WHERE name='mandates'");
      } catch {}
      return NextResponse.json({ success: true, message: 'All mandates removed.' });
    }

    const mandateIdNum = parseInt(id, 10);
    if (isNaN(mandateIdNum)) {
      return NextResponse.json({ success: false, error: 'Invalid Mandate ID' }, { status: 400 });
    }

    // Unbind mandate_id in historical audit logs to prevent foreign key errors
    await db.run('UPDATE agent_actions SET mandate_id = NULL WHERE mandate_id = ?', [mandateIdNum]);

    const info = await db.run('DELETE FROM mandates WHERE id = ?', [mandateIdNum]);

    if (info.rowsAffected === 0) {
      return NextResponse.json({ success: false, error: 'Mandate not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: mandateIdNum });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


