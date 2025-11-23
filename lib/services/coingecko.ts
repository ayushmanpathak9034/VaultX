/**
 * CoinGecko API Service
 * Fetches trending tokens and market data
 */

export interface TrendingToken {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  small: string;
  large: string;
  market_cap_rank?: number;
  price_btc?: number;
  price_usd?: number;
  price_change_24h?: number;
}

export interface CoinGeckoCoin {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
}

const API_KEY = process.env.NEXT_PUBLIC_COINGECKO_API_KEY || '';
const BASE_URL = 'https://api.coingecko.com/api/v3';

/**
 * Get trending tokens from CoinGecko
 */
export async function getTrendingTokens(): Promise<TrendingToken[]> {
  try {
    const url = `${BASE_URL}/search/trending${API_KEY ? `?x_cg_demo_api_key=${API_KEY}` : ''}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the data to our format
    const trendingTokens: TrendingToken[] = data.coins.map((coin: any) => ({
      id: coin.item.id,
      name: coin.item.name,
      symbol: coin.item.symbol.toUpperCase(),
      thumb: coin.item.thumb,
      small: coin.item.small,
      large: coin.item.large,
      market_cap_rank: coin.item.market_cap_rank,
      price_btc: coin.item.price_btc,
    }));

    // Fetch current prices for trending tokens
    if (trendingTokens.length > 0) {
      const ids = trendingTokens.map(t => t.id).join(',');
      const priceUrl = `${BASE_URL}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true${API_KEY ? `&x_cg_demo_api_key=${API_KEY}` : ''}`;
      
      try {
        const priceResponse = await fetch(priceUrl, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          
          // Update tokens with price data
          trendingTokens.forEach(token => {
            const priceInfo = priceData[token.id];
            if (priceInfo) {
              token.price_usd = priceInfo.usd;
              token.price_change_24h = priceInfo.usd_24h_change;
            }
          });
        }
      } catch (priceError) {
        console.warn('Failed to fetch price data:', priceError);
        // Continue without price data
      }
    }

    return trendingTokens;
  } catch (error: any) {
    console.error('Error fetching trending tokens:', error);
    throw new Error(`Failed to fetch trending tokens: ${error.message}`);
  }
}

/**
 * Get top market cap coins
 */
export async function getTopCoins(limit: number = 20): Promise<CoinGeckoCoin[]> {
  try {
    const url = `${BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false${API_KEY ? `&x_cg_demo_api_key=${API_KEY}` : ''}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.map((coin: any) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      image: coin.image,
      current_price: coin.current_price,
      market_cap_rank: coin.market_cap_rank,
      price_change_percentage_24h: coin.price_change_percentage_24h,
      market_cap: coin.market_cap,
      total_volume: coin.total_volume,
    }));
  } catch (error: any) {
    console.error('Error fetching top coins:', error);
    throw new Error(`Failed to fetch top coins: ${error.message}`);
  }
}

