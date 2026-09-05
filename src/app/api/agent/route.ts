import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import db from '@/lib/db';

export async function POST(request: Request) {
  let mandateIdNum: number | null = null;
  let userMessage = '';

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const errMsg = 'GEMINI_API_KEY is missing in environment variables (.env.local).';
      return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
    }

    const body = await request.json();
    const { message, mandate_id } = body;

    userMessage = message || '';
    mandateIdNum = mandate_id ? parseInt(mandate_id) : null;

    if (!userMessage) {
      return NextResponse.json({ success: false, error: 'User message is required.' }, { status: 400 });
    }

    // 1. Fetch ALL active mandates from DB
    const rawMandates: any[] = await db.all('SELECT * FROM mandates ORDER BY id DESC');
    const parsedMandates = rawMandates.map((m) => {
      let allowedCats: string[] = [];
      try {
        allowedCats = typeof m.allowed_categories === 'string' ? JSON.parse(m.allowed_categories) : m.allowed_categories;
      } catch {
        allowedCats = [];
      }
      return {
        ...m,
        name: m.name || `Spend Mandate #${m.id}`,
        allowed_categories: allowedCats,
        is_expired: new Date(m.expires_at) < new Date()
      };
    });

    const activeMandates = parsedMandates.filter((m) => !m.is_expired);

    if (activeMandates.length === 0) {
      const dbErrReason = 'No active (non-expired) spend mandate found. Transacting blocked.';
      await db.run(
        `INSERT INTO agent_actions (mandate_id, mandate_name, action_type, reasoning, amount, status)
         VALUES (null, null, 'purchase_declined', ?, 0, 'declined')`,
        [dbErrReason]
      );

      return NextResponse.json({
        success: true,
        decision: {
          action: 'decline',
          product_id: null,
          amount: 0,
          reasoning: dbErrReason
        }
      });
    }

    // 2. Resolve targeted mandate (evaluated strictly against user's choice)
    const targetMandate = (mandateIdNum ? activeMandates.find((m) => m.id === mandateIdNum) : null) || activeMandates[0];

    // 3. Fetch product catalog from DB
    const products: any[] = await db.all('SELECT * FROM products ORDER BY id ASC');

    // 4. Initialize Gemini SDK with JSON response schema
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            action: {
              type: SchemaType.STRING,
              description: "Must be 'purchase' if a valid catalog item fits constraints, or 'decline' if not.",
            },
            product_id: {
              type: SchemaType.INTEGER,
              description: 'Numeric product ID from catalog if action is purchase, otherwise null.',
              nullable: true,
            },
            amount: {
              type: SchemaType.NUMBER,
              description: 'Exact price of selected product, or 0 if declining.',
            },
            reasoning: {
              type: SchemaType.STRING,
              description: 'Clear, concise reasoning for approving or declining the purchase.',
            },
            matching_product_ids: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.INTEGER },
              description: 'List of product IDs from the catalog that match the user request or category.',
            },
          },
          required: ['action', 'amount', 'reasoning'],
        },
      },
      systemInstruction: `You are the decision engine for VouchPay. 
Your goal is to evaluate the user's natural language request against available product catalog boundaries and the selected spending mandate.

RULES:
1. Identify all products in the catalog that match the user's intent or category request. Include their numeric IDs in matching_product_ids.
2. Select the SINGLE BEST matching product in product_id.
3. Evaluate STRICTLY against the selected target mandate "${targetMandate.name}" (Limit: ₹${targetMandate.max_amount}, Allowed categories: ${targetMandate.allowed_categories.join(', ')}):
   - Check if product category is permitted in allowed_categories. If NOT allowed: set action='decline', product_id=null, amount=0, reasoning detailing that category '${targetMandate.allowed_categories.join(', ')}' is not allowed under selected mandate '${targetMandate.name}'.
   - Check if product limit_price <= max_amount. If price exceeds limit: set action='decline', product_id=null, amount=0, reasoning detailing that product price exceeds selected mandate '${targetMandate.name}' spend limit.
4. If ALL checks pass: return action='purchase', product_id=(best product id), amount=(product limit_price), reasoning detailing approval under selected mandate "${targetMandate.name}", and matching_product_ids.
5. Strictly return JSON adhering to the schema.`
    });

    const promptContext = JSON.stringify({
      user_request: userMessage,
      selected_target_mandate: {
        id: targetMandate.id,
        name: targetMandate.name,
        max_amount: targetMandate.max_amount,
        allowed_categories: targetMandate.allowed_categories,
        expires_at: targetMandate.expires_at
      },
      product_catalog: products.map((p) => ({
        id: p.id,
        name: p.name,
        limit_price: p.limit_price || p.price,
        category: p.category,
      })),
    });

    // 5. Generate Content from Gemini with fallback
    let responseText = '';
    try {
      const result = await model.generateContent(promptContext);
      responseText = result.response.text();
    } catch (apiErr: any) {
      console.warn('[Gemini API Error - Falling back to local rule engine]:', apiErr.message || apiErr);
      
      // Fallback rule engine for targeted mandate evaluation
      const normalizedMsg = userMessage.toLowerCase();
      const matchingProducts = products.filter((p) => {
        const pName = (p.name || '').toLowerCase();
        const pCat = (p.category || '').toLowerCase();
        const words = pName.split(/\s+/).filter((w: string) => w.length > 2);
        return words.some((w: string) => normalizedMsg.includes(w)) || normalizedMsg.includes(pCat);
      });

      if (matchingProducts.length === 0) {
        return NextResponse.json({
          success: true,
          decision: {
            action: 'decline',
            product_id: null,
            amount: 0,
            reasoning: `No matching catalog product found for "${userMessage}".`
          },
          matching_products: [],
          mandate: targetMandate,
          mandates: activeMandates
        });
      }

      const primary = matchingProducts[0];
      const pLimitPrice = primary.limit_price || primary.price || 0;

      const isCategoryAllowed = targetMandate.allowed_categories.includes(primary.category);
      const isWithinLimit = pLimitPrice <= targetMandate.max_amount;

      let fallbackAction: 'purchase' | 'decline' = 'purchase';
      let fallbackReasoning = '';

      if (isCategoryAllowed && isWithinLimit) {
        fallbackAction = 'purchase';
        fallbackReasoning = `Matched selected mandate "${targetMandate.name}" (Limit: ₹${targetMandate.max_amount.toLocaleString('en-IN')}) for "${primary.name}" (${primary.category}).`;
      } else if (!isCategoryAllowed) {
        fallbackAction = 'decline';
        fallbackReasoning = `Transaction blocked: Product category "${primary.category}" is not allowed under selected mandate "${targetMandate.name}" (Allowed: ${targetMandate.allowed_categories.join(', ')}).`;
      } else {
        fallbackAction = 'decline';
        fallbackReasoning = `Transaction blocked: Selected listing price ₹${pLimitPrice.toLocaleString('en-IN')} exceeds selected mandate "${targetMandate.name}" spend limit (₹${targetMandate.max_amount.toLocaleString('en-IN')}).`;
      }

      const fallbackDecision = {
        action: fallbackAction,
        product_id: fallbackAction === 'purchase' ? primary.id : null,
        amount: fallbackAction === 'purchase' ? pLimitPrice : 0,
        reasoning: fallbackReasoning,
        matching_product_ids: matchingProducts.map((p) => p.id)
      };

      return NextResponse.json({
        success: true,
        decision: fallbackDecision,
        matching_products: matchingProducts,
        mandate: targetMandate,
        mandates: activeMandates
      });
    }

    let decision: {
      action: 'purchase' | 'decline';
      product_id: number | null;
      amount: number;
      reasoning: string;
      matching_product_ids?: number[];
    };

    try {
      decision = JSON.parse(responseText);
    } catch (parseErr: any) {
      console.error('[Gemini Agent] Failed to parse model output JSON:', responseText);
      const parseFailReason = 'Gemini Agent System Error: Model returned malformed output.';
      
      await db.run(
        `INSERT INTO agent_actions (mandate_id, action_type, reasoning, amount, status) VALUES (?, 'system_error', ?, 0, 'failed')`,
        [mandateIdNum, parseFailReason]
      );

      return NextResponse.json({
        success: false,
        error: parseFailReason
      }, { status: 500 });
    }

    // Resolve full product objects for matching options
    let matchingProducts: any[] = [];
    if (Array.isArray(decision.matching_product_ids) && decision.matching_product_ids.length > 0) {
      matchingProducts = products.filter((p) => decision.matching_product_ids?.includes(p.id));
    } else if (decision.product_id) {
      matchingProducts = products.filter((p) => p.id === decision.product_id);
    }

    // Return agent decision & product options
    return NextResponse.json({
      success: true,
      decision,
      matching_products: matchingProducts,
      mandate: targetMandate,
      mandates: activeMandates
    });

  } catch (error: any) {
    console.error('[Gemini Agent] System API Error:', error);
    
    // Log system error gracefully to DB
    if (mandateIdNum) {
      await db.run(
        `INSERT INTO agent_actions (mandate_id, action_type, reasoning, amount, status) VALUES (?, 'system_error', ?, 0, 'failed')`,
        [mandateIdNum, `Gemini API System Error: ${error.message || error}`]
      );
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Gemini reasoning system error'
    }, { status: 500 });
  }
}

