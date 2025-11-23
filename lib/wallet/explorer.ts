import { Network } from './networks';

/**
 * Get block explorer API URL for a network
 */
export function getExplorerApiUrl(network: Network): string | null {
  const explorerApis: Record<string, string> = {
    'ethereum': 'https://api.etherscan.io/api',
    'sepolia': 'https://api-sepolia.etherscan.io/api',
    'bsc': 'https://api.bscscan.com/api',
    'polygon': 'https://api.polygonscan.com/api',
    'avalanche': 'https://api.snowtrace.io/api',
    'arbitrum': 'https://api.arbiscan.io/api',
  };

  return explorerApis[network.id] || null;
}

/**
 * Get API key for block explorer (optional, works without API key for basic queries)
 * You can add your API keys here if you want higher rate limits
 */
function getApiKey(network: Network): string {
  // For now, we'll use public APIs without keys
  // To add API keys, you can:
  // 1. Get free API keys from block explorers
  // 2. Store them in environment variables
  // 3. Return them here
  return '';
}

/**
 * Fetch transactions from block explorer API
 */
export async function fetchTransactionsFromExplorer(
  address: string,
  network: Network,
  limit: number = 20
): Promise<any[]> {
  const apiUrl = getExplorerApiUrl(network);
  
  if (!apiUrl) {
    // No API available for this network
    return [];
  }

  try {
    const apiKey = getApiKey(network);
    const apiKeyParam = apiKey ? `&apikey=${apiKey}` : '';
    
    // Fetch ALL transactions (use high offset for complete history)
    // Most explorer APIs support up to 10000 transactions per request
    const maxOffset = Math.min(limit || 10000, 10000);
    const normalTxUrl = `${apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${maxOffset}&sort=desc${apiKeyParam}`;
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(normalTxUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle different response formats
    if (data.status === '0') {
      // "No transactions found" is a valid response
      if (data.message === 'No transactions found' || 
          data.message === 'No transactions found.' ||
          data.message?.toLowerCase().includes('no transactions')) {
        return [];
      }
      
      // Rate limiting or API key issues
      if (data.message?.toLowerCase().includes('rate limit') ||
          data.message?.toLowerCase().includes('max rate limit') ||
          data.message === 'NOTOK' ||
          data.message?.toLowerCase().includes('invalid api key')) {
        console.warn(`Explorer API ${network.name}: ${data.message || 'Rate limited or requires API key'}`);
        // Return empty array instead of error - will fallback to RPC scanning
        return [];
      }
      
      // Other errors
      console.warn(`Explorer API ${network.name} error:`, data.message || 'Unknown error');
      return [];
    }
    
    if (data.status !== '1' || !data.result) {
      console.warn(`Explorer API ${network.name}: Invalid response format`);
      return [];
    }
    
    // Format transactions
    const transactions = data.result.map((tx: any) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: (parseInt(tx.value) / 1e18).toFixed(6), // Convert from Wei to ETH
      timestamp: parseInt(tx.timeStamp),
      blockNumber: parseInt(tx.blockNumber),
      status: tx.txreceipt_status === '1' ? 'confirmed' : 'failed',
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
    }));
    
    return transactions.slice(0, limit);
  } catch (error: any) {
    // Silently fail and let RPC fallback handle it
    console.warn(`Explorer API ${network.name} fetch error:`, error.message || error);
    return [];
  }
}

