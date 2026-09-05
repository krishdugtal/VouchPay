import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const products = await db.all('SELECT * FROM products ORDER BY id DESC');
    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, limit_price, price, category } = body;

    const rawLimit = limit_price !== undefined ? limit_price : price;

    if (!name || rawLimit === undefined || !category) {
      return NextResponse.json({ success: false, error: 'Missing product name, limit_price, or category' }, { status: 400 });
    }

    const limitPriceNum = parseFloat(rawLimit);
    if (isNaN(limitPriceNum) || limitPriceNum <= 0) {
      return NextResponse.json({ success: false, error: 'limit_price must be a positive number' }, { status: 400 });
    }

    const info = await db.run('INSERT INTO products (name, limit_price, price, category) VALUES (?, ?, ?, ?)', [name, limitPriceNum, limitPriceNum, category]);

    return NextResponse.json({
      success: true,
      product: {
        id: Number(info.lastInsertRowid),
        name,
        limit_price: limitPriceNum,
        category
      }
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
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const prodIdNum = parseInt(id, 10);
    if (isNaN(prodIdNum)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const info = await db.run('DELETE FROM products WHERE id = ?', [prodIdNum]);

    if (info.rowsAffected === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: prodIdNum });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

