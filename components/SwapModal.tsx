'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { executeSwap, getSwapQuote, POPULAR_TOKENS, NATIVE_TOKEN, SwapQuote, SwapParams } from '@/lib/services/swapService';
import { getUniswapQuote, executeUniswapSwap, isUniswapSupported } from '@/lib/services/uniswapService';
import { getTokenBalance, getBalance } from '@/lib/wallet/provider';
import { isValidAddress } from '@/lib/wallet/utils';
import { TransactionService } from '@/lib/wallet/transactionService';
import { X, ArrowDownUp, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function SwapModal({ onClose }: { onClose: () => void }) {
  const { wallet, currentNetwork, refreshBalance, refreshTransactions } = useWallet();
  const [fromToken, setFromToken] = useState(NATIVE_TOKEN);
  const [toToken, setToToken] = useState('');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fromBalance, setFromBalance] = useState('0');
  const [toBalance, setToBalance] = useState('0');
  const [useUniswap, setUseUniswap] = useState(false);

  const popularTokens = POPULAR_TOKENS[currentNetwork.chainId] || {};
  const tokenList = Object.values(popularTokens);

  useEffect(() => {
    if (tokenList.length > 0 && !toToken) {
      // Set default toToken to first non-native token
      const firstNonNative = tokenList.find(t => t.address !== NATIVE_TOKEN);
      if (firstNonNative) {
        setToToken(firstNonNative.address);
      }
    }
  }, [currentNetwork.chainId]);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!wallet) return;

      try {
        // Fetch from token balance
        if (fromToken === NATIVE_TOKEN) {
          // Use getBalance for native tokens
          const bal = await getBalance(wallet.address, currentNetwork);
          setFromBalance(bal);
        } else {
          // Use getTokenBalance for ERC-20 tokens
          const bal = await getTokenBalance(fromToken, wallet.address, currentNetwork);
          setFromBalance(bal);
        }

        // Fetch to token balance
        if (toToken && toToken !== NATIVE_TOKEN) {
          // Use getTokenBalance for ERC-20 tokens
          const bal = await getTokenBalance(toToken, wallet.address, currentNetwork);
          setToBalance(bal);
        } else if (toToken === NATIVE_TOKEN) {
          // Use getBalance for native tokens
          const bal = await getBalance(wallet.address, currentNetwork);
          setToBalance(bal);
        }
      } catch (error) {
        console.error('Error fetching balances:', error);
        // Set balances to 0 on error to prevent UI issues
        setFromBalance('0');
        setToBalance('0');
      }
    };

    fetchBalances();
  }, [wallet, fromToken, toToken, currentNetwork]);

  useEffect(() => {
    // Check if we should use Uniswap (for testnets or if 1inch fails)
    const shouldUseUniswap = isUniswapSupported(currentNetwork.chainId) && 
                            (currentNetwork.chainId === 11155111 || useUniswap);
    setUseUniswap(shouldUseUniswap);
  }, [currentNetwork.chainId, useUniswap]);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!wallet || !fromAmount || !toToken || parseFloat(fromAmount) <= 0) {
        setQuote(null);
        setToAmount('');
        return;
      }

      setIsLoadingQuote(true);
      setError('');

      try {
        let swapQuote: SwapQuote | null = null;

        // Try 1inch first (unless on testnet or Uniswap is preferred)
        if (!useUniswap) {
          try {
            swapQuote = await getSwapQuote(
              currentNetwork,
              fromToken,
              toToken,
              fromAmount,
              wallet.address
            );
          } catch (err: any) {
            // If 1inch fails and Uniswap is available, try Uniswap
            if (isUniswapSupported(currentNetwork.chainId)) {
              console.log('1inch failed, trying Uniswap...');
              setUseUniswap(true);
            } else {
              throw err;
            }
          }
        }

        // Try Uniswap if 1inch failed or if we're using Uniswap
        if (!swapQuote && useUniswap && isUniswapSupported(currentNetwork.chainId)) {
          const uniswapQuote = await getUniswapQuote(
            currentNetwork,
            fromToken,
            toToken,
            fromAmount
          );

          if (uniswapQuote) {
            swapQuote = {
              fromToken: uniswapQuote.fromToken,
              toToken: uniswapQuote.toToken,
              fromTokenAmount: uniswapQuote.fromTokenAmount,
              toTokenAmount: uniswapQuote.toTokenAmount,
              estimatedGas: uniswapQuote.estimatedGas,
              protocols: [],
            };
          }
        }

        if (swapQuote) {
          setQuote(swapQuote);
          setToAmount(swapQuote.toTokenAmount);
        } else {
          setError('Failed to get swap quote. Please try again.');
          setQuote(null);
          setToAmount('');
        }
      } catch (err: any) {
        console.error('Error fetching quote:', err);
        setError(err.message || 'Failed to get swap quote');
        setQuote(null);
        setToAmount('');
      } finally {
        setIsLoadingQuote(false);
      }
    };

    // Debounce quote fetching
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [fromToken, toToken, fromAmount, wallet, currentNetwork, useUniswap]);

  const handleSwap = async () => {
    if (!wallet) return;

    setError('');
    setSuccess('');

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setError('Please enter an amount');
      return;
    }

    if (parseFloat(fromAmount) > parseFloat(fromBalance)) {
      setError('Insufficient balance');
      return;
    }

    if (!toToken) {
      setError('Please select a token to swap to');
      return;
    }

    try {
      setIsSwapping(true);

      let txHash: string;

      // Use Uniswap for testnets or if preferred
      if (useUniswap && isUniswapSupported(currentNetwork.chainId)) {
        const amountOutMin = quote 
          ? (parseFloat(quote.toTokenAmount) * (1 - parseFloat(slippage) / 100)).toString()
          : '0';
        
        // Get fee from quote if available (Uniswap quote includes fee)
        const fee = 3000; // Default to 0.3% fee tier
        
        const tx = await executeUniswapSwap(
          currentNetwork,
          wallet.privateKey,
          fromToken,
          toToken,
          fromAmount,
          amountOutMin,
          fee,
          parseFloat(slippage)
        );
        
        txHash = tx.hash;
      } else {
        const swapParams: SwapParams = {
          fromToken,
          toToken,
          amount: fromAmount,
          fromAddress: wallet.address,
          slippage: parseFloat(slippage),
        };

        const tx = await executeSwap(currentNetwork, wallet.privateKey, swapParams);
        txHash = tx.hash;
      }
      
      setSuccess(`Swap initiated! Transaction hash: ${txHash}`);

      // Wait for confirmation
      const txService = new TransactionService(currentNetwork, wallet.privateKey);
      const confirmed = await txService.waitForConfirmation(txHash, 1);

      if (confirmed.status === 'confirmed') {
        setSuccess(`Swap completed! Block: ${confirmed.blockNumber}`);
      } else {
        setError('Swap failed');
        setIsSwapping(false);
        return;
      }

      // Refresh balances and transactions
      setTimeout(() => {
        refreshBalance();
        refreshTransactions();
        // Close modal after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      }, 1000);
    } catch (err: any) {
      console.error('Swap error:', err);
      setError(err.message || 'Failed to execute swap. Please try again.');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleSwitchTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handleMax = () => {
    setFromAmount(fromBalance);
  };

  const getTokenSymbol = (address: string) => {
    if (address === NATIVE_TOKEN) {
      return currentNetwork.currencySymbol;
    }
    const token = tokenList.find(t => t.address.toLowerCase() === address.toLowerCase());
    return token?.symbol || 'TOKEN';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="glass rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
            <ArrowDownUp className="w-6 h-6 text-indigo-400" />
            <span>Swap Tokens</span>
          </h2>
          <button
            onClick={onClose}
            className="btn btn-ghost p-2 rounded-xl text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* From Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-gray-400 text-sm font-medium">From</label>
              <span className="text-gray-500 text-xs">Balance: {parseFloat(fromBalance).toFixed(4)}</span>
            </div>
            <div className="bg-black/30 rounded-xl border border-white/10 p-4">
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => {
                    setFromAmount(e.target.value);
                    setError('');
                  }}
                  placeholder="0.0"
                  step="0.0001"
                  min="0"
                  className="flex-1 bg-transparent text-white text-xl font-semibold focus:outline-none placeholder-gray-600"
                />
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleMax}
                    className="text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-2 py-1 rounded transition-colors"
                  >
                    MAX
                  </button>
                  <select
                    value={fromToken}
                    onChange={(e) => setFromToken(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value={NATIVE_TOKEN}>{currentNetwork.currencySymbol}</option>
                    {tokenList.filter(t => t.address !== NATIVE_TOKEN).map((token) => (
                      <option key={token.address} value={token.address}>
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={handleSwitchTokens}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-full border-4 border-black/50 transition-all duration-200 shadow-lg shadow-indigo-500/30"
            >
              <ArrowDownUp className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* To Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-gray-400 text-sm font-medium">To</label>
              <span className="text-gray-500 text-xs">Balance: {parseFloat(toBalance).toFixed(4)}</span>
            </div>
            <div className="bg-black/30 rounded-xl border border-white/10 p-4">
              <div className="flex items-center space-x-3">
                <div className="flex-1 text-white text-xl font-semibold">
                  {isLoadingQuote ? (
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  ) : (
                    toAmount || '0.0'
                  )}
                </div>
                <select
                  value={toToken}
                  onChange={(e) => setToToken(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value={NATIVE_TOKEN}>{currentNetwork.currencySymbol}</option>
                  {tokenList.filter(t => t.address !== NATIVE_TOKEN).map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Slippage Tolerance */}
          <div>
            <label className="block text-gray-400 text-sm font-medium mb-2">
              Slippage Tolerance (%)
            </label>
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              placeholder="1"
              step="0.1"
              min="0.1"
              max="50"
              className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Quote Info */}
          {quote && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
              <p className="text-indigo-300 text-xs">
                Rate: 1 {getTokenSymbol(fromToken)} = {quote ? (parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6) : '0'} {getTokenSymbol(toToken)}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-4 pt-2">
            <button
              onClick={onClose}
              disabled={isSwapping}
              className="flex-1 btn btn-ghost py-3 rounded-xl text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSwap}
              disabled={isSwapping || isLoadingQuote || !quote || !fromAmount || !toToken}
              className="flex-1 btn btn-primary py-3 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSwapping ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Swapping...</span>
                </>
              ) : (
                <>
                  <ArrowDownUp className="w-5 h-5" />
                  <span>Swap</span>
                </>
              )}
            </button>
          </div>

          {/* Info */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
            <p className="text-yellow-200/80 text-xs">
              {useUniswap ? (
                <>⚡ Powered by Uniswap V3. Always review the swap details before confirming.</>
              ) : (
                <>⚡ Powered by 1inch Fusion. Always review the swap details before confirming.</>
              )}
            </p>
            {currentNetwork.chainId === 11155111 && (
              <p className="text-yellow-200/80 text-xs mt-2 font-semibold">
                ✅ Using Uniswap V3 for Sepolia testnet (1inch doesn't support testnets).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

