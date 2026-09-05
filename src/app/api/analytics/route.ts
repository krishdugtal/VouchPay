import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const rawActions: any[] = await db.all('SELECT * FROM agent_actions ORDER BY timestamp ASC');
    const rawProducts: any[] = await db.all('SELECT * FROM products');
    const rawMandates: any[] = await db.all('SELECT * FROM mandates');

    // Map mandates by ID
    const mandatesMap: { [id: number]: any } = {};
    rawMandates.forEach((m) => {
      let cats: string[] = [];
      try {
        cats = JSON.parse(m.allowed_categories);
      } catch {
        cats = [];
      }
      mandatesMap[m.id] = { ...m, allowed_categories: cats };
    });

    // 1. Filter ONLY actual successful payments (status === 'success' and action_type is an approved payment/retry)
    const rawSuccessful = rawActions.filter(
      (a) => a.status === 'success' && a.action_type !== 'purchase_attempt'
    );

    // Deduplicate by transaction_group_id or razorpay_order_id to guarantee single count per order
    const uniqueSuccessMap = new Map<string, any>();
    rawSuccessful.forEach((a) => {
      const key = a.transaction_group_id || a.razorpay_order_id || `id_${a.id}`;
      if (!uniqueSuccessMap.has(key)) {
        uniqueSuccessMap.set(key, a);
      }
    });
    const successfulActions = Array.from(uniqueSuccessMap.values());

    // 2. Filter declined transactions (status === 'declined' OR action_type === 'purchase_declined')
    const rawDeclined = rawActions.filter(
      (a) => a.status === 'declined' || a.action_type === 'purchase_declined'
    );
    const uniqueDeclinedMap = new Map<string, any>();
    rawDeclined.forEach((a) => {
      const key = a.transaction_group_id || a.razorpay_order_id || `id_${a.id}`;
      if (!uniqueDeclinedMap.has(key)) {
        uniqueDeclinedMap.set(key, a);
      }
    });
    const declinedActions = Array.from(uniqueDeclinedMap.values());

    // Total Amount Spent: sum of amount for approved successful payments ONLY
    const totalSpent = successfulActions.reduce((sum, a) => sum + (a.amount || 0), 0);
    const successfulCount = successfulActions.length;
    const declinedCount = declinedActions.length;

    // Total unique decisions evaluated
    const uniqueAttempts = new Set(rawActions.map((a) => a.transaction_group_id || a.razorpay_order_id || `id_${a.id}`));
    const totalDecisions = Math.max(successfulCount + declinedCount, uniqueAttempts.size);
    const approvalRate = (successfulCount + declinedCount) > 0 
      ? Math.round((successfulCount / (successfulCount + declinedCount)) * 100) 
      : 0;

    // Average Transaction Size: totalSpent / successfulCount
    const avgTransactionSize = successfulCount > 0 ? Math.round(totalSpent / successfulCount) : 0;


    // 3. Category Breakdown (for successful payments)
    const categoryMap: { [cat: string]: number } = {};

    successfulActions.forEach((action) => {
      let matchedCategory: string | null = null;

      // Combine action's reasoning with any related action reasoning (for webhook records)
      let combinedReasoning = (action.reasoning || '').toLowerCase();
      
      // Match by exact order ID or matching amount/timestamp to inherit product context
      const relatedAction = rawActions.find(
        (ra) => ra.id !== action.id && ra.reasoning && (
          (action.razorpay_order_id && ra.razorpay_order_id === action.razorpay_order_id) ||
          (ra.amount > 0 && Math.abs(ra.amount - action.amount) < 1)
        )
      );

      if (relatedAction && relatedAction.reasoning) {
        combinedReasoning += ' ' + relatedAction.reasoning.toLowerCase();
      }

      // Priority 1: Match registered product name in combined reasoning
      const matchedProduct = rawProducts.find((p) =>
        combinedReasoning.includes(p.name.toLowerCase())
      );
      if (matchedProduct && matchedProduct.category) {
        matchedCategory = matchedProduct.category;
      }

      // Priority 2: Check mandate categories if mandate_id present or in related action
      const actionMandateId = action.mandate_id || (relatedAction ? relatedAction.mandate_id : null);
      if (!matchedCategory && actionMandateId && mandatesMap[actionMandateId]) {
        const mCats = mandatesMap[actionMandateId].allowed_categories;
        if (mCats && mCats.length === 1) {
          matchedCategory = mCats[0];
        }
      }

      // Priority 3: Check known category names in combined reasoning
      if (!matchedCategory) {
        const knownCategories = [
          'Fitness', 'Food', 'Electronics', 'Clothing', 'Books', 'Software',
          'Beauty & Personal Care', 'Home & Kitchen', 'Toys & Games', 'Sports & Outdoors',
          'Automotive', 'Stationery & Office', 'Health & Wellness', 'Travel & Luggage'
        ];
        for (const cat of knownCategories) {
          if (combinedReasoning.includes(cat.toLowerCase())) {
            matchedCategory = cat;
            break;
          }
        }
      }

      // Priority 4: Fallback to first mandate category if mandate exists
      if (!matchedCategory && actionMandateId && mandatesMap[actionMandateId]) {
        const mCats = mandatesMap[actionMandateId].allowed_categories;
        if (mCats && mCats.length > 0) {
          matchedCategory = mCats[0];
        }
      }

      const finalCat = matchedCategory || 'General';
      categoryMap[finalCat] = (categoryMap[finalCat] || 0) + (action.amount || 0);
    });

    const categoryBreakdown = Object.keys(categoryMap).map((cat) => ({
      category: cat,
      amount: categoryMap[cat],
      percentage: totalSpent > 0 ? Math.round((categoryMap[cat] / totalSpent) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    // 4. Timeline (daily aggregated spend for successful payments)
    const timelineMap: { [dateStr: string]: { amount: number; count: number } } = {};

    successfulActions.forEach((action) => {
      const dateStr = action.timestamp ? action.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10);
      if (!timelineMap[dateStr]) {
        timelineMap[dateStr] = { amount: 0, count: 0 };
      }
      timelineMap[dateStr].amount += action.amount || 0;
      timelineMap[dateStr].count += 1;
    });

    const timeline = Object.keys(timelineMap).map((date) => ({
      date,
      amount: timelineMap[date].amount,
      count: timelineMap[date].count
    })).sort((a, b) => a.date.localeCompare(b.date));

    // 5. Last 7 Days Activity (for hero line chart)
    const activity7Days: { date: string; label: string; count: number; amount: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const labelStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const dayActions = rawActions.filter((a) => a.timestamp && a.timestamp.startsWith(dateStr));
      const dayCount = dayActions.length;
      const dayAmount = dayActions
        .filter((a) => a.status === 'success')
        .reduce((sum, a) => sum + (a.amount || 0), 0);

      activity7Days.push({
        date: dateStr,
        label: labelStr,
        count: dayCount,
        amount: dayAmount
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalSpent,
        successfulCount,
        declinedCount,
        totalDecisions,
        approvalRate,
        avgTransactionSize,
        categoryBreakdown,
        timeline,
        activity7Days,
        recentActions: rawActions.slice(-10).reverse(),
        systemStatus: 'online'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
