import { NextResponse } from 'next/server';

// In-memory session cache to preserve SerpAPI free-tier credits (100 searches/month)
const queryCache = new Map<string, { timestamp: number; results: any[] }>();

export async function POST(request: Request) {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'SERPAPI_KEY is not configured in .env.local',
        results: []
      });
    }

    const body = await request.json();
    const { query } = body;
    const cleanQuery = (query || '').trim();

    if (!cleanQuery) {
      return NextResponse.json({
        success: false,
        error: 'Query parameter is required',
        results: []
      });
    }

    const cacheKey = cleanQuery.toLowerCase();

    // Check in-memory cache
    if (queryCache.has(cacheKey)) {
      const cached = queryCache.get(cacheKey)!;
      // Cache valid for 1 hour
      if (Date.now() - cached.timestamp < 3600 * 1000) {
        return NextResponse.json({
          success: true,
          cached: true,
          results: cached.results
        });
      }
    }

    // Call SerpAPI Google Shopping with 12-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const serpUrl = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(cleanQuery)}&gl=in&hl=en&location=India&api_key=${apiKey}`;

    let response: Response;
    try {
      response = await fetch(serpUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isAbort = fetchErr.name === 'AbortError';
      return NextResponse.json({
        success: false,
        error: isAbort ? 'Live market search request timed out' : 'Live pricing unavailable right now',
        results: []
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Live pricing unavailable right now',
        results: []
      });
    }

    const data = await response.json();
    const shoppingResults: any[] = data.shopping_results || [];

    if (!Array.isArray(shoppingResults) || shoppingResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No live market results found',
        results: []
      });
    }

    // Parse top 12 items for multi-seller website options
    const parsedResults = shoppingResults.slice(0, 12).map((item) => {
      const title = item.title || 'Product Item';
      const priceStr = item.price || (item.extracted_price ? `₹${item.extracted_price.toLocaleString('en-IN')}` : 'Price N/A');
      const source = item.source || item.merchant_name || 'Merchant';
      const link = item.product_link || item.link || '#';
      const thumbnail = item.thumbnail || item.image || null;

      // Extract numeric price for limit_price filtering
      let numericPrice = 0;
      if (typeof item.extracted_price === 'number') {
        numericPrice = item.extracted_price;
      } else if (typeof priceStr === 'string') {
        const cleanedStr = priceStr.replace(/[^0-9.]/g, '');
        numericPrice = parseFloat(cleanedStr) || 0;
      }

      return {
        title,
        price: priceStr,
        numeric_price: numericPrice,
        source,
        link,
        thumbnail
      };
    });

    // Save to cache
    queryCache.set(cacheKey, {
      timestamp: Date.now(),
      results: parsedResults
    });

    return NextResponse.json({
      success: true,
      cached: false,
      results: parsedResults
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Live pricing unavailable right now',
      results: []
    });
  }
}
