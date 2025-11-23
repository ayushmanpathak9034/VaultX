'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { WalletData, hasStoredWallet, getStoredWallet, decryptWallet, clearStoredWallet } from '@/lib/wallet/utils';
import { Network, getCurrentNetwork, setCurrentNetwork, getAllNetworks } from '@/lib/wallet/networks';
import { getBalance, getTransactionHistory } from '@/lib/wallet/provider';

interface WalletContextType {
  wallet: WalletData | null;
  isUnlocked: boolean;
  currentNetwork: Network;
  balance: string;
  transactions: any[];
  isLoading: boolean;
  unlockWallet: (password: string) => Promise<boolean>;
  lockWallet: () => void;
  setNetwork: (chainId: number) => void;
  refreshBalance: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshNetworks: () => void;
  networks: Network[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentNetwork, setCurrentNetworkState] = useState<Network>(getCurrentNetwork());
  const [balance, setBalance] = useState<string>('0');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [networks, setNetworks] = useState<Network[]>(getAllNetworks());

  const refreshNetworks = useCallback(() => {
    setNetworks(getAllNetworks());
  }, []);

  const unlockWallet = useCallback(async (password: string): Promise<boolean> => {
    try {
      const stored = getStoredWallet();
      if (!stored) {
        throw new Error('No wallet found');
      }
      
      const decrypted = decryptWallet(stored, password);
      setWallet(decrypted);
      setIsUnlocked(true);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_unlocked', 'true');
      }
      
      return true;
    } catch (error) {
      console.error('Failed to unlock wallet:', error);
      return false;
    }
  }, []);

  const lockWallet = useCallback(() => {
    setWallet(null);
    setIsUnlocked(false);
    setBalance('0');
    setTransactions([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wallet_unlocked');
    }
  }, []);

  const setNetwork = useCallback((chainId: number) => {
    const allNetworks = getAllNetworks();
    const network = allNetworks.find(n => n.chainId === chainId);
    if (network) {
      setCurrentNetworkState(network);
      setCurrentNetwork(chainId);
      setNetworks(allNetworks);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!wallet || !isUnlocked) return;
    
    try {
      setIsLoading(true);
      const bal = await getBalance(wallet.address, currentNetwork);
      // Ensure balance is a valid number, default to "0" if invalid
      const numBalance = parseFloat(bal);
      setBalance(isNaN(numBalance) ? '0' : bal);
    } catch (error: any) {
      console.error('Error fetching balance:', error);
      // Set balance to "0" on any error
      setBalance('0');
    } finally {
      setIsLoading(false);
    }
  }, [wallet, isUnlocked, currentNetwork]);

  const refreshTransactions = useCallback(async () => {
    if (!wallet || !isUnlocked) return;
    
    try {
      setIsLoading(true);
      console.log(`Fetching ALL transactions for ${wallet.address} on ${currentNetwork.name}...`);
      
      // Use indexer-based transaction fetching (fetches ALL transactions)
      const { getTransactionHistoryWithIndexer } = await import('@/lib/wallet/provider');
      let txs = await getTransactionHistoryWithIndexer(wallet.address, currentNetwork);
      
      // If no transactions found, try fallback methods with high limit
      if (txs.length === 0) {
        console.log('No transactions from indexer, trying fallback methods...');
        const { getTransactionHistoryImproved } = await import('@/lib/wallet/provider');
        txs = await getTransactionHistoryImproved(wallet.address, currentNetwork, 10000);
      }
      
      if (txs.length === 0) {
        txs = await getTransactionHistory(wallet.address, currentNetwork, 10000);
      }
      
      // Sort by timestamp descending (newest first)
      const sortedTxs = txs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setTransactions(sortedTxs);
      
      console.log(`Loaded ${sortedTxs.length} transactions for ${currentNetwork.name} (ALL on-chain transactions)`);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, isUnlocked, currentNetwork]);

  // Check if wallet was previously unlocked
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const wasUnlocked = localStorage.getItem('wallet_unlocked') === 'true';
      if (wasUnlocked && hasStoredWallet()) {
        // Wallet exists but needs password to unlock
        setIsUnlocked(false);
      }
    }
  }, []);

  // Refresh balance when network or wallet changes
  useEffect(() => {
    if (isUnlocked && wallet) {
      refreshBalance();
      refreshTransactions();
      
      // Start background transaction tracking
      const startTracking = async () => {
        try {
          const { getTransactionTracker } = await import('@/lib/wallet/transactionTracker');
          const tracker = getTransactionTracker();
          await tracker.startTracking(wallet.address, currentNetwork);
        } catch (error) {
          console.error('Failed to start transaction tracking:', error);
        }
      };
      
      startTracking();
      
      // Listen for transaction updates
      const handleTransactionUpdate = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail?.address?.toLowerCase() === wallet.address.toLowerCase() &&
            customEvent.detail?.network?.chainId === currentNetwork.chainId) {
          refreshTransactions();
          refreshBalance();
        }
      };
      
      window.addEventListener('transactionsUpdated', handleTransactionUpdate);
      
      return () => {
        // Stop tracking when component unmounts or wallet/network changes
        const stopTracking = async () => {
          try {
            const { getTransactionTracker } = await import('@/lib/wallet/transactionTracker');
            const tracker = getTransactionTracker();
            tracker.stopTracking(wallet.address, currentNetwork);
          } catch (error) {
            console.error('Failed to stop transaction tracking:', error);
          }
        };
        
        stopTracking();
        window.removeEventListener('transactionsUpdated', handleTransactionUpdate);
      };
    }
  }, [isUnlocked, wallet, currentNetwork, refreshBalance, refreshTransactions]);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        isUnlocked,
        currentNetwork,
        balance,
        transactions,
        isLoading,
        unlockWallet,
        lockWallet,
        setNetwork,
        refreshBalance,
        refreshTransactions,
        refreshNetworks,
        networks,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

