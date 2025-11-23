import { ethers } from 'ethers';
import { Network } from './networks';
import { rpcRateLimiter, retryWithBackoff } from '../utils/rateLimiter';

/**
 * Get provider for a specific network
 */
export function getProvider(network: Network): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(network.rpcUrl);
}

/**
 * Get wallet instance with provider
 */
export function getWallet(privateKey: string, network: Network): ethers.Wallet {
  const provider = getProvider(network);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Get balance for an address
 */
export async function getBalance(address: string, network: Network): Promise<string> {
  try {
    const provider = getProvider(network);
    
    // Use rate limiter and retry logic
    const balance = await rpcRateLimiter.execute(() =>
      retryWithBackoff(() => provider.getBalance(address), 3, 1000)
    );
    
    const formatted = ethers.formatEther(balance);
    // Ensure we return a valid number string, default to "0" if invalid
    const numBalance = parseFloat(formatted);
    return isNaN(numBalance) ? '0' : formatted;
  } catch (error: any) {
    console.error(`Error fetching balance for ${network.name}:`, error);
    
    // Handle rate limit errors
    const isRateLimit = 
      error.code === -32029 ||
      error.message?.includes('Rate limited') ||
      error.message?.includes('rate limit') ||
      error.message?.includes('too many requests');
    
    if (isRateLimit) {
      console.warn('Rate limited by RPC endpoint, returning cached balance');
      // Return "0" on rate limit to prevent UI crashes
      return '0';
    }
    
    // Handle JSON parsing errors from RPC endpoints
    if (error.code === 'UNSUPPORTED_OPERATION' || 
        error.message?.includes('bodyJson') || 
        error.message?.includes('invalid json') ||
        error.message?.includes('JSON')) {
      // Return "0" instead of throwing to prevent UI crashes
      return '0';
    }
    // Return "0" on any error to prevent NaN display
    return '0';
  }
}

/**
 * Get token balance (ERC-20)
 * Note: For native tokens, use getBalance() instead
 */
export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string,
  network: Network
): Promise<string> {
  try {
    const provider = getProvider(network);
    
    // ERC-20 ABI for balanceOf
    const erc20Abi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function name() view returns (string)',
    ];
    
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    
    // Use rate limiter and retry logic
    const [balance, decimals] = await rpcRateLimiter.execute(() =>
      retryWithBackoff(async () => {
        const [bal, dec] = await Promise.all([
          tokenContract.balanceOf(walletAddress),
          tokenContract.decimals()
        ]);
        return [bal, dec];
      }, 3, 1000)
    );
    
    return ethers.formatUnits(balance, decimals);
  } catch (error: any) {
    console.error(`Error fetching token balance for ${tokenAddress}:`, error);
    
    // Handle rate limit errors
    const isRateLimit = 
      error.code === -32029 ||
      error.message?.includes('Rate limited') ||
      error.message?.includes('rate limit') ||
      error.message?.includes('too many requests');
    
    if (isRateLimit) {
      console.warn('Rate limited by RPC endpoint, returning 0 balance');
    }
    
    // Return "0" on error to prevent UI crashes
    return '0';
  }
}

/**
 * Send native token transaction
 */
export async function sendTransaction(
  privateKey: string,
  to: string,
  amount: string,
  network: Network,
  gasLimit?: bigint
): Promise<ethers.TransactionResponse> {
  try {
    const wallet = getWallet(privateKey, network);
    const tx = await wallet.sendTransaction({
      to,
      value: ethers.parseEther(amount),
      gasLimit: gasLimit || BigInt(21000),
    });
    return tx;
  } catch (error: any) {
    console.error(`Error sending transaction on ${network.name}:`, error);
    if (error.code === 'UNSUPPORTED_OPERATION' || 
        error.message?.includes('bodyJson') || 
        error.message?.includes('invalid json') ||
        error.message?.includes('JSON')) {
      throw new Error(`Unable to connect to ${network.name}. The RPC endpoint may be unavailable.`);
    }
    throw error;
  }
}

/**
 * Send ERC-20 token transaction
 */
export async function sendTokenTransaction(
  privateKey: string,
  tokenAddress: string,
  to: string,
  amount: string,
  network: Network
): Promise<ethers.TransactionResponse> {
  const wallet = getWallet(privateKey, network);
  
  const erc20Abi = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
  ];
  
  const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
  const decimals = await tokenContract.decimals();
  const amountWei = ethers.parseUnits(amount, decimals);
  
  const tx = await tokenContract.transfer(to, amountWei);
  return tx;
}

/**
 * Get transaction history using block explorer APIs
 * Falls back to RPC block scanning if explorer API is not available
 */
export async function getTransactionHistory(
  address: string,
  network: Network,
  limit: number = 20
): Promise<any[]> {
  // First, try to use block explorer API (much faster and more reliable)
  const { fetchTransactionsFromExplorer } = await import('./explorer');
  const explorerTxs = await fetchTransactionsFromExplorer(address, network, limit);
  
  if (explorerTxs.length > 0) {
    return explorerTxs;
  }
  
  // Fallback: Try RPC block scanning (slower, less reliable)
  try {
    const provider = getProvider(network);
    const currentBlock = await provider.getBlockNumber();
    const transactions: any[] = [];
    
    // Check last 1000 blocks for transactions (increased from 100)
    for (let i = 0; i < Math.min(1000, limit * 50); i++) {
      try {
        const block = await provider.getBlock(currentBlock - i, true);
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            if (typeof tx === 'object' && tx !== null && 'from' in tx) {
              const txObj = tx as { hash: string; from: string; to: string | null; value: bigint };
              if (txObj.from?.toLowerCase() === address.toLowerCase() || 
                  txObj.to?.toLowerCase() === address.toLowerCase()) {
                transactions.push({
                  hash: txObj.hash,
                  from: txObj.from,
                  to: txObj.to,
                  value: ethers.formatEther(txObj.value || BigInt(0)),
                  timestamp: Number(block.timestamp),
                  blockNumber: Number(block.number),
                  status: 'confirmed',
                });
                
                if (transactions.length >= limit) break;
              }
            }
          }
        }
        if (transactions.length >= limit) break;
      } catch (e) {
        // Skip blocks that can't be fetched
        continue;
      }
    }
    
    return transactions;
  } catch (error: any) {
    console.error('Error fetching transaction history (RPC fallback):', error);
    // Return empty array on RPC errors to prevent UI crashes
    if (error.code === 'UNSUPPORTED_OPERATION' || 
        error.message?.includes('bodyJson') || 
        error.message?.includes('invalid json') ||
        error.message?.includes('JSON')) {
      return [];
    }
    return [];
  }
}

/**
 * Get transaction history using the inbuilt indexer
 * This provides fast, cached lookups with automatic syncing
 * Returns ALL transactions for the address on the network
 */
export async function getTransactionHistoryWithIndexer(
  address: string,
  network: Network,
  limit?: number
): Promise<any[]> {
  try {
    const { getIndexer } = await import('./indexer');
    const indexer = getIndexer();
    
    // Initialize indexer if needed
    try {
      await indexer.init();
    } catch (error) {
      console.warn('Indexer init failed, using fallback:', error);
      return await getTransactionHistoryImproved(address, network, limit || 10000);
    }
    
    // Sync and get ALL transactions (no limit by default)
    const transactions = await indexer.syncTransactions(address, network, limit);
    
    // Convert to expected format
    return transactions.map((tx) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      timestamp: tx.timestamp,
      blockNumber: tx.blockNumber,
      status: tx.status,
    }));
  } catch (error) {
    console.error('Indexer error, using fallback:', error);
    return await getTransactionHistoryImproved(address, network, limit || 10000);
  }
}

/**
 * Get transaction history - improved version with better error handling
 */
export async function getTransactionHistoryImproved(
  address: string,
  network: Network,
  limit: number = 20
): Promise<any[]> {
  console.log(`Fetching transactions for ${address} on ${network.name}...`);
  
  // Try explorer API first
  try {
    const { fetchTransactionsFromExplorer } = await import('./explorer');
    const explorerTxs = await fetchTransactionsFromExplorer(address, network, limit);
    
    if (explorerTxs && explorerTxs.length > 0) {
      console.log(`Found ${explorerTxs.length} transactions from explorer API`);
      return explorerTxs;
    }
    console.log('Explorer API returned no transactions, trying RPC...');
  } catch (error) {
    console.warn('Explorer API failed, trying RPC fallback:', error);
  }
  
  // RPC fallback - improved version
  try {
    const provider = getProvider(network);
    
    // Use rate limiter for RPC calls
    const currentBlock = await rpcRateLimiter.execute(() =>
      retryWithBackoff(() => provider.getBlockNumber(), 3, 1000)
    );
    console.log(`Current block: ${currentBlock}, scanning for transactions...`);
    
    const transactions: any[] = [];
    const addressLower = address.toLowerCase();
    
    // Scan more blocks but with better error handling
    const maxBlocksToScan = Math.min(5000, limit * 100);
    
    for (let i = 0; i < maxBlocksToScan && transactions.length < limit; i++) {
      try {
        const blockNumber = currentBlock - i;
        if (blockNumber < 0) break;
        
        // Add delay between block fetches to avoid rate limiting
        if (i > 0 && i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const block = await rpcRateLimiter.execute(() =>
          retryWithBackoff(() => provider.getBlock(blockNumber, true), 3, 1000)
        );
        
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            if (typeof tx === 'object' && tx !== null && 'from' in tx) {
              const txObj = tx as { hash: string; from: string; to: string | null; value: bigint };
              
              if (txObj.from?.toLowerCase() === addressLower || 
                  txObj.to?.toLowerCase() === addressLower) {
                transactions.push({
                  hash: txObj.hash,
                  from: txObj.from,
                  to: txObj.to,
                  value: ethers.formatEther(txObj.value || BigInt(0)),
                  timestamp: Number(block.timestamp),
                  blockNumber: Number(block.number),
                  status: 'confirmed',
                });
                
                if (transactions.length >= limit) break;
              }
            }
          }
        }
      } catch (blockError) {
        // Skip individual block errors
        if (i % 100 === 0) {
          console.log(`Scanned ${i} blocks, found ${transactions.length} transactions...`);
        }
        continue;
      }
    }
    
    console.log(`RPC scan complete: Found ${transactions.length} transactions`);
    return transactions;
  } catch (error: any) {
    console.error('RPC fallback error:', error);
    return [];
  }
}

/**
 * Estimate gas for transaction
 */
export async function estimateGas(
  from: string,
  to: string,
  value: string,
  network: Network
): Promise<bigint> {
  try {
    const provider = getProvider(network);
    return await provider.estimateGas({
      from,
      to,
      value: ethers.parseEther(value),
    });
  } catch (error: any) {
    console.error(`Error estimating gas for ${network.name}:`, error);
    if (error.code === 'UNSUPPORTED_OPERATION' || 
        error.message?.includes('bodyJson') || 
        error.message?.includes('invalid json') ||
        error.message?.includes('JSON')) {
      throw new Error(`Unable to connect to ${network.name}. The RPC endpoint may be unavailable.`);
    }
    // Return default gas limit if estimation fails
    return BigInt(21000);
  }
}

