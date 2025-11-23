import { Network } from './networks';
import { getProvider } from './provider';
import { fetchTransactionsFromExplorer } from './explorer';
import { ethers } from 'ethers';

export interface IndexedTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  timestamp: number;
  blockNumber: number;
  status: 'pending' | 'confirmed' | 'failed';
  networkId: string;
  networkChainId: number;
  gasUsed?: string;
  gasPrice?: string;
  data?: string;
}

/**
 * Inbuilt Transaction Indexer using IndexedDB
 * Provides fast, offline-capable transaction lookups by address
 */
export class TransactionIndexer {
  private dbName = 'TankiWalletIndexer';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for transactions
        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'hash' });
          txStore.createIndex('from', 'from', { unique: false });
          txStore.createIndex('to', 'to', { unique: false });
          txStore.createIndex('address', ['from', 'to'], { unique: false });
          txStore.createIndex('networkChainId', 'networkChainId', { unique: false });
          txStore.createIndex('timestamp', 'timestamp', { unique: false });
          txStore.createIndex('blockNumber', 'blockNumber', { unique: false });
        }

        // Create object store for address indexes
        if (!db.objectStoreNames.contains('addressIndex')) {
          const addressStore = db.createObjectStore('addressIndex', { keyPath: 'id' });
          addressStore.createIndex('address', 'address', { unique: true });
          addressStore.createIndex('networkChainId', 'networkChainId', { unique: false });
        }
      };
    });
  }

  /**
   * Index transactions for an address
   */
  async indexTransactions(
    address: string,
    network: Network,
    transactions: IndexedTransaction[]
  ): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const txStore = this.db.transaction(['transactions', 'addressIndex'], 'readwrite');
      const txObjectStore = txStore.objectStore('transactions');
      const addressObjectStore = txStore.objectStore('addressIndex');

      let completed = 0;
      const total = transactions.length;

      if (total === 0) {
        resolve();
        return;
      }

      // Index each transaction
      transactions.forEach((tx) => {
        const indexedTx: IndexedTransaction = {
          ...tx,
          networkId: network.id,
          networkChainId: network.chainId,
        };

        const request = txObjectStore.put(indexedTx);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            // Update address index
            this.updateAddressIndex(address, network.chainId, txObjectStore, addressObjectStore)
              .then(() => resolve())
              .catch(reject);
          }
        };
        request.onerror = () => {
          completed++;
          if (completed === total) {
            resolve(); // Continue even if some fail
          }
        };
      });
    });
  }

  /**
   * Update address index with latest block number
   */
  private async updateAddressIndex(
    address: string,
    chainId: number,
    txStore: IDBObjectStore,
    addressStore: IDBObjectStore
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const indexKey = `${address.toLowerCase()}_${chainId}`;
      const getRequest = addressStore.get(indexKey);

      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        const latestBlock = existing?.latestBlock || 0;

        // Find latest block from transactions
        const index = txStore.index('address');
        const range = IDBKeyRange.bound(
          [address.toLowerCase(), chainId, 0],
          [address.toLowerCase(), chainId, Number.MAX_SAFE_INTEGER]
        );

        const getAllRequest = index.getAll(range);
        getAllRequest.onsuccess = () => {
          const txs = getAllRequest.result as IndexedTransaction[];
          const maxBlock = txs.reduce((max, tx) => Math.max(max, tx.blockNumber), latestBlock);

          const addressIndex = {
            id: indexKey,
            address: address.toLowerCase(),
            networkChainId: chainId,
            latestBlock: maxBlock,
            lastUpdated: Date.now(),
            txCount: txs.length,
          };

          const putRequest = addressStore.put(addressIndex);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(new Error('Failed to update address index'));
        };
        getAllRequest.onerror = () => resolve(); // Continue even if query fails
      };

      getRequest.onerror = () => resolve(); // Continue even if get fails
    });
  }

  /**
   * Get transactions for an address from index (ALL transactions, no limit)
   */
  async getTransactions(
    address: string,
    network: Network,
    limit?: number
  ): Promise<IndexedTransaction[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const txStore = this.db.transaction('transactions', 'readonly').objectStore('transactions');
      const index = txStore.index('networkChainId');
      const range = IDBKeyRange.only(network.chainId);

      const getAllRequest = index.getAll(range);
      getAllRequest.onsuccess = () => {
        const allTxs = getAllRequest.result as IndexedTransaction[];
        const addressLower = address.toLowerCase();

        // Filter by address (from or to)
        const filtered = allTxs.filter(
          (tx) =>
            tx.from.toLowerCase() === addressLower ||
            (tx.to && tx.to.toLowerCase() === addressLower)
        );

        // Sort by timestamp descending
        filtered.sort((a, b) => b.timestamp - a.timestamp);

        // Apply limit only if specified, otherwise return all
        resolve(limit ? filtered.slice(0, limit) : filtered);
      };

      getAllRequest.onerror = () => {
        resolve([]); // Return empty array on error
      };
    });
  }

  /**
   * Get latest indexed block for an address
   */
  async getLatestBlock(address: string, chainId: number): Promise<number> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve) => {
      if (!this.db) {
        resolve(0);
        return;
      }

      const indexKey = `${address.toLowerCase()}_${chainId}`;
      const addressStore = this.db.transaction('addressIndex', 'readonly').objectStore('addressIndex');
      const getRequest = addressStore.get(indexKey);

      getRequest.onsuccess = () => {
        const result = getRequest.result;
        resolve(result?.latestBlock || 0);
      };

      getRequest.onerror = () => {
        resolve(0);
      };
    });
  }

  /**
   * Sync transactions for an address (fetch ALL transactions and index them)
   */
  async syncTransactions(
    address: string,
    network: Network,
    limit?: number
  ): Promise<IndexedTransaction[]> {
    try {
      // Get latest indexed block
      const latestBlock = await this.getLatestBlock(address, network.chainId);
      const isFirstSync = latestBlock === 0;

      // Fetch ALL transactions from explorer API (use high limit for first sync)
      let newTransactions: IndexedTransaction[] = [];
      
      try {
        // For first sync, fetch all transactions (10000 limit)
        // For subsequent syncs, fetch recent ones
        const fetchLimit = isFirstSync ? 10000 : (limit || 1000);
        const explorerTxs = await fetchTransactionsFromExplorer(address, network, fetchLimit);
        newTransactions = explorerTxs.map((tx) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timestamp: tx.timestamp,
          blockNumber: tx.blockNumber,
          status: tx.status as 'confirmed' | 'failed',
          networkId: network.id,
          networkChainId: network.chainId,
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice,
        }));
        
        console.log(`Fetched ${newTransactions.length} transactions from explorer API`);
      } catch (error) {
        console.warn('Explorer API failed, trying RPC...', error);
        // Fallback to RPC scanning - scan from genesis if first sync
        const fromBlock = isFirstSync ? 0 : latestBlock;
        newTransactions = await this.fetchTransactionsFromRPC(address, network, fromBlock, limit || 10000);
      }

      // Index new transactions
      if (newTransactions.length > 0) {
        await this.indexTransactions(address, network, newTransactions);
        console.log(`Indexed ${newTransactions.length} new transactions`);
      }

      // Return ALL transactions from index (no limit)
      return await this.getTransactions(address, network);
    } catch (error) {
      console.error('Sync error:', error);
      // Return cached transactions on error
      return await this.getTransactions(address, network, limit);
    }
  }

  /**
   * Fetch transactions from RPC (fallback method)
   */
  private async fetchTransactionsFromRPC(
    address: string,
    network: Network,
    fromBlock: number,
    limit?: number
  ): Promise<IndexedTransaction[]> {
    try {
      const provider = getProvider(network);
      
      // Import rate limiter
      const { rpcRateLimiter, retryWithBackoff } = await import('../utils/rateLimiter');
      
      const currentBlock = await rpcRateLimiter.execute(() =>
        retryWithBackoff(() => provider.getBlockNumber(), 3, 1000)
      );
      const addressLower = address.toLowerCase();
      const transactions: IndexedTransaction[] = [];

      // Scan blocks from latest indexed block
      const startBlock = fromBlock > 0 ? fromBlock + 1 : Math.max(0, currentBlock - 5000);
      const maxTransactions = limit || 10000;
      
      for (let blockNum = currentBlock; blockNum >= startBlock && transactions.length < maxTransactions; blockNum--) {
        try {
          // Add delay between block fetches to avoid rate limiting
          if (blockNum < currentBlock) {
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
                  transactions.push({
                    hash: txObj.hash,
                    from: txObj.from,
                    to: txObj.to,
                    value: ethers.formatEther(txObj.value || BigInt(0)),
                    timestamp: Number(block.timestamp),
                    blockNumber: Number(block.number),
                    status: 'confirmed',
                    networkId: network.id,
                    networkChainId: network.chainId,
                  });
                  
                  // If limit is set and we've reached it, break
                  if (maxTransactions && transactions.length >= maxTransactions) {
                    break;
                  }
                }
              }
            }
          }
        } catch (e) {
          // Skip block errors
          continue;
        }
      }

      return transactions;
    } catch (error) {
      console.error('RPC fetch error:', error);
      return [];
    }
  }

  /**
   * Clear all indexed data for a network
   */
  async clearNetwork(network: Network): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const txStore = this.db.transaction('transactions', 'readwrite').objectStore('transactions');
      const index = txStore.index('networkChainId');
      const range = IDBKeyRange.only(network.chainId);

      const getAllRequest = index.getAllKeys(range);
      getAllRequest.onsuccess = () => {
        const keys = getAllRequest.result;
        let deleted = 0;
        const total = keys.length;

        if (total === 0) {
          resolve();
          return;
        }

        keys.forEach((key) => {
          const deleteRequest = txStore.delete(key);
          deleteRequest.onsuccess = () => {
            deleted++;
            if (deleted === total) resolve();
          };
          deleteRequest.onerror = () => {
            deleted++;
            if (deleted === total) resolve();
          };
        });
      };

      getAllRequest.onerror = () => resolve();
    });
  }

  /**
   * Get transaction count for an address
   */
  async getTransactionCount(address: string, network: Network): Promise<number> {
    const txs = await this.getTransactions(address, network, 10000);
    return txs.length;
  }
}

// Singleton instance
let indexerInstance: TransactionIndexer | null = null;

/**
 * Get the global indexer instance
 */
export function getIndexer(): TransactionIndexer {
  if (!indexerInstance) {
    indexerInstance = new TransactionIndexer();
  }
  return indexerInstance;
}

