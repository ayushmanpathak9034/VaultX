import { Network } from './networks';
import { getProvider } from './provider';
import { getIndexer, IndexedTransaction } from './indexer';
import { ethers } from 'ethers';

/**
 * Background Transaction Tracker
 * Continuously monitors blockchain for new transactions involving tracked addresses
 */
export class TransactionTracker {
  private trackedAddresses: Map<string, Set<number>> = new Map(); // address -> Set of chainIds
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map(); // address_chainId -> interval
  private isTracking: boolean = false;
  private pollInterval: number = 30000; // 30 seconds

  /**
   * Start tracking transactions for an address on a network
   */
  async startTracking(address: string, network: Network): Promise<void> {
    const key = `${address.toLowerCase()}_${network.chainId}`;
    
    // Add to tracked addresses
    if (!this.trackedAddresses.has(address.toLowerCase())) {
      this.trackedAddresses.set(address.toLowerCase(), new Set());
    }
    this.trackedAddresses.get(address.toLowerCase())!.add(network.chainId);

    // If already tracking, don't start another interval
    if (this.pollingIntervals.has(key)) {
      return;
    }

    console.log(`Starting transaction tracking for ${address} on ${network.name}`);

    // Initial sync
    await this.syncTransactions(address, network);

    // Set up polling interval
    const interval = setInterval(async () => {
      await this.syncTransactions(address, network);
    }, this.pollInterval);

    this.pollingIntervals.set(key, interval);
    this.isTracking = true;
  }

  /**
   * Stop tracking transactions for an address on a network
   */
  stopTracking(address: string, network: Network): void {
    const key = `${address.toLowerCase()}_${network.chainId}`;
    const interval = this.pollingIntervals.get(key);
    
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(key);
      console.log(`Stopped tracking transactions for ${address} on ${network.name}`);
    }

    // Remove from tracked addresses
    const chainIds = this.trackedAddresses.get(address.toLowerCase());
    if (chainIds) {
      chainIds.delete(network.chainId);
      if (chainIds.size === 0) {
        this.trackedAddresses.delete(address.toLowerCase());
      }
    }
  }

  /**
   * Sync transactions for an address (check for new ones on-chain)
   */
  private async syncTransactions(address: string, network: Network): Promise<void> {
    try {
      const indexer = getIndexer();
      await indexer.init();

      // Get latest indexed block
      const latestBlock = await indexer.getLatestBlock(address, network.chainId);
      const provider = getProvider(network);
      
      // Import rate limiter
      const { rpcRateLimiter, retryWithBackoff } = await import('../utils/rateLimiter');
      
      const currentBlock = await rpcRateLimiter.execute(() =>
        retryWithBackoff(() => provider.getBlockNumber(), 3, 1000)
      );

      // Only scan if there are new blocks
      if (currentBlock <= latestBlock) {
        return;
      }

      console.log(`Syncing transactions: ${address} on ${network.name} (blocks ${latestBlock + 1} to ${currentBlock})`);

      // Scan new blocks for transactions
      const newTransactions = await this.scanBlocksForAddress(
        address,
        network,
        latestBlock + 1,
        currentBlock
      );

      if (newTransactions.length > 0) {
        console.log(`Found ${newTransactions.length} new transactions for ${address}`);
        await indexer.indexTransactions(address, network, newTransactions);
        
        // Trigger event for UI update
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('transactionsUpdated', {
            detail: { address, network, transactions: newTransactions }
          }));
        }
      }
    } catch (error) {
      console.error('Transaction sync error:', error);
    }
  }

  /**
   * Scan blocks for transactions involving an address
   */
  private async scanBlocksForAddress(
    address: string,
    network: Network,
    fromBlock: number,
    toBlock: number
  ): Promise<IndexedTransaction[]> {
    try {
      const provider = getProvider(network);
      const addressLower = address.toLowerCase();
      const transactions: IndexedTransaction[] = [];
      
      // Import rate limiter
      const { rpcRateLimiter, retryWithBackoff } = await import('../utils/rateLimiter');

      // Limit scan range to prevent timeout
      const maxBlocksToScan = 1000;
      const endBlock = Math.min(toBlock, fromBlock + maxBlocksToScan);

      for (let blockNum = endBlock; blockNum >= fromBlock; blockNum--) {
        try {
          // Add delay between block fetches to avoid rate limiting
          if (blockNum < endBlock) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          const block = await rpcRateLimiter.execute(() =>
            retryWithBackoff(() => provider.getBlock(blockNum, true), 3, 1000)
          );
          
          if (block && block.transactions) {
            for (const tx of block.transactions) {
              if (typeof tx === 'object' && tx !== null && 'from' in tx) {
                const txObj = tx as { hash: string; from: string; to: string | null; value: bigint };
                
                if (
                  txObj.from?.toLowerCase() === addressLower ||
                  txObj.to?.toLowerCase() === addressLower
                ) {
                  // Get transaction receipt for status
                  let status: 'confirmed' | 'failed' = 'confirmed';
                  try {
                    const receipt = await rpcRateLimiter.execute(() =>
                      retryWithBackoff(() => provider.getTransactionReceipt(txObj.hash), 3, 1000)
                    );
                    if (receipt) {
                      status = receipt.status === 1 ? 'confirmed' : 'failed';
                    }
                  } catch {
                    // Use default status
                  }

                  transactions.push({
                    hash: txObj.hash,
                    from: txObj.from,
                    to: txObj.to,
                    value: ethers.formatEther(txObj.value || BigInt(0)),
                    timestamp: Number(block.timestamp),
                    blockNumber: Number(block.number),
                    status: status,
                    networkId: network.id,
                    networkChainId: network.chainId,
                  });
                }
              }
            }
          }
        } catch (blockError) {
          // Skip individual block errors
          continue;
        }
      }

      return transactions;
    } catch (error) {
      console.error('Block scan error:', error);
      return [];
    }
  }

  /**
   * Stop all tracking
   */
  stopAll(): void {
    this.pollingIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.pollingIntervals.clear();
    this.trackedAddresses.clear();
    this.isTracking = false;
    console.log('Stopped all transaction tracking');
  }

  /**
   * Check if tracking is active
   */
  isActive(): boolean {
    return this.isTracking;
  }
}

// Singleton instance
let trackerInstance: TransactionTracker | null = null;

/**
 * Get the global transaction tracker instance
 */
export function getTransactionTracker(): TransactionTracker {
  if (!trackerInstance) {
    trackerInstance = new TransactionTracker();
  }
  return trackerInstance;
}

